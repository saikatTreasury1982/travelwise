import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createRange } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const rangeId = await createRange(ctx, Number(id), Number(iid), {
      start_day: Number(body?.start_day), end_day: Number(body?.end_day),
      range_name: body?.range_name ?? null, description: body?.description ?? null,
    });
    return NextResponse.json({ day_range_id: rangeId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not create range.' }, { status: 400 });
  }
}