'use client';

import { useState } from 'react';

export default function AdminTools() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');

  async function runBackfill() {
    setRunning(true); setError(''); setResult(null);
    try {
      const res = await fetch('/api/admin/backfill-geocode', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h2 className="text-[16px] font-bold mb-1" style={{ color: 'var(--ink)' }}>Geocode backfill</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--ink-soft)' }}>
        Fills in latitude/longitude for destinations that have none (e.g. AI-created ones). Safe to run repeatedly.
      </p>

      <button onClick={runBackfill} disabled={running}
        className="h-[44px] px-6 rounded-lg font-bold text-[14px] disabled:opacity-50"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
        {running ? 'Running…' : 'Run geocode backfill'}
      </button>

      {error && <div className="mt-4 text-[14px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {result != null && (
        <pre className="mt-4 text-[13px] rounded-lg p-4 overflow-x-auto" style={{ background: 'var(--canvas)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
{JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}