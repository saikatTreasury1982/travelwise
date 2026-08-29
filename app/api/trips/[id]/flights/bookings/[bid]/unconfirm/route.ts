// app/api/trips/[id]/flights/bookings/[bid]/unconfirm/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { unconfirmBooking } from '@/app/lib/services/flight-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; bid: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, bid } = await params;
  const ok = await unconfirmBooking(ctx, Number(id), Number(bid));
  if (!ok) return NextResponse.json({ error: 'This booking cannot be moved back to shortlisted.' }, { status: 400 });
  return NextResponse.json({ ok: true });
}