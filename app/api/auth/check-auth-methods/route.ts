// app/api/auth/check-auth-methods/route.ts
// -----------------------------------------------------------------------------
// Given an email, report which credentials the user has (passkey / password),
// so the login UI can route them. Returns false/false for unknown emails —
// deliberately does NOT reveal whether the email exists (no user enumeration).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';
import { userHasPasskey } from '@/app/lib/services/passkey-service';
import { userHasPassword } from '@/app/lib/services/password-service';

export async function POST(request: Request) {
  let email = '';
  try {
    ({ email } = await request.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  email = (email ?? '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const users = await rawQuery<{ user_id: string }>(
    `SELECT user_id FROM users WHERE email = ? LIMIT 1`, [email],
  );
  if (users.length === 0) {
    // Unknown email — same shape as a known one with no credentials.
    return NextResponse.json({ hasPasskey: false, hasPassword: false });
  }

  const userId = users[0].user_id;
  const [hasPasskey, hasPassword] = await Promise.all([
    userHasPasskey(userId),
    userHasPassword(userId),
  ]);
  return NextResponse.json({ hasPasskey, hasPassword });
}