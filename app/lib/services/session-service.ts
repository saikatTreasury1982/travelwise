// app/lib/services/session-service.ts
// -----------------------------------------------------------------------------
// Session + refresh-token service (ADR-001 Decision 3, item 1).
//
// Model:
//   * A SESSION = one login on one device (auth_sessions row).
//   * An ACCESS pass is short-lived (15 min). The app re-checks it constantly.
//   * A REFRESH token is long-lived (30 days), rotates on each use, and mints
//     fresh access passes silently so the user is never interrupted.
//   * Reuse of an already-used refresh token = theft signal => the whole
//     session is revoked.
//
// Storage rules that matter:
//   * We store a HASH of the refresh token, never the token itself. If the DB
//     leaks, the tokens are not usable.
//   * Session validity ALWAYS checks status='OPEN' AND expires_at > now
//     (this is the fix for the prototype's non-expiring-session bug).
//
// This service is tenant-aware: every session/refresh row carries tenant_id.
// Bootstrap lookups here use rawQuery because they run at the auth boundary,
// keyed by unguessable tokens.
// -----------------------------------------------------------------------------
import { randomBytes, createHash } from 'crypto';
import { rawQuery, rawExecute } from '../db/client';

// --- lifetimes (tune here; these are the only knobs) ------------------------
const ACCESS_TTL_MIN = 15;          // access pass lifetime
const REFRESH_TTL_DAYS = 30;        // refresh token lifetime (rolling)

// --- types ------------------------------------------------------------------
export interface IssuedSession {
  sessionToken: string;   // the access-side token stored in the httpOnly cookie
  refreshToken: string;   // the raw refresh token (returned ONCE, then only its hash is kept)
  sessionId: number;
  accessExpiresAt: string;
  refreshExpiresAt: string;
}

interface SessionRow {
  session_id: number;
  tenant_id: string;
  user_id: string;
  session_status: string;
  expires_at: string;
}

interface RefreshRow {
  token_id: string;
  session_id: number;
  tenant_id: string;
  user_id: string;
  status: string;
  expires_at: string;
}

// --- helpers ----------------------------------------------------------------
function randomToken(bytes = 32): string {
  const a = randomBytes(bytes);
  return a.toString('hex');
}
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
function isoIn(ms: number): string {
  // ISO-8601 UTC string, matches datetime('now') storage (guideline 4.1).
  return new Date(Date.now() + ms).toISOString().replace('T', ' ').slice(0, 19);
}
function nowIso(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}
const MIN = 60_000;
const DAY = 24 * 60 * MIN;

