// app/api/cron/session-sweep/route.ts
// Periodic session cleanup (ADR-001 Amendment A). Closes expired OPEN sessions
// across all users and purges CLOSED/REVOKED sessions older than 30 days.
// Protected by CRON_SECRET — only a caller with the secret can trigger it.
import { NextResponse, type NextRequest } from 'next/server';
import { sweepSessions } from '@/app/lib/services/session-service';
import { writeAudit } from '@/app/lib/audit';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
  }

  // Accept the secret via Authorization: Bearer <secret> or ?key=<secret>.
  const auth = request.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const key = bearer || request.nextUrl.searchParams.get('key');
  if (key !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sweepSessions(30);
    await writeAudit({
      event: 'session.revoke', result: 'success',
      detail: { job: 'session-sweep', closed: result.closed, purged: result.purged },
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[session-sweep] failed:', err);
    return NextResponse.json({ error: 'Sweep failed' }, { status: 500 });
  }
}

// Allow GET too, for easy manual testing in a browser with ?key=...
export async function GET(request: NextRequest) {
  return POST(request);
}