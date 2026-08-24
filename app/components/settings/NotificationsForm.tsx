// app/components/settings/NotificationsForm.tsx
'use client';
import { useState } from 'react';
import SelectPill from '@/app/components/ui/SelectPill';
import ComingSoon from '@/app/components/hub/ComingSoon';
import type { Preferences } from '@/app/lib/services/preferences-service';

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

export default function NotificationsForm({ initial }: { initial: Preferences }) {
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
      setSavedMsg('Saved'); setTimeout(() => setSavedMsg(''), 1500);
    } catch { setSavedMsg('Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-xs font-bold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Email</h2>
        {savedMsg && <span className="text-[12px]" style={{ color: savedMsg === 'Saved' ? 'var(--success)' : 'var(--danger)' }}>{savedMsg}</span>}
      </div>

      <PrefRow label="Email notifications" description="Trip reminders and account emails.">
        <SelectPill
          value={prefs.email_notifications ? 'on' : 'off'} disabled={saving}
          onChange={(v) => update({ email_notifications: (v === 'on' ? 1 : 0) as Preferences['email_notifications'] })}
          ariaLabel="Email notifications"
          options={[{ value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]}
        />
      </PrefRow>

      <h2 className="text-xs font-bold uppercase mt-8 mb-3" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>More channels</h2>
      <ComingSoon height={130} note="Push notifications, budget alerts, and trip reminders — coming soon" />
    </div>
  );
}