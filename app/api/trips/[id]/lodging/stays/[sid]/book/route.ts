import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { markStayBooked } from '@/app/lib/services/lodging-service';
export async function POST(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, sid } = await params;
  const body = await request.json().catch(() => ({}));
  if (body?.total_paid == null || !body?.currency_code) return NextResponse.json({ error: 'Price and currency required.' }, { status: 400 });
  await markStayBooked(ctx, Number(id), Number(sid), {
    total_paid: Number(body.total_paid), currency_code: body.currency_code,
    confirmation_reference: body.confirmation_reference ?? null,
  });
  return NextResponse.json({ ok: true });
}