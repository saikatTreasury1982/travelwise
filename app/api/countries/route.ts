// app/api/countries/route.ts
// Public list of active countries for the registration form.
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';

export async function GET() {
  try {
    const countries = await rawQuery<{ country_code: string; country_name: string; currency_code: string }>(
      `SELECT country_code, country_name, currency_code
         FROM countries WHERE is_active = 1
        ORDER BY country_name`,
    );
    return NextResponse.json({ countries });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error', countries: [] }, { status: 500 });
  }
}