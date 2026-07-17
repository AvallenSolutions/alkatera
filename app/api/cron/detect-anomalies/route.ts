import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { runAnomalyDetectionSweep } from '@/lib/pulse/cron-jobs';
import { getAppBaseUrl } from '@/lib/deployment/base-url';

/**
 * Cron: Pulse — anomaly detection.
 *
 * POST /api/cron/detect-anomalies
 *
 * Manual/admin trigger. In production this sweep runs on the
 * `pulseDetectAnomalies` Inngest native cron (lib/inngest/functions/pulse-jobs.ts,
 * hourly) — this route calls the same `runAnomalyDetectionSweep` for
 * on-demand use. The detector is idempotent within a (org, metric, day)
 * window thanks to the unique constraint on dashboard_anomalies.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const result = await runAnomalyDetectionSweep(supabase, getAppBaseUrl(request));
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[detect-anomalies cron]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
