// scripts/seed-tenant-zero.mjs
// -----------------------------------------------------------------------------
// One-time bootstrap: creates tenant zero, your account, your user row, and
// your owner membership. Run ONCE against the new Travelwise Turso DB.
//
// Usage:
//   node scripts/seed-tenant-zero.mjs
//
// Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the environment. Load them
// from .env.local first (see the run command below).
//
// Idempotent: uses INSERT OR IGNORE, so running it twice is harmless.
// Edit the OWNER constants below to your real details before running.
// -----------------------------------------------------------------------------
import { createClient } from '@libsql/client';
import { randomBytes } from 'node:crypto';

// --- EDIT THESE ---------------------------------------------------------------
const OWNER = {
  email: 'you@example.com',
  firstName: 'Saikat',
  middleName: null,
  lastName: 'YourLastName',
  residentCountry: 'AU',   // must exist in countries (e.g. AU, IN, US...)
  homeCurrency: 'AUD',     // must exist in currencies (e.g. AUD, INR, USD...)
};
// -----------------------------------------------------------------------------

const TENANT_ID = 'tenant-zero';
const ACCOUNT_ID = 'acct-zero';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Run with your env loaded (see instructions).');
  process.exit(1);
}

const db = createClient({ url, authToken });

function id(prefix) {
  return `${prefix}-${randomBytes(8).toString('hex')}`;
}

async function main() {
  const userId = id('user');

  // 1. Tenant zero
  await db.execute({
    sql: `INSERT OR IGNORE INTO tenants (tenant_id, display_name, is_active)
          VALUES (?, ?, 1)`,
    args: [TENANT_ID, 'Travelwise (personal)'],
  });

  // 2. Your account under tenant zero (free plan)
  await db.execute({
    sql: `INSERT OR IGNORE INTO accounts (account_id, tenant_id, name, plan, billing_status)
          VALUES (?, ?, ?, 'free', 'active')`,
    args: [ACCOUNT_ID, TENANT_ID, 'Personal'],
  });

  // 3. Your user row — skip if the email already exists in this tenant
  const existing = await db.execute({
    sql: `SELECT user_id FROM users WHERE tenant_id = ? AND email = ?`,
    args: [TENANT_ID, OWNER.email],
  });

  let effectiveUserId;
  if (existing.rows.length > 0) {
    effectiveUserId = existing.rows[0].user_id;
    console.log('User already exists, reusing user_id:', effectiveUserId);
  } else {
    effectiveUserId = userId;
    await db.execute({
      sql: `INSERT INTO users
              (tenant_id, user_id, email, first_name, middle_name, last_name,
               resident_country, home_currency, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      args: [
        TENANT_ID, effectiveUserId, OWNER.email, OWNER.firstName,
        OWNER.middleName, OWNER.lastName, OWNER.residentCountry, OWNER.homeCurrency,
      ],
    });
    console.log('Created user_id:', effectiveUserId);
  }

  // 4. Owner membership
  await db.execute({
    sql: `INSERT OR IGNORE INTO account_members (account_id, user_id, tenant_id, role)
          VALUES (?, ?, ?, 'owner')`,
    args: [ACCOUNT_ID, effectiveUserId, TENANT_ID],
  });

  console.log('\nSeed complete:');
  console.log('  tenant_id :', TENANT_ID);
  console.log('  account_id:', ACCOUNT_ID);
  console.log('  user_id   :', effectiveUserId);
  console.log('  role      : owner');
  console.log('\nNote: no password/passkey yet — you set a credential on first login (Batch 3+).');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });