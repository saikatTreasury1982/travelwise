// app/lib/services/geocode.ts
// Server-side geocoding via open-meteo (free, no key). Best-effort with a
// light retry, since the free API occasionally throttles bursts. Returns
// coordinates AND the ISO alpha-2 country code when available.

export interface GeoResult { latitude: number | null; longitude: number | null; countryCode: string | null; }

export async function geocode(city: string | null, country: string): Promise<GeoResult> {
  const name = (city || country || '').trim();
  if (!name) return { latitude: null, longitude: null, countryCode: null };

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (res.ok) {
        const data = await res.json();
        const r = data?.results?.[0];
        if (r && typeof r.latitude === 'number' && typeof r.longitude === 'number') {
          return {
            latitude: r.latitude,
            longitude: r.longitude,
            countryCode: typeof r.country_code === 'string' ? r.country_code.toUpperCase() : null,
          };
        }
        // resolved cleanly but no result → genuine miss, don't retry
        return { latitude: null, longitude: null, countryCode: null };
      }
    } catch {
      // network/timeout/abort — fall through to retry
    }
    await new Promise((res) => setTimeout(res, 400 * (attempt + 1)));
  }
  return { latitude: null, longitude: null, countryCode: null };
}