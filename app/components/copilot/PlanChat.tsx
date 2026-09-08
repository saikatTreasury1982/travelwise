// app/components/copilot/PlanChat.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import Button from '@/app/components/ui/Button';
import { useRouter } from 'next/navigation';
import TripPanel, { type PanelTrip } from '@/app/components/copilot/TripPanel';

interface Msg { role: 'user' | 'assistant'; content: string; }

/**
 * The trip-creation conversation + live trip-forming panel.
 * Container-agnostic: used inside the slide-over panel AND the /plan fallback page.
 * `initialPrompt` (optional) auto-sends on mount. `onCreated` fires when a trip first appears.
 */
export default function PlanChat({
  initialPrompt, onCreated, compact = false,
}: { initialPrompt?: string; onCreated?: (trip: PanelTrip) => void; compact?: boolean }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [trip, setTrip] = useState<PanelTrip | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firedRef = useRef(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Auto-send an initial prompt once (from the hero).
  useEffect(() => {
    if (firedRef.current) return;
    if (initialPrompt && initialPrompt.trim()) {
      firedRef.current = true;
      send(initialPrompt.trim());
    }
  }, [initialPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent the first time a trip is created.
  useEffect(() => {
    if (trip && !notifiedRef.current) { notifiedRef.current = true; onCreated?.(trip); }
  }, [trip, onCreated]);

  async function send(text: string) {
    if (loading) return;
    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next);
    setLoading(true);
    setPrompt('');
    await run(next);
  }

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

  return (
    <div className="flex flex-col md:flex-row h-full overflow-hidden">
      {/* trip forming — right on desktop, top on mobile */}
      {trip && (
        <div className="order-1 md:order-2 md:w-[320px] md:flex-shrink-0 md:border-l overflow-y-auto p-4 md:p-5" style={{ borderColor: 'var(--divider)' }}>
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

      {/* conversation */}
      <div className="order-2 md:order-1 flex-1 flex flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6">
          <div className="max-w-[620px] mx-auto flex flex-col gap-4">
            {messages.length === 0 && !loading && (
              <div className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>
                Describe your trip in a sentence — the co-pilot fills in the rest and asks if anything's missing.
              </div>
            )}
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

        <form onSubmit={onSubmit} className="px-5 py-4 flex-shrink-0" style={{ borderTop: '1px solid var(--divider)' }}>
          <div className="max-w-[620px] mx-auto flex gap-3 items-end">
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
  );
}