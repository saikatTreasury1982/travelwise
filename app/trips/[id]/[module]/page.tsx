import { redirect, notFound } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getTripDetail } from '@/app/lib/services/trip-service';
import TopNav from '@/app/components/hub/TopNav';
import Link from 'next/link';
import { getForecast, listAdhocExpenses, getEligibleBearers, getTripBaseCurrency } from '@/app/lib/services/expense-service';
import ForecastView from '@/app/components/hub/ForecastView';
import AdhocExpenses from '@/app/components/hub/AdhocExpenses';
import { listActuals, getVariance } from '@/app/lib/services/expense-service';
import ActualsView from '@/app/components/hub/ActualsView';

export const dynamic = 'force-dynamic';

const MODULES: Record<string, { title: string; blurb: string }> = {
  flights: { title: 'Flights', blurb: 'Flight options and bookings for this trip.' },
  lodging: { title: 'Lodging', blurb: 'Accommodation options and bookings.' },
  itinerary: { title: 'Itinerary', blurb: 'Your day-by-day plan.' },
  checklist: { title: 'Checklist', blurb: 'Packing list and pre-trip tasks.' },
  adhoc: { title: 'Ad-hoc Expenses', blurb: 'Extra or ad-hoc costs not tied to flights, lodging, or itinerary.' },
  forecast: { title: 'Cost Forecast', blurb: 'Estimated cost across all modules, split by traveller.' },
  actuals: { title: 'Actuals', blurb: 'Record real spend and see variance vs forecast.' },
};

export default async function TripModulePage({ params }: { params: Promise<{ id: string; module: string }> }) {
  const { id, module } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();
  const meta = MODULES[module];
  if (!meta) notFound();

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

  // Real module: Ad-hoc Expenses
  if (module === 'adhoc') {
    const [expenses, eligibleBearers, baseCurrency] = await Promise.all([
      listAdhocExpenses(ctx, tripId),
      getEligibleBearers(ctx, tripId),
      getTripBaseCurrency(ctx, tripId),
    ]);
    return (
      <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
        <TopNav firstName={firstName} active="trips" />
        <div className="px-6 md:px-10 py-8 max-w-[900px] mx-auto">
          <Link href={`/trips/${tripId}`} className="text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to {trip.trip_name}
          </Link>
          <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>Ad-hoc Expenses</h1>
          <p className="text-[14px] mb-6" style={{ color: 'var(--ink-soft)' }}>Extra costs outside flights, lodging, and itinerary.</p>
          <AdhocExpenses tripId={tripId} baseCurrency={baseCurrency} currencies={currencies}
            initialExpenses={expenses} eligibleBearers={eligibleBearers} />
        </div>
      </div>
    );
  }

  // Real module: Cost Forecast
  if (module === 'forecast') {
    const forecast = await getForecast(ctx, tripId);
    return (
      <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
        <TopNav firstName={firstName} active="trips" />
        <div className="px-6 md:px-10 py-8 max-w-[900px] mx-auto">
          <Link href={`/trips/${tripId}`} className="text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to {trip.trip_name}
          </Link>
          <h1 className="mb-6" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>Cost Forecast</h1>
          <ForecastView forecast={forecast} />
        </div>
      </div>
    );
  }

  // Real module: Actuals & Variance
  if (module === 'actuals') {
    const [{ base_currency, items }, variance] = await Promise.all([
      listActuals(ctx, tripId),
      getVariance(ctx, tripId),
    ]);
    return (
      <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
        <TopNav firstName={firstName} active="trips" />
        <div className="px-6 md:px-10 py-8 max-w-[900px] mx-auto">
          <Link href={`/trips/${tripId}`} className="text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to {trip.trip_name}
          </Link>
          <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>Actuals &amp; Variance</h1>
          <p className="text-[14px] mb-6" style={{ color: 'var(--ink-soft)' }}>Record what was actually paid, per traveller, and see how it compares to your forecast.</p>
          <ActualsView tripId={tripId} baseCurrency={base_currency} initialItems={items} initialVariance={variance} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="trips" />
      <div className="px-6 md:px-10 py-8 max-w-[900px] mx-auto">
        <Link href={`/trips/${tripId}`} className="text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Back to {trip.trip_name}
        </Link>
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>{meta.title}</h1>
        <p className="text-[14px] mb-8" style={{ color: 'var(--ink-soft)' }}>{meta.blurb}</p>
        <div className="rounded-2xl flex flex-col items-center justify-center text-center px-6 py-16"
          style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 10 }}>
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
          </svg>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--ink-soft)' }}>Coming soon</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ink-faint)' }}>This module is being built. It’ll appear here.</p>
        </div>
      </div>
    </div>
  );
}