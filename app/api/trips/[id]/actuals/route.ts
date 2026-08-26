import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { listActuals, recordActual, getVariance } from '@/app/lib/services/expense-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });
  const [actuals, variance] = await Promise.all([listActuals(ctx, tripId), getVariance(ctx, tripId)]);
  return NextResponse.json({ ...actuals, variance });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const expenseId = Number(body.expenseId);
  const travelerId = Number(body.travelerId);
  const amount = Number(body.amount);
  const currency = typeof body.currency === 'string' ? body.currency : '';
  if (!Number.isFinite(expenseId) || !Number.isFinite(travelerId)) return NextResponse.json({ error: 'Bad ids.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: 'A valid amount is required.' }, { status: 400 });
  if (!currency) return NextResponse.json({ error: 'Currency is required.' }, { status: 400 });

  await recordActual(ctx, tripId, {
    expenseId, travelerId, amount, currency,
    date: typeof body.date === 'string' && body.date ? body.date : null,
    paidByTravelerId: body.paidByTravelerId != null ? Number(body.paidByTravelerId) : travelerId,
    notes: typeof body.notes === 'string' ? body.notes : null,
  });

  await writeAudit({ event: 'trip.update', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { tripId, action: 'actual.record', expenseId, travelerId } });
  const [actuals, variance] = await Promise.all([listActuals(ctx, tripId), getVariance(ctx, tripId)]);
  return NextResponse.json({ ok: true, ...actuals, variance });
}