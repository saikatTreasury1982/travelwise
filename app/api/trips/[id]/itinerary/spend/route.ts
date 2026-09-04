import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { getItinerarySpendByDay } from '@/app/lib/services/itinerary-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const data = await getItinerarySpendByDay(ctx, Number(id));
  return NextResponse.json(data);
}