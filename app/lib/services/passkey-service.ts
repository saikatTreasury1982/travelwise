// app/lib/services/passkey-service.ts
// -----------------------------------------------------------------------------
// Passkey (WebAuthn) credential service (ADR-001 Decision 3).
//
// Kept from the WanderWise prototype (they were already correct):
//   * signature COUNTER verification / update (clone detection).
//   * credential_id (base64url) as primary key, public_key stored base64.
//
// Added for Travelwise:
//   * tenant_id stamped on every passkey row.
//   * transports + is_active + last_used_at columns.
//   * one place that owns all passkey DB access, so routes stay thin.
//
// The actual @simplewebauthn/server generate/verify calls live in the API
// routes (Batch 3), because they need env (rpID, origin) and the request. This
// service is only the DB layer for passkeys. user_id is the internal FK.
// -----------------------------------------------------------------------------
import { rawQuery, rawExecute } from '../db/client';

export interface PasskeyRow {
  credential_id: string;
  tenant_id: string;
  user_id: string;
  public_key: string;   // base64
  counter: number;
  transports: string | null; // JSON array string, e.g. '["internal","hybrid"]'
  device_label: string | null;
  is_active: number;
}

// --- reads ------------------------------------------------------------------

/** All active passkeys for a user (used to build allowCredentials at login). */
export async function getUserPasskeys(userId: string): Promise<PasskeyRow[]> {
  return rawQuery<PasskeyRow>(
    `SELECT credential_id, tenant_id, user_id, public_key, counter, transports,
            device_label, is_active
       FROM passkeys
      WHERE user_id = ? AND is_active = 1`,
    [userId],
  );
}

/** One passkey by its credential_id (used during login verification). */
export async function getPasskey(credentialId: string): Promise<PasskeyRow | null> {
  const rows = await rawQuery<PasskeyRow>(
    `SELECT credential_id, tenant_id, user_id, public_key, counter, transports,
            device_label, is_active
       FROM passkeys
      WHERE credential_id = ? AND is_active = 1`,
    [credentialId],
  );
  return rows[0] ?? null;
}

// --- writes -----------------------------------------------------------------

/** Store a newly-registered passkey. */
export async function storePasskey(params: {
  tenantId: string;
  userId: string;
  credentialId: string;   // base64url from the browser
  publicKey: string;      // base64
  counter: number;
  transports?: string[] | null;
  deviceLabel?: string | null;
}): Promise<void> {
  await rawExecute(
    `INSERT INTO passkeys
       (credential_id, tenant_id, user_id, public_key, counter, transports,
        device_label, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    [
      params.credentialId,
      params.tenantId,
      params.userId,
      params.publicKey,
      params.counter,
      params.transports ? JSON.stringify(params.transports) : null,
      params.deviceLabel ?? null,
    ],
  );
}

/** Bump the signature counter after a successful authentication (clone check). */
export async function updatePasskeyCounter(credentialId: string, newCounter: number): Promise<void> {
  await rawExecute(
    `UPDATE passkeys
        SET counter = ?, last_used_at = datetime('now')
      WHERE credential_id = ?`,
    [newCounter, credentialId],
  );
}

/** Deactivate a passkey (user removes a device). */
export async function deactivatePasskey(credentialId: string): Promise<void> {
  await rawExecute(
    `UPDATE passkeys SET is_active = 0 WHERE credential_id = ?`,
    [credentialId],
  );
}

/** Does this user have at least one active passkey? */
export async function userHasPasskey(userId: string): Promise<boolean> {
  const rows = await rawQuery<{ credential_id: string }>(
    `SELECT credential_id FROM passkeys WHERE user_id = ? AND is_active = 1 LIMIT 1`,
    [userId],
  );
  return rows.length > 0;
}

/** List a user's active passkeys for the management UI. */
export async function listUserPasskeys(userId: string) {
  return rawQuery<{ credential_id: string; device_label: string | null; created_at: string; last_used_at: string | null }>(
    `SELECT credential_id, device_label, created_at, last_used_at
       FROM passkeys WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC`,
    [userId],
  );
}