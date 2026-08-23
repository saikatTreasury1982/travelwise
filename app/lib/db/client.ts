// app/lib/db/client.ts
// -----------------------------------------------------------------------------
// Turso / libSQL client. Single shared connection for the whole app.
// Reads credentials from env — never hardcode them (ADR: secrets in env only).
// -----------------------------------------------------------------------------
import { createClient, type Client, type InArgs } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  throw new Error('TURSO_DATABASE_URL is not set');
}

// One client per server process. In dev, Next.js hot-reload can re-evaluate
// modules, so we cache on globalThis to avoid opening many connections.
const globalForDb = globalThis as unknown as { __tursoClient?: Client };

export const db: Client =
  globalForDb.__tursoClient ??
  createClient({
    url,
    authToken, // undefined is fine for a local file: url during dev
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__tursoClient = db;
}

// Thin helpers so services don't import the raw client everywhere.
// NOTE: these are UNSCOPED — they do not add tenant filtering. For anything
// tenant-scoped, go through app/lib/db/scoped.ts instead. Use these only for
// global/reference tables (currencies, countries, password_patterns) and for
// the auth bootstrap lookups that run *before* a tenant context exists.
export async function rawQuery<T = Record<string, unknown>>(
  sql: string,
  args: InArgs = [],
): Promise<T[]> {
  const result = await db.execute({ sql, args });
  return result.rows as unknown as T[];
}

export async function rawExecute(sql: string, args: InArgs = []): Promise<void> {
  await db.execute({ sql, args });
}