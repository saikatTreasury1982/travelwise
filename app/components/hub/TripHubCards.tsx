'use client';

import Link from 'next/link';

interface ModuleCard {
  key: string; icon: string; title: string; stat: string; hint: string;
}

export default function TripHubCards({ tripId, travelerCount }: { tripId: number; travelerCount: number }) {
  const MODULES: ModuleCard[] = [
    { key: 'flights', icon: '✈️', title: 'Flights', stat: 'Not started', hint: 'AI can suggest options' },
    { key: 'lodging', icon: '🏨', title: 'Lodging', stat: 'Not started', hint: 'AI can suggest stays' },
    { key: 'itinerary', icon: '📅', title: 'Itinerary', stat: 'Not started', hint: 'AI can generate a plan' },
    { key: 'checklist', icon: '🧳', title: 'Checklist', stat: 'Not started', hint: 'AI can build a list' },
    { key: 'adhoc', icon: '🧮', title: 'Ad-hoc Expenses', stat: 'Not started', hint: 'Extra costs outside modules' },
    { key: 'forecast', icon: '💰', title: 'Cost Forecast', stat: '—', hint: 'Aggregated from modules' },
    { key: 'actuals', icon: '🧾', title: 'Actuals', stat: '—', hint: 'Record spend & variance' },
  ];

  return (
    <section className="mt-10">
      {/* AI suggestion strip (placeholder — wired to real suggestions as modules land) */}
      <div className="flex items-center gap-3 rounded-2xl px-4 py-3 mb-5"
        style={{ background: 'var(--panel)', color: 'var(--panel-ink)' }}>
        <span className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px]"
          style={{ background: 'color-mix(in srgb, var(--accent) 30%, transparent)' }}>✦</span>
        <div className="flex-grow">
          <div className="text-[14px] font-semibold">Your planning co-pilot</div>
          <div className="text-[12.5px]" style={{ color: 'rgba(245,242,237,0.7)' }}>
            {travelerCount > 0
              ? 'Ready to help plan flights, lodging, and your day-by-day itinerary.'
              : 'Add your travellers first — then I can help plan and split costs.'}
          </div>
        </div>
        <Link href="/plan" className="flex-shrink-0 h-[38px] px-4 rounded-[10px] font-bold text-[13px] flex items-center"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
          Plan with AI
        </Link>
      </div>

      <h2 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Plan this trip</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {MODULES.map((m) => (
          <Link key={m.key} href={`/trips/${tripId}/${m.key}`}
            className="block rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[15px]">{m.icon}</span>
              <span className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>{m.title}</span>
            </div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{m.stat}</div>
            <div className="text-[11.5px] mt-2 font-semibold flex items-center gap-1" style={{ color: 'var(--accent-deep)' }}>
              ✦ {m.hint}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}