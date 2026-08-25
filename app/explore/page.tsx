import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import PlaceholderPage from '@/app/components/hub/PlaceholderPage';
export const dynamic = 'force-dynamic';
export default async function ExplorePage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const u = await rawQuery<{ first_name: string }>(`SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId]);
  return <PlaceholderPage firstName={u[0]?.first_name ?? 'traveller'} active="explore" title="Explore" note="Discover popular destinations with typical budgets." />;
}