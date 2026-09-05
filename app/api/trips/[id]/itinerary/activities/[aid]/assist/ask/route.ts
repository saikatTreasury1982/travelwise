// app/api/trips/[id]/itinerary/activities/[aid]/assist/ask/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { buildAssistContext } from '@/app/lib/services/assist-service';
import { assistAskPrompt } from '@/app/lib/copilot/activity-assist/prompts';

export const runtime = 'nodejs';
export const maxDuration = 40;
const MODEL = 'claude-sonnet-4-5';
interface Msg { role: 'user' | 'assistant'; content: string; }

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  const messages: Msg[] = Array.isArray(body?.messages) ? body.messages : [];
  if (messages.length === 0) return NextResponse.json({ error: 'No message.' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "The co-pilot isn't configured yet." }, { status: 200 });

  const actx = await buildAssistContext(ctx, Number(id), Number(aid));
  if (!actx) return NextResponse.json({ error: 'Activity not found.' }, { status: 404 });

  const anthropic = new Anthropic({ apiKey });
  try {
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 1000,
      system: assistAskPrompt(actx),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
    const text = res.content.filter((c): c is Anthropic.TextBlock => c.type === 'text').map((c) => c.text).join('\n').trim();
    return NextResponse.json({ message: text || 'Sorry, I could not help with that.' });
  } catch (e) {
    console.error('[assist-ask]', e);
    return NextResponse.json({ message: 'Something went wrong — try again.' }, { status: 200 });
  }
}