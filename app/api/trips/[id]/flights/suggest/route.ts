// app/api/trips/[id]/flights/suggest/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { getTripBaseCurrency } from '@/app/lib/services/expense-service';
import { flightsSystemPrompt } from '@/app/lib/copilot/flights/prompts';
import { SUGGEST_FLIGHT_TOOL } from '@/app/lib/copilot/flights/tools';

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
    if (!apiKey) return NextResponse.json({ message: "The flight co-pilot isn't configured yet.", options: [] }, { status: 200 });

    let messages: ClientMessage[];
    let tripType: 'round_trip' | 'one_way';
    try {
        const body = await request.json();
        messages = body.messages;
        tripType = body.tripType === 'one_way' ? 'one_way' : 'round_trip';
    } catch {
        return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    if (!Array.isArray(messages) || messages.length === 0) {
        return NextResponse.json({ error: 'No conversation provided' }, { status: 400 });
    }

    const trip = await getTripDetail(ctx, tripId);
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    const baseCurrency = await getTripBaseCurrency(ctx, tripId);

    const dests = trip.destinations.map((d) => `${d.city ? d.city + ', ' : ''}${d.country}`);
    const routeHint = `Trip destinations (the traveller will pick which one this flight is for): ${dests.join(' · ') || 'unspecified'}.
                        Dates: ${trip.start_date} to ${trip.end_date}.
                        Travellers: ${trip.travelers.filter((t) => t.is_active).length}.
                        The departure origin is UNKNOWN — you must ask the traveller.`;

    const budgetHint = trip.trip_budget != null
        ? `Trip budget: ${trip.budget_currency ?? baseCurrency} ${trip.trip_budget.toLocaleString()} total (whole trip, not just flights).`
        : '';

    const anthropic = new Anthropic({ apiKey });
    const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));

    const collected: any[] = [];
    let summaryText = '';

    try {
        for (let turn = 0; turn < 4; turn++) {
            const response = await anthropic.messages.create({
                model: MODEL,
                max_tokens: 3000,
                system: flightsSystemPrompt({ homeCurrency: baseCurrency, routeHint, budgetHint, tripType }),
                tools: [SUGGEST_FLIGHT_TOOL],
                messages: convo,
            });

            if (response.stop_reason !== 'tool_use') {
                summaryText = response.content
                    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
                    .map((c) => c.text).join('\n').trim();
                break;
            }

            convo.push({ role: 'assistant', content: response.content });
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of response.content) {
                if (block.type !== 'tool_use') continue;
                if (block.name === 'suggest_flight') {
                    collected.push(block.input);   // proposed option — NOT saved yet
                    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify({ ok: true }) });
                } else {
                    toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool.', is_error: true });
                }
            }
            convo.push({ role: 'user', content: toolResults });
        }

        return NextResponse.json({
            message: summaryText || 'Here are a few options — shortlist any you like.',
            options: collected,
            base_currency: baseCurrency,
        });
    } catch (err) {
        console.error('[flights-suggest] error:', err);
        return NextResponse.json({ message: 'Something went wrong generating options. Please try again.', options: [] }, { status: 200 });
    }
}