'use client';
import { useState, useRef, useEffect } from 'react';

interface Option {
  name: string; accommodation_type?: string; area?: string;
  estimated_nightly: number; currency_code: string;
  check_in?: string; check_out?: string; label?: string; note?: string;
  destination_id?: number | null;
}
interface Msg { role: 'user' | 'assistant'; content: string; }

interface Props { tripId: number; onShortlisted: () => void; onClose: () => void; }

function nightsOf(ci?: string, co?: string) {
  if (!ci || !co) return 0;
  const a = new Date(ci + 'T00:00:00').getTime(), b = new Date(co + 'T00:00:00').getTime();
  return isNaN(a) || isNaN(b) || b <= a ? 0 : Math.round((b - a) / 86400000);
}

export default function LodgingSuggestPanel({ tripId, onShortlisted, onClose }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [started, setStarted] = useState(false);
  const [shortlisting, setShortlisting] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, options, loading]);

  async function run(convo: Msg[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/lodging/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: convo }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: (data.message ?? '').trim() || 'Here are some places.' }]);
      setOptions(Array.isArray(data.options) ? data.options : []);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally { setLoading(false); }
  }

  function start() {
    setStarted(true);
    const first: Msg[] = [{ role: 'user', content: 'Suggest places to stay for my trip.' }];
    setMessages(first);
    run(first);
  }
  function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next); setInput(''); setOptions([]);
    run(next);
  }

  async function shortlist(o: Option, idx: number) {
    setShortlisting(idx);
    try {
      const res = await fetch(`/api/trips/${tripId}/lodging/shortlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o),
      });
      if (res.ok) { setOptions((prev) => prev.map((x, i) => (i === idx ? { ...x, _done: true } as any : x))); onShortlisted(); }
    } finally { setShortlisting(null); }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>✦ Suggest places to stay</h3>
        <button onClick={onClose} className="tw-link text-[13px]" style={{ color: 'var(--ink-soft)' }}>Close</button>
      </div>

      {!started ? (
        <div>
          <p className="text-[14px] mb-4" style={{ color: 'var(--ink-soft)' }}>
            The co-pilot will ask which destination and your rough dates, then suggest a few options with nightly estimates. You book through a provider after shortlisting.
          </p>
          <button onClick={start} className="tw-btn text-[14px] font-semibold px-5 py-2.5 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Start</button>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="max-h-[420px] overflow-y-auto flex flex-col gap-3 mb-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'self-end' : 'self-start'} style={{ maxWidth: '85%' }}>
                <div className="px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'var(--primary)', color: 'var(--primary-ink)' }
                    : { background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink)' }}>
                  {m.content}
                </div>
              </div>
            ))}

            {options.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-1">
                {options.map((o, i) => {
                  const done = (o as any)._done;
                  const nights = nightsOf(o.check_in, o.check_out);
                  const total = nights > 0 ? o.estimated_nightly * nights : null;
                  return (
                    <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{o.name}</span>
                        {o.label && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent-deep)' }}>{o.label}</span>}
                        <span className="ml-auto text-[13px] font-bold" style={{ color: 'var(--accent-deep)' }}>
                          {o.currency_code} {o.estimated_nightly?.toLocaleString()}<span className="text-[11px] font-normal" style={{ color: 'var(--ink-faint)' }}>/night est.</span>
                        </span>
                      </div>
                      <div className="text-[12.5px]" style={{ color: 'var(--ink-soft)' }}>
                        {o.accommodation_type}{o.area ? ` · ${o.area}` : ''}
                        {nights > 0 && ` · ${o.check_in} → ${o.check_out} (${nights} nights${total != null ? ` · ${o.currency_code} ${total.toLocaleString()} total` : ''})`}
                      </div>
                      {o.note && <div className="text-[12px] mt-1" style={{ color: 'var(--ink-faint)' }}>{o.note}</div>}
                      <div className="flex justify-end mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--divider)' }}>
                        <button onClick={() => shortlist(o, i)} disabled={done || shortlisting === i}
                          className="tw-link text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                          style={done
                            ? { background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)' }
                            : { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>
                          {done ? '✓ Shortlisted' : shortlisting === i ? 'Adding…' : '+ Shortlist'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {loading && <div className="self-start px-3.5 py-2.5 rounded-2xl text-[14px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>Thinking…</div>}
          </div>

          <div className="flex gap-2 items-end">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Reply, or refine: 'cheaper', 'more central'…" rows={1}
              className="flex-1 p-2.5 rounded-lg text-[14px] resize-none focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            <button onClick={send} disabled={!input.trim() || loading} className="tw-btn text-[14px] font-semibold px-4 py-2.5 rounded-lg"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: input.trim() && !loading ? 1 : 0.5 }}>Send</button>
          </div>
        </>
      )}
    </div>
  );
}