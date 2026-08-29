// app/api/trips/[id]/flights/check-duplicate/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { findDuplicateConfirmed } from '@/app/lib/services/flight-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const warnings = await findDuplicateConfirmed(
    ctx, tripId,
    body.exclude_booking_id ?? null,
    Array.isArray(body.legs) ? body.legs : [],
    Array.isArray(body.bearer_traveler_ids) ? body.bearer_traveler_ids.map(Number) : [],
  );
  return NextResponse.json({ warnings });
}