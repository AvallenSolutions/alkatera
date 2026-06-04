import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { attemptAutoMatch, syncBrandTier } from '@/lib/distributor/integration/linker';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

/**
 * Admin-triggered alka**tera** brand matching sweep.
 *
 * POST /api/admin/run-brand-matching
 *
 * Mirrors what the daily 03:00 UTC cron at
 * /api/cron/run-brand-matching does, but lets an alka**tera** admin
 * fire it on demand. Useful right after a distributor SKU upload:
 * without this the portfolio would wait up to 24 hours before
 * brand_profiles get matched to alka**tera** organisations, and
 * the score panel would show no alka**tera** badge or live data.
 *
 * Walks every unlinked brand_profile, tries to auto-match it against
 * an alka**tera** organisation, then re-syncs tier + live data for
 * everything already linked. Capped at 200 brands per call so a
 * single click can't run away on a huge directory.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_BRANDS_PER_RUN = 200;

interface RunSummary {
  scanned: number;
  linked: number;
  suggested: number;
  tier_updates: number;
  alkatera_synced: number;
  errors: string[];
}

export async function POST() {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const supabase = auth.service;
  const errors: string[] = [];

  // Phase A: try to match every still-unlinked brand profile.
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
    try {
      const outcome = await attemptAutoMatch(supabase, brand);
      if (outcome.action === 'linked') linked += 1;
      else if (outcome.action === 'suggested') suggested += 1;
    } catch (err: unknown) {
      errors.push(
        `match:${brand.name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Phase B: re-sync tier + alka**tera** live data for already-linked
  // brands. Tier sync is per-listing; live-data sync is per-directory
  // so dedupe across listings to avoid syncing the same canonical
  // brand multiple times when distributors share it.
  const { data: linkedBrands } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, alkatera_org_id')
    .not('alkatera_org_id', 'is', null);

  let tierUpdates = 0;
  let alkateraSynced = 0;
  const seenDirectories = new Set<string>();
  for (const row of (linkedBrands ?? []) as Array<{
    id: string;
    brand_directory_id: string;
    alkatera_org_id: string;
  }>) {
    try {
      await syncBrandTier(supabase, row.id);
      tierUpdates += 1;
    } catch {
      // best-effort
    }
  }
  for (const row of (linkedBrands ?? []) as Array<{
    id: string;
    brand_directory_id: string;
    alkatera_org_id: string;
  }>) {
    if (seenDirectories.has(row.brand_directory_id)) continue;
    seenDirectories.add(row.brand_directory_id);
    try {
      await syncAlkateraDataForBrand(supabase, row.brand_directory_id);
      alkateraSynced += 1;
    } catch (err: unknown) {
      errors.push(
        `sync:${row.brand_directory_id.slice(0, 8)}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const summary: RunSummary = {
    scanned,
    linked,
    suggested,
    tier_updates: tierUpdates,
    alkatera_synced: alkateraSynced,
    errors: errors.slice(0, 10),
  };
  return NextResponse.json(summary);
}
