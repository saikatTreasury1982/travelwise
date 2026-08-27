// app/api/trips/[id]/status/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setTripSuspended } from '@/app/lib/services/trip-service';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) {
    return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });
  }

  let suspend: boolean;
  try {
    const body = await request.json();
    suspend = Boolean(body.suspend);
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const status = await setTripSuspended(ctx, tripId, suspend);
  if (status == null) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, status_code: status });
}