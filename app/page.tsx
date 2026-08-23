// app/page.tsx
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Travelwise — journeys that add up',
  description: 'Unforgettable journeys, on a budget that actually works. Smart financial planning woven into every step of the trip.',
};

const brandMark = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" /><path d="M3.5 12h17" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" />
  </svg>
);

export default function LandingPage() {
  return (
    <div style={{ background: 'var(--canvas)', color: 'var(--ink)', fontFamily: 'var(--font-body)' }}>
      {/* NAV */}
      <nav className="flex items-center justify-between px-6 md:px-16 py-5" style={{ borderBottom: '1px solid var(--divider)' }}>
        <div className="flex items-center gap-2.5" style={{ color: 'var(--ink)' }}>
          {brandMark}
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Travelwise</span>
        </div>
        <div className="flex items-center gap-4 md:gap-7 text-sm font-medium">
          <span className="hidden md:inline" style={{ color: 'var(--ink-soft)' }}>How it works</span>
          <span className="hidden md:inline" style={{ color: 'var(--ink-soft)' }}>Security</span>
          <Link href="/login" style={{ color: 'var(--ink)', fontWeight: 600 }}>Sign in</Link>
          <Link href="/register" className="px-4 py-2.5 rounded-[10px] font-semibold" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
            Create account
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 md:px-16 pt-16 md:pt-20 pb-20">
        <div className="absolute -top-20 -right-16 w-[520px] h-[520px] rounded-full pointer-events-none"
             style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 16%, transparent), transparent 62%)' }} />
        <div className="relative z-[2] max-w-[720px]">
          <div className="inline-flex items-center gap-2 px-3.5 py-[7px] rounded-full text-xs font-semibold mb-6"
               style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink-soft)', letterSpacing: '0.3px' }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
            Where wanderlust meets a plan that pays off
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(40px, 6vw, 68px)', lineHeight: 1.03, letterSpacing: '-1px', margin: '0 0 22px' }}>
            Unforgettable journeys,<br />on a budget that <span style={{ fontStyle: 'italic', color: 'var(--accent-deep)' }}>actually works.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-[600px] mb-8" style={{ color: 'var(--ink-soft)' }}>
            Travelwise weaves smart financial planning into every step of the trip — from the first spark of an idea to the last transaction on the road. Explore freely, spend deliberately, and never trade the experience for the budget.
          </p>
          <div className="flex flex-wrap items-center gap-3.5">
            <Link href="/register" className="px-6 py-[15px] rounded-xl font-semibold text-base" style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
              Create your account
            </Link>
            <Link href="/login" className="px-6 py-[15px] rounded-xl font-semibold text-base" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
              Sign in
            </Link>
          </div>
          <p className="mt-4.5 text-[13px]" style={{ color: 'var(--ink-faint)', marginTop: 18 }}>Free to start · No card required · Your data stays yours</p>
        </div>
      </section>

      {/* LIFECYCLE STORY */}
      <section className="px-6 md:px-16 py-16" style={{ background: 'var(--panel)' }}>
        <p className="text-center text-xs font-semibold uppercase mb-2" style={{ color: 'var(--accent)', letterSpacing: '2px' }}>The whole journey, one companion</p>
        <h2 className="text-center mb-12" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', color: 'var(--panel-ink)', lineHeight: 1.1 }}>
          From the spark of wanderlust to the final transaction on the road
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { n: '01', t: 'Dream', d: 'Sketch a trip and see, instantly, what it would take to make it real.' },
            { n: '02', t: 'Plan', d: 'Build the itinerary with the budget beside it — every choice priced as you go.' },
            { n: '03', t: 'Travel', d: 'Track spending on the move, offline or on, and stay on course without the math.' },
            { n: '04', t: 'Reflect', d: 'See where the money really went, and plan the next one smarter.' },
          ].map((s) => (
            <div key={s.n} className="p-6 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: 'var(--accent)' }}>{s.n}</span>
              <h3 className="mt-3 mb-2 text-base font-bold" style={{ color: 'var(--panel-ink)' }}>{s.t}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(245,242,237,0.6)' }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* BENEFITS */}
      <section className="px-6 md:px-16 py-20">
        <p className="text-center text-xs font-semibold uppercase mb-2" style={{ color: 'var(--accent-deep)', letterSpacing: '2px' }}>Why Travelwise</p>
        <h2 className="text-center mb-14" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4.5vw,42px)', lineHeight: 1.08, letterSpacing: '-0.5px' }}>
          Financial clarity, without clipping the wings of the trip
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-7">
          {[
            { t: 'Guidance built into planning', d: 'Financial insight arrives where the decisions happen — inside the itinerary, not buried in a separate spreadsheet you forget to open.', icon: <path d="M3 3v18h18M7 14l4-4 3 3 5-6" /> },
            { t: 'Budget-conscious, never joyless', d: 'Make data-driven choices that protect the budget and the experience at once — trade the overpriced, not the unforgettable.', icon: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /> },
            { t: 'Culturally rich, financially sound', d: 'Every itinerary is planned to be both — a trip worth taking that also holds up when the numbers are counted.', icon: <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4-6.3-4.6L5.7 21 8 14 2 9.4h7.6z" /> },
          ].map((b) => (
            <div key={b.t} className="p-8 rounded-[18px]" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="w-[46px] h-[46px] rounded-xl flex items-center justify-center mb-5" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-deep)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
              </div>
              <h3 className="mb-2.5 text-xl font-bold">{b.t}</h3>
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SECURITY STRIP */}
      <section className="mx-6 md:mx-16 mb-20 p-8 md:p-11 rounded-[22px] flex flex-col md:flex-row items-start md:items-center gap-8"
               style={{ background: 'color-mix(in srgb, var(--ink) 5%, var(--canvas))', border: '1px solid var(--border)' }}>
        <div className="shrink-0 w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ink)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
        </div>
        <div className="flex-grow">
          <h3 className="mb-1.5 text-[22px] font-bold">Your money and your data, protected</h3>
          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>Passkey and password sign-in, encryption end to end, and a promise we keep: we never see your card details. Your trips are yours alone.</p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-6 md:mx-16 mb-20 py-16 md:py-[72px] px-8 rounded-[26px] relative overflow-hidden text-center"
               style={{ backgroundColor: 'var(--panel)', backgroundImage: 'radial-gradient(600px 400px at 20% 20%, rgba(52,96,156,0.42), transparent 64%), radial-gradient(500px 380px at 85% 80%, color-mix(in srgb, var(--accent) 22%, transparent), transparent 62%)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px,5vw,46px)', lineHeight: 1.06, color: 'var(--panel-ink)', margin: '0 0 16px' }}>
          Your next journey is already within reach
        </h2>
        <p className="mx-auto mb-8 text-[17px] leading-relaxed max-w-[520px]" style={{ color: 'rgba(245,242,237,0.72)' }}>
          Start planning a trip that&apos;s as sound on paper as it is unforgettable in person.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <Link href="/register" className="px-7 py-[15px] rounded-xl font-bold text-base" style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}>Create your account</Link>
          <Link href="/login" className="px-7 py-[15px] rounded-xl font-semibold text-base" style={{ border: '1px solid rgba(255,255,255,0.28)', color: 'var(--panel-ink)' }}>Sign in</Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 md:px-16 py-12 flex flex-col md:flex-row items-start justify-between gap-8" style={{ borderTop: '1px solid var(--divider)' }}>
        <div className="max-w-[300px]">
          <div className="flex items-center gap-2.5 mb-3.5" style={{ color: 'var(--ink)' }}>
            {brandMark}
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Travelwise</span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--ink-faint)' }}>A next-generation travel ecosystem where unforgettable journeys and smart financial planning finally meet.</p>
        </div>
        <div className="flex gap-16 text-sm">
          <div className="flex flex-col gap-3">
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Product</span>
            <span style={{ color: 'var(--ink-soft)' }}>How it works</span>
            <span style={{ color: 'var(--ink-soft)' }}>Security</span>
            <span style={{ color: 'var(--ink-soft)' }}>Pricing</span>
          </div>
          <div className="flex flex-col gap-3">
            <span className="font-semibold" style={{ color: 'var(--ink)' }}>Company</span>
            <span style={{ color: 'var(--ink-soft)' }}>About</span>
            <span style={{ color: 'var(--ink-soft)' }}>Contact</span>
            <span style={{ color: 'var(--ink-soft)' }}>Privacy</span>
          </div>
        </div>
      </footer>
      <div className="px-6 md:px-16 py-5 text-xs" style={{ borderTop: '1px solid var(--divider)', color: 'var(--ink-faint)' }}>© 2026 Travelwise. All rights reserved.</div>
    </div>
  );
}