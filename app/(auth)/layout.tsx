// app/(auth)/layout.tsx
// Shared auth shell (Direction D). Dark budget panel + form column.
// Collapses to a slim header on mobile (device-parity, amended 1.1).

function Logo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" /><path d="M3.5 12h17" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
      </svg>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 21, color: 'var(--panel-ink)' }}>Travelwise</span>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row" style={{ background: 'var(--canvas)' }}>
      <aside
        className="relative overflow-hidden md:w-[44%] md:min-h-screen"
        style={{
          backgroundColor: 'var(--panel)',
          backgroundImage:
            'radial-gradient(620px 460px at 26% 18%, rgba(52,96,156,0.46), transparent 64%), radial-gradient(520px 420px at 84% 76%, color-mix(in srgb, var(--accent) 26%, transparent), transparent 62%)',
        }}
      >
        <div className="flex flex-col justify-between h-full box-border p-6 md:p-12 gap-8">
          <Logo />
          <div className="hidden md:flex flex-col gap-7">
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 400, fontSize: 38, lineHeight: 1.14, color: 'var(--panel-ink)', letterSpacing: '-0.2px' }}>
              Go further on<br />what you have
            </h2>
            <div style={{ boxSizing: 'border-box', padding: '20px 22px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.11)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
              <div className="flex items-baseline justify-between" style={{ marginBottom: 16 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--panel-ink)' }}>Lisbon &amp; Porto</span>
                <span style={{ fontSize: 12, color: 'rgba(245,242,237,0.66)' }}>6 days left</span>
              </div>
              <div className="flex items-baseline" style={{ gap: 8, marginBottom: 14 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1, color: 'var(--accent)' }}>€1,240</span>
                <span style={{ fontSize: 13, color: 'rgba(245,242,237,0.70)' }}>of €2,800 remaining</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.13)', overflow: 'hidden' }}>
                <div style={{ width: '44%', height: '100%', borderRadius: 3, background: 'var(--accent)' }} />
              </div>
            </div>
          </div>
          <p className="hidden md:block" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(245,242,237,0.66)' }}>
            [ Destination imagery sits behind this panel ]
          </p>
        </div>
      </aside>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[396px] animate-scale-in">{children}</div>
      </main>
    </div>
  );
}