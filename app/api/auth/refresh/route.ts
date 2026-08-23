// app/api/auth/refresh/route.ts
// -----------------------------------------------------------------------------
// Silent refresh. The app calls this when the access session is stale. Reads
// the refresh cookie, rotates it, and issues a fresh session + refresh cookie.
// On theft (reused refresh token) the whole session is revoked and both cookies
// are cleared — the user is logged out and must sign in again.
// -----------------------------------------------------------------------------
import { NextResponse, type NextRequest } from 'next/server';
import { rotateRefresh } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';
import { SESSION_COOKIE } from '@/app/lib/auth/context';

const REFRESH_COOKIE = 'refresh';

function clearCookies(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
}

export async function POST(request: NextRequest) {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
  }

  const result = await rotateRefresh(refresh);

  // Invalid / expired / unknown -> not authenticated, clear anything stale.
  if (result === null) {
    const res = NextResponse.json({ error: 'Session expired' }, { status: 401 });
    clearCookies(res);
    return res;
  }

  // Theft detected -> session already revoked in the service; log out hard.
  if (result.ok === false) {
    await writeAudit({ event: 'session.revoke', result: 'failure', detail: { reason: 'refresh-reuse' } });
    const res = NextResponse.json({ error: 'Session ended for security reasons. Please sign in again.' }, { status: 401 });
    clearCookies(res);
    return res;
  }

  // Success -> set the rotated session + refresh cookies.
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE, result.sessionToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set(REFRESH_COOKIE, result.refreshToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/api/auth', maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}