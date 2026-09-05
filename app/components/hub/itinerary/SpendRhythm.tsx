'use client';
import { useState, useEffect } from 'react';

interface SpendBucket { key: string; label: string; sublabel: string; amount_base: number; category: string | null; }

const CAP = 14;   // ≤14 segments → ribbon; more → insight fallback (mode-agnostic)

// Category name → stable colour, derived from THEME tokens (works in every theme).
// Rotates through accent / success / danger / their tints so it always matches
// the active theme rather than fixed hexes.
const CAT_PALETTE = [
    'var(--accent-deep)',
    'var(--success)',
    'var(--danger)',
    'color-mix(in srgb, var(--accent) 65%, var(--ink-soft))',
    'color-mix(in srgb, var(--success) 60%, var(--ink-soft))',
    'color-mix(in srgb, var(--accent-deep) 70%, var(--danger))',
];
function catColor(name: string | null): string {
    if (!name) return 'var(--ink-faint)';
    let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return CAT_PALETTE[h % CAT_PALETTE.length];
}

/** Spend-by-day/range view (base currency). Collapsible (default collapsed).
 *  ≤14 segments → proportional category-tinted ribbon + insight; more → top-5 fallback.
 *  Self-fetches from tripId; onSelectBucket makes segments click-to-navigate. */
