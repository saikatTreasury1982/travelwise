// app/settings/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { SETTINGS_NAV } from '@/app/components/settings/nav';
import { ThemePicker } from '@/app/components/ui/ThemePicker';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} />
      <SettingsShell title="Settings" subNav={SETTINGS_NAV} active="appearance">
        <div>
          <h2 className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Appearance</h2>
          <p className="text-[14px] mb-5" style={{ color: 'var(--ink-soft)' }}>Choose how Travelwise looks. Your choice is saved to this device.</p>
          <div className="max-w-[520px]">
            <ThemePicker />
          </div>
        </div>
      </SettingsShell>
    </div>
  );
}