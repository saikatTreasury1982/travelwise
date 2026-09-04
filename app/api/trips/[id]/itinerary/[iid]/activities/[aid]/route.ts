import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateActivity, deleteActivity } from '@/app/lib/services/itinerary-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body?.activity_name?.trim()) {
    return NextResponse.json({ error: 'Activity name is required.' }, { status: 400 });
  }
  await updateActivity(ctx, Number(id), Number(aid), {
    activity_name: body.activity_name.trim(),
    start_time: body?.start_time ?? null,
    end_time: body?.end_time ?? null,
    duration_minutes: body?.duration_minutes != null ? Number(body.duration_minutes) : null,
    activity_cost: body?.activity_cost != null ? Number(body.activity_cost) : null,
    currency_code: body?.currency_code ?? null,
    cost_type: body?.cost_type === 'per_person' ? 'per_person' : 'total',
    headcount: body?.headcount != null ? Number(body.headcount) : null,
    is_active: body?.is_active !== false,
    notes: body?.notes ?? null,
    category_id: body?.category_id != null ? Number(body.category_id) : null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  await deleteActivity(ctx, Number(id), Number(aid));
  return NextResponse.json({ ok: true });
}