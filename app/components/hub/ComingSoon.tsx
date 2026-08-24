// app/components/hub/ComingSoon.tsx
// A tasteful placeholder for hub sections not yet built. Matches Direction D.
export default function ComingSoon({ height = 160, note }: { height?: number; note?: string }) {
  return (
    <div className="rounded-2xl flex flex-col items-center justify-center text-center px-6"
      style={{ height, background: 'var(--surface)', border: '1px dashed var(--border)' }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
        <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
      </svg>
      <p className="text-[14px] font-semibold" style={{ color: 'var(--ink-soft)' }}>Coming soon</p>
      {note && <p className="text-[12px] mt-1" style={{ color: 'var(--ink-faint)' }}>{note}</p>}
    </div>
  );
}