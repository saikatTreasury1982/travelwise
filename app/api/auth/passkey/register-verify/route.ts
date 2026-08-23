// app/api/auth/passkey/register-verify/route.ts
// Verifies the registration response against the server-stored challenge,
// stores the passkey (tenant-aware), and logs the user in (session + refresh).
import { NextResponse, type NextRequest } from 'next/server';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { rawQuery } from '@/app/lib/db/client';
import { storePasskey } from '@/app/lib/services/passkey-service';
import { createSession } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';
import { SESSION_COOKIE } from '@/app/lib/auth/context';

const CHALLENGE_COOKIE = 'pk_reg_challenge';
const REFRESH_COOKIE = 'refresh';

export async function POST(request: NextRequest) {
  let credential: unknown;
  try { ({ credential } = await request.json()); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!credential) return NextResponse.json({ error: 'Missing credential' }, { status: 400 });

  const stash = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!stash) return NextResponse.json({ error: 'Challenge expired, please retry' }, { status: 400 });
  const [userId, challenge] = stash.split('::');
  if (!userId || !challenge) return NextResponse.json({ error: 'Invalid challenge' }, { status: 400 });

  const users = await rawQuery<{ user_id: string; tenant_id: string }>(
    `SELECT user_id, tenant_id FROM users WHERE user_id = ? LIMIT 1`, [userId],
  );
  if (users.length === 0) return NextResponse.json({ error: 'User not found' }, { status: 400 });
  const { tenant_id } = users[0];

  const origin = process.env.NEXT_PUBLIC_ORIGIN;
  const rpID = process.env.NEXT_PUBLIC_RP_ID;
  if (!origin || !rpID) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: credential as never,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
  }
  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: 'Passkey verification failed' }, { status: 400 });
  }

  const { credential: reg } = verification.registrationInfo;
  await storePasskey({
    tenantId: tenant_id,
    userId,
    credentialId: (credential as { id: string }).id,
    publicKey: Buffer.from(reg.publicKey).toString('base64'),
    counter: reg.counter,
    deviceLabel: 'Primary Device',
  });

  const ip = request.headers.get('x-forwarded-for');
  const ua = request.headers.get('user-agent');
  const issued = await createSession({ tenantId: tenant_id, userId, authMethod: 'passkey', credentialId: (credential as { id: string }).id, ip, userAgent: ua });
  await writeAudit({ event: 'passkey.register', result: 'success', tenantId: tenant_id, userId, ip, userAgent: ua });

  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE, issued.sessionToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/',
  });
  res.cookies.set(REFRESH_COOKIE, issued.refreshToken, {
    httpOnly: true, secure, sameSite: 'lax', path: '/api/auth',
  });
  res.cookies.set(CHALLENGE_COOKIE, '', { httpOnly: true, path: '/api/auth/passkey', maxAge: 0 });
  return res;
}