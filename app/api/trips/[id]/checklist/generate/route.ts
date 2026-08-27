import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { requireUserContext } from '@/app/lib/auth/context';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { mergeGenerated, listChecklist } from '@/app/lib/services/checklist-service';
import { CHECKLIST_TOOLS } from '@/app/lib/copilot/checklist/tools';
import { checklistSystemPrompt } from '@/app/lib/copilot/checklist/prompts';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';
const MODEL = 'claude-sonnet-4-5';

function nights(a: string, b: string) {
  try { return Math.max(1, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); } catch { return 1; }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'AI is not configured (missing API key).' }, { status: 200 });

  const trip = await getTripDetail(ctx, tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

  const destinations = trip.destinations.map((d) => (d.city ? `${d.city}, ${d.country}` : d.country)).join('; ') || 'unspecified';
  const travellers = trip.travelers.filter((t) => t.is_active).map((t) => `${t.traveler_name}${t.relationship_name ? ` (${t.relationship_name})` : ''}`).join(', ') || 'unspecified';

  const anthropic = new Anthropic({ apiKey });
  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: checklistSystemPrompt({
        homeCurrency: '', tripName: trip.trip_name, destinations,
        startDate: trip.start_date, endDate: trip.end_date, nights: nights(trip.start_date, trip.end_date),
        travellers, notes: trip.trip_description ?? undefined,
      }),
      tools: CHECKLIST_TOOLS,
      tool_choice: { type: 'tool', name: 'generate_checklist' },
      messages: [{ role: 'user', content: 'Generate the checklist for this trip.' }],
    });

    const toolUse = response.content.find((c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'generate_checklist');
    if (!toolUse) return NextResponse.json({ error: 'AI did not return a checklist. Try again.' }, { status: 200 });

    const { categories } = toolUse.input as {
      categories: { category: string; kind?: 'packing' | 'task'; items: { name: string; priority?: string | null }[] }[];
    };
    const merged = await mergeGenerated(ctx, tripId, categories ?? []);
    await writeAudit({ event: 'trip.update', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { tripId, action: 'checklist.generate', ...merged } });

    const checklist = await listChecklist(ctx, tripId);
    return NextResponse.json({ ok: true, ...merged, checklist });
  } catch (err) {
    console.error('[checklist] generate error:', err);
    return NextResponse.json({ error: 'Something went wrong generating the checklist. Please try again.' }, { status: 200 });
  }
}