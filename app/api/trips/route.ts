// app/api/trips/route.ts
// Returns the signed-in user's trips (with destinations) for the cards view.
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listTripsWithDetails } from '@/app/lib/services/trip-service';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  try {
    const trips = await listTripsWithDetails(ctx);
    return NextResponse.json({ trips });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error', trips: [] }, { status: 500 });
  }
}