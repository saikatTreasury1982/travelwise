import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { updateItem, removeItem } from '@/app/lib/services/checklist-service';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await requireUserContext();
  const { id, itemId } = await params;
  const tripId = Number(id); const iId = Number(itemId);
  if (!Number.isFinite(tripId) || !Number.isFinite(iId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  await updateItem(ctx, tripId, iId, {
    name: typeof body.name === 'string' ? body.name : undefined,
    isDone: typeof body.isDone === 'boolean' ? body.isDone : undefined,
    priority: 'priority' in body ? (typeof body.priority === 'string' ? body.priority : null) : undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const ctx = await requireUserContext();
  const { id, itemId } = await params;
  const tripId = Number(id); const iId = Number(itemId);
  if (!Number.isFinite(tripId) || !Number.isFinite(iId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  await removeItem(ctx, tripId, iId);
  return NextResponse.json({ ok: true });
}