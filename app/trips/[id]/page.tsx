// app/trips/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { getForecast, getVariance, listAdhocExpenses } from '@/app/lib/services/expense-service';
import TopNav from '@/app/components/hub/TopNav';
import TripDetail from '@/app/components/hub/TripDetail';
import { getChecklistStats } from '@/app/lib/services/checklist-service';
import { getConfirmedFlightCount } from '@/app/lib/services/flight-service';

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

  const [forecast, variance, adhoc, checklistStats, flightsConfirmed] = await Promise.all([
    getForecast(ctx, tripId),
    getVariance(ctx, tripId),
    listAdhocExpenses(ctx, tripId),
    getChecklistStats(ctx, tripId),
    getConfirmedFlightCount(ctx, tripId),
  ]);

  const hubStats = {
    baseCurrency: forecast.base_currency,
    adhocTotal: adhoc.filter((e) => e.is_active).reduce((s, e) => s + e.estimated_amount_base, 0),
    forecastTotal: forecast.total_base,
    variance: variance.variance,
    hasActuals: variance.actual_total > 0,
    checklistTotal: checklistStats.total,
    checklistDone: checklistStats.done,
    checklistHighPending: checklistStats.highPending,
    flightsConfirmed,
  };

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="trips" />
      <TripDetail trip={trip} currencies={currencies} hubStats={hubStats} />
    </div>
  );
}