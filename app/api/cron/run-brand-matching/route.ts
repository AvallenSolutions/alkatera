import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { attemptAutoMatch } from '@/lib/distributor/integration/linker';
import { syncBrandTier } from '@/lib/distributor/integration/linker';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

/**
 * Cron: daily alkatera brand-matching sweep.
 *
 * POST /api/cron/run-brand-matching
 *
 * Walks every brand_profile in the system whose alkatera_org_id is
 * still null and tries to match it against an alkatera organization.
 * High-confidence matches auto-link; lower-confidence file a "pending
 * match" notification for the relevant distributor to review.
 *
 * Also re-syncs the tier of every linked brand to catch subscription
 * upgrades or brand-side confirmations that happened today.
 *
 * Auth: CRON_SECRET Bearer.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BRANDS_PER_RUN = 200;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  }) as SupabaseClient;

  // Phase A — try to match every still-unlinked brand profile.
  const { data: unlinked } = await supabase
    .from('brand_profiles')
    .select('id, name, normalized_name, website')
    .is('alkatera_org_id', null)
    .order('created_at', { ascending: true })
    .limit(MAX_BRANDS_PER_RUN);

  let scanned = 0;
  let linked = 0;
  let suggested = 0;
  for (const brand of (unlinked ?? []) as Array<{
    id: string;
    name: string;
    normalized_name: string;
    website: string | null;
  }>) {
    scanned += 1;
    const outcome = await attemptAutoMatch(supabase, brand);
    if (outcome.action === 'linked') linked += 1;
    else if (outcome.action === 'suggested') suggested += 1;
  }

  // Phase B — re-sync tiers + alkatera live data for every linked
  // brand. Cheap (small set) and catches subscription upgrades + new
  // LCAs / certifications / scope data added on the alkatera side
  // since the last run.
  const { data: linkedBrands } = await supabase
    .from('brand_profiles')
    .select('id')
    .not('alkatera_org_id', 'is', null);
  let tierUpdates = 0;
  let alkateraSynced = 0;
  for (const row of (linkedBrands ?? []) as Array<{ id: string }>) {
    try {
      await syncBrandTier(supabase, row.id);
      tierUpdates += 1;
    } catch {
      // best-effort
    }
    try {
      const result = await syncAlkateraDataForBrand(supabase, row.id);
      if (result.ok) alkateraSynced += 1;
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    scanned,
    linked,
    suggested,
    tier_refreshed: tierUpdates,
    alkatera_synced: alkateraSynced,
  });
}
