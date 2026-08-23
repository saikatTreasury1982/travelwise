// app/components/copilot/CopilotHome.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/app/components/ui/Button';

interface Msg { role: 'user' | 'assistant'; content: string; }
interface SavedTrip { tripId: number; name: string; }

export default function CopilotHome({ firstName }: { firstName: string }) {
  const router = useRouter();
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<SavedTrip | null>(null);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  async function send(text: string) {
    const userMsg: Msg = { role: 'user', content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setStarted(true);
    setLoading(true);
    setPrompt('');
    try {
      const res = await fetch('/api/copilot/plan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (data.type === 'saved') {
        setSaved(data.trip);
        setMessages((m) => [...m, { role: 'assistant', content: `Your trip "${data.trip.name}" is saved. 🎒` }]);
      } else {
        setMessages((m) => [...m, { role: 'assistant', content: data.message ?? '…' }]);
      }
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

  // --- pre-conversation hero state ---
  if (!started) {
    return (
      <div className="min-h-screen flex flex-col md:flex-row" style={{ background: 'var(--canvas)' }}>
        <div className="flex-1 flex items-center justify-center p-6 md:p-16">
          <div className="w-full max-w-[520px]">
            <p className="text-sm mb-4" style={{ color: 'var(--ink-soft)' }}>Welcome back, {firstName}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,64px)', lineHeight: 1.02, letterSpacing: '-1px', margin: '0 0 28px', color: 'var(--ink)' }}>
              Where to next?
            </h1>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
                placeholder="Tokyo & Kyoto with the family for 10 days in April 2027, budget around $8,000…"
                rows={3}
                className="w-full p-4 rounded-[14px] text-[16px] resize-none focus:outline-none"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              />
              <div>
                <Button type="submit" variant="primary" isLoading={loading} disabled={!prompt.trim()}>
                  Start planning
                </Button>
              </div>
            </form>
            <p className="mt-6 text-[13px]" style={{ color: 'var(--ink-faint)' }}>
              Describe your trip in a sentence — the co-pilot fills in the rest and asks if anything's missing.
            </p>
          </div>
        </div>

        {/* atmospheric panel */}
        <aside className="hidden md:block md:w-[42%]" style={{ backgroundColor: 'var(--panel)', backgroundImage: 'radial-gradient(600px 500px at 50% 40%, rgba(52,96,156,0.4), transparent 62%), radial-gradient(400px 400px at 70% 80%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 60%)' }} />
      </div>
    );
  }

  // --- conversation state ---
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--canvas)' }}>
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--divider)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--ink)' }}>Planning with you</span>
        {saved && (
          <Button variant="outline" onClick={() => router.push('/dashboard')} style={{ width: 'auto', height: 44, padding: '0 18px' }}>
            View my trips
          </Button>
        )}
      </div>

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

      {!saved && (
        <form onSubmit={onSubmit} className="px-6 py-4" style={{ borderTop: '1px solid var(--divider)' }}>
          <div className="max-w-[640px] mx-auto flex gap-3 items-end">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(e); } }}
              placeholder="Type your reply…"
              rows={1}
              className="flex-1 p-3 rounded-xl text-[15px] resize-none focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
            />
            <Button type="submit" variant="primary" isLoading={loading} disabled={!prompt.trim()} style={{ width: 'auto', padding: '0 22px' }}>
              Send
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}