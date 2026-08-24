// app/components/hub/CopilotHero.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CopilotHero({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');

  function start() {
    const text = prompt.trim();
    // Hand the prompt to the full planning page via query param.
    router.push(text ? `/plan?q=${encodeURIComponent(text)}` : '/plan');
  }

  return (
    <div className="relative overflow-hidden rounded-[22px] p-8 md:p-10 mb-8"
      style={{ backgroundColor: 'var(--panel)', backgroundImage: 'radial-gradient(600px 400px at 15% 20%, rgba(52,96,156,0.42), transparent 62%), radial-gradient(500px 380px at 90% 90%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)' }}>
      <p className="text-[13px] mb-1.5" style={{ color: 'rgba(245,242,237,0.6)' }}>Welcome back, {firstName}</p>
      <h1 className="mb-5" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,4vw,44px)', lineHeight: 1.05, color: 'var(--panel-ink)' }}>
        Where to next?
      </h1>
      <div className="flex flex-col sm:flex-row gap-3 max-w-[760px]">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') start(); }}
          placeholder="Tokyo & Kyoto with the family, 10 days in April, $8,000…"
          className="flex-grow h-[54px] px-[18px] rounded-[14px] text-[15px] focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', color: 'var(--panel-ink)' }}
        />
        <button onClick={start}
          className="flex-shrink-0 h-[54px] px-6 rounded-[14px] font-bold text-[15px]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
          Plan with AI
        </button>
      </div>
    </div>
  );
}