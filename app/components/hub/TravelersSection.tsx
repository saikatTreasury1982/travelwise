'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TogglePill from '@/app/components/ui/TogglePill';
import CurrencyCombobox, { type Currency } from '@/app/components/ui/CurrencyCombobox';

interface Traveler {
  traveler_id: number; traveler_name: string; relationship: number | null;
  relationship_name: string | null; is_primary: number; is_cost_sharer: number; is_active: number;
  traveler_email: string | null; traveler_currency: string | null;
}

const RELATIONSHIPS = [
  { code: 2, name: 'Spouse' }, { code: 3, name: 'Child' }, { code: 4, name: 'Friend' },
  { code: 5, name: 'Family' }, { code: 6, name: 'Colleague' },
];

const fieldStyle: React.CSSProperties = {
  background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)',
};

export default function TravelersSection({
  tripId, travelers: initial, currencies,
}: { tripId: number; travelers: Traveler[]; currencies: Currency[] }) {
  const router = useRouter();
  const [travelers, setTravelers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // shared form state (used for both add and edit)
  const [name, setName] = useState('');
  const [rel, setRel] = useState(5);
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState('');
  const [coPayer, setCoPayer] = useState(true);
  const [active, setActive] = useState(true);

  function resetForm() {
    setName(''); setRel(5); setEmail(''); setCurrency(''); setCoPayer(true); setActive(true);
  }
  function beginAdd() {
    resetForm(); setEditingId(null); setError(''); setAdding(true);
  }
  function beginEdit(t: Traveler) {
    setName(t.traveler_name);
    setRel(t.relationship ?? 5);
    setEmail(t.traveler_email ?? '');
    setCurrency(t.traveler_currency ?? '');
    setCoPayer(t.is_cost_sharer === 1);
    setActive(t.is_active === 1);
    setAdding(false); setEditingId(t.traveler_id); setError('');
  }
  function cancelForm() {
    setAdding(false); setEditingId(null); resetForm(); setError('');
  }

  async function refresh() {
    const res = await fetch(`/api/trips/${tripId}/travelers`);
    if (res.ok) { const d = await res.json(); setTravelers(d.travelers); }
    router.refresh();
  }

  function formBody() {
    return {
      traveler_name: name.trim(), relationship: rel,
      is_cost_sharer: coPayer, is_active: active,
      traveler_email: email.trim() || null,
      traveler_currency: currency || null,
    };
  }

  async function submitAdd() {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/travelers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBody()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add.');
      cancelForm();
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add.'); }
    finally { setBusy(false); }
  }

  async function submitEdit(id: number) {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/travelers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formBody()),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save.');
      cancelForm();
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/travelers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not remove.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove.'); }
    finally { setBusy(false); }
  }

  // Inline form JSX (NOT a nested component — that remounts on every keystroke).
  const formJsx = (onSubmit: () => void, submitLabel: string) => (
    <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
      {/* Row 1 — name, relationship, email */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          className="flex-grow h-[44px] px-3 rounded-lg text-[14px] focus:outline-none" style={fieldStyle} />
        <select value={rel} onChange={(e) => setRel(Number(e.target.value))}
          className="h-[44px] px-3 rounded-lg text-[14px]" style={fieldStyle}>
          {RELATIONSHIPS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
        </select>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" type="email"
          className="flex-grow h-[44px] px-3 rounded-lg text-[14px] focus:outline-none" style={fieldStyle} />
      </div>

      {/* Row 2 — currency, co-payer, active */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-2 flex-wrap">
        <CurrencyCombobox value={currency} currencies={currencies} onSelect={(code) => setCurrency(code)} className="h-[44px]" />
        <TogglePill
          value={coPayer ? 'payer' : 'nonpayer'}
          options={[{ value: 'payer', label: 'Co-payer' }, { value: 'nonpayer', label: 'Non-payer' }]}
          onChange={(v) => setCoPayer(v === 'payer')}
        />
        <TogglePill
          value={active ? 'active' : 'tentative'}
          options={[{ value: 'active', label: 'Active' }, { value: 'tentative', label: 'Tentative' }]}
          onChange={(v) => setActive(v === 'active')}
        />
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={onSubmit} disabled={busy || !name.trim()}
          className="h-[40px] px-4 rounded-lg font-bold text-[14px] disabled:opacity-50"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>{submitLabel}</button>
        <button onClick={cancelForm} className="h-[40px] px-4 text-[14px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
      </div>
    </div>
  );

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Who's going</h2>
        {!adding && editingId === null && (
          <button onClick={beginAdd} className="text-[13px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
            + Add traveller
          </button>
        )}
      </div>

      {error && <div className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      <div className="flex flex-col gap-2">
        {travelers.map((t) => (
          editingId === t.traveler_id ? (
            <div key={t.traveler_id}>{formJsx(() => submitEdit(t.traveler_id), 'Save')}</div>
          ) : (
            <div key={t.traveler_id} className="flex items-center gap-3 rounded-xl p-3.5"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: t.is_active ? 1 : 0.55 }}>
              <div className="flex-grow">
                <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                  {t.traveler_name}
                  {t.is_primary ? <span className="ml-2 text-[12px]" style={{ color: 'var(--accent-deep)' }}>★ You</span> : null}
                  {!t.is_active ? <span className="ml-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>· tentative</span> : null}
                </div>
                <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                  {t.is_primary
                    ? 'Primary · pays'
                    : `${t.relationship_name ?? 'Family'} · ${t.is_cost_sharer ? 'co-payer' : 'non-payer'}${t.traveler_currency ? ' · ' + t.traveler_currency : ''}${t.traveler_email ? ' · ' + t.traveler_email : ''}`}
                </div>
              </div>

              {!t.is_primary && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => beginEdit(t)} disabled={busy}
                    className="text-[12px] px-2.5 py-1 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--ink-soft)' }}>Edit</button>
                  <button onClick={() => remove(t.traveler_id)} disabled={busy}
                    className="text-[12px] px-2.5 py-1 rounded-md" style={{ color: 'var(--danger)' }}>Remove</button>
                </div>
              )}
            </div>
          )
        ))}
      </div>

      {adding && formJsx(submitAdd, 'Add')}
    </section>
  );
}