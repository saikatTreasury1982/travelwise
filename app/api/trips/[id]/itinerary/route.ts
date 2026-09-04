import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listItineraries, createItinerary, seedDays } from '@/app/lib/services/itinerary-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const itineraries = await listItineraries(ctx, Number(id));
  return NextResponse.json({ itineraries });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  const body = await request.json().catch(() => ({}));
  const mode = body?.mode === 'range' ? 'range' : 'day';

  const itineraryId = await createItinerary(ctx, tripId, {
    mode, title: body?.title ?? null, summary: body?.summary ?? null,
    source: body?.source === 'ai' ? 'ai' : 'manual',
  });
  // Day-mode: seed one bucket per trip day so the user has a spine to fill.
  if (mode === 'day') await seedDays(ctx, tripId, itineraryId);

  return NextResponse.json({ itinerary_id: itineraryId });
}