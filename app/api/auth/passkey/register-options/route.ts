// app/api/auth/passkey/register-options/route.ts
// Generates WebAuthn registration options for an existing user and stashes the
// challenge in a short-lived httpOnly cookie (verified server-side later).
import { NextResponse } from 'next/server';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { rawQuery } from '@/app/lib/db/client';

const CHALLENGE_COOKIE = 'pk_reg_challenge';

export async function POST(request: Request) {
  let email = '';
  try { ({ email } = await request.json()); } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  email = (email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const users = await rawQuery<{ user_id: string; email: string; first_name: string; last_name: string }>(
    `SELECT user_id, email, first_name, last_name FROM users WHERE email = ? LIMIT 1`, [email],
  );
  if (users.length === 0) return NextResponse.json({ error: 'Unable to start passkey setup' }, { status: 400 });
  const user = users[0];

  const rpName = process.env.NEXT_PUBLIC_RP_NAME;
  const rpID = process.env.NEXT_PUBLIC_RP_ID;
  if (!rpName || !rpID) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userID: new TextEncoder().encode(user.user_id),
    userName: user.email,
    userDisplayName: `${user.first_name} ${user.last_name}`,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred', authenticatorAttachment: 'platform' },
  });

  const res = NextResponse.json(options);
  // Store the challenge server-side (signed httpOnly cookie), 5-minute life.
  res.cookies.set(CHALLENGE_COOKIE, `${user.user_id}::${options.challenge}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/passkey', maxAge: 300,
  });
  return res;
}