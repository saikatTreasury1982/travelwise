// app/components/ui/NoteField.tsx
'use client';
import { cn } from '@/app/lib/utils';

interface NoteFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}

export default function NoteField({ value, onChange, placeholder = 'One point per line', rows = 3, className }: NoteFieldProps) {
  const lines = value.split('\n').filter((l) => l.trim());
  return (
    <div className={className}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 rounded-[var(--radius-md,11px)] text-sm transition-colors resize-none custom-scrollbar focus:outline-none"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
      />
      {lines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {lines.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <span style={{ color: 'var(--accent)', marginTop: 2 }}>•</span>
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}