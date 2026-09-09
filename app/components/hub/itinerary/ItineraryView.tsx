'use client';
import { useState, useEffect, useCallback } from 'react';
import type { ActivityRow, CategoryRow } from '@/app/lib/services/itinerary-service';
import CurrencyCombobox from '@/app/components/ui/CurrencyCombobox';
import SpendRhythm from './SpendRhythm';
import ActivityAssistSheet from './ActivityAssistSheet';
import type { ItineraryTree, BucketNode } from '@/app/lib/services/itinerary-service';
import AIDraftFlow from './AIDraftFlow';
import { DndContext, PointerSensor, useSensor, useSensors, closestCorners, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Traveler { traveler_id: number; traveler_name: string; is_primary: number; is_cost_sharer: number; is_active: number; }
interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Props {
    tripId: number;
    currencies: Currency[];
    baseCurrency: string;
    tripStart: string;
    tripEnd: string;
    tripBudget: number | null;
    travelerCount: number;
}

interface ItinListItem {
    itinerary_id: number; mode: 'day' | 'range'; title: string | null;
    summary: string | null; source: string; is_finalized: number;
    generated_at?: string | null; created_at?: string | null; updated_at?: string | null;
}

export default function ItineraryView({ tripId, currencies, baseCurrency, tripStart, tripEnd, tripBudget, travelerCount }: Props) {
    const [loading, setLoading] = useState(true);
    const [itineraries, setItineraries] = useState<ItinListItem[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [roster, setRoster] = useState<Traveler[]>([]);
    const [creating, setCreating] = useState(false);
    const [view, setView] = useState<'list' | 'editor' | 'aidraft'>('list');

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const [i, t] = await Promise.all([
                fetch(`/api/trips/${tripId}/itinerary`).then((r) => r.ok ? r.json() : { itineraries: [] }),
                fetch(`/api/trips/${tripId}/travelers`).then((r) => r.ok ? r.json() : { travelers: [] }),
            ]);
            const list: ItinListItem[] = i.itineraries ?? [];
            setItineraries(list);
            setRoster(t.travelers ?? []);
            // Default to the finalized plan, else the first.
            setActiveId((prev) => {
                const stillExists = prev != null && prev !== 0 && list.some((x) => x.itinerary_id === prev);
                if (stillExists) return prev;
                return list.find((x) => x.is_finalized === 1)?.itinerary_id ?? list[0]?.itinerary_id ?? null;
            });
        } finally { setLoading(false); }
    }, [tripId]);

    useEffect(() => { loadList(); }, [loadList]);

    async function createItinerary(mode: 'day' | 'range', source: 'manual' | 'ai', title: string, summary?: string) {
        setCreating(true);
        try {
            const res = await fetch(`/api/trips/${tripId}/itinerary`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, source, title: title.trim(), summary: summary?.trim() || null }),
            });
            if (res.ok) {
                const { itinerary_id } = await res.json();
                await loadList();
                setActiveId(itinerary_id);
                setView('editor');   // jump into the new plan
            }
        } finally { setCreating(false); }
    }

    function openPlan(id: number) { setActiveId(id); setView('editor'); }

    if (loading) {
        return <p className="mt-8 text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>;
    }

    const tripDays = (() => {
        try {
            const a = new Date(tripStart + 'T00:00:00').getTime();
            const b = new Date(tripEnd + 'T00:00:00').getTime();
            if (isNaN(a) || isNaN(b) || b < a) return 0;
            return Math.round((b - a) / 86400000) + 1;
        } catch { return 0; }
    })();
    const longTrip = tripDays > 14;

    if (view === 'aidraft') {
        return (
            <AIDraftFlow
                tripId={tripId}
                baseCurrency={baseCurrency}
                tripBudget={tripBudget}
                travelerCount={travelerCount}
                tripStart={tripStart}
                onCancel={() => { loadList(); setView('list'); }}
                onAccepted={(itineraryId) => { loadList(); openPlan(itineraryId); }}
                onDraftAnother={() => { /* stay in aidraft; AIDraftFlow resets itself */ }}
            />
        );
    }

    // ── Editor view: a plan is open ───────────────────────────────────────────
    if (view === 'editor' && activeId != null) {
        return (
            <ItineraryEditor
                tripId={tripId}
                itineraryId={activeId}
                itineraries={itineraries}
                onSwitch={openPlan}
                onListChanged={loadList}
                onBackToList={() => setView('list')}
                roster={roster}
                currencies={currencies}
                baseCurrency={baseCurrency}
                tripStart={tripStart}
                tripEnd={tripEnd}
            />
        );
    }

    // ── Landing: create + list of itineraries (always shown otherwise) ─────────
    return (
        <ItineraryLanding
            onDraftAI={() => setView('aidraft')}
            itineraries={itineraries}
            longTrip={longTrip}
            tripDays={tripDays}
            creating={creating}
            onCreate={createItinerary}
            onOpen={openPlan}
            onRenamed={loadList}
            tripId={tripId}
        />
    );

    function ItineraryLanding({
        itineraries, longTrip, tripDays, creating, onCreate, onOpen, onRenamed, onDraftAI, tripId,
    }: {
        itineraries: ItinListItem[];
        longTrip: boolean; tripDays: number; creating: boolean;
        onCreate: (mode: 'day' | 'range', source: 'manual' | 'ai', title: string, summary?: string) => void | Promise<void>;
        onOpen: (id: number) => void;
        onRenamed: () => void;
        onDraftAI: () => void;
        tripId: number;
    }) {
        const [title, setTitle] = useState('');
        const [summary, setSummary] = useState('');
        const canCreate = title.trim().length > 0 && !creating;

        const fmt = (d?: string | null) => {
            if (!d) return '—';
            try { return new Date(d.includes('T') ? d : d + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
            catch { return '—'; }
        };

        return (
            <div className="flex flex-col gap-6">
                {/* ── Create a new plan ── */}
                <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <h2 className="text-[17px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Create a plan</h2>
                    <p className="text-[12.5px] mb-4" style={{ color: 'var(--ink-soft)' }}>
                        Give it a name, then choose how it's built. You can keep several plans and finalize the one that feeds your forecast.
                    </p>

                    {/* title (required) + summary (optional) */}
                    <div className="flex flex-col gap-2.5 mb-4 max-w-[520px]">
                        <input
                            value={title} onChange={(e) => setTitle(e.target.value)}
                            placeholder="Plan name — e.g. “Family cruise” or “Tokyo core days”"
                            className="text-[14px] px-3 py-2.5 rounded-lg" style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none' }}
                        />
                        <textarea
                            value={summary} onChange={(e) => setSummary(e.target.value)}
                            placeholder="Short summary (optional) — what this plan is about, who it's for, anything to remember."
                            rows={3}
                            className="text-[13px] px-3 py-2 rounded-lg resize-y" style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none', minHeight: 68, fontFamily: 'inherit', lineHeight: 1.45 }}
                        />
                    </div>

                    {longTrip && (
                        <p className="text-[12px] mb-3 px-2.5 py-1.5 rounded-lg inline-block" style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--accent-deep)' }}>
                            Your trip is {tripDays} days — <b>day-ranges</b> keep long trips manageable. Recommended.
                        </p>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>Build:</span>
                        <button disabled={!canCreate} onClick={() => onCreate('day', 'manual', title, summary)}
                            className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                            style={{ background: longTrip ? 'var(--surface)' : 'var(--accent)', color: longTrip ? 'var(--ink-soft)' : 'var(--accent-ink)', border: longTrip ? '1px solid var(--border)' : 'none', opacity: canCreate ? 1 : 0.5, cursor: canCreate ? 'pointer' : 'not-allowed' }}>
                            Day by day
                        </button>
                        <button disabled={!canCreate} onClick={() => onCreate('range', 'manual', title, summary)}
                            className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                            style={{ background: longTrip ? 'var(--accent)' : 'var(--surface)', color: longTrip ? 'var(--accent-ink)' : 'var(--ink-soft)', border: longTrip ? 'none' : '1px solid var(--border)', opacity: canCreate ? 1 : 0.5, cursor: canCreate ? 'pointer' : 'not-allowed' }}>
                            By day-ranges
                        </button>
                        {!title.trim() && <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>Name your plan to continue</span>}
                        <button onClick={onDraftAI} className="tw-btn text-[12.5px] font-semibold ml-1 px-3 py-1.5 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-deep)', border: '1px solid transparent' }}>
                            ✦ Let AI draft it
                        </button>
                    </div>
                </div>

                {/* ── Existing itineraries ── */}
                {itineraries.length > 0 && (
                    <div>
                        <h3 className="text-xs font-bold uppercase mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>
                            Your plans · {itineraries.length}
                        </h3>
                        <div className="flex flex-col gap-2.5">
                            {itineraries.map((it) => (
                                <ItineraryListRow key={it.itinerary_id} it={it} tripId={tripId} onOpen={onOpen} onRenamed={onRenamed} fmt={fmt} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    function ItineraryListRow({
        it, tripId, onOpen, onRenamed, fmt,
    }: {
        it: ItinListItem; tripId: number; onOpen: (id: number) => void; onRenamed: () => void; fmt: (d?: string | null) => string;
    }) {
        const [renaming, setRenaming] = useState(false);
        const [t, setT] = useState(it.title ?? '');
        const [s, setS] = useState(it.summary ?? '');
        const [busy, setBusy] = useState(false);

        function startRename(e: React.MouseEvent) {
            e.stopPropagation();
            setT(it.title ?? ''); setS(it.summary ?? '');
            setRenaming(true);
        }

        async function saveRename() {
            if (!t.trim() || busy) return;
            setBusy(true);
            try {
                await fetch(`/api/trips/${tripId}/itinerary/${it.itinerary_id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: t.trim(), summary: s.trim() || null }),
                });
                onRenamed();
            } finally { setBusy(false); setRenaming(false); }
        }

        const isAI = it.source === 'ai';
        return (
            <div className="rounded-xl p-4 flex items-center gap-3 transition-transform hover:-translate-y-0.5"
                style={{ background: 'var(--surface)', border: `1px solid ${it.is_finalized ? 'var(--success)' : 'var(--border)'}`, cursor: renaming ? 'default' : 'pointer' }}
                onClick={() => { if (!renaming) onOpen(it.itinerary_id); }}>
                {/* mode badge */}
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-md flex-shrink-0"
                    style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
                    {it.mode === 'range' ? 'RANGE' : 'DAY'}
                </span>
                <div className="flex-grow min-w-0">
                    {renaming ? (
                        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-2">
                            <input
                                value={t} onChange={(e) => setT(e.target.value)} autoFocus
                                placeholder="Plan name"
                                className="text-[15px] font-semibold px-2.5 py-2 rounded-md w-full"
                                style={{ background: 'var(--canvas)', border: '1px solid var(--accent)', color: 'var(--ink)', outline: 'none' }}
                            />
                            <textarea
                                value={s} onChange={(e) => setS(e.target.value)}
                                placeholder="Summary (optional)"
                                rows={2}
                                className="text-[13px] px-2.5 py-2 rounded-md w-full resize-y"
                                style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)', outline: 'none', minHeight: 52, fontFamily: 'inherit', lineHeight: 1.45 }}
                            />
                            <div className="flex items-center gap-2">
                                <button onClick={saveRename} disabled={!t.trim() || busy}
                                    className="tw-btn text-[12.5px] font-semibold px-3.5 py-1.5 rounded-lg"
                                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', opacity: (!t.trim() || busy) ? 0.5 : 1, cursor: (!t.trim() || busy) ? 'not-allowed' : 'pointer' }}>
                                    {busy ? 'Saving…' : 'Save'}
                                </button>
                                <button onClick={() => setRenaming(false)} disabled={busy}
                                    className="text-[12.5px] px-3 py-1.5 rounded-lg" style={{ color: 'var(--ink-soft)' }}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-[15px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                                    {it.title || (it.mode === 'range' ? 'Untitled range plan' : 'Untitled day plan')}
                                </span>
                                {isAI && <span className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded" style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent-deep)' }}>✦ AI</span>}
                                {it.is_finalized === 1 && <span className="text-[11px] font-semibold" style={{ color: 'var(--success)' }}>✓ Finalized · feeds forecast</span>}
                            </div>
                            {it.summary && <div className="text-[12.5px] truncate mt-0.5" style={{ color: 'var(--ink-soft)' }}>{it.summary}</div>}
                            <div className="text-[11.5px] mt-1" style={{ color: 'var(--ink-faint)' }}>Created {fmt(it.created_at)} · Updated {fmt(it.updated_at)}</div>
                        </>
                    )}
                </div>
                {!renaming && (
                    <button onClick={startRename}
                        className="text-[12px] px-2.5 py-1 rounded-md flex-shrink-0" style={{ color: 'var(--ink-soft)' }}>
                        Rename
                    </button>
                )}
                {!renaming && <span className="text-[16px] flex-shrink-0" style={{ color: 'var(--ink-faint)' }}>›</span>}
            </div>
        );
    }

    // Stub — filled in Part 2/3. Renders the navigator + bucket panel for one itinerary.
    // ── Editor: navigator (left) + bucket panel (right) ──────────────────────────

    function ItineraryEditor({
        tripId, itineraryId, itineraries, onSwitch, onListChanged, onBackToList,
        roster, currencies, baseCurrency, tripStart, tripEnd,
    }: {
        tripId: number; itineraryId: number; itineraries: ItinListItem[];
        onSwitch: (id: number) => void; onListChanged: () => void; onBackToList: () => void;
        roster: Traveler[]; currencies: Currency[]; baseCurrency: string;
        tripStart: string; tripEnd: string;
    }) {
        const [tree, setTree] = useState<ItineraryTree | null>(null);
        const [loading, setLoading] = useState(true);
        const [activeBucket, setActiveBucket] = useState<number>(0);   // index into buckets
        const [unplanned, setUnplanned] = useState<number[]>([]);
        const [addingRange, setAddingRange] = useState(false);
        const [localBuckets, setLocalBuckets] = useState<BucketNode[]>([]);
        const [view, setView] = useState<'list' | 'timeline'>('list');
        const [assistFor, setAssistFor] = useState<{ activityId: number; name: string } | null>(null);
        const [assistCounts, setAssistCounts] = useState<Record<number, number>>({});
        const [selRanges, setSelRanges] = useState(false);
        const [selectedRanges, setSelectedRanges] = useState<Set<number>>(new Set());
        const [sync, setSync] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

        const runSync = useCallback(async (fn: () => Promise<boolean | void>) => {
            setSync('saving');
            try {
                const ok = await fn();
                setSync(ok === false ? 'error' : 'saved');
            } catch {
                setSync('error');
            } finally {
                setTimeout(() => setSync((s) => (s === 'saving' ? s : 'idle')), 1600);
            }
        }, []);

        const loadAssistCounts = useCallback(async () => {
            try {
                const r = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/assist-counts`);
                const d = r.ok ? await r.json() : { counts: {} };
                // API returns { [activityId]: { total, byType } }; we only need total for the badge.
                const totals: Record<number, number> = {};
                for (const [aid, c] of Object.entries(d.counts ?? {})) totals[Number(aid)] = (c as any).total ?? 0;
                setAssistCounts(totals);
            } catch { /* badges are non-critical */ }
        }, [tripId, itineraryId]);

        useEffect(() => { loadAssistCounts(); }, [loadAssistCounts]);

        const loadTree = useCallback(async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}`);
                const data = res.ok ? await res.json() : { tree: null };
                setTree(data.tree);
                if (data.tree?.mode === 'range') {
                    const u = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/unplanned`).then((r) => r.ok ? r.json() : { unplanned_days: [] });
                    setUnplanned(u.unplanned_days ?? []);
                } else {
                    setUnplanned([]);
                }
            } finally { setLoading(false); }
        }, [tripId, itineraryId]);

        useEffect(() => { loadTree(); }, [loadTree]);

        // Keep local (optimistic) order in sync whenever the tree (re)loads.
        useEffect(() => {
            if (tree) setLocalBuckets(tree.buckets);
        }, [tree]);

        const meta = itineraries.find((i) => i.itinerary_id === itineraryId);
        const finalized = meta?.is_finalized === 1;

        // ── Reorder a range up/down (range mode only) — optimistic, background save ──
        function moveRange(fromIdx: number, dir: -1 | 1) {
            const toIdx = fromIdx + dir;
            if (toIdx < 0 || toIdx >= localBuckets.length) return;
            const reordered = [...localBuckets];
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);
            setLocalBuckets(reordered);                 // 1. move on screen instantly

            // keep the moved bucket selected
            const movedKey = moved.day_range_id ?? moved.day_id;
            const newIdx = reordered.findIndex((b) => (b.day_range_id ?? b.day_id) === movedKey);
            if (newIdx >= 0) setActiveBucket(newIdx);

            // 2. persist in the background; reconcile only on failure
            const orderedIds = reordered.map((b) => b.day_range_id!).filter((x) => x != null);
            runSync(async () => {
                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/reorder`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind: 'range', ordered_ids: orderedIds }),
                });
                if (!res.ok) loadTree();
                return res.ok;
            });
        }

        const navSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

        function handleNavDragEnd(e: DragEndEvent) {
            const { active, over } = e;
            if (!over || active.id === over.id) return;
            const keyOf = (b: BucketNode) => `r${b.day_range_id}`;
            const fromIdx = localBuckets.findIndex((b) => keyOf(b) === active.id);
            const toIdx = localBuckets.findIndex((b) => keyOf(b) === over.id);
            if (fromIdx < 0 || toIdx < 0) return;

            const reordered = [...localBuckets];
            const [moved] = reordered.splice(fromIdx, 1);
            reordered.splice(toIdx, 0, moved);
            setLocalBuckets(reordered);                       // optimistic

            const movedKey = moved.day_range_id ?? moved.day_id;
            const newIdx = reordered.findIndex((b) => (b.day_range_id ?? b.day_id) === movedKey);
            if (newIdx >= 0) setActiveBucket(newIdx);

            const orderedIds = reordered.map((b) => b.day_range_id!).filter((x) => x != null);
            fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/reorder`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind: 'range', ordered_ids: orderedIds }),
            }).then((res) => { if (!res.ok) loadTree(); }).catch(() => loadTree());
        }

        async function deleteRange(rangeId: number) {
            const b = localBuckets.find((x) => x.day_range_id === rangeId);
            if (!b) return;
            const label = b.range_name || `Days ${b.start_day}–${b.end_day}`;
            const nAct = b.activities.length;
            const msg = nAct > 0
                ? `Delete "${label}"? Its ${nAct} ${nAct === 1 ? 'activity' : 'activities'} and any categories will be deleted, and their costs removed from your forecast. This can't be undone.`
                : `Delete "${label}"? This can't be undone.`;
            if (!confirm(msg)) return;

            // optimistic: drop it, reselect a neighbour
            const idx = localBuckets.findIndex((x) => x.day_range_id === rangeId);
            const next = localBuckets.filter((x) => x.day_range_id !== rangeId);
            setLocalBuckets(next);
            setActiveBucket(Math.max(0, Math.min(idx, next.length - 1)));

            await runSync(async () => {
                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/ranges/${rangeId}`, { method: 'DELETE' });
                loadTree();
                return res.ok;
            });
        }

        function toggleRangeSel(id: number) {
            setSelectedRanges((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
        }
        function exitRangeSelect() { setSelRanges(false); setSelectedRanges(new Set()); }

        async function bulkDeleteRanges() {
            const ids = [...selectedRanges];
            if (ids.length === 0) return;
            const n = ids.length;
            if (!confirm(`Delete ${n} ${n === 1 ? 'range' : 'ranges'}? Their activities and categories will be deleted, and their costs removed from your forecast. This can't be undone.`)) return;
            // optimistic
            setLocalBuckets((prev) => prev.filter((b) => !selectedRanges.has(b.day_range_id!)));
            setActiveBucket(0);
            await runSync(async () => {
                let ok = true;
                for (const id of ids) {
                    const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/ranges/${id}`, { method: 'DELETE' });
                    if (!res.ok) ok = false;
                }
                exitRangeSelect();
                loadTree();
                return ok;
            });
        }

        async function submitRange(startDay: number, endDay: number, name: string) {
            const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/ranges`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start_day: startDay, end_day: endDay, range_name: name || null }),
            });
            if (res.ok) { setAddingRange(false); await loadTree(); }
            else { const e = await res.json().catch(() => ({})); alert(e.error || 'Could not add range.'); }
        }

        async function deleteThisItinerary() {
            const label = meta?.title || (meta?.mode === 'range' ? 'this range plan' : 'this day plan');
            const warn = finalized
                ? `Delete ${label}? It's your finalized plan — its costs will be removed from your forecast. This can't be undone.`
                : `Delete ${label}? This can't be undone.`;
            if (!confirm(warn)) return;
            const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}`, { method: 'DELETE' });
            if (res.ok) {
                onSwitch(0);        // invalidate active id; parent re-picks finalized/first or shows entry screen
                onListChanged();    // reload list — empty ⇒ ItineraryView shows the day/range choice again
            } else {
                alert('Could not delete this itinerary.');
            }
        }

        function fmtDate(d: string | null) {
            if (!d) return '';
            try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' }); }
            catch { return d; }
        }
        function bucketLabel(b: BucketNode): string {
            if (b.kind === 'day') return b.title || `Day ${b.day_number}`;
            return b.range_name || `Days ${b.start_day}–${b.end_day}`;
        }
        function bucketSub(b: BucketNode): string {
            if (b.kind === 'day') return `Day ${b.day_number} · ${fmtDate(b.day_date)}`;
            return b.start_day === b.end_day ? `Day ${b.start_day}` : `Days ${b.start_day}–${b.end_day}`;
        }

        if (loading || !tree) {
            return <p className="mt-6 text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>;
        }

        const buckets = localBuckets;
        const current = buckets[activeBucket] ?? null;
        const isRange = tree.mode === 'range';

        return (
            <div>
                {/* Back to list + Finalize — primary itinerary controls */}
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <button onClick={onBackToList} className="tw-link text-[13px] font-medium inline-flex items-center gap-1.5" style={{ color: 'var(--ink-soft)' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        All plans
                    </button>
                    {sync !== 'idle' && (
                        <span className="text-[12px] font-medium inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                            style={{
                                background: sync === 'error' ? 'color-mix(in srgb, var(--danger) 12%, transparent)' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
                                color: sync === 'error' ? 'var(--danger)' : 'var(--accent-deep)',
                            }}>
                            {sync === 'saving' && <><span className="tw-spin" style={{ width: 10, height: 10, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />Saving…</>}
                            {sync === 'saved' && <>✓ Saved</>}
                            {sync === 'error' && <>Couldn’t save</>}
                        </span>
                    )}
                    <div className="ml-auto flex items-center gap-3">
                        {finalized ? (
                            <span className="text-[12.5px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
                                ✓ Finalized · feeds your forecast
                            </span>
                        ) : (
                            <button disabled={sync === 'saving'} onClick={() => runSync(async () => {
                                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/finalize`, { method: 'POST' });
                                onListChanged();
                                return res.ok;
                            })} className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                                style={{ background: 'var(--success)', color: '#fff', border: 'none', opacity: sync === 'saving' ? 0.5 : 1 }}>
                                Finalize this plan →
                            </button>
                        )}
                    </div>
                </div>

                {/* Plan bar: mode label · delete · (switcher when ≥2) */}
                <div className="flex items-center gap-2 flex-wrap mb-4 rounded-xl px-4 py-3"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    {itineraries.length > 1 ? (
                        <>
                            <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Plan</span>
                            {itineraries.map((i) => (
                                <button key={i.itinerary_id} onClick={() => onSwitch(i.itinerary_id)}
                                    className="text-[12px] px-3 py-1.5 rounded-full"
                                    style={{
                                        background: i.itinerary_id === itineraryId ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
                                        color: i.itinerary_id === itineraryId ? 'var(--accent-deep)' : 'var(--ink-soft)',
                                        border: `1px solid ${i.itinerary_id === itineraryId ? 'transparent' : 'var(--border)'}`,
                                        fontWeight: i.itinerary_id === itineraryId ? 600 : 400, cursor: 'pointer',
                                    }}>
                                    {i.title || (i.mode === 'range' ? 'Range plan' : 'Day plan')}{i.is_finalized === 1 ? ' ✓' : ''}
                                </button>
                            ))}
                        </>
                    ) : (
                        <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>
                            {isRange ? 'Range-based plan' : 'Day-based plan'}
                            {finalized && <span style={{ color: 'var(--success)' }}> · finalized</span>}
                        </span>
                    )}

                    <div className="ml-auto flex items-center gap-3">
                        <button onClick={deleteThisItinerary} className="tw-link text-[12px]" style={{ color: 'var(--danger)' }}>
                            🗑 Delete &amp; start over
                        </button>
                    </div>
                </div>

                <SpendRhythm
                    tripId={tripId}
                    onSelectBucket={(key) => {
                        const idx = buckets.findIndex((b) => (b.day_id != null ? `d${b.day_id}` : `r${b.day_range_id}`) === key);
                        if (idx >= 0) setActiveBucket(idx);
                    }}
                />

                {/* view switcher */}
                <div className="flex items-center gap-1.5 mb-4">
                    <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>View</span>
                    {([
                        { k: 'list', label: 'List' },
                        { k: 'timeline', label: 'Timeline' },
                    ] as const).map((v) => (
                        <button key={v.k} onClick={() => setView(v.k)}
                            className="text-[12px] px-3 py-1.5 rounded-lg"
                            style={{
                                background: view === v.k ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'transparent',
                                color: view === v.k ? 'var(--accent-deep)' : 'var(--ink-soft)',
                                border: `1px solid ${view === v.k ? 'transparent' : 'var(--border)'}`,
                                fontWeight: view === v.k ? 600 : 400, cursor: 'pointer',
                            }}>
                            {v.label}
                        </button>
                    ))}
                </div>

                <div className="flex gap-5 items-start" style={{ flexWrap: 'wrap' }}>
                    {/* ── Left rail: navigator ── */}
                    <div style={{ width: 240, flexShrink: 0 }}>
                        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                            <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid var(--divider)' }}>
                                <span className="text-[11px] uppercase" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>
                                    {tree.mode === 'day' ? `${buckets.length} days` : `${buckets.length} ${buckets.length === 1 ? 'stretch' : 'stretches'}`}
                                </span>
                                {isRange && buckets.length > 1 && (
                                    <button onClick={() => selRanges ? exitRangeSelect() : setSelRanges(true)}
                                        className="tw-link text-[11px] font-semibold ml-auto"
                                        style={{ color: selRanges ? 'var(--accent-deep)' : 'var(--ink-soft)' }}>
                                        {selRanges ? '✓ Done' : '☑ Select'}
                                    </button>
                                )}
                            </div>
                            {isRange && buckets.length > 1 && selRanges ? (
                                buckets.map((b, i) => {
                                    const on = selectedRanges.has(b.day_range_id!);
                                    return (
                                        <div key={`r${b.day_range_id}`}
                                            onClick={() => toggleRangeSel(b.day_range_id!)}
                                            className="flex items-center gap-2 px-3 py-3"
                                            style={{ borderTop: i === 0 ? 'none' : '1px solid var(--divider)', cursor: 'pointer', background: on ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent' }}>
                                            <span style={{
                                                width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff',
                                                background: on ? 'var(--accent)' : 'transparent', border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`
                                            }}>
                                                {on ? '✓' : ''}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{bucketLabel(b)}</div>
                                                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{bucketSub(b)}</div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : isRange && buckets.length > 1 ? (
                                <DndContext sensors={navSensors} collisionDetection={closestCorners} onDragEnd={handleNavDragEnd}>
                                    <SortableContext items={buckets.map((b) => `r${b.day_range_id}`)} strategy={verticalListSortingStrategy}>
                                        {buckets.map((b, i) => (
                                            <SortableRangeRow key={`r${b.day_range_id}`} id={`r${b.day_range_id}`} active={i === activeBucket} onDelete={() => deleteRange(b.day_range_id!)}>
                                                <button onClick={() => setActiveBucket(i)}
                                                    className="w-full text-left px-3 py-3" style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[14px] font-semibold" style={{ color: i === activeBucket ? 'var(--accent-deep)' : 'var(--ink)' }}>
                                                            {bucketLabel(b)}
                                                        </span>
                                                        {b.status === 'confirmed' && <span className="text-[10px]" style={{ color: 'var(--success)' }}>✓</span>}
                                                    </div>
                                                    <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{bucketSub(b)}</div>
                                                </button>
                                            </SortableRangeRow>
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            ) : (
                                buckets.map((b, i) => (
                                    <div key={b.kind === 'day' ? `d${b.day_id}` : `r${b.day_range_id}`}
                                        className="flex items-stretch"
                                        style={{
                                            borderTop: i === 0 ? 'none' : '1px solid var(--divider)',
                                            background: i === activeBucket ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                                        }}>
                                        <button onClick={() => setActiveBucket(i)}
                                            className="flex-1 text-left px-4 py-3" style={{ cursor: 'pointer', background: 'transparent', border: 'none' }}>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[14px] font-semibold" style={{ color: i === activeBucket ? 'var(--accent-deep)' : 'var(--ink)' }}>
                                                    {bucketLabel(b)}
                                                </span>
                                                {b.status === 'confirmed' && <span className="text-[10px]" style={{ color: 'var(--success)' }}>✓</span>}
                                            </div>
                                            <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{bucketSub(b)}</div>
                                        </button>
                                    </div>
                                ))
                            )}

                            {selRanges && selectedRanges.size > 0 && (
                                <div className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: '1px solid var(--divider)', background: 'var(--panel)', color: 'var(--panel-ink)' }}>
                                    <span className="text-[12px] font-bold">{selectedRanges.size} selected</span>
                                    <button onClick={bulkDeleteRanges} className="tw-btn text-[12px] font-semibold px-2.5 py-1 rounded-md ml-auto" style={{ background: 'var(--danger)', color: '#fff', border: 'none' }}>🗑 Delete</button>
                                </div>
                            )}

                            {/* Range-mode: unplanned days + inline add-range form */}
                            {isRange && (
                                <div className="px-4 py-3" style={{ borderTop: '1px dashed var(--border)' }}>
                                    {unplanned.length > 0 && (
                                        <div className="text-[11.5px] mb-1" style={{ color: 'var(--ink-faint)' }}>
                                            Unplanned: {formatDayGaps(unplanned)}
                                        </div>
                                    )}
                                    {!addingRange ? (
                                        <button onClick={() => setAddingRange(true)} className="tw-link text-[12px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
                                            + add a range
                                        </button>
                                    ) : (
                                        <AddRangeForm unplanned={unplanned} onAdd={submitRange} onCancel={() => setAddingRange(false)} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right: bucket panel, per selected view ── */}
                    <div style={{ flex: 1, minWidth: 320 }}>
                        {current ? (
                            view === 'timeline' ? (
                                <TimelinePanel
                                    key={current.kind === 'day' ? `d${current.day_id}` : `r${current.day_range_id}`}
                                    bucket={current} roster={roster} baseCurrency={baseCurrency}
                                    assistCounts={assistCounts}
                                    onOpenAssist={(activityId, name) => setAssistFor({ activityId, name })}
                                />
                            ) : (
                                <BucketPanel
                                    key={current.kind === 'day' ? `d${current.day_id}` : `r${current.day_range_id}`}
                                    tripId={tripId} itineraryId={itineraryId} bucket={current}
                                    roster={roster} currencies={currencies} baseCurrency={baseCurrency}
                                    onChanged={loadTree}
                                    onSync={runSync}
                                    assistCounts={assistCounts}
                                    onOpenAssist={(activityId, name) => setAssistFor({ activityId, name })}
                                />
                            )
                        ) : (
                            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
                                <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>
                                    {tree.mode === 'range' ? 'Add a range to start planning.' : 'No days yet.'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                {assistFor && (
                    <ActivityAssistSheet
                        tripId={tripId} activityId={assistFor.activityId} activityName={assistFor.name}
                        onClose={() => setAssistFor(null)}
                        onChanged={loadAssistCounts}
                    />
                )}
            </div>
        );
    }

    /** "5–8, 10" style compaction of a sorted day-number list. */
    function formatDayGaps(days: number[]): string {
        if (days.length === 0) return '';
        const sorted = [...days].sort((a, b) => a - b);
        const parts: string[] = [];
        let start = sorted[0], prev = sorted[0];
        for (let i = 1; i <= sorted.length; i++) {
            const d = sorted[i];
            if (d === prev + 1) { prev = d; continue; }
            parts.push(start === prev ? `${start}` : `${start}–${prev}`);
            start = d; prev = d;
        }
        return parts.join(', ');
    }

    function BucketPanel({
        tripId, itineraryId, bucket, roster, currencies, baseCurrency, onChanged, onSync, assistCounts, onOpenAssist,
    }: {
        tripId: number; itineraryId: number; bucket: BucketNode;
        roster: Traveler[]; currencies: Currency[]; baseCurrency: string; onChanged: () => void;
        onSync?: (fn: () => Promise<boolean | void>) => Promise<void>;
        assistCounts?: Record<number, number>;
        onOpenAssist?: (activityId: number, name: string) => void;
    }) {
        const [adding, setAdding] = useState(false);
        const [editingId, setEditingId] = useState<number | null>(null);
        const [selecting, setSelecting] = useState(false);
        const [selected, setSelected] = useState<Set<number>>(new Set());
        const [completing, setCompleting] = useState(false);
        const [groupPreview, setGroupPreview] = useState<{ category_name: string; activity_ids: number[] }[] | null>(null);
        const isConfirmed = bucket.status === 'confirmed';
        const [editingTitle, setEditingTitle] = useState(false);
        const [titleDraft, setTitleDraft] = useState('');
        const [startDraft, setStartDraft] = useState('');
        const [endDraft, setEndDraft] = useState('');

        async function saveTitle() {
            const value = titleDraft.trim();
            if (bucket.kind === 'day') {
                await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/days/${bucket.day_id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: value || null }),
                });
            } else {
                const s = parseInt(startDraft, 10), e = parseInt(endDraft, 10);
                if (!Number.isFinite(s) || !Number.isFinite(e) || s < 1 || e < s) {
                    alert('Enter a valid day range (end on or after start).');
                    return;
                }
                await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/ranges/${bucket.day_range_id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ range_name: value || null, start_day: s, end_day: e }),
                });
            }
            setEditingTitle(false);
            onChanged();
        }

        // "Complete" = flip this bucket to confirmed (opens the emit gate) AND run the
        // grouping pass. For now grouping is user-invoked/manual; the AI pass slots in here later.
        async function complete() {
            setCompleting(true);
            try {
                const statusPath = bucket.kind === 'day'
                    ? `days/${bucket.day_id}/status` : `ranges/${bucket.day_range_id}/status`;
                const run = onSync ?? ((f: any) => f());
                await run(async () => {
                    const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/${statusPath}`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'confirmed' }),
                    });
                    onChanged();
                    return res.ok;
                });
            } finally { setCompleting(false); }
        }

        async function reopen() {
            const statusPath = bucket.kind === 'day'
                ? `days/${bucket.day_id}/status` : `ranges/${bucket.day_range_id}/status`;
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/${statusPath}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'planning' }),
            });
            onChanged();
        }

        async function applyGrouping(groups: { category_name: string; activity_ids: number[] }[]) {
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/categories`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bucketBody, groups }),
            });
            setGroupPreview(null);
            onChanged();
        }

        async function addCategory() {
            const nm = prompt('Category name (e.g. "Dining", "Morning"):', '');
            if (!nm) return;
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/categories`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...bucketBody, category_name: nm }),
            });
            onChanged();
        }

        async function suggestGrouping() {
            // Only propose over currently UNGROUPED activities (non-destructive).
            const ungrouped = bucket.activities.filter((a) => a.category_id == null)
                .map((a) => ({ activity_id: a.activity_id, activity_name: a.activity_name, start_time: a.start_time }));
            if (ungrouped.length < 2) { alert('Add a couple more activities first, then I can suggest groupings.'); return; }
            const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/group`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activities: ungrouped }),
            });
            const data = res.ok ? await res.json() : { groups: [] };
            if (!data.groups?.length) { alert('These activities don\'t cluster obviously — leaving them as they are.'); return; }
            setGroupPreview(data.groups);
        }

        const eligible = roster.filter((t) => t.is_active === 1 && t.is_cost_sharer === 1);
        const nameOf = (id: number) => roster.find((t) => t.traveler_id === id)?.traveler_name ?? '—';
        const bucketBody = bucket.kind === 'day'
            ? { day_id: bucket.day_id } : { day_range_id: bucket.day_range_id };

        // Resolved cost of an activity (per_person × headcount, else total).
        function resolved(a: ActivityRow): number | null {
            if (a.activity_cost == null) return null;
            return a.cost_type === 'per_person' ? a.activity_cost * (a.headcount && a.headcount > 0 ? a.headcount : 1) : a.activity_cost;
        }
        const bucketTotal = bucket.total_base;

        // Group activities: by category_id, with null → "General".
        const cats = bucket.categories;
        const grouped: { cat: CategoryRow | null; items: ActivityRow[] }[] = [];
        const ungrouped = bucket.activities.filter((a) => a.category_id == null);

        const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

        // Map each droppable group to a stable id: 'cat:<id>' or 'ungrouped'.
        const groupId = (cat: CategoryRow | null) => cat ? `cat:${cat.category_id}` : 'ungrouped';

        async function handleDragEnd(e: DragEndEvent) {
            const activeId = Number(e.active.id);
            const over = e.over?.id;
            if (over == null) return;

            // Resolve the target category from the drop target.
            // over can be a group id ('cat:5' / 'ungrouped') or another activity id (number).
            let targetCat: number | null;
            let overActId: number | null = null;
            if (typeof over === 'string' && over.startsWith('cat:')) targetCat = Number(over.slice(4));
            else if (over === 'ungrouped') targetCat = null;
            else { // dropped over an activity — inherit that activity's category, insert near it
                overActId = Number(over);
                const overAct = bucket.activities.find((a) => a.activity_id === overActId);
                if (!overAct) return;
                targetCat = overAct.category_id ?? null;
            }

            const moved = bucket.activities.find((a) => a.activity_id === activeId);
            if (!moved) return;
            const catChanged = (moved.category_id ?? null) !== targetCat;

            // Build the new full-bucket order (all activities, top-to-bottom as rendered),
            // with `moved` placed into the target group near the drop point.
            const rest = bucket.activities.filter((a) => a.activity_id !== activeId);
            let insertAt: number;
            if (overActId != null) {
                const idx = rest.findIndex((a) => a.activity_id === overActId);
                insertAt = idx < 0 ? rest.length : idx;
            } else {
                // dropped on a group container → end of that group
                const lastOfGroup = rest.map((a, i) => ((a.category_id ?? null) === targetCat ? i : -1)).filter((i) => i >= 0).pop();
                insertAt = lastOfGroup == null ? rest.length : lastOfGroup + 1;
            }
            const movedUpdated = { ...moved, category_id: targetCat };
            const newList = [...rest.slice(0, insertAt), movedUpdated, ...rest.slice(insertAt)];
            const orderedIds = newList.map((a) => a.activity_id);

            // Persist: assign (if category changed) + reorder. Non-financial → fire, refresh on done.
            const run = onSync ?? ((f: any) => f());
            await run(async () => {
                let ok = true;
                if (catChanged) {
                    const r1 = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/assign`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ activity_ids: [activeId], category_id: targetCat }),
                    });
                    if (!r1.ok) ok = false;
                }
                const r2 = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/reorder`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ordered_ids: orderedIds }),
                });
                if (!r2.ok) ok = false;
                onChanged();
                return ok;
            });
        }

        if (ungrouped.length) grouped.push({ cat: null, items: ungrouped });
        for (const c of cats) {
            grouped.push({ cat: c, items: bucket.activities.filter((a) => a.category_id === c.category_id) });
        }

        async function clearThisDay() {
            if (bucket.kind !== 'day') return;
            const n = bucket.activities.length;
            if (n === 0) return;
            if (!confirm(`Clear ${bucket.title || `Day ${bucket.day_number}`}? All ${n} ${n === 1 ? 'activity' : 'activities'} and its categories will be deleted, and their costs removed from your forecast. The day itself stays. This can't be undone.`)) return;
            const run = onSync ?? ((f: any) => f());
            await run(async () => {
                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/days/${bucket.day_id}`, { method: 'DELETE' });
                if (res.ok) onChanged(); else alert('Could not clear that day.');
                return res.ok;
            });
        }

        async function del(activityId: number) {
            if (!confirm('Delete this activity? Its cost is removed from the forecast.')) return;
            const run = onSync ?? ((f: any) => f());
            await run(async () => {
                const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${activityId}`, { method: 'DELETE' });
                onChanged();
                return res.ok;
            });
        }

        function toggleSel(id: number) {
            setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
        }
        function exitSelect() { setSelecting(false); setSelected(new Set()); }

        async function bulkDelete() {
            const n = selected.size;
            if (n === 0) return;
            if (!confirm(`Delete ${n} ${n === 1 ? 'activity' : 'activities'}? Their costs are removed from the forecast. This can't be undone.`)) return;
            // delete sequentially (each is a financial write); then refresh once.
            const run = onSync ?? ((f: any) => f());
            await run(async () => {
                let ok = true;
                for (const id of selected) {
                    const res = await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${id}`, { method: 'DELETE' });
                    if (!res.ok) ok = false;
                }
                exitSelect();
                onChanged();
                return ok;
            });
        }

        async function toggleActive(a: ActivityRow) {
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${a.activity_id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activity_name: a.activity_name, start_time: a.start_time, end_time: a.end_time,
                    duration_minutes: a.duration_minutes, activity_cost: a.activity_cost, currency_code: a.currency_code,
                    cost_type: a.cost_type, headcount: a.headcount, notes: a.notes, category_id: a.category_id,
                    is_active: a.is_active === 1 ? false : true,
                }),
            });
            onChanged();
        }

        function renderActivityRow(a: ActivityRow) {
            return (
                <div
                    onClick={() => { if (selecting) toggleSel(a.activity_id); }}
                    className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                    style={{
                        border: `1px solid ${selecting && selected.has(a.activity_id) ? 'var(--accent)' : 'var(--border)'}`,
                        background: selecting && selected.has(a.activity_id) ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface)',
                        opacity: a.is_active === 1 ? 1 : 0.5,
                        cursor: selecting ? 'pointer' : 'default',
                    }}>
                    {selecting ? (
                        <span style={{
                            width: 18, height: 18, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff',
                            background: selected.has(a.activity_id) ? 'var(--accent)' : 'transparent',
                            border: `1.5px solid ${selected.has(a.activity_id) ? 'var(--accent)' : 'var(--border)'}`
                        }}>
                            {selected.has(a.activity_id) ? '✓' : ''}
                        </span>
                    ) : (
                        <button onClick={() => toggleActive(a)} title={a.is_active === 1 ? 'Exclude from forecast' : 'Include in forecast'}
                            className="tw-link text-[13px]" style={{ color: a.is_active === 1 ? 'var(--success)' : 'var(--ink-faint)' }}>
                            {a.is_active === 1 ? '◉' : '○'}
                        </button>
                    )}
                    <div className="flex-1 min-w-0">
                        <div className="text-[14px]" style={{ color: 'var(--ink)' }}>{a.activity_name}</div>
                        <div className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                            {a.start_time ? a.start_time : ''}{a.end_time ? `–${a.end_time}` : ''}
                            {a.bearer_traveler_ids.length > 0 && <span> · {a.bearer_traveler_ids.map(nameOf).join(', ')}</span>}
                        </div>
                    </div>
                    {resolved(a) != null && (
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
                            {a.currency_code} {resolved(a)!.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            {a.cost_type === 'per_person' && <span className="text-[10px] font-normal" style={{ color: 'var(--ink-faint)' }}> ({a.headcount || 1}p)</span>}
                        </span>
                    )}
                    {!selecting && (<>
                        <button onClick={() => setEditingId(a.activity_id)} className="tw-link text-[12px]" style={{ color: 'var(--accent-deep)' }}>Edit</button>
                        <button onClick={() => del(a.activity_id)} className="tw-link text-[12px]" style={{ color: 'var(--ink-faint)' }}>🗑</button>
                        {(assistCounts?.[a.activity_id] ?? 0) > 0 ? (
                            <button onClick={() => onOpenAssist?.(a.activity_id, a.activity_name)} className="tw-link text-[11px] px-1.5" title="Saved help" style={{ color: 'var(--accent-deep)' }}>✨ {assistCounts![a.activity_id]}</button>
                        ) : (
                            <button onClick={() => onOpenAssist?.(a.activity_id, a.activity_name)} className="tw-link text-[13px] px-1" title="Ask the co-pilot" style={{ color: 'var(--ink-faint)' }}>✨</button>
                        )}
                    </>)}
                </div>
            );
        }

        function money(n: number) {
            return `${baseCurrency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }

        return (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
                    <div>
                        {editingTitle ? (
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} autoFocus
                                        onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') setEditingTitle(false); }}
                                        placeholder={bucket.kind === 'day' ? `Day ${bucket.day_number}` : `Name (e.g. "Sea Days")`}
                                        className="text-[16px] font-bold"
                                        style={{ background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: '2px 8px', color: 'var(--ink)', minWidth: 220 }} />
                                    {bucket.kind === 'range' && (
                                        <>
                                            <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Days</span>
                                            <input type="number" value={startDraft} onChange={(e) => setStartDraft(e.target.value)}
                                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px', color: 'var(--ink)', width: 52, fontSize: 13 }} title="Start day" />
                                            <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>to</span>
                                            <input type="number" value={endDraft} onChange={(e) => setEndDraft(e.target.value)}
                                                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '4px 6px', color: 'var(--ink)', width: 52, fontSize: 13 }} title="End day" />
                                        </>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={saveTitle} className="tw-btn text-[12px] font-semibold px-3 py-1 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Save</button>
                                    <button onClick={() => setEditingTitle(false)} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <span className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
                                    {bucket.kind === 'day' ? (bucket.title || `Day ${bucket.day_number}`) : (bucket.range_name || `Days ${bucket.start_day}–${bucket.end_day}`)}
                                </span>
                                <button
                                    onClick={() => {
                                        setTitleDraft(bucket.kind === 'day' ? (bucket.title ?? '') : (bucket.range_name ?? ''));
                                        if (bucket.kind === 'range') { setStartDraft(String(bucket.start_day ?? '')); setEndDraft(String(bucket.end_day ?? '')); }
                                        setEditingTitle(true);
                                    }}
                                    className="tw-link text-[12px]" style={{ color: 'var(--accent-deep)' }}>
                                    ✎ Edit {bucket.kind === 'range' ? 'range' : 'name'}
                                </button>
                            </div>
                        )}
                        <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                            {bucket.kind === 'day'
                                ? `Day ${bucket.day_number}`
                                : (bucket.start_day === bucket.end_day ? `Day ${bucket.start_day}` : `Days ${bucket.start_day}–${bucket.end_day}`)}
                            {bucket.status === 'confirmed' && <span className="ml-2" style={{ color: 'var(--success)' }}>· ✓ Completed</span>}
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-3">
                        {bucket.activities.length > 0 && (
                            <button onClick={() => selecting ? exitSelect() : setSelecting(true)}
                                className="tw-link text-[12px] font-semibold"
                                style={{ color: selecting ? 'var(--accent-deep)' : 'var(--ink-soft)' }}>
                                {selecting ? '✓ Done' : '☑ Select'}
                            </button>
                        )}
                        {bucket.kind === 'day' && bucket.activities.length > 0 && !selecting && (
                            <button onClick={clearThisDay} className="tw-link text-[12px]" style={{ color: 'var(--danger)' }}>
                                Clear day
                            </button>
                        )}
                        {bucketTotal > 0 && (
                            <span className="text-[15px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>{money(bucketTotal)}</span>
                        )}
                    </div>
                </div>

                {/* activity groups */}
                <div className="px-5 py-4">
                    {bucket.activities.length === 0 && !adding && (
                        <p className="text-[13px] text-center py-6" style={{ color: 'var(--ink-faint)' }}>No activities yet. Add your first below.</p>
                    )}

                    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={selecting ? undefined : handleDragEnd}>
                        {grouped.map((g) => (
                            <div key={g.cat ? `c${g.cat.category_id}` : 'ungrouped'} className="mb-4">
                                {g.cat && (
                                    <CategoryHeader cat={g.cat} count={g.items.length} tripId={tripId} itineraryId={itineraryId} onChanged={onChanged} />
                                )}
                                {!g.cat && g.items.length > 0 && (
                                    <div className="text-[11px] uppercase mb-2 font-semibold" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>Ungrouped ({g.items.length})</div>
                                )}
                                <SortableContext id={groupId(g.cat)} items={g.items.map((a) => a.activity_id)} strategy={verticalListSortingStrategy}>
                                    <DroppableGroup id={groupId(g.cat)}>
                                        {g.items.map((a) => (
                                            editingId === a.activity_id ? (
                                                <ActivityForm key={a.activity_id}
                                                    tripId={tripId} itineraryId={itineraryId} bucketBody={bucketBody}
                                                    eligible={eligible} currencies={currencies} baseCurrency={baseCurrency}
                                                    existing={a}
                                                    onDone={() => { setEditingId(null); onChanged(); }}
                                                    onCancel={() => setEditingId(null)} />
                                            ) : (
                                                <SortableActivityRow key={a.activity_id} id={a.activity_id} disabled={selecting}>
                                                    {renderActivityRow(a)}
                                                </SortableActivityRow>
                                            )
                                        ))}
                                    </DroppableGroup>
                                </SortableContext>
                            </div>
                        ))}
                    </DndContext>

                    {/* add form */}
                    {adding ? (
                        <ActivityForm
                            tripId={tripId} itineraryId={itineraryId} bucketBody={bucketBody}
                            eligible={eligible} currencies={currencies} baseCurrency={baseCurrency}
                            existing={null}
                            onDone={() => { setAdding(false); onChanged(); }}
                            onCancel={() => setAdding(false)} />
                    ) : (
                        <button onClick={() => setAdding(true)} className="tw-btn w-full text-[13px] font-semibold py-2.5 rounded-lg mt-1"
                            style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent-deep)' }}>
                            + Add activity
                        </button>
                    )}
                </div>
                {/* footer: grouping + Complete/Save gate */}
                <div className="flex items-center gap-3 px-5 py-3 flex-wrap" style={{ borderTop: '1px solid var(--divider)' }}>
                    {bucket.activities.length > 0 && (
                        <>
                            <button onClick={suggestGrouping} className="tw-link text-[12px] font-semibold" style={{ color: 'var(--accent-deep)' }}>
                                ✦ Suggest grouping
                            </button>
                            <button onClick={addCategory} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>
                                + Group manually
                            </button>
                        </>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                        {!isConfirmed ? (
                            <>
                                <span className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                                    {bucket.activities.length === 0 ? 'Add activities, then Complete to add costs to your forecast.' : 'Complete to add these costs to your forecast.'}
                                </span>
                                <button onClick={complete} disabled={completing || bucket.activities.length === 0}
                                    className="tw-btn text-[13px] font-semibold px-4 py-1.5 rounded-lg"
                                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: (completing || bucket.activities.length === 0) ? 0.5 : 1 }}>
                                    {completing ? 'Completing…' : 'Complete'}
                                </button>
                            </>
                        ) : (
                            <>
                                <span className="text-[12px]" style={{ color: 'var(--success)' }}>✓ Completed · costs are in your forecast</span>
                                <button onClick={reopen} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>Reopen</button>
                            </>
                        )}
                    </div>
                </div>

                {/* grouping preview (AI proposes; user accepts/renames) — wired for the AI pass */}
                {
                    groupPreview && groupPreview.length > 0 && (
                        <div className="px-5 py-4" style={{ borderTop: '1px solid var(--divider)', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}>
                            <div className="text-[13px] font-semibold mb-2" style={{ color: 'var(--ink)' }}>Suggested grouping</div>
                            <div className="space-y-2 mb-3">
                                {groupPreview.map((g, i) => (
                                    <div key={i} className="rounded-lg px-3 py-2" style={{ border: '1px solid var(--border)' }}>
                                        <input defaultValue={g.category_name}
                                            onChange={(e) => { groupPreview[i].category_name = e.target.value; }}
                                            className="text-[13px] font-semibold mb-1"
                                            style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--accent-deep)', width: '100%' }} />
                                        <div className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>
                                            {g.activity_ids.length} {g.activity_ids.length === 1 ? 'activity' : 'activities'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setGroupPreview(null)} className="tw-link text-[13px] px-3 py-1.5" style={{ color: 'var(--ink-soft)' }}>No thanks</button>
                                <button onClick={() => applyGrouping(groupPreview)} className="tw-btn text-[13px] font-semibold px-4 py-1.5 rounded-lg"
                                    style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Apply grouping</button>
                            </div>
                        </div>
                    )
                }
                {
                    selecting && selected.size > 0 && (
                        <div style={{ position: 'sticky', bottom: 0, display: 'flex', alignItems: 'center', gap: 14, padding: '12px 20px', borderTop: '1px solid var(--divider)', background: 'var(--panel)', color: 'var(--panel-ink)' }}>
                            <span className="text-[13px] font-bold">{selected.size} selected</span>
                            <button onClick={bulkDelete} className="tw-btn text-[12.5px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--danger)', color: '#fff', border: 'none', marginLeft: 'auto' }}>🗑 Delete</button>
                            <button onClick={exitSelect} className="tw-link text-[12.5px]" style={{ color: 'rgba(245,242,237,0.7)' }}>Cancel</button>
                        </div>
                    )
                }
            </div >
        );
    }

    function CategoryHeader({ cat, count, tripId, itineraryId, onChanged }: {
        cat: CategoryRow; count: number; tripId: number; itineraryId: number; onChanged: () => void;
    }) {
        const [editing, setEditing] = useState(false);
        const [name, setName] = useState(cat.category_name);
        const [menuOpen, setMenuOpen] = useState(false);
        const [busy, setBusy] = useState(false);

        async function rename() {
            const v = name.trim();
            if (!v || v === cat.category_name) { setEditing(false); setName(cat.category_name); return; }
            setBusy(true);
            try {
                await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/categories/${cat.category_id}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category_name: v }),
                });
                onChanged();
            } finally { setBusy(false); setEditing(false); }
        }

        async function del() {
            setMenuOpen(false);
            const msg = count > 0
                ? `Delete "${cat.category_name}"? Its ${count} ${count === 1 ? 'activity' : 'activities'} will move to Ungrouped — they won't be lost.`
                : `Delete "${cat.category_name}"?`;
            if (!confirm(msg)) return;
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/categories/${cat.category_id}`, { method: 'DELETE' });
            onChanged();
        }

        return (
            <div className="flex items-center gap-2 mb-2 relative">
                {editing ? (
                    <input value={name} onChange={(e) => setName(e.target.value)} autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') { setEditing(false); setName(cat.category_name); } }}
                        onBlur={rename} disabled={busy}
                        className="text-[11px] uppercase font-semibold"
                        style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 6, padding: '2px 6px', outline: 'none' }} />
                ) : (
                    <span className="text-[11px] uppercase font-semibold" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>
                        {cat.category_name} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>({count})</span>
                    </span>
                )}
                {!editing && (
                    <button onClick={() => setMenuOpen((o) => !o)} className="tw-link"
                        style={{ color: 'var(--ink-faint)', fontSize: 15, lineHeight: 1, padding: '0 4px' }} title="Category options">⋯</button>
                )}
                {menuOpen && (
                    <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
                        <div className="rounded-lg" style={{ position: 'absolute', top: 22, left: 0, zIndex: 20, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 10px 30px rgba(20,15,8,0.16)', padding: 5, minWidth: 150 }}>
                            <button onClick={() => { setMenuOpen(false); setEditing(true); }}
                                className="tw-link" style={{ display: 'flex', width: '100%', gap: 8, padding: '8px 10px', fontSize: 13, color: 'var(--ink)', borderRadius: 7, textAlign: 'left' }}>✎ Rename</button>
                            <button onClick={del}
                                className="tw-link" style={{ display: 'flex', width: '100%', gap: 8, padding: '8px 10px', fontSize: 13, color: 'var(--danger)', borderRadius: 7, textAlign: 'left' }}>🗑 Delete category</button>
                        </div>
                    </>
                )}
            </div>
        );
    }

    function DroppableGroup({ id, children }: { id: string; children: React.ReactNode }) {
        // A SortableContext already registers droppable items; this wrapper gives an
        // empty group a drop target and some min-height so you can drop into it.
        return <div data-group={id} className="space-y-1.5" style={{ minHeight: 8 }}>{children}</div>;
    }

    function SortableRangeRow({ id, active, onDelete, children }: { id: string; active: boolean; onDelete?: () => void; children: React.ReactNode }) {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
        return (
            <div ref={setNodeRef}
                className="flex items-stretch group"
                style={{
                    transform: CSS.Transform.toString(transform), transition,
                    opacity: isDragging ? 0.5 : 1,
                    background: active ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                    borderTop: '1px solid var(--divider)',
                }}>
                <span {...attributes} {...listeners} title="Drag to reorder"
                    className="flex items-center pl-2 pr-1"
                    style={{ cursor: 'grab', color: 'var(--ink-faint)', fontSize: 14, letterSpacing: '-2px', touchAction: 'none', flexShrink: 0 }}>⠿</span>
                <div className="flex-1 min-w-0">{children}</div>
                {onDelete && (
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete this range"
                        className="flex items-center px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--ink-faint)', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>🗑</button>
                )}
            </div>
        );
    }

    function SortableActivityRow({ id, disabled, children }: { id: number; disabled?: boolean; children: React.ReactNode }) {
        const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
        const style: React.CSSProperties = {
            transform: CSS.Transform.toString(transform),
            transition,
            opacity: isDragging ? 0.5 : 1,
        };
        return (
            <div ref={setNodeRef} style={style} className="flex items-center gap-1">
                {!disabled && (
                    <span {...attributes} {...listeners} className="tw-link" title="Drag to move"
                        style={{ cursor: 'grab', color: 'var(--ink-faint)', fontSize: 14, letterSpacing: '-2px', flexShrink: 0, touchAction: 'none' }}>⠿</span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
            </div>
        );
    }

    // ── Activity add/edit form ────────────────────────────────────────────────
    function ActivityForm({
        tripId, itineraryId, bucketBody, eligible, currencies, baseCurrency, existing, onDone, onCancel,
    }: {
        tripId: number; itineraryId: number; bucketBody: { day_id?: number | null; day_range_id?: number | null };
        eligible: Traveler[]; currencies: Currency[]; baseCurrency: string;
        existing: ActivityRow | null; onDone: () => void; onCancel: () => void;
    }) {
        const [name, setName] = useState(existing?.activity_name ?? '');
        const [start, setStart] = useState(existing?.start_time ?? '');
        const [end, setEnd] = useState(existing?.end_time ?? '');
        const [cost, setCost] = useState(existing?.activity_cost != null ? String(existing.activity_cost) : '');
        const [curr, setCurr] = useState(existing?.currency_code ?? baseCurrency);
        const [costType, setCostType] = useState<'total' | 'per_person'>(existing?.cost_type ?? 'total');
        const [headcount, setHeadcount] = useState(existing?.headcount != null ? String(existing.headcount) : '');
        const [notes, setNotes] = useState(existing?.notes ?? '');
        // Default bearers: existing's, else all eligible (Decision 1).
        const [bearers, setBearers] = useState<Set<number>>(
            new Set(existing ? existing.bearer_traveler_ids : eligible.map((t) => t.traveler_id)),
        );
        const [busy, setBusy] = useState(false);

        const field: React.CSSProperties = {
            background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)',
            borderRadius: 8, padding: '6px 8px', fontSize: 14,
        };

        async function save() {
            if (!name.trim()) return;
            setBusy(true);
            try {
                const payload = {
                    ...bucketBody,
                    activity_name: name.trim(),
                    start_time: start || null, end_time: end || null,
                    activity_cost: cost ? parseFloat(cost) : null,
                    currency_code: cost ? curr : null,
                    cost_type: costType, headcount: headcount ? parseInt(headcount, 10) : null,
                    notes: notes || null,
                    category_id: existing?.category_id ?? null,
                    bearer_traveler_ids: [...bearers],
                };
                if (existing) {
                    await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${existing.activity_id}`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
                    });
                    // bearers set separately on edit (PUT activity doesn't touch bearers)
                    await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${existing.activity_id}/bearers`, {
                        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ traveler_ids: [...bearers] }),
                    });
                } else {
                    await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
                    });
                }
                onDone();
            } finally { setBusy(false); }
        }

        return (
            <div className="rounded-lg p-3 my-1.5" style={{ border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Activity name" autoFocus
                    style={{ ...field, width: '100%', marginBottom: 8 }} />
                <div className="flex gap-2 flex-wrap items-center mb-2">
                    <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...field, width: 110 }} title="Start" />
                    <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...field, width: 110 }} title="End" />
                    <div className="w-24 [&>button]:!h-[32px] [&>button]:!px-2 [&>button]:!py-0 [&>button]:!text-[14px] [&>button]:!rounded-lg [&_input]:!h-[32px]">
                        <CurrencyCombobox value={curr} currencies={currencies} onSelect={setCurr} />
                    </div>
                    <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="Cost" style={{ ...field, width: 100, height: 32 }} />
                    <select value={costType} onChange={(e) => setCostType(e.target.value as 'total' | 'per_person')} style={{ ...field, height: 32 }}>
                        <option value="total">total</option>
                        <option value="per_person">per person</option>
                    </select>
                    {costType === 'per_person' && (
                        <input type="number" value={headcount} onChange={(e) => setHeadcount(e.target.value)} placeholder="pax" style={{ ...field, width: 70, height: 32 }} />
                    )}
                </div>

                {/* bearers */}
                <div className="text-[11px] mb-1" style={{ color: 'var(--ink-faint)' }}>Who's paying?</div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {eligible.map((t) => {
                        const on = bearers.has(t.traveler_id);
                        return (
                            <button key={t.traveler_id} type="button"
                                onClick={() => setBearers((p) => { const n = new Set(p); n.has(t.traveler_id) ? n.delete(t.traveler_id) : n.add(t.traveler_id); return n; })}
                                className="text-[12px] px-2.5 py-1 rounded-full"
                                style={{ background: on ? 'var(--accent)' : 'var(--surface)', color: on ? 'var(--accent-ink)' : 'var(--ink-soft)', border: `1px solid ${on ? 'transparent' : 'var(--border)'}`, fontWeight: on ? 600 : 400 }}>
                                {t.traveler_name}
                            </button>
                        );
                    })}
                </div>

                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="tw-link text-[13px] px-3 py-1.5" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                    <button onClick={save} disabled={!name.trim() || busy} className="tw-btn text-[13px] font-semibold px-4 py-1.5 rounded-lg"
                        style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: (!name.trim() || busy) ? 0.5 : 1 }}>
                        {busy ? 'Saving…' : existing ? 'Save' : 'Add'}
                    </button>
                </div>
            </div>
        );
    }

    // ── AI draft door: mini-conversation → writes a new itinerary ────────────────
    interface DraftMsg { role: 'user' | 'assistant'; content: string; }

    function ItineraryDraftPanel({
        tripId, onDrafted, onClose,
    }: {
        tripId: number;
        onDrafted: (itineraryId: number) => void;
        onClose: () => void;
    }) {
        const [messages, setMessages] = useState<DraftMsg[]>([]);
        const [input, setInput] = useState('');
        const [busy, setBusy] = useState(false);
        const [started, setStarted] = useState(false);

        async function send(text: string) {
            const next: DraftMsg[] = [...messages, { role: 'user', content: text }];
            setMessages(next);
            setInput('');
            setBusy(true);
            try {
                const res = await fetch(`/api/trips/${tripId}/itinerary/draft`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: next }),
                });
                const data = await res.json();
                if (data.drafted) {
                    // Whole plan written server-side — jump into it.
                    onDrafted(data.itinerary_id);
                    return;
                }
                // Mini-conversation: show the co-pilot's question.
                setMessages((m) => [...m, { role: 'assistant', content: data.message || 'Tell me a little more.' }]);
            } catch {
                setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong — try again.' }]);
            } finally { setBusy(false); }
        }

        // First send kicks it off with a default brief if the user didn't type one.
        function start(brief: string) {
            setStarted(true);
            send(brief || 'Please draft a complete itinerary for my trip.');
        }

        return (
            <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>✦ Draft my itinerary</div>
                    <button onClick={onClose} className="tw-link text-[12px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                </div>

                {/* conversation */}
                {messages.length > 0 && (
                    <div className="space-y-2 mb-3">
                        {messages.map((m, i) => (
                            <div key={i} className="text-[13px] rounded-lg px-3 py-2"
                                style={{
                                    background: m.role === 'user' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--ink) 4%, transparent)',
                                    color: 'var(--ink)',
                                    marginLeft: m.role === 'user' ? 'auto' : 0,
                                    maxWidth: '85%',
                                }}>
                                {m.content}
                            </div>
                        ))}
                        {busy && <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Thinking…</div>}
                    </div>
                )}

                {!started ? (
                    <div>
                        <p className="text-[12.5px] mb-2" style={{ color: 'var(--ink-soft)' }}>
                            Tell the co-pilot how you'd like the trip to feel (optional) — pace, interests, must-dos — or just draft.
                        </p>
                        <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={2}
                            placeholder="e.g. relaxed pace, love food & local culture, one big adventure day"
                            className="w-full p-2.5 rounded-lg text-[13px] mb-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', resize: 'none' }} />
                        <div className="flex gap-2 justify-end">
                            <button disabled={busy} onClick={() => start(input.trim())}
                                className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                                style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: busy ? 0.5 : 1 }}>
                                {busy ? 'Drafting…' : 'Draft it ✦'}
                            </button>
                        </div>
                    </div>
                ) : (
                    // Reply box for the mini-conversation (only appears if the AI asked something)
                    !busy && (
                        <div className="flex gap-2">
                            <input value={input} onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && input.trim()) send(input.trim()); }}
                                placeholder="Your answer…"
                                className="flex-1 p-2.5 rounded-lg text-[13px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
                            <button disabled={!input.trim()} onClick={() => send(input.trim())}
                                className="tw-btn text-[13px] font-semibold px-4 rounded-lg"
                                style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: input.trim() ? 1 : 0.5 }}>Send</button>
                        </div>
                    )
                )}
            </div>
        );
    }

    // ── Inline add-range form (replaces the browser prompt) ──────────────────────
    function AddRangeForm({
        unplanned, onAdd, onCancel,
    }: {
        unplanned: number[];
        onAdd: (startDay: number, endDay: number, name: string) => void;
        onCancel: () => void;
    }) {
        // Default bounds = first contiguous unplanned span.
        const defStart = unplanned[0] ?? 1;
        let defEnd = defStart;
        for (const d of unplanned) { if (d === defEnd + 1) defEnd = d; else if (d > defStart) break; }

        const [start, setStart] = useState(String(defStart));
        const [end, setEnd] = useState(String(defEnd));
        const [name, setName] = useState('');

        const field: React.CSSProperties = {
            background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)',
            borderRadius: 8, padding: '5px 7px', fontSize: 13, width: '100%',
        };
        const s = parseInt(start, 10), e = parseInt(end, 10);
        const valid = Number.isFinite(s) && Number.isFinite(e) && s >= 1 && e >= s;

        return (
            <div className="mt-1 p-2.5 rounded-lg" style={{ border: '1px solid var(--accent)', background: 'color-mix(in srgb, var(--accent) 4%, var(--surface))' }}>
                <input value={name} onChange={(ev) => setName(ev.target.value)} autoFocus
                    placeholder='Name (e.g. "Sea Days", "Tokyo")' style={{ ...field, marginBottom: 6 }} />
                <div className="flex items-center gap-2 mb-2">
                    <label className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>Days</label>
                    <input type="number" value={start} onChange={(ev) => setStart(ev.target.value)} style={{ ...field, width: 56 }} title="Start day" />
                    <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>to</span>
                    <input type="number" value={end} onChange={(ev) => setEnd(ev.target.value)} style={{ ...field, width: 56 }} title="End day" />
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} className="tw-link text-[12px] px-2 py-1" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
                    <button onClick={() => valid && onAdd(s, e, name.trim())} disabled={!valid}
                        className="tw-btn text-[12px] font-semibold px-3 py-1 rounded-lg"
                        style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: valid ? 1 : 0.5 }}>
                        Add range
                    </button>
                </div>
            </div>
        );
    }

    // ── Timeline view (Concept 2): connected spine, category-coloured nodes ──────
    function catColor(name: string | null): string {
        if (!name) return 'var(--ink-faint)';
        let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
        const P = ['var(--accent-deep)', 'var(--success)', 'var(--danger)',
            'color-mix(in srgb, var(--accent) 65%, var(--ink-soft))',
            'color-mix(in srgb, var(--success) 60%, var(--ink-soft))',
            'color-mix(in srgb, var(--accent-deep) 70%, var(--danger))'];
        return P[h % P.length];
    }

    function TimelinePanel({ bucket, roster, baseCurrency, assistCounts, onOpenAssist }: {
        bucket: BucketNode; roster: Traveler[]; baseCurrency: string;
        assistCounts?: Record<number, number>;
        onOpenAssist?: (activityId: number, name: string) => void;
    }) {
        const nameOf = (id: number) => roster.find((t) => t.traveler_id === id)?.traveler_name ?? '—';
        function resolved(a: ActivityRow): number | null {
            if (a.activity_cost == null) return null;
            return a.cost_type === 'per_person' ? a.activity_cost * (a.headcount && a.headcount > 0 ? a.headcount : 1) : a.activity_cost;
        }
        const colorFor = (a: ActivityRow) => catColor(catName(a));
        function catName(a: ActivityRow): string | null {
            if (a.category_id == null) return null;
            return bucket.categories.find((c) => c.category_id === a.category_id)?.category_name ?? null;
        }

        // Sort by time ONLY if every activity has a start_time; else keep manual order.
        const allTimed = bucket.activities.length > 0 && bucket.activities.every((a) => !!a.start_time);
        const items = allTimed
            ? [...bucket.activities].sort((x, y) => (x.start_time ?? '').localeCompare(y.start_time ?? ''))
            : [...bucket.activities].sort((x, y) => x.display_order - y.display_order);

        const activeTotal = bucket.total_base;

        return (
            <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                {/* header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
                    <div>
                        <div className="text-[16px] font-bold" style={{ color: 'var(--ink)' }}>
                            {bucket.kind === 'day' ? (bucket.title || `Day ${bucket.day_number}`) : (bucket.range_name || `Days ${bucket.start_day}–${bucket.end_day}`)}
                        </div>
                        <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                            {bucket.kind === 'day' ? `Day ${bucket.day_number}` : `Days ${bucket.start_day}–${bucket.end_day}`}
                            {bucket.status === 'confirmed' && <span className="ml-2" style={{ color: 'var(--success)' }}>· ✓ Completed</span>}
                        </div>
                    </div>
                    {activeTotal > 0 && (
                        <div className="ml-auto text-right">
                            <div className="text-[17px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>{baseCurrency} {activeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                            <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{bucket.activities.length} {bucket.activities.length === 1 ? 'activity' : 'activities'}</div>
                        </div>
                    )}
                </div>

                {/* spine */}
                <div className="px-5 py-5">
                    {items.length === 0 && (
                        <p className="text-[13px] text-center py-6" style={{ color: 'var(--ink-faint)' }}>Nothing planned yet. Switch to List view to add activities.</p>
                    )}
                    {items.map((a, i) => {
                        const cost = resolved(a);
                        const dot = colorFor(a);
                        const isLast = i === items.length - 1;
                        const cat = catName(a);
                        const payers = a.bearer_traveler_ids.map(nameOf);
                        return (
                            <div key={a.activity_id} className="flex gap-3" style={{ paddingBottom: isLast ? 0 : 18, opacity: a.is_active === 1 ? 1 : 0.5 }}>
                                {/* time column — only rendered when the day is fully timed */}
                                {allTimed && (
                                    <div className="text-[12px] text-right flex-shrink-0" style={{ width: 48, color: 'var(--ink-faint)', paddingTop: 1, fontVariantNumeric: 'tabular-nums' }}>
                                        {a.start_time}
                                    </div>
                                )}
                                {/* node + connecting line */}
                                <div className="relative flex-shrink-0 flex justify-center" style={{ width: 14 }}>
                                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: dot, border: '2px solid var(--surface)', boxShadow: `0 0 0 1.5px ${dot}`, marginTop: 3, zIndex: 1 }} />
                                    {!isLast && <div style={{ position: 'absolute', top: 3, bottom: -18, width: 2, background: 'var(--divider)' }} />}
                                </div>
                                {/* content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-[14.5px] font-medium" style={{ color: 'var(--ink)' }}>{a.activity_name}</span>
                                        {cost != null ? (
                                            <span className="ml-auto text-[13.5px] font-bold whitespace-nowrap" style={{ color: 'var(--accent-deep)' }}>
                                                {baseCurrency} {cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        ) : (
                                            <span className="ml-auto text-[12px]" style={{ color: 'var(--ink-faint)' }}>free</span>
                                        )}
                                        <button onClick={() => onOpenAssist?.(a.activity_id, a.activity_name)}
                                            className="tw-link text-[12px]" title={(assistCounts?.[a.activity_id] ?? 0) > 0 ? 'Saved help' : 'Ask'}
                                            style={{ color: (assistCounts?.[a.activity_id] ?? 0) > 0 ? 'var(--accent-deep)' : 'var(--ink-faint)' }}>
                                            {(assistCounts?.[a.activity_id] ?? 0) > 0 ? `✨ ${assistCounts![a.activity_id]}` : '✨'}
                                        </button>
                                    </div>
                                    <div className="text-[12px] mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--ink-faint)' }}>
                                        {!allTimed && a.start_time && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{a.start_time}</span>}
                                        {cat && <span>{cat}</span>}
                                        {payers.length > 0 && <span>{payers.join(', ')}</span>}
                                        {cost != null && a.currency_code && a.currency_code !== baseCurrency && (
                                            <span>{a.currency_code} {a.activity_cost}</span>
                                        )}
                                        {a.cost_type === 'per_person' && cost != null && <span>({a.headcount || 1}p)</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
}