// app/help/page.tsx
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import { listHelpDocs } from '@/app/lib/help/loader';

export const dynamic = 'force-dynamic';

const CATEGORY_ORDER = ['Getting started', 'Planning your trip', 'Costs & budgeting', 'Account'];

export default async function HelpIndexPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  const docs = await listHelpDocs();
  const categories = [
    ...CATEGORY_ORDER.filter((c) => docs.some((d) => d.category === c)),
    ...Array.from(new Set(docs.map((d) => d.category))).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="help" />
      <div className="px-6 md:px-10 py-8 max-w-[860px] mx-auto">
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(30px,4vw,44px)', color: 'var(--ink)' }}>Help centre</h1>
        <p className="text-[16px] mb-10" style={{ color: 'var(--ink-soft)' }}>Guides for planning trips, managing costs, and getting the most out of Travelwise.</p>

        {docs.length === 0 && (
          <p className="text-[14px]" style={{ color: 'var(--ink-faint)' }}>No guides yet.</p>
        )}

        {categories.map((cat) => {
          const items = docs.filter((d) => d.category === cat);
          if (items.length === 0) return null;
          return (
            <section key={cat} className="mb-10">
              <h2 className="text-xs font-bold uppercase mb-4" style={{ color: 'var(--accent-deep)', letterSpacing: '0.5px' }}>{cat}</h2>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
                {items.map((d) => (
                  <Link key={d.slug} href={`/help/${d.slug}`} className="tw-card block">
                    <div className="rounded-2xl p-5 h-full" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                      <div className="text-[20px] mb-2">{d.icon}</div>
                      <div className="text-[15px] font-semibold mb-1" style={{ color: 'var(--ink)' }}>{d.title}</div>
                      <div className="text-[13px]" style={{ color: 'var(--ink-soft)' }}>{d.summary}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}