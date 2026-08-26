import { NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { rawQuery, rawExecute } from '@/app/lib/db/client';
import { findCover } from '@/app/lib/services/unsplash';

export const dynamic = 'force-dynamic';

// Owner-only. Fills cover images for trips that don't have one yet.
export async function POST() {
  const ctx = await requireUserContext();
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  // Trips with no cover, plus their first destination for the search query.
  const trips = await rawQuery<{ trip_id: number; trip_name: string; city: string | null; country: string | null }>(
    `SELECT t.trip_id, t.trip_name,
            (SELECT city FROM trip_destinations d WHERE d.trip_id = t.trip_id ORDER BY d.display_order LIMIT 1) AS city,
            (SELECT country FROM trip_destinations d WHERE d.trip_id = t.trip_id ORDER BY d.display_order LIMIT 1) AS country
       FROM trips t
      WHERE t.tenant_id = ? AND (t.cover_image_url IS NULL OR t.cover_image_url = '')`,
    [ctx.tenantId],
  );

  let updated = 0;
  const misses: number[] = [];
  for (const t of trips) {
    const query = t.city || t.country || t.trip_name;
    const cover = await findCover(query);
    if (cover?.url) {
      await rawExecute(
        `UPDATE trips SET cover_image_url = ?, cover_image_credit = ?, cover_image_link = ?
         WHERE trip_id = ? AND tenant_id = ?`,
        [cover.url, cover.credit, cover.link, t.trip_id, ctx.tenantId],
      );
      updated++;
    } else {
      misses.push(t.trip_id);
    }
    // pace requests — Unsplash demo tier is 50/hour
    await new Promise((res) => setTimeout(res, 400));
  }

  return NextResponse.json({ ok: true, scanned: trips.length, updated, misses });
}