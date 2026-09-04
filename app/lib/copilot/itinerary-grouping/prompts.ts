// app/lib/copilot/itinerary-grouping/prompts.ts
import { composePrompt } from '@/app/lib/copilot/shared/persona';

/**
 * Suggests display groupings for a flat list of activities in ONE day/range.
 * Purely cosmetic — never changes costs. Suggestion-only; the user approves.
 */
export function itineraryGroupingPrompt(): string {
  return composePrompt(`You are given a flat list of itinerary activities for a single day (or stretch) of a trip. Your ONLY job is to suggest how to GROUP them under a few short category headings for easier reading — e.g. "Morning", "Dining", "Excursion", "Evening", "Getting around".

RULES
- Grouping is purely for display. Do NOT change, rename, reprice or invent activities.
- Only group when it genuinely helps. If the activities don't cluster naturally, return NO groups.
- Use 2–5 short, sensible category names. Every activity you place must come from the given list (by its activity_id).
- It is fine to leave some activities ungrouped — only include the ones that clearly belong to a group.
- Prefer time-of-day or theme groupings that match how a traveller reads a day.

Call suggest_grouping once with your proposed categories, or with an empty categories array if nothing should be grouped.`);
}