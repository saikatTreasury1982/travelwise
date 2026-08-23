// app/lib/subscription/types.ts
// -----------------------------------------------------------------------------
// The subscription/entitlement plugin contract. Registration resolves an
// entitlement through this seam. Today a default provider (Lifetime Free) is
// used; when the billing plugin is installed it registers a provider that
// takes over (see index.ts). The core app never depends on the plugin existing.
// -----------------------------------------------------------------------------

export type PlanCode = 'lifetime_free' | 'free_trial' | 'paid';

/** What registration knows about a signup when resolving its entitlement. */
export interface SignupContext {
  email: string;
  isFirstUser: boolean;      // tenant zero — always Lifetime Free
  selectedPlan?: string | null; // what the user picked on the pricing page (plugin-driven)
  tenantId: string;
  accountId: string;
  userId: string;
}

/** The resolved entitlement written onto the account (and, later, plugin tables). */
export interface Entitlement {
  plan: PlanCode;
  billingStatus: string;        // 'active' | 'trialing' | 'past_due' ...
  trialEndsAt?: string | null;  // ISO string when plan === 'free_trial'
  metadata?: Record<string, unknown>;
}

/** A billing plugin implements this and registers it (see registerSubscriptionProvider). */
export interface SubscriptionProvider {
  resolve(ctx: SignupContext): Promise<Entitlement> | Entitlement;
}