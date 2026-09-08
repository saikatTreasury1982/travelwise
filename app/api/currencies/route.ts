// app/api/currencies/route.ts
// Public list of currencies for the registration form (currency override).
import { NextResponse } from 'next/server';
import { listCurrencies } from '@/app/lib/services/reference-service';
export async function GET() {
  try {
    return NextResponse.json({ currencies: await listCurrencies() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error', currencies: [] }, { status: 500 });
  }
}