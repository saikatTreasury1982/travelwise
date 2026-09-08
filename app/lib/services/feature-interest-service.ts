import type { TenantContext } from '@/app/lib/db/scoped';
import { rawQuery, rawExecute } from '@/app/lib/db/client';

export async function hasFeatureInterest(ctx: TenantContext, feature: string): Promise<boolean> {
  const rows = await rawQuery<{ n: number }>(
    `SELECT COUNT(*) AS n FROM feature_interest WHERE tenant_id = ? AND user_id = ? AND feature = ?`,
    [ctx.tenantId, ctx.userId, feature],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function recordFeatureInterest(ctx: TenantContext, feature: string, tripId: number | null): Promise<void> {
  await rawExecute(
    `INSERT INTO feature_interest (tenant_id, user_id, feature, trip_id)
     VALUES (?, ?, ?, ?) ON CONFLICT (tenant_id, user_id, feature) DO NOTHING`,
    [ctx.tenantId, ctx.userId, feature, tripId],
  );
}