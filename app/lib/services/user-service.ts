import { scopedQuery, scopedExecute } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';

export interface Profile {
  user_id: string;
  email: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  resident_country: string | null;
  home_currency: string | null;
  is_active: number;
}

export async function getProfile(ctx: TenantContext): Promise<Profile | null> {
  const rows = await scopedQuery(
    ctx,
    `SELECT user_id, email, first_name, middle_name, last_name,
            resident_country, home_currency, is_active
     FROM users WHERE {{tenant}} AND user_id = ?`,
    [ctx.userId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    user_id: String(r.user_id),
    email: r.email == null ? null : String(r.email),
    first_name: r.first_name == null ? null : String(r.first_name),
    middle_name: r.middle_name == null ? null : String(r.middle_name),
    last_name: r.last_name == null ? null : String(r.last_name),
    resident_country: r.resident_country == null ? null : String(r.resident_country),
    home_currency: r.home_currency == null ? null : String(r.home_currency),
    is_active: Number(r.is_active),
  };
}

export interface ProfileUpdate {
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  resident_country?: string | null;
  home_currency?: string | null;
}

export async function updateProfile(ctx: TenantContext, patch: ProfileUpdate): Promise<Profile | null> {
  // Email is intentionally NOT updatable here (login identity; needs verification flow).
  const allowed: (keyof ProfileUpdate)[] = [
    'first_name', 'middle_name', 'last_name', 'resident_country', 'home_currency',
  ];
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const key of allowed) {
    if (patch[key] !== undefined) {
      sets.push(`${key} = ?`);
      args.push(patch[key]);
    }
  }
  if (sets.length > 0) {
    args.push(ctx.userId);
    await scopedExecute(
      ctx,
      `UPDATE users SET ${sets.join(', ')} WHERE {{tenant}} AND user_id = ?`,
      args as import('@libsql/client').InValue[]
    );
  }
  return getProfile(ctx);
}