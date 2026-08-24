// app/settings/preferences/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getPreferences } from '@/app/lib/services/preferences-service';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { SETTINGS_NAV } from '@/app/components/settings/nav';
import PreferencesForm from '@/app/components/settings/PreferencesForm';

export const dynamic = 'force-dynamic';

export default async function PreferencesPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(`SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  const firstName = users[0]?.first_name ?? 'traveller';
  const preferences = await getPreferences(ctx);

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} />
      <SettingsShell title="Settings" subNav={SETTINGS_NAV} active="preferences">
        <PreferencesForm initial={preferences} />
      </SettingsShell>
    </div>
  );
}