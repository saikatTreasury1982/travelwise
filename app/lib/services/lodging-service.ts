// app/lib/services/lodging-service.ts
// Lodging stays: considering → planned → booked, mirroring flight-service.
// A stay is ONE place for a date range (no legs). Confirmed stays emit ONE
// expense (source_module='accommodation', source_id=stay_id) via the reconciler.
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';
import { createExpense, updateExpense, deleteExpense } from '@/app/lib/services/expense-service';
import type { InValue } from '@libsql/client';

export interface LodgingCounts { confirmed: number; shortlisted: number; }

export interface StayInput {
  destination_id?: number | null;
  name?: string | null;
  accommodation_type?: string | null;
  area?: string | null;
  check_in?: string | null;   // YYYY-MM-DD
  check_out?: string | null;
  price_mode?: 'nightly' | 'total';
  nightly_rate?: number | null;
  estimated_price?: number | null;
  total_paid?: number | null;
  currency_code?: string | null;
  confirmation_reference?: string | null;
  booking_source?: string | null;
  booking_date?: string | null;
  notes?: string | null;
  document_notes?: string | null;
}

/** Whole nights between two YYYY-MM-DD dates (0 if invalid). */
function nightsBetween(checkIn?: string | null, checkOut?: string | null): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + 'T00:00:00').getTime();
  const b = new Date(checkOut + 'T00:00:00').getTime();
  if (isNaN(a) || isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86400000);
}

/** Resolve the stay's estimate total from its price mode (nightly × nights, or flat total). */
function resolveEstimate(input: StayInput, nights: number): number | null {
  if (input.price_mode === 'nightly') {
    return input.nightly_rate != null ? input.nightly_rate * nights : null;
  }
  return input.estimated_price ?? null;
}

// ---- create / update -------------------------------------------------------

export async function createStay(
  ctx: TenantContext, tripId: number,
  input: StayInput,
  opts: { status?: 'shortlisted' | 'confirmed'; source?: string; booking_confirmed?: number } = {},
): Promise<number> {
  const nights = nightsBetween(input.check_in, input.check_out);
  const estimate = resolveEstimate(input, nights);

  await scopedInsert(ctx, 'lodging_stays', {
    trip_id: tripId,
    destination_id: input.destination_id ?? null,
    status: opts.status ?? 'shortlisted',
    booking_confirmed: opts.booking_confirmed ?? 0,
    source: opts.source ?? 'ai',
    name: input.name ?? null,
    accommodation_type: input.accommodation_type ?? null,
    area: input.area ?? null,
    check_in: input.check_in ?? null,
    check_out: input.check_out ?? null,
    nights,
    price_mode: input.price_mode ?? 'total',
    nightly_rate: input.nightly_rate ?? null,
    estimated_price: estimate,
    total_paid: input.total_paid ?? null,
    currency_code: input.currency_code ?? null,
    confirmation_reference: input.confirmation_reference ?? null,
    booking_source: input.booking_source ?? null,
    booking_date: input.booking_date ?? null,
    notes: input.notes ?? null,
    document_notes: input.document_notes ?? null,
  });

  const idRows = await scopedQuery(
    ctx,
    `SELECT stay_id FROM lodging_stays WHERE {{tenant}} AND trip_id = ?
     ORDER BY stay_id DESC LIMIT 1`,
    [tripId],
  );
  return Number(idRows[0].stay_id);
}

/** Edit a stay's details. Writes the estimate (planning) unless already Booked,
 *  in which case the amount is the real total_paid (matches flights' updateBooking). */
export async function updateStay(
  ctx: TenantContext, tripId: number, stayId: number, input: StayInput,
): Promise<void> {
  const cur = await scopedQuery(
    ctx, `SELECT booking_confirmed FROM lodging_stays WHERE {{tenant}} AND trip_id = ? AND stay_id = ? LIMIT 1`,
    [tripId, stayId],
  );
  const isBooked = Number(cur[0]?.booking_confirmed ?? 0) === 1;
  const nights = nightsBetween(input.check_in, input.check_out);
  const estimate = resolveEstimate(input, nights);
  const priceCol = isBooked ? 'total_paid' : 'estimated_price';
  const priceVal = isBooked ? (input.total_paid ?? null) : estimate;

  await scopedExecute(
    ctx,
    `UPDATE lodging_stays SET
       status = 'confirmed',
       destination_id = ?, name = ?, accommodation_type = ?, area = ?,
       check_in = ?, check_out = ?, nights = ?,
       price_mode = ?, nightly_rate = ?, ${priceCol} = ?, currency_code = ?,
       confirmation_reference = ?, booking_source = ?, booking_date = ?, notes = ?,
       updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND stay_id = ?`,
    [
      input.destination_id ?? null, input.name ?? null, input.accommodation_type ?? null, input.area ?? null,
      input.check_in ?? null, input.check_out ?? null, nights,
      input.price_mode ?? 'total', input.nightly_rate ?? null, priceVal, input.currency_code ?? null,
      input.confirmation_reference ?? null, input.booking_source ?? null, input.booking_date ?? null, input.notes ?? null,
      tripId, stayId,
    ] as InValue[],
  );

  await syncExpenseForStay(ctx, tripId, stayId);
}

