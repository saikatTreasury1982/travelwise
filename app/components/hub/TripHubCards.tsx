'use client';

import Link from 'next/link';

interface ModuleCard { key: string; icon: string; title: string; hint: string; }

export interface HubStats {
  baseCurrency: string;
  tripBudget: number;
  adhocTotal: number;
  forecastTotal: number;
  variance: number;
  actualTotal: number;
  hasActuals: boolean;
  checklistTotal: number;
  checklistDone: number;
  checklistHighPending: number;
  flightsConfirmed: number;
  flightsShortlisted: number;
  lodgingConfirmed: number;
  lodgingShortlisted: number;
  itineraryActivities: number;
  itineraryConfirmed: number;
  itineraryHas: boolean;
}

function money(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function BudgetMeter({ budget, forecast, actual, hasActuals, ccy }: {
  budget: number; forecast: number; actual: number | null; hasActuals: boolean; ccy: string;
}) {
  const hasActual = hasActuals && actual != null;
  if (budget <= 0 && forecast <= 0) return null;

  // Scale ceiling: ~15% headroom above the max of the three, rounded up to a clean number.
  const maxVal = Math.max(budget, forecast, hasActual ? actual! : 0, 1);
  const rawCeil = maxVal * 1.15;
  const step = rawCeil > 20000 ? 5000 : rawCeil > 5000 ? 1000 : 500;
  const scale = Math.ceil(rawCeil / step) * step;
  const pos = (v: number) => Math.min(100, Math.max(0, (v / scale) * 100));

  const budgetPos = pos(budget);
  const forePos = pos(forecast);
  const actPos = hasActual ? pos(actual!) : 0;

  // Glow per dot: green if at/under budget, red if over.
  const glow = (v: number): string =>
    budget > 0 && v > budget
      ? '0 0 0 3px rgba(240,135,107,0.4), 0 0 9px 2px rgba(240,135,107,0.65)'
      : '0 0 0 3px rgba(127,224,168,0.35), 0 0 8px 2px rgba(127,224,168,0.55)';

  // Headline: actual (if present) vs forecast delta, else forecast.
  const headline = hasActual ? actual! : forecast;
  const overBudget = budget > 0 && headline > budget;
  const delta = hasActual ? actual! - forecast : 0;
  const overPlan = delta > 0.5, underPlan = delta < -0.5;
  const stripCcy = (n: number) => money(n, ccy).replace(`${ccy} `, '');

  const dotBase: React.CSSProperties = {
    position: 'absolute', top: 1, width: 12, height: 12, borderRadius: '50%',
    transform: 'translate(-50%,-50%)', border: '2px solid var(--panel)', zIndex: 3,
  };

  return (
    <div style={{ width: 300, flexShrink: 0 }}>
      {/* headline */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <span>
          <b style={{ fontSize: 15, fontWeight: 800, color: overBudget ? '#F0876B' : '#fff' }}>{money(headline, ccy)}</b>
          {hasActual && (overPlan || underPlan) && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, marginLeft: 7,
              background: overPlan ? 'rgba(240,135,107,0.22)' : 'rgba(127,224,168,0.22)',
              color: overPlan ? '#F0876B' : '#7FE0A8',
            }}>{overPlan ? '+' : '−'}{stripCcy(Math.abs(delta))} vs forecast</span>
          )}
        </span>
        <span style={{ fontSize: 11, color: 'rgba(245,242,237,0.55)' }}>
          {hasActual ? `of ${money(budget, ccy)}` : `forecast of ${money(budget, ccy)}`}
        </span>
      </div>

      {/* axis */}
      <div style={{ position: 'relative', height: 2, background: 'rgba(255,255,255,0.18)', borderRadius: 2, margin: '0 6px' }}>
        {budget > 0 && (
          <div style={{ position: 'absolute', top: -9, bottom: -9, width: 2, background: 'rgba(255,255,255,0.85)', zIndex: 1, left: `${budgetPos}%` }}>
            <span style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', fontSize: 8.5, color: 'rgba(245,242,237,0.7)', fontWeight: 700, whiteSpace: 'nowrap' }}>Budget</span>
          </div>
        )}
        <div style={{ ...dotBase, left: `${forePos}%`, background: 'var(--accent)', boxShadow: glow(forecast) }} />
        {hasActual && (
          <div style={{ ...dotBase, left: `${actPos}%`, background: '#5C9DE8', boxShadow: glow(actual!) }} />
        )}
      </div>

      {/* legend */}
      <div style={{ display: 'flex', gap: 14, marginTop: 16, justifyContent: 'center' }}>
        <span style={{ fontSize: 10, color: 'rgba(245,242,237,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <i style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} /> Forecast
        </span>
        {hasActual && (
          <span style={{ fontSize: 10, color: 'rgba(245,242,237,0.7)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <i style={{ width: 9, height: 9, borderRadius: '50%', background: '#5C9DE8', display: 'inline-block' }} /> Actual
          </span>
        )}
      </div>
    </div>
  );
}

export default function TripHubCards({ tripId, travelerCount, stats }: { tripId: number; travelerCount: number; stats: HubStats }) {
  const {
    baseCurrency,
    tripBudget,
    adhocTotal,
    forecastTotal,
    variance,
    actualTotal,
    hasActuals,
    checklistTotal,
    checklistDone,
    checklistHighPending,
    flightsConfirmed,
    flightsShortlisted,
    lodgingConfirmed,
    lodgingShortlisted,
    itineraryActivities,
    itineraryConfirmed,
    itineraryHas
  } = stats;

  const MODULES: (ModuleCard & { stat: string; statColor?: string })[] = [
    {
      key: 'flights', icon: '✈️', title: 'Flights',
      hint: flightsConfirmed > 0
        ? (flightsShortlisted > 0 ? `${flightsShortlisted} still being considered` : 'All flights confirmed')
        : flightsShortlisted > 0 ? 'Confirm one to add it to your forecast'
          : 'Upload a booking or let AI suggest',
      stat: (flightsConfirmed > 0 || flightsShortlisted > 0)
        ? `${flightsConfirmed} confirmed${flightsShortlisted > 0 ? ` · ${flightsShortlisted} shortlisted` : ''}`
        : 'Not started',
    },
    {
      key: 'lodging', icon: '🏨', title: 'Lodging',
      hint: lodgingConfirmed > 0
        ? (lodgingShortlisted > 0 ? `${lodgingShortlisted} still being considered` : 'All stays confirmed')
        : lodgingShortlisted > 0 ? 'Confirm one to add it to your forecast'
          : 'Let AI suggest or upload a booking',
      stat: (lodgingConfirmed > 0 || lodgingShortlisted > 0)
        ? `${lodgingConfirmed} confirmed${lodgingShortlisted > 0 ? ` · ${lodgingShortlisted} shortlisted` : ''}`
        : 'Not started',
    },
    {
      key: 'itinerary', icon: '🗺️', title: 'Itinerary',
      hint: !itineraryHas
        ? 'Plan day by day or let AI draft it'
        : itineraryConfirmed > 0
          ? `${itineraryActivities - itineraryConfirmed > 0 ? `${itineraryActivities - itineraryConfirmed} still being planned` : 'All days completed'}`
          : 'Complete a day to add it to your forecast',
      stat: itineraryHas
        ? (itineraryActivities > 0
          ? `${itineraryActivities} ${itineraryActivities === 1 ? 'activity' : 'activities'}${itineraryConfirmed > 0 ? ` · ${itineraryConfirmed} confirmed` : ''}`
          : 'Started')
        : 'Not started',
    },
    {
      key: 'checklist', icon: '🧳', title: 'Checklist',
      hint: checklistHighPending > 0 ? `${checklistHighPending} high-priority to pack` : 'AI can build a list',
      stat: checklistTotal > 0 ? `${checklistDone} / ${checklistTotal} done` : 'Not started'
    },
    {
      key: 'adhoc', icon: '🧮', title: 'Ad-hoc Expenses', hint: 'Extra costs outside modules',
      stat: adhocTotal > 0 ? money(adhocTotal, baseCurrency) : 'Not started'
    },
    {
      key: 'forecast', icon: '💰', title: 'Cost Forecast', hint: 'Aggregated from modules',
      stat: forecastTotal > 0 ? money(forecastTotal, baseCurrency) : '—'
    },
    {
      key: 'actuals', icon: '🧾', title: 'Actuals',
      hint: hasActuals ? (variance > 0.5 ? 'Variance · over budget' : variance < -0.5 ? 'Variance · under budget' : 'Variance · on budget') : 'Record spend & variance',
      stat: hasActuals ? `${variance > 0.5 ? '+' : ''}${money(variance, baseCurrency)}` : '—',
      statColor: hasActuals ? (variance > 0.5 ? 'var(--danger)' : variance < -0.5 ? 'var(--success)' : 'var(--ink)') : undefined
    },
  ];

  return (
    <section className="mt-10">
      <div className="flex items-center gap-4 rounded-2xl px-5 py-4 mb-5" style={{ background: 'var(--panel)', color: 'var(--panel-ink)' }}>
        <span className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px]" style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>✦</span>
        <div className="flex-grow min-w-0">
          <div className="text-[14px] font-semibold">Your planning co-pilot</div>
          <div className="text-[12.5px]" style={{ color: 'rgba(245,242,237,0.7)' }}>
            {travelerCount > 0 ? 'Plan flights, lodging, and your day-by-day itinerary — all in one place.' : 'Add your travellers first to start planning and splitting costs.'}
          </div>
        </div>
        {travelerCount > 0 && forecastTotal > 0 && (
          <BudgetMeter
            budget={tripBudget}
            forecast={forecastTotal}
            actual={hasActuals ? actualTotal : null}
            hasActuals={hasActuals}
            ccy={baseCurrency}
          />
        )}
      </div>

      <h2 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Plan this trip</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map((m) => (
          <Link key={m.key} href={`/trips/${tripId}/${m.key}`} className="block rounded-2xl p-4 transition-transform hover:-translate-y-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[15px]">{m.icon}</span>
              <span className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>{m.title}</span>
            </div>
            <div className="text-[15px] font-semibold" style={{ color: m.statColor ?? 'var(--ink)' }}>{m.stat}</div>
            <div className="text-[11.5px] mt-2 font-semibold flex items-center gap-1" style={{ color: 'var(--accent-deep)' }}>✦ {m.hint}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}