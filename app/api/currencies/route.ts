// app/api/currencies/route.ts
// Public list of currencies for the registration form (currency override).
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';

export async function GET() {
  try {
    const currencies = await rawQuery<{ currency_code: string; currency_name: string; currency_symbol: string }>(
      `SELECT currency_code, currency_name, currency_symbol
         FROM currencies ORDER BY currency_code`,
    );
    return NextResponse.json({ currencies });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error', currencies: [] }, { status: 500 });
  }
}