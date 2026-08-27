import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { listChecklist, addCategory, addItem } from '@/app/lib/services/checklist-service';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });
  return NextResponse.json({ checklist: await listChecklist(ctx, tripId) });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireUserContext();
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) return NextResponse.json({ error: 'Bad trip id.' }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }

  if (typeof body.categoryName === 'string' && body.categoryName.trim()) {
    await addCategory(ctx, tripId, body.categoryName.trim(), body.kind === 'task' ? 'task' : 'packing');
  } else if (body.categoryId != null && typeof body.itemName === 'string' && body.itemName.trim()) {
    await addItem(ctx, tripId, Number(body.categoryId), body.itemName.trim(), typeof body.priority === 'string' ? body.priority : null);
  } else {
    return NextResponse.json({ error: 'Provide a category name or (categoryId + item name).' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, checklist: await listChecklist(ctx, tripId) });
}