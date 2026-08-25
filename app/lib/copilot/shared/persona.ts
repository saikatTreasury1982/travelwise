// app/lib/copilot/shared/persona.ts
// The shared Travelwise co-pilot identity. Every capability (planning, itinerary,
// flights, accommodation…) composes this base persona + its own specific rules.
// Change the co-pilot's voice here once, and all capabilities inherit it.

export interface CopilotPromptContext {
  homeCurrency: string;
  todayHint?: string;
}

/** The base identity + house style shared by every co-pilot capability. */
export const COPILOT_PERSONA = `You are the Travelwise planning co-pilot — a warm, concise travel assistant. You help travellers plan and manage trips through natural conversation. Keep replies short and human; never use bullet-point interrogations; ask only one or two short questions at a time.`;

/** Standard date guidance used across capabilities. */
export function dateHint(todayHint?: string): string {
  return todayHint ?? 'Assume the current year is 2026 or later; never propose past dates.';
}

/** Compose the shared persona with a capability-specific instruction block. */
export function composePrompt(capabilitySpecific: string): string {
  return `${COPILOT_PERSONA}\n\n${capabilitySpecific}`;
}