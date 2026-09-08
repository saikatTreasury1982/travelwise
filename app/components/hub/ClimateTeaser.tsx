// app/components/hub/ClimateTeaser.tsx
'use client';
import { useState, useEffect } from 'react';

export default function ClimateTeaser({ tripId }: { tripId: number }) {
  const [state, setState] = useState<'loading' | 'idle' | 'saving' | 'done'>('loading');

  // On mount: has this USER already registered interest? (user-level, not per-trip)
  useEffect(() => {
    let alive = true;
    fetch('/api/feature-interest?feature=climate_insights')
      .then((r) => r.ok ? r.json() : { interested: false })
      .then((d) => { if (alive) setState(d.interested ? 'done' : 'idle'); })
      .catch(() => { if (alive) setState('idle'); });
    return () => { alive = false; };
  }, []);

  async function notifyMe() {
    if (state !== 'idle') return;
    setState('saving');
    try {
      const res = await fetch('/api/feature-interest', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: 'climate_insights', tripId }),
      });
      if (!res.ok) throw new Error('failed');
      setState('done');
    } catch {
      setState('idle'); // let them retry; don't falsely show success
    }
  }

  // While checking, render nothing (avoids a flash of the wrong state).
  if (state === 'loading') return null;

  return (
    <div className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 mt-3"
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