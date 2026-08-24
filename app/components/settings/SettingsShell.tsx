// app/components/settings/SettingsShell.tsx
'use client';
import Link from 'next/link';

export interface SubNavItem { key: string; label: string; href: string; }

export default function SettingsShell({
  title, subNav, active, children,
}: { title: string; subNav: SubNavItem[]; active: string; children: React.ReactNode }) {
  return (
    <div className="px-6 md:px-10 py-8 max-w-[1100px] mx-auto">
      <h1 className="mb-6" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>{title}</h1>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        {/* left sub-nav */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {subNav.map((item) => (
            <Link key={item.key} href={item.href}
              className="px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors"
              style={item.key === active
                ? { background: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-deep)' }
                : { color: 'var(--ink-soft)' }}>
              {item.label}
            </Link>
          ))}
        </nav>
        {/* content */}
        <div>{children}</div>
      </div>
    </div>
  );
}