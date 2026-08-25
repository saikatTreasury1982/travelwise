// app/account/passkeys/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { listUserPasskeys } from '@/app/lib/services/passkey-service';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { ACCOUNT_NAV } from '@/app/components/settings/nav';
import PasskeyManager from '@/app/components/settings/PasskeyManager';

export const dynamic = 'force-dynamic';

export default async function PasskeysPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string; email: string }>(`SELECT first_name, email FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  const firstName = users[0]?.first_name ?? 'traveller';
  const email = users[0]?.email ?? '';
  const passkeys = await listUserPasskeys(ctx.userId);

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} />
      <SettingsShell title="Account" subNav={ACCOUNT_NAV} active="passkeys">
        <PasskeyManager initial={passkeys} email={email} />
      </SettingsShell>
    </div>
  );
}