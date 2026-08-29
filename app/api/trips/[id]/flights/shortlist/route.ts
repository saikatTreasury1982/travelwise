// app/api/trips/[id]/flights/shortlist/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createBooking } from '@/app/lib/services/flight-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let opt: any;
  try { opt = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  const legs = Array.isArray(opt.legs) ? opt.legs : [];
  if (legs.length === 0) return NextResponse.json({ error: 'Option has no legs.' }, { status: 400 });

  // A shortlisted option: no PNR/refs, estimated price, status 'shortlisted', source 'ai'.
  const bookingId = await createBooking(
    ctx, tripId,
    {
      booking_source: opt.airline ?? 'AI suggestion',
      total_paid: typeof opt.estimated_price === 'number' ? opt.estimated_price : null,
      currency_code: opt.currency_code ?? null,
      notes: opt.label ?? null,
    },
    legs.map((l: any, i: number) => ({
      leg_order: i + 1,
      departure_airport_code: l.departure_airport_code ?? null,
      arrival_airport_code: l.arrival_airport_code ?? null,
      departure_datetime: l.departure_datetime ?? null,
      arrival_datetime: l.arrival_datetime ?? null,
      airline: l.airline ?? opt.airline ?? null,
      flight_number: l.flight_number ?? null,
      cabin_class: l.cabin_class ?? null,
      stops_count: l.stops_count ?? 0,
      duration_minutes: l.duration_minutes ?? null,
    })),
    { status: 'shortlisted', source: 'ai' },
  );

  return NextResponse.json({ booking_id: bookingId });
}