// app/api/trips/[id]/itinerary/activities/[aid]/assist/list/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listAssists, deleteAssist } from '@/app/lib/services/assist-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const assists = await listAssists(ctx, Number(id), Number(aid));
  return NextResponse.json({ assists });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  const assistId = Number(body?.assist_id);
  if (!Number.isInteger(assistId)) return NextResponse.json({ error: 'Bad assist id.' }, { status: 400 });
  await deleteAssist(ctx, Number(id), Number(aid), assistId);
  return NextResponse.json({ ok: true });
}