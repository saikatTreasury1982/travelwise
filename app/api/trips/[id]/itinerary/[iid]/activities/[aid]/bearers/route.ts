import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setActivityBearers } from '@/app/lib/services/itinerary-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.traveler_ids) ? body.traveler_ids.map(Number).filter(Number.isFinite) : [];
  await setActivityBearers(ctx, Number(id), Number(aid), ids);
  return NextResponse.json({ ok: true });
}