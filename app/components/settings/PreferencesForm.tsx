// app/components/settings/PreferencesForm.tsx
'use client';
import { useState } from 'react';
import SelectPill from '@/app/components/ui/SelectPill';
import type { Preferences } from '@/app/lib/services/preferences-service';

// A labelled row: label + description on the left, the pill on the right.
function PrefRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-3.5" style={{ borderBottom: '1px solid var(--divider)' }}>
      <div>
        <div className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{label}</div>
        {description && <div className="text-[13px] mt-0.5" style={{ color: 'var(--ink-faint)' }}>{description}</div>}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

export default function PreferencesForm({ initial }: { initial: Preferences }) {
  const [prefs, setPrefs] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  async function update(patch: Partial<Preferences>) {
    setPrefs((p) => ({ ...p, ...patch }));
    setSaving(true); setSavedMsg('');
    try {
      const res = await fetch('/api/preferences', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      setSavedMsg('Saved');
      setTimeout(() => setSavedMsg(''), 1500);
    } catch {
      setSavedMsg('Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Unit &amp; display</h2>
        {savedMsg && <span className="text-[12px]" style={{ color: savedMsg === 'Saved' ? 'var(--success)' : 'var(--danger)' }}>{savedMsg}</span>}
      </div>

      <PrefRow label="Date format">
        <SelectPill
          value={prefs.date_format ?? 'DD MMM YYYY'} disabled={saving}
          onChange={(v) => update({ date_format: v })}
          ariaLabel="Date format"
          options={[
            { value: 'DD MMM YYYY', label: '21 Apr 2027' },
            { value: 'DD-MM-YYYY', label: '21-04-2027' },
            { value: 'MM-DD-YYYY', label: '04-21-2027' },
            { value: 'YYYY-MM-DD', label: '2027-04-21' },
          ]}
        />
      </PrefRow>

      <PrefRow label="Time format">
        <SelectPill
          value={prefs.time_format ?? '24h'} disabled={saving}
          onChange={(v) => update({ time_format: v })}
          ariaLabel="Time format"
          options={[
            { value: '24h', label: '24-hour (14:00)' },
            { value: '12h', label: '12-hour (2:00 PM)' },
          ]}
        />
      </PrefRow>

      <PrefRow label="Distance">
        <SelectPill
          value={prefs.distance_unit ?? 'km'} disabled={saving}
          onChange={(v) => update({ distance_unit: v })}
          ariaLabel="Distance unit"
          options={[
            { value: 'km', label: 'Kilometres (80 km)' },
            { value: 'miles', label: 'Miles (50 mi)' },
          ]}
        />
      </PrefRow>

      <h2 className="text-xs font-bold uppercase mt-8 mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Planning co-pilot</h2>

      <PrefRow label="Expert travel tips" description="Proactive travel tips from the co-pilot.">
        <SelectPill
          value={prefs.copilot_tips ? 'on' : 'off'} disabled={saving}
          onChange={(v) => update({ copilot_tips: (v === 'on' ? 1 : 0) as Preferences['copilot_tips'] })}
          ariaLabel="Expert travel tips"
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
        />
      </PrefRow>

      <PrefRow label="Auto-fill place notes" description="Let the co-pilot populate place descriptions.">
        <SelectPill
          value={prefs.copilot_autonotes ? 'on' : 'off'} disabled={saving}
          onChange={(v) => update({ copilot_autonotes: (v === 'on' ? 1 : 0) as Preferences['copilot_autonotes'] })}
          ariaLabel="Auto-fill place notes"
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
        />
      </PrefRow>
    </div>
  );
}