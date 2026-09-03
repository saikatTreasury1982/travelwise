// app/lib/services/expense-service.ts
// The central cost-item service (ADR-010). Every module emits expenses here.
// Handles: create (with per-expense currency → base conversion + traveller split),
// list, and the Cost Forecast aggregation (GROUP BY source_module + per-traveller).
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import type { TenantContext } from '@/app/lib/db/scoped';

export type SourceModule = 'flight' | 'accommodation' | 'itinerary' | 'adhoc';

export interface ExpenseInput {
  tripId: number;
  sourceModule: SourceModule;
  sourceId?: number | null;
  description: string;
  estimatedAmount: number;
  currency: string;
  categoryId?: number | null;
  bearerTravelerIds: number[];   // the travellers who bear THIS expense (from cost-sharer-eligible ones)
  paidByTravelerId?: number | null;
  expenseDate?: string | null;
  notes?: string | null;
  categoryLabel?: string | null;
  isActive?: boolean;   // default true
  /** Mode C: caller-supplied base amount (skips FX lookup). */
  baseAmountOverride?: number | null;
  /** Optional explicit rate to store with a mode-C override; derived if omitted. */
  fxRateOverride?: number | null;
}

/** The trip's base currency = the primary traveller's currency. */
export async function getTripBaseCurrency(ctx: TenantContext, tripId: number): Promise<string> {
  const rows = await scopedQuery(
    ctx,
    `SELECT traveler_currency FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_primary = 1 LIMIT 1`,
    [tripId]
  );
  return rows[0]?.traveler_currency ? String(rows[0].traveler_currency) : 'USD';
}

/** Travellers eligible to bear a cost on this trip (active cost-sharers). Used by expense forms. */
export async function getEligibleBearers(ctx: TenantContext, tripId: number): Promise<{ traveler_id: number; traveler_name: string; is_primary: number }[]> {
  const rows = await scopedQuery(
    ctx,
    `SELECT traveler_id, traveler_name, is_primary FROM trip_travelers
     WHERE {{tenant}} AND trip_id = ? AND is_active = 1 AND is_cost_sharer = 1
     ORDER BY is_primary DESC, traveler_name`,
    [tripId]
  );
  return rows.map((r) => ({ traveler_id: Number(r.traveler_id), traveler_name: String(r.traveler_name), is_primary: Number(r.is_primary) }));
}

/**
 * Create an expense: converts to base currency (stored), inserts the expense,
 * then splits it EQUALLY among the explicitly-selected bearers for this item.
 * Bearers are chosen per-expense from cost-sharer-eligible travellers — the
 * is_cost_sharer flag is eligibility, NOT automatic inclusion.
 */
