// app/api/trips/[id]/flights/bookings/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listBookings, createBooking, setBookingBearers } from '@/app/lib/services/flight-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  const bookings = await listBookings(ctx, tripId);
  return NextResponse.json({ bookings });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const { booking, legs, bearer_traveler_ids, status, source } = body;
  if (!Array.isArray(legs) || legs.length === 0) {
    return NextResponse.json({ error: 'At least one leg is required.' }, { status: 400 });
  }
  // Decision 2a — payer assignment is mandatory when confirming.
  const wantConfirmed = (status ?? 'confirmed') === 'confirmed';
  const bearers = Array.isArray(bearer_traveler_ids) ? bearer_traveler_ids.map(Number).filter(Number.isFinite) : [];
  if (wantConfirmed && bearers.length === 0) {
    return NextResponse.json({ error: 'Assign at least one payer before saving.' }, { status: 400 });
  }
  if (wantConfirmed && (booking?.total_paid == null || !booking?.currency_code)) {
    return NextResponse.json({ error: 'A confirmed booking needs a price and currency.' }, { status: 400 });
  }

  const bookingId = await createBooking(ctx, tripId, booking ?? {}, legs, {
    status: status ?? 'confirmed',
    source: source ?? 'pdf',
  });
  // Assign bearers → this triggers syncExpenseForBooking → expense emits.
  if (bearers.length > 0) await setBookingBearers(ctx, tripId, bookingId, bearers);

  return NextResponse.json({ booking_id: bookingId });
}