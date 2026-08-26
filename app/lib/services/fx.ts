// app/lib/services/fx.ts
// Exchange-rate lookup via a free, no-key API. We fetch the rate at save time
// and STORE it on the row, so totals are stable and auditable and there are no
// live FX calls on page load. Best-effort: on failure returns rate = null and
// the caller falls back to treating the amount as already-in-base (rate 1).

export interface FxResult { rate: number | null; baseAmount: number | null; }

// Convert `amount` from `fromCurrency` into `toCurrency`. Same currency → rate 1.
export async function convert(amount: number, fromCurrency: string, toCurrency: string): Promise<FxResult> {
  const from = (fromCurrency || '').toUpperCase().trim();
  const to = (toCurrency || '').toUpperCase().trim();
  if (!from || !to) return { rate: null, baseAmount: null };
  if (from === to) return { rate: 1, baseAmount: amount };

  try {
    // open.er-api.com — free, no key, returns rates keyed by target currency.
    const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const data = await res.json();
      const rate = data?.rates?.[to];
      if (typeof rate === 'number' && rate > 0) {
        return { rate, baseAmount: amount * rate };
      }
    }
  } catch {
    // fall through
  }
  return { rate: null, baseAmount: null };
}