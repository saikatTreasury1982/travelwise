// app/trips/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { listTripsWithDetails } from '@/app/lib/services/trip-service';
import TopNav from '@/app/components/hub/TopNav';
import TripCard from '@/app/components/hub/TripCard';
import CopilotHero from '@/app/components/hub/CopilotHero';

export const dynamic = 'force-dynamic';

export default async function TripsPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(`SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  const firstName = users[0]?.first_name ?? 'traveller';
  const trips = await listTripsWithDetails(ctx);

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="trips" />
      <div className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
        {/* Co-pilot hero — full width at the top */}
        <CopilotHero firstName={firstName} />

        {/* Trips section below the hero */}
        <div className="flex items-center justify-between mt-10 mb-6">
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>My Trips</h1>
        </div>

        {trips.length === 0 ? (
          <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--ink)' }}>No trips yet.</p>
            <p className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Describe a trip and let the co-pilot plan it.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {trips.map((t) => <TripCard key={t.trip_id} trip={t} />)}
          </div>
        )}
      </div>
    </div>
  );
}