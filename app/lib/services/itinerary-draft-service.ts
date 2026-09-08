// app/lib/services/itinerary-draft-service.ts
// -----------------------------------------------------------------------------
// AI itinerary DRAFT sessions (ADR-016). Transient staging: generate → preview
// → accept/discard. Railed revisions, entitlement-gated. One active session per
// (tenant, trip, user); replace-on-new; cleared on accept/discard.
// -----------------------------------------------------------------------------
import Anthropic from '@anthropic-ai/sdk';
import type { TenantContext } from '@/app/lib/db/scoped';
import { scopedQuery, scopedExecute, scopedInsert } from '@/app/lib/db/scoped';
import { getTripDetail } from '@/app/lib/services/trip-service';
import { getTripBaseCurrency } from '@/app/lib/services/expense-service';
import { createItineraryFromDraft, type DraftItinerary } from '@/app/lib/services/itinerary-service';
import { itineraryDraftPrompt } from '@/app/lib/copilot/itinerary/prompts';
import { DRAFT_ITINERARY_TOOL } from '@/app/lib/copilot/itinerary/tools';
import { getFeatureEntitlements } from '@/app/lib/subscription/entitlements';

const MODEL = 'claude-sonnet-4-5';

// ── Preference shape (the railed levers) ─────────────────────────────────────
export type Pace = 'relaxed' | 'balanced' | 'packed';
export type BudgetLever = 'leaner' | 'as_is' | 'generous';
export interface DraftPreferences {
  brief?: string | null;
  pace?: Pace;
  budget?: BudgetLever;
  focus?: string[];              // e.g. ['food','culture']
}

export interface DraftSession {
  session_id: number;
  trip_id: number;
  mode: 'day' | 'range';
  preferences: DraftPreferences;
  draft: DraftItinerary | null;
  revision_count: number;
  // entitlement snapshot for the UI
  revisions_allowed: number | 'unlimited';
  revisions_remaining: number | 'unlimited';
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function tripDaysOf(startDate: string, endDate: string): { nights: number; totalDays: number } {
  try {
    const a = new Date(startDate + 'T00:00:00').getTime();
    const b = new Date(endDate + 'T00:00:00').getTime();
    const nights = Math.max(0, Math.round((b - a) / 86400000));
    return { nights, totalDays: nights + 1 };
  } catch { return { nights: 0, totalDays: 1 }; }
}

function autoMode(totalDays: number): 'day' | 'range' {
  return totalDays > 14 ? 'range' : 'day';
}

// Turn the structured levers into a short natural-language steer appended to the brief.
function preferencesToSteer(p: DraftPreferences): string {
  const bits: string[] = [];
  if (p.pace === 'relaxed') bits.push('Pace: relaxed — fewer activities per day, leave breathing room and downtime.');
  if (p.pace === 'packed') bits.push('Pace: packed — make full use of each day with more activities.');
  if (p.budget === 'leaner') bits.push('Budget: lean — favour low-cost and free activities, keep estimates modest.');
  if (p.budget === 'generous') bits.push('Budget: generous — premium experiences are welcome where they add value.');
  if (p.focus && p.focus.length) bits.push(`Emphasise: ${p.focus.join(', ')}.`);
  if (p.brief && p.brief.trim()) bits.push(`Traveller's brief: ${p.brief.trim()}`);
  return bits.length ? bits.join('\n') : '';
}

// ── Context enrichment (ADR-016: budget-aware + booking-aware) ───────────────
// SEAMS: fill these two with your real service calls. They return short strings
// appended to the user message. Both are best-effort — never block generation.

async function remainingBudgetHint(ctx: TenantContext, tripId: number, base: string): Promise<string> {
  try {
    // TODO(wire): compute remaining = trip_budget − committed flights/lodging.
    // e.g. const forecast = await getForecast(ctx, tripId);
    //      const remaining = trip.trip_budget - forecast.committedNonItinerary;
    // Return '' until wired so generation isn't blocked.
    return '';
  } catch { return ''; }
}

async function confirmedBookingsHint(ctx: TenantContext, tripId: number): Promise<string> {
  try {
    // TODO(wire): read confirmed flights/lodging and summarise, e.g.
    //   "Arrival flight lands Day 1 ~14:00 (NRT). Staying: Shinjuku Granbell (Tokyo).
    //    Departure flight Day 8 ~10:00." So the AI starts Day 1 after arrival, clusters
    //    near lodging, and keeps the last day light before departure.
    return '';
  } catch { return ''; }
}

// ── The generation call (lifted from the old route, enriched) ────────────────
async function generateDraft(
  ctx: TenantContext, tripId: number, mode: 'day' | 'range', prefs: DraftPreferences,
): Promise<{ draft: DraftItinerary | null; note: string | null }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { draft: null, note: 'The itinerary co-pilot isn’t configured yet.' };

