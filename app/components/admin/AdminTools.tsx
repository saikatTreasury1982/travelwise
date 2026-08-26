'use client';

import { useState } from 'react';

function ToolCard({ title, description, endpoint }: { title: string; description: string; endpoint: string }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');

  async function run() {
    setRunning(true); setError(''); setResult(null);
    try {
      const res = await fetch(endpoint, { method: 'POST' });
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
      <h2 className="text-[16px] font-bold mb-1" style={{ color: 'var(--ink)' }}>{title}</h2>
      <p className="text-[13px] mb-4" style={{ color: 'var(--ink-soft)' }}>{description}</p>

      <button onClick={run} disabled={running}
        className="h-[44px] px-6 rounded-lg font-bold text-[14px] disabled:opacity-50"
        style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
        {running ? 'Running…' : 'Run'}
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

export default function AdminTools() {
  return (
    <div className="flex flex-col gap-4">
      <ToolCard
        title="Geocode backfill"
        description="Fills latitude/longitude (and country code) for destinations that have none. Safe to run repeatedly."
        endpoint="/api/admin/backfill-geocode"
      />
      <ToolCard
        title="Cover image backfill"
        description="Fetches an Unsplash cover photo for trips that don't have one yet. Uses the trip's first destination. Paced for the Unsplash free tier."
        endpoint="/api/admin/backfill-covers"
      />
    </div>
  );
}