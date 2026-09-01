// app/api/trips/[id]/lodging/shortlist/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { createStay } from '@/app/lib/services/lodging-service';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isInteger(tripId)) return NextResponse.json({ error: 'Invalid trip id' }, { status: 400 });

  let opt: any;
  try { opt = await request.json(); } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  // A shortlisted AI stay: nightly estimate, no dates yet (user sets on confirm), status 'shortlisted'.
  const stayId = await createStay(
    ctx, tripId,
    {
      destination_id: opt.destination_id ?? null,
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