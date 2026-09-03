// app/api/trips/[id]/lodging/shortlist/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createStay } from '@/app/lib/services/lodging-service';
import { scopedQuery } from '@/app/lib/db/scoped';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let opt: any;
  try { opt = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  // Resolve destination_id from the AI-supplied city (or fall back to matching the area text)
  // against THIS trip's real destinations. Never trust an id from the model.
  let destinationId: number | null = opt.destination_id ?? null;
  if (destinationId == null) {
    const dests = await scopedQuery(
      ctx,
      `SELECT destination_id, city FROM trip_destinations WHERE {{tenant}} AND trip_id = ?`,
      [tripId],
    );
    const hay = `${opt.city ?? ''} ${opt.area ?? ''}`.toLowerCase();
    // Prefer an exact city match; else the first destination whose city appears in the text.
    const exact = dests.find((d) => String(d.city ?? '').toLowerCase() === String(opt.city ?? '').toLowerCase() && opt.city);
    const contains = dests.find((d) => d.city && hay.includes(String(d.city).toLowerCase()));
    const hit = exact ?? contains;
    if (hit) destinationId = Number(hit.destination_id);
  }

  const stayId = await createStay(
    ctx, tripId,
    {
      destination_id: destinationId,
      name: opt.name ?? 'Suggested stay',
      accommodation_type: opt.accommodation_type ?? null,
      area: opt.area ?? null,
      check_in: opt.check_in ?? null,
      check_out: opt.check_out ?? null,
      price_mode: 'nightly',
      nightly_rate: typeof opt.estimated_nightly === 'number' ? opt.estimated_nightly : null,
      currency_code: opt.currency_code ?? null,
      notes: opt.label ? (opt.note ? `${opt.label} — ${opt.note}` : opt.label) : (opt.note ?? null),
    },
    { status: 'shortlisted', source: 'ai' },
  );

  return NextResponse.json({ stay_id: stayId });
}