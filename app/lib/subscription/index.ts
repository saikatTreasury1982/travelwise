// app/lib/subscription/index.ts
// -----------------------------------------------------------------------------
// Entitlement resolver + provider registry (the plugin seam).
//
// Rules baked in here (not overridable by a plugin):
//   * The FIRST user (tenant zero) is ALWAYS Lifetime Free.
//
// Everything else:
//   * No provider registered  -> default provider = Lifetime Free for everyone.
//   * Provider registered      -> it decides (e.g. Free Trial default, or Paid).
//
// When the billing plugin is built, it calls registerSubscriptionProvider() at
// startup (we'll wire that init import then). Until then, default applies, so
// you can register and test end-to-end now.
// -----------------------------------------------------------------------------
import type { SubscriptionProvider, SignupContext, Entitlement } from './types';

let activeProvider: SubscriptionProvider | null = null;

/** Called by the billing plugin at startup to take over entitlement decisions. */
export function registerSubscriptionProvider(provider: SubscriptionProvider): void {
  activeProvider = provider;
}

/** True when no billing plugin is installed (useful for the UI to hide plan choice). */
export function isBillingPluginInstalled(): boolean {
  return activeProvider !== null;
}

// Default: Lifetime Free. Used whenever no plugin is registered.
const defaultProvider: SubscriptionProvider = {
  resolve(): Entitlement {
    return { plan: 'lifetime_free', billingStatus: 'active', trialEndsAt: null };
  },
};

export async function resolveEntitlement(ctx: SignupContext): Promise<Entitlement> {
  // Hard rule: tenant zero is always Lifetime Free, plugin or not.
  if (ctx.isFirstUser) {
    return { plan: 'lifetime_free', billingStatus: 'active', trialEndsAt: null, metadata: { reason: 'tenant-zero' } };
  }
  const provider = activeProvider ?? defaultProvider;
  return provider.resolve(ctx);
}