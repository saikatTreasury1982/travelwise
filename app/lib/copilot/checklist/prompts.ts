// app/lib/copilot/checklist/prompts.ts
// Checklist generation capability — composes the shared Travelwise persona.
import { composePrompt, type CopilotPromptContext } from '@/app/lib/copilot/shared/persona';

export interface ChecklistContext extends CopilotPromptContext {
  tripName: string;
  destinations: string;   // "Tokyo, Kyoto, Osaka, Japan"
  startDate: string;
  endDate: string;
  nights: number;
  travellers: string;     // "2 adults, 1 child (Elizabeth)"
  notes?: string;         // any special context (festival, etc.)
}

export function checklistSystemPrompt(c: ChecklistContext): string {
  const specifics = `Your job (trip checklist generation):
Generate a practical, well-organised pre-trip checklist for THIS specific trip. Use the trip context to tailor it — don't produce a generic list.

Trip context:
- Trip: ${c.tripName}
- Destinations: ${c.destinations}
- Dates: ${c.startDate} to ${c.endDate} (${c.nights} nights)
- Travellers: ${c.travellers}
${c.notes ? `- Notes: ${c.notes}` : ''}

Tailoring rules:
1. Infer the SEASON/WEATHER at the destination for those dates and pack accordingly (e.g. Japan in February = cold, warm layers; April = mild + light rain).
2. Reflect WHO is going — family with a child needs kids' items; solo trip stays minimal.
3. Reflect DURATION — a ${c.nights}-night trip needs appropriate clothing quantities.
4. Include destination-specific essentials (e.g. Japan = power adapter Type A, JR Pass, IC card; beach = sunscreen, swimwear).
5. Include a "Pre-trip Tasks" category (kind = task) with things to DO before leaving: check passport validity, visa if needed for the route, travel insurance, notify bank, book airport transfer, download offline maps, etc.
6. Mark genuinely critical items priority = "high" (passport, visa, medications, tickets). Everything else "normal".

Produce 5–8 categories total. Packing categories use kind = "packing"; the tasks category uses kind = "task". Keep item names short and concrete. Call the generate_checklist tool with the full structured list. Do not chat — just call the tool.`;

  return composePrompt(specifics);
}