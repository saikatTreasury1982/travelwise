// app/api/trips/[id]/flights/bookings/[bid]/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateBooking, deleteBooking } from '@/app/lib/services/flight-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, bid } = await params;
  const tripId = Number(id), bookingId = Number(bid);
  if (!Number.isInteger(tripId) || !Number.isInteger(bookingId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  const { booking, legs } = body;
  if (!Array.isArray(legs) || legs.length === 0) {
    return NextResponse.json({ error: 'At least one leg is required.' }, { status: 400 });
  }
  await updateBooking(ctx, tripId, bookingId, booking ?? {}, legs);
  return NextResponse.json({ booking_id: bookingId });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, bid } = await params;
  const tripId = Number(id), bookingId = Number(bid);
  if (!Number.isInteger(tripId) || !Number.isInteger(bookingId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }
  await deleteBooking(ctx, tripId, bookingId);
  return NextResponse.json({ ok: true });
}