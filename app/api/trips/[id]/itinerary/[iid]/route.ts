import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { getItineraryTree, updateItinerary, deleteItinerary } from '@/app/lib/services/itinerary-service';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  const tree = await getItineraryTree(ctx, Number(id), Number(iid));
  if (!tree) return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
  return NextResponse.json({ tree });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    await updateItinerary(ctx, Number(id), Number(iid), {
      mode: body?.mode, title: body?.title ?? null, summary: body?.summary ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not update.' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; iid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, iid } = await params;
  await deleteItinerary(ctx, Number(id), Number(iid));
  return NextResponse.json({ ok: true });
}