// app/lib/copilot/flights/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

/**
 * The model calls this once per suggested flight option. Each becomes a
 * `shortlisted` flight_booking with its legs. No PNR/refs (it's an option).
 */
export const SUGGEST_FLIGHT_TOOL: Anthropic.Tool = {
  name: 'suggest_flight',
  description: 'Record one plausible flight option (a candidate to shortlist) for the trip. Call once per distinct option.',
  input_schema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'Short label for this option, e.g. "Cheapest · 1 stop" or "Direct · Qantas".' },
      airline: { type: 'string', description: 'Primary marketing carrier, e.g. "Qantas Airways".' },
      estimated_price: { type: 'number', description: `Total estimated fare for the whole option, in the trip's base currency.` },
      currency_code: { type: 'string', description: 'ISO 4217 code for the estimate, e.g. "AUD".' },
      legs: {
        type: 'array',
        description: 'Ordered flight segments. Round trip = outbound + return (2 legs); one-way = 1 leg.',
        items: {
          type: 'object',
          properties: {
            departure_airport_code: { type: 'string', description: 'IATA code, e.g. "BNE".' },
            arrival_airport_code: { type: 'string', description: 'IATA code, e.g. "NRT".' },
            departure_datetime: { type: 'string', description: 'Local "YYYY-MM-DDTHH:MM".' },
            arrival_datetime: { type: 'string', description: 'Local "YYYY-MM-DDTHH:MM".' },
            airline: { type: 'string' },
            flight_number: { type: 'string', description: 'e.g. "QF61". Optional.' },
            cabin_class: { type: 'string', description: 'economy | premium | business | first.' },
            stops_count: { type: 'number', description: '0 for direct.' },
            duration_minutes: { type: 'number', description: 'Flight time for this leg in whole minutes (e.g. 9h30m = 570).' },
          },
          required: ['departure_airport_code', 'arrival_airport_code', 'departure_datetime'],
        },
      },
    },
    required: ['airline', 'estimated_price', 'currency_code', 'legs'],
  },
};