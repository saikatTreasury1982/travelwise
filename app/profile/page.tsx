import { requireUserContext } from '@/app/lib/auth/context';
import { getProfile } from '@/app/lib/services/user-service';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { PROFILE_NAV } from '@/app/components/profile/profileNav';
import ProfileDetailsForm, { type ProfileData } from '@/app/components/profile/ProfileDetailsForm';
import { listCurrencies, listCountries } from '@/app/lib/services/reference-service';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const ctx = await requireUserContext();
  const profile = await getProfile(ctx);

  // Reference lists (global tables — not tenant-scoped).
  const countries = await listCountries();

  const currencies = await listCurrencies();

  const initial: ProfileData = {
    user_id: profile?.user_id ?? ctx.userId,
    email: profile?.email ?? null,
    first_name: profile?.first_name ?? null,
    middle_name: profile?.middle_name ?? null,
    last_name: profile?.last_name ?? null,
    resident_country: profile?.resident_country ?? null,
    home_currency: profile?.home_currency ?? null,
  };

  const firstName = profile?.first_name ?? 'there';

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="profile" />
      <SettingsShell title="Profile" subNav={PROFILE_NAV} active="details">
        <ProfileDetailsForm initial={initial} countries={countries} currencies={currencies} />
      </SettingsShell>
    </div>
  );
}