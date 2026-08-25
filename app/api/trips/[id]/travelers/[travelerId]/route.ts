import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { updateTraveler, removeTraveler, type TravelerUpdate } from '@/app/lib/services/traveler-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> },
) {
  const ctx = await requireUserContext();
  const { id, travelerId } = await params;
  const tripId = Number(id); const tId = Number(travelerId);
  if (!Number.isFinite(tripId) || !Number.isFinite(tId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const patch: TravelerUpdate = {};
  if (typeof body.traveler_name === 'string') patch.traveler_name = body.traveler_name.trim();
  if (body.relationship !== undefined) {
    const r = body.relationship == null ? null : Number(body.relationship);
    if (r === 1) return NextResponse.json({ error: 'Cannot set a co-traveller to Self.' }, { status: 400 });
    patch.relationship = r;
  }
  if (typeof body.is_cost_sharer === 'boolean') patch.is_cost_sharer = body.is_cost_sharer;
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if ('traveler_email' in body) patch.traveler_email = typeof body.traveler_email === 'string' ? body.traveler_email : null;
  if ('traveler_currency' in body) patch.traveler_currency = typeof body.traveler_currency === 'string' ? body.traveler_currency : null;

  await updateTraveler(ctx, tripId, tId, patch);
  await writeAudit({
    event: 'trip.traveler.update',
    result: 'success',
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    detail: { tripId, travelerId: tId, fields: Object.keys(patch) },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; travelerId: string }> },
) {
  const ctx = await requireUserContext();
  const { id, travelerId } = await params;
  const tripId = Number(id); const tId = Number(travelerId);
  if (!Number.isFinite(tripId) || !Number.isFinite(tId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });

  await removeTraveler(ctx, tripId, tId);
  await writeAudit({
    event: 'trip.traveler.remove',
    result: 'success',
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    detail: { tripId, travelerId: tId },
  });
  return NextResponse.json({ ok: true });
}