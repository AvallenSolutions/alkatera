import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { refreshGridCarbonReadings } from '@/lib/integrations/uk-carbon-intensity';

/**
 * Cron: refresh UK grid-carbon readings.
 *
 * POST /api/cron/refresh-grid-carbon
 *
 * Manual/admin trigger. In production this sweep runs on the
 * `pulseRefreshGridCarbon` Inngest native cron (lib/inngest/functions/pulse-jobs.ts,
 * every 30 min) — this route calls the same `refreshGridCarbonReadings` for
 * on-demand use.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
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

  try {
    const result = await refreshGridCarbonReadings(supabase);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 });
  }
}
