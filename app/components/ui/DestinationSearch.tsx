'use client';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface GeoPick {
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}
interface GeoResult {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
}
interface Props {
  onPick: (dest: GeoPick) => void;
  placeholder?: string;
  className?: string;
}

export default function DestinationSearch({ onPick, placeholder = 'Search a city or place…', className }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
        const data = await res.json();
        setResults(data.results || []);
        setOpen(true);
        setActive(0);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const pick = (r: GeoResult) => {
    onPick({ country: r.country, city: r.name, latitude: r.latitude, longitude: r.longitude });
    setQuery(''); setResults([]); setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) pick(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const resultLabel = (r: GeoResult) => [r.name, r.admin1, r.country].filter(Boolean).join(', ');

  return (
    <div className={cn('relative', className)} ref={rootRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder={placeholder}
        className="w-full h-[44px] px-3 rounded-lg text-[14px] focus:outline-none"
        style={{ background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)' }}
      />
      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto custom-scrollbar rounded-lg shadow-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {loading ? (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>No matches</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.latitude},${r.longitude},${i}`}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(r)}
                className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 transition-colors"
                style={{ background: i === active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent', color: 'var(--ink)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                <span className="truncate">{resultLabel(r)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}