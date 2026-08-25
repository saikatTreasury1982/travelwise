import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { listTravelers, addCoTravelers } from '@/app/lib/services/traveler-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });
  const travelers = await listTravelers(ctx, tripId);
  return NextResponse.json({ travelers });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const name = typeof body.traveler_name === 'string' ? body.traveler_name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Traveller name is required.' }, { status: 400 });

  const relationship = body.relationship == null ? null : Number(body.relationship);
  if (relationship === 1) return NextResponse.json({ error: 'Cannot add another primary (Self).' }, { status: 400 });

  await addCoTravelers(ctx, tripId, [{
    traveler_name: name,
    relationship: relationship ?? 5,
    is_cost_sharer: body.is_cost_sharer !== false,
    is_active: body.is_active !== false,
    traveler_email: typeof body.traveler_email === 'string' ? body.traveler_email : null,
  }]);

  await writeAudit({
    event: 'trip.traveler.add',
    result: 'success',
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    detail: { tripId, name },
  });
  const travelers = await listTravelers(ctx, tripId);
  return NextResponse.json({ ok: true, travelers });
}