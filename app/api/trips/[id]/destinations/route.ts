import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { getTripDetail, addDestination } from '@/app/lib/services/trip-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await requireUserContext();
    const { id } = await params;
    const tripId = Number(id);
    if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

    const country = typeof body.country === 'string' ? body.country.trim() : '';
    if (!country) return NextResponse.json({ error: 'Country is required.' }, { status: 400 });

    await addDestination(ctx, tripId, {
        country,
        city: typeof body.city === 'string' && body.city.trim() ? body.city.trim() : null,
        countryCode: typeof body.countryCode === 'string' ? body.countryCode : null,
        latitude: typeof body.latitude === 'number' ? body.latitude : null,
        longitude: typeof body.longitude === 'number' ? body.longitude : null,
    });

    await writeAudit({
        event: 'trip.update', result: 'success',
        tenantId: ctx.tenantId, userId: ctx.userId,
        detail: { tripId, action: 'destination.add', country },
    });

    const trip = await getTripDetail(ctx, tripId);
    return NextResponse.json({ ok: true, destinations: trip?.destinations ?? [] });
}