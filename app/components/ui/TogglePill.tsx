// app/components/ui/TogglePill.tsx
'use client';
import { useRef, useState, useEffect } from 'react';
import { cn } from '@/app/lib/utils';

export interface TogglePillOption<T extends string> {
  value: T;
  label: string;
}
interface TogglePillProps<T extends string> {
  value: T;
  options: TogglePillOption<T>[];
  onChange: (value: T) => void;
  className?: string;
  /** Optional per-value CSS color for the sliding indicator. Falls back to accent. */
  activeColors?: Partial<Record<T, string>>;
}

export default function TogglePill<T extends string>({
  value, options, onChange, className, activeColors,
}: TogglePillProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const activeIndex = options.findIndex((o) => o.value === value);

  useEffect(() => {
    const btn = btnRefs.current[activeIndex];
    const container = containerRef.current;
    if (btn && container) {
      const cRect = container.getBoundingClientRect();
      const bRect = btn.getBoundingClientRect();
      setIndicator({ left: bRect.left - cRect.left, width: bRect.width });
    }
  }, [activeIndex, options.length]);

  const indicatorColor = (activeColors && activeColors[value]) || 'var(--accent)';

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex gap-1 p-1 rounded-full', className)}
      style={{ background: 'color-mix(in srgb, var(--ink) 6%, transparent)', border: '1px solid var(--border)' }}
    >
      {/* sliding indicator */}
      <div
        className="absolute top-1 bottom-1 rounded-full border transition-all duration-300 ease-out"
        style={{
          left: indicator.left,
          width: indicator.width,
          background: `color-mix(in srgb, ${indicatorColor} 22%, transparent)`,
          borderColor: `color-mix(in srgb, ${indicatorColor} 55%, transparent)`,
        }}
      />
      {options.map((opt, i) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => { btnRefs.current[i] = el; }}
            type="button"
            onClick={() => onChange(opt.value)}
            className="relative z-10 px-4 py-1 rounded-full text-sm transition-colors whitespace-nowrap"
            style={{ color: active ? 'var(--ink)' : 'var(--ink-soft)' }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}