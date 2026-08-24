// app/api/trips/[id]/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateTrip, getTripDetail, type TripUpdateInput } from '@/app/lib/services/trip-service';
import { writeAudit } from '@/app/lib/audit';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const trip = await getTripDetail(ctx, Number(id));
  if (!trip) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ trip });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: TripUpdateInput;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  try {
    const ok = await updateTrip(ctx, Number(id), body);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await writeAudit({ event: 'role.change', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { action: 'trip.update', tripId: Number(id), fields: Object.keys(body) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 400 });
  }
}