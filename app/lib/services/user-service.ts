// app/lib/services/user-service.ts
import { db, rawQuery } from '../db/client';
import type { TenantContext } from '../db/scoped';

export interface UserProfile {
  user_id: string; email: string; first_name: string; middle_name: string | null;
  last_name: string; resident_country: string; home_currency: string;
}

export async function getProfile(ctx: TenantContext): Promise<UserProfile | null> {
  const rows = await rawQuery<UserProfile>(
    `SELECT user_id, email, first_name, middle_name, last_name, resident_country, home_currency
       FROM users WHERE user_id = ? AND tenant_id = ? LIMIT 1`,
    [ctx.userId, ctx.tenantId],
  );
  return rows[0] ?? null;
}

export interface ProfileUpdate {
  firstName?: string; middleName?: string | null; lastName?: string;
  email?: string; residentCountry?: string; homeCurrency?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function updateProfile(ctx: TenantContext, input: ProfileUpdate): Promise<void> {
  const sets: string[] = [];
  const args: (string | null)[] = [];
  const set = (col: string, val: string | null) => { sets.push(`${col} = ?`); args.push(val); };

  if (input.firstName !== undefined) {
    if (!input.firstName.trim()) throw new Error('First name is required');
    set('first_name', input.firstName.trim());
  }
  if (input.middleName !== undefined) set('middle_name', input.middleName?.trim() || null);
  if (input.lastName !== undefined) {
    if (!input.lastName.trim()) throw new Error('Last name is required');
    set('last_name', input.lastName.trim());
  }
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) throw new Error('Please enter a valid email address');
    // Ensure email stays unique within the tenant.
    const clash = await rawQuery<{ user_id: string }>(
      `SELECT user_id FROM users WHERE tenant_id = ? AND email = ? AND user_id <> ? LIMIT 1`,
      [ctx.tenantId, email, ctx.userId],
    );
    if (clash.length > 0) throw new Error('That email is already in use');
    set('email', email);
  }
  if (input.residentCountry !== undefined) {
    const c = await rawQuery<{ country_code: string }>(`SELECT country_code FROM countries WHERE country_code = ?`, [input.residentCountry]);
    if (c.length === 0) throw new Error('Unknown country');
    set('resident_country', input.residentCountry);
  }
  if (input.homeCurrency !== undefined) {
    const c = await rawQuery<{ currency_code: string }>(`SELECT currency_code FROM currencies WHERE currency_code = ?`, [input.homeCurrency]);
    if (c.length === 0) throw new Error('Unknown currency');
    set('home_currency', input.homeCurrency);
  }

  if (sets.length === 0) return;
  set('updated_at', new Date().toISOString().replace('T', ' ').slice(0, 19));
  await db.execute({
    sql: `UPDATE users SET ${sets.join(', ')} WHERE user_id = ? AND tenant_id = ?`,
    args: [...args, ctx.userId, ctx.tenantId],
  });
}