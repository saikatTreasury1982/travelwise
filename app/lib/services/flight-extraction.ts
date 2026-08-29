// app/lib/services/flight-extraction.ts
// Door C extraction: booking PDF/text → structured { booking, legs }.
// Native-PDF path (document block) for PDFs; inline text for .txt. Haiku.
import Anthropic from '@anthropic-ai/sdk';
import { EXTRACTION_SYSTEM_PROMPT, EXTRACTION_USER_PROMPT } from '@/app/lib/copilot/flight-extraction/prompts';
import { resolveAirport } from '@/app/lib/airports';

const MODEL = 'claude-haiku-4-5';

export interface ExtractedLeg {
  leg_order: number;
  departure_airport_code: string | null;
  departure_airport_name: string | null;
  departure_city: string | null;
  departure_terminal: string | null;
  departure_datetime: string | null;
  departure_timezone?: string | null;
  arrival_airport_code: string | null;
  arrival_airport_name: string | null;
  arrival_city: string | null;
  arrival_terminal: string | null;
  arrival_datetime: string | null;
  arrival_timezone?: string | null;
  airline: string | null;
  airline_code: string | null;
  flight_number: string | null;
  cabin_class: string | null;
  fare_class: string | null;
  duration_minutes: number | null;
  stops_count: number | null;
  baggage_allowance: string | null;
  checkin_reference: string | null;
}

export interface ExtractedBooking {
  agency_reference: string | null;
  airline_pnr: string | null;
  booking_source: string | null;
  booking_date: string | null;
  total_paid: number | null;
  base_fare: number | null;
  currency_code: string | null;
}

export interface ExtractionResult {
  booking: ExtractedBooking;
  legs: ExtractedLeg[];
  passenger_names: string[];
  uncertain_fields: string[];
  document_notes: string | null;
  extraction_failed?: boolean;
  error_message?: string;
}

const EMPTY_BOOKING: ExtractedBooking = {
  agency_reference: null, airline_pnr: null, booking_source: null, booking_date: null,
  total_paid: null, base_fare: null, currency_code: null,
};

function emptyResult(message: string): ExtractionResult {
  return {
    booking: { ...EMPTY_BOOKING }, legs: [], passenger_names: [],
    uncertain_fields: [], document_notes: null,
    extraction_failed: true, error_message: message,
  };
}

function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/** Coerce whatever the model returned into the shape the UI expects. */
function normaliseResult(raw: any): ExtractionResult {
  const b = raw?.booking ?? {};
  const legs = Array.isArray(raw?.legs) ? raw.legs : [];
  return {
    booking: {
      agency_reference: b.agency_reference ?? null,
      airline_pnr: b.airline_pnr ?? null,
      booking_source: b.booking_source ?? null,
      booking_date: b.booking_date ?? null,
      total_paid: typeof b.total_paid === 'number' ? b.total_paid : null,
      base_fare: typeof b.base_fare === 'number' ? b.base_fare : null,
      currency_code: b.currency_code ?? null,
    },
    legs: legs.map((l: any, i: number) => ({
      leg_order: typeof l.leg_order === 'number' ? l.leg_order : i + 1,
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
      duration_minutes: typeof l.duration_minutes === 'number' ? l.duration_minutes : null,
      stops_count: typeof l.stops_count === 'number' ? l.stops_count : 0,
      baggage_allowance: l.baggage_allowance ?? null,
      checkin_reference: l.checkin_reference ?? null,
    })),
    passenger_names: Array.isArray(raw?.passenger_names) ? raw.passenger_names : [],
    uncertain_fields: Array.isArray(raw?.uncertain_fields) ? raw.uncertain_fields : [],
    document_notes: raw?.document_notes ?? null,
  };
}

/**
 * Fill in IATA codes the document didn't print, using the airports table.
 * A code resolved by lookup (not read from the page) is flagged uncertain so
 * the review screen highlights it.
 */
async function enrichAirports(result: ExtractionResult): Promise<ExtractionResult> {
  const uncertain = new Set(result.uncertain_fields);
  for (let i = 0; i < result.legs.length; i++) {
    const leg = result.legs[i];
    const dep = await resolveAirport({
      code: leg.departure_airport_code, name: leg.departure_airport_name, city: leg.departure_city,
    });
    leg.departure_airport_code = dep.code;
    leg.departure_airport_name = dep.name ?? leg.departure_airport_name;
    leg.departure_city = dep.city ?? leg.departure_city;
    leg.departure_timezone = dep.timezone;
    if (dep.method !== 'document') uncertain.add(`legs[${i}].departure_airport_code`);

    const arr = await resolveAirport({
      code: leg.arrival_airport_code, name: leg.arrival_airport_name, city: leg.arrival_city,
    });
    leg.arrival_airport_code = arr.code;
    leg.arrival_airport_name = arr.name ?? leg.arrival_airport_name;
    leg.arrival_city = arr.city ?? leg.arrival_city;
    leg.arrival_timezone = arr.timezone;
    if (arr.method !== 'document') uncertain.add(`legs[${i}].arrival_airport_code`);
  }
  result.uncertain_fields = [...uncertain];
  return result;
}

export async function extractFlightBooking(
  fileBuffer: Buffer, mimeType: string,
): Promise<ExtractionResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return emptyResult('Extraction is not configured on this server.');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let content: any[];
  if (mimeType === 'application/pdf') {
    content = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: fileBuffer.toString('base64') } },
      { type: 'text', text: EXTRACTION_USER_PROMPT },
    ];
  } else {
    content = [
      { type: 'text', text: `${EXTRACTION_USER_PROMPT}\n\n<document>\n${fileBuffer.toString('utf8')}\n</document>` },
    ];
  }

  let response;
  try {
    response = await client.messages.create({
      model: MODEL, max_tokens: 4000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });
  } catch (err: any) {
    console.error('Extraction API call failed:', err);
    if (err?.status === 401) return emptyResult('Extraction service authentication failed.');
    if (err?.status === 429) return emptyResult('Extraction service is busy. Try again shortly.');
    return emptyResult('Could not read the document. You can enter the details manually.');
  }

  const text = response.content
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('');

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(text));
  } catch {
    console.error('Extraction returned unparseable output:', text.slice(0, 500));
    return emptyResult('The document could not be read. You can enter the details manually.');
  }

  const result = normaliseResult(parsed);
  if (result.legs.length === 0) {
    result.extraction_failed = true;
    result.error_message = result.document_notes ?? 'No flight details were found in this document.';
    return result;
  }
  return enrichAirports(result);
}