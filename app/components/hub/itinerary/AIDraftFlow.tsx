// app/components/hub/itinerary/AIDraftFlow.tsx
'use client';
import { useState } from 'react';
import type { DraftItinerary, DraftActivity, DraftDay, DraftRange, DraftCategory } from '@/app/lib/services/itinerary-service';

type Pace = 'relaxed' | 'balanced' | 'packed';
type BudgetLever = 'leaner' | 'as_is' | 'generous';
interface Preferences { brief?: string | null; pace?: Pace; budget?: BudgetLever; focus?: string[]; }
interface Session {
    session_id: number;
    mode: 'day' | 'range';
    preferences: Preferences;
    draft: DraftItinerary | null;
    revision_count: number;
    revisions_allowed: number | 'unlimited';
    revisions_remaining: number | 'unlimited';
    note?: string | null;
}

const FOCUS_OPTIONS = ['Food', 'Culture', 'Outdoors', 'Shopping', 'Downtime'];

export default function AIDraftFlow({
    tripId, baseCurrency, tripBudget, travelerCount, tripStart, onCancel, onAccepted, onDraftAnother,
}: {
    tripId: number;
    baseCurrency: string;
    tripBudget: number | null;
    travelerCount: number;
    tripStart: string;
    onCancel: () => void;
    onAccepted: (itineraryId: number) => void;
    onDraftAnother: () => void;
}) {
    const [stage, setStage] = useState<'brief' | 'generating' | 'preview' | 'accepted'>('brief');
    const [brief, setBrief] = useState('');
    const [prefs, setPrefs] = useState<Preferences>({ pace: 'balanced', budget: 'as_is', focus: [] });
    const [session, setSession] = useState<Session | null>(null);
    const [busy, setBusy] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const [capMessage, setCapMessage] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [savedTitle, setSavedTitle] = useState('');

    const money = (n: number) => `${baseCurrency} ${Math.round(n).toLocaleString()}`;

    // ── client-side draft total (resolves per-person costs) ──
    function activityCost(a: DraftActivity): number {
        const c = a.estimated_cost;
        if (c == null || c <= 0) return 0;
        if (a.cost_type === 'per_person') return c * (a.headcount ?? travelerCount ?? 1);
        return c;
    }
    function bucketActivities(b: DraftDay | DraftRange): DraftActivity[] {
        const cats = (b.categories ?? []).flatMap((c: DraftCategory) => c.activities ?? []);
        return [...(b.ungrouped_activities ?? []), ...cats];
    }
    function draftTotal(d: DraftItinerary): number {
        const buckets: (DraftDay | DraftRange)[] = d.mode === 'range' ? (d.ranges ?? []) : (d.days ?? []);
        return buckets.reduce((sum, b) => sum + bucketActivities(b).reduce((s, a) => s + activityCost(a), 0), 0);
    }

    // ── API calls ──
    async function generate() {
        setBusy(true); setStage('generating'); setCapMessage(null);
        try {
            const res = await fetch(`/api/trips/${tripId}/itinerary/draft`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brief, pace: prefs.pace, budget: prefs.budget, focus: prefs.focus }),
            });
            const d = await res.json();
            if (d.session) { setSession(d.session); setNote(d.session.note ?? null); setStage('preview'); }
            else { setStage('brief'); }
        } catch { setStage('brief'); } finally { setBusy(false); }
    }

    async function revise() {
        if (!session) return;
        setBusy(true); setCapMessage(null);
        try {
            const res = await fetch(`/api/trips/${tripId}/itinerary/draft/revise`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ brief: prefs.brief, pace: prefs.pace, budget: prefs.budget, focus: prefs.focus }),
            });
            const d = await res.json();
            if (d.capped) { setCapMessage(d.message); if (d.session) setSession(d.session); }
            else if (d.session) { setSession(d.session); setNote(d.note ?? null); }
        } finally { setBusy(false); }
    }

    async function accept() {
        if (!title.trim() || busy) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/trips/${tripId}/itinerary/draft/accept`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), summary: note }),
            });
            const d = await res.json();
            if (d.ok) { setSavedTitle(title.trim()); setStage('accepted'); (window as any).__lastDraftItinId = d.itinerary_id; }
        } finally { setBusy(false); }
    }

    async function discard() {
        setBusy(true);
        try { await fetch(`/api/trips/${tripId}/itinerary/draft/discard`, { method: 'POST' }); }
        finally { setBusy(false); onCancel(); }
    }

    function resetForAnother() {
        setSession(null); setBrief(''); setPrefs({ pace: 'balanced', budget: 'as_is', focus: [] });
        setNote(null); setCapMessage(null); setTitle(''); setSavedTitle('');
        setStage('brief'); onDraftAnother();
    }

    const toggleFocus = (f: string) =>
        setPrefs((p) => ({ ...p, focus: p.focus?.includes(f) ? p.focus.filter((x) => x !== f) : [...(p.focus ?? []), f] }));

    // ── styles ──
    const seg = (active: boolean): React.CSSProperties => ({
        fontSize: 12, fontWeight: 600, padding: '6px 12px', cursor: 'pointer', border: 'none',
        background: active ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface)',
        color: active ? 'var(--accent-deep)' : 'var(--ink-soft)', borderRight: '1px solid var(--border)',
    });

    // ══════════════ STAGE: brief ══════════════
    if (stage === 'brief') {
        return (
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <button onClick={onCancel} className="text-[13px] mb-4" style={{ color: 'var(--ink-soft)' }}>‹ Back to plans</button>
                <div className="text-[17px] font-bold mb-1" style={{ color: 'var(--ink)' }}>✦ Draft with AI</div>
                <p className="text-[12.5px] mb-4" style={{ color: 'var(--ink-soft)' }}>Give a steer if you like, or just draft — you can adjust the result. Nothing is saved until you accept it.</p>
                <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3}
                    placeholder="Optional — e.g. “relaxed pace, lots of food, one temple day, a day trip out of the city, avoid early mornings”"
                    className="w-full text-[13.5px] px-3 py-2.5 rounded-lg resize-y"
                    style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none', minHeight: 80, fontFamily: 'inherit', lineHeight: 1.45 }} />
                <div className="flex items-center gap-3 mt-4 flex-wrap">
                    <button onClick={generate} disabled={busy}
                        className="tw-btn text-[13px] font-bold px-5 py-2.5 rounded-lg"
                        style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }}>
                        ✦ Draft my itinerary
                    </button>
                    <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>The co-pilot proposes a full plan you review before saving.</span>
                </div>
            </div>
        );
    }

    // ══════════════ STAGE: generating ══════════════
    if (stage === 'generating') {
        return (
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="text-center py-11">
                    <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--divider)', borderTopColor: 'var(--accent)', margin: '0 auto 16px', animation: 'twspin 0.8s linear infinite' }} />
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Drafting your plan…</div>
                    <div className="text-[12.5px] mt-1" style={{ color: 'var(--ink-soft)' }}>Balancing your brief against the trip and your budget.</div>
                </div>
                <style>{`@keyframes twspin{to{transform:rotate(360deg)}}`}</style>
            </div>
        );
    }

    // ══════════════ STAGE: accepted ══════════════
    if (stage === 'accepted') {
        return (
            <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background: 'color-mix(in srgb, var(--success) 8%, transparent)', border: '1px solid var(--success)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--success)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>✓</div>
                    <div style={{ flex: 1 }}>
                        <div className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>Saved “{savedTitle}”</div>
                        <div className="text-[12.5px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>Added to your plans as an unfinalized itinerary. Finalize it when you're ready — it won't feed your forecast until you do.</div>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 mt-4 flex-wrap">
                    <button onClick={resetForAnother} className="tw-btn text-[13px] font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none' }}>✦ Draft another possibility</button>
                    <button onClick={() => onAccepted((window as any).__lastDraftItinId)} className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>Open the plan</button>
                    <button onClick={onCancel} className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg" style={{ background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>Back to all plans</button>
                </div>
            </div>
        );
    }

    // ══════════════ STAGE: preview ══════════════
    const draft = session?.draft ?? null;
    const total = draft ? draftTotal(draft) : 0;
    const budget = tripBudget ?? 0;
    const over = budget > 0 && total > budget;
    const pct = budget > 0 ? Math.min(100, (total / budget) * 100) : 0;
    const remainingAllowed = session?.revisions_remaining;
    const capped = remainingAllowed === 0;

    const buckets: (DraftDay | DraftRange)[] = draft ? (draft.mode === 'range' ? (draft.ranges ?? []) : (draft.days ?? [])) : [];

    return (
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <button onClick={onCancel} className="text-[13px] mb-4" style={{ color: 'var(--ink-soft)' }}>‹ Back to plans</button>

            {/* header + budget bar */}
            <div className="flex items-center gap-3 mb-1.5">
                <div>
                    <div className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>Proposed plan · {draft?.mode === 'range' ? 'Day-ranges' : 'Day-by-day'}</div>
                    <div className="text-[12px]" style={{ color: 'var(--ink-soft)' }}>{buckets.length} {draft?.mode === 'range' ? 'stretches' : 'days'} · AI-drafted</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div className="text-[18px] font-extrabold" style={{ color: over ? 'var(--danger)' : 'var(--accent-deep)' }}>{money(total)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{budget > 0 ? `of ${money(budget)} budget` : 'estimated total'}</div>
                </div>
            </div>
            {budget > 0 && (
                <>
                    <div style={{ height: 8, borderRadius: 4, background: 'var(--divider)', overflow: 'hidden', margin: '8px 0 6px' }}>
                        <div style={{ height: '100%', width: `${over ? 100 : pct}%`, background: over ? 'var(--danger)' : 'var(--success)' }} />
                    </div>
                    {over && <div className="text-[12px] mb-3" style={{ color: 'var(--danger)', fontWeight: 600 }}>Over budget by {money(total - budget)} — try the Budget lever to lean it out.</div>}
                </>
            )}

            {note && <div className="text-[12.5px] mb-3 px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 6%, transparent)', color: 'var(--ink)' }}>✦ {note}</div>}

            {/* the plan */}
            <div className="mt-2">
                {buckets.map((b, i) => {
                    const acts = bucketActivities(b);
                    const bTotal = acts.reduce((s, a) => s + activityCost(a), 0);
                    const label = draft?.mode === 'range'
                        ? ((b as DraftRange).range_name || `Days ${(b as DraftRange).start_day}–${(b as DraftRange).end_day}`)
                        : ((b as DraftDay).title || `Day ${(b as DraftDay).day_number}`);
                    return (
                        <div key={i} className="rounded-xl mb-2.5 overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                            <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ background: 'color-mix(in srgb, var(--accent) 5%, transparent)', borderBottom: '1px solid var(--divider)' }}>
                                <span className="text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>{label}</span>
                                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: bTotal > 0 ? 'var(--accent-deep)' : 'var(--ink-faint)' }}>{bTotal > 0 ? money(bTotal) : 'free'}</span>
                            </div>
                            <div className="px-3.5 py-2">
                                {acts.map((a, j) => {
                                    const c = activityCost(a);
                                    return (
                                        <div key={j} className="flex items-center gap-2.5 py-1.5" style={{ borderBottom: j < acts.length - 1 ? '1px solid var(--divider)' : 'none' }}>
                                            <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)', width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{a.start_time || ''}</span>
                                            <span className="text-[13.5px]" style={{ flex: 1, color: 'var(--ink)' }}>{a.activity_name}</span>
                                            <span className="text-[12.5px]" style={{ fontWeight: c > 0 ? 600 : 400, color: c > 0 ? 'var(--accent-deep)' : 'var(--ink-faint)' }}>{c > 0 ? money(c) : 'free'}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* ── Adjust bar (railed) ── */}
            <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                <div className="flex items-center gap-2 mb-3">
                    <span className="text-[13px] font-bold" style={{ color: 'var(--ink)' }}>✦ Adjust this plan</span>
                    <span className="text-[11.5px]" style={{ marginLeft: 'auto', color: 'var(--ink-faint)' }}>
                        {remainingAllowed === 'unlimited' ? 'Unlimited adjustments' : `${remainingAllowed} of ${session?.revisions_allowed} left`}
                    </span>
                </div>

                <div style={{ opacity: capped ? 0.5 : 1, pointerEvents: capped ? 'none' : 'auto' }}>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-[12px] font-semibold" style={{ width: 64, color: 'var(--ink)' }}>Pace</span>
                        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                            {(['relaxed', 'balanced', 'packed'] as Pace[]).map((p) => (
                                <button key={p} onClick={() => setPrefs((s) => ({ ...s, pace: p }))} style={seg(prefs.pace === p)}>
                                    {p === 'relaxed' ? 'More relaxed' : p === 'balanced' ? 'Just right' : 'More packed'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-[12px] font-semibold" style={{ width: 64, color: 'var(--ink)' }}>Budget</span>
                        <div style={{ display: 'inline-flex', border: '1px solid var(--border)', borderRadius: 9, overflow: 'hidden' }}>
                            {(['leaner', 'as_is', 'generous'] as BudgetLever[]).map((bl) => (
                                <button key={bl} onClick={() => setPrefs((s) => ({ ...s, budget: bl }))} style={seg(prefs.budget === bl)}>
                                    {bl === 'leaner' ? 'Leaner' : bl === 'as_is' ? 'As-is' : 'More generous'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-[12px] font-semibold" style={{ width: 64, color: 'var(--ink)' }}>Focus</span>
                        <div className="flex gap-1.5 flex-wrap">
                            {FOCUS_OPTIONS.map((f) => {
                                const on = prefs.focus?.includes(f);
                                return (
                                    <button key={f} onClick={() => toggleFocus(f)} className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                                        style={{ background: on ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'var(--surface)', color: on ? 'var(--accent-deep)' : 'var(--ink-soft)', border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, cursor: 'pointer' }}>{f}</button>
                                );
                            })}
                        </div>
                    </div>
                    <input value={prefs.brief ?? ''} onChange={(e) => setPrefs((s) => ({ ...s, brief: e.target.value }))}
                        placeholder="One more note — e.g. “swap day 5 for a cooking class”"
                        className="w-full text-[13px] px-3 py-2 rounded-lg mt-1"
                        style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none' }} />
                    <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <button onClick={revise} disabled={busy} className="tw-btn text-[13px] font-bold px-4 py-2 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', opacity: busy ? 0.6 : 1 }}>
                            {busy ? 'Re-drafting…' : '↻ Re-draft with these'}
                        </button>
                        <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>Each re-draft replaces the plan above.</span>
                    </div>
                </div>

                {capMessage && (
                    <div className="text-[12.5px] mt-3 px-3 py-2.5 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', border: '1px solid var(--accent)', color: 'var(--ink)' }}>
                        💡 {capMessage}
                    </div>
                )}
            </div>

            {/* ── commit row ── */}
            <div className="flex items-center gap-2.5 mt-4 flex-wrap" style={{ borderTop: '1px solid var(--divider)', paddingTop: 16 }}>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="Name this plan to save it"
                    className="text-[13.5px] px-3 py-2 rounded-lg" style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none', maxWidth: 320, flex: 1 }} />
                <button onClick={accept} disabled={!title.trim() || busy}
                    className="tw-btn text-[13px] font-bold px-4 py-2 rounded-lg"
                    style={{ background: 'var(--success)', color: '#fff', border: 'none', opacity: (!title.trim() || busy) ? 0.5 : 1, cursor: (!title.trim() || busy) ? 'not-allowed' : 'pointer' }}>
                    Use this plan →
                </button>
                <button onClick={discard} disabled={busy} className="tw-btn text-[13px] font-semibold px-3 py-2 rounded-lg" style={{ background: 'none', color: 'var(--danger)', border: 'none' }}>Discard</button>
            </div>
        </div>
    );
}