// app/api/feature-interest/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { scopedExecute } from '@/app/lib/db/scoped';

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  let feature = ''; let tripId: number | null = null;
  try {
    const body = await request.json();
    feature = typeof body?.feature === 'string' ? body.feature : '';
    tripId = Number.isFinite(body?.tripId) ? Number(body.tripId) : null;
  } catch { /* defaults */ }
  if (!feature) return NextResponse.json({ error: 'Missing feature' }, { status: 400 });

  // Upsert: one interest row per (tenant, user, feature). Repeat clicks are no-ops.
  await scopedExecute(
    ctx,
    `INSERT INTO feature_interest (tenant_id, user_id, feature, trip_id)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (tenant_id, user_id, feature) DO NOTHING`,
    [ctx.tenantId, ctx.userId, feature, tripId],
  );
  return NextResponse.json({ ok: true });
}