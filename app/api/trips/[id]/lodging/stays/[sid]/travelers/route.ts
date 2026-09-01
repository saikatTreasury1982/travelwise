import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { setStayBearers } from '@/app/lib/services/lodging-service';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, sid } = await params;
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body.traveler_ids) ? body.traveler_ids.map(Number) : [];
  await setStayBearers(ctx, Number(id), Number(sid), ids);
  return NextResponse.json({ ok: true });
}