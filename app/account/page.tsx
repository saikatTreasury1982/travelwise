// app/account/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { userHasPassword } from '@/app/lib/services/password-service';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { ACCOUNT_NAV } from '@/app/components/settings/nav';
import PasswordForm from '@/app/components/settings/PasswordForm';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(`SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  const firstName = users[0]?.first_name ?? 'traveller';
  const hasPassword = await userHasPassword(ctx.userId);

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} />
      <SettingsShell title="Account" subNav={ACCOUNT_NAV} active="password">
        <PasswordForm hasPassword={hasPassword} />
      </SettingsShell>
    </div>
  );
}