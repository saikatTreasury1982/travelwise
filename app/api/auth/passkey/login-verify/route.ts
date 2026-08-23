// app/api/auth/passkey/login-verify/route.ts
// Verifies the authentication response against the server-stored challenge,
// checks + updates the signature counter (clone detection), and logs in.
import { NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { getPasskey, updatePasskeyCounter } from '@/app/lib/services/passkey-service';
import { createSession } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';
import { SESSION_COOKIE } from '@/app/lib/auth/context';

const CHALLENGE_COOKIE = 'pk_login_challenge';
const REFRESH_COOKIE = 'refresh';

export async function POST(request: NextRequest) {
  let credential: { id: string } | undefined;
  try { ({ credential } = await request.json()); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  if (!credential?.id) return NextResponse.json({ error: 'Missing credential' }, { status: 400 });

  const challenge = request.cookies.get(CHALLENGE_COOKIE)?.value;
  if (!challenge) return NextResponse.json({ error: 'Challenge expired, please retry' }, { status: 400 });

  const passkey = await getPasskey(credential.id);
  if (!passkey) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });

  const origin = process.env.NEXT_PUBLIC_ORIGIN;
  const rpID = process.env.NEXT_PUBLIC_RP_ID;
  if (!origin || !rpID) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: credential as never,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.credential_id,
        publicKey: Uint8Array.from(Buffer.from(passkey.public_key, 'base64')),
        counter: passkey.counter,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });
  }
  if (!verification.verified) return NextResponse.json({ error: 'Authentication failed' }, { status: 401 });

  await updatePasskeyCounter(passkey.credential_id, verification.authenticationInfo.newCounter);

  const ip = request.headers.get('x-forwarded-for');
  const ua = request.headers.get('user-agent');
  const issued = await createSession({ tenantId: passkey.tenant_id, userId: passkey.user_id, authMethod: 'passkey', credentialId: passkey.credential_id, ip, userAgent: ua });
  await writeAudit({ event: 'passkey.login', result: 'success', tenantId: passkey.tenant_id, userId: passkey.user_id, ip, userAgent: ua });

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