export default function SpendRhythm({ tripId, onSelectBucket, defaultOpen = false }: {
    tripId: number;
    onSelectBucket?: (key: string) => void;
    defaultOpen?: boolean;
}) {
    const [buckets, setBuckets] = useState<SpendBucket[]>([]);
    const [ccy, setCcy] = useState('');
    const [mode, setMode] = useState<'day' | 'range' | null>(null);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(defaultOpen);

    useEffect(() => {
        let live = true;
        fetch(`/api/trips/${tripId}/itinerary/spend`).then((r) => r.ok ? r.json() : { buckets: [] })
            .then((d) => { if (live) { setBuckets(d.buckets ?? []); setCcy(d.base_currency ?? ''); setMode(d.mode ?? null); setLoading(false); } })
            .catch(() => { if (live) setLoading(false); });
        return () => { live = false; };
    }, [tripId]);

    if (loading) return null;
    const spend = buckets.filter((b) => b.amount_base > 0);
    if (spend.length === 0) return null;   // nothing costed → hide entirely

    const total = buckets.reduce((s, b) => s + b.amount_base, 0);
    const fmt = (n: number) => `${ccy} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    const noun = mode === 'range' ? 'stretches' : 'days';
    const max = Math.max(...buckets.map((b) => b.amount_base), 1);

    return (
        <div className="rounded-xl mb-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {/* collapsed header — always visible, click to toggle */}
            <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center gap-3 px-4 py-3"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>
                <span className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Spend by day</span>
                {!open && (
                    <div className="flex gap-[2px] items-end" style={{ height: 20, maxWidth: 160, flex: 1 }}>
                        {buckets.map((b) => (
                            <div key={b.key} style={{
                                flex: 1, minWidth: 0,
                                height: `${Math.max((b.amount_base / max) * 100, b.amount_base > 0 ? 8 : 3)}%`,
                                background: b.amount_base === max && b.amount_base > 0 ? 'var(--danger)' : 'color-mix(in srgb, var(--accent) 50%, transparent)',
                                borderRadius: '2px 2px 0 0',
                            }} />
                        ))}
                    </div>
                )}
                <span className="ml-auto text-[12px]" style={{ color: 'var(--ink-faint)' }}>{fmt(total)} total</span>
                <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>{open ? '▾' : '▸'}</span>
            </button>

            {open && (
                <div className="px-4 pb-4">
                    {buckets.length <= CAP ? (
                        <Ribbon buckets={buckets} total={total} fmt={fmt} onSelectBucket={onSelectBucket} />
                    ) : (
                        <InsightFallback buckets={buckets} total={total} fmt={fmt} count={buckets.length} noun={noun} onSelectBucket={onSelectBucket} />
                    )}
                </div>
            )}
        </div>
    );
}

// ── Proportional ribbon (≤14 segments) ─────────────────────────────────────
function Ribbon({ buckets, total, fmt, onSelectBucket }: {
    buckets: SpendBucket[]; total: number; fmt: (n: number) => string; onSelectBucket?: (key: string) => void;
}) {
    const MIN_FLEX = total > 0 ? total * 0.03 : 1;   // floor so tiny days stay visible/clickable
    const top = [...buckets].filter((b) => b.amount_base > 0).sort((a, b) => b.amount_base - a.amount_base)[0];
    const topShare = top && total > 0 ? Math.round((top.amount_base / total) * 100) : 0;

    return (
        <div>
            <div className="flex rounded-[10px] overflow-hidden" style={{ height: 52, border: '1px solid var(--border)' }}>
                {buckets.map((b) => {
                    const flex = b.amount_base > 0 ? Math.max(b.amount_base, MIN_FLEX) : MIN_FLEX * 0.4;
                    const color = b.amount_base > 0 ? catColor(b.category) : 'var(--divider)';
                    const showAmt = total > 0 && (b.amount_base / total) > 0.06;
                    return (
                        <button key={b.key} onClick={() => onSelectBucket?.(b.key)}
                            title={`${b.sublabel}${b.category ? ` · ${b.category}` : ''}: ${fmt(b.amount_base)}`}
                            style={{
                                flex, background: color, border: 'none', borderRight: '2px solid var(--surface)',
                                cursor: onSelectBucket ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                            {b.amount_base > 0 && showAmt && (
                                <span className="text-[11px] font-bold" style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,.25)' }}>
                                    {Math.round(b.amount_base)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="flex mt-1.5">
                {buckets.map((b) => {
                    const flex = b.amount_base > 0 ? Math.max(b.amount_base, MIN_FLEX) : MIN_FLEX * 0.4;
                    return <span key={b.key} className="text-[9.5px] text-center truncate" style={{ flex, color: 'var(--ink-faint)', minWidth: 0 }}>{b.label}</span>;
                })}
            </div>
            {top && (
                <div className="mt-3 px-3 py-2 rounded-lg text-[12.5px] flex items-center gap-2"
                    style={{ background: 'color-mix(in srgb, var(--accent) 7%, transparent)', color: 'var(--ink)' }}>
                    💡 <span><b style={{ color: 'var(--accent-deep)' }}>{top.label}</b> is your biggest at <b style={{ color: 'var(--accent-deep)' }}>{fmt(top.amount_base)}</b> — {topShare}% of activity spend{top.category ? ` (${top.category})` : ''}.</span>
                </div>
            )}
        </div>
    );
}

// ── Insight fallback (>14 segments) ────────────────────────────────────────
function InsightFallback({ buckets, total, fmt, count, noun, onSelectBucket }: {
    buckets: SpendBucket[]; total: number; fmt: (n: number) => string; count: number; noun: string; onSelectBucket?: (key: string) => void;
}) {
    const top5 = [...buckets].filter((b) => b.amount_base > 0).sort((a, b) => b.amount_base - a.amount_base).slice(0, 5);
    return (
        <div>
            <div className="text-[12.5px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 7%, transparent)', color: 'var(--ink-soft)' }}>
                This plan has {count} {noun} — the spend chart works best for shorter durations, up to {CAP}. Here are your top spends:
            </div>
            <div className="space-y-1.5">
                {top5.map((b) => (
                    <button key={b.key} onClick={() => onSelectBucket?.(b.key)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left"
                        style={{ border: '1px solid var(--border)', background: 'transparent', cursor: onSelectBucket ? 'pointer' : 'default' }}>
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: catColor(b.category) }} />
                        <span className="text-[13px] flex-1" style={{ color: 'var(--ink)' }}>{b.label}</span>
                        {b.category && <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{b.category}</span>}
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--accent-deep)' }}>{fmt(b.amount_base)}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}