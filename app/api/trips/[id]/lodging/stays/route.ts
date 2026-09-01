import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listStays } from '@/app/lib/services/lodging-service';
export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ stays: await listStays(ctx, Number(id)) });
}