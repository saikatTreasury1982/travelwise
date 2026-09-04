import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setActivityCompleted } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  await setActivityCompleted(ctx, Number(id), Number(aid), body?.completed === true);
  return NextResponse.json({ ok: true });
}