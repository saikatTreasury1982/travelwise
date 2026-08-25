import { NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { rawQuery, rawExecute } from '@/app/lib/db/client';
import { geocode } from '@/app/lib/services/geocode';

export const dynamic = 'force-dynamic';

// One-time (idempotent) backfill of latitude/longitude for destinations that
// have none (e.g. AI-created ones). Only touches the caller's own tenant.
export async function POST() {
    const ctx = await requireUserContext();
    if (ctx.role !== 'owner') {
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const rows = await rawQuery<{ destination_id: number; city: string | null; country: string }>(
        `SELECT destination_id, city, country FROM trip_destinations
     WHERE tenant_id = ? AND (latitude IS NULL OR longitude IS NULL OR country_code IS NULL)`,
        [ctx.tenantId],
    );

    let updated = 0;
    const misses: number[] = [];
    for (const r of rows) {
        const g = await geocode(r.city, r.country);
        if (g.latitude != null && g.longitude != null) {
            await rawExecute(
                `UPDATE trip_destinations
                SET latitude = ?, longitude = ?, country_code = ?
                WHERE destination_id = ? AND tenant_id = ?`,
                [g.latitude, g.longitude, g.countryCode, r.destination_id, ctx.tenantId],
            );
            updated++;
        } else {
            misses.push(r.destination_id);
        }
        await new Promise((res) => setTimeout(res, 250));
    }

    return NextResponse.json({ ok: true, scanned: rows.length, updated, misses });
}
