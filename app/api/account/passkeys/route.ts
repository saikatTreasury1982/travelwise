// app/api/account/passkeys/route.ts
import { NextResponse } from 'next/server';
import { getUserContext } from '@/app/lib/auth/context';
import { listUserPasskeys, getPasskey, deactivatePasskey } from '@/app/lib/services/passkey-service';
import { writeAudit } from '@/app/lib/audit';

export async function GET() {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  const passkeys = await listUserPasskeys(ctx.userId);
  return NextResponse.json({ passkeys });
}

export async function DELETE(request: Request) {
  const ctx = await getUserContext();
  if (!ctx) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  let credentialId = '';
  try { ({ credentialId } = await request.json()); }
  catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }); }

  // Confirm the passkey belongs to this user + tenant before removing.
  const pk = await getPasskey(credentialId);
  if (!pk || pk.user_id !== ctx.userId || pk.tenant_id !== ctx.tenantId) {
    return NextResponse.json({ error: 'Passkey not found' }, { status: 404 });
  }
  await deactivatePasskey(credentialId);
  await writeAudit({ event: 'passkey.register', result: 'success', tenantId: ctx.tenantId, userId: ctx.userId, detail: { action: 'passkey.remove' } });
  return NextResponse.json({ ok: true });
}