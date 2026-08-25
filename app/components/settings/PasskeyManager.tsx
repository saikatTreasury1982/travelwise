// app/components/settings/PasskeyManager.tsx
'use client';
import { useState } from 'react';
import Button from '@/app/components/ui/Button';

interface Passkey { credential_id: string; device_label: string | null; created_at: string; last_used_at: string | null; }

function fmt(d: string | null) {
  if (!d) return '—';
  try { return new Date(d.replace(' ', 'T') + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return d; }
}

export default function PasskeyManager({ initial, email }: { initial: Passkey[]; email: string }) {
  const [passkeys, setPasskeys] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  async function addPasskey() {
    setBusy(true); setMsg(null);
    try {
      const { startRegistration } = await import('@simplewebauthn/browser');
      const optRes = await fetch('/api/auth/passkey/register-options', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }),
      });
      if (!optRes.ok) throw new Error('Could not start passkey setup');
      const options = await optRes.json();
      const credential = await startRegistration(options);
      const verRes = await fetch('/api/auth/passkey/register-verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
      });
      if (!verRes.ok) throw new Error('Could not add passkey');
      setMsg({ type: 'ok', text: 'Passkey added' });
      // refresh list
      const list = await fetch('/api/account/passkeys').then((r) => r.json());
      setPasskeys(list.passkeys ?? []);
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed to add passkey' });
    } finally { setBusy(false); }
  }

  async function remove(credentialId: string) {
    if (!confirm('Remove this passkey? You will no longer be able to sign in with it.')) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/account/passkeys', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credentialId }),
      });
      if (!res.ok) throw new Error('Could not remove passkey');
      setPasskeys((p) => p.filter((k) => k.credential_id !== credentialId));
      setMsg({ type: 'ok', text: 'Passkey removed' });
    } catch (err) {
      setMsg({ type: 'err', text: err instanceof Error ? err.message : 'Failed' });
    } finally { setBusy(false); }
  }

  return (
    <div className="max-w-[560px]">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-xs font-bold uppercase mb-1" style={{ color: 'var(--accent-deep)', letterSpacing: '0.4px' }}>Passkeys</h2>
          <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>Sign in with your device's fingerprint, face, or PIN.</p>
        </div>
        <Button variant="outline" onClick={addPasskey} isLoading={busy} style={{ width: 'auto', height: 44, padding: '0 16px', flexShrink: 0 }}>
          Add passkey
        </Button>
      </div>

      {msg && (
        <div className="p-3 rounded-lg text-sm my-4" style={msg.type === 'ok'
          ? { background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '1px solid var(--success)', color: 'var(--success)' }
          : { background: 'var(--danger-bg)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
          {msg.text}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-5">
        {passkeys.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
            <p className="text-[14px]" style={{ color: 'var(--ink-soft)' }}>No passkeys yet.</p>
          </div>
        ) : passkeys.map((k) => (
          <div key={k.credential_id} className="flex items-center gap-3 rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.6" strokeLinecap="round"><path d="M12 11.5v3.2" /><path d="M8.6 10.6a3.4 3.4 0 0 1 6.8 0v2a8 8 0 0 1-.6 3" /><path d="M5.6 10.6a6.4 6.4 0 0 1 12.8 0v2a12 12 0 0 1-.5 3.3" /></svg>
            <div className="flex-grow">
              <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{k.device_label || 'Passkey'}</div>
              <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Added {fmt(k.created_at)}{k.last_used_at ? ` · last used ${fmt(k.last_used_at)}` : ''}</div>
            </div>
            <button onClick={() => remove(k.credential_id)} disabled={busy} className="text-[13px] font-medium px-3 py-1.5 rounded-lg" style={{ color: 'var(--danger)' }}>Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}