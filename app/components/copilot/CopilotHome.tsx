// app/components/copilot/CopilotHome.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Button from '@/app/components/ui/Button';
import { useRouter, useSearchParams } from 'next/navigation';
import TripPanel, { type PanelTrip } from '@/app/components/copilot/TripPanel';
import TopNav from '@/app/components/hub/TopNav';

interface Msg { role: 'user' | 'assistant'; content: string; }

export default function CopilotHome({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [trip, setTrip] = useState<PanelTrip | null>(null);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const searchParams = useSearchParams();
  const firedRef = useRef(false);
  useEffect(() => {
    if (firedRef.current) return;
    const q = searchParams.get('q');
    if (q && q.trim()) {
      firedRef.current = true;
      send(q.trim());
      router.replace('/plan');
    }
  }, [searchParams]);   // eslint-disable-line react-hooks/exhaustive-deps

  async function send(text: string) {
    if (loading) return;                     // block overlapping sends
    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next);
    setStarted(true);
    setLoading(true);
    setPrompt('');
    await run(next);
  }

  // Single request per turn. The SERVER runs the full tool chain (save_trip →
  // save_travelers → reply) and returns the final result. No client recursion.
  async function run(convo: Msg[]) {
    try {
      const res = await fetch('/api/copilot/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: convo, activeTripId: trip?.trip_id ?? null }),
      });
      const data = await res.json();
      if (data.trip) setTrip(data.trip as PanelTrip);
      const reply = (data.message ?? '').trim();
      setMessages((m) => [...m, { role: 'assistant', content: reply || 'Tell me a bit more about your trip.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || loading) return;
    send(text);
  }

  if (!started) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--canvas)' }}>
        <TopNav firstName={firstName} active="home" />
        <div className="flex-1 flex items-center justify-center p-6 md:p-16">
          <div className="w-full max-w-[520px]">
            <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>Welcome back, {firstName}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,64px)', lineHeight: 1.02, letterSpacing: '-1px', margin: '0 0 28px', color: 'var(--ink)' }}>
              Where to next?
            </h1>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
                placeholder="Tokyo & Kyoto with the family for 10 days in April 2027, budget around $8,000…"
                rows={3} className="w-full p-4 rounded-[14px] text-[16px] resize-none focus:outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }} />
              <div><Button type="submit" variant="primary" isLoading={loading} disabled={!prompt.trim()}>Start planning</Button></div>
            </form>
            <p className="mt-6 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Describe your trip in a sentence — the co-pilot fills in the rest and asks if anything's missing.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--canvas)' }}>
      <div className="flex-shrink-0">
        <TopNav firstName={firstName} active="home" />
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {trip && (
          <div className="order-1 md:order-2 md:w-[340px] md:flex-shrink-0 md:border-l overflow-y-auto p-4 md:p-5" style={{ borderColor: 'var(--divider)' }}>
            <div className="mb-3 flex justify-end">
              <button onClick={() => router.push(`/trips/${trip.trip_id}`)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
                Open full trip →
              </button>
            </div>
            <TripPanel trip={trip} onChange={(t) => setTrip(t)} />
          </div>
        )}

        <div className="order-2 md:order-1 flex-1 flex flex-col overflow-hidden">
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-6 py-8">
            <div className="max-w-[640px] mx-auto flex flex-col gap-4">
              {messages.map((m, i) => (
                <div key={i} className={m.role === 'user' ? 'self-end' : 'self-start'} style={{ maxWidth: '85%' }}>
                  <div className="px-4 py-3 rounded-2xl text-[15px] leading-relaxed"
                    style={m.role === 'user'
                      ? { background: 'var(--primary)', color: 'var(--primary-ink)' }
                      : { background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
                    {m.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="self-start px-4 py-3 rounded-2xl" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-faint)' }}>
                  Thinking…
                </div>
              )}
            </div>
          </div>

          <form onSubmit={onSubmit} className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--divider)' }}>
            <div className="max-w-[640px] mx-auto flex gap-3 items-end">
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
                placeholder={trip ? 'Anything to change, or add more details?' : 'Type your reply…'}
                rows={1} className="flex-1 p-3 rounded-xl text-[15px] resize-none focus:outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
              <Button type="submit" variant="primary" isLoading={loading} disabled={!prompt.trim()} style={{ width: 'auto', padding: '0 22px' }}>Send</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}