// app/api/admin/importAirports/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { rawExecute } from '@/app/lib/db/client';

export const runtime = 'nodejs';
export const maxDuration = 300; // large import

// Minimal CSV line parser (handles quoted fields + escaped "" quotes).
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

export async function POST(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 });

  let text: string;
  try {
    const fd = await request.formData();
    const file = fd.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'No file' }, { status: 400 });
    text = await file.text();
  } catch {
    return NextResponse.json({ error: 'Bad upload' }, { status: 400 });
  }

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return NextResponse.json({ error: 'CSV looks empty' }, { status: 400 });

  // Header → column index map (tolerant of column order).
  const header = parseLine(lines[0]).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''));
  const idx = (name: string) => header.indexOf(name);
  const iIata = idx('iata_code'), iIcao = idx('icao_code'), iName = idx('airport_name'),
    iCity = idx('city'), iCountry = idx('country_code'), iTz = idx('timezone'),
    iLat = idx('latitude'), iLon = idx('longitude');
  if (iIata < 0 || iName < 0) {
    return NextResponse.json({ error: 'CSV missing iata_code / airport_name columns' }, { status: 400 });
  }

  const val = (arr: string[], i: number) => (i >= 0 && arr[i] != null && arr[i] !== '' ? arr[i] : null);
  const num = (arr: string[], i: number) => { const v = val(arr, i); return v == null ? null : Number(v); };

  const BATCH = 400;
  let inserted = 0, skipped = 0;
  const errors: string[] = [];

  for (let start = 1; start < lines.length; start += BATCH) {
    const slice = lines.slice(start, start + BATCH);
    const rows: (string | number | null)[][] = [];
    for (const line of slice) {
      const f = parseLine(line);
      const iata = val(f, iIata);
      const name = val(f, iName);
      if (!iata || !name) { skipped++; continue; } // NOT NULL guards
      rows.push([
        iata, val(f, iIcao), name, val(f, iCity),
        val(f, iCountry), val(f, iTz), num(f, iLat), num(f, iLon),
      ]);
    }
    if (rows.length === 0) continue;

    const placeholders = rows.map(() => '(?,?,?,?,?,?,?,?)').join(',');
    const flat = rows.flat();
    try {
      await rawExecute(
        `INSERT OR IGNORE INTO airports
           (iata_code, icao_code, airport_name, city, country_code, timezone, latitude, longitude)
         VALUES ${placeholders}`,
        flat,
      );
      inserted += rows.length;
    } catch (e) {
      errors.push(`Batch at row ${start}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    inserted, skipped,
    total_data_rows: lines.length - 1,
    errors: errors.slice(0, 5),
  });
}