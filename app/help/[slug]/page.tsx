// app/help/[slug]/page.tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import { getHelpDoc } from '@/app/lib/help/loader';
import HelpArticle from '@/app/components/help/HelpArticle';

export const dynamic = 'force-dynamic';

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getHelpDoc(slug);
  if (!doc) notFound();

  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  const updated = doc.updated
    ? new Date(doc.updated).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="help" />
      <div className="px-6 md:px-10 py-8 max-w-[760px] mx-auto">
        <Link href="/help" className="tw-link text-[13px] font-medium inline-flex items-center gap-1.5 mb-6" style={{ color: 'var(--ink-soft)' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          Help centre
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <span className="text-[26px]">{doc.icon}</span>
          <span className="text-[12px] font-semibold uppercase" style={{ color: 'var(--accent-deep)', letterSpacing: '0.5px' }}>{doc.category}</span>
        </div>
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', lineHeight: 1.08, color: 'var(--ink)' }}>{doc.title}</h1>
        <p className="text-[16px] mb-2" style={{ color: 'var(--ink-soft)' }}>{doc.summary}</p>
        {updated && <p className="text-[12px] mb-8" style={{ color: 'var(--ink-faint)' }}>Updated {updated}</p>}

        <HelpArticle body={doc.body} />
      </div>
    </div>
  );
}