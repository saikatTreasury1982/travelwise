'use client';

import { useState } from 'react';

export interface PanelTrip {
  trip_id: number;
  trip_name: string;
  start_date: string;
  end_date: string;
  trip_budget: number | null;
  budget_currency: string | null;
  destinations: Array<{ destination_id?: number; country: string; city: string | null }>;
  travelers: Array<{ traveler_id: number; traveler_name: string; relationship_name: string | null; is_primary: number; is_cost_sharer: number; is_active: number }>;
}

function fmtRange(a: string, b: string) {
  try {
    const opt: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
    const s = new Date(a).toLocaleDateString('en-GB', opt);
    const e = new Date(b).toLocaleDateString('en-GB', { ...opt, year: 'numeric' });
    return `${s} – ${e}`;
  } catch { return `${a} – ${b}`; }
}
function nights(a: string, b: string) {
  try { return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)); } catch { return 0; }
}

export default function TripPanel({
  trip, onChange, collapsibleOnMobile = true,
}: { trip: PanelTrip | null; onChange: (t: PanelTrip) => void; collapsibleOnMobile?: boolean }) {
  const [open, setOpen] = useState(true);      // mobile expand/collapse
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // draft fields
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [budget, setBudget] = useState('');

  function beginEdit(section: string) {
    if (!trip) return;
    setName(trip.trip_name);
    setStart(trip.start_date);
    setEnd(trip.end_date);
    setBudget(trip.trip_budget?.toString() ?? '');
    setErr('');
    setEditing(section);
  }

  async function patchTrip(body: Record<string, unknown>, optimistic: Partial<PanelTrip>) {
    if (!trip) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/trips/${trip.trip_id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save.');
      onChange({ ...trip, ...optimistic });
      setEditing(null);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  if (!trip) {
    return (
      <div className="tp-empty" style={{ color: 'var(--ink-faint)', fontSize: 13, textAlign: 'center', padding: '40px 20px', border: '1px dashed var(--border)', borderRadius: 14, background: 'var(--surface)' }}>
        Your trip will appear here as we plan it.
      </div>
    );
  }

  const places = trip.destinations;
  const label = { fontSize: 10, textTransform: 'uppercase' as const, letterSpacing: '0.5px', color: 'var(--ink-faint)' };
  const editLink = { fontSize: 11, color: 'var(--accent-deep)', fontWeight: 600, cursor: 'pointer' } as React.CSSProperties;
  const secStyle = { padding: '14px 18px', borderTop: '1px solid var(--divider)' } as React.CSSProperties;
  const inputStyle = { height: 40, border: '1px solid var(--accent)', borderRadius: 10, padding: '0 12px', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, width: '100%' } as React.CSSProperties;
  const saveBtn = { height: 36, padding: '0 14px', border: 'none', borderRadius: 9, background: 'var(--primary)', color: 'var(--primary-ink)', fontWeight: 700, fontSize: 13 } as React.CSSProperties;
  const cancelBtn = { height: 36, padding: '0 14px', border: 'none', background: 'none', color: 'var(--ink-soft)', fontSize: 13, cursor: 'pointer' } as React.CSSProperties;

  return (
    <div className="tp-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      {/* header — clickable to collapse on mobile */}
      <div
        onClick={() => collapsibleOnMobile && setOpen((o) => !o)}
        style={{ background: 'var(--panel)', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: collapsibleOnMobile ? 'pointer' : 'default' }}>
        <div>
          {editing === 'name' ? null : (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--panel-ink)' }}>{trip.trip_name}</div>
              <div style={{ fontSize: 12, color: 'rgba(245,242,237,0.65)', marginTop: 2 }}>{fmtRange(trip.start_date, trip.end_date)} · {nights(trip.start_date, trip.end_date)} nights</div>
            </>
          )}
        </div>
        <span className="tp-chev" style={{ color: 'var(--panel-ink)', fontSize: 14 }}>{open ? '▴' : '▾'}</span>
      </div>

      {open && (
        <>
          {err && <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--danger)' }}>{err}</div>}

          {/* NAME + DATES edit */}
          <div style={secStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Trip</span>
              {editing !== 'trip' && <span style={editLink} onClick={() => beginEdit('trip')}>Edit</span>}
            </div>
            {editing === 'trip' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Trip name" style={inputStyle} />
                <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
                <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button disabled={busy} style={saveBtn}
                    onClick={() => patchTrip({ name, startDate: start, endDate: end }, { trip_name: name, start_date: start, end_date: end })}>Save</button>
                  <button style={cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{trip.trip_name}</div>
            )}
          </div>

          {/* DESTINATIONS (read-only chips for now; edit routes to detail) */}
          <div style={secStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Destinations</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {places.length === 0 ? <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>None yet</span> :
                places.map((d, i) => (
                  <span key={d.destination_id ?? i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 999, background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-deep)' }}>
                    {d.city ? `${d.city}` : d.country}
                  </span>
                ))}
            </div>
          </div>

          {/* TRAVELLERS */}
          <div style={secStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Who's going</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {trip.travelers.map((t) => (
                <span key={t.traveler_id} style={{ fontSize: 12, padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border)', color: 'var(--ink)', opacity: t.is_active ? 1 : 0.55 }}>
                  {t.is_primary ? <span style={{ color: 'var(--accent-deep)' }}>★ </span> : null}
                  {t.traveler_name}
                  {!t.is_primary && t.relationship_name ? <span style={{ color: 'var(--ink-faint)' }}> · {t.relationship_name}</span> : null}
                </span>
              ))}
            </div>
          </div>

          {/* BUDGET edit */}
          <div style={secStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={label}>Budget</span>
              {editing !== 'budget' && <span style={editLink} onClick={() => beginEdit('budget')}>Edit</span>}
            </div>
            {editing === 'budget' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Amount" style={inputStyle} />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button disabled={busy} style={saveBtn}
                    onClick={() => { const b = budget === '' ? null : Number(budget); patchTrip({ budget: b }, { trip_budget: b }); }}>Save</button>
                  <button style={cancelBtn} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                {trip.trip_budget != null ? `${trip.budget_currency ?? ''} ${trip.trip_budget.toLocaleString()}` : <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--ink-faint)' }}>Not set</span>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}