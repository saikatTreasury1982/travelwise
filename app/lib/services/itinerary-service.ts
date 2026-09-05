// app/lib/services/itinerary-service.ts
// Itinerary module (ADR-014). Aggregate root `itineraries` → many per trip, one
// finalized. Activity = priced atom; category = display-only grouping.
// Two-gate emit: itinerary.is_finalized=1 AND day/range.status='confirmed'
//                AND activity is_active + cost>0 + ≥1 bearer.
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';
import { createExpense, updateExpense, deleteExpense, getTripBaseCurrency } from '@/app/lib/services/expense-service';
import type { InValue } from '@libsql/client';

export type ItineraryMode = 'day' | 'range';
export type PlanStatus = 'planning' | 'confirmed';
export type CostType = 'total' | 'per_person';

// ── Root CRUD ───────────────────────────────────────────────────────────────

/** Create a new itinerary for a trip. The FIRST itinerary a trip gets is
 *  auto-finalized (nothing to compete with); later ones start non-finalized. */
export async function createItinerary(
  ctx: TenantContext, tripId: number,
  input: { mode: ItineraryMode; title?: string | null; summary?: string | null; source?: 'manual' | 'ai' } = { mode: 'day' },
): Promise<number> {
  const existing = await scopedQuery(
    ctx, `SELECT COUNT(*) AS n FROM itineraries WHERE {{tenant}} AND trip_id = ?`, [tripId],
  );
  const isFirst = Number(existing[0]?.n ?? 0) === 0;

  await scopedInsert(ctx, 'itineraries', {
    trip_id: tripId,
    mode: input.mode,
    title: input.title ?? null,
    summary: input.summary ?? null,
    source: input.source ?? 'manual',
    is_finalized: isFirst ? 1 : 0,
    generated_at: input.source === 'ai' ? new Date().toISOString() : null,
  });

  const idRows = await scopedQuery(
    ctx, `SELECT itinerary_id FROM itineraries WHERE {{tenant}} AND trip_id = ?
          ORDER BY itinerary_id DESC LIMIT 1`, [tripId],
  );
  return Number(idRows[0].itinerary_id);
}

/** Rename/retitle/switch mode. Mode switch is allowed ONLY while the itinerary
 *  has no days/ranges (locked once content exists). */
export async function updateItinerary(
  ctx: TenantContext, tripId: number, itineraryId: number,
  input: { mode?: ItineraryMode; title?: string | null; summary?: string | null },
): Promise<void> {
  if (input.mode !== undefined) {
    const content = await scopedQuery(
      ctx,
      `SELECT
         (SELECT COUNT(*) FROM itinerary_days       WHERE {{tenant}} AND itinerary_id = ?) AS days,
         (SELECT COUNT(*) FROM itinerary_day_ranges WHERE {{tenant}} AND itinerary_id = ?) AS ranges`,
      [itineraryId, itineraryId],
    );
    const hasContent = Number(content[0]?.days ?? 0) + Number(content[0]?.ranges ?? 0) > 0;
    if (hasContent) throw new Error('Mode can only be changed while the itinerary is empty.');
  }

  await scopedExecute(
    ctx,
    `UPDATE itineraries SET
       mode = COALESCE(?, mode),
       title = ?,
       summary = ?,
       updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND itinerary_id = ?`,
    [input.mode ?? null, input.title ?? null, input.summary ?? null, tripId, itineraryId] as InValue[],
  );
}

/** List a trip's itineraries (newest first), with which one is finalized. */
export async function listItineraries(ctx: TenantContext, tripId: number) {
  const rows = await scopedQuery(
    ctx,
    `SELECT itinerary_id, mode, title, summary, source, is_finalized, generated_at, created_at
     FROM itineraries WHERE {{tenant}} AND trip_id = ?
     ORDER BY is_finalized DESC, itinerary_id DESC`,
    [tripId],
  );
  return rows.map((r) => ({
    itinerary_id: Number(r.itinerary_id),
    mode: String(r.mode) as ItineraryMode,
    title: r.title == null ? null : String(r.title),
    summary: r.summary == null ? null : String(r.summary),
    source: String(r.source),
    is_finalized: Number(r.is_finalized ?? 0),
    generated_at: r.generated_at == null ? null : String(r.generated_at),
    created_at: r.created_at == null ? null : String(r.created_at),
  }));
}

/** Delete an itinerary. FK cascade removes the whole tree (days/ranges/
 *  categories/activities/bearers/links). But emitted expenses hang off the
 *  TRIP, not the itinerary subtree — so we must delete them here first. */
export async function deleteItinerary(ctx: TenantContext, tripId: number, itineraryId: number): Promise<void> {
  // 1. Remove any expenses this itinerary's activities emitted.
  const activityIds = await scopedQuery(
    ctx, `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  for (const a of activityIds) {
    const expId = await findActivityExpenseId(ctx, tripId, Number(a.activity_id));
    if (expId != null) await deleteExpense(ctx, tripId, expId);
  }
  // 2. Delete the root — FK ON DELETE CASCADE sweeps the rest of the tree.
  await scopedExecute(
    ctx, `DELETE FROM itineraries WHERE {{tenant}} AND trip_id = ? AND itinerary_id = ?`, [tripId, itineraryId],
  );
}

/** Make `itineraryId` the sole finalized plan for the trip and re-sync the
 *  forecast: un-finalize others, finalize this one, then rebuild all
 *  source_module='itinerary' expenses from the finalized plan's confirmed activities. */
export async function finalizeItinerary(ctx: TenantContext, tripId: number, itineraryId: number): Promise<void> {
  // Exclusive swap (partial unique index guards against two finalized at once).
  await scopedExecute(
    ctx, `UPDATE itineraries SET is_finalized = 0, updated_at = datetime('now')
          WHERE {{tenant}} AND trip_id = ? AND is_finalized = 1`, [tripId],
  );
  await scopedExecute(
    ctx, `UPDATE itineraries SET is_finalized = 1, updated_at = datetime('now')
          WHERE {{tenant}} AND trip_id = ? AND itinerary_id = ?`, [tripId, itineraryId],
  );

  // Forecast re-sync: wipe all itinerary expenses for the trip, re-emit from the finalized plan.
  const existing = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses WHERE {{tenant}} AND trip_id = ? AND source_module = 'itinerary'`,
    [tripId],
  );
  for (const e of existing) await deleteExpense(ctx, tripId, Number(e.expense_id));

  const activityIds = await scopedQuery(
    ctx,
    `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?`,
    [itineraryId],
  );
  for (const a of activityIds) await syncExpenseForActivity(ctx, tripId, Number(a.activity_id));
}

