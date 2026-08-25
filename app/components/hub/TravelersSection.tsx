'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import TogglePill from '@/app/components/ui/TogglePill';

interface Traveler {
  traveler_id: number; traveler_name: string; relationship: number | null;
  relationship_name: string | null; is_primary: number; is_cost_sharer: number; is_active: number;
}

const RELATIONSHIPS = [
  { code: 2, name: 'Spouse' }, { code: 3, name: 'Child' }, { code: 4, name: 'Friend' },
  { code: 5, name: 'Family' }, { code: 6, name: 'Colleague' },
];

export default function TravelersSection({ tripId, travelers: initial }: { tripId: number; travelers: Traveler[] }) {
  const router = useRouter();
  const [travelers, setTravelers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rel, setRel] = useState(5);
  const [coPayer, setCoPayer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    const res = await fetch(`/api/trips/${tripId}/travelers`);
    if (res.ok) { const d = await res.json(); setTravelers(d.travelers); }
    router.refresh();
  }

  async function add() {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/travelers`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ traveler_name: name.trim(), relationship: rel, is_cost_sharer: coPayer }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add.');
      setName(''); setRel(5); setCoPayer(true); setAdding(false);
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add.'); }
    finally { setBusy(false); }
  }

  async function patch(id: number, body: Record<string, unknown>) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/travelers/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not update.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update.'); }
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

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Who's going</h2>
        {!adding && (
          <button onClick={() => setAdding(true)} className="text-[13px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
            + Add traveller
          </button>
        )}
      </div>

      {error && <div className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      <div className="flex flex-col gap-2">
        {travelers.map((t) => (
          <div key={t.traveler_id} className="flex items-center gap-3 rounded-xl p-3.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: t.is_active ? 1 : 0.55 }}>
            <div className="flex-grow">
              <div className="text-[15px] font-medium" style={{ color: 'var(--ink)' }}>
                {t.traveler_name}
                {t.is_primary ? <span className="ml-2 text-[12px]" style={{ color: 'var(--accent-deep)' }}>★ You</span> : null}
                {!t.is_active ? <span className="ml-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>· tentative</span> : null}
              </div>
              <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>
                {t.is_primary ? 'Primary · pays' : `${t.relationship_name ?? 'Family'} · ${t.is_cost_sharer ? 'co-payer' : 'non-payer'}`}
              </div>
            </div>

            {!t.is_primary && (
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                <TogglePill
                  value={t.is_cost_sharer ? 'payer' : 'nonpayer'}
                  options={[
                    { value: 'payer', label: 'Co-payer' },
                    { value: 'nonpayer', label: 'Non-payer' },
                  ]}
                  onChange={(v) => patch(t.traveler_id, { is_cost_sharer: v === 'payer' })}
                />
                <TogglePill
                  value={t.is_active ? 'active' : 'tentative'}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'tentative', label: 'Tentative' },
                  ]}
                  onChange={(v) => patch(t.traveler_id, { is_active: v === 'active' })}
                />
                <button onClick={() => remove(t.traveler_id)} disabled={busy}
                  className="text-[12px] px-2.5 py-1 rounded-md" style={{ color: 'var(--danger)' }}>Remove</button>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="mt-3 rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="Name"
              className="flex-grow h-[44px] px-3 rounded-lg text-[14px] focus:outline-none"
              style={{ background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)' }} />
            <select value={rel} onChange={(e) => setRel(Number(e.target.value))}
              className="h-[44px] px-3 rounded-lg text-[14px]"
              style={{ background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
              {RELATIONSHIPS.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
            </select>
            <button onClick={() => setCoPayer((v) => !v)}
              className="h-[44px] px-3 rounded-lg text-[13px]"
              style={{ border: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
              {coPayer ? 'Co-payer' : 'Non-payer'}
            </button>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={add} disabled={busy || !name.trim()}
              className="h-[40px] px-4 rounded-lg font-bold text-[14px] disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Add</button>
            <button onClick={() => { setAdding(false); setName(''); }} className="h-[40px] px-4 text-[14px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}