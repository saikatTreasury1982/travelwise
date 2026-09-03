'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CurrencyCombobox, { type Currency } from '@/app/components/ui/CurrencyCombobox';
import TogglePill from '@/app/components/ui/TogglePill';

interface Bearer { traveler_id: number; traveler_name: string; is_primary?: number }
interface AdhocExpense {
  expense_id: number; description: string; category_label: string | null;
  estimated_amount: number; expense_currency: string; estimated_amount_base: number;
  expense_date: string | null; is_active: number; notes: string | null;
  bearers: { traveler_id: number; traveler_name: string }[];
}

const CATEGORIES = ['Transport', 'Food', 'Shopping', 'Entertainment', 'Communication', 'Insurance', 'Accommodation-extra', 'Other'];

const fieldStyle: React.CSSProperties = { background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)' };

function money(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdhocExpenses({
  tripId, baseCurrency, currencies, initialExpenses, eligibleBearers,
}: {
  tripId: number; baseCurrency: string; currencies: Currency[];
  initialExpenses: AdhocExpense[]; eligibleBearers: Bearer[];
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // form state
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [category, setCategory] = useState('Other');
  const [date, setDate] = useState('');
  const [active, setActive] = useState(true);
  const [bearers, setBearers] = useState<number[]>([]);
  const [note, setNote] = useState('');

  // FX preview / mode-C override
  const [rate, setRate] = useState<number | null>(null);
  const [pinBase, setPinBase] = useState(false);
  const [baseAmt, setBaseAmt] = useState('');
  const foreign = !!currency && currency !== baseCurrency;

  function resetForm() {
    setName(''); setAmount(''); setCurrency(baseCurrency); setCategory('Other');
    setDate(''); setActive(true); setBearers([]); setNote('');
    setPinBase(false); setBaseAmt('');
  }
  function beginAdd() { resetForm(); setEditingId(null); setError(''); setShowForm(true); }
  function beginEdit(e: AdhocExpense) {
    setName(e.description); setAmount(String(e.estimated_amount)); setCurrency(e.expense_currency);
    setCategory(e.category_label ?? 'Other'); setDate(e.expense_date ?? ''); setActive(e.is_active === 1);
    setBearers(e.bearers.map((b) => b.traveler_id)); setNote(e.notes ?? '');
    setEditingId(e.expense_id); setError(''); setShowForm(true);
  }
  function cancel() { setShowForm(false); setEditingId(null); resetForm(); setError(''); }

  function toggleBearer(id: number) {
    setBearers((b) => b.includes(id) ? b.filter((x) => x !== id) : [...b, id]);
  }

  const amountNum = Number(amount);
  const perHead = bearers.length > 0 && Number.isFinite(amountNum) && amountNum > 0
    ? amountNum / bearers.length : 0;

  useEffect(() => {
    if (!foreign) { setRate(null); return; }
    let live = true;
    fetch(`/api/fx?from=${encodeURIComponent(currency)}&to=${encodeURIComponent(baseCurrency)}`)
      .then((r) => r.ok ? r.json() : { rate: null })
      .then((d) => { if (live) setRate(d.rate ?? null); })
      .catch(() => { if (live) setRate(null); });
    return () => { live = false; };
  }, [currency, baseCurrency, foreign]);

  const autoBase = foreign && rate != null && amountNum > 0 ? amountNum * rate : null;

  async function submit() {
    if (!name.trim() || !(amountNum > 0) || bearers.length === 0) {
      setError('Name, a valid amount, and at least one traveller are required.');
      return;
    }
    if (foreign && pinBase && !baseAmt) {
      setError(`Enter the exact ${baseCurrency} amount, or switch back to mid-market.`);
      return;
    }
    setBusy(true); setError('');
    const payload = {
      description: name.trim(), estimatedAmount: amountNum, currency,
      categoryLabel: category, expenseDate: date || null, isActive: active,
      bearerTravelerIds: bearers, notes: note || null,
      baseAmountOverride: (foreign && pinBase && baseAmt) ? Number(baseAmt) : null,
    };
    try {
      const url = editingId ? `/api/trips/${tripId}/adhoc/${editingId}` : `/api/trips/${tripId}/adhoc`;
      const res = await fetch(url, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save.');
      const d = await res.json();
      setExpenses(d.expenses);
      cancel();
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  async function remove(id: number) {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/adhoc/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not remove.');
      const d = await res.json();
      setExpenses(d.expenses);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove.'); }
    finally { setBusy(false); }
  }

  const total = expenses.filter((e) => e.is_active).reduce((s, e) => s + e.estimated_amount_base, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Ad-hoc total (active)</div>
          <div className="text-[24px] font-extrabold" style={{ color: 'var(--ink)' }}>{money(total, baseCurrency)}</div>
        </div>
        {!showForm && (
          <button onClick={beginAdd} className="h-[42px] px-5 rounded-lg font-bold text-[14px]" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
            + Add expense
          </button>
        )}
      </div>

      {error && <div className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {/* form */}
      {showForm && (
        <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Expense name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. WiFi on cruise"
                className="w-full h-[44px] px-3 rounded-lg text-[14px] focus:outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Amount *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full h-[44px] px-3 rounded-lg text-[14px] focus:outline-none" style={fieldStyle} />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Currency</label>
              <CurrencyCombobox value={currency} currencies={currencies} onSelect={(c) => setCurrency(c)} className="h-[44px]" />
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full h-[44px] px-3 rounded-lg text-[14px]" style={fieldStyle}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Date (optional)</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full h-[44px] px-3 rounded-lg text-[14px]" style={fieldStyle} />
            </div>
          </div>

          {/* FX preview + pin-exact toggle (only when currency ≠ base) */}
          {foreign && (
            <div className="mt-3 rounded-xl p-3 text-[12px]" style={{ background: 'color-mix(in srgb, var(--accent) 6%, var(--surface))', border: '1px solid var(--border)' }}>
              {!pinBase ? (
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ color: 'var(--ink-soft)' }}>
                    {autoBase != null
                      ? <>≈ <strong style={{ color: 'var(--ink)' }}>{money(autoBase, baseCurrency)}</strong> in your forecast <span style={{ color: 'var(--ink-faint)' }}>(mid-market)</span></>
                      : rate == null ? 'Rate unavailable — will convert on save.' : 'Enter an amount to preview.'}
                  </span>
                  <button type="button" onClick={() => setPinBase(true)} className="tw-link ml-auto" style={{ color: 'var(--accent-deep)' }}>
                    Enter exact {baseCurrency} instead →
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ color: 'var(--ink-soft)' }}>Exact {baseCurrency} charged</span>
                  <input type="number" value={baseAmt} onChange={(e) => setBaseAmt(e.target.value)} placeholder={baseCurrency}
                    className="px-2 rounded-lg text-[13px]" style={{ ...fieldStyle, height: 34, width: 130 }} />
                  <button type="button" onClick={() => { setPinBase(false); setBaseAmt(''); }} className="tw-link ml-auto" style={{ color: 'var(--ink-faint)' }}>
                    Use mid-market instead
                  </button>
                </div>
              )}
            </div>
          )}

          {/* status */}
          <div className="mt-3">
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>Status</label>
            <TogglePill value={active ? 'active' : 'inactive'}
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              onChange={(v) => setActive(v === 'active')} />
            <p className="text-[11.5px] mt-1" style={{ color: 'var(--ink-faint)' }}>Inactive expenses are kept but excluded from the cost forecast.</p>
          </div>

          {/* assign to travellers */}
          <div className="mt-3">
            <label className="block text-[12px] font-semibold mb-1.5" style={{ color: 'var(--ink-soft)' }}>Assign to travellers *</label>
            <div className="flex flex-wrap gap-2">
              {eligibleBearers.map((b) => {
                const on = bearers.includes(b.traveler_id);
                return (
                  <button key={b.traveler_id} type="button" onClick={() => toggleBearer(b.traveler_id)}
                    className="text-[13px] px-3 py-2 rounded-full font-medium"
                    style={on
                      ? { background: 'var(--accent)', color: 'var(--accent-ink)' }
                      : { background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                    {on ? '✓ ' : ''}{b.traveler_name}
                  </button>
                );
              })}
              {eligibleBearers.length === 0 && (
                <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>No cost-sharing travellers. Mark travellers as co-payers first.</span>
              )}
            </div>
          </div>

          {/* live split preview */}
          {bearers.length > 0 && amountNum > 0 && (
            <div className="mt-3 rounded-xl p-3 flex items-center justify-between" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
              <span className="text-[13px]" style={{ color: 'var(--accent-deep)' }}>
                Split among {bearers.length} traveller{bearers.length !== 1 ? 's' : ''} · {money(amountNum, currency)} ÷ {bearers.length}
              </span>
              <span className="text-[15px] font-bold" style={{ color: 'var(--accent-deep)' }}>{money(perHead, currency)} each</span>
            </div>
          )}

          {/* note */}
          <div className="mt-3">
            <label className="block text-[12px] font-semibold mb-1" style={{ color: 'var(--ink-soft)' }}>Note (optional)</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
              className="w-full p-3 rounded-lg text-[14px] resize-none focus:outline-none" style={fieldStyle} />
          </div>

          <div className="flex gap-2 mt-4">
            <button onClick={submit} disabled={busy} className="h-[42px] px-5 rounded-lg font-bold text-[14px] disabled:opacity-50" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
              {editingId ? 'Save changes' : 'Add expense'}
            </button>
            <button onClick={cancel} className="h-[42px] px-4 text-[14px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* list */}
      {expenses.length === 0 ? (
        <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>No ad-hoc expenses yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {expenses.map((e) => (
            <div key={e.expense_id} className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', opacity: e.is_active ? 1 : 0.55 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-grow">
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                    {e.description}
                    {e.category_label ? <span className="ml-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>· {e.category_label}</span> : null}
                    {!e.is_active ? <span className="ml-2 text-[12px]" style={{ color: 'var(--ink-faint)' }}>· inactive</span> : null}
                  </div>
                  <div className="text-[13px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                    {e.bearers.map((b) => b.traveler_name).join(', ') || 'No one assigned'}
                    {e.expense_date ? ` · ${e.expense_date}` : ''}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{money(e.estimated_amount_base, baseCurrency)}</div>
                  {e.expense_currency !== baseCurrency && (
                    <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{money(e.estimated_amount, e.expense_currency)}</div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-2 justify-end">
                <button onClick={() => beginEdit(e)} disabled={busy} className="text-[12px] px-2.5 py-1 rounded-md" style={{ border: '1px solid var(--border)', color: 'var(--ink-soft)' }}>Edit</button>
                <button onClick={() => remove(e.expense_id)} disabled={busy} className="text-[12px] px-2.5 py-1 rounded-md" style={{ color: 'var(--danger)' }}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}