// app/api/account/plan/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const rows = await rawQuery<{ name: string; plan: string; billing_status: string }>(
    `SELECT name, plan, billing_status FROM accounts WHERE account_id = ? AND tenant_id = ? LIMIT 1`,
    [ctx.accountId, ctx.tenantId],
  );
  return NextResponse.json({ account: rows[0] ?? null, role: ctx.role });
}