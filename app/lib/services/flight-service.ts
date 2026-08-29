// app/lib/services/flight-service.ts
// Flight bookings (Door C: PDF → confirmed) + the confirm-time expense emit.
// A booking is one purchase with N legs. On confirm it emits ONE expense
// (total_paid, source_module='flight', source_id=booking_id), split among the
// assigned cost-sharer bearers. Idempotent per ADR-010 Decision 1a.
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';
import { createExpense, updateExpense, deleteExpense } from '@/app/lib/services/expense-service';
import type { InValue } from '@libsql/client';

export interface LegInput {
  leg_order?: number;
  departure_airport_code?: string | null; departure_airport_name?: string | null; departure_city?: string | null;
  departure_terminal?: string | null; departure_datetime?: string | null;
  arrival_airport_code?: string | null; arrival_airport_name?: string | null; arrival_city?: string | null;
  arrival_terminal?: string | null; arrival_datetime?: string | null;
  airline?: string | null; airline_code?: string | null; flight_number?: string | null;
  cabin_class?: string | null; fare_class?: string | null;
  duration_minutes?: number | null; stops_count?: number | null;
  baggage_allowance?: string | null; checkin_reference?: string | null;
}
export interface BookingInput {
  booking_source?: string | null; agency_reference?: string | null; airline_pnr?: string | null;
  booking_date?: string | null; total_paid?: number | null; base_fare?: number | null;
  currency_code?: string | null; notes?: string | null; document_notes?: string | null;
}

/** Insert a booking + its legs. status defaults to 'confirmed' for Door C uploads. */
export async function createBooking(
  ctx: TenantContext, tripId: number,
  booking: BookingInput, legs: LegInput[],
  opts: { status?: 'shortlisted' | 'confirmed'; source?: string } = {},
): Promise<number> {
  await scopedInsert(ctx, 'flight_bookings', {
    trip_id: tripId,
    status: opts.status ?? 'confirmed',
    source: opts.source ?? 'pdf',
    booking_source: booking.booking_source ?? null,
    agency_reference: booking.agency_reference ?? null,
    airline_pnr: booking.airline_pnr ?? null,
    booking_date: booking.booking_date ?? null,
    total_paid: booking.total_paid ?? null,
    base_fare: booking.base_fare ?? null,
    currency_code: booking.currency_code ?? null,
    notes: booking.notes ?? null,
    document_notes: booking.document_notes ?? null,
  });

  const idRows = await scopedQuery(
    ctx,
    `SELECT booking_id FROM flight_bookings WHERE {{tenant}} AND trip_id = ?
     ORDER BY booking_id DESC LIMIT 1`,
    [tripId],
  );
  const bookingId = Number(idRows[0].booking_id);

  await insertLegs(ctx, bookingId, legs);
  return bookingId;
}

async function insertLegs(ctx: TenantContext, bookingId: number, legs: LegInput[]): Promise<void> {
  for (let i = 0; i < legs.length; i++) {
    const l = legs[i];
    await scopedInsert(ctx, 'flight_booking_legs', {
      booking_id: bookingId,
      leg_order: l.leg_order ?? i + 1,
      departure_airport_code: l.departure_airport_code ?? null,
      departure_airport_name: l.departure_airport_name ?? null,
      departure_city: l.departure_city ?? null,
      departure_terminal: l.departure_terminal ?? null,
      departure_datetime: l.departure_datetime ?? null,
      arrival_airport_code: l.arrival_airport_code ?? null,
      arrival_airport_name: l.arrival_airport_name ?? null,
      arrival_city: l.arrival_city ?? null,
      arrival_terminal: l.arrival_terminal ?? null,
      arrival_datetime: l.arrival_datetime ?? null,
      airline: l.airline ?? null,
      airline_code: l.airline_code ?? null,
      flight_number: l.flight_number ?? null,
      cabin_class: l.cabin_class ?? null,
      fare_class: l.fare_class ?? null,
      duration_minutes: l.duration_minutes ?? null,
      stops_count: l.stops_count ?? 0,
      baggage_allowance: l.baggage_allowance ?? null,
      checkin_reference: l.checkin_reference ?? null,
    });
  }
}

