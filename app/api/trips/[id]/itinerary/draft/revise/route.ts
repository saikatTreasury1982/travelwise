// app/api/trips/[id]/itinerary/draft/revise/route.ts
// POST = revise the current draft with adjusted preferences. Entitlement-gated.
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { reviseSession, type DraftPreferences } from '@/app/lib/services/itinerary-draft-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let prefs: DraftPreferences = {};
  try {
    const body = await request.json();
    prefs = {
      brief: typeof body?.brief === 'string' ? body.brief : undefined,
      pace: body?.pace, budget: body?.budget,
      focus: Array.isArray(body?.focus) ? body.focus : undefined,
    };
  } catch { /* no-op prefs still re-generates */ }

  try {
    const { session, capped, note } = await reviseSession(ctx, tripId, prefs);
    if (!session) return NextResponse.json({ error: 'No draft to revise.' }, { status: 200 });
    if (capped) {
      return NextResponse.json({
        session, capped: true,
        message: "You've reached the adjustment limit on your plan. Accept this plan and fine-tune it by hand, or upgrade for unlimited revisions.",
      });
    }
    return NextResponse.json({ session, capped: false, note });
  } catch (err) {
    console.error('[itinerary-draft:revise] error:', err);
    return NextResponse.json({ error: 'Could not revise the draft. Please try again.' }, { status: 200 });
  }
}