'use client';
import { useState, useRef, useEffect } from 'react';

interface Currency { currency_code: string; currency_name: string; currency_symbol?: string | null; }
interface Msg { role: 'user' | 'assistant'; content: string; }
interface Leg {
  departure_airport_code?: string; arrival_airport_code?: string;
  departure_datetime?: string; arrival_datetime?: string;
  airline?: string; flight_number?: string; cabin_class?: string; stops_count?: number;
  duration_minutes?: number;
}
interface Option { label?: string; airline: string; estimated_price: number; currency_code: string; legs: Leg[]; }

interface Props {
  tripId: number;
  onShortlisted: () => void;   // refresh the compare board
  onClose: () => void;
}

function fmtDT(dt?: string) {
  if (!dt) return '';
  const [date, time] = dt.split('T');
  try {
    const nice = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return time ? `${nice} ${time.slice(0, 5)}` : nice;
  } catch { return dt.replace('T', ' '); }
}

const fmtDur = (m?: number) => (m == null ? '' : `${Math.floor(m / 60)}h ${m % 60}m`);

const stopsLabel = (legs: Leg[]) => {
  const s = legs.reduce((n, l) => n + (l.stops_count ?? 0), 0);
  return s === 0 && legs.length <= 1 ? 'direct' : `${legs.length > 1 ? legs.length + ' legs' : ''}${s ? ` · ${s} stop${s > 1 ? 's' : ''}` : ''}`.trim().replace(/^·\s*/, '') || 'direct';
};

export default function FlightSuggestPanel({ tripId, onShortlisted, onClose }: Props) {
  const [tripType, setTripType] = useState<'round_trip' | 'one_way'>('round_trip');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [started, setStarted] = useState(false);
  const [shortlisting, setShortlisting] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, options, loading]);

  async function run(convo: Msg[]) {
    setLoading(true);
    try {
      const res = await fetch(`/api/trips/${tripId}/flights/suggest`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: convo, tripType }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: 'assistant', content: (data.message ?? '').trim() || 'Here are some options.' }]);
      setOptions(Array.isArray(data.options) ? data.options : []);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function start() {
    setStarted(true);
    const first: Msg[] = [{ role: 'user', content: 'Suggest flights for my trip.' }];
    setMessages(first);
    run(first);
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next);
    setInput('');
    setOptions([]);   // new turn → fresh options
    run(next);
  }

  async function shortlist(opt: Option, idx: number) {
    setShortlisting(idx);
    try {
      const res = await fetch(`/api/trips/${tripId}/flights/shortlist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opt),
      });
      if (res.ok) {
        setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, _done: true } as any : o)));
        onShortlisted();
      }
    } finally {
      setShortlisting(null);
    }
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid var(--accent)' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>✦ Suggest flights with AI</h3>
        <button onClick={onClose} className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>Close</button>
      </div>

      {!started ? (
        <div>
          <p className="text-[14px] mb-4" style={{ color: 'var(--ink-soft)' }}>
            The co-pilot will ask where you're flying from, then suggest a few options. Fares are estimates you refine when booking.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Trip type</span>
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
              {(['round_trip', 'one_way'] as const).map((t) => (
                <button key={t} onClick={() => setTripType(t)}
                  className="text-[13px] px-3 py-1.5"
                  style={{
                    background: tripType === t ? 'var(--accent)' : 'var(--surface)',
                    color: tripType === t ? 'var(--accent-ink)' : 'var(--ink-soft)',
                    fontWeight: tripType === t ? 600 : 400,
                  }}>
                  {t === 'round_trip' ? 'Return' : 'One-way'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={start}
            className="text-[14px] font-semibold px-5 py-2.5 rounded-lg"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)', cursor: 'pointer' }}>
            Start
          </button>
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

            {/* Option cards */}
            {options.length > 0 && (
              <div className="flex flex-col gap-2.5 mt-1">
                {options.map((o, i) => {
                  const done = (o as any)._done;
                  return (
                    <div key={i} className="rounded-xl p-3.5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>{o.airline}</span>
                        {o.label && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent-deep)' }}>{o.label}</span>}
                        <span className="ml-auto text-[14px] font-bold" style={{ color: 'var(--accent-deep)' }}>
                          {o.currency_code} {o.estimated_price?.toLocaleString()} <span className="text-[11px] font-normal" style={{ color: 'var(--ink-faint)' }}>est.</span>
                        </span>
                      </div>
                      {o.legs.map((l, li) => (
                        <div key={li} className="text-[13px] flex items-center gap-2" style={{ color: 'var(--ink-soft)' }}>
                          <span className="font-mono" style={{ color: 'var(--accent-deep)' }}>{l.flight_number || l.airline?.slice(0, 2).toUpperCase() || '—'}</span>
                          <span>{l.departure_airport_code} → {l.arrival_airport_code}</span>
                          <span style={{ color: 'var(--ink-faint)' }}>{fmtDT(l.departure_datetime)}</span>
                          {l.duration_minutes != null && <span style={{ color: 'var(--ink-faint)' }}>· {fmtDur(l.duration_minutes)}</span>}
                          {l.cabin_class && <span className="ml-auto text-[11px]" style={{ color: 'var(--ink-faint)' }}>{l.cabin_class}</span>}
                        </div>
                      ))}
                      <div className="flex items-center gap-2 mt-2.5 pt-2.5" style={{ borderTop: '1px solid var(--divider)' }}>
                        <span className="text-[11px]" style={{ color: 'var(--ink-faint)' }}>{stopsLabel(o.legs)}</span>
                        <button onClick={() => shortlist(o, i)} disabled={done || shortlisting === i}
                          className="ml-auto text-[12px] font-semibold px-3 py-1.5 rounded-lg"
                          style={done
                            ? { background: 'color-mix(in srgb, var(--success) 14%, transparent)', color: 'var(--success)', cursor: 'default' }
                            : { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)', cursor: 'pointer' }}>
                          {done ? '✓ Shortlisted' : shortlisting === i ? 'Adding…' : '+ Shortlist'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {loading && (
              <div className="self-start px-3.5 py-2.5 rounded-2xl text-[14px]" style={{ background: 'color-mix(in srgb, var(--ink) 4%, transparent)', color: 'var(--ink-faint)' }}>
                Thinking…
              </div>
            )}
          </div>

          {/* Follow-up composer */}
          <div className="flex gap-2 items-end">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Reply, or refine: 'fastest and cheapest', 'only direct'…"
              rows={1}
              className="flex-1 p-2.5 rounded-lg text-[14px] resize-none focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} />
            <button onClick={send} disabled={!input.trim() || loading}
              className="text-[14px] font-semibold px-4 py-2.5 rounded-lg"
              style={{ background: 'var(--accent)', color: 'var(--accent-ink)', cursor: input.trim() && !loading ? 'pointer' : 'default', opacity: input.trim() && !loading ? 1 : 0.5 }}>
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}