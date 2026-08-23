// app/api/auth/logout/route.ts
// -----------------------------------------------------------------------------
// Logout. Closes the current session (status CLOSED, refresh tokens revoked)
// and clears both cookies.
// -----------------------------------------------------------------------------
import { NextResponse, type NextRequest } from 'next/server';
import { closeSession } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';
import { SESSION_COOKIE } from '@/app/lib/auth/context';

const REFRESH_COOKIE = 'refresh';

export async function POST(request: NextRequest) {
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  if (sessionToken) {
    await closeSession(sessionToken);
    await writeAudit({ event: 'logout', result: 'success' });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, '', { httpOnly: true, path: '/api/auth', maxAge: 0 });
  return res;
}