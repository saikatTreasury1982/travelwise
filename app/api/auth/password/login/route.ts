// app/api/auth/password/login/route.ts
// -----------------------------------------------------------------------------
// Password login. Verifies email+password, and on success creates a session
// (access cookie) + refresh token, then sets both as httpOnly cookies.
// Generic errors throughout (no user enumeration, no "wrong password vs no user").
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';
import { verifyPassword } from '@/app/lib/services/password-service';
import { createSession } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';
import { SESSION_COOKIE } from '@/app/lib/auth/context';

const REFRESH_COOKIE = 'refresh';

export async function POST(request: Request) {
  let email = '', password = '';
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  email = (email ?? '').trim().toLowerCase();
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
  }

  const ip = request.headers.get('x-forwarded-for');
  const ua = request.headers.get('user-agent');

  const users = await rawQuery<{ user_id: string; tenant_id: string }>(
    `SELECT user_id, tenant_id FROM users WHERE email = ? AND is_active = 1 LIMIT 1`, [email],
  );

  // Same generic failure whether the user is missing or the password is wrong.
  const fail = () => {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  };

  if (users.length === 0) {
    await writeAudit({ event: 'login.failure', result: 'failure', detail: { method: 'password', email }, ip, userAgent: ua });
    return fail();
  }
  const { user_id, tenant_id } = users[0];

  const ok = await verifyPassword({ tenantId: tenant_id, userId: user_id, password });
  if (!ok) {
    await writeAudit({ event: 'login.failure', result: 'failure', tenantId: tenant_id, userId: user_id, detail: { method: 'password' }, ip, userAgent: ua });
    return fail();
  }

  const issued = await createSession({
    tenantId: tenant_id, userId: user_id, authMethod: 'password', ip, userAgent: ua,
  });
  await writeAudit({ event: 'login.success', result: 'success', tenantId: tenant_id, userId: user_id, detail: { method: 'password' }, ip, userAgent: ua });

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE, issued.sessionToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(REFRESH_COOKIE, issued.refreshToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}