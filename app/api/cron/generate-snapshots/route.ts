import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { computeOrgSnapshots, writeSnapshots } from '@/lib/pulse/snapshots';

/**
 * Cron: Pulse — generate daily metric snapshots
 *
 * POST /api/cron/generate-snapshots
 *
 * Iterates every organisation and writes today's snapshots to
 * metric_snapshots. Designed to be invoked nightly (~02:00 UTC).
 *
 * Protected by CRON_SECRET Bearer token. Same auth pattern as the
 * existing Xero sync cron.
 */

export const runtime = 'nodejs';
// Snapshot generation can take a minute or more for large workspaces.
export const maxDuration = 300;

interface OrgFailure {
  organization_id: string;
  error: string;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: orgs, error: orgsError } = await supabase
      .from('organizations')
      .select('id');

    if (orgsError) {
      console.error('Pulse snapshots: failed to list organisations', orgsError);
      return NextResponse.json({ error: orgsError.message }, { status: 500 });
    }

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ message: 'No organisations to snapshot', written: 0 });
    }

    const today = new Date();
    let totalRowsWritten = 0;
    let successCount = 0;
    const failures: OrgFailure[] = [];

    for (const org of orgs) {
      try {
        const rows = await computeOrgSnapshots(supabase, org.id, today);
        const { written, error } = await writeSnapshots(supabase, rows);
        if (error) {
          failures.push({ organization_id: org.id, error });
        } else {
          totalRowsWritten += written;
          successCount += 1;
        }
      } catch (err: any) {
        failures.push({
          organization_id: org.id,
          error: err?.message || 'Unknown error',
        });
        console.error(`Pulse snapshots failed for org ${org.id}:`, err);
      }
    }

    return NextResponse.json({
      synced: successCount,
      failed: failures.length,
      total: orgs.length,
      rows_written: totalRowsWritten,
      failures,
    });
  } catch (error: any) {
    console.error('Error in generate-snapshots cron:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
