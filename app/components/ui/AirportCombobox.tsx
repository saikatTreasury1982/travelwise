'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/app/lib/utils';

export interface AirportChoice {
  iata_code: string;
  airport_name: string;
  city: string | null;
  country_code: string | null;
  timezone: string | null;
}

interface AirportComboboxProps {
  value: string | null;
  displayCity?: string | null;
  displayName?: string | null;
  onSelect: (airport: AirportChoice) => void;
  highlight?: boolean;
  className?: string;
}

export default function AirportCombobox({
  value,
  displayCity,
  displayName,
  onSelect,
  highlight = false,
  className,
}: AirportComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AirportChoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const search = useCallback((q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/airports/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        setResults(d.airports ?? []);
        setActive(0);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => search(query), 200);
    return () => clearTimeout(debounce.current);
  }, [query, search]);

  const choose = (a: AirportChoice) => {
    onSelect(a);
    setOpen(false);
    setQuery('');
    setResults([]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  if (!open) {
    const label = value
      ? `${value}${displayCity ? ` · ${displayCity}` : displayName ? ` · ${displayName}` : ''}`
      : 'Set airport';
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn('w-full px-2 py-1.5 rounded text-left text-sm transition-colors focus:outline-none', className)}
        style={{
          background: highlight ? 'color-mix(in srgb, var(--accent) 6%, var(--surface))' : 'var(--surface)',
          border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border)'}`,
          color: value ? 'var(--ink)' : 'var(--ink-faint)',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        placeholder="City or airport…"
        className="w-full px-2 py-1.5 rounded text-sm focus:outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
      />
      {(loading || results.length > 0 || query.trim().length >= 2) && (
        <div className="absolute z-50 mt-1 w-72 max-h-64 overflow-y-auto custom-scrollbar rounded-lg shadow-2xl"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {loading && <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>Searching…</div>}
          {!loading && results.length === 0 && query.trim().length >= 2 && (
            <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>No airports found</div>
          )}
          {!loading && results.map((a, i) => (
            <button
              key={a.iata_code}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(a)}
              className="w-full px-3 py-2 text-left flex items-center gap-3 transition-colors"
              style={{ background: i === active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent' }}
            >
              <span className="font-mono text-sm w-10 shrink-0" style={{ color: 'var(--accent-deep)' }}>{a.iata_code}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate" style={{ color: 'var(--ink)' }}>{a.airport_name}</span>
                {a.city && (
                  <span className="block text-xs truncate" style={{ color: 'var(--ink-soft)' }}>
                    {a.city}{a.country_code ? `, ${a.country_code}` : ''}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}