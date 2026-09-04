import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateCategory, deleteCategory } from '@/app/lib/services/itinerary-service';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, cid } = await params;
  const body = await request.json().catch(() => ({}));
  await updateCategory(ctx, Number(id), Number(cid), {
    category_name: body?.category_name, description: body?.description ?? null,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, cid } = await params;
  await deleteCategory(ctx, Number(id), Number(cid));
  return NextResponse.json({ ok: true });
}