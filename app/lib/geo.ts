// app/lib/geo.ts
// Approximate coordinates for stylized map plotting. Keyed by lowercase
// city or country. Extend as needed; unknown names are skipped.
const COORDS: Record<string, { lon: number; lat: number }> = {
  tokyo: { lon: 139.7, lat: 35.7 }, kyoto: { lon: 135.8, lat: 35.0 }, osaka: { lon: 135.5, lat: 34.7 },
  japan: { lon: 138, lat: 36 },
  paris: { lon: 2.3, lat: 48.9 }, france: { lon: 2, lat: 47 },
  london: { lon: -0.1, lat: 51.5 }, 'united kingdom': { lon: -2, lat: 54 },
  rome: { lon: 12.5, lat: 41.9 }, italy: { lon: 12, lat: 42 },
  'new york': { lon: -74, lat: 40.7 }, 'united states': { lon: -98, lat: 39 },
  sydney: { lon: 151.2, lat: -33.9 }, australia: { lon: 134, lat: -25 },
  bangkok: { lon: 100.5, lat: 13.8 }, thailand: { lon: 101, lat: 15 },
  singapore: { lon: 103.8, lat: 1.35 },
  delhi: { lon: 77.2, lat: 28.6 }, mumbai: { lon: 72.9, lat: 19.1 }, india: { lon: 79, lat: 22 },
  dubai: { lon: 55.3, lat: 25.2 }, 'united arab emirates': { lon: 54, lat: 24 },
  berlin: { lon: 13.4, lat: 52.5 }, germany: { lon: 10, lat: 51 },
  barcelona: { lon: 2.2, lat: 41.4 }, madrid: { lon: -3.7, lat: 40.4 }, spain: { lon: -4, lat: 40 },
};

export function lookupCoords(name?: string | null): { lon: number; lat: number } | null {
  if (!name) return null;
  return COORDS[name.trim().toLowerCase()] ?? null;
}