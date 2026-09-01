// app/components/ui/VarianceChip.tsx
'use client';

/**
 * Reusable estimate-vs-actual chip. Drop into any module (flights, lodging, …).
 * Shows "est 1,950 → 1,755 (−195)" — green when under, red when over, grey when equal.
 * Renders nothing if either value is missing (can't compare).
 */
export default function VarianceChip({
  estimate, actual, currency, compact = false,
}: {
  estimate: number | null | undefined;
  actual: number | null | undefined;
  currency: string | null | undefined;
  compact?: boolean;
}) {
  if (estimate == null || actual == null) return null;
  const delta = actual - estimate;
  const over = delta > 0.005;
  const under = delta < -0.005;
  const color = over ? 'var(--danger)' : under ? 'var(--success)' : 'var(--ink-soft)';
  const bg = over ? 'color-mix(in srgb, var(--danger) 12%, transparent)'
    : under ? 'color-mix(in srgb, var(--success) 12%, transparent)'
    : 'color-mix(in srgb, var(--ink) 8%, transparent)';
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const sign = delta > 0 ? '+' : '';

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
      style={{ background: bg, color }}
      title={`Estimated ${currency ?? ''} ${estimate.toFixed(2)} → paid ${currency ?? ''} ${actual.toFixed(2)}`}
    >
      {compact
        ? `${sign}${currency ?? ''} ${fmt(delta)}`
        : `est ${fmt(estimate)} → ${fmt(actual)} · ${sign}${fmt(delta)}`}
    </span>
  );
}