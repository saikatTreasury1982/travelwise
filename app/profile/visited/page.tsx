import { requireUserContext } from '@/app/lib/auth/context';
import { getProfile } from '@/app/lib/services/user-service';
import TopNav from '@/app/components/hub/TopNav';
import SettingsShell from '@/app/components/settings/SettingsShell';
import { PROFILE_NAV } from '@/app/components/profile/profileNav';
import ComingSoon from '@/app/components/hub/ComingSoon';

export const dynamic = 'force-dynamic';

export default async function VisitedPlacesPage() {
  const ctx = await requireUserContext();
  const profile = await getProfile(ctx);
  const firstName = profile?.first_name ?? 'there';
  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="profile" />
      <SettingsShell title="Profile" subNav={PROFILE_NAV} active="visited">
        <ComingSoon height={260} note="An interactive map to pin every place you've been — shared with your home hub." />
      </SettingsShell>
    </div>
  );
}