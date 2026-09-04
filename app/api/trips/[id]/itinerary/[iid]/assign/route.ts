import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { assignActivitiesToCategory } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.activity_ids) ? body.activity_ids.map(Number).filter(Number.isFinite) : [];
  const categoryId = body?.category_id != null ? Number(body.category_id) : null;  // null = ungroup
  await assignActivitiesToCategory(ctx, Number(id), ids, categoryId);
  return NextResponse.json({ ok: true });
}