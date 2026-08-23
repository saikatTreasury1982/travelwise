// app/api/auth/password/create/route.ts
// -----------------------------------------------------------------------------
// Set a password for an existing user (first-login credential setup, or reset).
// Resolves user_id + tenant_id from email, validates against policy, hashes
// with Argon2id, and stores as the one active password. Does NOT log the user
// in — they then sign in with the new password (matches prototype flow).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { rawQuery } from '@/app/lib/db/client';
import { createPassword } from '@/app/lib/services/password-service';
import { writeAudit } from '@/app/lib/audit';

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

  const users = await rawQuery<{ user_id: string; tenant_id: string }>(
    `SELECT user_id, tenant_id FROM users WHERE email = ? LIMIT 1`, [email],
  );
  if (users.length === 0) {
    // Generic — don't confirm/deny the email.
    return NextResponse.json({ error: 'Unable to set password' }, { status: 400 });
  }
  const { user_id, tenant_id } = users[0];

  try {
    await createPassword({ tenantId: tenant_id, userId: user_id, password });
  } catch (err) {
    // validatePassword throws with the policy message — surface it to the user.
    const message = err instanceof Error ? err.message : 'Password does not meet requirements';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await writeAudit({ event: 'password.create', result: 'success', tenantId: tenant_id, userId: user_id });
  return NextResponse.json({ ok: true });
}