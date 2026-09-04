import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateRange, deleteRange } from '@/app/lib/services/itinerary-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, rid } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    await updateRange(ctx, Number(id), Number(rid), {
      start_day: body?.start_day != null ? Number(body.start_day) : undefined,
      end_day: body?.end_day != null ? Number(body.end_day) : undefined,
      range_name: body?.range_name ?? null, description: body?.description ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not update range.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, rid } = await params;
  await deleteRange(ctx, Number(id), Number(rid));
  return NextResponse.json({ ok: true });
}