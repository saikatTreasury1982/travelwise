import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createCategory, applyGrouping } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  const body = await request.json().catch(() => ({}));

  const dayId = body?.day_id != null ? Number(body.day_id) : null;
  const rangeId = body?.day_range_id != null ? Number(body.day_range_id) : null;
  if ((dayId == null) === (rangeId == null)) {
    return NextResponse.json({ error: 'Provide exactly one of day_id or day_range_id.' }, { status: 400 });
  }
  const bucket = dayId != null ? { dayId } : { rangeId: rangeId! };

  // Batch apply-grouping (AI accept): body.groups = [{category_name, description?, activity_ids[]}]
  if (Array.isArray(body?.groups)) {
    await applyGrouping(ctx, Number(id), Number(iid), bucket, body.groups.map((g: any) => ({
      category_name: String(g.category_name),
      description: g.description ?? null,
      activity_ids: Array.isArray(g.activity_ids) ? g.activity_ids.map(Number).filter(Number.isFinite) : [],
    })));
    return NextResponse.json({ ok: true });
  }

  // Single manual category.
  if (!body?.category_name?.trim()) {
    return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
  }
  const categoryId = await createCategory(ctx, Number(id), Number(iid), bucket, {
    category_name: body.category_name.trim(), description: body?.description ?? null,
  });
  return NextResponse.json({ category_id: categoryId });
}