// app/api/copilot/plan/route.ts
// The conversational trip-planning co-pilot. Takes the running conversation,
// calls Claude with a "save_trip" tool, and either:
//   - asks a friendly follow-up (assistant text), or
//   - saves the trip (tool call) and returns the saved trip.
// Ephemeral: the client holds the conversation; nothing is persisted except
// the final Trip. Requires auth + ANTHROPIC_API_KEY.
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { saveTrip, type TripInput } from '@/app/lib/services/trip-service';
import { rawQuery } from '@/app/lib/db/client';

const MODEL = 'claude-sonnet-4-5';

// The tool Claude calls when it has enough to save a trip.
const SAVE_TRIP_TOOL: Anthropic.Tool = {
  name: 'save_trip',
  description:
    'Save a trip once you have gathered the minimum required info: a trip name, a start date, and an end date. Only call this when you have all three. Include destinations, budget, and travelers if known.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A short, descriptive trip name, e.g. "Family trip to Japan".' },
      description: { type: 'string' },
      startDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      endDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      budget: { type: 'number', description: 'Total budget amount, if known.' },
      budgetCurrency: { type: 'string', description: 'ISO currency code, e.g. USD, EUR.' },
      destinations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            city: { type: 'string' },
            countryCode: { type: 'string', description: 'ISO country code if known, e.g. JP.' },
          },
          required: ['country'],
        },
      },
      travelers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            relationship: { type: 'number', description: '1 Self, 2 Spouse, 3 Child, 4 Friend, 5 Family, 6 Colleague.' },
          },
          required: ['name'],
        },
      },
    },
    required: ['name', 'startDate', 'endDate'],
  },
};

function systemPrompt(homeCurrency: string, todayHint: string): string {
  return `You are the Travelwise planning co-pilot — a warm, concise travel assistant that turns a traveller's plain-English description into a saved Trip.

Your job:
1. Extract trip details from what the user says: name, destinations, dates, budget, and who's going.
2. A trip CANNOT be saved without: a trip name, a start date, and an end date. If any of these is missing or vague, ask for it in a friendly, natural way — one or two short questions at a time, never a wall of questions.
3. Infer sensibly: if the user gives a month and a duration ("10 days in April 2027"), propose concrete start/end dates and confirm. If they give a destination but no name, propose a name.
4. When you have name + start + end dates, call the save_trip tool. Include budget, destinations, and travelers if you know them.
5. The user's home currency is ${homeCurrency} — assume budget is in that currency unless they say otherwise.
6. Keep replies short and human. No bullet-point interrogations.

${todayHint}`;
}

interface ClientMessage { role: 'user' | 'assistant'; content: string; }

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { type: 'message', message: "The planning co-pilot isn't configured yet. (Missing API key.)" },
      { status: 200 },
    );
  }

  let messages: ClientMessage[];
  try {
    ({ messages } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'No conversation provided' }, { status: 400 });
  }

  // The user's home currency for budget defaulting.
  const users = await rawQuery<{ home_currency: string }>(
    `SELECT home_currency FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const homeCurrency = users[0]?.home_currency ?? 'USD';
  const todayHint = 'Assume the current year is 2026 or later; never propose past dates.';

  const anthropic = new Anthropic({ apiKey });

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(homeCurrency, todayHint),
      tools: [SAVE_TRIP_TOOL],
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    // Did Claude call save_trip?
    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'save_trip');
    if (toolUse) {
      const input = toolUse.input as TripInput;
      if (!input.budgetCurrency && input.budget) input.budgetCurrency = homeCurrency;
      const saved = await saveTrip(ctx, input);
      return NextResponse.json({ type: 'saved', trip: saved, tripInput: input });
    }

    // Otherwise, return the assistant's follow-up text.
    const text = response.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n').trim();
    return NextResponse.json({ type: 'message', message: text || 'Tell me a bit more about your trip.' });
  } catch (err) {
    console.error('[copilot] error:', err);
    return NextResponse.json({ type: 'message', message: 'Something went wrong reaching the planner. Please try again.' }, { status: 200 });
  }
}