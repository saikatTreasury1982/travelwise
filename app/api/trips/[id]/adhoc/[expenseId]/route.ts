import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { updateExpense, deleteExpense, listAdhocExpenses } from '@/app/lib/services/expense-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const ctx = await requireUserContext();
  const { id, expenseId } = await params;
  const tripId = Number(id); const eId = Number(expenseId);
  if (!Number.isFinite(tripId) || !Number.isFinite(eId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const amount = Number(body.estimatedAmount);
  const currency = typeof body.currency === 'string' ? body.currency : '';
  const bearers = Array.isArray(body.bearerTravelerIds) ? body.bearerTravelerIds.map(Number).filter(Number.isFinite) : [];
  const baseAmountOverride = body.baseAmountOverride != null && Number.isFinite(Number(body.baseAmountOverride))
    ? Number(body.baseAmountOverride) : null;
  if (!description) return NextResponse.json({ error: 'Expense name is required.' }, { status: 400 });
  if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'A valid amount is required.' }, { status: 400 });
  if (!currency) return NextResponse.json({ error: 'Currency is required.' }, { status: 400 });
  if (bearers.length === 0) return NextResponse.json({ error: 'Assign at least one traveller.' }, { status: 400 });

  await updateExpense(ctx, tripId, eId, {
    description, estimatedAmount: amount, currency,
    categoryLabel: typeof body.categoryLabel === 'string' ? body.categoryLabel : null,
    bearerTravelerIds: bearers,
    expenseDate: typeof body.expenseDate === 'string' && body.expenseDate ? body.expenseDate : null,
    isActive: body.isActive !== false,
    notes: typeof body.notes === 'string' ? body.notes : null,
    baseAmountOverride,
  });

  await writeAudit({ event: 'trip.update', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { tripId, action: 'adhoc.update', expenseId: eId } });
  const expenses = await listAdhocExpenses(ctx, tripId);
  return NextResponse.json({ ok: true, expenses });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; expenseId: string }> }) {
  const ctx = await requireUserContext();
  const { id, expenseId } = await params;
  const tripId = Number(id); const eId = Number(expenseId);
  if (!Number.isFinite(tripId) || !Number.isFinite(eId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });

  await deleteExpense(ctx, tripId, eId);
  await writeAudit({ event: 'trip.update', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { tripId, action: 'adhoc.remove', expenseId: eId } });
  const expenses = await listAdhocExpenses(ctx, tripId);
  return NextResponse.json({ ok: true, expenses });
}