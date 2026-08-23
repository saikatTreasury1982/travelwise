// app/components/ui/CountryCombobox.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface Country {
  country_code: string;
  country_name: string;
  currency_code: string;
}
interface Props {
  value: string;
  countries: Country[];
  onSelect: (country: Country) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export default function CountryCombobox({ value, countries, onSelect, placeholder = 'Select your country', error, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const q = query.trim().toLowerCase();
  const results = q ? countries.filter(c => c.country_name.toLowerCase().includes(q) || c.country_code.toLowerCase().includes(q)) : countries;
  const selectedName = countries.find(c => c.country_code === value)?.country_name;

  const choose = (c: Country) => { onSelect(c); setOpen(false); setQuery(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const fieldBase = 'w-full h-[52px] px-4 rounded-[var(--radius-md,11px)] text-[15px] text-left transition-colors focus:outline-none';
  const fieldColors = (isError: boolean) =>
    `bg-[color:var(--surface)] text-[color:var(--ink)] border ${isError ? 'border-[color:var(--danger)]' : 'border-[color:var(--border)]'} focus:border-[color:var(--accent)]`;

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(fieldBase, fieldColors(!!error), !value && 'text-[color:var(--ink-faint)]')}
        >
          {selectedName || placeholder}
        </button>
      ) : (
        <>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Search country…"
            className={cn(fieldBase, 'bg-[color:var(--surface)] text-[color:var(--ink)] border border-[color:var(--accent)] placeholder:text-[color:var(--ink-faint)]')}
          />
          <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto custom-scrollbar rounded-[var(--radius-md,11px)] shadow-2xl"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>No match</div>
            ) : (
              results.map((c, i) => (
                <button
                  key={c.country_code}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(c)}
                  className="w-full px-3 py-2 text-left text-sm transition-colors"
                  style={{
                    background: i === active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                    color: 'var(--ink)',
                  }}
                >
                  {c.country_name}
                </button>
              ))
            )}
          </div>
        </>
      )}
      {error && <p className="mt-1.5 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  );
}