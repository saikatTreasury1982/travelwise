// app/lib/services/trip-service.ts
// Tenant-scoped trip persistence. The co-pilot calls saveTrip() once it has
// gathered enough info (name + start + end dates minimum). Writes trips +
// destinations + travelers in one transaction, all stamped with tenant_id.
import { db } from '../db/client';
import { scopedQuery, scopedExecute } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';
import { ensurePrimaryTraveler } from '@/app/lib/services/traveler-service';

// The structured trip the AI produces (and the form could produce too).
export interface TripDestinationInput {
  country: string;          // required (matches NOT NULL)
  city?: string | null;
  countryCode?: string | null;
  displayOrder?: number;
}
export interface TripTravelerInput {
  name: string;             // required
  email?: string | null;
  relationship?: number | null;   // FK code (1 Self, 2 Spouse, ...)
  isPrimary?: boolean;
  isCostSharer?: boolean;
  currency?: string | null;
}
export interface TripInput {
  name: string;             // required
  description?: string | null;
  startDate: string;        // required (YYYY-MM-DD)
  endDate: string;          // required
  budget?: number | null;
  budgetCurrency?: string | null;
  statusCode?: number;      // default 1 (draft)
  destinations?: TripDestinationInput[];
  travelers?: TripTravelerInput[];
}

export interface SavedTrip {
  tripId: number;
  name: string;
}

/** Validate the minimum-to-save contract. Throws with a user-facing message. */
function validate(input: TripInput): void {
  if (!input.name?.trim()) throw new Error('Trip needs a name.');
  if (!input.startDate) throw new Error('Trip needs a start date.');
  if (!input.endDate) throw new Error('Trip needs an end date.');
  if (input.endDate < input.startDate) throw new Error('End date cannot be before the start date.');
}

