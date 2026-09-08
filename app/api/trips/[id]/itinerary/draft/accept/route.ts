// app/api/trips/[id]/itinerary/draft/accept/route.ts
// POST = write the current draft as a NEW unfinalized itinerary, clear the session.
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { acceptSession } from '@/app/lib/services/itinerary-draft-service';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let title = ''; let summary: string | null = null;
  try {
    const body = await request.json();
    title = typeof body?.title === 'string' ? body.title : '';
    summary = typeof body?.summary === 'string' ? body.summary : null;
  } catch { /* handled by the required-title check below */ }

  if (!title.trim()) return NextResponse.json({ error: 'A plan name is required.' }, { status: 400 });

  try {
    const result = await acceptSession(ctx, tripId, { title, summary });
    if ('error' in result) return NextResponse.json(result, { status: 200 });
    return NextResponse.json({ ok: true, itinerary_id: result.itinerary_id });
  } catch (err) {
    console.error('[itinerary-draft:accept] error:', err);
    return NextResponse.json({ error: 'Could not save the plan. Please try again.' }, { status: 200 });
  }
}