// app/components/ui/PaymentMethodCombobox.tsx
'use client';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/app/lib/utils';

export interface PaymentMethod {
  payment_method_id: number;
  payment_type: string;
  issuer: string;
  payment_method_key: string;
  is_active: number;
}
interface Props {
  value: string;
  methods: PaymentMethod[];
  onSelect: (key: string) => void;
  placeholder?: string;
  className?: string;
}

const labelOf = (m: PaymentMethod) => {
  const extra = [m.issuer, m.payment_type].filter(Boolean).join(' • ');
  return extra ? `${m.payment_method_key} (${extra})` : m.payment_method_key;
};

export default function PaymentMethodCombobox({ value, methods, onSelect, placeholder = 'Payment method', className }: Props) {
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
    ? methods.filter(m => labelOf(m).toLowerCase().includes(q) || m.payment_method_key.toLowerCase().includes(q))
    : methods;
  const selected = methods.find(m => m.payment_method_key === value);

  const choose = (key: string) => { onSelect(key); setOpen(false); setQuery(''); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (results[active]) choose(results[active].payment_method_key); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const fieldBase = 'w-full h-[52px] px-3 rounded-[var(--radius-md,11px)] text-sm text-left transition-colors focus:outline-none';

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(fieldBase, 'flex items-center justify-between gap-2', !value && 'text-[color:var(--ink-faint)]')}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: value ? 'var(--ink)' : undefined }}
        >
          <span className="truncate">{selected ? labelOf(selected) : placeholder}</span>
          <span className="shrink-0" style={{ color: 'var(--ink-faint)' }}>▾</span>
        </button>
      ) : (
        <>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={onKey}
            placeholder="Search method…"
            className={cn(fieldBase, 'placeholder:text-[color:var(--ink-faint)]')}
            style={{ background: 'var(--surface)', border: '1px solid var(--accent)', color: 'var(--ink)' }}
          />
          <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto custom-scrollbar rounded-[var(--radius-md,11px)] shadow-2xl"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}>
            {results.length === 0 ? (
              <div className="px-3 py-2 text-sm" style={{ color: 'var(--ink-faint)' }}>No match</div>
            ) : (
              results.map((m, i) => (
                <button
                  key={m.payment_method_key}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(m.payment_method_key)}
                  className="w-full px-3 py-2 text-left transition-colors"
                  style={{ background: i === active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent' }}
                >
                  <div className="text-sm" style={{ color: 'var(--ink)' }}>{m.payment_method_key}</div>
                  {(m.issuer || m.payment_type) && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)' }}>
                      {[m.issuer, m.payment_type].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}