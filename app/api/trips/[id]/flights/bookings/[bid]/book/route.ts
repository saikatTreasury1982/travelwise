// app/api/trips/[id]/flights/bookings/[bid]/book/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { markBookingBooked } from '@/app/lib/services/flight-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, bid } = await params;
  const tripId = Number(id), bookingId = Number(bid);
  if (!Number.isInteger(tripId) || !Number.isInteger(bookingId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (body?.total_paid == null || !body?.currency_code) {
    return NextResponse.json({ error: 'A booked flight needs a real price and currency.' }, { status: 400 });
  }

  await markBookingBooked(ctx, tripId, bookingId, {
    total_paid: Number(body.total_paid),
    currency_code: body.currency_code,
    airline_pnr: body.airline_pnr ?? null,
    agency_reference: body.agency_reference ?? null,
    booking_source: body.booking_source ?? null,
    booking_date: body.booking_date ?? null,
  }, Array.isArray(body.legs) ? body.legs : undefined);

  return NextResponse.json({ ok: true });
}