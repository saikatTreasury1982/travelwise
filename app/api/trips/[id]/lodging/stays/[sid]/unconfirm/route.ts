import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { unconfirmStay } from '@/app/lib/services/lodging-service';
export async function POST(_r: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, sid } = await params;
  const ok = await unconfirmStay(ctx, Number(id), Number(sid));
  return NextResponse.json({ ok });
}