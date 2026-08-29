// app/components/ui/CurrencyCombobox.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface Currency {
  currency_code: string;
  currency_name: string;
  currency_symbol?: string | null;
}
interface Props {
  value: string;
  currencies: Currency[];
  onSelect: (code: string) => void;
  placeholder?: string;
  className?: string;
  size?: 'default' | 'compact';
}

export default function CurrencyCombobox({ value, currencies, onSelect, placeholder = 'Currency', className, size = 'default' }: Props) {
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
  const results = q
    ? currencies.filter(c => c.currency_code.toLowerCase().includes(q) || c.currency_name.toLowerCase().includes(q))
    : currencies;

  const choose = (code: string) => { onSelect(code); setOpen(false); setQuery(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active].currency_code); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const fieldBase = cn(
    'rounded-[var(--radius-md,11px)] text-left transition-colors focus:outline-none',
    size === 'compact' ? 'h-[34px] px-2 text-[14px]' : 'h-[52px] px-4 text-[15px]',
  );
  const fieldColors = 'bg-[color:var(--surface)] text-[color:var(--ink)] border border-[color:var(--border)] hover:border-[color:var(--accent)] focus:border-[color:var(--accent)]';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(fieldBase, fieldColors, !value && 'text-[color:var(--ink-faint)]', className)}
      >
        {value || placeholder}
      </button>
    );
  }
  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <input
        ref={inputRef}
        value={query}
        onChange={e => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKey}
        placeholder="Search currency…"
        className={cn(fieldBase, 'w-full bg-[color:var(--surface)] text-[color:var(--ink)] border border-[color:var(--accent)] placeholder:text-[color:var(--ink-faint)]')}
      />
      <div className="absolute z-50 mt-1 w-56 max-h-64 overflow-y-auto custom-scrollbar rounded-[var(--radius-md,11px)] shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
        {results.length === 0 ? (
          <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>No match</div>
        ) : (
          results.map((c, i) => (
            <button
              key={c.currency_code}
              type="button"
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(c.currency_code)}
              className="w-full px-3 py-2 text-left flex items-center gap-3 transition-colors"
              style={{ background: i === active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent' }}
            >
              <span className="font-mono text-sm w-10 shrink-0" style={{ color: 'var(--accent-deep)' }}>{c.currency_code}</span>
              <span className="text-sm truncate" style={{ color: 'var(--ink)' }}>{c.currency_name}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}