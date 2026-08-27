// app/lib/services/trip-status.ts
import { scopedQuery, scopedExecute, type TenantContext } from '@/app/lib/db/scoped';

// Status codes (trip_status): 1=draft, 2=active, 3=completed, 4=suspended
export const TRIP_STATUS = {
    DRAFT: 1,
    ACTIVE: 2,
    COMPLETED: 3,
    SUSPENDED: 4,
} as const;

/**
 * Compute-on-read, self-healing trip status (ADR-006 Amendment B, Option A).
 *
 * Resolution order:
 *   1. Suspended (stored) → frozen, always kept as-is.
 *   2. today > end_date   → Completed.
 *   3. any planning activity exists (flight/lodging/itinerary/adhoc/checklist) → Active.
 *   4. else → Draft.
 *
 * If the resolved code differs from the stored code AND the stored code is not
 * Suspended, the new code is persisted (self-healing). Suspended never auto-heals.
 */
export async function resolveTripStatus(
    ctx: TenantContext,
    trip: { trip_id: number; status_code: number; end_date: string | null },
): Promise<number> {
    // 1. Suspended is frozen — never recompute.
    if (trip.status_code === TRIP_STATUS.SUSPENDED) {
        return TRIP_STATUS.SUSPENDED;
    }

    let resolved: number;

    // 2. Completed by date (end_date is in the past).
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    if (trip.end_date && trip.end_date < today) {
        resolved = TRIP_STATUS.COMPLETED;
    } else {
        // 3. Active if any planning activity exists.
        const active = await hasPlanningActivity(ctx, trip.trip_id);
        resolved = active ? TRIP_STATUS.ACTIVE : TRIP_STATUS.DRAFT;
    }

    // Self-heal: persist if changed (and not overriding a Suspended state).
    if (resolved !== trip.status_code) {
        await scopedExecute(
            ctx,
            `UPDATE trips SET status_code = ? WHERE {{tenant}} AND trip_id = ?`,
            [resolved, trip.trip_id],
        );
    }

    return resolved;
}

/**
 * True if the trip has any planning content across the built modules.
 *
 * Only tables that EXIST today are queried: expenses (ad-hoc) + checklist_items.
 * Flights / lodging / itinerary are pending (ADR-010) — uncomment each line
 * when that module's table is built, no other change needed here.
 *
 * Single round-trip via UNION ALL — returns the first existing row and stops.
 */
async function hasPlanningActivity(ctx: TenantContext, tripId: number): Promise<boolean> {
    const rows = await scopedQuery<{ n: number }>(
        ctx,
        `SELECT 1 AS n FROM expenses
       WHERE {{tenant}} AND trip_id = ? AND source_module = 'adhoc'
     UNION ALL
     SELECT 1 AS n FROM checklist_items
       WHERE trip_id IN (SELECT trip_id FROM trips WHERE {{tenant}} AND trip_id = ?)
     -- UNION ALL SELECT 1 AS n FROM flights         WHERE {{tenant}} AND trip_id = ?
     -- UNION ALL SELECT 1 AS n FROM lodging         WHERE {{tenant}} AND trip_id = ?
     -- UNION ALL SELECT 1 AS n FROM itinerary_items WHERE {{tenant}} AND trip_id = ?
     LIMIT 1`,
        [tripId, tripId],
    );
    return rows.length > 0;
}