// app/api/countries/route.ts
// Public list of active countries for the registration form.
import { NextResponse } from 'next/server';
import { listCountries } from '@/app/lib/services/reference-service';
export async function GET() {
  try {
    return NextResponse.json({ countries: await listCountries() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'error', countries: [] }, { status: 500 });
  }
}