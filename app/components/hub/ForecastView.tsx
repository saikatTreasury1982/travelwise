'use client';

interface ForecastLine { expense_id: number; description: string; amount_base: number; currency: string; amount_original: number; }
interface ForecastModule { source_module: string; total_base: number; items: ForecastLine[]; }
interface TravelerShare { traveler_id: number; traveler_name: string; is_primary: number; total_base: number; }
interface Forecast {
  base_currency: string; total_base: number;
  modules: ForecastModule[]; travelers: TravelerShare[];
}

const MODULE_META: Record<string, { label: string; icon: string }> = {
  flight: { label: 'Flights', icon: '✈️' },
  accommodation: { label: 'Lodging', icon: '🏨' },
  itinerary: { label: 'Itinerary', icon: '📅' },
  adhoc: { label: 'Ad-hoc Expenses', icon: '🧮' },
};

function money(n: number, ccy: string) {
  return `${ccy} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ForecastView({ forecast }: { forecast: Forecast }) {
  const { base_currency, total_base, modules, travelers } = forecast;

  return (
    <div className="flex flex-col gap-4">
      {/* Total */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--panel)', color: 'var(--panel-ink)' }}>
        <div className="text-[13px]" style={{ color: 'rgba(245,242,237,0.7)' }}>Total Estimated Cost</div>
        <div className="text-[34px] font-extrabold mt-1" style={{ letterSpacing: '-0.5px' }}>{money(total_base, base_currency)}</div>
        <div className="text-[12px] mt-1" style={{ color: 'rgba(245,242,237,0.6)' }}>Base currency: {base_currency} (Primary traveller)</div>
      </div>

      {/* Breakdown by module */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--ink)' }}>Breakdown by module</h2>
        {modules.length === 0 ? (
          <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>No costs yet. Add expenses in each module to build your forecast.</p>
        ) : (
          <div className="flex flex-col">
            {modules.map((m) => {
              const meta = MODULE_META[m.source_module] ?? { label: m.source_module, icon: '•' };
              return (
                <div key={m.source_module} style={{ borderTop: '1px solid var(--divider)' }} className="py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold flex items-center gap-2" style={{ color: 'var(--ink)' }}>
                      <span>{meta.icon}</span>{meta.label}
                      <span className="text-[12px] font-normal" style={{ color: 'var(--ink-faint)' }}>({m.items.length} item{m.items.length !== 1 ? 's' : ''})</span>
                    </span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--ink)' }}>{money(m.total_base, base_currency)}</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {m.items.map((it) => (
                      <div key={it.expense_id} className="flex items-center justify-between text-[13px]">
                        <span style={{ color: 'var(--ink-soft)' }}>{it.description}</span>
                        <span style={{ color: 'var(--ink-soft)' }}>
                          {money(it.amount_base, base_currency)}
                          {it.currency !== base_currency && (
                            <span className="ml-2 text-[11px]" style={{ color: 'var(--ink-faint)' }}>({money(it.amount_original, it.currency)})</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cost share by traveller */}
      <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>Cost share by traveller</h2>
          <span className="text-[12px]" style={{ color: 'var(--accent-deep)' }}>Among {travelers.length} cost-sharer{travelers.length !== 1 ? 's' : ''}</span>
        </div>
        {travelers.length === 0 ? (
          <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>No cost-sharers yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {travelers.map((t) => (
              <div key={t.traveler_id} className="flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--canvas)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-semibold flex-shrink-0" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
                    {t.traveler_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>
                      {t.traveler_name}
                      {t.is_primary ? <span className="ml-2 text-[11px]" style={{ color: 'var(--accent-deep)' }}>Primary</span> : null}
                    </div>
                  </div>
                </div>
                <div className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{money(t.total_base, base_currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}