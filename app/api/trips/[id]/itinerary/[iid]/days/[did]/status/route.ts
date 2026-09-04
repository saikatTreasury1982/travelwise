import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setDayStatus } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; did: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, did } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body?.status === 'planning' ? 'planning' : 'confirmed';
  await setDayStatus(ctx, Number(id), Number(did), status);
  return NextResponse.json({ ok: true });
}