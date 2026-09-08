// app/api/trips/[id]/itinerary/draft/route.ts
// POST = start a draft session (replace-on-new, first generate).
// GET  = read the current draft session (for the preview page / refresh).
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { startSession, getSession, type DraftPreferences } from '@/app/lib/services/itinerary-draft-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  const session = await getSession(ctx, tripId);
  return NextResponse.json({ session });
}

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
      brief: typeof body?.brief === 'string' ? body.brief : null,
      pace: body?.pace, budget: body?.budget,
      focus: Array.isArray(body?.focus) ? body.focus : undefined,
    };
  } catch { /* empty prefs are fine — draft from trip facts alone */ }

  try {
    const session = await startSession(ctx, tripId, prefs);
    return NextResponse.json({ session });
  } catch (err) {
    console.error('[itinerary-draft:start] error:', err);
    return NextResponse.json({ error: 'Could not start a draft. Please try again.' }, { status: 200 });
  }
}