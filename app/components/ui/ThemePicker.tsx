// app/components/ThemePicker.tsx
'use client';
import { useState } from 'react';
import { THEMES, type ThemeKey } from '@/app/lib/config/theme';
import { useTheme } from './ThemeProvider';
import CircleIconButton from '@/app/components/ui/CircleIconButton';
import { LogOut } from 'lucide-react';

export function ThemePicker({ onClose }: { onClose?: () => void }) {
  const { theme, setTheme } = useTheme();
  const [saving, setSaving] = useState(false);

  async function handleSelect(key: ThemeKey) {
    const previous = theme;
    setTheme(key);
    setSaving(true);
    try {
      const res = await fetch('/api/preferences/theme', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: key }),
      });
      if (!res.ok) throw new Error('save failed');
    } catch {
      setTheme(previous); // revert on failure
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {THEMES.map((t) => {
        const active = t.key === theme;
        return (
          <button
            key={t.key}
            type="button"
            disabled={saving}
            onClick={() => handleSelect(t.key)}
            aria-pressed={active}
            className="w-full rounded-lg p-4 text-left transition-colors"
            style={{
              background: 'var(--surface)',
              border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
              boxShadow: active ? '0 0 0 1px var(--accent)' : 'none',
            }}
          >
            <div className="flex items-center gap-4">
              <div className="flex shrink-0 gap-1">
                {t.swatch.map((c) => (
                  <span key={c} className="h-4 w-4 rounded-md" style={{ background: c, border: '1px solid var(--border)' }} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium" style={{ color: 'var(--ink)' }}>{t.label}</div>
                <div className="text-sm" style={{ color: 'var(--ink-faint)' }}>{t.description}</div>
              </div>
              {active && <span className="shrink-0 text-sm" style={{ color: 'var(--accent-deep)' }}>Active</span>}
            </div>
          </button>
        );
      })}

      {onClose && (
        <div className="flex justify-end pt-2">
          <CircleIconButton variant="primary" size="small" onClick={onClose} title="Exit" icon={<LogOut className="w-5 h-5" />} />
        </div>
      )}
    </div>
  );
}