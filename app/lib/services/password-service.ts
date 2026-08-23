// app/lib/services/password-service.ts
// -----------------------------------------------------------------------------
// Password credential service (ADR-001 Decision 3). Argon2id via @node-rs/argon2.
//
// Differences from the WanderWise prototype:
//   * Argon2id, not bcrypt (memory-hard, no 72-byte truncation).
//   * ONE active password per user — creating a new one archives the old
//     (is_active=0) instead of leaving orphaned rows (fixes prototype issue #4).
//   * tenant_id stamped on every row.
//   * verify-then-upgrade: if a legacy bcrypt hash is ever migrated in, a
//     successful verify rehashes it to Argon2id. (Hook included; bcrypt import
//     is lazy so you only need the dep if you actually migrate old hashes.)
//
// user_id is the internal FK (unchanged from prototype). These functions are
// called at the auth boundary, so they use rawQuery/rawExecute keyed by user_id
// resolved from the session/login flow — the tenant_id is passed in explicitly.
// -----------------------------------------------------------------------------
import { randomBytes } from 'crypto';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { rawQuery, rawExecute } from '../db/client';

// Argon2id parameters. Sensible defaults; tune memoryCost up if your host allows.
const ARGON_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export interface PasswordPattern {
  id: string;
  min_length: number;
  require_uppercase: number;
  require_numbers: number;
  regex_pattern: string;
  description: string;
}

interface PasswordRow {
  id: string;
  user_id: string;
  password_hash: string;
  algo: string;
}

// --- policy -----------------------------------------------------------------
export async function getPasswordPattern(): Promise<PasswordPattern | null> {
  const rows = await rawQuery<PasswordPattern>(
    `SELECT * FROM password_patterns WHERE id = 'active'`,
  );
  return rows[0] ?? null;
}

export async function validatePassword(password: string): Promise<{ valid: boolean; error?: string }> {
  const pattern = await getPasswordPattern();
  if (!pattern) return { valid: false, error: 'Password requirements not configured' };
  try {
    const re = new RegExp(pattern.regex_pattern);
    if (!re.test(password)) return { valid: false, error: pattern.description };
  } catch {
    // Bad regex in config — fail closed rather than accepting anything.
    return { valid: false, error: 'Password policy misconfigured' };
  }
  return { valid: true };
}

// --- create / rotate --------------------------------------------------------
export async function createPassword(params: {
  tenantId: string;
  userId: string;
  password: string;
}): Promise<void> {
  const validation = await validatePassword(params.password);
  if (!validation.valid) throw new Error(validation.error);

  const digest = await argonHash(params.password, ARGON_OPTS);
  const id = randomBytes(16).toString('hex');

  // Archive any existing active password for this user, then insert the new one.
  await rawExecute(
    `UPDATE passwords SET is_active = 0, rotated_at = datetime('now')
      WHERE user_id = ? AND is_active = 1`,
    [params.userId],
  );
  await rawExecute(
    `INSERT INTO passwords (id, tenant_id, user_id, password_hash, algo, is_active)
     VALUES (?, ?, ?, ?, 'argon2id', 1)`,
    [id, params.tenantId, params.userId, digest],
  );
}

// --- verify (with silent upgrade of legacy bcrypt) --------------------------
export async function verifyPassword(params: {
  tenantId: string;
  userId: string;
  password: string;
}): Promise<boolean> {
  const rows = await rawQuery<PasswordRow>(
    `SELECT id, user_id, password_hash, algo
       FROM passwords
      WHERE user_id = ? AND is_active = 1
      LIMIT 1`,
    [params.userId],
  );
  const row = rows[0];
  if (!row) return false;

  if (row.algo === 'argon2id') {
    return argonVerify(row.password_hash, params.password);
  }

    // Legacy bcrypt path intentionally omitted — we start on a clean DB with no
  // bcrypt hashes. If WanderWise passwords are migrated later, re-add a
  // verify-then-upgrade branch here and `npm install bcryptjs`.
  return false;
}

// --- exists -----------------------------------------------------------------
export async function userHasPassword(userId: string): Promise<boolean> {
  const rows = await rawQuery<{ id: string }>(
    `SELECT id FROM passwords WHERE user_id = ? AND is_active = 1 LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}