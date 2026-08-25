// app/lib/audit.ts
// -----------------------------------------------------------------------------
// Append-only audit log writer (ADR Decision 3, item 2). Best-effort: an audit
// write must never break the user's action, but failures are logged server-side.
// Append-only by policy — no update/delete helper.
// -----------------------------------------------------------------------------
import { db } from './db/client';
import type { InArgs } from '@libsql/client';

export type AuditEvent =
  | 'login.success'
  | 'login.failure'
  | 'logout'
  | 'passkey.register'
  | 'passkey.login'
  | 'password.create'
  | 'password.rotate'
  | 'session.create'
  | 'session.revoke'
  | 'role.change'
  | 'trip.create'
  | 'trip.update'
  | 'trip.traveler.add'
  | 'trip.traveler.update'
  | 'trip.traveler.remove';

export interface AuditInput {
  event: AuditEvent;
  result: 'success' | 'failure';
  tenantId?: string | null;
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  detail?: Record<string, unknown>;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await db.execute({
      sql: `INSERT INTO audit_log
              (tenant_id, user_id, event_type, event_result, ip_address, user_agent, detail)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        input.tenantId ?? null,
        input.userId ?? null,
        input.event,
        input.result,
        input.ip ?? null,
        input.userAgent ?? null,
        input.detail ? JSON.stringify(input.detail) : null,
      ] as InArgs,
    });
  } catch (err) {
    console.error('[audit] failed to write audit event', input.event, err);
  }
}