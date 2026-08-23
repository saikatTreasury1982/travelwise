// app/api/auth/passkey/login-options/route.ts
// Generates authentication options for a user's passkeys, stashes the challenge.
// Does NOT return userId on 404 (closes the prototype's enumeration vector).
import { NextResponse } from 'next/server';
import { generateAuthenticationOptions, type AuthenticatorTransportFuture } from '@simplewebauthn/server';
import { rawQuery } from '@/app/lib/db/client';
import { getUserPasskeys } from '@/app/lib/services/passkey-service';

const CHALLENGE_COOKIE = 'pk_login_challenge';

export async function POST(request: Request) {
  let email = '';
  try { ({ email } = await request.json()); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  email = (email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const rpID = process.env.NEXT_PUBLIC_RP_ID;
  if (!rpID) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const users = await rawQuery<{ user_id: string }>(
    `SELECT user_id FROM users WHERE email = ? LIMIT 1`, [email],
  );
  // No user OR no passkeys -> same generic response. Never leak userId.
  const passkeys = users.length ? await getUserPasskeys(users[0].user_id) : [];
  if (passkeys.length === 0) {
    return NextResponse.json({ error: 'No passkey available for this account' }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      transports: (p.transports ? JSON.parse(p.transports) : ['internal', 'hybrid']) as AuthenticatorTransportFuture[],
    })),
    userVerification: 'preferred',
  });

  const res = NextResponse.json(options);
  res.cookies.set(CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/passkey', maxAge: 300,
  });
  return res;
}