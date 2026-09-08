'use client';
import { useState } from 'react';

export default function ClimateTeaser({ tripId, climateInterested }: { tripId: number; climateInterested: boolean }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done'>(climateInterested ? 'done' : 'idle');

  async function notifyMe() {
    if (state !== 'idle') return;
    setState('saving');
    try {
      const res = await fetch('/api/feature-interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'climate_insights', tripId }),
      });
      if (!res.ok) throw new Error();
      setState('done');
    } catch { setState('idle'); }
  }

  return (
    <div className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 mb-5"
      style={{ background: 'color-mix(in srgb, var(--accent) 7%, transparent)', border: '1px solid var(--accent)' }}>
      <span className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[18px]"
        style={{ background: 'color-mix(in srgb, var(--accent) 22%, transparent)' }}>🌤️</span>
      <div className="flex-grow min-w-0">
        <div className="text-[13.5px] font-bold" style={{ color: 'var(--ink)' }}>Know before you go</div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink-soft)' }}>
          {state === 'done'
            ? "Thanks — we'll let you know when climate insights are ready."
            : 'See typical temperatures & rainfall for your exact travel dates — for every destination.'}
        </div>
      </div>
      {state === 'done' ? (
        <span className="text-[12.5px] font-bold flex-shrink-0" style={{ color: 'var(--success)' }}>✓ On the list</span>
      ) : (
        <button onClick={notifyMe} disabled={state === 'saving'}
          className="text-[12.5px] font-bold px-3.5 py-2 rounded-lg flex-shrink-0"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)', border: 'none', opacity: state === 'saving' ? 0.6 : 1 }}>
          {state === 'saving' ? '…' : 'Notify me ✦'}
        </button>
      )}
    </div>
  );
}