import type { TenantContext } from '@/app/lib/db/scoped';
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';

export const RELATIONSHIP = {
  SELF: 1, SPOUSE: 2, CHILD: 3, FRIEND: 4, FAMILY: 5, COLLEAGUE: 6,
} as const;

export interface Traveler {
  traveler_id: number;
  trip_id: number;
  traveler_name: string;
  traveler_email: string | null;
  relationship: number | null;
  is_primary: number;
  is_cost_sharer: number;
  traveler_currency: string | null;
  is_active: number;
}

function toTraveler(r: Record<string, unknown>): Traveler {
  return {
    traveler_id: Number(r.traveler_id),
    trip_id: Number(r.trip_id),
    traveler_name: String(r.traveler_name),
    traveler_email: r.traveler_email == null ? null : String(r.traveler_email),
    relationship: r.relationship == null ? null : Number(r.relationship),
    is_primary: Number(r.is_primary),
    is_cost_sharer: Number(r.is_cost_sharer),
    traveler_currency: r.traveler_currency == null ? null : String(r.traveler_currency),
    is_active: Number(r.is_active),
  };
}

/** All travellers on a trip — primary first, then active co-travellers, then tentative. */
export async function listTravelers(ctx: TenantContext, tripId: number): Promise<Traveler[]> {
  const rows = await scopedQuery(
    ctx,
    `SELECT traveler_id, trip_id, traveler_name, traveler_email, relationship,
            is_primary, is_cost_sharer, traveler_currency, is_active
     FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ?
     ORDER BY is_primary DESC, is_active DESC, traveler_id ASC`,
    [tripId]
  );
  return rows.map(toTraveler);
}

/**
 * Ensure the primary traveller row exists for a trip (the logged-in user).
 * Idempotent — safe to call on every trip save and for backfill.
 * Uses the user's name + home_currency from the users table.
 */
export async function ensurePrimaryTraveler(ctx: TenantContext, tripId: number): Promise<void> {
  const existing = await scopedQuery(
    ctx,
    `SELECT traveler_id FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_primary = 1 LIMIT 1`,
    [tripId]
  );
  if (existing.length > 0) return;

  const users = await scopedQuery(
    ctx,
    `SELECT first_name, middle_name, last_name, email, home_currency
     FROM users WHERE {{tenant}} AND user_id = ?`,
    [ctx.userId]
  );
  const u = users[0];
  const name =
    [u?.first_name, u?.last_name].filter(Boolean).map(String).join(' ').trim() || 'Me';
  const email = u?.email == null ? null : String(u.email);
  const currency = u?.home_currency == null ? null : String(u.home_currency);

  await scopedInsert(ctx, 'trip_travelers', {
    trip_id: tripId,
    traveler_name: name,
    traveler_email: email,
    relationship: RELATIONSHIP.SELF,
    is_primary: 1,
    is_cost_sharer: 1,
    traveler_currency: currency,
    is_active: 1,
  });
}

export interface CoTravelerInput {
  traveler_name: string;
  relationship?: number | null;      // 2..6; defaults to FAMILY if omitted
  is_cost_sharer?: boolean;          // default true
  is_active?: boolean;               // false = tentative
  traveler_email?: string | null;
  traveler_currency?: string | null; // defaults to primary's currency
}

/**
 * Add co-travellers to a trip. Primary is handled separately (ensurePrimaryTraveler).
 * Currency defaults to the primary traveller's currency when not given.
 */
export async function addCoTravelers(
  ctx: TenantContext, tripId: number, people: CoTravelerInput[]
): Promise<void> {
  if (people.length === 0) return;

  // Default currency = primary traveller's currency.
  const primary = await scopedQuery(
    ctx,
    `SELECT traveler_currency FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_primary = 1 LIMIT 1`,
    [tripId]
  );
  const defaultCurrency = primary[0]?.traveler_currency == null ? null : String(primary[0].traveler_currency);

  for (const p of people) {
    await scopedInsert(ctx, 'trip_travelers', {
      trip_id: tripId,
      traveler_name: p.traveler_name.trim(),
      traveler_email: p.traveler_email ?? null,
      relationship: p.relationship ?? RELATIONSHIP.FAMILY,
      is_primary: 0,
      is_cost_sharer: p.is_cost_sharer === false ? 0 : 1,
      traveler_currency: p.traveler_currency ?? defaultCurrency,
      is_active: p.is_active === false ? 0 : 1,
    });
  }
}

export interface TravelerUpdate {
  traveler_name?: string;
  relationship?: number | null;
  is_cost_sharer?: boolean;
  is_active?: boolean;
  traveler_email?: string | null;
  traveler_currency?: string | null;
}

/** Edit a co-traveller. Guards against changing the primary's core flags. */
export async function updateTraveler(
  ctx: TenantContext, tripId: number, travelerId: number, patch: TravelerUpdate
): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  const push = (col: string, val: unknown) => { sets.push(`${col} = ?`); args.push(val); };

  if (patch.traveler_name !== undefined) push('traveler_name', patch.traveler_name.trim());
  if (patch.relationship !== undefined) push('relationship', patch.relationship);
  if (patch.is_cost_sharer !== undefined) push('is_cost_sharer', patch.is_cost_sharer ? 1 : 0);
  if (patch.is_active !== undefined) push('is_active', patch.is_active ? 1 : 0);
  if (patch.traveler_email !== undefined) push('traveler_email', patch.traveler_email);
  if (patch.traveler_currency !== undefined) push('traveler_currency', patch.traveler_currency);

  if (sets.length === 0) return;
  args.push(tripId, travelerId);
  await scopedExecute(
    ctx,
    `UPDATE trip_travelers SET ${sets.join(', ')}
     WHERE {{tenant}} AND trip_id = ? AND traveler_id = ? AND is_primary = 0`,
    args as import('@libsql/client').InValue[]
  );
}

/** Remove a co-traveller (never the primary). */
export async function removeTraveler(ctx: TenantContext, tripId: number, travelerId: number): Promise<void> {
  await scopedExecute(
    ctx,
    `DELETE FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND traveler_id = ? AND is_primary = 0`,
    [tripId, travelerId]
  );
}