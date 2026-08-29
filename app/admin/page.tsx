import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import TopNav from '@/app/components/hub/TopNav';
import AdminTools from '@/app/components/admin/AdminTools';
import UploadToolCard from '@/app/components/admin/UploadToolCard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  if (ctx.role !== 'owner') redirect('/dashboard');

  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';

  return (
    <div style={{ background: 'var(--canvas)', minHeight: '100vh' }}>
      <TopNav firstName={firstName} active="home" />
      <div className="px-6 md:px-10 py-8 max-w-[800px] mx-auto">
        <h1 className="mb-2" style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,38px)', color: 'var(--ink)' }}>Admin tools</h1>
        <p className="text-[14px] mb-8" style={{ color: 'var(--ink-soft)' }}>Owner-only maintenance actions.</p>

        <AdminTools />

        <div className="mt-4">
          <UploadToolCard
            title="Import airports"
            description="Upload the airports CSV (iata_code, icao_code, airport_name, city, country_code, timezone, latitude, longitude). Safe to re-run — existing codes are skipped."
            endpoint="/api/admin/importAirports"
          />
        </div>
      </div>
    </div>
  );
}