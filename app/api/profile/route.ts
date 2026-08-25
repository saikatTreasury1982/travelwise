import { NextRequest, NextResponse } from 'next/server';
import { requireUserContext } from '@/app/lib/auth/context';
import { updateProfile, type ProfileUpdate } from '@/app/lib/services/user-service';
import { writeAudit } from '@/app/lib/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest) {
  const ctx = await requireUserContext();
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  // Whitelist + basic normalisation.
  const patch: ProfileUpdate = {};
  const strField = (v: unknown) =>
    v == null ? null : (typeof v === 'string' ? (v.trim() === '' ? null : v.trim()) : undefined);

  for (const key of ['first_name', 'middle_name', 'last_name', 'resident_country', 'home_currency'] as const) {
    if (key in body) {
      const val = strField(body[key]);
      if (val === undefined) {
        return NextResponse.json({ error: `Invalid value for ${key}.` }, { status: 400 });
      }
      patch[key] = val;
    }
  }

  // Guard: a name is nice to have, but don't allow wiping both country & currency to empty
  // if you want them required — relax/remove this block if optional is fine.
  if (patch.first_name === null && 'first_name' in body) {
    return NextResponse.json({ error: 'First name cannot be empty.' }, { status: 400 });
  }

  const updated = await updateProfile(ctx, patch);
  if (!updated) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
  }

  await writeAudit({
    event: 'trip.update',      // or add a 'profile.update' event to the union if you prefer a precise label
    result: 'success',
    tenantId: ctx.tenantId,
    userId: ctx.userId,
    detail: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ ok: true, profile: updated });
}

export async function GET() {
  const ctx = await requireUserContext();
  const { getProfile } = await import('@/app/lib/services/user-service');
  const profile = await getProfile(ctx);
  return NextResponse.json({ profile });
}