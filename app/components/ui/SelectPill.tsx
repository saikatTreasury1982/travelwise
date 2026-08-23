// app/components/ui/SelectPill.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/app/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface SelectPillOption {
  value: string;
  label: string;
}
interface SelectPillProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectPillOption[];
  placeholderOption?: SelectPillOption;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  icon?: LucideIcon;
}

export default function SelectPill({
  value, onChange, options, placeholderOption, ariaLabel, className, disabled = false, icon: Icon,
}: SelectPillProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const allOptions = placeholderOption ? [placeholderOption, ...options] : options;
  const selected = allOptions.find(o => o.value === value) || placeholderOption || allOptions[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className={cn('relative inline-block', className)} ref={ref}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full py-2 pl-4 pr-3 text-sm transition-all cursor-pointer focus:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      >
        {Icon && <Icon className="w-4 h-4 shrink-0" style={{ color: 'var(--accent)' }} />}
        <span className="truncate max-w-[140px]">{selected?.label}</span>
        <svg className={cn('w-4 h-4 shrink-0 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--ink-faint)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            className="absolute left-0 top-full mt-1 z-50 min-w-full w-max max-w-[220px] max-h-60 overflow-y-auto custom-scrollbar rounded-xl shadow-2xl py-1"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}
          >
            {allOptions.map(opt => (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={opt.value === value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className="w-full text-left px-4 py-2 text-sm transition-colors"
                style={{
                  background: opt.value === value ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'transparent',
                  color: 'var(--ink)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}