export async function saveTrip(ctx: TenantContext, input: TripInput): Promise<SavedTrip> {
  validate(input);

  const tx = await db.transaction('write');
  try {
    // 1. trips
    const tripRes = await tx.execute({
      sql: `INSERT INTO trips
              (tenant_id, account_id, user_id, trip_name, trip_description,
               start_date, end_date, status_code, trip_budget, budget_currency)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ctx.tenantId, ctx.accountId, ctx.userId,
        input.name.trim(), input.description ?? null,
        input.startDate, input.endDate,
        input.statusCode ?? 1,
        input.budget ?? null,
        input.budgetCurrency ?? null,
      ],
    });
    const tripId = Number(tripRes.lastInsertRowid);

    // 2. destinations
    if (input.destinations?.length) {
      for (let i = 0; i < input.destinations.length; i++) {
        const d = input.destinations[i];
        await tx.execute({
          sql: `INSERT INTO trip_destinations
                  (tenant_id, trip_id, country, city, country_code, display_order)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [ctx.tenantId, tripId, d.country, d.city ?? null, d.countryCode ?? null, d.displayOrder ?? i],
        });
      }
    }

    // 3. travelers
    if (input.travelers?.length) {
      for (const t of input.travelers) {
        await tx.execute({
          sql: `INSERT INTO trip_travelers
                  (tenant_id, trip_id, traveler_name, traveler_email, relationship,
                   is_primary, is_cost_sharer, traveler_currency)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            ctx.tenantId, tripId, t.name, t.email ?? null, t.relationship ?? null,
            t.isPrimary ? 1 : 0, t.isCostSharer ? 1 : 0, t.currency ?? null,
          ],
        });
      }
    }

    await tx.commit();
    // Every trip always has its primary traveller (the logged-in user).
    await ensurePrimaryTraveler(ctx, tripId);
    return { tripId, name: input.name.trim() };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** List the current tenant's trips with their destinations, for the cards view. */
export async function listTripsWithDetails(ctx: TenantContext) {
  const tripRows = await scopedQuery(
    ctx,
    `SELECT trip_id, trip_name, trip_description, start_date, end_date,
            status_code, trip_budget, budget_currency, created_at
     FROM trips WHERE {{tenant}} ORDER BY start_date DESC, created_at DESC`,
    []
  );

  const trips = [];
  for (const t of tripRows) {
    const destRows = await scopedQuery(
      ctx,
      `SELECT destination_id, country, country_code, city, display_order
       FROM trip_destinations WHERE {{tenant}} AND trip_id = ? ORDER BY display_order`,
      [Number(t.trip_id)]
    );
    const travCount = await scopedQuery(
      ctx,
      `SELECT COUNT(*) AS n FROM trip_travelers
       WHERE {{tenant}} AND trip_id = ? AND is_active = 1`,
      [Number(t.trip_id)]
    );
    trips.push({
      trip_id: Number(t.trip_id),
      trip_name: String(t.trip_name),
      trip_description: t.trip_description == null ? null : String(t.trip_description),
      start_date: String(t.start_date),
      end_date: String(t.end_date),
      status_code: t.status_code == null ? null : Number(t.status_code),
      trip_budget: t.trip_budget == null ? null : Number(t.trip_budget),
      budget_currency: t.budget_currency == null ? null : String(t.budget_currency),
      created_at: t.created_at == null ? null : String(t.created_at),
      traveler_count: Number(travCount[0]?.n ?? 0),
      destinations: destRows.map((d) => ({
        destination_id: Number(d.destination_id),
        country: String(d.country),
        country_code: d.country_code == null ? null : String(d.country_code),
        city: d.city == null ? null : String(d.city),
        display_order: Number(d.display_order),
      })),
    });
  }
  return trips;
}

/** Fetch one trip with all its details, tenant-scoped. Returns null if not found/not owned. */
export async function getTripDetail(ctx: TenantContext, tripId: number) {
  const tripRows = await scopedQuery(
    ctx,
    `SELECT trip_id, trip_name, trip_description, start_date, end_date,
            status_code, trip_budget, budget_currency, created_at, updated_at
     FROM trips WHERE {{tenant}} AND trip_id = ?`,
    [tripId]
  );
  const t = tripRows[0];
  if (!t) return null;

  const destRows = await scopedQuery(
    ctx,
    `SELECT destination_id, country, country_code, city, display_order,
            latitude, longitude
     FROM trip_destinations WHERE {{tenant}} AND trip_id = ? ORDER BY display_order`,
    [tripId]
  );

  const travRows = await scopedQuery(
    ctx,
    `SELECT tt.traveler_id, tt.traveler_name, tt.traveler_email, tt.relationship,
            tr.relationship_name, tt.is_primary, tt.is_cost_sharer,
            tt.traveler_currency, tt.is_active
     FROM trip_travelers tt
     LEFT JOIN traveler_relationships tr ON tr.relationship_code = tt.relationship
     WHERE {{tenant:tt}} AND tt.trip_id = ?
     ORDER BY tt.is_primary DESC, tt.is_active DESC, tt.traveler_id ASC`,
    [tripId]
  );

  const noteRows = await scopedQuery(
    ctx,
    `SELECT note_id, type_name, content, created_at, updated_at
     FROM trip_notes WHERE {{tenant}} AND trip_id = ?`,
    [tripId]
  );

  return {
    trip_id: Number(t.trip_id),
    trip_name: String(t.trip_name),
    trip_description: t.trip_description == null ? null : String(t.trip_description),
    start_date: String(t.start_date),
    end_date: String(t.end_date),
    status_code: t.status_code == null ? null : Number(t.status_code),
    trip_budget: t.trip_budget == null ? null : Number(t.trip_budget),
    budget_currency: t.budget_currency == null ? null : String(t.budget_currency),
    created_at: t.created_at == null ? null : String(t.created_at),
    updated_at: t.updated_at == null ? null : String(t.updated_at),
    destinations: destRows.map((d) => ({
      destination_id: Number(d.destination_id),
      country: String(d.country),
      country_code: d.country_code == null ? null : String(d.country_code),
      city: d.city == null ? null : String(d.city),
      display_order: Number(d.display_order),
      latitude: d.latitude == null ? null : Number(d.latitude),
      longitude: d.longitude == null ? null : Number(d.longitude),
    })),
    travelers: travRows.map((tr) => ({
      traveler_id: Number(tr.traveler_id),
      traveler_name: String(tr.traveler_name),
      traveler_email: tr.traveler_email == null ? null : String(tr.traveler_email),
      relationship: tr.relationship == null ? null : Number(tr.relationship),
      relationship_name: tr.relationship_name == null ? null : String(tr.relationship_name),
      is_primary: Number(tr.is_primary),
      is_cost_sharer: Number(tr.is_cost_sharer),
      traveler_currency: tr.traveler_currency == null ? null : String(tr.traveler_currency),
      is_active: Number(tr.is_active),
    })),
    notes: noteRows.map((n) => ({
      note_id: Number(n.note_id),
      type_name: String(n.type_name),
      content: String(n.content),
      created_at: n.created_at == null ? null : String(n.created_at),
      updated_at: n.updated_at == null ? null : String(n.updated_at),
    })),
  };
}

export interface TripUpdateInput {
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  budget?: number | null;
  budgetCurrency?: string | null;
  statusCode?: number;
}

/** Update core trip fields, tenant-scoped. Only updates provided fields.
 *  Returns false if the trip isn't found/owned by this tenant+user. */
export async function updateTrip(ctx: TenantContext, tripId: number, input: TripUpdateInput): Promise<boolean> {
  // Confirm ownership first (tenant + user).
  const owned = await db.execute({
    sql: `SELECT trip_id, start_date, end_date FROM trips WHERE trip_id = ? AND tenant_id = ? AND user_id = ? LIMIT 1`,
    args: [tripId, ctx.tenantId, ctx.userId],
  });
  if (owned.rows.length === 0) return false;
  const current = owned.rows[0] as unknown as { start_date: string; end_date: string };

  // Validate date order if either date is changing.
  const newStart = input.startDate ?? current.start_date;
  const newEnd = input.endDate ?? current.end_date;
  if (newEnd < newStart) throw new Error('End date cannot be before the start date.');

  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  const set = (col: string, val: string | number | null) => { sets.push(`${col} = ?`); args.push(val); };

  if (input.name !== undefined) set('trip_name', input.name.trim());
  if (input.description !== undefined) set('trip_description', input.description);
  if (input.startDate !== undefined) set('start_date', input.startDate);
  if (input.endDate !== undefined) set('end_date', input.endDate);
  if (input.budget !== undefined) set('trip_budget', input.budget);
  if (input.budgetCurrency !== undefined) set('budget_currency', input.budgetCurrency);
  if (input.statusCode !== undefined) set('status_code', input.statusCode);

  if (sets.length === 0) return true; // nothing to change
  set('updated_at', new Date().toISOString().replace('T', ' ').slice(0, 19));

  await db.execute({
    sql: `UPDATE trips SET ${sets.join(', ')} WHERE trip_id = ? AND tenant_id = ? AND user_id = ?`,
    args: [...args, tripId, ctx.tenantId, ctx.userId],
  });
  return true;
}

export async function addDestination(
  ctx: TenantContext, tripId: number,
  d: { country: string; city?: string | null; countryCode?: string | null; latitude?: number | null; longitude?: number | null }
): Promise<void> {
  const rows = await scopedQuery(
    ctx,
    `SELECT COALESCE(MAX(display_order), -1) AS mx FROM trip_destinations WHERE {{tenant}} AND trip_id = ?`,
    [tripId]
  );
  const nextOrder = Number(rows[0]?.mx ?? -1) + 1;
  const { scopedInsert } = await import('@/app/lib/db/scoped');
  await scopedInsert(ctx, 'trip_destinations', {
    trip_id: tripId,
    country: d.country,
    city: d.city ?? null,
    country_code: d.countryCode ?? null,
    latitude: d.latitude ?? null,
    longitude: d.longitude ?? null,
    display_order: nextOrder,
  });
}

export async function updateDestination(
  ctx: TenantContext, tripId: number, destinationId: number,
  patch: { country?: string; city?: string | null; countryCode?: string | null }
): Promise<void> {
  const sets: string[] = [];
  const args: (string | number | null)[] = [];
  if (patch.country !== undefined) { sets.push('country = ?'); args.push(patch.country); }
  if (patch.city !== undefined) { sets.push('city = ?'); args.push(patch.city); }
  if (patch.countryCode !== undefined) { sets.push('country_code = ?'); args.push(patch.countryCode); }
  if (sets.length === 0) return;
  args.push(tripId, destinationId);
  await scopedExecute(
    ctx,
    `UPDATE trip_destinations SET ${sets.join(', ')} WHERE {{tenant}} AND trip_id = ? AND destination_id = ?`,
    args as import('@libsql/client').InValue[]
  );
}

export async function removeDestination(
  ctx: TenantContext, tripId: number, destinationId: number
): Promise<void> {
  await scopedExecute(
    ctx,
    `DELETE FROM trip_destinations WHERE {{tenant}} AND trip_id = ? AND destination_id = ?`,
    [tripId, destinationId]
  );
}