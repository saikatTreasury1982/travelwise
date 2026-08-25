// app/trips/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getTripDetail } from '@/app/lib/services/trip-service';
import TopNav from '@/app/components/hub/TopNav';
import TripDetail from '@/app/components/hub/TripDetail';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  const trip = await getTripDetail(ctx, tripId);
  if (!trip) notFound();

  const currencies = (await rawQuery(
    `SELECT currency_code, currency_name, currency_symbol FROM currencies ORDER BY currency_code`
  )).map((c) => ({
    currency_code: String(c.currency_code),
    currency_name: String(c.currency_name),
    currency_symbol: c.currency_symbol == null ? null : String(c.currency_symbol),
  }));

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="trips" />
      <TripDetail trip={trip} currencies={currencies} />
    </div>
  );
}