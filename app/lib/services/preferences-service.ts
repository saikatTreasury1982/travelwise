import { scopedQuery, scopedExecute } from '@/app/lib/db/scoped';
import type { UserContext } from '@/app/lib/auth/context';

export interface Preferences {
  theme: string;
  date_format: string;
  time_format: string;
  distance_unit: string;
  copilot_tips: number;
  copilot_autonotes: number;
  email_notifications: number;
}

const DEFAULTS: Preferences = {
  theme: 'daybreak',
  date_format: 'DD MMM YYYY',
  time_format: '24h',
  distance_unit: 'km',
  copilot_tips: 1,
  copilot_autonotes: 1,
  email_notifications: 1,
};

export type PreferencesUpdate = Partial<Preferences>;

// Always returns a PLAIN object (safe to pass to Client Components)
export async function getPreferences(ctx: UserContext): Promise<Preferences> {
  const rows = await scopedQuery(
    ctx,
    `SELECT theme, date_format, time_format, distance_unit,
            copilot_tips, copilot_autonotes, email_notifications
     FROM user_preferences
     WHERE {{tenant}} AND user_id = ?`,
    [ctx.userId]
  );

  const r = rows[0];
  if (!r) {
    // Lazy-create defaults if the row is missing
    await scopedExecute(
      ctx,
      `INSERT INTO user_preferences
         (tenant_id, user_id, theme, date_format, time_format, distance_unit,
          copilot_tips, copilot_autonotes, email_notifications)
       VALUES ({{tenant}}, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ctx.userId, DEFAULTS.theme, DEFAULTS.date_format, DEFAULTS.time_format,
       DEFAULTS.distance_unit, DEFAULTS.copilot_tips, DEFAULTS.copilot_autonotes,
       DEFAULTS.email_notifications]
    );
    return { ...DEFAULTS };
  }

  return {
    theme: String(r.theme),
    date_format: String(r.date_format),
    time_format: String(r.time_format),
    distance_unit: String(r.distance_unit),
    copilot_tips: Number(r.copilot_tips),
    copilot_autonotes: Number(r.copilot_autonotes),
    email_notifications: Number(r.email_notifications),
  };
}

export async function updatePreferences(ctx: UserContext, patch: PreferencesUpdate): Promise<Preferences> {
  const allowed: (keyof Preferences)[] = [
    'theme', 'date_format', 'time_format', 'distance_unit',
    'copilot_tips', 'copilot_autonotes', 'email_notifications',
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
      `UPDATE user_preferences SET ${sets.join(', ')} WHERE {{tenant}} AND user_id = ?`,
      args
    );
  }
  return getPreferences(ctx);
}