import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ role: null });
  return NextResponse.json({ role: ctx.role });
}