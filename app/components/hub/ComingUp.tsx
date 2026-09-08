// app/components/hub/ComingUp.tsx
'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';

interface TripLite {
  trip_id: number;
  trip_name: string;
  start_date: string;
  end_date: string;
  status_code: number;                 // 1 Draft · 2 Active · 3 Completed · 4 Suspended
  trip_budget: number | null;
  budget_currency: string | null;
  cover_image_url?: string | null;
  destinations: Array<{ city: string | null; country: string }>;
  travelers: Array<{ traveler_id: number }>;
}

const WINDOWS = [
  { key: 7, label: '7 days' },
  { key: 14, label: '14 days' },
  { key: 30, label: '30 days' },
  { key: 90, label: '3 months' },
];
const DEFAULT_WINDOW = 90;

function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function parseD(s: string) { const d = new Date(s + 'T00:00:00'); return isNaN(d.getTime()) ? null : d; }

export default function ComingUp({ trips }: { trips: TripLite[] }) {
  const [win, setWin] = useState(DEFAULT_WINDOW);
  const today = startOfToday();

  // ── Coming up: ACTIVE trips only ──
  const { active, upcoming } = useMemo(() => {
    const active: TripLite[] = [];      // happening now (today within dates)
    const upcoming: (TripLite & { inDays: number })[] = [];
    for (const t of trips) {
      if (t.status_code !== 2) continue; // Active only
      const s = parseD(t.start_date), e = parseD(t.end_date);
      if (!s || !e) continue;
      if (s <= today && today <= e) { active.push(t); continue; }
      if (s > today) upcoming.push({ ...t, inDays: daysBetween(today, s) });
    }
    upcoming.sort((a, b) => a.inDays - b.inDays);
    return { active, upcoming };
  }, [trips, today]);

  const inWindow = upcoming.filter((t) => t.inDays <= win);
  const featured = [...active.map((t) => ({ ...t, inDays: -1 })), ...inWindow].slice(0, 2);

  // ── Ready to continue: DRAFT trips, most-recent first ──
  const drafts = useMemo(
    () => trips.filter((t) => t.status_code === 1),  // already ordered by start_date/created desc from the query
    [trips],
  );

  return (
    <>
      <section className="mt-10">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Coming up</h2>
          <div className="ml-auto flex gap-1.5">
            {WINDOWS.map((w) => (
              <button key={w.key} onClick={() => setWin(w.key)}
                className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
                style={{
                  background: win === w.key ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'var(--surface)',
                  color: win === w.key ? 'var(--accent-deep)' : 'var(--ink-soft)',
                  border: `1px solid ${win === w.key ? 'transparent' : 'var(--border)'}`, cursor: 'pointer',
                }}>
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {featured.length === 0 ? (
          <div className="rounded-2xl p-6 text-center text-[13px]" style={{ border: '1.5px dashed var(--border)', color: 'var(--ink-soft)' }}>
            Nothing in the next {WINDOWS.find((w) => w.key === win)?.label ?? 'window'} — your trips are below.
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {featured.map((t) => <FeatureCard key={t.trip_id} trip={t} now={t.inDays === -1} />)}
          </div>
        )}
      </section>

      {drafts.length > 0 && (
        <section className="mt-11">
          <h2 className="text-xs font-bold uppercase mb-4" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Ready to continue</h2>
          <div className="flex flex-col gap-2.5">
            {drafts.map((t) => <DraftRow key={t.trip_id} trip={t} />)}
          </div>
        </section>
      )}
    </>
  );
}

function money(n: number | null, ccy: string | null) {
  if (n == null) return null;
  return `${ccy ?? ''} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`.trim();
}
function fmtDate(s: string) { try { return new Date(s + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; } }

function FeatureCard({ trip, now }: { trip: TripLite & { inDays: number }; now: boolean }) {
  const places = trip.destinations.map((d) => d.city || d.country).filter(Boolean).join(' · ');
  const pax = trip.travelers?.length ?? 0;
  const budgetStr = money(trip.trip_budget, trip.budget_currency);
  const base = `/trips/${trip.trip_id}`;
  const badge = now
    ? { text: '● Happening now', bg: 'var(--success)', fg: '#fff' }
    : { text: trip.inDays === 0 ? 'Starts today' : `In ${trip.inDays} day${trip.inDays === 1 ? '' : 's'}`, bg: 'var(--accent)', fg: 'var(--accent-ink)' };

  return (
    <div className="rounded-[18px] overflow-hidden flex flex-col sm:flex-row" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="relative sm:w-[40%] sm:min-h-[200px] h-[150px] flex-shrink-0"
        style={{
          backgroundImage: trip.cover_image_url
            ? `linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.4)), url("${trip.cover_image_url}")`
            : 'linear-gradient(135deg, #c98a4a, var(--accent))',
          backgroundSize: 'cover', backgroundPosition: 'center',
        }}>
        <span className="absolute top-3.5 left-3.5 text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: badge.bg, color: badge.fg }}>{badge.text}</span>
      </div>
      <div className="flex-1 p-5 flex flex-col">
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 23, lineHeight: 1.1, color: 'var(--ink)' }}>{trip.trip_name}</div>
        <div className="text-[12.5px] mt-1.5" style={{ color: 'var(--ink-soft)' }}>
          {now ? 'Now' : `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`}{places ? ` · ${places}` : ''}{pax ? ` · ${pax} traveller${pax === 1 ? '' : 's'}` : ''}
        </div>
        {budgetStr && <div className="mt-4 text-[12px]" style={{ color: 'var(--ink-faint)' }}>Budget <b style={{ color: 'var(--ink)' }}>{budgetStr}</b></div>}
        <div className="flex gap-2 mt-auto pt-4 flex-wrap">
          <Link href={base} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Open trip →</Link>
          {now ? (
            <>
              <Link href={`${base}/actuals`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: 'var(--canvas)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>🧾 Log an expense</Link>
              <Link href={`${base}/itinerary`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: 'var(--canvas)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>🗺️ Today's plan</Link>
            </>
          ) : (
            <>
              <Link href={`${base}/itinerary`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: 'var(--canvas)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>🗺️ Itinerary</Link>
              <Link href={`${base}/checklist`} className="text-[12px] font-semibold px-3.5 py-2 rounded-lg" style={{ background: 'var(--canvas)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>🧳 Checklist</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DraftRow({ trip }: { trip: TripLite }) {
  const places = trip.destinations.map((d) => d.city || d.country).filter(Boolean).join(', ');
  return (
    <Link href={`/trips/${trip.trip_id}`}
      className="flex items-center gap-3 rounded-xl px-4 py-3 transition-transform hover:-translate-y-0.5"
      style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
      <span className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[14px]" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-soft)' }}>✎</span>
      <div className="flex-grow min-w-0">
        <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{trip.trip_name}</div>
        <div className="text-[12px] truncate" style={{ color: 'var(--ink-faint)' }}>
          Draft{places ? ` · ${places}` : ''}{trip.start_date ? ` · ${fmtDate(trip.start_date)}` : ''}
        </div>
      </div>
      <span className="text-[12px] font-semibold flex-shrink-0" style={{ color: 'var(--accent-deep)' }}>Continue →</span>
    </Link>
  );
}