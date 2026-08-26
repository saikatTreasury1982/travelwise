'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CurrencyCombobox, { type Currency } from '@/app/components/ui/CurrencyCombobox';

interface Bearer {
  traveler_id: number; traveler_name: string; forecast_base: number;
  actual_id: number | null; actual_amount: number | null; actual_currency: string | null;
  actual_amount_base: number | null; actual_date: string | null;
  paid_by_traveler_id: number | null; payment_method_key: string | null;
}
interface ActualItem { expense_id: number; description: string; source_module: string; expense_currency: string; bearers: Bearer[]; }
interface VarianceData {
  base_currency: string; forecast_total: number; actual_total: number; variance: number;
  modules: { source_module: string; forecast: number; actual: number; variance: number }[];
}

function money(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ActualsView({
  tripId, baseCurrency, initialItems, initialVariance,
}: {
  tripId: number; baseCurrency: string; initialItems: ActualItem[]; initialVariance: VarianceData;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [variance, setVariance] = useState(initialVariance);
  const [filter, setFilter] = useState<'all' | 'over'>('all');
  const [editing, setEditing] = useState<string | null>(null); // `${expenseId}:${travelerId}`
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // per-edit draft
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(baseCurrency);
  const [date, setDate] = useState('');
  const [paidBy, setPaidBy] = useState<number | null>(null);

  function key(e: number, t: number) { return `${e}:${t}`; }

  function beginEdit(item: ActualItem, b: Bearer) {
    setAmount(b.actual_amount != null ? String(b.actual_amount) : String(b.forecast_base.toFixed(2)));
    setCurrency(b.actual_currency ?? baseCurrency);
    setDate(b.actual_date ?? '');
    setPaidBy(b.paid_by_traveler_id ?? b.traveler_id);
    setEditing(key(item.expense_id, b.traveler_id));
    setError('');
  }
  function cancel() { setEditing(null); setError(''); }

  async function saveActual(expenseId: number, travelerId: number) {
    const amt = Number(amount);
    if (!(amt >= 0) || !Number.isFinite(amt)) { setError('Enter a valid amount.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/actuals`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId, travelerId, amount: amt, currency, date: date || null, paidByTravelerId: paidBy ?? travelerId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not save.');
      const d = await res.json();
      setItems(d.items); setVariance(d.variance);
      setEditing(null);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(false); }
  }

  // per-expense rollups
  function expenseTotals(item: ActualItem) {
    const forecast = item.bearers.reduce((s, b) => s + b.forecast_base, 0);
    const actual = item.bearers.reduce((s, b) => s + (b.actual_amount_base ?? 0), 0);
    const recorded = item.bearers.every((b) => b.actual_amount != null);
    return { forecast, actual, recorded, variance: actual - forecast };
  }

  const filtered = filter === 'all' ? items : items.filter((it) => { const t = expenseTotals(it); return t.recorded && t.variance > 0.005; });
  const nameOf = (item: ActualItem, tid: number | null) => item.bearers.find((b) => b.traveler_id === tid)?.traveler_name ?? '—';

  return (
    <div>
      {/* summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Estimated Total</div>
          <div className="text-[22px] font-extrabold mt-1" style={{ color: 'var(--ink)' }}>{money(variance.forecast_total, baseCurrency)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Actual Total</div>
          <div className="text-[22px] font-extrabold mt-1" style={{ color: 'var(--ink)' }}>{money(variance.actual_total, baseCurrency)}</div>
        </div>
        <div className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Variance</div>
          <div className="text-[22px] font-extrabold mt-1" style={{ color: variance.variance > 0.005 ? 'var(--danger)' : 'var(--success)' }}>
            {variance.variance > 0.005 ? '+' : ''}{money(variance.variance, baseCurrency)}
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{variance.variance > 0.005 ? 'over budget' : variance.variance < -0.005 ? 'under budget' : 'on budget'}</div>
        </div>
      </div>

      {/* filter */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>Expense Actuals ({items.length})</h2>
        <div className="flex gap-1 p-1 rounded-full" style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', border: '1px solid var(--border)' }}>
          <button onClick={() => setFilter('all')} className="px-3 py-1 rounded-full text-[13px]" style={filter === 'all' ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700 } : { color: 'var(--ink-soft)' }}>All</button>
          <button onClick={() => setFilter('over')} className="px-3 py-1 rounded-full text-[13px]" style={filter === 'over' ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 700 } : { color: 'var(--ink-soft)' }}>Over budget</button>
        </div>
      </div>

      {error && <div className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      <div className="flex flex-col gap-2">
        {filtered.map((item) => {
          const t = expenseTotals(item);
          const badge = !t.recorded ? { label: 'pending', color: 'var(--ink-faint)' }
            : t.variance > 0.005 ? { label: 'over budget', color: 'var(--danger)' }
            : t.variance < -0.005 ? { label: 'under budget', color: 'var(--success)' }
            : { label: 'on budget', color: 'var(--accent-deep)' };
          return (
            <div key={item.expense_id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>{item.description}</div>
                  <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                    Est {money(t.forecast, baseCurrency)} · Act {money(t.actual, baseCurrency)}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full flex-shrink-0" style={{ border: `1px solid ${badge.color}`, color: badge.color }}>{badge.label}</span>
              </div>

              {/* per-bearer rows */}
              <div className="mt-3 flex flex-col gap-2">
                {item.bearers.map((b) => {
                  const isEditing = editing === key(item.expense_id, b.traveler_id);
                  return (
                    <div key={b.traveler_id} className="rounded-xl p-3" style={{ background: 'var(--canvas)', border: '1px solid var(--border)' }}>
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{b.traveler_name}</div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus placeholder="Actual amount"
                              className="flex-grow h-[42px] px-3 rounded-lg text-[14px] focus:outline-none" style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }} />
                            <CurrencyCombobox value={currency} currencies={[{ currency_code: baseCurrency, currency_name: baseCurrency }] as Currency[]} onSelect={(c) => setCurrency(c)} className="h-[42px]" />
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-[42px] px-3 rounded-lg text-[14px]" style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }} />
                            <select value={paidBy ?? b.traveler_id} onChange={(e) => setPaidBy(Number(e.target.value))} className="h-[42px] px-3 rounded-lg text-[14px]" style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)' }}>
                              {item.bearers.map((bb) => <option key={bb.traveler_id} value={bb.traveler_id}>Paid by {bb.traveler_name}</option>)}
                            </select>
                            {/* payment-method slot — reserved for later */}
                            <div className="h-[42px] px-3 rounded-lg text-[13px] flex items-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)', color: 'var(--ink-faint)' }} title="Payment methods coming soon">Payment method (soon)</div>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => saveActual(item.expense_id, b.traveler_id)} disabled={busy} className="h-[38px] px-4 rounded-lg font-bold text-[13px]" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Save actual</button>
                            <button onClick={cancel} className="h-[38px] px-3 text-[13px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-grow">
                            <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{b.traveler_name}</div>
                            <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                              Forecast {money(b.forecast_base, baseCurrency)}
                              {b.paid_by_traveler_id ? ` · paid by ${nameOf(item, b.paid_by_traveler_id)}` : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            {b.actual_amount_base != null ? (
                              <>
                                <div className="text-[15px] font-bold" style={{ color: b.actual_amount_base > b.forecast_base + 0.005 ? 'var(--danger)' : 'var(--ink)' }}>{money(b.actual_amount_base, baseCurrency)}</div>
                                {b.actual_currency && b.actual_currency !== baseCurrency && (
                                  <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{money(b.actual_amount ?? 0, b.actual_currency)}</div>
                                )}
                              </>
                            ) : (
                              <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>not recorded</span>
                            )}
                          </div>
                          <button onClick={() => beginEdit(item, b)} className="text-[12px] px-2.5 py-1 rounded-md flex-shrink-0" style={{ border: '1px solid var(--border)', color: 'var(--ink-soft)' }}>
                            {b.actual_amount != null ? 'Edit' : 'Record'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>
            {filter === 'over' ? 'No over-budget expenses.' : 'No expenses to record actuals for yet.'}
          </p>
        )}
      </div>
    </div>
  );
}