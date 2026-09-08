// app/api/feature-interest/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { rawExecute, rawQuery  } from '@/app/lib/db/client';

export async function GET(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const feature = new URL(request.url).searchParams.get('feature') ?? '';
  if (!feature) return NextResponse.json({ interested: false });
  const rows = await rawQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM feature_interest WHERE tenant_id = ? AND user_id = ? AND feature = ?`,
    [ctx.tenantId, ctx.userId, feature],
  );
  return NextResponse.json({ interested: Number(rows[0]?.n ?? 0) > 0 });
}

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

  try {
    await rawExecute(
      `INSERT INTO feature_interest (tenant_id, user_id, feature, trip_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (tenant_id, user_id, feature) DO NOTHING`,
      [ctx.tenantId, ctx.userId, feature, tripId],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[feature-interest] write failed:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'write failed' }, { status: 500 });
  }
}