// app/lib/services/trip-service.ts
// Tenant-scoped trip persistence. The co-pilot calls saveTrip() once it has
// gathered enough info (name + start + end dates minimum). Writes trips +
// destinations + travelers in one transaction, all stamped with tenant_id.
import { db } from '../db/client';
import type { TenantContext } from '../db/scoped';

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
    return { tripId, name: input.name.trim() };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** List the current tenant's trips with their destinations, for the cards view. */
export async function listTripsWithDetails(ctx: TenantContext) {
  const tripsRes = await db.execute({
    sql: `SELECT t.trip_id, t.trip_name, t.trip_description, t.start_date, t.end_date,
                 t.status_code, s.status_name, t.trip_budget, t.budget_currency
            FROM trips t
            LEFT JOIN trip_status s ON s.status_code = t.status_code
           WHERE t.tenant_id = ? AND t.user_id = ?
           ORDER BY t.start_date DESC`,
    args: [ctx.tenantId, ctx.userId],
  });
  const trips = tripsRes.rows as unknown as Array<{
    trip_id: number; trip_name: string; trip_description: string | null;
    start_date: string; end_date: string; status_code: number; status_name: string | null;
    trip_budget: number | null; budget_currency: string | null;
  }>;

  if (trips.length === 0) return [];

  // Fetch all destinations for these trips in one query.
  const ids = trips.map((t) => t.trip_id);
  const placeholders = ids.map(() => '?').join(',');
  const destRes = await db.execute({
    sql: `SELECT trip_id, country, city, display_order
            FROM trip_destinations
           WHERE tenant_id = ? AND trip_id IN (${placeholders})
           ORDER BY display_order`,
    args: [ctx.tenantId, ...ids],
  });
  const dests = destRes.rows as unknown as Array<{ trip_id: number; country: string; city: string | null; display_order: number }>;

  return trips.map((t) => ({
    ...t,
    destinations: dests.filter((d) => d.trip_id === t.trip_id),
  }));
}

/** Fetch one trip with all its details, tenant-scoped. Returns null if not found/not owned. */
export async function getTripDetail(ctx: TenantContext, tripId: number) {
  const tripRes = await db.execute({
    sql: `SELECT t.trip_id, t.trip_name, t.trip_description, t.start_date, t.end_date,
                 t.status_code, s.status_name, t.trip_budget, t.budget_currency, t.created_at
            FROM trips t
            LEFT JOIN trip_status s ON s.status_code = t.status_code
           WHERE t.trip_id = ? AND t.tenant_id = ? AND t.user_id = ?
           LIMIT 1`,
    args: [tripId, ctx.tenantId, ctx.userId],
  });
  if (tripRes.rows.length === 0) return null;
  const trip = tripRes.rows[0] as unknown as {
    trip_id: number; trip_name: string; trip_description: string | null;
    start_date: string; end_date: string; status_code: number; status_name: string | null;
    trip_budget: number | null; budget_currency: string | null; created_at: string;
  };

  const destRes = await db.execute({
    sql: `SELECT destination_id, country, city, country_code, display_order
            FROM trip_destinations WHERE trip_id = ? AND tenant_id = ? ORDER BY display_order`,
    args: [tripId, ctx.tenantId],
  });
  const travRes = await db.execute({
    sql: `SELECT tv.traveler_id, tv.traveler_name, tv.traveler_email, tv.relationship,
                 r.relationship_name, tv.is_primary, tv.is_cost_sharer
            FROM trip_travelers tv
            LEFT JOIN traveler_relationships r ON r.relationship_code = tv.relationship
           WHERE tv.trip_id = ? AND tv.tenant_id = ? AND tv.is_active = 1`,
    args: [tripId, ctx.tenantId],
  });

  return {
    ...trip,
    destinations: destRes.rows as unknown as Array<{ destination_id: number; country: string; city: string | null; country_code: string | null; display_order: number }>,
    travelers: travRes.rows as unknown as Array<{ traveler_id: number; traveler_name: string; traveler_email: string | null; relationship: number | null; relationship_name: string | null; is_primary: number; is_cost_sharer: number }>,
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