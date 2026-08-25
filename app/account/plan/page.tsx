// app/account/plan/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { ACCOUNT_NAV } from '@/app/components/settings/nav';
import ComingSoon from '@/app/components/hub/ComingSoon';

export const dynamic = 'force-dynamic';

const PLAN_LABEL: Record<string, string> = {
  lifetime_free: 'Lifetime Free', free_trial: 'Free Trial', paid: 'Paid', free: 'Free',
};

export default async function PlanPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(`SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  const firstName = users[0]?.first_name ?? 'traveller';
  const accounts = await rawQuery<{ name: string; plan: string; billing_status: string }>(
    `SELECT name, plan, billing_status FROM accounts WHERE account_id = ? AND tenant_id = ? LIMIT 1`,
    [ctx.accountId, ctx.tenantId],
  );
  const account = accounts[0];

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} />
      <SettingsShell title="Account" subNav={ACCOUNT_NAV} active="plan">
        <div className="max-w-[520px]">
          <h2 className="text-xs font-bold uppercase mb-4" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Your plan</h2>

          <div className="rounded-2xl p-6 mb-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[22px] font-bold" style={{ color: 'var(--ink)' }}>{PLAN_LABEL[account?.plan ?? 'free'] ?? account?.plan}</span>
              <span className="text-[12px] font-semibold px-2.5 py-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
                {account?.billing_status ?? 'active'}
              </span>
            </div>
            <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>
              Role: <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{ctx.role}</span> · Account: {account?.name ?? '—'}
            </p>
          </div>

          <h3 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Upgrade</h3>
          <ComingSoon height={130} note="Paid plans and subscription management — coming soon" />
        </div>
      </SettingsShell>
    </div>
  );
}