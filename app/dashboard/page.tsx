// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { listTripsWithDetails } from '@/app/lib/services/trip-service';
import TopNav from '@/app/components/hub/TopNav';
import CopilotHero from '@/app/components/hub/CopilotHero';
import TripCard from '@/app/components/hub/TripCard';
import ComingSoon from '@/app/components/hub/ComingSoon';

export const dynamic = 'force-dynamic';

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3.5">
      <span className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>{children}</span>
      {action}
    </div>
  );
}

export default async function DashboardPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  const trips = await listTripsWithDetails(ctx);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = trips.filter((t) => t.end_date >= today).slice(0, 4);

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="home" />

      <div className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
        {/* CO-PILOT HERO */}
        <CopilotHero firstName={firstName} />

        {/* UPCOMING TRIPS + TRAVEL-MAP STATS */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 mb-9">
          <div>
            <SectionLabel action={<a href="/trips" className="text-[13px] font-semibold" style={{ color: 'var(--ink-soft)' }}>See all</a>}>Upcoming trips</SectionLabel>
            {upcoming.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
                <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>No trips yet.</p>
                <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Describe a trip above and let the co-pilot plan it.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {upcoming.map((t) => <TripCard key={t.trip_id} trip={t} />)}
              </div>
            )}
          </div>

          {/* travel-map stats — placeholder */}
          <div>
            <SectionLabel>Your travel map</SectionLabel>
            <ComingSoon height={210} note="Countries & cities visited, explorer badges" />
          </div>
        </div>

        {/* PLACES YOU'VE BEEN — placeholder */}
        <div className="mb-9">
          <SectionLabel action={<span className="text-[13px] font-semibold" style={{ color: 'var(--ink-faint)' }}>Add a place</span>}>Places you&apos;ve been</SectionLabel>
          <ComingSoon height={300} note="An interactive world map — drop pins on places you've visited" />
        </div>

        {/* EXPLORE DESTINATIONS — placeholder */}
        <div className="mb-9">
          <SectionLabel action={<span className="text-[13px] font-semibold" style={{ color: 'var(--ink-faint)' }}>See all</span>}>Explore popular destinations</SectionLabel>
          <ComingSoon height={180} note="Curated destinations with typical budgets" />
        </div>

        {/* GUIDES & JOURNALS + RECENTLY VIEWED — placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
          <div>
            <SectionLabel action={<span className="text-[13px] font-semibold" style={{ color: 'var(--ink-faint)' }}>Browse all</span>}>Guides &amp; journals</SectionLabel>
            <ComingSoon height={170} note="Travel guides and your trip journals" />
          </div>
          <div>
            <SectionLabel>Recently viewed</SectionLabel>
            <ComingSoon height={170} note="Trips, guides and destinations you've opened" />
          </div>
        </div>
      </div>
    </div>
  );
}