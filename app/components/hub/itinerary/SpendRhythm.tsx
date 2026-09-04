'use client';
import { useState, useEffect } from 'react';

interface SpendBucket { key: string; label: string; sublabel: string; amount_base: number; }

/** Spend-by-day/range bar chart (base currency). Reusable in itinerary + forecast.
 *  Pass tripId to self-fetch, or pass buckets directly. */
export default function SpendRhythm({ tripId, buckets: passed, baseCurrency: passedCcy, title }: {
  tripId?: number; buckets?: SpendBucket[]; baseCurrency?: string; title?: string;
}) {
  const [buckets, setBuckets] = useState<SpendBucket[]>(passed ?? []);
  const [ccy, setCcy] = useState(passedCcy ?? '');
  const [loading, setLoading] = useState(!!tripId && !passed);

  useEffect(() => {
    if (passed || !tripId) return;
    let live = true;
    fetch(`/api/trips/${tripId}/itinerary/spend`).then((r) => r.ok ? r.json() : { buckets: [], base_currency: '' })
      .then((d) => { if (live) { setBuckets(d.buckets ?? []); setCcy(d.base_currency ?? ''); setLoading(false); } })
      .catch(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [tripId, passed]);

  if (loading) return null;
  if (buckets.length === 0 || buckets.every((b) => b.amount_base === 0)) return null;   // nothing to show

  const max = Math.max(...buckets.map((b) => b.amount_base), 1);
  const total = buckets.reduce((s, b) => s + b.amount_base, 0);

  return (
    <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-baseline justify-between mb-4">
        <h4 className="text-[13px] font-semibold" style={{ color: 'var(--ink-soft)' }}>{title ?? 'Spend by day'}</h4>
        <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>{ccy} {total.toLocaleString(undefined, { maximumFractionDigits: 0 })} total</span>
      </div>
      <div className="flex gap-1.5 items-end" style={{ height: 110 }}>
        {buckets.map((b) => {
          const h = Math.round((b.amount_base / max) * 100);
          const isBig = b.amount_base === max && b.amount_base > 0;
          return (
            <div key={b.key} className="flex-1 flex flex-col items-center justify-end gap-1.5" style={{ minWidth: 0 }} title={`${b.sublabel}: ${ccy} ${b.amount_base.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}>
              {b.amount_base > 0 && (
                <span className="text-[9.5px]" style={{ color: 'var(--ink-faint)' }}>{b.amount_base >= 1000 ? `${Math.round(b.amount_base / 100) / 10}k` : Math.round(b.amount_base)}</span>
              )}
              <div style={{
                width: '100%', height: `${Math.max(h, b.amount_base > 0 ? 6 : 2)}%`, borderRadius: '5px 5px 0 0',
                background: b.amount_base === 0 ? 'var(--divider)'
                  : isBig ? 'linear-gradient(180deg, var(--danger), color-mix(in srgb, var(--danger) 55%, transparent))'
                    : 'linear-gradient(180deg, var(--accent), color-mix(in srgb, var(--accent) 55%, transparent))',
              }} />
              <span className="text-[9.5px] truncate w-full text-center" style={{ color: 'var(--ink-faint)' }}>{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}