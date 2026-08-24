// app/lib/services/preferences-service.ts
import { db, rawQuery } from '../db/client';
import type { TenantContext } from '../db/scoped';

export interface Preferences {
  theme: string;
  date_format: string | null;
  time_format: string | null;
  distance_unit: string | null;
  copilot_tips: number;
  copilot_autonotes: number;
  email_notifications: number;
}

const DEFAULTS: Preferences = {
  theme: 'daybreak', date_format: 'DD MMM YYYY', time_format: '24h', distance_unit: 'km',
  copilot_tips: 1, copilot_autonotes: 1, email_notifications: 1,
};

/** Get prefs, creating a default row if none exists. */
export async function getPreferences(ctx: TenantContext): Promise<Preferences> {
  const rows = await rawQuery<Preferences>(
    `SELECT theme, date_format, time_format, distance_unit, currency_display,
            copilot_tips, copilot_autonotes, email_notifications
       FROM user_preferences WHERE user_id = ? AND tenant_id = ? LIMIT 1`,
    [ctx.userId, ctx.tenantId],
  );
  if (rows[0]) return rows[0];
  // Lazily create a default row on first access.
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_preferences
            (user_id, tenant_id, theme, date_format, time_format, distance_unit,
             copilot_tips, copilot_autonotes, email_notifications)
          VALUES (?, ?, 'daybreak', 'DD MMM YYYY', '24h', 'km', 1, 1, 1)`,
    args: [ctx.userId, ctx.tenantId],
  });
  return { ...DEFAULTS };
}

export interface PreferencesUpdate {
  theme?: string;
  date_format?: string | null;
  time_format?: string | null;
  distance_unit?: string | null;
  currency_display?: string;
  copilot_tips?: boolean;
  copilot_autonotes?: boolean;
  email_notifications?: boolean;
}

const THEMES = ['daybreak', 'midnight-ocean', 'forest-expedition'];

export async function updatePreferences(ctx: TenantContext, input: PreferencesUpdate): Promise<void> {
  // Ensure a row exists.
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_preferences (user_id, tenant_id) VALUES (?, ?)`,
    args: [ctx.userId, ctx.tenantId],
  });

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const set = (col: string, val: string | number | null) => { sets.push(`${col} = ?`); args.push(val); };

  if (input.theme !== undefined) {
    if (!THEMES.includes(input.theme)) throw new Error('Unknown theme');
    set('theme', input.theme);
  }
  if (input.date_format !== undefined) set('date_format', input.date_format);
  if (input.time_format !== undefined) set('time_format', input.time_format);
  if (input.distance_unit !== undefined) set('distance_unit', input.distance_unit);
  if (input.currency_display !== undefined) set('currency_display', input.currency_display);
  if (input.copilot_tips !== undefined) set('copilot_tips', input.copilot_tips ? 1 : 0);
  if (input.copilot_autonotes !== undefined) set('copilot_autonotes', input.copilot_autonotes ? 1 : 0);
  if (input.email_notifications !== undefined) set('email_notifications', input.email_notifications ? 1 : 0);

  if (sets.length === 0) return;
  set('updated_at', new Date().toISOString().replace('T', ' ').slice(0, 19));
  await db.execute({
    sql: `UPDATE user_preferences SET ${sets.join(', ')} WHERE user_id = ? AND tenant_id = ?`,
    args: [...args, ctx.userId, ctx.tenantId],
  });
}