// -----------------------------------------------------------------------------
// createSession — called after a successful password or passkey login.
// Issues the access-side session token AND the first refresh token.
// -----------------------------------------------------------------------------
export async function createSession(params: {
  tenantId: string;
  userId: string;
  authMethod: 'passkey' | 'password';
  credentialId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<IssuedSession> {
  const sessionToken = randomToken();
  const accessExpiresAt = isoIn(ACCESS_TTL_MIN * MIN);

  // The session row's own expires_at is the REFRESH horizon — the outer bound
  // of how long this login can live. Access re-issue happens within it.
  const sessionExpiresAt = isoIn(REFRESH_TTL_DAYS * DAY);

  await rawExecute(
    `INSERT INTO auth_sessions
       (session_token, tenant_id, user_id, credential_id, auth_method,
        session_status, ip_address, user_agent, expires_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, datetime('now'))`,
    [
      sessionToken,
      params.tenantId,
      params.userId,
      params.credentialId ?? null,
      params.authMethod,
      params.ip ?? null,
      params.userAgent ?? null,
      sessionExpiresAt,
    ],
  );

  const rows = await rawQuery<{ session_id: number }>(
    `SELECT session_id FROM auth_sessions WHERE session_token = ?`,
    [sessionToken],
  );
  const sessionId = rows[0].session_id;

  const successor = await issueRefreshToken(sessionId, params.tenantId, params.userId);

  return {
    sessionToken,
    refreshToken: successor.refreshToken,
    sessionId,
    accessExpiresAt,
    refreshExpiresAt: successor.refreshExpiresAt,
  };
}

// -----------------------------------------------------------------------------
// issueRefreshToken — internal. Mints a new ACTIVE refresh token for a session.
// -----------------------------------------------------------------------------
async function issueRefreshToken(
  sessionId: number,
  tenantId: string,
  userId: string,
): Promise<{ tokenId: string; refreshToken: string; refreshExpiresAt: string }> {
  const tokenId = randomToken(16);
  const refreshToken = randomToken(32);
  const refreshExpiresAt = isoIn(REFRESH_TTL_DAYS * DAY);

  await rawExecute(
    `INSERT INTO refresh_tokens
       (token_id, session_id, tenant_id, user_id, token_hash, status, expires_at)
     VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
    [tokenId, sessionId, tenantId, userId, hashToken(refreshToken), refreshExpiresAt],
  );

  return { tokenId, refreshToken, refreshExpiresAt };
}

// -----------------------------------------------------------------------------
// verifyAccess — is this session token currently valid? (status + expiry)
// Cheap check used on protected requests. Returns the session or null.
// -----------------------------------------------------------------------------
export async function verifyAccess(sessionToken: string): Promise<SessionRow | null> {
  const rows = await rawQuery<SessionRow>(
    `SELECT session_id, tenant_id, user_id, session_status, expires_at
       FROM auth_sessions
      WHERE session_token = ?
        AND session_status = 'OPEN'
        AND expires_at > datetime('now')`,
    [sessionToken],
  );
  return rows[0] ?? null;
}

// -----------------------------------------------------------------------------
// rotateRefresh — the silent-refresh core.
// Given a raw refresh token: validate it, and
//   * if ACTIVE + unexpired -> mark it USED, issue a successor, and mint a
//     fresh access-side session token. Returns the new pair.
//   * if already USED -> THEFT. Revoke the whole session. Returns { theft:true }.
//   * if not found / expired / revoked -> just invalid. Returns null.
// -----------------------------------------------------------------------------
export async function rotateRefresh(rawRefresh: string): Promise<{ ok: true; sessionToken: string; refreshToken: string; accessExpiresAt: string; refreshExpiresAt: string; tenantId: string; userId: string } | { ok: false; theft: true } | null> {
  const tokenHash = hashToken(rawRefresh);
  const rows = await rawQuery<RefreshRow>(
    `SELECT token_id, session_id, tenant_id, user_id, status, expires_at
       FROM refresh_tokens
      WHERE token_hash = ?`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;

  if (row.status === 'USED') {
    await revokeSession(row.session_id);
    return { ok: false, theft: true };
  }
  if (row.status !== 'ACTIVE') return null;
  if (row.expires_at <= nowIso()) return null;

  const sess = await rawQuery<SessionRow>(
    `SELECT session_id, tenant_id, user_id, session_status, expires_at
       FROM auth_sessions
      WHERE session_id = ? AND session_status = 'OPEN' AND expires_at > datetime('now')`,
    [row.session_id],
  );
  if (sess.length === 0) return null;

  const successor = await issueRefreshToken(row.session_id, row.tenant_id, row.user_id);
  await rawExecute(
    `UPDATE refresh_tokens
        SET status = 'USED', used_at = datetime('now'), replaced_by = ?
      WHERE token_id = ?`,
    [successor.tokenId, row.token_id],
  );

  const newSessionToken = randomToken();
  const accessExpiresAt = isoIn(ACCESS_TTL_MIN * MIN);
  const newSessionHorizon = isoIn(REFRESH_TTL_DAYS * DAY);
  await rawExecute(
    `UPDATE auth_sessions
        SET session_token = ?, last_seen_at = datetime('now'), expires_at = ?
      WHERE session_id = ?`,
    [newSessionToken, newSessionHorizon, row.session_id],
  );

  return {
    ok: true,
    sessionToken: newSessionToken,
    refreshToken: successor.refreshToken,
    accessExpiresAt,
    refreshExpiresAt: successor.refreshExpiresAt,
    tenantId: row.tenant_id,
    userId: row.user_id,
  };
}

// -----------------------------------------------------------------------------
// closeSession — normal logout. Marks session CLOSED and its tokens revoked.
// -----------------------------------------------------------------------------
export async function closeSession(sessionToken: string): Promise<void> {
  const rows = await rawQuery<{ session_id: number }>(
    `SELECT session_id FROM auth_sessions WHERE session_token = ?`,
    [sessionToken],
  );
  if (rows.length === 0) return;
  await revokeSession(rows[0].session_id, 'CLOSED');
}

// -----------------------------------------------------------------------------
// revokeSession — internal. Kills a session and all its refresh tokens.
// status: 'REVOKED' (theft/forced) or 'CLOSED' (normal logout).
// -----------------------------------------------------------------------------
export async function revokeSession(
  sessionId: number,
  status: 'REVOKED' | 'CLOSED' = 'REVOKED',
): Promise<void> {
  await rawExecute(
    `UPDATE auth_sessions
        SET session_status = ?, closed_at = datetime('now')
      WHERE session_id = ?`,
    [status, sessionId],
  );
  await rawExecute(
    `UPDATE refresh_tokens
        SET status = 'REVOKED'
      WHERE session_id = ? AND status = 'ACTIVE'`,
    [sessionId],
  );
}