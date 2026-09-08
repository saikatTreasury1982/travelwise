// app/api/trips/[id]/itinerary/draft/discard/route.ts
// POST = discard the current draft session, saving nothing.
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { discardSession } from '@/app/lib/services/itinerary-draft-service';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  await discardSession(ctx, tripId);
  return NextResponse.json({ ok: true });
}