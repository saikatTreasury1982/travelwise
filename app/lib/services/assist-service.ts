// app/lib/services/assist-service.ts
// Activity Assist (ADR-015): saved AI help per itinerary activity.
// Not financial — never touches expenses. Reads are offline-safe (pure DB).
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';
import type { InValue } from '@libsql/client';

export type AssistType = 'getting_here' | 'food' | 'timing' | 'tips' | 'note';
export const ASSIST_TYPES: AssistType[] = ['getting_here', 'food', 'timing', 'tips', 'note'];

export interface AssistItem {
  assist_id: number;
  assist_type: AssistType;
  title: string;
  summary: string;
  created_at: string;
}

/** Save an AI-summarised assist note on an activity (multiple per type allowed). */
export async function saveAssist(
  ctx: TenantContext, tripId: number, activityId: number,
  input: { assist_type: AssistType; title: string; summary: string },
): Promise<number> {
  // Resolve itinerary_id from the activity (and confirm it belongs to this trip/tenant).
  const owns = await scopedQuery(
    ctx,
    `SELECT itinerary_id FROM itinerary_activities WHERE {{tenant}} AND trip_id = ? AND activity_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  if (owns.length === 0) throw new Error('Activity not found.');
  const itineraryId = Number(owns[0].itinerary_id);

  const type: AssistType = ASSIST_TYPES.includes(input.assist_type) ? input.assist_type : 'note';

  await scopedInsert(ctx, 'activity_assists', {
    itinerary_id: itineraryId,
    activity_id: activityId,
    assist_type: type,
    title: input.title.slice(0, 120),
    summary: input.summary,
  });

  const idRows = await scopedQuery(
    ctx,
    `SELECT assist_id FROM activity_assists WHERE {{tenant}} AND activity_id = ?
     ORDER BY assist_id DESC LIMIT 1`,
    [activityId],
  );
  return Number(idRows[0].assist_id);
}

/** All saved assists for one activity, newest first (offline-safe read). */
export async function listAssists(ctx: TenantContext, tripId: number, activityId: number): Promise<AssistItem[]> {
  const owns = await scopedQuery(
    ctx, `SELECT 1 AS ok FROM itinerary_activities WHERE {{tenant}} AND trip_id = ? AND activity_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  if (owns.length === 0) return [];

  const rows = await scopedQuery(
    ctx,
    `SELECT assist_id, assist_type, title, summary, created_at
     FROM activity_assists WHERE {{tenant}} AND activity_id = ?
     ORDER BY assist_id DESC`,
    [activityId],
  );
  return rows.map((r) => ({
    assist_id: Number(r.assist_id),
    assist_type: String(r.assist_type) as AssistType,
    title: String(r.title),
    summary: String(r.summary),
    created_at: r.created_at == null ? '' : String(r.created_at),
  }));
}

export async function deleteAssist(ctx: TenantContext, tripId: number, activityId: number, assistId: number): Promise<void> {
  // Scoped by activity too, so a bad id can't touch another activity's rows.
  await scopedExecute(
    ctx,
    `DELETE FROM activity_assists WHERE {{tenant}} AND activity_id = ? AND assist_id = ?`,
    [activityId, assistId] as InValue[],
  );
}

/** Per-activity assist counts for a whole itinerary — powers the ✨ badges.
 *  Returns { [activity_id]: { total, byType: {getting_here, food, timing, tips, note} } }.
 *  One query. */
export interface AssistCounts { total: number; byType: Record<AssistType, number>; }
export async function assistCountsForItinerary(
  ctx: TenantContext, itineraryId: number,
): Promise<Record<number, AssistCounts>> {
  const rows = await scopedQuery(
    ctx,
    `SELECT activity_id, assist_type, COUNT(*) AS n
     FROM activity_assists WHERE {{tenant}} AND itinerary_id = ?
     GROUP BY activity_id, assist_type`,
    [itineraryId],
  );
  const out: Record<number, AssistCounts> = {};
  for (const r of rows) {
    const aid = Number(r.activity_id);
    const type = String(r.assist_type) as AssistType;
    const n = Number(r.n);
    if (!out[aid]) out[aid] = { total: 0, byType: { getting_here: 0, food: 0, timing: 0, tips: 0, note: 0 } };
    out[aid].total += n;
    if (ASSIST_TYPES.includes(type)) out[aid].byType[type] += n;
  }
  return out;
}

// ── Context assembly for the AI (trip + lodging "from" location) ────────────
export async function buildAssistContext(ctx: TenantContext, tripId: number, activityId: number): Promise<{
  activityName: string; dayLabel: string; destination: string; lodging: string | null;
  tripDates: string; travelers: number; otherActivities: string[];
} | null> {
  const a = await scopedQuery(
    ctx,
    `SELECT a.activity_name, a.itinerary_id, a.day_id, a.day_range_id,
            d.title AS day_title, d.day_number, r.range_name
     FROM itinerary_activities a
     LEFT JOIN itinerary_days d ON d.day_id = a.day_id
     LEFT JOIN itinerary_day_ranges r ON r.day_range_id = a.day_range_id
     WHERE {{tenant:a}} AND a.trip_id = ? AND a.activity_id = ? LIMIT 1`,
    [tripId, activityId],
  );
  if (!a[0]) return null;
  const row = a[0];

  const trip = await scopedQuery(
    ctx, `SELECT start_date, end_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`, [tripId],
  );
  const dests = await scopedQuery(
    ctx, `SELECT city, country FROM trip_destinations WHERE {{tenant}} AND trip_id = ? ORDER BY display_order LIMIT 1`, [tripId],
  );
  const travs = await scopedQuery(
    ctx, `SELECT COUNT(*) AS n FROM trip_travelers WHERE {{tenant}} AND trip_id = ? AND is_active = 1`, [tripId],
  );
  // Lodging "from" — a confirmed/booked stay for this trip (name + area).
  const stay = await scopedQuery(
    ctx,
    `SELECT name, area FROM lodging_stays WHERE {{tenant}} AND trip_id = ? AND status = 'confirmed'
     ORDER BY booking_confirmed DESC, check_in LIMIT 1`,
    [tripId],
  );
  // Other activities same bucket.
  const others = await scopedQuery(
    ctx,
    row.day_id != null
      ? `SELECT activity_name FROM itinerary_activities WHERE {{tenant}} AND day_id = ? AND activity_id != ?`
      : `SELECT activity_name FROM itinerary_activities WHERE {{tenant}} AND day_range_id = ? AND activity_id != ?`,
    [row.day_id != null ? Number(row.day_id) : Number(row.day_range_id), activityId],
  );

  const destCity = dests[0] ? (dests[0].city ? String(dests[0].city) : String(dests[0].country)) : 'the destination';
  const lodging = stay[0]?.name
    ? `${String(stay[0].name)}${stay[0].area ? `, ${String(stay[0].area)}` : ''}`
    : null;
  const dayLabel = row.day_id != null
    ? (row.day_title ? String(row.day_title) : `Day ${row.day_number}`)
    : (row.range_name ? String(row.range_name) : 'Your stay');

  return {
    activityName: String(row.activity_name),
    dayLabel,
    destination: destCity,
    lodging,
    tripDates: trip[0] ? `${String(trip[0].start_date)} – ${String(trip[0].end_date)}` : '',
    travelers: Number(travs[0]?.n ?? 1),
    otherActivities: others.map((o) => String(o.activity_name)).slice(0, 6),
  };
}