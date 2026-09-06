// app/lib/services/weather.ts
// Climate normals for a destination + trip window, from Open-Meteo (free, no key).
// Multi-year sampling in ONE archive request: pull the last N years of the same
// calendar window, keep the days whose MM-DD fall inside the trip window, average.

export interface WeatherNormals {
    tempMin: number;          // avg daily low, °C, rounded
    tempMax: number;          // avg daily high, °C, rounded
    precipitationChance: number; // % of sampled days with >1mm rain
    rainyDaysPerWeek: number; // rainy days scaled to a 7-day feel (for "5/8" style copy)
    windowDays: number;       // length of the trip window in days
    description: string;      // rule-based summary
    years: number;            // how many years were actually sampled
}

const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const YEARS_BACK = 10;

async function fetchWithRetry(url: string, retries = 3): Promise<Response | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(t);
            if (res.ok) return res;
            if (res.status === 400 || res.status === 404) return null; // bad coords/params — don't retry
            throw new Error(`HTTP ${res.status}`);
        } catch (err) {
            if (i === retries - 1) { console.error('[weather] fetch failed:', err); return null; }
            await new Promise((r) => setTimeout(r, 800 * (i + 1)));
        }
    }
    return null;
}

// "2025-07-19" -> {mmdd:"0719"}
function mmdd(dateStr: string): string {
    const d = new Date(dateStr);
    return `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

// Is a given MM-DD within the trip's MM-DD window? Handles year-wrap (e.g. Dec 28 -> Jan 3).
function inWindow(dayMMDD: string, startMMDD: string, endMMDD: string): boolean {
    if (startMMDD <= endMMDD) return dayMMDD >= startMMDD && dayMMDD <= endMMDD;
    return dayMMDD >= startMMDD || dayMMDD <= endMMDD; // wraps across new year
}

function daysBetween(startDate: string, endDate: string): number {
    const a = new Date(startDate).getTime();
    const b = new Date(endDate).getTime();
    const n = Math.round((b - a) / 86400000) + 1; // inclusive
    return n > 0 ? n : 1;
}

function describe(minTemp: number, maxTemp: number, precipChance: number): string {
    const avg = (minTemp + maxTemp) / 2;
    let t = '';
    if (avg < 0) t = 'Freezing';
    else if (avg < 10) t = 'Cold';
    else if (avg < 18) t = 'Cool';
    else if (avg < 25) t = 'Pleasant';
    else if (avg < 32) t = 'Warm';
    else t = 'Hot';
    if (precipChance > 60) return `${t} and wet — expect rain most days; pack a good umbrella.`;
    if (precipChance > 40) return `${t} with frequent showers — a fold-up umbrella is worth it.`;
    if (precipChance > 20) return `${t} with occasional rain — pack a light rain layer just in case.`;
    return `${t} and mostly dry.`;
}

/**
 * Compute climate normals for coordinates + a trip window.
 * ONE archive request spanning YEARS_BACK years; filtered to the trip's MM-DD window.
 */
export async function getClimateNormals(
    latitude: number,
    longitude: number,
    startDate: string,
    endDate: string,
): Promise<WeatherNormals | null> {
    const now = new Date();
    const lastCompleteYear = now.getFullYear() - 1; // avoid partial/very-recent gaps
    const rangeStart = `${lastCompleteYear - YEARS_BACK + 1}-01-01`;
    const rangeEnd = `${lastCompleteYear}-12-31`;

    const url =
        `${ARCHIVE}?latitude=${latitude}&longitude=${longitude}` +
        `&start_date=${rangeStart}&end_date=${rangeEnd}` +
        `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`;

    const res = await fetchWithRetry(url);
    if (!res) return null;
    const data = await res.json();
    const time: string[] = data?.daily?.time;
    const maxA: (number | null)[] = data?.daily?.temperature_2m_max;
    const minA: (number | null)[] = data?.daily?.temperature_2m_min;
    const pA: (number | null)[] = data?.daily?.precipitation_sum;
    if (!time || !maxA || !minA || !pA) return null;

    const startMMDD = mmdd(startDate);
    const endMMDD = mmdd(endDate);

    const maxV: number[] = [];
    const minV: number[] = [];
    const rainFlags: number[] = [];
    const yearsSeen = new Set<string>();

    for (let i = 0; i < time.length; i++) {
        const day = time[i];               // "2019-07-21"
        const dayMMDD = day.slice(5, 7) + day.slice(8, 10);
        if (!inWindow(dayMMDD, startMMDD, endMMDD)) continue;
        if (maxA[i] == null || minA[i] == null) continue;
        maxV.push(maxA[i] as number);
        minV.push(minA[i] as number);
        rainFlags.push((pA[i] ?? 0) > 1 ? 1 : 0);
        yearsSeen.add(day.slice(0, 4));
    }

    if (maxV.length === 0) return null;

    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const tempMax = Math.round(avg(maxV));
    const tempMin = Math.round(avg(minV));
    const precipitationChance = Math.round((rainFlags.reduce((a, b) => a + b, 0) / rainFlags.length) * 100);
    const windowDays = daysBetween(startDate, endDate);
    const rainyDaysPerWeek = Math.round((precipitationChance / 100) * Math.min(windowDays, 7));

    return {
        tempMin,
        tempMax,
        precipitationChance,
        rainyDaysPerWeek,
        windowDays,
        description: describe(tempMin, tempMax, precipitationChance),
        years: yearsSeen.size,
    };
}

/**
 * Coords-first; geocode fallback only if coords missing (old destinations).
 */
export async function getDestinationWeather(
    opts: { latitude: number | null; longitude: number | null; city: string | null; country: string },
    startDate: string,
    endDate: string,
): Promise<WeatherNormals | null> {
    let { latitude, longitude } = opts;
    if (latitude == null || longitude == null) {
        const { geocode } = await import('@/app/lib/services/geocode');
        const g = await geocode(opts.city, opts.country);
        if (g.latitude == null || g.longitude == null) return null;
        latitude = g.latitude; longitude = g.longitude;
    }
    return getClimateNormals(latitude, longitude, startDate, endDate);
}

// Cache key = the trip's date window. Changes only when trip dates change.
export function weatherKey(startDate: string, endDate: string): string {
    return `${mmdd(startDate)}-${mmdd(endDate)}`;
}