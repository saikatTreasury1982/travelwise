'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Item { item_id: number; item_name: string; is_done: number; priority: string | null; }
interface Category { category_id: number; category_name: string; kind: string; items: Item[]; }

const PRIORITY_DOT: Record<string, string> = { high: 'var(--danger)', normal: 'var(--ink-faint)', low: 'var(--ink-faint)' };

export default function ChecklistView({ tripId, initial }: { tripId: number; initial: Category[] }) {
  const router = useRouter();
  const [cats, setCats] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [newCat, setNewCat] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newItem, setNewItem] = useState<Record<number, string>>({});

  const allItems = cats.flatMap((c) => c.items);
  const doneCount = allItems.filter((i) => i.is_done).length;
  const pct = allItems.length ? Math.round((doneCount / allItems.length) * 100) : 0;

  async function refresh() {
    const res = await fetch(`/api/trips/${tripId}/checklist`);
    if (res.ok) { const d = await res.json(); setCats(d.checklist); }
    router.refresh();
  }

  async function generate() {
    setGenerating(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/generate`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || 'Could not generate.');
      setCats(d.checklist);
      router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate.'); }
    finally { setGenerating(false); }
  }

  async function togglePriority(itemId: number, current: string | null) {
    const next = current === 'high' ? 'normal' : 'high';
    // optimistic
    setCats((cs) => cs.map((c) => ({ ...c, items: c.items.map((i) => i.item_id === itemId ? { ...i, priority: next } : i) })));
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/items/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ priority: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCats((cs) => cs.map((c) => ({ ...c, items: c.items.map((i) => i.item_id === itemId ? { ...i, priority: current } : i) })));
      setError('Could not update priority.');
    }
  }

  async function toggleItem(itemId: number, isDone: boolean) {
    // optimistic
    setCats((cs) => cs.map((c) => ({ ...c, items: c.items.map((i) => i.item_id === itemId ? { ...i, is_done: isDone ? 1 : 0 } : i) })));
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist/items/${itemId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isDone }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setCats((cs) => cs.map((c) => ({ ...c, items: c.items.map((i) => i.item_id === itemId ? { ...i, is_done: isDone ? 0 : 1 } : i) })));
      setError('Could not update item.');
    }
  }

  async function addCategory() {
    if (!newCat.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryName: newCat.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add.');
      setNewCat(''); setAddingCat(false); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add.'); }
    finally { setBusy(false); }
  }

  async function addItem(categoryId: number) {
    const name = (newItem[categoryId] ?? '').trim();
    if (!name) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/trips/${tripId}/checklist`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categoryId, itemName: name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not add.');
      setNewItem((m) => ({ ...m, [categoryId]: '' })); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add.'); }
    finally { setBusy(false); }
  }

  async function removeItem(itemId: number) {
    setCats((cs) => cs.map((c) => ({ ...c, items: c.items.filter((i) => i.item_id !== itemId) })));
    try {
      await fetch(`/api/trips/${tripId}/checklist/items/${itemId}`, { method: 'DELETE' });
    } catch { setError('Could not remove item.'); await refresh(); }
  }

  async function removeCategory(categoryId: number) {
    setCats((cs) => cs.filter((c) => c.category_id !== categoryId));
    try {
      await fetch(`/api/trips/${tripId}/checklist/${categoryId}`, { method: 'DELETE' });
    } catch { setError('Could not remove category.'); await refresh(); }
  }

  return (
    <div>
      {/* progress + AI generate */}
      <div className="rounded-2xl p-5 mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[13px]" style={{ color: 'var(--ink-faint)' }}>Progress</div>
            <div className="text-[20px] font-extrabold" style={{ color: 'var(--ink)' }}>{doneCount} / {allItems.length} done</div>
          </div>
          <button onClick={generate} disabled={generating}
            className="h-[42px] px-5 rounded-lg font-bold text-[14px] flex items-center gap-2 disabled:opacity-60"
            style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>
            ✦ {generating ? 'Building…' : (allItems.length ? 'Add more with AI' : 'Build my checklist with AI')}
          </button>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'color-mix(in srgb, var(--ink) 8%, transparent)' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--accent)' }} />
        </div>
      </div>

      {error && <div className="mb-3 text-[13px]" style={{ color: 'var(--danger)' }}>{error}</div>}

      {cats.length === 0 && !generating && (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px dashed var(--border)' }}>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--ink-soft)' }}>No checklist yet</p>
          <p className="text-[13px] mt-1" style={{ color: 'var(--ink-faint)' }}>Let the co-pilot build one tailored to your trip, or add categories manually.</p>
        </div>
      )}

      {/* categories */}
      <div className="flex flex-col gap-3">
        {cats.map((c) => {
          const cd = c.items.filter((i) => i.is_done).length;
          return (
            <div key={c.category_id} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold" style={{ color: 'var(--ink)' }}>{c.category_name}</span>
                  {c.kind === 'task' && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>TASKS</span>}
                  <span className="text-[12px]" style={{ color: 'var(--ink-faint)' }}>{cd}/{c.items.length}</span>
                </div>
                <button onClick={() => removeCategory(c.category_id)} className="text-[12px]" style={{ color: 'var(--danger)' }}>Remove</button>
              </div>

              <div className="flex flex-col gap-1.5">
                {c.items.map((it) => (
                  <div key={it.item_id} className="flex items-center gap-3 group">
                    <button onClick={() => toggleItem(it.item_id, !it.is_done)}
                      className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center"
                      style={{ border: `1.5px solid ${it.is_done ? 'var(--accent)' : 'var(--border)'}`, background: it.is_done ? 'var(--accent)' : 'transparent' }}>
                      {it.is_done ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg> : null}
                    </button>
                    <button
                      onClick={() => togglePriority(it.item_id, it.priority)}
                      title={it.priority === 'high' ? 'High priority — click to set Normal' : 'Normal priority — click to set High'}
                      className="flex items-center gap-1 flex-shrink-0 rounded px-1 py-0.5 transition-colors"
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--ink) 6%, transparent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ color: it.priority === 'high' ? 'var(--danger)' : 'var(--ink-faint)', fontSize: 11 }}>
                        {it.priority === 'high' ? '●' : '○'}
                      </span>
                      {it.priority === 'high' && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' }}>
                          High
                        </span>
                      )}
                    </button>
                    <span className="flex-grow text-[14px]" style={{ color: it.is_done ? 'var(--ink-faint)' : 'var(--ink)', textDecoration: it.is_done ? 'line-through' : 'none' }}>{it.item_name}</span>
                    <button onClick={() => removeItem(it.item_id)} className="text-[12px] opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--ink-faint)' }}>✕</button>
                  </div>
                ))}
              </div>

              {/* add item */}
              <div className="flex gap-2 mt-3">
                <input value={newItem[c.category_id] ?? ''} onChange={(e) => setNewItem((m) => ({ ...m, [c.category_id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === 'Enter') addItem(c.category_id); }}
                  placeholder="Add an item…"
                  className="flex-grow h-[38px] px-3 rounded-lg text-[13px] focus:outline-none" style={{ background: 'var(--canvas)', color: 'var(--ink)', border: '1px solid var(--border)' }} />
                <button onClick={() => addItem(c.category_id)} disabled={busy} className="text-[13px] font-semibold px-3 rounded-lg" style={{ color: 'var(--accent-deep)' }}>Add</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* add category */}
      <div className="mt-4">
        {addingCat ? (
          <div className="flex gap-2">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} autoFocus
              placeholder="New category name…"
              className="flex-grow h-[42px] px-3 rounded-lg text-[14px] focus:outline-none" style={{ background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--accent)' }} />
            <button onClick={addCategory} disabled={busy} className="h-[42px] px-4 rounded-lg font-bold text-[14px]" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Add</button>
            <button onClick={() => { setAddingCat(false); setNewCat(''); }} className="h-[42px] px-3 text-[14px]" style={{ color: 'var(--ink-soft)' }}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setAddingCat(true)} className="text-[13px] font-semibold px-3 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }}>+ Add category</button>
        )}
      </div>
    </div>
  );
}