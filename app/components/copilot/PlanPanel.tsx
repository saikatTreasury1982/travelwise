// app/components/copilot/PlanPanel.tsx
'use client';
import { useEffect } from 'react';
import PlanChat from '@/app/components/copilot/PlanChat';

export default function PlanPanel({
  open, initialPrompt, onClose,
}: { open: boolean; initialPrompt?: string; onClose: () => void }) {
  // Lock body scroll while open; close on Escape.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
      {/* scrim */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(12,9,5,0.45)', backdropFilter: 'blur(2px)' }} />
      {/* panel */}
      <div
        role="dialog" aria-modal="true"
        style={{
          position: 'absolute', top: 0, right: 0, bottom: 0,
          width: 'min(860px, 100vw)', background: 'var(--canvas)',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column',
          animation: 'tw-slide-in 0.22s ease-out',
        }}>
        <div className="flex items-center justify-between px-5 py-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--divider)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: 'var(--ink)' }}>Plan a new trip</div>
          <button onClick={onClose} aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[18px]"
            style={{ color: 'var(--ink-soft)', background: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}>×</button>
        </div>
        <div className="flex-1 overflow-hidden">
          <PlanChat initialPrompt={initialPrompt} />
        </div>
      </div>
      <style>{`@keyframes tw-slide-in{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
    </div>
  );
}