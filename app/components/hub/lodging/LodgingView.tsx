'use client';
import { useState, useEffect } from 'react';
import CurrencyCombobox from '@/app/components/ui/CurrencyCombobox';
import LodgingSuggestPanel from './LodgingSuggestPanel';

interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Traveler { traveler_id: number; traveler_name: string; is_primary: number; is_cost_sharer: number; is_active: number; }
interface Destination { destination_id: number; city: string | null; country: string; }
interface Props {
  tripId: number;
  currencies: Currency[];
  destinations: Destination[];
  tripStart: string;
  tripEnd: string;
}

function nights(ci?: string | null, co?: string | null) {
  if (!ci || !co) return 0;
  const a = new Date(ci + 'T00:00:00').getTime(), b = new Date(co + 'T00:00:00').getTime();
  return isNaN(a) || isNaN(b) || b <= a ? 0 : Math.round((b - a) / 86400000);
}
const money = (n: number, c?: string | null) => `${c ?? ''} ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export default function LodgingView({ tripId, currencies, destinations, tripStart, tripEnd }: Props) {
  const [stays, setStays] = useState<any[]>([]);
  const [roster, setRoster] = useState<Traveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [confirmFor, setConfirmFor] = useState<number | null>(null);
  const [bookFor, setBookFor] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        fetch(`/api/trips/${tripId}/lodging/stays`).then((r) => r.ok ? r.json() : { stays: [] }),
        fetch(`/api/trips/${tripId}/travelers`).then((r) => r.ok ? r.json() : { travelers: [] }),
      ]);
      setStays(s.stays ?? []);
      setRoster(t.travelers ?? []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [tripId]);

  const nameOf = (id: number) => roster.find((t) => t.traveler_id === id)?.traveler_name ?? '—';
  const destLabel = (id: number | null) => {
    if (id == null) return 'Unassigned';
    const d = destinations.find((x) => x.destination_id === id);
    return d ? (d.city || d.country) : 'Unassigned';
  };
  const tripNights = nights(tripStart, tripEnd);
  const coveredNights = stays.filter((s) => s.status === 'confirmed').reduce((sum, s) => sum + (s.nights || 0), 0);

  async function del(id: number) {
    if (!confirm('Delete this stay? Its cost is removed from the forecast.')) return;
    await fetch(`/api/trips/${tripId}/lodging/stays/${id}`, { method: 'DELETE' });
    load();
  }
  async function unconfirm(id: number) {
    await fetch(`/api/trips/${tripId}/lodging/stays/${id}/unconfirm`, { method: 'POST' });
    load();
  }

  // group by destination → status
  const byDest = new Map<string, { confirmed: any[]; shortlisted: any[] }>();
  for (const s of stays) {
    const key = String(s.destination_id ?? 'none');
    if (!byDest.has(key)) byDest.set(key, { confirmed: [], shortlisted: [] });
    (s.status === 'confirmed' ? byDest.get(key)!.confirmed : byDest.get(key)!.shortlisted).push(s);
  }

  return (
    <div>
      {/* coverage */}
      <div className="rounded-xl px-5 py-4 mb-5 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>Nights covered</span>
        <span className="text-[14px]" style={{ color: coveredNights >= tripNights && tripNights > 0 ? 'var(--success)' : 'var(--ink-soft)' }}>
          {coveredNights} of {tripNights} trip nights have a confirmed stay
        </span>
        {tripNights > 0 && coveredNights < tripNights && (
          <span className="ml-auto text-[12px]" style={{ color: 'var(--danger)' }}>{tripNights - coveredNights} nights unbooked</span>
        )}
      </div>

      <div className="flex gap-3 flex-wrap items-center mb-2">
        <button onClick={() => setSuggestOpen((v) => !v)} className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
          ✦ Suggest places to stay
        </button>
        <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>🔍 Search hotels in-app — coming soon</div>
      </div>

      {suggestOpen && <div className="mt-3"><LodgingSuggestPanel tripId={tripId} onShortlisted={load} onClose={() => setSuggestOpen(false)} /></div>}

      {/* grouped list */}
      {loading ? (
        <p className="mt-8 text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
      ) : stays.length === 0 ? (
        <p className="mt-8 text-[13px] text-center py-8" style={{ color: 'var(--ink-faint)' }}>No stays yet. Ask the co-pilot to suggest places.</p>
      ) : (
        [...byDest.entries()].map(([key, groups]) => (
          <div key={key} className="mt-8">
            <h2 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>
              {destLabel(key === 'none' ? null : Number(key))}
            </h2>
            {groups.confirmed.length > 0 && (
              <div className="mb-3">
                <div className="text-[11px] uppercase mb-2" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>Confirmed</div>
                <div className="space-y-2.5">{groups.confirmed.map((s) => stayCard(s))}</div>
              </div>
            )}
            {groups.shortlisted.length > 0 && (
              <div>
                <div className="text-[11px] uppercase mb-2" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>Considering ({groups.shortlisted.length})</div>
                <div className="space-y-2.5">{groups.shortlisted.map((s) => stayCard(s))}</div>
              </div>
            )}
          </div>
        ))
      )}

      {/* confirm dialog */}
      {confirmFor != null && (
        <ConfirmStay tripId={tripId} stay={stays.find((s) => s.stay_id === confirmFor)} roster={roster} tripStart={tripStart} tripEnd={tripEnd}
          onDone={() => { setConfirmFor(null); load(); }} onCancel={() => setConfirmFor(null)} />
      )}
      {/* mark-booked dialog */}
      {bookFor != null && (
        <MarkBooked tripId={tripId} stay={stays.find((s) => s.stay_id === bookFor)} currencies={currencies}
          onDone={() => { setBookFor(null); load(); }} onCancel={() => setBookFor(null)} />
      )}
    </div>
  );

  function stayCard(s: any) {
    const isBooked = s.booking_confirmed === 1;
    const amount = isBooked ? s.total_paid : s.estimated_price;
    const searchQ = encodeURIComponent(`${s.name ?? ''} ${destLabel(s.destination_id)}`.trim());
    const gHotels = `https://www.google.com/travel/search?q=${searchQ}`;
    const booking = `https://www.booking.com/searchresults.html?ss=${searchQ}${s.check_in ? `&checkin=${s.check_in}` : ''}${s.check_out ? `&checkout=${s.check_out}` : ''}`;
    return (
      <div key={s.stay_id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
          <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{s.name || 'Stay'}</span>
          {s.status === 'shortlisted'
            ? <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)', color: 'var(--ink-soft)' }}>Shortlisted</span>
            : isBooked
              ? <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--success) 16%, transparent)', color: 'var(--success)' }}>✓ Booked</span>
              : <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent-deep)' }}>Planned</span>}
          {amount != null && (
            <span className="ml-auto text-[15px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>
              {money(amount, s.currency_code)}{!isBooked && <span className="text-[11px] font-normal ml-1" style={{ color: 'var(--ink-faint)' }}>est.</span>}
            </span>
          )}
          <button onClick={() => del(s.stay_id)} title="Delete" className="tw-link ml-3" style={{ color: 'var(--ink-faint)' }}>🗑</button>
        </div>
        <div className="px-5 py-3 text-[13px]" style={{ color: 'var(--ink-soft)' }}>
          {s.accommodation_type}{s.area ? ` · ${s.area}` : ''}
          {s.check_in && ` · ${s.check_in} → ${s.check_out} (${s.nights} nights)`}
          {s.status === 'shortlisted' && s.nightly_rate != null && ` · ${money(s.nightly_rate, s.currency_code)}/night`}
        </div>
        <div className="flex items-center gap-3 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--divider)' }}>
          {s.status !== 'shortlisted' && (
            <>
              <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>Payers</span>
              {(s.bearer_traveler_ids ?? []).map((id: number) => (
                <span key={id} className="text-[11px] px-2.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent-deep)' }}>{nameOf(id)}</span>
              ))}
            </>
          )}
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {/* search links */}
            <a href={gHotels} target="_blank" rel="noopener noreferrer" className="tw-link text-[12px]" style={{ color: 'var(--accent-deep)' }}>Google Hotels ↗</a>
            <a href={booking} target="_blank" rel="noopener noreferrer" className="tw-link text-[12px]" style={{ color: 'var(--accent-deep)' }}>Booking.com ↗</a>
            {s.status === 'shortlisted' && (
              <button onClick={() => setConfirmFor(s.stay_id)} className="tw-btn text-[12px] font-semibold px-3.5 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Confirm →</button>
            )}
            {s.status === 'confirmed' && !isBooked && (
              <>
                <button onClick={() => setBookFor(s.stay_id)} className="tw-link text-[12px] font-semibold" style={{ color: 'var(--success)' }}>🏨 I've booked this</button>
                {s.source !== 'pdf' && <button onClick={() => unconfirm(s.stay_id)} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>↩ Move to shortlist</button>}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}

/* ---- Confirm (set dates + payers → Planned) ---- */
function ConfirmStay({ tripId, stay, roster, tripStart, tripEnd, onDone, onCancel }: any) {
  const [ci, setCi] = useState(stay?.check_in ?? tripStart);
  const [co, setCo] = useState(stay?.check_out ?? tripEnd);
  const [bearers, setBearers] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const eligible = roster.filter((t: any) => t.is_active === 1 && t.is_cost_sharer === 1);
  const canSave = ci && co && bearers.size > 0;

  async function save() {
    setBusy(true);
    try {
      // update the stay's dates + confirm, then set payers (emits expense)
      await fetch(`/api/trips/${tripId}/lodging/stays/${stay.stay_id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destination_id: stay.destination_id, name: stay.name, accommodation_type: stay.accommodation_type, area: stay.area,
          check_in: ci, check_out: co, price_mode: 'nightly', nightly_rate: stay.nightly_rate, currency_code: stay.currency_code,
        }),
      });
      await fetch(`/api/trips/${tripId}/lodging/stays/${stay.stay_id}/travelers`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ traveler_ids: [...bearers] }),
      });
      onDone();
    } finally { setBusy(false); }
  }
  return <Modal title={`Confirm — ${stay?.name ?? 'stay'}`} onCancel={onCancel}>
    <div className="flex gap-2 mb-3">
      <label className="flex-1 text-[12px]" style={{ color: 'var(--ink-faint)' }}>Check-in<input type="date" value={ci} onChange={(e) => setCi(e.target.value)} className="block w-full mt-1 p-2 rounded-lg text-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} /></label>
      <label className="flex-1 text-[12px]" style={{ color: 'var(--ink-faint)' }}>Check-out<input type="date" value={co} onChange={(e) => setCo(e.target.value)} className="block w-full mt-1 p-2 rounded-lg text-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} /></label>
    </div>
    <div className="text-[12px] mb-1" style={{ color: 'var(--ink-faint)' }}>Who's paying? *</div>
    <div className="flex flex-wrap gap-2 mb-3">
      {eligible.map((t: any) => {
        const on = bearers.has(t.traveler_id);
        return <button key={t.traveler_id} onClick={() => setBearers((p) => { const n = new Set(p); n.has(t.traveler_id) ? n.delete(t.traveler_id) : n.add(t.traveler_id); return n; })}
          className="text-[13px] px-3 py-1.5 rounded-full" style={{ background: on ? 'var(--accent)' : 'var(--surface)', color: on ? 'var(--accent-ink)' : 'var(--ink-soft)', border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, fontWeight: on ? 600 : 400 }}>{t.traveler_name}</button>;
      })}
    </div>
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="tw-link text-[14px] px-4 py-2" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
      <button onClick={save} disabled={!canSave || busy} className="tw-btn text-[14px] font-semibold px-5 py-2 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: canSave && !busy ? 1 : 0.5 }}>{busy ? 'Saving…' : 'Confirm'}</button>
    </div>
  </Modal>;
}

/* ---- Mark booked (real price + reference) ---- */
function MarkBooked({ tripId, stay, currencies, onDone, onCancel }: any) {
  const [price, setPrice] = useState('');
  const [curr, setCurr] = useState(stay?.currency_code ?? '');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!price || !curr) return;
    setBusy(true);
    try {
      await fetch(`/api/trips/${tripId}/lodging/stays/${stay.stay_id}/book`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_paid: parseFloat(price), currency_code: curr, confirmation_reference: ref || null }),
      });
      onDone();
    } finally { setBusy(false); }
  }
  return <Modal title={`Mark booked — ${stay?.name ?? 'stay'}`} onCancel={onCancel}>
    <div className="flex gap-2 items-end mb-4 flex-wrap">
      <label className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Real price paid
        <div className="flex gap-1 items-stretch mt-1">
          <div className="w-20 [&>button]:!h-[40px] [&>button]:!px-3 [&>button]:!py-0 [&>button]:!text-[14px] [&>button]:!rounded-lg [&_input]:!h-[40px]">
            <CurrencyCombobox
              value={curr}
              currencies={currencies}
              onSelect={setCurr}
            />
          </div>
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)}
            className="p-2 rounded-lg text-[14px]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', width: 130, height: 40 }} />
        </div>
      </label>
      <label className="text-[12px] flex-1" style={{ color: 'var(--ink-faint)' }}>Reference (optional)
        <input value={ref} onChange={(e) => setRef(e.target.value)} className="mt-1 p-2 rounded-lg text-[14px] w-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', height: 40 }} /></label>
    </div>
    <div className="flex justify-end gap-2">
      <button onClick={onCancel} className="tw-link text-[14px] px-4 py-2" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
      <button onClick={save} disabled={!price || !curr || busy} className="tw-btn text-[14px] font-semibold px-5 py-2 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: price && curr && !busy ? 1 : 0.5 }}>{busy ? 'Saving…' : 'Mark booked'}</button>
    </div>
  </Modal>;
}

function Modal({ title, children, onCancel }: any) {
  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)', maxWidth: 480, width: '100%' }}>
        <h3 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--ink)' }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}