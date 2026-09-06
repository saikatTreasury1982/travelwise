// app/api/trips/[id]/destinations/[destId]/weather/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { scopedQuery, scopedExecute } from '@/app/lib/db/scoped';
import { getDestinationWeather, weatherKey } from '@/app/lib/services/weather';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; destId: string }> }) {
  const ctx = await requireUserContext();
  const { id, destId } = await params;
  const tripId = Number(id);
  const destinationId = Number(destId);
  if (!Number.isFinite(tripId) || !Number.isFinite(destinationId)) {
    return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  }

  // Read the trip window + the destination (tenant-scoped).
  const tripRows = await scopedQuery(
    ctx,
    `SELECT start_date, end_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`,
    [tripId],
  );
  const trip = tripRows[0];
  if (!trip) return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });

  const destRows = await scopedQuery(
    ctx,
    `SELECT destination_id, city, country, latitude, longitude, weather_json, weather_key
       FROM trip_destinations
      WHERE {{tenant}} AND trip_id = ? AND destination_id = ? LIMIT 1`,
    [tripId, destinationId],
  );
  const dest = destRows[0];
  if (!dest) return NextResponse.json({ error: 'Destination not found.' }, { status: 404 });

  const startDate = String(trip.start_date);
  const endDate = String(trip.end_date);
  const key = weatherKey(startDate, endDate);

  // Cache hit: stored and the trip window hasn't changed.
  if (dest.weather_json && dest.weather_key === key) {
    try {
      return NextResponse.json({ ok: true, cached: true, weather: JSON.parse(String(dest.weather_json)) });
    } catch { /* fall through to recompute if the stored blob is corrupt */ }
  }

  // Compute (coords-first, geocode fallback inside the service).
  const weather = await getDestinationWeather(
    {
      latitude: dest.latitude == null ? null : Number(dest.latitude),
      longitude: dest.longitude == null ? null : Number(dest.longitude),
      city: dest.city == null ? null : String(dest.city),
      country: String(dest.country),
    },
    startDate,
    endDate,
  );

  if (!weather) {
    // Don't cache failures — let the next click retry.
    return NextResponse.json({ ok: false, weather: null, error: 'Weather unavailable for this destination right now.' }, { status: 200 });
  }

  // Cache onto the destination row.
  await scopedExecute(
    ctx,
    `UPDATE trip_destinations SET weather_json = ?, weather_key = ?
      WHERE {{tenant}} AND trip_id = ? AND destination_id = ?`,
    [JSON.stringify(weather), key, tripId, destinationId],
  );

  return NextResponse.json({ ok: true, cached: false, weather });
}