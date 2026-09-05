// app/api/trips/[id]/itinerary/activities/[aid]/assist/save/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { saveAssist, type AssistType } from '@/app/lib/services/assist-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string; aid: string }> }) {
  const ctx = await getUserContext(); if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id, aid } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body?.title?.trim() || !body?.summary?.trim() || !body?.assist_type) {
    return NextResponse.json({ error: 'Missing fields.' }, { status: 400 });
  }
  try {
    const assistId = await saveAssist(ctx, Number(id), Number(aid), {
      assist_type: body.assist_type as AssistType,
      title: body.title.trim(),
      summary: body.summary.trim(),
    });
    return NextResponse.json({ assist_id: assistId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not save.' }, { status: 400 });
  }
}