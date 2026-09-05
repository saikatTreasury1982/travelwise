// app/api/trips/[id]/itinerary/activities/[aid]/assist/summarise/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { assistSummarisePrompt } from '@/app/lib/copilot/activity-assist/prompts';
import { SAVE_SUMMARY_TOOL } from '@/app/lib/copilot/activity-assist/tools';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MODEL = 'claude-haiku-4-5';   // cheap distillation

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await params;
  const body = await request.json().catch(() => ({}));
  const answer = String(body?.answer ?? '').trim();
  if (!answer) return NextResponse.json({ error: 'Nothing to summarise.' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ title: 'Saved note', summary: answer.slice(0, 200) }, { status: 200 });

  const anthropic = new Anthropic({ apiKey });
  try {
    const res = await anthropic.messages.create({
      model: MODEL, max_tokens: 300,
      system: assistSummarisePrompt(),
      tools: [SAVE_SUMMARY_TOOL], tool_choice: { type: 'tool', name: 'save_summary' },
      messages: [{ role: 'user', content: answer }],
    });
    const tool = res.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'save_summary');
    const out = tool?.input as any;
    return NextResponse.json({ title: out?.title ?? 'Saved note', summary: out?.summary ?? answer.slice(0, 200) });
  } catch {
    return NextResponse.json({ title: 'Saved note', summary: answer.slice(0, 200) }, { status: 200 });
  }
}