// app/api/health/route.ts
// -----------------------------------------------------------------------------
// Sanity endpoint to prove the app is wired to Turso. GET /api/health.
// Delete once real routes exist, or keep as a liveness check.
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';

export async function GET() {
  try {
    const currencies = await rawQuery<{ n: number }>('SELECT COUNT(*) AS n FROM currencies');
    const countries = await rawQuery<{ n: number }>('SELECT COUNT(*) AS n FROM countries');
    return NextResponse.json({
      ok: true,
      db: 'connected',
      currencies: currencies[0]?.n ?? 0,
      countries: countries[0]?.n ?? 0,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'db error' },
      { status: 500 },
    );
  }
}