import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setRangeStatus } from '@/app/lib/services/itinerary-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, rid } = await params;
  const body = await request.json().catch(() => ({}));
  const status = body?.status === 'planning' ? 'planning' : 'confirmed';
  await setRangeStatus(ctx, Number(id), Number(rid), status);
  return NextResponse.json({ ok: true });
}