  const trip = await getTripDetail(ctx, tripId);
  if (!trip) return { draft: null, note: 'Trip not found.' };
  const base = await getTripBaseCurrency(ctx, tripId);
  const { nights } = tripDaysOf(trip.start_date, trip.end_date);
  const destinationsHint = trip.destinations.map((d) => d.city).filter((c): c is string => !!c).join(', ');
  const travelerCount = trip.travelers.filter((t) => t.is_active).length;

  const [budgetHint, bookingsHint] = await Promise.all([
    remainingBudgetHint(ctx, tripId, base),
    confirmedBookingsHint(ctx, tripId),
  ]);
  const steer = preferencesToSteer(prefs);

  // The user message carries the steer + enriched context; the system prompt is the existing one.
  const userParts = [
    'Draft a complete itinerary for this trip.',
    steer ? `\nADJUSTMENTS:\n${steer}` : '',
    budgetHint ? `\nBUDGET:\n${budgetHint}` : '',
    bookingsHint ? `\nEXISTING BOOKINGS:\n${bookingsHint}` : '',
    mode === 'range'
      ? '\nUse "range" mode (this is a longer trip — group consecutive days into named stretches).'
      : '\nUse "day" mode (one entry per day).',
  ].filter(Boolean).join('\n');

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: itineraryDraftPrompt({
      homeCurrency: base,
      destinationsHint,
      tripStart: trip.start_date,
      tripEnd: trip.end_date,
      nights,
      travelerCount,
    }),
    tools: [DRAFT_ITINERARY_TOOL],
    tool_choice: { type: 'tool', name: 'draft_itinerary' }, // force a draft on revise — no mini-convo mid-loop
    messages: [{ role: 'user', content: userParts }],
  });

  const toolUse = response.content.find(
    (c): c is Anthropic.ToolUseBlock => c.type === 'tool_use' && c.name === 'draft_itinerary',
  );
  const note = response.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text).join('\n').trim() || null;

  if (!toolUse) return { draft: null, note: note || 'Could not draft a plan — try adjusting your brief.' };
  const draft = toolUse.input as DraftItinerary;
  if (draft.mode !== 'day' && draft.mode !== 'range') return { draft: null, note: 'Could not structure that plan.' };
  return { draft, note };
}

// ── Session row helpers ──────────────────────────────────────────────────────
function rowToSession(r: Record<string, unknown>, allowed: number | 'unlimited'): DraftSession {
  const count = Number(r.revision_count ?? 0);
  const remaining = allowed === 'unlimited' ? 'unlimited' : Math.max(0, allowed - count);
  return {
    session_id: Number(r.session_id),
    trip_id: Number(r.trip_id),
    mode: String(r.mode) as 'day' | 'range',
    preferences: r.preferences_json ? JSON.parse(String(r.preferences_json)) : {},
    draft: r.draft_json ? JSON.parse(String(r.draft_json)) : null,
    revision_count: count,
    revisions_allowed: allowed,
    revisions_remaining: remaining,
  };
}

