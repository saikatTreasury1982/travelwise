// app/lib/copilot/lodging/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

/** Model calls this once per suggested stay option → a shortlisted lodging_stay. */
export const SUGGEST_STAY_TOOL: Anthropic.Tool = {
  name: 'suggest_stay',
  description: 'Record one plausible accommodation option (a candidate to shortlist) for a destination. Call once per distinct option.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Hotel/property name, or a short descriptive label e.g. "Mid-range hotel, Shinjuku".' },
      accommodation_type: { type: 'string', description: 'Hotel | Airbnb | Hostel | Resort | Apartment | Villa | Guesthouse | Inn | Cruise | Other.' },
      area: { type: 'string', description: 'Neighbourhood / area, e.g. "Shinjuku, Tokyo".' },
      city: { type: 'string', description: 'The trip destination city this stay is for — MUST be one of the trip destination cities given in the prompt, e.g. "Tokyo". Used to group the stay under the right destination.' },
      estimated_nightly: { type: 'number', description: `Estimated nightly rate in the trip's base currency.` },
      currency_code: { type: 'string', description: 'ISO 4217, e.g. "AUD".' },
      label: { type: 'string', description: 'Short positioning label, e.g. "Value", "Comfortable · central", "Premium".' },
      note: { type: 'string', description: 'One short line on why this option (optional).' },
      check_in: { type: 'string', description: 'Tentative check-in, YYYY-MM-DD (from the conversation).' },
      check_out: { type: 'string', description: 'Tentative check-out, YYYY-MM-DD.' },
    },
    required: ['name', 'accommodation_type', 'estimated_nightly', 'currency_code', 'check_in', 'check_out', 'city'],
  },
};