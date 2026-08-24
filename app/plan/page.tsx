// app/plan/page.tsx
import { redirect } from 'next/navigation';
import { getUserContext } from '@/app/lib/auth/context';
import { rawQuery } from '@/app/lib/db/client';
import CopilotHome from '@/app/components/copilot/CopilotHome';

export default async function PlanPage() {
  const ctx = await getUserContext();
  if (!ctx) redirect('/login');
  const users = await rawQuery<{ first_name: string }>(
    `SELECT first_name FROM users WHERE user_id = ? LIMIT 1`, [ctx.userId],
  );
  const firstName = users[0]?.first_name ?? 'traveller';
  return <CopilotHome firstName={firstName} />;
}