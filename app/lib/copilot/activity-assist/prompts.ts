// app/lib/copilot/activity-assist/prompts.ts
import { composePrompt } from '@/app/lib/copilot/shared/persona';

export type AssistChip = 'getting_here' | 'food' | 'timing' | 'tips';

interface AssistContext {
  activityName: string;
  dayLabel: string;           // "Day 3 · Asakusa" or the range label
  destination: string;        // relevant destination city/area
  lodging: string | null;     // the "from" location, e.g. "your hotel in Shinjuku" — null if none
  tripDates: string;          // "19 Jul – 26 Jul 2026"
  travelers: number;
  otherActivities: string[];  // the day's other activity names, for context
}

const CHIP_TASK: Record<AssistChip, string> = {
  getting_here:
    `Explain how to get to "{ACT}" — practical ways to travel there${''}. If a starting point is known (the traveller's lodging), route FROM there; otherwise give the most useful options from the destination centre. Give 2–3 concrete options (e.g. train line + time + rough fare, taxi, walk) with the trade-offs. Times/fares are reasoned estimates, not live data.`,
  food:
    `Suggest 2–3 good places to eat near "{ACT}". Mix a value and a nicer option where sensible; note cuisine, rough price feel, and how close. Real, plausible areas/venues — never invent a fake specific restaurant with fake details.`,
  timing:
    `Advise on timing for "{ACT}": how long to budget, the best time of day to go (crowds/light), and any ticket/booking/opening tips. Keep it practical.`,
  tips:
    `Give a few practical tips for "{ACT}": etiquette, dress, cash-vs-card, what to watch for, common mistakes. Short and useful.`,
};

/** Structured chip prompt (Concept B): the answer + a save-ready title & summary in ONE call. */
export function assistChipPrompt(chip: AssistChip, ctx: AssistContext): string {
  const task = CHIP_TASK[chip].replace(/\{ACT\}/g, ctx.activityName);
  return composePrompt(`You are helping a traveller with a specific planned activity on their trip. Answer ONLY the asked question, grounded in their trip.

ACTIVITY: ${ctx.activityName}
WHEN: ${ctx.dayLabel} · trip ${ctx.tripDates}
WHERE: ${ctx.destination}
${ctx.lodging ? `STARTING POINT (their stay): ${ctx.lodging}` : 'No specific lodging on file — use the destination centre as reference.'}
TRAVELLERS: ${ctx.travelers}
${ctx.otherActivities.length ? `Same day also: ${ctx.otherActivities.join('; ')}.` : ''}

YOUR TASK
${task}

RULES
- Ground the answer in THIS trip (use the starting point, dates, party size).
- Times, fares and prices are REASONED ESTIMATES — say so; you have no live data.
- NEVER invent booking URLs, confirmation numbers, or fake specific venues/prices presented as fact. No links.
- Be concise and practical — a traveller reads this on a phone.

Then call assist_answer ONCE with: the readable "answer" (what the user sees), a short "title" (≤8 words, glanceable — for their saved list), and a brief "summary" (1–2 sentences capturing the key takeaway to save).`);
}

/** Free-ask (Concept A): conversational; on save, summarise separately. */
export function assistAskPrompt(ctx: AssistContext): string {
  return composePrompt(`You are helping a traveller with their planned activity "${ctx.activityName}" (${ctx.dayLabel}, ${ctx.destination}, trip ${ctx.tripDates}${ctx.lodging ? `, staying at ${ctx.lodging}` : ''}). Answer their questions helpfully and concisely, grounded in this trip. Estimates only — no live data, no invented URLs or fake venues. They're on a phone; keep it tight.`);
}

/** Summarise a free-ask exchange into a save-ready title + summary. */
export function assistSummarisePrompt(): string {
  return composePrompt(`Distil the following assistant answer into a SHORT saved note. Call save_summary once with a "title" (≤8 words, glanceable) and a "summary" (1–2 sentences, the key takeaway). No fluff.`);
}