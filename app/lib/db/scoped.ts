// app/lib/db/scoped.ts
// -----------------------------------------------------------------------------
// Tenant-scoped data access. THE central enforcement point from ADR-001.
//
// Why this exists: with row-level multi-tenancy, every query against a
// tenant-scoped table MUST filter by tenant_id. Leaving that to per-query
// discipline is how cross-tenant data leaks happen. This module makes the
// tenant filter structural — you cannot build a scoped query without a
// TenantContext, and the helpers inject the filter for you.
//
// Rule of thumb:
//   * Reference/global tables (currencies, countries, password_patterns) and
//     pre-auth lookups -> app/lib/db/client.ts (rawQuery/rawExecute).
//   * Everything owned by a tenant (users, passwords, passkeys, sessions,
//     refresh_tokens, accounts, account_members, audit_log) -> THIS module.
// -----------------------------------------------------------------------------
import { db } from './client';
import type { InArgs, InValue } from '@libsql/client';

/** The identity every scoped query runs under. Built by getUserContext(). */
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  accountId: string;
}

/**
 * Run a SELECT that is automatically constrained to the caller's tenant.
 *
 * Write the SQL with a `{{tenant}}` marker where the filter belongs:
 *
 *   scopedQuery(ctx,
 *     `SELECT * FROM users WHERE user_id = ? AND {{tenant}}`,
 *     [someUserId])
 *
 * `{{tenant}}` expands to `tenant_id = ?` and the tenantId is spliced into
 * args at the marker's position. Table-qualified form: `{{tenant:u}}` ->
 * `u.tenant_id = ?`. Your `?` placeholders and the markers are matched to
 * args left-to-right in source order.
 */
export async function scopedQuery<T = Record<string, unknown>>(
  ctx: TenantContext,
  sql: string,
  args: InValue[] = [],
): Promise<T[]> {
  const { text, finalArgs } = injectTenant(sql, args, ctx.tenantId);
  const result = await db.execute({ sql: text, args: finalArgs as InArgs });
  return result.rows as unknown as T[];
}

/** Same contract as scopedQuery, for INSERT/UPDATE/DELETE. */
export async function scopedExecute(
  ctx: TenantContext,
  sql: string,
  args: InValue[] = [],
): Promise<void> {
  const { text, finalArgs } = injectTenant(sql, args, ctx.tenantId);
  await db.execute({ sql: text, args: finalArgs as InArgs });
}

/**
 * INSERT helper that guarantees tenant_id is set. Give it the table and a
 * column->value map WITHOUT tenant_id; it adds tenant_id from the context.
 */
export async function scopedInsert(
  ctx: TenantContext,
  table: string,
  values: Record<string, InValue>,
): Promise<void> {
  const withTenant = { ...values, tenant_id: ctx.tenantId };
  const cols = Object.keys(withTenant);
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;
  await db.execute({ sql, args: Object.values(withTenant) as InArgs });
}

// --- internal ---------------------------------------------------------------

function injectTenant(
  sql: string,
  args: InValue[],
  tenantId: string,
): { text: string; finalArgs: InValue[] } {
  // Walk the SQL left-to-right, tracking every `?` — whether it came from the
  // caller or from a {{tenant}} marker — so args line up positionally even
  // with multiple markers interleaved among the caller's own placeholders.
  const finalArgs: InValue[] = [];
  let callerArgIndex = 0;
  let markerCount = 0;
  let cursor = 0;
  let text = '';

  const combined = /\?|\{\{tenant(?::([a-zA-Z_][\w]*))?\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = combined.exec(sql)) !== null) {
    text += sql.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    if (m[0] === '?') {
      text += '?';
      finalArgs.push(args[callerArgIndex]);
      callerArgIndex += 1;
    } else {
      const alias = m[1];
      text += alias ? `${alias}.tenant_id = ?` : `tenant_id = ?`;
      finalArgs.push(tenantId);
      markerCount += 1;
    }
  }
  text += sql.slice(cursor);

  if (markerCount === 0) {
    throw new Error(
      'scopedQuery/scopedExecute called without a {{tenant}} marker. ' +
        'Add {{tenant}} (or {{tenant:alias}}) where the tenant filter belongs, ' +
        'or use rawQuery for a genuinely global/reference table.',
    );
  }
  if (callerArgIndex !== args.length) {
    throw new Error(
      `Arg count mismatch: SQL consumed ${callerArgIndex} caller placeholder(s) ` +
        `but ${args.length} arg(s) were provided.`,
    );
  }

  return { text, finalArgs };
}