// app/api/trips/[id]/itinerary/activities/[aid]/assist/chip/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { buildAssistContext } from '@/app/lib/services/assist-service';
import { assistChipPrompt, type AssistChip } from '@/app/lib/copilot/activity-assist/prompts';
import { ASSIST_ANSWER_TOOL } from '@/app/lib/copilot/activity-assist/tools';

export const runtime = 'nodejs';
export const maxDuration = 40;
const MODEL = 'claude-sonnet-4-5';
const CHIPS: AssistChip[] = ['getting_here', 'food', 'timing', 'tips'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const tripId = Number(id), activityId = Number(aid);
  const body = await request.json().catch(() => ({}));
  const chip = body?.chip as AssistChip;
  if (!CHIPS.includes(chip)) return NextResponse.json({ error: 'Unknown chip.' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "The co-pilot isn't configured yet." }, { status: 200 });

  const actx = await buildAssistContext(ctx, tripId, activityId);
  if (!actx) return NextResponse.json({ error: 'Activity not found.' }, { status: 404 });

  const anthropic = new Anthropic({ apiKey });
  try {
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 1200,
      system: assistChipPrompt(chip, actx),
      tools: [ASSIST_ANSWER_TOOL], tool_choice: { type: 'tool', name: 'assist_answer' },
      messages: [{ role: 'user', content: `Help me with: ${chip.replace('_', ' ')} for "${actx.activityName}".` }],
    });
    const tool = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'assist_answer');
    const out = tool?.input as any;
    if (!out) return NextResponse.json({ error: 'No answer produced.' }, { status: 200 });
    return NextResponse.json({ answer: out.answer, title: out.title, summary: out.summary, assist_type: chip });
  } catch (e) {
    console.error('[assist-chip]', e);
    return NextResponse.json({ error: 'Could not get help right now.' }, { status: 200 });
  }
}