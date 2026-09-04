import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateDay } from '@/app/lib/services/itinerary-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; iid: string; did: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, did } = await params;
  const body = await request.json().catch(() => ({}));
  await updateDay(ctx, Number(id), Number(did), { title: body?.title ?? null });
  return NextResponse.json({ ok: true });
}