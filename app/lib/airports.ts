// app/lib/airports.ts
// Airport resolution against the global `airports` reference table.
// Global table (like currencies/countries) → rawQuery, NOT the tenant-scoped layer.
import { rawQuery } from '@/app/lib/db/client';

export interface AirportRow {
  iata_code: string;
  icao_code: string | null;
  airport_name: string;
  city: string | null;
  country_code: string | null;
  timezone: string | null;
}

export interface ResolvedAirport {
  code: string | null;
  name: string | null;
  city: string | null;
  timezone: string | null;
  method: 'document' | 'exact_name' | 'partial_name' | 'unique_city' | 'none';
  candidates?: AirportRow[];
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(international|intl|airport|airfield|aerodrome|regional|municipal)\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export async function resolveAirport(input: {
  code?: string | null;
  name?: string | null;
  city?: string | null;
}): Promise<ResolvedAirport> {
  // 1. Document gave a code — trust it, but verify it exists.
  if (input.code) {
    const code = input.code.trim().toUpperCase();
    const rows = await rawQuery<AirportRow>(
      'SELECT * FROM airports WHERE iata_code = ? LIMIT 1', [code],
    );
    if (rows.length) {
      const r = rows[0];
      return { code: r.iata_code, name: r.airport_name, city: r.city, timezone: r.timezone, method: 'document' };
    }
    return { code, name: input.name ?? null, city: input.city ?? null, timezone: null, method: 'none' };
  }

  // 2. Exact airport name match.
  if (input.name) {
    const exact = await rawQuery<AirportRow>(
      'SELECT * FROM airports WHERE LOWER(airport_name) = LOWER(?)', [input.name.trim()],
    );
    if (exact.length === 1) {
      const r = exact[0];
      return { code: r.iata_code, name: r.airport_name, city: r.city, timezone: r.timezone, method: 'exact_name' };
    }
    if (exact.length > 1) {
      return { code: null, name: input.name, city: input.city ?? null, timezone: null, method: 'none', candidates: exact };
    }

    // 3. Normalised name match ("Brisbane Airport" vs "Brisbane International Airport").
    const key = normalise(input.name);
    const firstWord = key.split(' ')[0];
    if (firstWord && firstWord.length >= 3) {
      const pool = await rawQuery<AirportRow>(
        `SELECT * FROM airports WHERE airport_name LIKE ? OR city LIKE ? LIMIT 60`,
        [`%${firstWord}%`, `%${firstWord}%`],
      );
      const hits = pool.filter((r) => normalise(r.airport_name) === key);
      if (hits.length === 1) {
        const r = hits[0];
        return { code: r.iata_code, name: r.airport_name, city: r.city, timezone: r.timezone, method: 'partial_name' };
      }
      if (hits.length > 1) {
        return { code: null, name: input.name, city: input.city ?? null, timezone: null, method: 'none', candidates: hits };
      }
    }
  }

  // 4. City match — decisive only when the city has exactly one airport.
  if (input.city) {
    const byCity = await rawQuery<AirportRow>(
      'SELECT * FROM airports WHERE LOWER(city) = LOWER(?)', [input.city.trim()],
    );
    if (byCity.length === 1) {
      const r = byCity[0];
      return { code: r.iata_code, name: r.airport_name, city: r.city, timezone: r.timezone, method: 'unique_city' };
    }
    if (byCity.length > 1) {
      return { code: null, name: input.name ?? null, city: input.city, timezone: null, method: 'none', candidates: byCity };
    }
  }

  // 5. Nothing matched.
  return { code: null, name: input.name ?? null, city: input.city ?? null, timezone: null, method: 'none' };
}

/** Free-text search for the review screen's airport picker. */
export async function searchAirports(q: string, limit = 10): Promise<AirportRow[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  if (/^[A-Za-z]{3}$/.test(term)) {
    const exact = await rawQuery<AirportRow>(
      'SELECT * FROM airports WHERE iata_code = ? LIMIT 1', [term.toUpperCase()],
    );
    if (exact.length) return exact;
  }
  return rawQuery<AirportRow>(
    `SELECT * FROM airports
     WHERE iata_code = ? OR airport_name LIKE ? OR city LIKE ?
     ORDER BY CASE WHEN iata_code = ? THEN 0 WHEN city LIKE ? THEN 1 ELSE 2 END, airport_name
     LIMIT ?`,
    [term.toUpperCase(), `%${term}%`, `%${term}%`, term.toUpperCase(), `${term}%`, limit],
  );
}