import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { reorderActivities, reorderCategories } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ordered_ids) ? body.ordered_ids.map(Number).filter(Number.isFinite) : [];
  if (body?.kind === 'category') await reorderCategories(ctx, Number(id), ids);
  else await reorderActivities(ctx, Number(id), ids);
  return NextResponse.json({ ok: true });
}