/** Update a booking's fields + replace its legs wholesale. Re-emits the expense if confirmed. */
export async function updateBooking(
  ctx: TenantContext, tripId: number, bookingId: number,
  booking: BookingInput, legs: LegInput[],
): Promise<void> {
  await scopedExecute(
    ctx,
    `UPDATE flight_bookings SET
       booking_source = ?, agency_reference = ?, airline_pnr = ?, booking_date = ?,
       total_paid = ?, base_fare = ?, currency_code = ?, notes = ?, updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND booking_id = ?`,
    [
      booking.booking_source ?? null, booking.agency_reference ?? null, booking.airline_pnr ?? null,
      booking.booking_date ?? null, booking.total_paid ?? null, booking.base_fare ?? null,
      booking.currency_code ?? null, booking.notes ?? null, tripId, bookingId,
    ] as InValue[],
  );
  await scopedExecute(ctx, `DELETE FROM flight_booking_legs WHERE {{tenant}} AND booking_id = ?`, [bookingId]);
  await insertLegs(ctx, bookingId, legs);

  // If confirmed, keep the emitted expense in sync with the new total/currency.
  await syncExpenseForBooking(ctx, tripId, bookingId);
}

/** Delete a booking (legs + bearers cascade) and remove its emitted expense. */
export async function deleteBooking(ctx: TenantContext, tripId: number, bookingId: number): Promise<void> {
  const expenseId = await findBookingExpenseId(ctx, tripId, bookingId);
  if (expenseId != null) await deleteExpense(ctx, tripId, expenseId);
  await scopedExecute(ctx, `DELETE FROM flight_bookings WHERE {{tenant}} AND trip_id = ? AND booking_id = ?`, [tripId, bookingId]);
}

/** Set the assigned cost-bearers for a booking, then re-sync the expense split. */
export async function setBookingBearers(
  ctx: TenantContext, tripId: number, bookingId: number, travelerIds: number[],
): Promise<void> {
  // Confirm the booking belongs to this trip/tenant.
  const owns = await scopedQuery(
    ctx, `SELECT booking_id FROM flight_bookings WHERE {{tenant}} AND trip_id = ? AND booking_id = ? LIMIT 1`,
    [tripId, bookingId],
  );
  if (owns.length === 0) throw new Error('Booking not found.');

  // Restrict to cost-sharer-eligible active travellers (Decision 1b).
  const eligible = await scopedQuery(
    ctx,
    `SELECT traveler_id FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_active = 1 AND is_cost_sharer = 1`,
    [tripId],
  );
  const allowed = new Set(eligible.map((r) => Number(r.traveler_id)));
  const ids = [...new Set(travelerIds)].filter((id) => allowed.has(id));

  await scopedExecute(ctx, `DELETE FROM flight_booking_bearers WHERE {{tenant}} AND booking_id = ?`, [bookingId]);
  for (const tid of ids) {
    await scopedInsert(ctx, 'flight_booking_bearers', { booking_id: bookingId, traveler_id: tid });
  }

  await syncExpenseForBooking(ctx, tripId, bookingId);
}

// ---- expense emit (idempotent, Decision 1a) --------------------------------

