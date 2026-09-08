// app/trips/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { getForecast, getVariance, listAdhocExpenses } from '@/app/lib/services/expense-service';
import TopNav from '@/app/components/hub/TopNav';
import TripDetail from '@/app/components/hub/TripDetail';
import { getChecklistStats } from '@/app/lib/services/checklist-service';
import { getFlightCounts } from '@/app/lib/services/flight-service';
import { getLodgingCounts } from '@/app/lib/services/lodging-service';
import { getItineraryCounts } from '@/app/lib/services/itinerary-service';
import { hasFeatureInterest } from '@/app/lib/services/feature-interest-service';
import { getProfile } from '@/app/lib/services/user-service';
import { listCurrencies } from '@/app/lib/services/reference-service';

export default async function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tripId = Number(id);
  if (!Number.isFinite(tripId)) notFound();

  const ctx = await getUserContext();
  if (!ctx) redirect('/login');

  const profile = await getProfile(ctx);
  const firstName = profile?.first_name ?? 'traveller';

  const trip = await getTripDetail(ctx, tripId);

  const climateInterested = await hasFeatureInterest(ctx, 'climate_insights');

  if (!trip) notFound();

  const currencies = await listCurrencies();

  const [forecast, variance, adhoc, checklistStats, flightCounts, lodgingCounts, itineraryCounts,] = await Promise.all([
    getForecast(ctx, tripId),
    getVariance(ctx, tripId),
    listAdhocExpenses(ctx, tripId),
    getChecklistStats(ctx, tripId),
    getFlightCounts(ctx, tripId),
    getLodgingCounts(ctx, tripId),
    getItineraryCounts(ctx, tripId),
  ]);

  const hubStats = {
    baseCurrency: forecast.base_currency,
    tripBudget: trip.trip_budget ?? 0,
    adhocTotal: adhoc.filter((e) => e.is_active).reduce((s, e) => s + e.estimated_amount_base, 0),
    forecastTotal: forecast.total_base,
    variance: variance.variance,
    actualTotal: variance.actual_total,
    hasActuals: variance.actual_total > 0,
    checklistTotal: checklistStats.total,
    checklistDone: checklistStats.done,
    checklistHighPending: checklistStats.highPending,
    flightsConfirmed: flightCounts.confirmed,
    flightsShortlisted: flightCounts.shortlisted,
    lodgingConfirmed: lodgingCounts.confirmed,
    lodgingShortlisted: lodgingCounts.shortlisted,
    itineraryActivities: itineraryCounts.activityCount,
    itineraryConfirmed: itineraryCounts.confirmedActivityCount,
    itineraryHas: itineraryCounts.hasItinerary,
  };

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="trips" />
      <TripDetail trip={trip} currencies={currencies} hubStats={hubStats} climateInterested={climateInterested} />
    </div>
  );
}