// app/api/trips/[id]/itinerary/draft/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { getTripBaseCurrency } from '@/app/lib/services/expense-service';
import { createItineraryFromDraft, type DraftItinerary } from '@/app/lib/services/itinerary-service';
import { itineraryDraftPrompt } from '@/app/lib/copilot/itinerary/prompts';
import { DRAFT_ITINERARY_TOOL } from '@/app/lib/copilot/itinerary/tools';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MODEL = 'claude-sonnet-4-5';
interface ClientMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "The itinerary co-pilot isn't configured yet.", drafted: false }, { status: 200 });

  let messages: ClientMessage[];
  try {
    const body = await request.json();
    messages = body.messages;
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No conversation provided' }, { status: 400 });
  }

  const trip = await getTripDetail(ctx, tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  const baseCurrency = await getTripBaseCurrency(ctx, tripId);

  const destinationCities = trip.destinations
    .map((d) => d.city)
    .filter((c): c is string => !!c);
  const destinationsHint = destinationCities.join(', ');
  const nights = (() => {
    try {
      const a = new Date(trip.start_date + 'T00:00:00').getTime();
      const b = new Date(trip.end_date + 'T00:00:00').getTime();
      return Math.max(0, Math.round((b - a) / 86400000));
    } catch { return 0; }
  })();

  const anthropic = new Anthropic({ apiKey });
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: itineraryDraftPrompt({
        homeCurrency: baseCurrency,
        destinationsHint,
        tripStart: trip.start_date,
        tripEnd: trip.end_date,
        nights,
        travelerCount: trip.travelers.filter((t) => t.is_active).length,
      }),
      tools: [DRAFT_ITINERARY_TOOL],
      messages: convo,
    });

    // Did the model draft (tool call) or ask a question (text only)?
    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'draft_itinerary',
    );

    if (!toolUse) {
      // Mini-conversation: return the model's question for the user to answer.
      const text = response.content
        .filter((c): c is Anthropic.TextBlock => c.type === 'text')
        .map((c) => c.text).join('\n').trim();
      return NextResponse.json({ drafted: false, message: text || 'Tell me a little more and I\'ll draft your plan.' });
    }

    // Build + persist the whole itinerary from the structured draft.
    const draft = toolUse.input as DraftItinerary;
    if (draft.mode !== 'day' && draft.mode !== 'range') {
      return NextResponse.json({ drafted: false, message: 'I could not structure that plan — try again.' }, { status: 200 });
    }
    const summary = response.content
      .filter((c): c is Anthropic.TextBlock => c.type === 'text')
      .map((c) => c.text).join('\n').trim() || null;

    const itineraryId = await createItineraryFromDraft(ctx, tripId, draft, { summary });

    return NextResponse.json({ drafted: true, itinerary_id: itineraryId, message: summary });
  } catch (err) {
    console.error('[itinerary-draft] error:', err);
    return NextResponse.json({ drafted: false, message: 'Something went wrong drafting your itinerary. Please try again.' }, { status: 200 });
  }
}