import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { assistCountsForItinerary } from '@/app/lib/services/assist-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { iid } = await params;
  const counts = await assistCountsForItinerary(ctx, Number(iid));
  return NextResponse.json({ counts });
}