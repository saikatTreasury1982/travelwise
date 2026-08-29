// app/api/trips/[id]/flights/bookings/[bid]/travelers/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setBookingBearers } from '@/app/lib/services/flight-service';
import { scopedQuery } from '@/app/lib/db/scoped';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { bid } = await params;
  const bookingId = Number(bid);
  const rows = await scopedQuery(
    ctx,
    `SELECT traveler_id FROM flight_booking_bearers WHERE {{tenant}} AND booking_id = ?`,
    [bookingId],
  );
  return NextResponse.json({ travelers: rows.map((r) => ({ traveler_id: Number(r.traveler_id) })) });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, bid } = await params;
  const tripId = Number(id), bookingId = Number(bid);
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const ids = Array.isArray(body.traveler_ids) ? body.traveler_ids.map(Number).filter(Number.isFinite) : [];
  await setBookingBearers(ctx, tripId, bookingId, ids);
  return NextResponse.json({ ok: true });
}