// app/api/trips/[id]/itinerary/[iid]/group/route.ts
import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserContext } from '@/app/lib/auth/context';
import { itineraryGroupingPrompt } from '@/app/lib/copilot/itinerary-grouping/prompts';
import { SUGGEST_GROUPING_TOOL } from '@/app/lib/copilot/itinerary-grouping/tools';

export const runtime = 'nodejs';
export const maxDuration = 30;
const MODEL = 'claude-haiku-4-5';   // light task → cheap/fast model

export async function POST(request: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  await params; // ids not needed server-side; grouping is proposed only, client applies

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ groups: [] }, { status: 200 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  // Activities to group: [{ activity_id, activity_name, start_time? }]
  const activities = Array.isArray(body?.activities) ? body.activities : [];
  if (activities.length < 2) return NextResponse.json({ groups: [] }, { status: 200 });

  const list = activities
    .map((a: any) => `id ${Number(a.activity_id)}: ${String(a.activity_name)}${a.start_time ? ` (${a.start_time})` : ''}`)
    .join('\n');

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: itineraryGroupingPrompt(),
      tools: [SUGGEST_GROUPING_TOOL],
      tool_choice: { type: 'tool', name: 'suggest_grouping' },
      messages: [{ role: 'user', content: `Activities:\n${list}` }],
    });

    const toolUse = response.content.find(
      (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'suggest_grouping',
    );
    const raw = (toolUse?.input as any)?.categories ?? [];

    // Keep only valid activity_ids from the provided set; drop empty groups.
    const valid = new Set(activities.map((a: any) => Number(a.activity_id)));
    const groups = raw
      .map((g: any) => ({
        category_name: String(g.category_name ?? '').trim(),
        activity_ids: (Array.isArray(g.activity_ids) ? g.activity_ids.map(Number) : []).filter((n: number) => valid.has(n)),
      }))
      .filter((g: any) => g.category_name && g.activity_ids.length > 0);

    return NextResponse.json({ groups });
  } catch (err) {
    console.error('[itinerary-group] error:', err);
    return NextResponse.json({ groups: [] }, { status: 200 });
  }
}