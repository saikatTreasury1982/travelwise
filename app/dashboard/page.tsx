// app/dashboard/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { listTripsWithDetails } from '@/app/lib/services/trip-service';
import TopNav from '@/app/components/hub/TopNav';
import CopilotHero from '@/app/components/hub/CopilotHero';
import TripCard from '@/app/components/hub/TripCard';

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
        <CopilotHero firstName={firstName} />

        <section className="mb-8">
          <div className="flex items-baseline justify-between mb-3.5">
            <span className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Upcoming trips</span>
            <a href="/trips" className="text-[13px] font-semibold" style={{ color: 'var(--ink-soft)' }}>See all</a>
          </div>
          {upcoming.length === 0 ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
              <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>No trips yet.</p>
              <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Describe a trip above and let the co-pilot plan it.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {upcoming.map((t) => <TripCard key={t.trip_id} trip={t} />)}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}