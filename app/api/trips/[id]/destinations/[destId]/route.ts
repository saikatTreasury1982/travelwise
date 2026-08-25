import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { getTripDetail, removeDestination } from '@/app/lib/services/trip-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; destId: string }> },
) {
  const ctx = await requireUserContext();
  const { id, destId } = await params;
  const tripId = Number(id); const dId = Number(destId);
  if (!Number.isFinite(tripId) || !Number.isFinite(dId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });

  await removeDestination(ctx, tripId, dId);

  await writeAudit({
    event: 'trip.update', result: 'success',
    tenantId: ctx.tenantId, userId: ctx.userId,
    detail: { tripId, action: 'destination.remove', destinationId: dId },
  });

  const trip = await getTripDetail(ctx, tripId);
  return NextResponse.json({ ok: true, destinations: trip?.destinations ?? [] });
}