// Forward declarations used above — implemented in later parts of this file.
// (findActivityExpenseId, syncExpenseForActivity)

// ── Days & ranges ─────────────────────────────────────────────────────────

function daysBetweenInclusive(startDate: string, endDate: string): number {
  const a = new Date(startDate + 'T00:00:00').getTime();
  const b = new Date(endDate + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return Math.round((b - a) / 86400000) + 1;   // inclusive
}
function addDays(startDate: string, n: number): string {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Seed day-mode: create one itinerary_day per calendar day of the trip.
 *  Idempotent — skips any day_number that already exists. */
export async function seedDays(ctx: TenantContext, tripId: number, itineraryId: number): Promise<void> {
  const trip = await scopedQuery(
    ctx, `SELECT start_date, end_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`, [tripId],
  );
  if (!trip[0]) throw new Error('Trip not found.');
  const start = String(trip[0].start_date), end = String(trip[0].end_date);
  const total = daysBetweenInclusive(start, end);

  const existing = await scopedQuery(
    ctx, `SELECT day_number FROM itinerary_days WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  const have = new Set(existing.map((r) => Number(r.day_number)));

  for (let i = 0; i < total; i++) {
    const dayNumber = i + 1;
    if (have.has(dayNumber)) continue;
    await scopedInsert(ctx, 'itinerary_days', {
      trip_id: tripId, itinerary_id: itineraryId,
      day_number: dayNumber, day_date: addDays(start, i),
      title: null, status: 'planning',
    });
  }
}

export async function updateDay(
  ctx: TenantContext, tripId: number, dayId: number, input: { title?: string | null },
): Promise<void> {
  await scopedExecute(
    ctx,
    `UPDATE itinerary_days SET title = ?, updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND day_id = ?`,
    [input.title ?? null, tripId, dayId] as InValue[],
  );
}

/** Create a named range over start_day..end_day (range-mode). */
export async function createRange(
  ctx: TenantContext, tripId: number, itineraryId: number,
  input: { start_day: number; end_day: number; range_name?: string | null; description?: string | null },
): Promise<number> {
  if (input.end_day < input.start_day) throw new Error('Range end must be on or after its start.');
  const orderRows = await scopedQuery(
    ctx, `SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM itinerary_day_ranges
          WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  await scopedInsert(ctx, 'itinerary_day_ranges', {
    trip_id: tripId, itinerary_id: itineraryId,
    start_day: input.start_day, end_day: input.end_day,
    range_name: input.range_name ?? null, description: input.description ?? null,
    status: 'planning', display_order: Number(orderRows[0].next),
  });
  const idRows = await scopedQuery(
    ctx, `SELECT day_range_id FROM itinerary_day_ranges WHERE {{tenant}} AND itinerary_id = ?
          ORDER BY day_range_id DESC LIMIT 1`, [itineraryId],
  );
  return Number(idRows[0].day_range_id);
}

export async function updateRange(
  ctx: TenantContext, tripId: number, rangeId: number,
  input: { start_day?: number; end_day?: number; range_name?: string | null; description?: string | null },
): Promise<void> {
  if (input.start_day != null && input.end_day != null && input.end_day < input.start_day) {
    throw new Error('Range end must be on or after its start.');
  }
  await scopedExecute(
    ctx,
    `UPDATE itinerary_day_ranges SET
       start_day = COALESCE(?, start_day), end_day = COALESCE(?, end_day),
       range_name = ?, description = ?, updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND day_range_id = ?`,
    [input.start_day ?? null, input.end_day ?? null, input.range_name ?? null, input.description ?? null, tripId, rangeId] as InValue[],
  );
}

/** Delete a range. FK cascade removes its categories + activities; but the
 *  activities' emitted expenses hang off the trip, so clear them first. */
export async function deleteRange(ctx: TenantContext, tripId: number, rangeId: number): Promise<void> {
  const acts = await scopedQuery(
    ctx, `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND day_range_id = ?`, [rangeId],
  );
  for (const a of acts) {
    const expId = await findActivityExpenseId(ctx, tripId, Number(a.activity_id));
    if (expId != null) await deleteExpense(ctx, tripId, expId);
  }
  await scopedExecute(
    ctx, `DELETE FROM itinerary_day_ranges WHERE {{tenant}} AND trip_id = ? AND day_range_id = ?`, [tripId, rangeId],
  );
}

// ── Complete (the inner emit gate: status planning → confirmed) ─────────────

/** Flip a day to 'confirmed' (or back to 'planning'), then re-sync every
 *  activity under it so its costed activities emit (or stop emitting). */
export async function setDayStatus(
  ctx: TenantContext, tripId: number, dayId: number, status: PlanStatus,
): Promise<void> {
  await scopedExecute(
    ctx, `UPDATE itinerary_days SET status = ?, updated_at = datetime('now')
          WHERE {{tenant}} AND trip_id = ? AND day_id = ?`,
    [status, tripId, dayId] as InValue[],
  );
  const acts = await scopedQuery(
    ctx, `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND day_id = ?`, [dayId],
  );
  for (const a of acts) await syncExpenseForActivity(ctx, tripId, Number(a.activity_id));
}

/** Same for a range. */
export async function setRangeStatus(
  ctx: TenantContext, tripId: number, rangeId: number, status: PlanStatus,
): Promise<void> {
  await scopedExecute(
    ctx, `UPDATE itinerary_day_ranges SET status = ?, updated_at = datetime('now')
          WHERE {{tenant}} AND trip_id = ? AND day_range_id = ?`,
    [status, tripId, rangeId] as InValue[],
  );
  const acts = await scopedQuery(
    ctx, `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND day_range_id = ?`, [rangeId],
  );
  for (const a of acts) await syncExpenseForActivity(ctx, tripId, Number(a.activity_id));
}

// ── Activities (the priced atom) ────────────────────────────────────────────

export interface ActivityInput {
  activity_name: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_minutes?: number | null;
  activity_cost?: number | null;
  currency_code?: string | null;
  cost_type?: CostType;
  headcount?: number | null;
  is_active?: boolean;
  notes?: string | null;
  category_id?: number | null;   // null = ungrouped (the default)
}

/** Parent bucket: exactly one of dayId / rangeId (XOR, matches the trip's mode). */
type Bucket = { dayId: number; rangeId?: undefined } | { dayId?: undefined; rangeId: number };

/** Create an activity under a day OR a range. Bearers default to all trip
 *  cost-sharers unless an explicit list is given. */
export async function createActivity(
  ctx: TenantContext, tripId: number, itineraryId: number,
  bucket: Bucket, input: ActivityInput, bearerTravelerIds?: number[],
): Promise<number> {
  const dayId = bucket.dayId ?? null;
  const rangeId = bucket.rangeId ?? null;

  const orderRows = await scopedQuery(
    ctx,
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM itinerary_activities
     WHERE {{tenant}} AND ${dayId != null ? 'day_id = ?' : 'day_range_id = ?'}`,
    [dayId != null ? dayId : rangeId],
  );

  await scopedInsert(ctx, 'itinerary_activities', {
    trip_id: tripId, itinerary_id: itineraryId,
    day_id: dayId, day_range_id: rangeId,
    category_id: input.category_id ?? null,
    activity_name: input.activity_name,
    start_time: input.start_time ?? null,
    end_time: input.end_time ?? null,
    duration_minutes: input.duration_minutes ?? null,
    activity_cost: input.activity_cost ?? null,
    currency_code: input.currency_code ?? null,
    cost_type: input.cost_type ?? 'total',
    headcount: input.headcount ?? null,
    is_active: input.is_active === false ? 0 : 1,
    is_completed: 0,
    notes: input.notes ?? null,
    display_order: Number(orderRows[0].next),
  });

  const idRows = await scopedQuery(
    ctx,
    `SELECT activity_id FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?
     ORDER BY activity_id DESC LIMIT 1`,
    [itineraryId],
  );
  const activityId = Number(idRows[0].activity_id);

  // Default bearers to all trip cost-sharers unless caller specified.
  const ids = bearerTravelerIds ?? (await defaultCostSharerIds(ctx, tripId));
  await setActivityBearers(ctx, tripId, activityId, ids);   // this also re-syncs the expense

  return activityId;
}

export async function updateActivity(
  ctx: TenantContext, tripId: number, activityId: number, input: ActivityInput,
): Promise<void> {
  await scopedExecute(
    ctx,
    `UPDATE itinerary_activities SET
       activity_name = ?, start_time = ?, end_time = ?, duration_minutes = ?,
       activity_cost = ?, currency_code = ?, cost_type = ?, headcount = ?,
       is_active = ?, notes = ?, category_id = ?, updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND activity_id = ?`,
    [
      input.activity_name, input.start_time ?? null, input.end_time ?? null, input.duration_minutes ?? null,
      input.activity_cost ?? null, input.currency_code ?? null, input.cost_type ?? 'total', input.headcount ?? null,
      input.is_active === false ? 0 : 1, input.notes ?? null, input.category_id ?? null,
      tripId, activityId,
    ] as InValue[],
  );
  await syncExpenseForActivity(ctx, tripId, activityId);
}

export async function deleteActivity(ctx: TenantContext, tripId: number, activityId: number): Promise<void> {
  const expId = await findActivityExpenseId(ctx, tripId, activityId);
  if (expId != null) await deleteExpense(ctx, tripId, expId);
  // FK cascade removes bearers + links.
  await scopedExecute(
    ctx, `DELETE FROM itinerary_activities WHERE {{tenant}} AND trip_id = ? AND activity_id = ?`, [tripId, activityId],
  );
}

/** Toggle the day-of completion flag. Non-financial → does not touch the forecast. */
export async function setActivityCompleted(
  ctx: TenantContext, tripId: number, activityId: number, completed: boolean,
): Promise<void> {
  await scopedExecute(
    ctx, `UPDATE itinerary_activities SET is_completed = ?, updated_at = datetime('now')
          WHERE {{tenant}} AND trip_id = ? AND activity_id = ?`,
    [completed ? 1 : 0, tripId, activityId] as InValue[],
  );
}

// ── Bearers ─────────────────────────────────────────────────────────────────

/** Active cost-sharers on the trip (the eligible bearer set + the default). */
async function defaultCostSharerIds(ctx: TenantContext, tripId: number): Promise<number[]> {
  const rows = await scopedQuery(
    ctx,
    `SELECT traveler_id FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_active = 1 AND is_cost_sharer = 1`,
    [tripId],
  );
  return rows.map((r) => Number(r.traveler_id));
}

/** Replace an activity's bearers (cost-sharers only), then re-sync its expense. */
export async function setActivityBearers(
  ctx: TenantContext, tripId: number, activityId: number, travelerIds: number[],
): Promise<void> {
  const owns = await scopedQuery(
    ctx, `SELECT itinerary_id FROM itinerary_activities WHERE {{tenant}} AND trip_id = ? AND activity_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  if (owns.length === 0) throw new Error('Activity not found.');
  const itineraryId = Number(owns[0].itinerary_id);

  const eligible = new Set(await defaultCostSharerIds(ctx, tripId));
  const ids = [...new Set(travelerIds)].filter((id) => eligible.has(id));

  await scopedExecute(ctx, `DELETE FROM itinerary_activity_bearers WHERE {{tenant}} AND activity_id = ?`, [activityId]);
  for (const tid of ids) {
    await scopedInsert(ctx, 'itinerary_activity_bearers', {
      activity_id: activityId, traveler_id: tid, itinerary_id: itineraryId,
    });
  }
  await syncExpenseForActivity(ctx, tripId, activityId);
}

// ── Drag-sort (display_order) ────────────────────────────────────────────────

/** Persist a new activity order within a bucket. `orderedIds` = activity_ids
 *  in their new top-to-bottom order. Non-financial → no re-sync needed. */
export async function reorderActivities(
  ctx: TenantContext, tripId: number, orderedIds: number[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await scopedExecute(
      ctx, `UPDATE itinerary_activities SET display_order = ?, updated_at = datetime('now')
            WHERE {{tenant}} AND trip_id = ? AND activity_id = ?`,
      [i, tripId, orderedIds[i]] as InValue[],
    );
  }
}

/** Persist a new category order within a day/range. */
export async function reorderCategories(
  ctx: TenantContext, tripId: number, orderedIds: number[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await scopedExecute(
      ctx, `UPDATE itinerary_categories SET display_order = ?
            WHERE {{tenant}} AND trip_id = ? AND category_id = ?`,
      [i, tripId, orderedIds[i]] as InValue[],
    );
  }
}

/** Persist a new range order (range-mode left rail). orderedIds = day_range_ids top-to-bottom. */
export async function reorderRanges(
  ctx: TenantContext, tripId: number, orderedIds: number[],
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await scopedExecute(
      ctx, `UPDATE itinerary_day_ranges SET display_order = ?, updated_at = datetime('now')
            WHERE {{tenant}} AND trip_id = ? AND day_range_id = ?`,
      [i, tripId, orderedIds[i]] as InValue[],
    );
  }
}

// ── Categories (display-only grouping) ──────────────────────────────────────

/** Create a grouping category under a day OR range. No cost — display only. */
export async function createCategory(
  ctx: TenantContext, tripId: number, itineraryId: number,
  bucket: Bucket, input: { category_name: string; description?: string | null },
): Promise<number> {
  const dayId = bucket.dayId ?? null;
  const rangeId = bucket.rangeId ?? null;
  const orderRows = await scopedQuery(
    ctx,
    `SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM itinerary_categories
     WHERE {{tenant}} AND ${dayId != null ? 'day_id = ?' : 'day_range_id = ?'}`,
    [dayId != null ? dayId : rangeId],
  );
  await scopedInsert(ctx, 'itinerary_categories', {
    trip_id: tripId, itinerary_id: itineraryId,
    day_id: dayId, day_range_id: rangeId,
    category_name: input.category_name, description: input.description ?? null,
    display_order: Number(orderRows[0].next),
  });
  const idRows = await scopedQuery(
    ctx, `SELECT category_id FROM itinerary_categories WHERE {{tenant}} AND itinerary_id = ?
          ORDER BY category_id DESC LIMIT 1`, [itineraryId],
  );
  return Number(idRows[0].category_id);
}

export async function updateCategory(
  ctx: TenantContext, tripId: number, categoryId: number,
  input: { category_name?: string; description?: string | null },
): Promise<void> {
  await scopedExecute(
    ctx,
    `UPDATE itinerary_categories SET
       category_name = COALESCE(?, category_name), description = ?
     WHERE {{tenant}} AND trip_id = ? AND category_id = ?`,
    [input.category_name ?? null, input.description ?? null, tripId, categoryId] as InValue[],
  );
}

/** Delete a category. FK sets its activities' category_id → NULL (ungrouped);
 *  activities and their expenses are untouched (display-only). */
export async function deleteCategory(ctx: TenantContext, tripId: number, categoryId: number): Promise<void> {
  await scopedExecute(
    ctx, `DELETE FROM itinerary_categories WHERE {{tenant}} AND trip_id = ? AND category_id = ?`, [tripId, categoryId],
  );
}

/** Assign a set of activities to a category (or ungroup with categoryId=null).
 *  Display-only → no expense re-sync. */
export async function assignActivitiesToCategory(
  ctx: TenantContext, tripId: number, activityIds: number[], categoryId: number | null,
): Promise<void> {
  for (const aid of activityIds) {
    await scopedExecute(
      ctx, `UPDATE itinerary_activities SET category_id = ?, updated_at = datetime('now')
            WHERE {{tenant}} AND trip_id = ? AND activity_id = ?`,
      [categoryId, tripId, aid] as InValue[],
    );
  }
}

/** Apply an AI (or manual) grouping proposal in one shot: create the named
 *  categories under a bucket and re-point the listed activities into them.
 *  Purely cosmetic — creates category rows + sets category_id, no cost math. */
export async function applyGrouping(
  ctx: TenantContext, tripId: number, itineraryId: number, bucket: Bucket,
  groups: { category_name: string; description?: string | null; activity_ids: number[] }[],
): Promise<void> {
  for (const g of groups) {
    const catId = await createCategory(ctx, tripId, itineraryId, bucket, {
      category_name: g.category_name, description: g.description ?? null,
    });
    await assignActivitiesToCategory(ctx, tripId, g.activity_ids, catId);
  }
}

// ── Emit reconciler (two-gate: finalized + confirmed) ────────────────────────

export async function findActivityExpenseId(ctx: TenantContext, tripId: number, activityId: number): Promise<number | null> {
  const rows = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses
     WHERE {{tenant}} AND trip_id = ? AND source_module = 'itinerary' AND source_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  return rows.length ? Number(rows[0].expense_id) : null;
}

/** Emit / update / remove the expense for ONE activity, applying BOTH gates:
 *  itinerary.is_finalized=1 AND its day/range.status='confirmed' AND
 *  activity is_active + resolved cost>0 + ≥1 bearer. Otherwise no expense. */
export async function syncExpenseForActivity(ctx: TenantContext, tripId: number, activityId: number): Promise<void> {
  const rows = await scopedQuery(
    ctx,
    `SELECT a.itinerary_id, a.day_id, a.day_range_id, a.activity_name,
            a.activity_cost, a.currency_code, a.cost_type, a.headcount, a.is_active,
            it.is_finalized,
            d.status  AS day_status,
            r.status  AS range_status
     FROM itinerary_activities a
     JOIN itineraries it ON it.itinerary_id = a.itinerary_id
     LEFT JOIN itinerary_days       d ON d.day_id       = a.day_id
     LEFT JOIN itinerary_day_ranges r ON r.day_range_id = a.day_range_id
     WHERE {{tenant:a}} AND a.trip_id = ? AND a.activity_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  const a = rows[0];
  const existingId = await findActivityExpenseId(ctx, tripId, activityId);

  if (!a) {
    if (existingId != null) await deleteExpense(ctx, tripId, existingId);
    return;
  }

  // Gates.
  const finalized = Number(a.is_finalized) === 1;
  const bucketStatus = a.day_id != null ? String(a.day_status) : String(a.range_status);
  const confirmed = bucketStatus === 'confirmed';
  const active = Number(a.is_active) === 1;

  // Resolved cost: per_person × headcount, else the flat total.
  const unit = a.activity_cost == null ? null : Number(a.activity_cost);
  const costType = String(a.cost_type ?? 'total') as CostType;
  const headcount = a.headcount == null ? null : Number(a.headcount);
  const total = unit == null ? null
    : costType === 'per_person' ? unit * (headcount && headcount > 0 ? headcount : 1)
      : unit;
  const currency = a.currency_code == null ? null : String(a.currency_code);

  const bearerRows = await scopedQuery(
    ctx, `SELECT traveler_id FROM itinerary_activity_bearers WHERE {{tenant}} AND activity_id = ?`, [activityId],
  );
  const bearerIds = bearerRows.map((r) => Number(r.traveler_id));

  const shouldEmit = finalized && confirmed && active
    && total != null && total > 0 && currency != null && bearerIds.length > 0;

  if (!shouldEmit) {
    if (existingId != null) await deleteExpense(ctx, tripId, existingId);
    return;
  }

  const description = `Itinerary · ${String(a.activity_name)}`;
  if (existingId == null) {
    await createExpense(ctx, {
      tripId, sourceModule: 'itinerary', sourceId: activityId,
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Itinerary', bearerTravelerIds: bearerIds, isActive: true,
    });
  } else {
    await updateExpense(ctx, tripId, existingId, {
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Itinerary', bearerTravelerIds: bearerIds, isActive: true,
    });
  }
}

// ── Reads ────────────────────────────────────────────────────────────────────

export interface ActivityRow {
  activity_id: number;
  category_id: number | null;
  activity_name: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  activity_cost: number | null;
  currency_code: string | null;
  cost_type: CostType;
  headcount: number | null;
  is_active: number;
  is_completed: number;
  notes: string | null;
  display_order: number;
  bearer_traveler_ids: number[];
}
export interface CategoryRow {
  category_id: number;
  category_name: string;
  description: string | null;
  display_order: number;
}
export interface BucketNode {
  kind: 'day' | 'range';
  day_id: number | null;
  day_range_id: number | null;
  day_number: number | null;      // day-mode
  day_date: string | null;        // day-mode
  start_day: number | null;       // range-mode
  end_day: number | null;         // range-mode
  range_name: string | null;      // range-mode
  title: string | null;           // day title / range name headline
  description: string | null;     // range description
  status: PlanStatus;
  display_order: number;
  categories: CategoryRow[];
  activities: ActivityRow[];       // ALL activities in the bucket (grouped + ungrouped); UI buckets by category_id
}
export interface ItineraryTree {
  itinerary_id: number;
  mode: ItineraryMode;
  title: string | null;
  summary: string | null;
  is_finalized: number;
  buckets: BucketNode[];
}

/** Bearers for a set of activity_ids, as a map. One query. */
async function bearersByActivity(ctx: TenantContext, itineraryId: number): Promise<Map<number, number[]>> {
  const rows = await scopedQuery(
    ctx, `SELECT activity_id, traveler_id FROM itinerary_activity_bearers WHERE {{tenant}} AND itinerary_id = ?`,
    [itineraryId],
  );
  const m = new Map<number, number[]>();
  for (const r of rows) {
    const aid = Number(r.activity_id);
    if (!m.has(aid)) m.set(aid, []);
    m.get(aid)!.push(Number(r.traveler_id));
  }
  return m;
}

function mapActivity(r: Record<string, unknown>, bearers: number[]): ActivityRow {
  return {
    activity_id: Number(r.activity_id),
    category_id: r.category_id == null ? null : Number(r.category_id),
    activity_name: String(r.activity_name),
    start_time: r.start_time == null ? null : String(r.start_time),
    end_time: r.end_time == null ? null : String(r.end_time),
    duration_minutes: r.duration_minutes == null ? null : Number(r.duration_minutes),
    activity_cost: r.activity_cost == null ? null : Number(r.activity_cost),
    currency_code: r.currency_code == null ? null : String(r.currency_code),
    cost_type: String(r.cost_type ?? 'total') as CostType,
    headcount: r.headcount == null ? null : Number(r.headcount),
    is_active: Number(r.is_active ?? 1),
    is_completed: Number(r.is_completed ?? 0),
    notes: r.notes == null ? null : String(r.notes),
    display_order: Number(r.display_order ?? 0),
    bearer_traveler_ids: bearers,
  };
}
function mapCategory(r: Record<string, unknown>): CategoryRow {
  return {
    category_id: Number(r.category_id),
    category_name: String(r.category_name),
    description: r.description == null ? null : String(r.description),
    display_order: Number(r.display_order ?? 0),
  };
}

/** The whole editable tree for one itinerary: day/range buckets (ordered),
 *  each with its categories and ALL its activities. The UI groups activities
 *  under categories by category_id and renders ungrouped (null) as "General". */
export async function getItineraryTree(ctx: TenantContext, tripId: number, itineraryId: number): Promise<ItineraryTree | null> {
  const it = await scopedQuery(
    ctx,
    `SELECT itinerary_id, mode, title, summary, is_finalized
     FROM itineraries WHERE {{tenant}} AND trip_id = ? AND itinerary_id = ? LIMIT 1`,
    [tripId, itineraryId],
  );
  if (!it[0]) return null;
  const mode = String(it[0].mode) as ItineraryMode;

  const bearerMap = await bearersByActivity(ctx, itineraryId);
  const cats = await scopedQuery(
    ctx,
    `SELECT category_id, day_id, day_range_id, category_name, description, display_order
     FROM itinerary_categories WHERE {{tenant}} AND itinerary_id = ?
     ORDER BY display_order, category_id`,
    [itineraryId],
  );
  const acts = await scopedQuery(
    ctx,
    `SELECT activity_id, day_id, day_range_id, category_id, activity_name, start_time, end_time,
            duration_minutes, activity_cost, currency_code, cost_type, headcount, is_active,
            is_completed, notes, display_order
     FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?
     ORDER BY display_order, activity_id`,
    [itineraryId],
  );

  const buckets: BucketNode[] = [];

  if (mode === 'day') {
    const days = await scopedQuery(
      ctx,
      `SELECT day_id, day_number, day_date, title, status
       FROM itinerary_days WHERE {{tenant}} AND itinerary_id = ? ORDER BY day_number`,
      [itineraryId],
    );
    for (const d of days) {
      const dayId = Number(d.day_id);
      buckets.push({
        kind: 'day', day_id: dayId, day_range_id: null,
        day_number: Number(d.day_number), day_date: String(d.day_date),
        start_day: null, end_day: null, range_name: null,
        title: d.title == null ? null : String(d.title), description: null,
        status: String(d.status) as PlanStatus, display_order: Number(d.day_number),
        categories: cats.filter((c) => Number(c.day_id) === dayId).map(mapCategory),
        activities: acts.filter((x) => Number(x.day_id) === dayId)
          .map((x) => mapActivity(x, bearerMap.get(Number(x.activity_id)) ?? [])),
      });
    }
  } else {
    const ranges = await scopedQuery(
      ctx,
      `SELECT day_range_id, start_day, end_day, range_name, description, status, display_order
       FROM itinerary_day_ranges WHERE {{tenant}} AND itinerary_id = ? ORDER BY display_order, start_day`,
      [itineraryId],
    );
    for (const r of ranges) {
      const rid = Number(r.day_range_id);
      buckets.push({
        kind: 'range', day_id: null, day_range_id: rid,
        day_number: null, day_date: null,
        start_day: Number(r.start_day), end_day: Number(r.end_day),
        range_name: r.range_name == null ? null : String(r.range_name),
        title: r.range_name == null ? null : String(r.range_name),
        description: r.description == null ? null : String(r.description),
        status: String(r.status) as PlanStatus, display_order: Number(r.display_order ?? 0),
        categories: cats.filter((c) => Number(c.day_range_id) === rid).map(mapCategory),
        activities: acts.filter((x) => Number(x.day_range_id) === rid)
          .map((x) => mapActivity(x, bearerMap.get(Number(x.activity_id)) ?? [])),
      });
    }
  }

  return {
    itinerary_id: itineraryId,
    mode,
    title: it[0].title == null ? null : String(it[0].title),
    summary: it[0].summary == null ? null : String(it[0].summary),
    is_finalized: Number(it[0].is_finalized ?? 0),
    buckets,
  };
}

/** Range-mode helper: which day numbers are NOT covered by any range
 *  (drives the "Unplanned days: 5–8 · + add a range" affordance). */
export async function getUnplannedDays(ctx: TenantContext, tripId: number, itineraryId: number): Promise<number[]> {
  const trip = await scopedQuery(
    ctx, `SELECT start_date, end_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`, [tripId],
  );
  if (!trip[0]) return [];
  const total = daysBetweenInclusive(String(trip[0].start_date), String(trip[0].end_date));

  const ranges = await scopedQuery(
    ctx, `SELECT start_day, end_day FROM itinerary_day_ranges WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  const covered = new Set<number>();
  for (const r of ranges) {
    for (let d = Number(r.start_day); d <= Number(r.end_day); d++) covered.add(d);
  }
  const gaps: number[] = [];
  for (let d = 1; d <= total; d++) if (!covered.has(d)) gaps.push(d);
  return gaps;
}

/** Hub card count: activities + whether the finalized plan has any confirmed content.
 *  Returns counts for the trip's FINALIZED itinerary (the one that feeds the forecast). */
export async function getItineraryCounts(
  ctx: TenantContext, tripId: number,
): Promise<{ hasItinerary: boolean; finalized: boolean; activityCount: number; confirmedActivityCount: number }> {
  const fin = await scopedQuery(
    ctx, `SELECT itinerary_id FROM itineraries WHERE {{tenant}} AND trip_id = ? AND is_finalized = 1 LIMIT 1`, [tripId],
  );
  const anyItin = await scopedQuery(
    ctx, `SELECT COUNT(*) AS n FROM itineraries WHERE {{tenant}} AND trip_id = ?`, [tripId],
  );
  const hasItinerary = Number(anyItin[0]?.n ?? 0) > 0;
  if (!fin[0]) return { hasItinerary, finalized: false, activityCount: 0, confirmedActivityCount: 0 };

  const itineraryId = Number(fin[0].itinerary_id);
  const all = await scopedQuery(
    ctx, `SELECT COUNT(*) AS n FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  // Confirmed = activities whose day/range status is 'confirmed'.
  const confirmed = await scopedQuery(
    ctx,
    `SELECT COUNT(*) AS n FROM itinerary_activities a
     LEFT JOIN itinerary_days       d ON d.day_id       = a.day_id
     LEFT JOIN itinerary_day_ranges r ON r.day_range_id = a.day_range_id
     WHERE {{tenant:a}} AND a.itinerary_id = ?
       AND COALESCE(d.status, r.status) = 'confirmed'`,
    [itineraryId],
  );
  return {
    hasItinerary,
    finalized: true,
    activityCount: Number(all[0]?.n ?? 0),
    confirmedActivityCount: Number(confirmed[0]?.n ?? 0),
  };
}

// ── AI draft: write a whole parsed itinerary in one go ──────────────────────

export interface DraftActivity {
  activity_name: string;
  start_time?: string | null;
  end_time?: string | null;
  estimated_cost?: number | null;
  cost_type?: CostType;
  headcount?: number | null;
  notes?: string | null;
}
export interface DraftCategory { category_name: string; activities: DraftActivity[]; }
export interface DraftDay {
  day_number: number;
  title?: string | null;
  categories?: DraftCategory[];
  ungrouped_activities?: DraftActivity[];
}
export interface DraftRange {
  start_day: number;
  end_day: number;
  range_name?: string | null;
  description?: string | null;
  categories?: DraftCategory[];
  ungrouped_activities?: DraftActivity[];
}
export interface DraftItinerary {
  mode: ItineraryMode;
  days?: DraftDay[];
  ranges?: DraftRange[];
}

/** Create a brand-new AI itinerary from a parsed draft. Always non-finalized
 *  (finalization is the user's call), everything 'planning' (nothing auto-
 *  confirmed → no forecast impact until the user completes days). Activities
 *  get the default cost-sharer bearer set. Currency defaults to base. */
export async function createItineraryFromDraft(
  ctx: TenantContext, tripId: number, draft: DraftItinerary,
  opts: { title?: string | null; summary?: string | null } = {},
): Promise<number> {
  const base = await getTripBaseCurrency(ctx, tripId);
  const defaultBearers = await defaultCostSharerIds(ctx, tripId);

  // Root — created explicitly non-finalized (override the auto-finalize-first rule).
  await scopedInsert(ctx, 'itineraries', {
    trip_id: tripId, mode: draft.mode,
    title: opts.title ?? null, summary: opts.summary ?? null,
    source: 'ai', is_finalized: 0, generated_at: new Date().toISOString(),
  });
  const idRows = await scopedQuery(
    ctx, `SELECT itinerary_id FROM itineraries WHERE {{tenant}} AND trip_id = ?
          ORDER BY itinerary_id DESC LIMIT 1`, [tripId],
  );
  const itineraryId = Number(idRows[0].itinerary_id);

  // Trip start for day dates.
  const trip = await scopedQuery(
    ctx, `SELECT start_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`, [tripId],
  );
  const tripStart = trip[0] ? String(trip[0].start_date) : null;

  // Helper: write a bucket's categories + ungrouped activities.
  async function writeBucketContent(
    bucket: { dayId?: number; rangeId?: number },
    categories: DraftCategory[] | undefined,
    ungrouped: DraftActivity[] | undefined,
  ) {
    const b = bucket.dayId != null ? { dayId: bucket.dayId } : { rangeId: bucket.rangeId! };
    // ungrouped first
    for (const a of ungrouped ?? []) {
      await writeDraftActivity(itineraryId, b, null, a);
    }
    // then each category + its activities
    for (const c of categories ?? []) {
      const catId = await createCategory(ctx, tripId, itineraryId, b, { category_name: c.category_name });
      for (const a of c.activities ?? []) {
        await writeDraftActivity(itineraryId, b, catId, a);
      }
    }
  }

  async function writeDraftActivity(
    itinId: number, bucket: { dayId?: number; rangeId?: number }, categoryId: number | null, a: DraftActivity,
  ) {
    await createActivity(ctx, tripId, itinId, (bucket.dayId != null ? { dayId: bucket.dayId } : { rangeId: bucket.rangeId! }), {
      activity_name: a.activity_name,
      start_time: a.start_time ?? null, end_time: a.end_time ?? null,
      activity_cost: a.estimated_cost ?? null,
      currency_code: a.estimated_cost != null ? base : null,
      cost_type: a.cost_type ?? 'total',
      headcount: a.headcount ?? null,
      is_active: true, notes: a.notes ?? null,
      category_id: categoryId,
    }, defaultBearers);
  }

  if (draft.mode === 'day') {
    for (const d of draft.days ?? []) {
      // Create the day (idempotent-ish: draft day_numbers are 1..N).
      const dayDate = tripStart ? addDays(tripStart, d.day_number - 1) : (tripStart ?? '');
      await scopedInsert(ctx, 'itinerary_days', {
        trip_id: tripId, itinerary_id: itineraryId,
        day_number: d.day_number, day_date: dayDate,
        title: d.title ?? null, status: 'planning',
      });
      const dayRows = await scopedQuery(
        ctx, `SELECT day_id FROM itinerary_days WHERE {{tenant}} AND itinerary_id = ? AND day_number = ? LIMIT 1`,
        [itineraryId, d.day_number],
      );
      const dayId = Number(dayRows[0].day_id);
      await writeBucketContent({ dayId }, d.categories, d.ungrouped_activities);
    }
  } else {
    for (const r of draft.ranges ?? []) {
      const rangeId = await createRange(ctx, tripId, itineraryId, {
        start_day: r.start_day, end_day: r.end_day,
        range_name: r.range_name ?? null, description: r.description ?? null,
      });
      await writeBucketContent({ rangeId }, r.categories, r.ungrouped_activities);
    }
  }

  return itineraryId;
}

// ── Spend-by-day/range for the FINALIZED itinerary (SpendRhythm chart) ──────
export interface SpendBucket {
  key: string;
  label: string;
  sublabel: string;
  amount_base: number;
  category: string | null;   // dominant category name (most base spend); null if ungrouped/none
}

export async function getItinerarySpendByDay(ctx: TenantContext, tripId: number): Promise<{ mode: ItineraryMode | null; base_currency: string; buckets: SpendBucket[] }> {
  const base = await getTripBaseCurrency(ctx, tripId);
  const fin = await scopedQuery(
    ctx, `SELECT itinerary_id, mode FROM itineraries WHERE {{tenant}} AND trip_id = ? AND is_finalized = 1 LIMIT 1`, [tripId],
  );
  if (!fin[0]) return { mode: null, base_currency: base, buckets: [] };
  const itineraryId = Number(fin[0].itinerary_id);
  const mode = String(fin[0].mode) as ItineraryMode;

  const acts = await scopedQuery(
    ctx,
    `SELECT day_id, day_range_id, category_id, activity_cost, currency_code, cost_type, headcount, is_active
     FROM itinerary_activities WHERE {{tenant}} AND itinerary_id = ?`,
    [itineraryId],
  );

  const catRows = await scopedQuery(
    ctx, `SELECT category_id, category_name FROM itinerary_categories WHERE {{tenant}} AND itinerary_id = ?`, [itineraryId],
  );
  const catName = new Map<number, string>();
  for (const c of catRows) catName.set(Number(c.category_id), String(c.category_name));

  const { convert } = await import('@/app/lib/services/fx');
  const perBucket = new Map<number, number>();
  const perBucketCat = new Map<number, Map<string, number>>();

  for (const a of acts) {
    if (Number(a.is_active ?? 1) !== 1 || a.activity_cost == null) continue;
    const unit = Number(a.activity_cost);
    const total = String(a.cost_type ?? 'total') === 'per_person'
      ? unit * (a.headcount && Number(a.headcount) > 0 ? Number(a.headcount) : 1) : unit;
    const cur = a.currency_code == null ? base : String(a.currency_code);
    const { baseAmount } = await convert(total, cur, base);
    const amt = baseAmount ?? total;
    const bid = mode === 'day' ? Number(a.day_id) : Number(a.day_range_id);
    perBucket.set(bid, (perBucket.get(bid) ?? 0) + amt);

    const cName = a.category_id != null ? (catName.get(Number(a.category_id)) ?? 'Other') : 'Other';
    if (!perBucketCat.has(bid)) perBucketCat.set(bid, new Map());
    const cm = perBucketCat.get(bid)!;
    cm.set(cName, (cm.get(cName) ?? 0) + amt);
  }

  const dominantCat = (bid: number): string | null => {
    const cm = perBucketCat.get(bid);
    if (!cm) return null;
    let best: string | null = null, bestAmt = -1;
    for (const [name, amt] of cm) { if (amt > bestAmt) { bestAmt = amt; best = name; } }
    return best === 'Other' ? null : best;
  };

  const buckets: SpendBucket[] = [];
  if (mode === 'day') {
    const days = await scopedQuery(
      ctx, `SELECT day_id, day_number, day_date FROM itinerary_days WHERE {{tenant}} AND itinerary_id = ? ORDER BY day_number`, [itineraryId],
    );
    for (const d of days) {
      const id = Number(d.day_id);
      buckets.push({ key: `d${id}`, label: String(d.day_number), sublabel: String(d.day_date), amount_base: perBucket.get(id) ?? 0, category: dominantCat(id) });
    }
  } else {
    const ranges = await scopedQuery(
      ctx, `SELECT day_range_id, start_day, end_day, range_name FROM itinerary_day_ranges WHERE {{tenant}} AND itinerary_id = ? ORDER BY display_order, start_day`, [itineraryId],
    );
    for (const r of ranges) {
      const id = Number(r.day_range_id);
      buckets.push({
        key: `r${id}`, label: r.range_name ? String(r.range_name) : `Days ${r.start_day}–${r.end_day}`,
        sublabel: `Days ${r.start_day}–${r.end_day}`, amount_base: perBucket.get(id) ?? 0, category: dominantCat(id),
      });
    }
  }

  return { mode, base_currency: base, buckets };
}