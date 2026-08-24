// app/api/account/password/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { changePassword, userHasPassword } from '@/app/lib/services/password-service';
import { writeAudit } from '@/app/lib/audit';

// GET: does the user currently have a password? (UI shows "change" vs "set")
export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const has = await userHasPassword(ctx.userId);
  return NextResponse.json({ hasPassword: has });
}

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  let body: { currentPassword?: string; newPassword?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  if (!body.newPassword) return NextResponse.json({ error: 'New password is required' }, { status: 400 });

  const result = await changePassword({
    tenantId: ctx.tenantId, userId: ctx.userId,
    currentPassword: body.currentPassword, newPassword: body.newPassword,
  });

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  await writeAudit({ event: 'password.rotate', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId });
  return NextResponse.json({ ok: true });
}