// app/api/auth/register/route.ts
// -----------------------------------------------------------------------------
// Registration = the bootstrap. In ONE transaction:
//   tenant -> account (with resolved entitlement) -> user -> owner membership.
// Profile only; no credential set here (user sets password/passkey on first login).
// Each signup makes its own tenant. The account's plan/billing_status comes from
// the subscription seam (default Lifetime Free; billing plugin overrides later).
// -----------------------------------------------------------------------------
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { db, rawQuery } from '@/app/lib/db/client';
import { writeAudit } from '@/app/lib/audit';
import { resolveEntitlement } from '@/app/lib/subscription';

interface RegisterBody {
  email?: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  residentCountry?: string;
  homeCurrency?: string;
  selectedPlan?: string | null; // ignored unless the billing plugin uses it
}

function id(prefix: string): string {
  return `${prefix}-${randomBytes(8).toString('hex')}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: RegisterBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const firstName = (body.firstName ?? '').trim();
  const lastName = (body.lastName ?? '').trim();
  const middleName = body.middleName?.trim() || null;
  const residentCountry = (body.residentCountry ?? '').trim();
  const homeCurrency = (body.homeCurrency ?? '').trim();
  const selectedPlan = body.selectedPlan ?? null;

  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: 'A valid email is required' }, { status: 400 });
  if (!firstName) return NextResponse.json({ error: 'First name is required' }, { status: 400 });
  if (!lastName) return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
  if (!residentCountry) return NextResponse.json({ error: 'Country of residence is required' }, { status: 400 });
  if (!homeCurrency) return NextResponse.json({ error: 'Home currency is required' }, { status: 400 });

  const country = await rawQuery<{ country_code: string }>(
    `SELECT country_code FROM countries WHERE country_code = ?`, [residentCountry],
  );
  if (country.length === 0) return NextResponse.json({ error: 'Unknown country' }, { status: 400 });
  const currency = await rawQuery<{ currency_code: string }>(
    `SELECT currency_code FROM currencies WHERE currency_code = ?`, [homeCurrency],
  );
  if (currency.length === 0) return NextResponse.json({ error: 'Unknown currency' }, { status: 400 });

  const existing = await rawQuery<{ user_id: string }>(
    `SELECT user_id FROM users WHERE email = ? LIMIT 1`, [email],
  );
  if (existing.length > 0) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  // First user in the whole system == tenant zero (always Lifetime Free).
  const tenantCount = await rawQuery<{ n: number }>(`SELECT COUNT(*) AS n FROM tenants`);
  const isFirstUser = (tenantCount[0]?.n ?? 0) === 0;

  const tenantId = id('tenant');
  const accountId = id('acct');
  const userId = id('user');

  // Resolve the entitlement through the subscription seam (default = Lifetime Free).
  const entitlement = await resolveEntitlement({
    email, isFirstUser, selectedPlan, tenantId, accountId, userId,
  });

  const tx = await db.transaction('write');
  try {
    await tx.execute({
      sql: `INSERT INTO tenants (tenant_id, display_name, is_active) VALUES (?, ?, 1)`,
      args: [tenantId, `${firstName}'s Travelwise`],
    });
    await tx.execute({
      sql: `INSERT INTO accounts (account_id, tenant_id, name, plan, billing_status)
            VALUES (?, ?, ?, ?, ?)`,
      args: [accountId, tenantId, 'Personal', entitlement.plan, entitlement.billingStatus],
    });
    await tx.execute({
      sql: `INSERT INTO users
              (tenant_id, user_id, email, first_name, middle_name, last_name,
               resident_country, home_currency, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [tenantId, userId, email, firstName, middleName, lastName, residentCountry, homeCurrency],
    });
    await tx.execute({
      sql: `INSERT INTO account_members (account_id, user_id, tenant_id, role)
            VALUES (?, ?, ?, 'owner')`,
      args: [accountId, userId, tenantId],
    });
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    console.error('[register] transaction failed:', err);
    await writeAudit({ event: 'login.failure', result: 'failure', detail: { stage: 'register', email } });
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  await writeAudit({
    event: 'login.success', result: 'success',
    tenantId, userId, detail: { stage: 'register', plan: entitlement.plan },
  });

  return NextResponse.json({ ok: true, userId, plan: entitlement.plan }, { status: 201 });
}