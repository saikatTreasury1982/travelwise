// app/api/fx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { convert } from '@/app/lib/services/fx';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  if (!from || !to) return NextResponse.json({ rate: null }, { status: 400 });

  const { rate } = await convert(1, from, to);
  return NextResponse.json({ rate });
}