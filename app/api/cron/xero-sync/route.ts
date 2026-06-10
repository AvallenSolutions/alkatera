import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/lib/inngest/client';
import { safeCompare } from '@/lib/utils/safe-compare';

/**
 * Cron: Xero Scheduled Sync (heartbeat only)
 *
 * POST /api/cron/xero-sync
 *
 * Dispatches a single Inngest event; the actual work fans out to one
 * Inngest run per connected organisation (lib/inngest/functions/xero.ts).
 * The previous implementation synced every org sequentially inside this
 * route — the banned 300s-ceiling pattern: a mid-loop kill silently
 * skipped later orgs and never sent the failure alert.
 *
 * Protected by CRON_SECRET header.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await inngest.send({ name: 'xero/sync.tick', data: {} });

    return NextResponse.json({ dispatched: true });
  } catch (error: any) {
    console.error('Error dispatching xero-sync tick:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
