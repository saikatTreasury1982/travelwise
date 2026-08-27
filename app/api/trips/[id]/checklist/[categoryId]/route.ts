import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { removeCategory, listChecklist } from '@/app/lib/services/checklist-service';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; categoryId: string }> }) {
  const ctx = await requireUserContext();
  const { id, categoryId } = await params;
  const tripId = Number(id); const cId = Number(categoryId);
  if (!Number.isFinite(tripId) || !Number.isFinite(cId)) return NextResponse.json({ error: 'Bad id.' }, { status: 400 });
  await removeCategory(ctx, tripId, cId);
  return NextResponse.json({ ok: true, checklist: await listChecklist(ctx, tripId) });
}