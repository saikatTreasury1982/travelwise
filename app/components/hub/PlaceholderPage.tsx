// app/components/hub/PlaceholderPage.tsx
// A full-page placeholder for routes whose feature isn't built yet.
// Keeps every nav link safe (no 404s) with a tasteful "coming soon".
import TopNav from './TopNav';

export default function PlaceholderPage({ firstName, active, title, note }: {
  firstName: string; active?: string; title: string; note: string;
}) {
  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active={active} />
      <div className="px-6 md:px-10 py-16 max-w-[720px] mx-auto text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
        </div>
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>{title}</h1>
        <p className="text-[15px]" style={{ color: 'var(--ink-soft)' }}>{note}</p>
        <p className="text-[13px] mt-1" style={{ color: 'var(--ink-faint)' }}>Coming soon.</p>
      </div>
    </div>
  );
}