export async function createExpense(ctx: TenantContext, input: ExpenseInput): Promise<number> {
  const base = await getTripBaseCurrency(ctx, input.tripId);
  let rate: number;
  let baseAmount: number;
  if (input.baseAmountOverride != null) {
    // Mode C — caller pinned the exact base amount; rate is implicit.
    baseAmount = input.baseAmountOverride;
    rate = input.fxRateOverride ?? (input.estimatedAmount > 0 ? input.baseAmountOverride / input.estimatedAmount : 1);
  } else {
    const { convert } = await import('@/app/lib/services/fx');
    const fx = await convert(input.estimatedAmount, input.currency, base);
    rate = fx.rate ?? 1;
    baseAmount = fx.baseAmount ?? input.estimatedAmount;
  }

  const bearers = [...new Set(input.bearerTravelerIds)].filter((n) => Number.isFinite(n));
  const isShared = bearers.length > 1;

  await scopedInsert(ctx, 'expenses', {
    trip_id: input.tripId,
    category_id: input.categoryId ?? null,
    source_module: input.sourceModule,
    source_id: input.sourceId ?? null,
    expense_description: input.description,
    estimated_amount: input.estimatedAmount,
    expense_currency: input.currency,
    fx_rate_to_base: rate,
    estimated_amount_base: baseAmount,
    is_shared: isShared ? 1 : 0,
    split_method: isShared ? 'equal' : 'individual',
    assigned_to_traveler_id: bearers.length === 1 ? bearers[0] : null,
    paid_by_traveler_id: input.paidByTravelerId ?? null,
    expense_date: input.expenseDate ?? null,
    notes: input.notes ?? null,
    category_label: input.categoryLabel ?? null,
    is_active: input.isActive === false ? 0 : 1,
  });

  const idRows = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses WHERE {{tenant}} AND trip_id = ?
     ORDER BY expense_id DESC LIMIT 1`,
    [input.tripId]
  );
  const expenseId = Number(idRows[0].expense_id);

  // One split row per SELECTED bearer, equal share, in base currency.
  if (bearers.length > 0) {
    const share = baseAmount / bearers.length;
    const pct = 100 / bearers.length;
    for (const tid of bearers) {
      await scopedInsert(ctx, 'expense_splits', {
        expense_id: expenseId, traveler_id: tid,
        estimated_split_amount: share, split_percentage: pct,
      });
    }
  }

  return expenseId;
}

export async function deleteExpense(ctx: TenantContext, tripId: number, expenseId: number): Promise<void> {
  // Cascade removes splits + actuals.
  await scopedExecute(
    ctx,
    `DELETE FROM expenses WHERE {{tenant}} AND trip_id = ? AND expense_id = ?`,
    [tripId, expenseId]
  );
}

// ---- Cost Forecast aggregation --------------------------------------------

export interface ForecastLine { expense_id: number; description: string; amount_base: number; currency: string; amount_original: number; }
export interface ForecastModule { source_module: string; total_base: number; items: ForecastLine[]; }
export interface TravelerShare { traveler_id: number; traveler_name: string; is_primary: number; total_base: number; }
export interface Forecast {
  base_currency: string;
  total_base: number;
  modules: ForecastModule[];
  travelers: TravelerShare[];
}

export async function getForecast(ctx: TenantContext, tripId: number): Promise<Forecast> {
  const base = await getTripBaseCurrency(ctx, tripId);

  const rows = await scopedQuery(
    ctx,
    `SELECT expense_id, source_module, expense_description,
            estimated_amount, expense_currency, estimated_amount_base
     FROM expenses WHERE {{tenant}} AND trip_id = ? AND is_active = 1
     ORDER BY source_module, expense_id`,
    [tripId]
  );

  const modulesMap = new Map<string, ForecastModule>();
  let total = 0;
  for (const r of rows) {
    const mod = String(r.source_module);
    const amtBase = r.estimated_amount_base == null ? 0 : Number(r.estimated_amount_base);
    total += amtBase;
    if (!modulesMap.has(mod)) modulesMap.set(mod, { source_module: mod, total_base: 0, items: [] });
    const m = modulesMap.get(mod)!;
    m.total_base += amtBase;
    m.items.push({
      expense_id: Number(r.expense_id),
      description: String(r.expense_description),
      amount_base: amtBase,
      currency: String(r.expense_currency),
      amount_original: Number(r.estimated_amount),
    });
  }

  // Per-traveller share (sum of their split rows, in base).
  const splitRows = await scopedQuery(
    ctx,
    `SELECT s.traveler_id, tt.traveler_name, tt.is_primary,
      SUM(s.estimated_split_amount) AS total_base
     FROM expense_splits s
     JOIN expenses e ON e.expense_id = s.expense_id
     JOIN trip_travelers tt ON tt.traveler_id = s.traveler_id
      WHERE {{tenant:e}} AND e.trip_id = ? AND e.is_active = 1
     GROUP BY s.traveler_id, tt.traveler_name, tt.is_primary
     ORDER BY tt.is_primary DESC, tt.traveler_name`,
    [tripId]
  );

  return {
    base_currency: base,
    total_base: total,
    modules: Array.from(modulesMap.values()),
    travelers: splitRows.map((r) => ({
      traveler_id: Number(r.traveler_id),
      traveler_name: String(r.traveler_name),
      is_primary: Number(r.is_primary),
      total_base: Number(r.total_base),
    })),
  };
}

export interface AdhocExpenseRow {
  expense_id: number;
  description: string;
  category_label: string | null;
  estimated_amount: number;
  expense_currency: string;
  estimated_amount_base: number;
  expense_date: string | null;
  is_active: number;
  notes: string | null;
  bearers: { traveler_id: number; traveler_name: string }[];
}

/** List ad-hoc expenses for a trip, with their bearers. */
export async function listAdhocExpenses(ctx: TenantContext, tripId: number): Promise<AdhocExpenseRow[]> {
  const rows = await scopedQuery(
    ctx,
    `SELECT expense_id, expense_description, category_label, estimated_amount,
            expense_currency, estimated_amount_base, expense_date, is_active, notes
     FROM expenses
     WHERE {{tenant}} AND trip_id = ? AND source_module = 'adhoc'
     ORDER BY expense_id DESC`,
    [tripId]
  );
  const result: AdhocExpenseRow[] = [];
  for (const r of rows) {
    const eid = Number(r.expense_id);
    const bearers = await scopedQuery(
      ctx,
      `SELECT s.traveler_id, tt.traveler_name
       FROM expense_splits s JOIN trip_travelers tt ON tt.traveler_id = s.traveler_id
       WHERE {{tenant:s}} AND s.expense_id = ?`,
      [eid]
    );
    result.push({
      expense_id: eid,
      description: String(r.expense_description),
      category_label: r.category_label == null ? null : String(r.category_label),
      estimated_amount: Number(r.estimated_amount),
      expense_currency: String(r.expense_currency),
      estimated_amount_base: r.estimated_amount_base == null ? 0 : Number(r.estimated_amount_base),
      expense_date: r.expense_date == null ? null : String(r.expense_date),
      is_active: Number(r.is_active),
      notes: r.notes == null ? null : String(r.notes),
      bearers: bearers.map((b) => ({ traveler_id: Number(b.traveler_id), traveler_name: String(b.traveler_name) })),
    });
  }
  return result;
}

/** Update an expense: re-converts FX, rewrites the split rows for the new bearers. */
export async function updateExpense(ctx: TenantContext, tripId: number, expenseId: number, input: Omit<ExpenseInput, 'tripId' | 'sourceModule' | 'sourceId'>): Promise<void> {
  const base = await getTripBaseCurrency(ctx, tripId);
  let rate: number;
  let baseAmount: number;
  if (input.baseAmountOverride != null) {
    // Mode C — caller pinned the exact base amount; rate is implicit.
    baseAmount = input.baseAmountOverride;
    rate = input.fxRateOverride ?? (input.estimatedAmount > 0 ? input.baseAmountOverride / input.estimatedAmount : 1);
  } else {
    const { convert } = await import('@/app/lib/services/fx');
    const fx = await convert(input.estimatedAmount, input.currency, base);
    rate = fx.rate ?? 1;
    baseAmount = fx.baseAmount ?? input.estimatedAmount;
  }
  const bearers = [...new Set(input.bearerTravelerIds)].filter((n) => Number.isFinite(n));
  const isShared = bearers.length > 1;

  await scopedExecute(
    ctx,
    `UPDATE expenses SET
       expense_description = ?, category_label = ?, estimated_amount = ?, expense_currency = ?,
       fx_rate_to_base = ?, estimated_amount_base = ?, is_shared = ?, split_method = ?,
       assigned_to_traveler_id = ?, expense_date = ?, is_active = ?, notes = ?,
       updated_at = datetime('now')
     WHERE {{tenant}} AND trip_id = ? AND expense_id = ?`,
    [
      input.description, input.categoryLabel ?? null, input.estimatedAmount, input.currency,
      rate, baseAmount, isShared ? 1 : 0, isShared ? 'equal' : 'individual',
      bearers.length === 1 ? bearers[0] : null, input.expenseDate ?? null,
      input.isActive === false ? 0 : 1, input.notes ?? null,
      tripId, expenseId,
    ] as import('@libsql/client').InValue[]
  );

  // Rewrite splits.
  await scopedExecute(ctx, `DELETE FROM expense_splits WHERE {{tenant}} AND expense_id = ?`, [expenseId]);
  if (bearers.length > 0) {
    const share = baseAmount / bearers.length;
    const pct = 100 / bearers.length;
    for (const tid of bearers) {
      await scopedInsert(ctx, 'expense_splits', {
        expense_id: expenseId, traveler_id: tid,
        estimated_split_amount: share, split_percentage: pct,
      });
    }
  }
}

export interface ActualLine {
  expense_id: number;
  description: string;
  source_module: string;
  expense_currency: string;
  bearers: {
    traveler_id: number;
    traveler_name: string;
    forecast_base: number;
    actual_id: number | null;
    actual_amount: number | null;
    actual_currency: string | null;
    actual_amount_base: number | null;
    actual_date: string | null;
    paid_by_traveler_id: number | null;
    payment_method_key: string | null;
  }[];
}

/** All active expenses for a trip with each bearer's forecast split + any recorded actual. */
export async function listActuals(ctx: TenantContext, tripId: number): Promise<{ base_currency: string; items: ActualLine[] }> {
  const base = await getTripBaseCurrency(ctx, tripId);

  const expenses = await scopedQuery(
    ctx,
    `SELECT expense_id, source_module, expense_description, expense_currency
     FROM expenses WHERE {{tenant}} AND trip_id = ? AND is_active = 1
     ORDER BY source_module, expense_id`,
    [tripId]
  );

  const items: ActualLine[] = [];
  for (const e of expenses) {
    const eid = Number(e.expense_id);
    const rows = await scopedQuery(
      ctx,
      `SELECT s.traveler_id, tt.traveler_name, s.estimated_split_amount AS forecast_base,
              a.actual_id, a.actual_amount, a.actual_currency, a.actual_amount_base, a.actual_date,
              a.paid_by_traveler_id, a.payment_method_key
       FROM expense_splits s
       JOIN trip_travelers tt ON tt.traveler_id = s.traveler_id
       LEFT JOIN expense_actuals a
              ON a.expense_id = s.expense_id AND a.traveler_id = s.traveler_id AND a.installment_number = 1
       WHERE {{tenant:s}} AND s.expense_id = ?
       ORDER BY tt.is_primary DESC, tt.traveler_name`,
      [eid]
    );
    items.push({
      expense_id: eid,
      description: String(e.expense_description),
      source_module: String(e.source_module),
      expense_currency: String(e.expense_currency),
      bearers: rows.map((r) => ({
        traveler_id: Number(r.traveler_id),
        traveler_name: String(r.traveler_name),
        forecast_base: Number(r.forecast_base),
        actual_id: r.actual_id == null ? null : Number(r.actual_id),
        actual_amount: r.actual_amount == null ? null : Number(r.actual_amount),
        actual_currency: r.actual_currency == null ? null : String(r.actual_currency),
        actual_amount_base: r.actual_amount_base == null ? null : Number(r.actual_amount_base),
        actual_date: r.actual_date == null ? null : String(r.actual_date),
        paid_by_traveler_id: r.paid_by_traveler_id == null ? null : Number(r.paid_by_traveler_id),
        payment_method_key: r.payment_method_key == null ? null : String(r.payment_method_key),
      })),
    });
  }
  return { base_currency: base, items };
}

/** Record (or update) one bearer's actual for an expense (installment 1). Converts to base. */
export async function recordActual(
  ctx: TenantContext, tripId: number,
  input: { expenseId: number; travelerId: number; amount: number; currency: string; date?: string | null; paidByTravelerId?: number | null; paymentMethodKey?: string | null; notes?: string | null }
): Promise<void> {
  const base = await getTripBaseCurrency(ctx, tripId);
  const { convert } = await import('@/app/lib/services/fx');
  const fx = await convert(input.amount, input.currency, base);
  const rate = fx.rate ?? 1;
  const baseAmount = fx.baseAmount ?? input.amount;

  const owns = await scopedQuery(
    ctx,
    `SELECT expense_id FROM expenses WHERE {{tenant}} AND trip_id = ? AND expense_id = ? LIMIT 1`,
    [tripId, input.expenseId]
  );
  if (owns.length === 0) throw new Error('Expense not found.');

  const existing = await scopedQuery(
    ctx,
    `SELECT actual_id FROM expense_actuals
     WHERE {{tenant}} AND expense_id = ? AND traveler_id = ? AND installment_number = 1 LIMIT 1`,
    [input.expenseId, input.travelerId]
  );

  if (existing.length > 0) {
    await scopedExecute(
      ctx,
      `UPDATE expense_actuals SET
         actual_amount = ?, actual_currency = ?, fx_rate_to_base = ?, actual_amount_base = ?,
         actual_date = ?, paid_by_traveler_id = ?, payment_method_key = ?, notes = ?
       WHERE {{tenant}} AND actual_id = ?`,
      [input.amount, input.currency, rate, baseAmount, input.date ?? null,
      input.paidByTravelerId ?? null, input.paymentMethodKey ?? null, input.notes ?? null,
      Number(existing[0].actual_id)] as import('@libsql/client').InValue[]
    );
  } else {
    await scopedInsert(ctx, 'expense_actuals', {
      expense_id: input.expenseId, traveler_id: input.travelerId, installment_number: 1,
      actual_amount: input.amount, actual_currency: input.currency,
      fx_rate_to_base: rate, actual_amount_base: baseAmount,
      actual_date: input.date ?? null, paid_by_traveler_id: input.paidByTravelerId ?? null,
      payment_method_key: input.paymentMethodKey ?? null, notes: input.notes ?? null,
    });
  }
}

// ---- Variance summary -------------------------------------------------------

export interface Variance {
  base_currency: string;
  forecast_total: number;
  actual_total: number;
  variance: number;
  modules: { source_module: string; forecast: number; actual: number; variance: number }[];
}

export async function getVariance(ctx: TenantContext, tripId: number): Promise<Variance> {
  const base = await getTripBaseCurrency(ctx, tripId);

  // Forecast per module — scoped to tenant.
  const forecastRows = await scopedQuery(
    ctx,
    `SELECT source_module, SUM(estimated_amount_base) AS forecast
     FROM expenses
     WHERE {{tenant}} AND trip_id = ? AND is_active = 1
     GROUP BY source_module`,
    [tripId],
  );

  // Actuals per module — scoped via the parent expense (e), not an unscoped subquery.
  const actualRows = await scopedQuery(
    ctx,
    `SELECT e.source_module, SUM(a.actual_amount_base) AS actual
     FROM expense_actuals a
     JOIN expenses e ON e.expense_id = a.expense_id
     WHERE {{tenant:e}} AND e.trip_id = ? AND e.is_active = 1
     GROUP BY e.source_module`,
    [tripId],
  );

  const actualByMod = new Map<string, number>();
  for (const r of actualRows) actualByMod.set(String(r.source_module), Number(r.actual ?? 0));

  let fTotal = 0, aTotal = 0;
  const modules = forecastRows.map((r) => {
    const mod = String(r.source_module);
    const f = Number(r.forecast ?? 0);
    const a = actualByMod.get(mod) ?? 0;
    fTotal += f; aTotal += a;
    return { source_module: mod, forecast: f, actual: a, variance: a - f };
  });

  return { base_currency: base, forecast_total: fTotal, actual_total: aTotal, variance: aTotal - fTotal, modules };
}