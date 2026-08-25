// app/api/copilot/plan/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { PLANNING_TOOLS } from '@/app/lib/copilot/planning/tools';
import { planningSystemPrompt } from '@/app/lib/copilot/planning/prompts';
import { saveTrip, updateTrip, getTripDetail, addDestination, updateDestination, removeDestination, type TripInput } from '@/app/lib/services/trip-service';
import { addCoTravelers, updateTraveler, removeTraveler } from '@/app/lib/services/traveler-service';

const MODEL = 'claude-sonnet-4-5';

interface ClientMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ type: 'message', message: "The planning co-pilot isn't configured yet. (Missing API key.)" }, { status: 200 });
  }

  let messages: ClientMessage[];
  let activeTripId: number | null = null;
  try {
    const body = await request.json();
    messages = body.messages;
    activeTripId = body.activeTripId ?? null;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No conversation provided' }, { status: 400 });
  }

  const users = await rawQuery<{ home_currency: string }>(
    `SELECT home_currency FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const homeCurrency = users[0]?.home_currency ?? 'USD';
  const todayHint = 'Assume the current year is 2026 or later; never propose past dates.';

  const anthropic = new Anthropic({ apiKey });
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  let savedTripId: number | null = activeTripId;

  // If a trip is already active, give the model its current state (with ids) so it
  // can target specific travellers/destinations for corrections.
  let tripContext = '';
  if (savedTripId) {
    const cur = await getTripDetail(ctx, savedTripId);
    if (cur) {
      const dests = cur.destinations.map((d) => `  - destination_id ${d.destination_id}: ${d.city ? d.city + ', ' : ''}${d.country}`).join('\n') || '  (none)';
      const travs = cur.travelers.map((t) => `  - traveler_id ${t.traveler_id}: ${t.traveler_name}${t.is_primary ? ' (PRIMARY — do not edit/remove)' : ` · ${t.relationship_name ?? ''} · ${t.is_cost_sharer ? 'co-payer' : 'non-payer'}${t.is_active ? '' : ' · tentative'}`}`).join('\n') || '  (none)';
      tripContext = `\n\nCURRENT TRIP STATE (trip_id ${savedTripId}) — use these ids for corrections:\nDestinations:\n${dests}\nTravellers:\n${travs}`;
    }
  }

  try {
    for (let turn = 0; turn < 6; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: planningSystemPrompt({ homeCurrency, todayHint }) + tripContext,
        tools: PLANNING_TOOLS,
        messages: convo,
      });

      console.log('[copilot] turn', turn, 'stop:', response.stop_reason,
        'blocks:', response.content.map((c) => c.type + (c.type === 'tool_use' ? `:${c.name}` : '')).join(', '));

      if (response.stop_reason !== 'tool_use') {
        const text = response.content
          .filter((c): c is Anthropic.TextBlock => c.type === 'text')
          .map((c) => c.text).join('\n').trim();
        const full = savedTripId ? await getTripDetail(ctx, savedTripId) : null;
        return NextResponse.json({
          type: savedTripId ? 'saved' : 'message',
          message: text || 'Tell me a bit more about your trip.',
          trip: full,
          tripId: savedTripId,
        });
      }

      convo.push({ role: 'assistant', content: response.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        if (block.name === 'save_trip') {
          if (savedTripId) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'Trip already saved this session', trip_id: savedTripId }) });
            continue;
          }
          const input = block.input as TripInput;
          if (!input.budgetCurrency && input.budget) input.budgetCurrency = homeCurrency;
          const saved = await saveTrip(ctx, input);
          savedTripId = (saved as { tripId?: number }).tripId ?? null;
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true, trip_id: savedTripId, name: (saved as { name?: string }).name }) });

        } else if (block.name === 'save_travelers') {
          const { travelers } = block.input as { travelers: Array<{ traveler_name: string; relationship: number; is_cost_sharer: boolean; is_active?: boolean; traveler_email?: string | null }> };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip saved yet.' }) }); continue; }
          await addCoTravelers(ctx, savedTripId, (travelers ?? []).map((t) => ({
            traveler_name: t.traveler_name, relationship: t.relationship,
            is_cost_sharer: t.is_cost_sharer, is_active: t.is_active, traveler_email: t.traveler_email ?? null,
          })));
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true, added: (travelers ?? []).length }) });

        } else if (block.name === 'update_trip') {
          const fields = block.input as { name?: string; description?: string; startDate?: string; endDate?: string; budget?: number; budgetCurrency?: string };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip saved yet.' }) }); continue; }
          if (fields.budget != null && !fields.budgetCurrency) fields.budgetCurrency = homeCurrency;
          const ok = await updateTrip(ctx, savedTripId, fields);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok, trip_id: savedTripId }) });

        } else if (block.name === 'update_traveler') {
          const { traveler_id, ...patch } = block.input as { traveler_id: number; traveler_name?: string; relationship?: number; is_cost_sharer?: boolean; is_active?: boolean };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip.' }) }); continue; }
          await updateTraveler(ctx, savedTripId, traveler_id, patch);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });

        } else if (block.name === 'remove_traveler') {
          const { traveler_id } = block.input as { traveler_id: number };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip.' }) }); continue; }
          await removeTraveler(ctx, savedTripId, traveler_id);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });

        } else if (block.name === 'add_destination') {
          const d = block.input as { country: string; city?: string; countryCode?: string };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip.' }) }); continue; }
          await addDestination(ctx, savedTripId, { country: d.country, city: d.city ?? null, countryCode: d.countryCode ?? null });
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });

        } else if (block.name === 'update_destination') {
          const { destination_id, ...patch } = block.input as { destination_id: number; country?: string; city?: string; countryCode?: string };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip.' }) }); continue; }
          await updateDestination(ctx, savedTripId, destination_id, patch);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });

        } else if (block.name === 'remove_destination') {
          const { destination_id } = block.input as { destination_id: number };
          if (!savedTripId) { toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: false, error: 'No trip.' }) }); continue; }
          await removeDestination(ctx, savedTripId, destination_id);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });

        } else {
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool.', is_error: true });
        }
      }

      convo.push({ role: 'user', content: toolResults });
    }

    const full = savedTripId ? await getTripDetail(ctx, savedTripId) : null;
    return NextResponse.json({ type: savedTripId ? 'saved' : 'message', message: 'Your trip is saved.', trip: full, tripId: savedTripId });
  } catch (err) {
    console.error('[copilot] error:', err);
    return NextResponse.json({ type: 'message', message: 'Something went wrong reaching the planner. Please try again.' }, { status: 200 });
  }
}