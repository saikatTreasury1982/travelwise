'use client';
import { useState, useEffect } from 'react';

type AssistType = 'getting_here' | 'food' | 'timing' | 'tips' | 'note';
interface AssistItem { assist_id: number; assist_type: AssistType; title: string; summary: string; created_at: string; }

const CHIPS: { type: AssistType; icon: string; label: string }[] = [
  { type: 'getting_here', icon: '🚉', label: 'Getting here' },
  { type: 'food', icon: '🍜', label: 'Food nearby' },
  { type: 'timing', icon: '⏱', label: 'How long / best time' },
  { type: 'tips', icon: '💡', label: 'Tips' },
];
const ICON: Record<AssistType, string> = { getting_here: '🚉', food: '🍜', timing: '⏱', tips: '💡', note: '✍️' };
const TYPE_LABEL: Record<AssistType, string> = { getting_here: 'Getting here', food: 'Food nearby', timing: 'Timing', tips: 'Tips', note: 'Notes' };

export default function ActivityAssistSheet({
  tripId, activityId, activityName, onClose, onChanged,
}: {
  tripId: number; activityId: number; activityName: string;
  onClose: () => void;
  onChanged?: () => void;   // notify parent so badges refresh
}) {
  const [items, setItems] = useState<AssistItem[]>([]);
  const [loading, setLoading] = useState(true);

  // chip answer flow
  const [pending, setPending] = useState<{ chip: AssistType; answer: string; title: string; summary: string } | null>(null);
  const [asking, setAsking] = useState<AssistType | null>(null);

  // free-ask flow
  const [askOpen, setAskOpen] = useState(false);
  const [askMsgs, setAskMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [askInput, setAskInput] = useState('');
  const [askBusy, setAskBusy] = useState(false);
  const [savingNote, setSavingNote] = useState<string | null>(null);   // last assistant answer to save

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/list`);
      const d = r.ok ? await r.json() : { assists: [] };
      setItems(d.assists ?? []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [tripId, activityId]);

  const byType = (t: AssistType) => items.filter((i) => i.assist_type === t);

  async function askChip(chip: AssistType) {
    setAsking(chip); setPending(null);
    try {
      const r = await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/chip`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chip }),
      });
      const d = await r.json();
      if (d.answer) setPending({ chip, answer: d.answer, title: d.title, summary: d.summary });
      else alert(d.error || 'Could not get help.');
    } finally { setAsking(null); }
  }

  async function saveItem(assist_type: AssistType, title: string, summary: string) {
    await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/save`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assist_type, title, summary }),
    });
    setPending(null);
    await load();
    onChanged?.();
  }

  async function del(assistId: number) {
    await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/list`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assist_id: assistId }),
    });
    await load();
    onChanged?.();
  }

  async function sendAsk(text: string) {
    const next = [...askMsgs, { role: 'user' as const, content: text }];
    setAskMsgs(next); setAskInput(''); setAskBusy(true);
    try {
      const r = await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next }),
      });
      const d = await r.json();
      const reply = d.message || 'Sorry, I could not help.';
      setAskMsgs((m) => [...m, { role: 'assistant', content: reply }]);
      setSavingNote(reply);
    } finally { setAskBusy(false); }
  }

  async function saveNote(answer: string) {
    // summarise → save as 'note'
    const r = await fetch(`/api/trips/${tripId}/itinerary/activities/${activityId}/assist/summarise`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer }),
    });
    const d = await r.json();
    await saveItem('note', d.title ?? 'Saved note', d.summary ?? answer.slice(0, 200));
    setSavingNote(null);
  }

  const grouped: AssistType[] = ['getting_here', 'food', 'timing', 'tips', 'note'];

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(16,14,12,.28)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()}
        className="animate-slide-up"
        style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 -8px 30px rgba(0,0,0,.18)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '10px auto 4px' }} />
        <div className="px-5 pb-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--divider)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold truncate" style={{ color: 'var(--ink)' }}>{activityName}</div>
            <div className="text-[11.5px]" style={{ color: 'var(--ink-faint)' }}>{items.length > 0 ? `${items.length} saved` : 'Ask the co-pilot'}</div>
          </div>
          <button onClick={onClose} className="tw-link text-[13px]" style={{ color: 'var(--ink-soft)' }}>Close</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto custom-scrollbar">
          {/* chips */}
          <div className="flex flex-wrap gap-2 mb-1">
            {CHIPS.map((c) => {
              const n = byType(c.type).length;
              return (
                <button key={c.type} onClick={() => askChip(c.type)} disabled={asking === c.type}
                  className="text-[12px] px-3 py-2 rounded-xl flex items-center gap-1.5"
                  style={{
                    border: `1px solid ${n > 0 ? 'var(--accent)' : 'var(--border)'}`,
                    background: n > 0 ? 'color-mix(in srgb, var(--accent) 6%, transparent)' : 'var(--surface)',
                    color: n > 0 ? 'var(--accent-deep)' : 'var(--ink-soft)', cursor: 'pointer',
                  }}>
                  <span>{c.icon}</span>{c.label}
                  {n > 0 && <span style={{ background: 'var(--accent-deep)', color: '#fff', fontSize: 10, borderRadius: 999, padding: '0 6px', minWidth: 16, textAlign: 'center' }}>{n}</span>}
                  {asking === c.type && <span style={{ color: 'var(--ink-faint)' }}>…</span>}
                </button>
              );
            })}
            <button onClick={() => setAskOpen((v) => !v)} className="text-[12px] px-3 py-2 rounded-xl ml-auto" style={{ color: 'var(--ink-faint)', border: '1px solid var(--border)' }}>✍️ Ask</button>
          </div>

          {/* pending chip answer → save */}
          {pending && (
            <div className="mt-3 rounded-xl p-3" style={{ background: 'color-mix(in srgb, var(--accent) 5%, var(--surface))', border: '1px solid var(--border)' }}>
              <div className="text-[10.5px] font-semibold mb-1.5" style={{ color: 'var(--accent-deep)' }}>{ICON[pending.chip]} {TYPE_LABEL[pending.chip]}</div>
              <div className="text-[12.5px] whitespace-pre-wrap" style={{ color: 'var(--ink)', lineHeight: 1.55 }}>{pending.answer}</div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => saveItem(pending.chip, pending.title, pending.summary)} className="tw-btn text-[12px] font-semibold px-4 py-1.5 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>＋ Save “{pending.title}”</button>
                <button onClick={() => setPending(null)} className="tw-link text-[12px] px-2 py-1.5" style={{ color: 'var(--ink-soft)' }}>Dismiss</button>
              </div>
            </div>
          )}

          {/* free ask */}
          {askOpen && (
            <div className="mt-3 rounded-xl p-3" style={{ border: '1px solid var(--border)' }}>
              {askMsgs.map((m, i) => (
                <div key={i} className="text-[12.5px] rounded-lg px-3 py-2 mb-2" style={{
                  background: m.role === 'user' ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'color-mix(in srgb, var(--ink) 4%, transparent)',
                  color: 'var(--ink)', marginLeft: m.role === 'user' ? 'auto' : 0, maxWidth: '88%', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                }}>{m.content}</div>
              ))}
              {askBusy && <div className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>Thinking…</div>}
              {savingNote && !askBusy && (
                <button onClick={() => saveNote(savingNote)} className="tw-link text-[12px] font-semibold mb-2" style={{ color: 'var(--accent-deep)' }}>＋ Save this as a note</button>
              )}
              <div className="flex gap-2">
                <input value={askInput} onChange={(e) => setAskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && askInput.trim()) sendAsk(askInput.trim()); }}
                  placeholder="Ask anything about this activity…"
                  className="flex-1 rounded-lg text-[12.5px]" style={{ border: '1px solid var(--border)', padding: '8px 10px', background: 'var(--surface)', color: 'var(--ink)' }} />
                <button onClick={() => askInput.trim() && sendAsk(askInput.trim())} disabled={!askInput.trim() || askBusy} className="tw-btn text-[12px] font-semibold px-3 rounded-lg" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', opacity: askInput.trim() && !askBusy ? 1 : 0.5 }}>Ask</button>
              </div>
            </div>
          )}

          {/* saved items, grouped by type */}
          {loading ? (
            <p className="text-[12px] mt-4" style={{ color: 'var(--ink-faint)' }}>Loading…</p>
          ) : items.length === 0 && !pending && !askOpen ? (
            <p className="text-[12.5px] mt-4 text-center py-3" style={{ color: 'var(--ink-faint)' }}>Tap a chip above to get help — save what you like for the trip.</p>
          ) : (
            grouped.map((t) => {
              const list = byType(t);
              if (list.length === 0) return null;
              return (
                <div key={t} className="mt-4">
                  <div className="text-[11px] uppercase mb-2" style={{ color: 'var(--ink-faint)', letterSpacing: '0.4px' }}>{ICON[t]} {TYPE_LABEL[t]}</div>
                  <div className="space-y-1.5">
                    {list.map((it) => (
                      <div key={it.assist_id} className="rounded-xl px-3 py-2.5" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold flex-1" style={{ color: 'var(--ink)' }}>{it.title}</span>
                          <button onClick={() => del(it.assist_id)} className="tw-link text-[12px]" style={{ color: 'var(--ink-faint)' }}>🗑</button>
                        </div>
                        <div className="text-[12px] mt-1" style={{ color: 'var(--ink-soft)', lineHeight: 1.5 }}>{it.summary}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}