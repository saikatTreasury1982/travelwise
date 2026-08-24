// app/api/profile/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { updateProfile, type ProfileUpdate } from '@/app/lib/services/user-service';
import { writeAudit } from '@/app/lib/audit';

export async function PATCH(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  let body: ProfileUpdate;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }
  try {
    await updateProfile(ctx, body);
    await writeAudit({ event: 'role.change', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { action: 'profile.update', fields: Object.keys(body) } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 400 });
  }
}