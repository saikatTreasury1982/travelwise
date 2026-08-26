'use client';

import Link from 'next/link';

interface ModuleCard { key: string; icon: string; title: string; hint: string; }

export interface HubStats {
  baseCurrency: string;
  adhocTotal: number;      // active ad-hoc total (base)
  forecastTotal: number;   // full forecast total (base)
  variance: number;        // actual − forecast (base)
  hasActuals: boolean;     // any actuals recorded
}

function money(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function TripHubCards({ tripId, travelerCount, stats }: { tripId: number; travelerCount: number; stats: HubStats }) {
  const { baseCurrency, adhocTotal, forecastTotal, variance, hasActuals } = stats;

  const MODULES: (ModuleCard & { stat: string; statColor?: string })[] = [
    { key: 'flights', icon: '✈️', title: 'Flights', hint: 'AI can suggest options', stat: 'Not started' },
    { key: 'lodging', icon: '🏨', title: 'Lodging', hint: 'AI can suggest stays', stat: 'Not started' },
    { key: 'itinerary', icon: '📅', title: 'Itinerary', hint: 'AI can generate a plan', stat: 'Not started' },
    { key: 'checklist', icon: '🧳', title: 'Checklist', hint: 'AI can build a list', stat: 'Not started' },
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
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-5" style={{ background: 'var(--panel)', color: 'var(--panel-ink)' }}>
        <span className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px]" style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>✦</span>
        <div className="flex-grow">
          <div className="text-[14px] font-semibold">Your planning co-pilot</div>
          <div className="text-[12.5px]" style={{ color: 'rgba(245,242,237,0.7)' }}>
            {travelerCount > 0 ? 'Ready to help plan flights, lodging, and your day-by-day itinerary.' : 'Add your travellers first — then I can help plan and split costs.'}
          </div>
        </div>
        <Link href="/plan" className="flex-shrink-0 h-[38px] px-4 rounded-[10px] font-bold text-[13px] flex items-center" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Plan with AI</Link>
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