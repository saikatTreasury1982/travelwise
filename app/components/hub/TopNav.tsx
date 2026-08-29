// app/components/hub/TopNav.tsx
'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TopNav({ firstName, active = 'home' }: { firstName: string; active?: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  // Fetch the current user's role once, to conditionally show owner-only links.
  useEffect(() => {
    fetch('/api/admin/ownerTool')
      .then((r) => r.json())
      .then((d) => setIsOwner(d.role === 'owner'))
      .catch(() => {});
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  const links = [
    { key: 'home', label: 'Home', href: '/dashboard' },
    { key: 'trips', label: 'My Trips', href: '/trips' },
    { key: 'guides', label: 'Guides', href: '/guides' },
    { key: 'explore', label: 'Explore', href: '/explore' },
  ];

  return (
    <div className="flex items-center justify-between px-6 md:px-10 py-4" style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid var(--divider)', background: 'var(--canvas)' }}>
      <Link href="/dashboard" className="flex items-center gap-2.5" style={{ color: 'var(--ink)' }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3.5 12h17" /><path d="M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></svg>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Travelwise</span>
      </Link>

      <div className="flex items-center gap-5 md:gap-6 text-sm font-medium">
        {links.map((l) => (
          <Link key={l.key} href={l.href} className="hidden sm:inline"
            style={{ color: l.key === active ? 'var(--ink)' : 'var(--ink-soft)', fontWeight: l.key === active ? 600 : 500 }}>
            {l.label}
          </Link>
        ))}
        <div className="relative" ref={ref}>
          <button onClick={() => setMenuOpen((o) => !o)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold"
            style={{ background: 'var(--primary)', color: 'var(--primary-ink)' }}>
            {firstName.charAt(0).toUpperCase()}
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl shadow-2xl py-1.5 z-50"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--divider)' }}>
                <div className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{firstName}</div>
                <div className="text-xs" style={{ color: 'var(--ink-faint)' }}>Signed in</div>
              </div>
              <Link href="/profile" className="block px-4 py-2.5 text-sm" style={{ color: 'var(--ink)' }} onClick={() => setMenuOpen(false)}>Profile</Link>
              <Link href="/account" className="block px-4 py-2.5 text-sm" style={{ color: 'var(--ink)' }} onClick={() => setMenuOpen(false)}>Account</Link>
              <Link href="/settings" className="block px-4 py-2.5 text-sm" style={{ color: 'var(--ink)' }} onClick={() => setMenuOpen(false)}>Settings</Link>
              {isOwner && (
                <>
                  <div className="h-px my-1" style={{ background: 'var(--divider)' }} />
                  <Link href="/admin" className="block px-4 py-2.5 text-sm" style={{ color: 'var(--ink)' }} onClick={() => setMenuOpen(false)}>Admin tools</Link>
                </>
              )}
              <div className="h-px my-1" style={{ background: 'var(--divider)' }} />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleLogout(); }}
                className="w-full text-left px-4 py-2.5 text-sm"
                style={{ color: 'var(--danger)' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}