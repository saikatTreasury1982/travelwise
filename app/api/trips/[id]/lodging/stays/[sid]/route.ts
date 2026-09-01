import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateStay, deleteStay } from '@/app/lib/services/lodging-service';
export async function PUT(request: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, sid } = await params;
  const body = await request.json().catch(() => ({}));
  await updateStay(ctx, Number(id), Number(sid), body);
  return NextResponse.json({ ok: true });
}
export async function DELETE(_r: Request, { params }: { params: Promise<{ id: string; sid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, sid } = await params;
  await deleteStay(ctx, Number(id), Number(sid));
  return NextResponse.json({ ok: true });
}