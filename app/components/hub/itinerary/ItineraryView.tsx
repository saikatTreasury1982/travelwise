'use client';
import { useState, useEffect, useCallback } from 'react';
import type { ActivityRow, CategoryRow } from '@/app/lib/services/itinerary-service';
import CurrencyCombobox from '@/app/components/ui/CurrencyCombobox';
import SpendRhythm from './SpendRhythm';

interface Traveler { traveler_id: number; traveler_name: string; is_primary: number; is_cost_sharer: number; is_active: number; }
interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Props {
    tripId: number;
    currencies: Currency[];
    baseCurrency: string;
    tripStart: string;
    tripEnd: string;
}

interface ItinListItem {
    itinerary_id: number; mode: 'day' | 'range'; title: string | null;
    summary: string | null; source: string; is_finalized: number;
}

export default function ItineraryView({ tripId, currencies, baseCurrency, tripStart, tripEnd }: Props) {
    const [loading, setLoading] = useState(true);
    const [itineraries, setItineraries] = useState<ItinListItem[]>([]);
    const [activeId, setActiveId] = useState<number | null>(null);
    const [roster, setRoster] = useState<Traveler[]>([]);
    const [creating, setCreating] = useState(false);

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

    async function createItinerary(mode: 'day' | 'range', source: 'manual' | 'ai') {
        setCreating(true);
        try {
            const res = await fetch(`/api/trips/${tripId}/itinerary`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, source }),
            });
            if (res.ok) {
                const { itinerary_id } = await res.json();
                setActiveId(itinerary_id);
                await loadList();
            }
        } finally { setCreating(false); }
    }

    if (loading) {
        return <p className="mt-8 text-[13px]" style={{ color: 'var(--ink-faint)' }}>Loading…</p>;
    }

    // ── Empty state: entry choice ─────────────────────────────────────────────
    if (itineraries.length === 0) {
        return (
            <div className="rounded-2xl p-8" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <h2 className="text-[18px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Start your itinerary</h2>
                <p className="text-[13px] mb-6" style={{ color: 'var(--ink-soft)' }}>
                    Plan day by day, or in named stretches (great for cruises or multi-city legs). You can change how it's built while it's still empty.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Build it myself */}
                    <div className="rounded-xl p-5" style={{ border: '1px solid var(--border)' }}>
                        <div className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>Build it myself</div>
                        <p className="text-[12.5px] mb-4" style={{ color: 'var(--ink-soft)' }}>Add your own activities. Group them later — the co-pilot can tidy them for you.</p>
                        <div className="flex gap-2">
                            <button disabled={creating} onClick={() => createItinerary('day', 'manual')}
                                className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                                style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Day by day</button>
                            <button disabled={creating} onClick={() => createItinerary('range', 'manual')}
                                className="tw-btn text-[13px] font-semibold px-4 py-2 rounded-lg"
                                style={{ background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}>By day-ranges</button>
                        </div>
                    </div>

                    {/* Let AI draft — placeholder until the draft door is built */}
                    <div className="rounded-xl p-5" style={{ border: '1px dashed var(--border)', opacity: 0.75 }}>
                        <div className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>✦ Let AI draft it</div>
                        <p className="text-[12.5px] mb-4" style={{ color: 'var(--ink-soft)' }}>The co-pilot proposes a full day-by-day plan with activities and estimated costs — coming soon.</p>
                        <button disabled className="text-[13px] font-semibold px-4 py-2 rounded-lg"
                            style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', color: 'var(--ink-faint)' }}>Coming soon</button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Has itinerary(ies): render the active one ─────────────────────────────
    return (
        <ItineraryEditor
            tripId={tripId}
            itineraryId={activeId!}
            itineraries={itineraries}
            onSwitch={setActiveId}
            onListChanged={loadList}
            roster={roster}
            currencies={currencies}
            baseCurrency={baseCurrency}
            tripStart={tripStart}
            tripEnd={tripEnd}
        />
    );
}

// Stub — filled in Part 2/3. Renders the navigator + bucket panel for one itinerary.
// ── Editor: navigator (left) + bucket panel (right) ──────────────────────────

import type { ItineraryTree, BucketNode } from '@/app/lib/services/itinerary-service';
// NOTE: type-only import; if your bundler complains, inline the shapes instead.

function ItineraryEditor({
    tripId, itineraryId, itineraries, onSwitch, onListChanged,
    roster, currencies, baseCurrency, tripStart, tripEnd,
}: {
    tripId: number; itineraryId: number; itineraries: ItinListItem[];
    onSwitch: (id: number) => void; onListChanged: () => void;
    roster: Traveler[]; currencies: Currency[]; baseCurrency: string;
    tripStart: string; tripEnd: string;
}) {
    const [tree, setTree] = useState<ItineraryTree | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeBucket, setActiveBucket] = useState<number>(0);   // index into buckets
    const [unplanned, setUnplanned] = useState<number[]>([]);
    const [addingRange, setAddingRange] = useState(false);
    const [localBuckets, setLocalBuckets] = useState<BucketNode[]>([]);
    const [view, setView] = useState<'list' | 'timeline' | 'story'>('list');

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
        fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/reorder`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind: 'range', ordered_ids: orderedIds }),
        }).then((res) => { if (!res.ok) loadTree(); }).catch(() => loadTree());
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
            {/* Plan bar: mode label · delete · (switcher/finalize when ≥2) */}
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
                    {itineraries.length > 1 && !finalized && (
                        <button onClick={async () => {
                            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/finalize`, { method: 'POST' });
                            onListChanged();
                        }} className="tw-link text-[12px] font-semibold" style={{ color: 'var(--success)' }}>
                            Finalize this plan →
                        </button>
                    )}
                    {itineraries.length > 1 && finalized && (
                        <span className="text-[12px]" style={{ color: 'var(--success)' }}>✓ Finalized · feeds your forecast</span>
                    )}
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
                    { k: 'story', label: 'Story' },
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
                        <div className="px-4 py-2.5 text-[11px] uppercase" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px', borderBottom: '1px solid var(--divider)' }}>
                            {tree.mode === 'day' ? `${buckets.length} days` : `${buckets.length} ${buckets.length === 1 ? 'stretch' : 'stretches'}`}
                        </div>
                        {buckets.map((b, i) => (
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

                                {/* Reorder arrows — range mode only */}
                                {isRange && buckets.length > 1 && (
                                    <div className="flex flex-col justify-center pr-2" style={{ gap: 2 }}>
                                        <button onClick={() => moveRange(i, -1)} disabled={i === 0}
                                            title="Move up" className="tw-link"
                                            style={{ fontSize: 11, lineHeight: 1, color: i === 0 ? 'var(--border)' : 'var(--ink-soft)', cursor: i === 0 ? 'default' : 'pointer' }}>▲</button>
                                        <button onClick={() => moveRange(i, 1)} disabled={i === buckets.length - 1}
                                            title="Move down" className="tw-link"
                                            style={{ fontSize: 11, lineHeight: 1, color: i === buckets.length - 1 ? 'var(--border)' : 'var(--ink-soft)', cursor: i === buckets.length - 1 ? 'default' : 'pointer' }}>▼</button>
                                    </div>
                                )}
                            </div>
                        ))}

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

                {/* ── Right: bucket panel ── */}
                <div style={{ flex: 1, minWidth: 320 }}>
                    {current ? (
                        <BucketPanel
                            key={current.kind === 'day' ? `d${current.day_id}` : `r${current.day_range_id}`}
                            tripId={tripId} itineraryId={itineraryId} bucket={current}
                            roster={roster} currencies={currencies} baseCurrency={baseCurrency}
                            onChanged={loadTree}
                        />
                    ) : (
                        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
                            <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>
                                {tree.mode === 'range' ? 'Add a range to start planning.' : 'No days yet.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
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
    tripId, itineraryId, bucket, roster, currencies, baseCurrency, onChanged,
}: {
    tripId: number; itineraryId: number; bucket: BucketNode;
    roster: Traveler[]; currencies: Currency[]; baseCurrency: string; onChanged: () => void;
}) {
    const [adding, setAdding] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
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
            await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/${statusPath}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'confirmed' }),
            });
            onChanged();
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
    const bucketTotal = bucket.activities
        .filter((a) => a.is_active === 1)
        .reduce((sum, a) => sum + (resolved(a) ?? 0), 0);

    // Group activities: by category_id, with null → "General".
    const cats = bucket.categories;
    const grouped: { cat: CategoryRow | null; items: ActivityRow[] }[] = [];
    const ungrouped = bucket.activities.filter((a) => a.category_id == null);
    if (ungrouped.length) grouped.push({ cat: null, items: ungrouped });
    for (const c of cats) {
        grouped.push({ cat: c, items: bucket.activities.filter((a) => a.category_id === c.category_id) });
    }

    async function del(activityId: number) {
        if (!confirm('Delete this activity? Its cost is removed from the forecast.')) return;
        await fetch(`/api/trips/${tripId}/itinerary/${itineraryId}/activities/${activityId}`, { method: 'DELETE' });
        onChanged();
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
                {bucketTotal > 0 && (
                    <span className="ml-auto text-[15px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>{money(bucketTotal)}</span>
                )}
            </div>

            {/* activity groups */}
            <div className="px-5 py-4">
                {bucket.activities.length === 0 && !adding && (
                    <p className="text-[13px] text-center py-6" style={{ color: 'var(--ink-faint)' }}>No activities yet. Add your first below.</p>
                )}

                {grouped.map((g) => (
                    <div key={g.cat ? `c${g.cat.category_id}` : 'ungrouped'} className="mb-4">
                        {g.cat && (
                            <div className="text-[11px] uppercase mb-2 font-semibold" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>
                                {g.cat.category_name} <span style={{ color: 'var(--ink-faint)', fontWeight: 400 }}>({g.items.length})</span>
                            </div>
                        )}
                        <div className="space-y-1.5">
                            {g.items.map((a) => (
                                editingId === a.activity_id ? (
                                    <ActivityForm key={a.activity_id}
                                        tripId={tripId} itineraryId={itineraryId} bucketBody={bucketBody}
                                        eligible={eligible} currencies={currencies} baseCurrency={baseCurrency}
                                        existing={a}
                                        onDone={() => { setEditingId(null); onChanged(); }}
                                        onCancel={() => setEditingId(null)} />
                                ) : (
                                    <div key={a.activity_id} className="rounded-lg px-3 py-2.5 flex items-center gap-3"
                                        style={{ border: '1px solid var(--border)', opacity: a.is_active === 1 ? 1 : 0.5 }}>
                                        <button onClick={() => toggleActive(a)} title={a.is_active === 1 ? 'Exclude from forecast' : 'Include in forecast'}
                                            className="tw-link text-[13px]" style={{ color: a.is_active === 1 ? 'var(--success)' : 'var(--ink-faint)' }}>
                                            {a.is_active === 1 ? '◉' : '○'}
                                        </button>
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
                                        <button onClick={() => setEditingId(a.activity_id)} className="tw-link text-[12px]" style={{ color: 'var(--accent-deep)' }}>Edit</button>
                                        <button onClick={() => del(a.activity_id)} className="tw-link text-[12px]" style={{ color: 'var(--ink-faint)' }}>🗑</button>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                ))}

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
            {groupPreview && groupPreview.length > 0 && (
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
            )}
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

// ── Timeline view (Concept 1): activities on a vertical time axis ────────────
const CAT_COLORS = ['var(--accent)', '#B4432B', '#2E7D5B', '#7C5CBF', '#3B7BB0', '#6E675E'];

function TimelinePanel({ bucket, roster, baseCurrency }: { bucket: BucketNode; roster: Traveler[]; baseCurrency: string; }) {
    const nameOf = (id: number) => roster.find((t) => t.traveler_id === id)?.traveler_name ?? '—';
    function resolved(a: ActivityRow): number | null {
        if (a.activity_cost == null) return null;
        return a.cost_type === 'per_person' ? a.activity_cost * (a.headcount && a.headcount > 0 ? a.headcount : 1) : a.activity_cost;
    }
    const catIndex = new Map<number, number>();
    bucket.categories.forEach((c, i) => catIndex.set(c.category_id, i));
    const colorFor = (a: ActivityRow) => a.category_id == null ? 'var(--ink-soft)' : CAT_COLORS[(catIndex.get(a.category_id) ?? 0) % CAT_COLORS.length];
    const catName = (a: ActivityRow) => a.category_id == null ? '' : (bucket.categories.find((c) => c.category_id === a.category_id)?.category_name ?? '');

    const sorted = [...bucket.activities].sort((x, y) => {
        if (x.start_time && y.start_time) return x.start_time.localeCompare(y.start_time);
        if (x.start_time) return -1;
        if (y.start_time) return 1;
        return x.display_order - y.display_order;
    });
    const activeTotal = bucket.activities.filter((a) => a.is_active === 1).reduce((s, a) => s + (resolved(a) ?? 0), 0);

    return (
        <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
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
                        <div className="text-[18px] font-extrabold" style={{ color: 'var(--accent-deep)' }}>{baseCurrency} {activeTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                        <div className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{bucket.activities.length} {bucket.activities.length === 1 ? 'activity' : 'activities'}</div>
                    </div>
                )}
            </div>

            <div className="px-5 py-4">
                {sorted.length === 0 && (
                    <p className="text-[13px] text-center py-6" style={{ color: 'var(--ink-faint)' }}>Nothing planned yet. Switch to List view to add activities.</p>
                )}
                {sorted.map((a) => {
                    const cost = resolved(a);
                    const color = colorFor(a);
                    const light = color === 'var(--accent)';
                    return (
                        <div key={a.activity_id} className="flex gap-3 items-stretch" style={{ minHeight: 48, opacity: a.is_active === 1 ? 1 : 0.5 }}>
                            <div className="text-[11px] pt-1 text-right flex-shrink-0" style={{ width: 46, color: 'var(--ink-faint)', fontVariantNumeric: 'tabular-nums' }}>
                                {a.start_time || '—'}
                            </div>
                            <div className="flex-1" style={{ borderLeft: '2px solid var(--divider)', paddingLeft: 14, paddingBottom: 10 }}>
                                <div className="rounded-[10px] px-3 py-2.5 relative" style={{ background: color, color: light ? 'var(--accent-ink)' : '#fff' }}>
                                    <div className="text-[13.5px] font-semibold">{a.activity_name}</div>
                                    <div className="text-[11px]" style={{ opacity: 0.9 }}>
                                        {catName(a)}{catName(a) && (a.bearer_traveler_ids.length || a.end_time) ? ' · ' : ''}
                                        {a.end_time ? `until ${a.end_time}` : ''}
                                        {a.bearer_traveler_ids.length > 0 ? `${a.end_time ? ' · ' : ''}${a.bearer_traveler_ids.map(nameOf).join(', ')}` : ''}
                                    </div>
                                    {cost != null && (
                                        <span className="absolute text-[12px] font-bold" style={{ top: 10, right: 12 }}>
                                            {baseCurrency} {cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            {a.currency_code && a.currency_code !== baseCurrency && (
                                                <span className="text-[10px] font-normal" style={{ opacity: 0.85 }}> ({a.currency_code} {a.activity_cost})</span>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// Stub — Story view (Part 3).
function StoryPanel({ bucket, baseCurrency }: { bucket: BucketNode; baseCurrency: string }) {
    return (
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>Story view — coming next.</p>
        </div>
    );
}