async function loadRow(ctx: TenantContext, tripId: number): Promise<Record<string, unknown> | null> {
  const rows = await scopedQuery(
    ctx,
    `SELECT session_id, trip_id, mode, preferences_json, draft_json, revision_count
       FROM itinerary_draft_sessions
      WHERE {{tenant}} AND trip_id = ? AND user_id = ? LIMIT 1`,
    [tripId, ctx.userId],
  );
  return rows[0] ?? null;
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Start (or restart) a draft session: replace any existing one, generate the first draft. */
export async function startSession(
  ctx: TenantContext, tripId: number, prefs: DraftPreferences,
): Promise<DraftSession> {
  const trip = await getTripDetail(ctx, tripId);
  if (!trip) throw new Error('Trip not found');
  const { totalDays } = tripDaysOf(trip.start_date, trip.end_date);
  const mode = autoMode(totalDays);

  // Replace-on-new: clear any abandoned session for this (trip,user).
  await scopedExecute(
    ctx,
    `DELETE FROM itinerary_draft_sessions WHERE {{tenant}} AND trip_id = ? AND user_id = ?`,
    [tripId, ctx.userId],
  );

  const { draft, note } = await generateDraft(ctx, tripId, mode, prefs);

  await scopedInsert(ctx, 'itinerary_draft_sessions', {
    trip_id: tripId,
    user_id: ctx.userId,
    mode,
    preferences_json: JSON.stringify(prefs ?? {}),
    draft_json: draft ? JSON.stringify(draft) : null,
    revision_count: 0,
  });

  const ent = await getFeatureEntitlements(ctx);
  const row = await loadRow(ctx, tripId);
  if (!row) throw new Error('Session not created');
  const session = rowToSession(row, ent.aiItineraryRevisions);
  // surface the model's note as a transient (not persisted) hint
  (session as DraftSession & { note?: string | null }).note = note;
  return session;
}

/** Read the current session (for the preview page / refresh). */
export async function getSession(ctx: TenantContext, tripId: number): Promise<DraftSession | null> {
  const row = await loadRow(ctx, tripId);
  if (!row) return null;
  const ent = await getFeatureEntitlements(ctx);
  return rowToSession(row, ent.aiItineraryRevisions);
}

/**
 * Revise the current draft with new/updated preferences. Entitlement-gated:
 * refuses once revision_count reaches the plan's cap (unless 'unlimited').
 */
export async function reviseSession(
  ctx: TenantContext, tripId: number, prefs: DraftPreferences,
): Promise<{ session: DraftSession | null; capped: boolean; note?: string | null }> {
  const row = await loadRow(ctx, tripId);
  if (!row) return { session: null, capped: false };

  const ent = await getFeatureEntitlements(ctx);
  const allowed = ent.aiItineraryRevisions;
  const count = Number(row.revision_count ?? 0);

  // Cap check — server-enforced (tamper-proof).
  if (allowed !== 'unlimited' && count >= allowed) {
    return { session: rowToSession(row, allowed), capped: true };
  }

  const mode = String(row.mode) as 'day' | 'range';
  const merged: DraftPreferences = { ...(row.preferences_json ? JSON.parse(String(row.preferences_json)) : {}), ...prefs };
  const { draft, note } = await generateDraft(ctx, tripId, mode, merged);

  await scopedExecute(
    ctx,
    `UPDATE itinerary_draft_sessions
        SET preferences_json = ?, draft_json = ?, revision_count = revision_count + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE {{tenant}} AND trip_id = ? AND user_id = ?`,
    [JSON.stringify(merged), draft ? JSON.stringify(draft) : String(row.draft_json ?? ''), tripId, ctx.userId],
  );

  const updated = await loadRow(ctx, tripId);
  return { session: updated ? rowToSession(updated, allowed) : null, capped: false, note };
}

/** Accept: write the draft as a NEW unfinalized itinerary, then clear the session. */
export async function acceptSession(
  ctx: TenantContext, tripId: number, opts: { title: string; summary?: string | null },
): Promise<{ itinerary_id: number } | { error: string }> {
  const row = await loadRow(ctx, tripId);
  if (!row) return { error: 'No draft to accept.' };
  if (!row.draft_json) return { error: 'This draft is empty — adjust it first.' };
  if (!opts.title?.trim()) return { error: 'A plan name is required.' };

  const draft = JSON.parse(String(row.draft_json)) as DraftItinerary;
  const itineraryId = await createItineraryFromDraft(ctx, tripId, draft, {
    title: opts.title.trim(),
    summary: opts.summary?.trim() || null,
  });

  // Clear the session — its job is done.
  await scopedExecute(
    ctx,
    `DELETE FROM itinerary_draft_sessions WHERE {{tenant}} AND trip_id = ? AND user_id = ?`,
    [tripId, ctx.userId],
  );

  return { itinerary_id: itineraryId };
}

/** Discard: drop the session, save nothing. */
export async function discardSession(ctx: TenantContext, tripId: number): Promise<void> {
  await scopedExecute(
    ctx,
    `DELETE FROM itinerary_draft_sessions WHERE {{tenant}} AND trip_id = ? AND user_id = ?`,
    [tripId, ctx.userId],
  );
}