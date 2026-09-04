import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createActivity } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  const body = await request.json().catch(() => ({}));

  // Parent bucket: exactly one of day_id / day_range_id.
  const dayId = body?.day_id != null ? Number(body.day_id) : null;
  const rangeId = body?.day_range_id != null ? Number(body.day_range_id) : null;
  if ((dayId == null) === (rangeId == null)) {
    return NextResponse.json({ error: 'Provide exactly one of day_id or day_range_id.' }, { status: 400 });
  }
  if (!body?.activity_name?.trim()) {
    return NextResponse.json({ error: 'Activity name is required.' }, { status: 400 });
  }

  const bucket = dayId != null ? { dayId } : { rangeId: rangeId! };
  const bearers = Array.isArray(body?.bearer_traveler_ids)
    ? body.bearer_traveler_ids.map(Number).filter(Number.isFinite)
    : undefined;   // undefined → service defaults to all cost-sharers

  const activityId = await createActivity(ctx, Number(id), Number(iid), bucket, {
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
  }, bearers);

  return NextResponse.json({ activity_id: activityId });
}