export async function deleteStay(ctx: TenantContext, tripId: number, stayId: number): Promise<void> {
  const expenseId = await findStayExpenseId(ctx, tripId, stayId);
  if (expenseId != null) await deleteExpense(ctx, tripId, expenseId);
  await scopedExecute(ctx, `DELETE FROM lodging_stays WHERE {{tenant}} AND trip_id = ? AND stay_id = ?`, [tripId, stayId]);
}

// ---- bearers ---------------------------------------------------------------

export async function setStayBearers(
  ctx: TenantContext, tripId: number, stayId: number, travelerIds: number[],
): Promise<void> {
  const owns = await scopedQuery(
    ctx, `SELECT stay_id FROM lodging_stays WHERE {{tenant}} AND trip_id = ? AND stay_id = ? LIMIT 1`,
    [tripId, stayId],
  );
  if (owns.length === 0) throw new Error('Stay not found.');

  const eligible = await scopedQuery(
    ctx,
    `SELECT traveler_id FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_active = 1 AND is_cost_sharer = 1`,
    [tripId],
  );
  const allowed = new Set(eligible.map((r) => Number(r.traveler_id)));
  const ids = [...new Set(travelerIds)].filter((id) => allowed.has(id));

  await scopedExecute(ctx, `DELETE FROM lodging_stay_bearers WHERE {{tenant}} AND stay_id = ?`, [stayId]);
  for (const tid of ids) {
    await scopedInsert(ctx, 'lodging_stay_bearers', { stay_id: stayId, traveler_id: tid });
  }
  await syncExpenseForStay(ctx, tripId, stayId);
}

// ---- confirm / unconfirm / book --------------------------------------------

/** Move an AI-suggested stay back from confirmed → shortlisted (not booked ones). */
export async function unconfirmStay(ctx: TenantContext, tripId: number, stayId: number): Promise<boolean> {
  const rows = await scopedQuery(
    ctx, `SELECT source, status, booking_confirmed FROM lodging_stays WHERE {{tenant}} AND trip_id = ? AND stay_id = ? LIMIT 1`,
    [tripId, stayId],
  );
  const s = rows[0];
  if (!s) return false;
  if (Number(s.booking_confirmed) === 1) return false;   // booked is terminal
  if (String(s.source) === 'pdf') return false;          // uploaded real stays are terminal
  if (String(s.status) !== 'confirmed') return true;

  await scopedExecute(
    ctx,
    `UPDATE lodging_stays SET status = 'shortlisted', updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND stay_id = ?`,
    [tripId, stayId],
  );
  await syncExpenseForStay(ctx, tripId, stayId);
  return true;
}

/** Mark a Planned stay as Booked with the real price/reference (or from an uploaded doc).
 *  Keeps estimated_price; forecast switches to total_paid via COALESCE. */
export async function markStayBooked(
  ctx: TenantContext, tripId: number, stayId: number,
  real: { total_paid: number; currency_code?: string | null; confirmation_reference?: string | null;
          booking_source?: string | null; booking_date?: string | null },
): Promise<void> {
  await scopedExecute(
    ctx,
    `UPDATE lodging_stays SET
       booking_confirmed = 1,
       total_paid = ?, currency_code = COALESCE(?, currency_code),
       confirmation_reference = COALESCE(?, confirmation_reference),
       booking_source = COALESCE(?, booking_source),
       booking_date = COALESCE(?, booking_date),
       updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND stay_id = ?`,
    [
      real.total_paid, real.currency_code ?? null, real.confirmation_reference ?? null,
      real.booking_source ?? null, real.booking_date ?? null, tripId, stayId,
    ] as InValue[],
  );
  await syncExpenseForStay(ctx, tripId, stayId);
}

// ---- expense emit (idempotent, confirmed-only) -----------------------------

