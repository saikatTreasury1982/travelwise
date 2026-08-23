// app/lib/auth/context.ts
// -----------------------------------------------------------------------------
// getUserContext(): resolves the current request's session cookie into a
// TenantContext (tenantId, userId, role, accountId). Every protected
// route/server-action calls this first; the returned context is handed to the
// scoped data-access helpers.
//
// Session VALIDITY here enforces the fix for prototype issue #1:
//   session_status = 'OPEN' AND expires_at > now  (NOT status alone).
// -----------------------------------------------------------------------------
import { cookies } from 'next/headers';
import { rawQuery } from '../db/client';
import type { TenantContext } from '../db/scoped';

export const SESSION_COOKIE = 'session';

interface SessionRow {
  tenant_id: string;
  user_id: string;
}
interface MembershipRow {
  account_id: string;
  role: 'owner' | 'admin' | 'member';
}

/**
 * Returns the TenantContext for the current request, or null if there is no
 * valid session. Never throws on "not logged in" — callers branch on null.
 *
 * Uses rawQuery deliberately: this runs BEFORE a tenant context exists (it is
 * what establishes one). It is still safe because it looks the session up by
 * the unguessable session_token and reads tenant_id straight off that row.
 */
export async function getUserContext(): Promise<TenantContext | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sessions = await rawQuery<SessionRow>(
    `SELECT tenant_id, user_id
       FROM auth_sessions
      WHERE session_token = ?
        AND session_status = 'OPEN'
        AND expires_at > datetime('now')`,
    [token],
  );
  if (sessions.length === 0) return null;
  const { tenant_id, user_id } = sessions[0];

  const memberships = await rawQuery<MembershipRow>(
    `SELECT account_id, role
       FROM account_members
      WHERE user_id = ? AND tenant_id = ?
      LIMIT 1`,
    [user_id, tenant_id],
  );
  if (memberships.length === 0) return null;

  return {
    tenantId: tenant_id,
    userId: user_id,
    role: memberships[0].role,
    accountId: memberships[0].account_id,
  };
}

/** Convenience for routes that must be authenticated; throws if not. */
export async function requireUserContext(): Promise<TenantContext> {
  const ctx = await getUserContext();
  if (!ctx) throw new Error('UNAUTHENTICATED');
  return ctx;
}