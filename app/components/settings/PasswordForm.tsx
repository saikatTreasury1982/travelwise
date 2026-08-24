// app/components/settings/PasswordForm.tsx
'use client';
import { useState, useEffect } from 'react';
import Input from '@/app/components/ui/Input';
import Button from '@/app/components/ui/Button';

export default function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [reqs, setReqs] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/auth/password/requirements').then((r) => r.json()).then((d) => setReqs(d.description ?? '')).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next !== confirm) { setMsg({ type: 'err', text: 'New passwords do not match' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: hasPassword ? current : undefined, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update password');
      setMsg({ type: 'ok', text: 'Password updated' });
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[440px]">
      <h2 className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>
        {hasPassword ? 'Change password' : 'Set a password'}
      </h2>
      <p className="text-[14px] mb-5" style={{ color: 'var(--ink-soft)' }}>
        {hasPassword ? 'Update the password you use to sign in.' : 'You sign in with a passkey. Add a password as a backup.'}
      </p>

      {msg && (
        <div className="p-3 rounded-lg text-sm mb-4" style={msg.type === 'ok'
          ? { background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '1px solid var(--success)', color: 'var(--success)' }
          : { background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {msg.text}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        {hasPassword && (
          <Input name="current" type="password" label="Current password" value={current}
            onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        )}
        <Input name="new" type="password" label="New password" value={next}
          onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required
          helperText={reqs || undefined} />
        <Input name="confirm" type="password" label="Confirm new password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
        <div className="mt-1">
          <Button type="submit" variant="primary" isLoading={saving}>
            {hasPassword ? 'Update password' : 'Set password'}
          </Button>
        </div>
      </form>
    </div>
  );
}