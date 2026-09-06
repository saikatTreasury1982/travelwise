// app/lib/subscription/entitlements.ts
// -----------------------------------------------------------------------------
// READ-TIME feature entitlements: maps a PlanCode → concrete per-feature limits.
// Separate from resolveEntitlement() (which decides WHICH plan at signup).
// Features ask THIS — never a plan/column directly — so when real paid tiers
// arrive we only touch this file.
//
// TODAY: no plan is persisted on the account (everyone is Lifetime Free), so
// getFeatureEntitlements() returns the default plan's limits. When the billing
// plugin lands and starts storing a plan per account, fill in currentPlanFor()
// to read it — nothing else in the app changes.
// -----------------------------------------------------------------------------
import type { PlanCode } from './types';
import type { TenantContext } from '@/app/lib/db/scoped';

export interface FeatureEntitlements {
  aiItineraryRevisions: number | 'unlimited';
  // future per-feature limits go here, not scattered through features.
}

// Single source of truth for what each plan can do.
const LIMITS: Record<PlanCode, FeatureEntitlements> = {
  lifetime_free: { aiItineraryRevisions: 3 },   // generous-but-bounded (everyone, today)
  free_trial:    { aiItineraryRevisions: 3 },
  paid:          { aiItineraryRevisions: 'unlimited' },
};

export const DEFAULT_PLAN: PlanCode = 'lifetime_free';

export function featuresForPlan(plan: PlanCode): FeatureEntitlements {
  return LIMITS[plan] ?? LIMITS[DEFAULT_PLAN];
}

/**
 * Resolve the account's CURRENT plan at request time.
 * TODAY: always the default (no plan is persisted; everyone is Lifetime Free).
 * LATER: when billing persists a plan per account, read it here — e.g.
 *   const rows = await scopedQuery(ctx, `SELECT plan_code FROM accounts WHERE {{tenant}} LIMIT 1`, []);
 *   return (rows[0]?.plan_code as PlanCode) ?? DEFAULT_PLAN;
 * This is the ONLY place that needs to change.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function currentPlanFor(_ctx: TenantContext): Promise<PlanCode> {
  return DEFAULT_PLAN;
}

/** The read-time question features ask: "what can this user do right now?" */
export async function getFeatureEntitlements(ctx: TenantContext): Promise<FeatureEntitlements> {
  const plan = await currentPlanFor(ctx);
  return featuresForPlan(plan);
}