import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { finalizeItinerary } from '@/app/lib/services/itinerary-service';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  await finalizeItinerary(ctx, Number(id), Number(iid));
  return NextResponse.json({ ok: true });
}