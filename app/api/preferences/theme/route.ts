// app/api/preferences/theme/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updatePreferences } from '@/app/lib/services/preferences-service';

export async function PATCH(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  let theme = '';
  try { ({ theme } = await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  try {
    await updatePreferences(ctx, { theme });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 400 });
  }
}