async function findStayExpenseId(ctx: TenantContext, tripId: number, stayId: number): Promise<number | null> {
  const rows = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses
     WHERE {{tenant}} AND trip_id = ? AND source_module = 'accommodation' AND source_id = ? LIMIT 1`,
    [tripId, stayId],
  );
  return rows.length ? Number(rows[0].expense_id) : null;
}

/** Emit iff confirmed + amount>0 + bearers≥1; forecast uses COALESCE(total_paid, estimated_price). */
export async function syncExpenseForStay(ctx: TenantContext, tripId: number, stayId: number): Promise<void> {
  const rows = await scopedQuery(
    ctx,
    `SELECT status, total_paid, estimated_price, currency_code, name FROM lodging_stays
     WHERE {{tenant}} AND trip_id = ? AND stay_id = ? LIMIT 1`,
    [tripId, stayId],
  );
  const s = rows[0];
  if (!s) return;

  const existingId = await findStayExpenseId(ctx, tripId, stayId);
  const status = String(s.status);
  const total = s.total_paid != null ? Number(s.total_paid)
    : s.estimated_price != null ? Number(s.estimated_price)
      : null;
  const currency = s.currency_code == null ? null : String(s.currency_code);

  const bearerRows = await scopedQuery(
    ctx, `SELECT traveler_id FROM lodging_stay_bearers WHERE {{tenant}} AND stay_id = ?`, [stayId],
  );
  const bearerIds = bearerRows.map((r) => Number(r.traveler_id));

  const shouldEmit = status === 'confirmed' && total != null && total > 0 && bearerIds.length > 0;

  if (!shouldEmit) {
    if (existingId != null) await deleteExpense(ctx, tripId, existingId);
    return;
  }

  const description = s.name ? `Stay · ${String(s.name)}` : 'Accommodation';

  if (existingId == null) {
    await createExpense(ctx, {
      tripId, sourceModule: 'accommodation', sourceId: stayId,
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Accommodations', bearerTravelerIds: bearerIds, isActive: true,
    });
  } else {
    await updateExpense(ctx, tripId, existingId, {
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Accommodations', bearerTravelerIds: bearerIds, isActive: true,
    });
  }
}

// ---- reads -----------------------------------------------------------------

export async function listStays(ctx: TenantContext, tripId: number) {
  const stays = await scopedQuery(
    ctx,
    `SELECT stay_id, destination_id, status, booking_confirmed, source, name, accommodation_type, area,
            check_in, check_out, nights, price_mode, nightly_rate, estimated_price, total_paid,
            currency_code, confirmation_reference, booking_source, booking_date, notes
     FROM lodging_stays WHERE {{tenant}} AND trip_id = ?
     ORDER BY check_in, stay_id DESC`,
    [tripId],
  );
  const result = [];
  for (const s of stays) {
    const sid = Number(s.stay_id);
    const bearers = await scopedQuery(
      ctx, `SELECT traveler_id FROM lodging_stay_bearers WHERE {{tenant}} AND stay_id = ?`, [sid],
    );
    result.push({
      stay_id: sid,
      destination_id: s.destination_id == null ? null : Number(s.destination_id),
      status: String(s.status),
      booking_confirmed: Number(s.booking_confirmed ?? 0),
      source: String(s.source),
      name: s.name == null ? null : String(s.name),
      accommodation_type: s.accommodation_type == null ? null : String(s.accommodation_type),
      area: s.area == null ? null : String(s.area),
      check_in: s.check_in == null ? null : String(s.check_in),
      check_out: s.check_out == null ? null : String(s.check_out),
      nights: s.nights == null ? 0 : Number(s.nights),
      price_mode: String(s.price_mode ?? 'total'),
      nightly_rate: s.nightly_rate == null ? null : Number(s.nightly_rate),
      estimated_price: s.estimated_price == null ? null : Number(s.estimated_price),
      total_paid: s.total_paid == null ? null : Number(s.total_paid),
      currency_code: s.currency_code == null ? null : String(s.currency_code),
      confirmation_reference: s.confirmation_reference == null ? null : String(s.confirmation_reference),
      booking_source: s.booking_source == null ? null : String(s.booking_source),
      booking_date: s.booking_date == null ? null : String(s.booking_date),
      notes: s.notes == null ? null : String(s.notes),
      bearer_traveler_ids: bearers.map((r) => Number(r.traveler_id)),
    });
  }
  return result;
}

export async function getLodgingCounts(ctx: TenantContext, tripId: number): Promise<LodgingCounts> {
  const rows = await scopedQuery(
    ctx,
    `SELECT status, COUNT(*) AS n FROM lodging_stays WHERE {{tenant}} AND trip_id = ? GROUP BY status`,
    [tripId],
  );
  let confirmed = 0, shortlisted = 0;
  for (const r of rows) {
    if (String(r.status) === 'confirmed') confirmed = Number(r.n);
    else if (String(r.status) === 'shortlisted') shortlisted = Number(r.n);
  }
  return { confirmed, shortlisted };
}

/** Trip-wide nights coverage: confirmed stay-nights vs total trip nights. */
export async function getNightsCoverage(ctx: TenantContext, tripId: number): Promise<{ covered: number; tripNights: number }> {
  const trip = await scopedQuery(
    ctx, `SELECT start_date, end_date FROM trips WHERE {{tenant}} AND trip_id = ? LIMIT 1`, [tripId],
  );
  const tripNights = trip[0] ? nightsBetween(String(trip[0].start_date), String(trip[0].end_date)) : 0;

  const rows = await scopedQuery(
    ctx,
    `SELECT COALESCE(SUM(nights), 0) AS n FROM lodging_stays
     WHERE {{tenant}} AND trip_id = ? AND status = 'confirmed'`,
    [tripId],
  );
  return { covered: Number(rows[0]?.n ?? 0), tripNights };
}