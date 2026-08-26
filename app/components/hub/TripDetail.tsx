// app/components/hub/TripDetail.tsx
'use client';
import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import TravelersSection from '@/app/components/hub/TravelersSection';
import DestinationSearch, { type GeoPick } from '@/app/components/ui/DestinationSearch';
import TripHubCards, { type HubStats } from '@/app/components/hub/TripHubCards';

interface Trip {
  trip_id: number; trip_name: string; trip_description: string | null;
  start_date: string; end_date: string; status_code: number | null;
  trip_budget: number | null; budget_currency: string | null;
  destinations: Array<{ destination_id: number; country: string; city: string | null }>;
  travelers: Array<{
    traveler_id: number; traveler_name: string; relationship: number | null;
    relationship_name: string | null; is_primary: number; is_cost_sharer: number; is_active: number;
    traveler_email: string | null; traveler_currency: string | null;
  }>;
}

interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }

function fmt(d: string) {
  try { return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}
function nights(a: string, b: string) {
  try { return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000); } catch { return 0; }
}

const STATUS_LABELS: Record<number, string> = { 1: 'Draft', 2: 'Planned', 3: 'Active', 4: 'Completed' };

function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.18s' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default function TripDetail({ trip: initial, currencies, hubStats }: { trip: Trip; currencies: Currency[]; hubStats: HubStats }) {
  const router = useRouter();
  const [trip, setTrip] = useState(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // collapse state (default collapsed)
  const [destOpen, setDestOpen] = useState(false);
  const [travOpen, setTravOpen] = useState(false);
  const travRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(trip.trip_name);
  const [start, setStart] = useState(trip.start_date);
  const [end, setEnd] = useState(trip.end_date);
  const [budget, setBudget] = useState(trip.trip_budget?.toString() ?? '');

  const [addingDest, setAddingDest] = useState(false);
  const [destBusy, setDestBusy] = useState(false);

  function openTravellers() {
    setTravOpen(true);
    setTimeout(() => travRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  async function addDestination(pick: { country: string; city: string | null; latitude?: number | null; longitude?: number | null }) {
    setError('');
    const tempId = -Date.now();
    const optimistic = { destination_id: tempId, country: pick.country, city: pick.city };
    setTrip((t) => ({ ...t, destinations: [...t.destinations, optimistic] }));
    setAddingDest(false);
    try {
      const res = await fetch(`/api/trips/${trip.trip_id}/destinations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country: pick.country, city: pick.city, latitude: pick.latitude, longitude: pick.longitude }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add destination.');
      const d = await res.json();
      setTrip((t) => ({ ...t, destinations: d.destinations }));
      router.refresh();
    } catch (err) {
      setTrip((t) => ({ ...t, destinations: t.destinations.filter((x) => x.destination_id !== tempId) }));
      setError(err instanceof Error ? err.message : 'Could not add destination.');
    }
  }

  async function removeDestination(destId: number) {
    setDestBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${trip.trip_id}/destinations/${destId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not remove.');
      const d = await res.json();
      setTrip((t) => ({ ...t, destinations: d.destinations }));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove.'); }
    finally { setDestBusy(false); }
  }

  async function save(fields: Record<string, unknown>, optimistic: Partial<Trip>) {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/trips/${trip.trip_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Update failed'); }
      setTrip((t) => ({ ...t, ...optimistic }));
      setEditing(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const places = trip.destinations.map((d) => d.city || d.country).filter(Boolean).join(' · ');
  const travNames = trip.travelers.map((t) => t.traveler_name.split(' ')[0]).join(', ');
  const inputStyle = { background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--ink)', borderRadius: 10, padding: '8px 12px', fontSize: 15, outline: 'none' } as React.CSSProperties;
  const editHint = { cursor: 'pointer' } as React.CSSProperties;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[900px] mx-auto">
      <Link href="/trips" className="text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        All trips
      </Link>

      {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>{error}</div>}

      {/* name — click to edit */}
      <div className="flex items-start justify-between gap-4 mb-2">
        {editing === 'name' ? (
          <div className="flex gap-2 items-center flex-grow">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus style={{ ...inputStyle, fontSize: 28, fontFamily: 'var(--font-display)', flexGrow: 1 }} />
            <button onClick={() => save({ name }, { trip_name: name })} disabled={saving} className="text-sm font-semibold px-3 py-2 rounded-lg" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>Save</button>
            <button onClick={() => { setName(trip.trip_name); setEditing(null); }} className="text-sm px-3 py-2" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
          </div>
        ) : (
          <h1 onClick={() => setEditing('name')} style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4vw,42px)', lineHeight: 1.05, color: 'var(--ink)', ...editHint }} title="Click to edit">{trip.trip_name}</h1>
        )}
        <span className="text-[12px] font-semibold px-3 py-1 rounded-full flex-shrink-0 mt-2" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-soft)' }}>{STATUS_LABELS[trip.status_code ?? 1] ?? 'Draft'}</span>
      </div>
      {places && <p className="text-[15px] mb-6" style={{ color: 'var(--ink-soft)' }}>{places}</p>}

      {/* key facts */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {/* dates */}
        <div className="rounded-xl p-4 md:col-span-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px] mb-1" style={{ color: 'var(--ink-faint)' }}>Dates</div>
          {editing === 'dates' ? (
            <div className="flex flex-col gap-2 mt-1">
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
              <div className="flex gap-2">
                <button onClick={() => save({ startDate: start, endDate: end }, { start_date: start, end_date: end })} disabled={saving} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>Save</button>
                <button onClick={() => { setStart(trip.start_date); setEnd(trip.end_date); setEditing(null); }} className="text-sm px-3 py-1.5" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div onClick={() => setEditing('dates')} style={editHint} title="Click to edit">
              <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{fmt(trip.start_date)}</div>
              <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>to {fmt(trip.end_date)} · {nights(trip.start_date, trip.end_date)} nights</div>
            </div>
          )}
        </div>

        {/* budget */}
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px] mb-1" style={{ color: 'var(--ink-faint)' }}>Budget</div>
          {editing === 'budget' ? (
            <div className="flex flex-col gap-2 mt-1">
              <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} autoFocus style={inputStyle} />
              <div className="flex gap-2">
                <button onClick={() => { const b = budget === '' ? null : Number(budget); save({ budget: b }, { trip_budget: b }); }} disabled={saving} className="text-sm font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>Save</button>
                <button onClick={() => { setBudget(trip.trip_budget?.toString() ?? ''); setEditing(null); }} className="text-sm px-3 py-1.5" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div onClick={() => setEditing('budget')} style={editHint} title="Click to edit" className="text-[20px] font-bold">
              <span style={{ color: 'var(--ink)' }}>{trip.trip_budget != null ? `${trip.budget_currency ?? ''} ${trip.trip_budget.toLocaleString()}` : 'Set budget'}</span>
            </div>
          )}
        </div>

        {/* travellers — clickable chip that expands the Who's going section */}
        <div onClick={openTravellers} className="rounded-xl p-4 relative transition-colors"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', cursor: 'pointer' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
          title="Click to manage travellers">
          <div className="absolute top-3 right-3" style={{ color: 'var(--ink-faint)' }}><Chevron open={travOpen} /></div>
          <div className="text-[12px] mb-1" style={{ color: 'var(--ink-faint)' }}>Travellers</div>
          <div className="text-[20px] font-bold" style={{ color: 'var(--ink)' }}>{trip.travelers.length || '—'}</div>
          <div className="text-[11px] font-semibold mt-1" style={{ color: 'var(--accent-deep)' }}>Click to manage</div>
        </div>
      </div>

      {/* destinations — collapsible */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setDestOpen((o) => !o)} className="flex items-center gap-2 text-left">
            <span style={{ color: 'var(--ink-faint)' }}><Chevron open={destOpen} /></span>
            <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Destinations</h2>
            {!destOpen && (
              <span className="text-[12px] truncate max-w-[380px]" style={{ color: 'var(--ink-faint)' }}>
                {trip.destinations.length === 0 ? '· none yet' : `· ${trip.destinations.length} · ${places}`}
              </span>
            )}
          </button>
          {destOpen && !addingDest && (
            <button onClick={() => setAddingDest(true)} className="text-[13px] font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
              + Add destination
            </button>
          )}
        </div>

        {destOpen && (
          <>
            {trip.destinations.length === 0 ? (
              <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>No destinations added.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {trip.destinations.map((d) => (
                  <div key={d.destination_id} className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                    <span className="flex-grow text-[15px] font-medium" style={{ color: 'var(--ink)' }}>{d.city ? `${d.city}, ${d.country}` : d.country}</span>
                    <button onClick={() => removeDestination(d.destination_id)} disabled={destBusy}
                      className="text-[12px] px-2.5 py-1 rounded-md flex-shrink-0" style={{ color: 'var(--danger)' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            {addingDest && (
              <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                <DestinationSearch onPick={addDestination} />
                <div className="mt-3">
                  <button onClick={() => setAddingDest(false)} className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* travellers — collapsible */}
      <section className="mb-8" ref={travRef}>
        <div className="flex items-center mb-3">
          <button onClick={() => setTravOpen((o) => !o)} className="flex items-center gap-2 text-left">
            <span style={{ color: 'var(--ink-faint)' }}><Chevron open={travOpen} /></span>
            <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Who's going</h2>
            {!travOpen && (
              <span className="text-[12px] truncate max-w-[420px]" style={{ color: 'var(--ink-faint)' }}>
                {trip.travelers.length === 0 ? '· none yet' : `· ${trip.travelers.length} · ${travNames}`}
              </span>
            )}
          </button>
        </div>
        {travOpen && (
          <TravelersSection tripId={trip.trip_id} travelers={trip.travelers} currencies={currencies} />
        )}
      </section>

      {/* Plan-this-trip module cards + AI strip (ADR-010 hub) */}
      <TripHubCards tripId={trip.trip_id} travelerCount={trip.travelers.length} stats={hubStats} />
    </div>
  );
}