/** Find the expense emitted for a flight booking (source_module='flight', source_id=bookingId). */
async function findBookingExpenseId(ctx: TenantContext, tripId: number, bookingId: number): Promise<number | null> {
  const rows = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses
     WHERE {{tenant}} AND trip_id = ? AND source_module = 'flight' AND source_id = ? LIMIT 1`,
    [tripId, bookingId],
  );
  return rows.length ? Number(rows[0].expense_id) : null;
}

/**
 * Reconcile the booking's emitted expense with its current state.
 * - confirmed + has total + has bearers → create or update the expense.
 * - otherwise (shortlisted, no total, or no bearers) → remove any emitted expense.
 * This is the single source of truth called after every booking/bearer change.
 */
export async function syncExpenseForBooking(ctx: TenantContext, tripId: number, bookingId: number): Promise<void> {
  const rows = await scopedQuery(
    ctx,
    `SELECT status, total_paid, currency_code FROM flight_bookings
     WHERE {{tenant}} AND trip_id = ? AND booking_id = ? LIMIT 1`,
    [tripId, bookingId],
  );
  const b = rows[0];
  if (!b) return;

  const existingId = await findBookingExpenseId(ctx, tripId, bookingId);
  const status = String(b.status);
  const total = b.total_paid == null ? null : Number(b.total_paid);
  const currency = b.currency_code == null ? null : String(b.currency_code);

  const bearerRows = await scopedQuery(
    ctx, `SELECT traveler_id FROM flight_booking_bearers WHERE {{tenant}} AND booking_id = ?`, [bookingId],
  );
  const bearerIds = bearerRows.map((r) => Number(r.traveler_id));

  const shouldEmit = status === 'confirmed' && total != null && total > 0 && bearerIds.length > 0;

  if (!shouldEmit) {
    if (existingId != null) await deleteExpense(ctx, tripId, existingId);
    return;
  }

  const description = await bookingLabel(ctx, bookingId);

  if (existingId == null) {
    await createExpense(ctx, {
      tripId, sourceModule: 'flight', sourceId: bookingId,
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Flights', bearerTravelerIds: bearerIds, isActive: true,
    });
  } else {
    await updateExpense(ctx, tripId, existingId, {
      description, estimatedAmount: total!, currency: currency!,
      categoryLabel: 'Flights', bearerTravelerIds: bearerIds, isActive: true,
    });
  }
}

/** A human label for the expense: "Flight · CCU → BKK" from the first/last leg. */
async function bookingLabel(ctx: TenantContext, bookingId: number): Promise<string> {
  const legs = await scopedQuery(
    ctx,
    `SELECT departure_airport_code, arrival_airport_code FROM flight_booking_legs
     WHERE {{tenant}} AND booking_id = ? ORDER BY leg_order`,
    [bookingId],
  );
  if (legs.length === 0) return 'Flight';
  const from = legs[0].departure_airport_code ? String(legs[0].departure_airport_code) : '?';
  const to = legs[legs.length - 1].arrival_airport_code ? String(legs[legs.length - 1].arrival_airport_code) : '?';
  return `Flight · ${from} → ${to}`;
}

// ---- reads -----------------------------------------------------------------

export async function listBookings(ctx: TenantContext, tripId: number) {
  const bookings = await scopedQuery(
    ctx,
    `SELECT booking_id, status, source, booking_source, agency_reference, airline_pnr,
            booking_date, total_paid, base_fare, currency_code, notes, document_notes
     FROM flight_bookings WHERE {{tenant}} AND trip_id = ?
     ORDER BY booking_id DESC`,
    [tripId],
  );
  const result = [];
  for (const b of bookings) {
    const bid = Number(b.booking_id);
    const legs = await scopedQuery(
      ctx,
      `SELECT * FROM flight_booking_legs WHERE {{tenant}} AND booking_id = ? ORDER BY leg_order`,
      [bid],
    );
    const bearers = await scopedQuery(
      ctx, `SELECT traveler_id FROM flight_booking_bearers WHERE {{tenant}} AND booking_id = ?`, [bid],
    );
    result.push({
      booking_id: bid,
      status: String(b.status),
      source: String(b.source),
      booking_source: b.booking_source == null ? null : String(b.booking_source),
      agency_reference: b.agency_reference == null ? null : String(b.agency_reference),
      airline_pnr: b.airline_pnr == null ? null : String(b.airline_pnr),
      booking_date: b.booking_date == null ? null : String(b.booking_date),
      total_paid: b.total_paid == null ? null : Number(b.total_paid),
      base_fare: b.base_fare == null ? null : Number(b.base_fare),
      currency_code: b.currency_code == null ? null : String(b.currency_code),
      notes: b.notes == null ? null : String(b.notes),
      document_notes: b.document_notes == null ? null : String(b.document_notes),
      bearer_traveler_ids: bearers.map((r) => Number(r.traveler_id)),
      legs: legs.map((l) => ({
        leg_id: Number(l.leg_id),
        leg_order: Number(l.leg_order),
        departure_airport_code: l.departure_airport_code == null ? null : String(l.departure_airport_code),
        departure_airport_name: l.departure_airport_name == null ? null : String(l.departure_airport_name),
        departure_city: l.departure_city == null ? null : String(l.departure_city),
        departure_datetime: l.departure_datetime == null ? null : String(l.departure_datetime),
        arrival_airport_code: l.arrival_airport_code == null ? null : String(l.arrival_airport_code),
        arrival_airport_name: l.arrival_airport_name == null ? null : String(l.arrival_airport_name),
        arrival_city: l.arrival_city == null ? null : String(l.arrival_city),
        arrival_datetime: l.arrival_datetime == null ? null : String(l.arrival_datetime),
        airline: l.airline == null ? null : String(l.airline),
        flight_number: l.flight_number == null ? null : String(l.flight_number),
        cabin_class: l.cabin_class == null ? null : String(l.cabin_class),
        duration_minutes: l.duration_minutes == null ? null : Number(l.duration_minutes),
        baggage_allowance: l.baggage_allowance == null ? null : String(l.baggage_allowance),
        checkin_reference: l.checkin_reference == null ? null : String(l.checkin_reference),
      })),
    });
  }
  return result;
}

/** Count of confirmed flight bookings for a trip (hub card stat). */
export async function getConfirmedFlightCount(ctx: TenantContext, tripId: number): Promise<number> {
  const rows = await scopedQuery(
    ctx,
    `SELECT COUNT(*) AS n FROM flight_bookings
     WHERE {{tenant}} AND trip_id = ? AND status = 'confirmed'`,
    [tripId],
  );
  return Number(rows[0]?.n ?? 0);
}