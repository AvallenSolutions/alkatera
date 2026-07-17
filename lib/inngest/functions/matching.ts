import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { attemptAutoMatch, syncBrandTier } from '@/lib/distributor/integration/linker';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';

/**
 * Brand-matching sweep, on Inngest. Walks every unlinked
 * brand_profile against the alka**tera** platform organisations and
 * auto-links / suggests matches. Then re-syncs tier + live data for
 * everything already linked.
 *
 * Replaces the daily /api/cron/run-brand-matching route + the admin
 * /api/admin/run-brand-matching trigger. Both still work as manual
 * fallbacks. In production, the Netlify Schedule fn dispatches an
 * Inngest event once a day at 03:00 UTC, and the admin "Match now"
 * button sends the same event on demand.
 *
 * Single function (no fan-out) because matching is cheap and
 * sequential by nature — the dispatcher iterates a few hundred
 * brands, each is a string-similarity check + maybe an Inngest
 * notification. Whole sweep finishes in tens of seconds.
 */

const MAX_BRANDS_PER_RUN = 500;

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const matchingSweepRun = inngest.createFunction(
  {
    id: 'matching-sweep-run',
    name: 'alka**tera** brand-matching sweep',
    // Only one sweep at a time. If the daily schedule fires while
    // an admin-triggered sweep is still running, we'd rather queue
    // than double-link.
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'matching/sweep.run' }, { cron: '0 3 * * *' }],
  },
  async ({ step }) => {
    const supabase = service();

    // Phase A: try to match every still-unlinked brand profile.
    const phaseA = await step.run('phase-a-auto-match', async () => {
      const { data: unlinked } = await supabase
        .from('brand_profiles')
        .select('id, name, normalized_name, website')
        .is('alkatera_org_id', null)
        .order('created_at', { ascending: true })
        .limit(MAX_BRANDS_PER_RUN);
      let linked = 0;
      let suggested = 0;
      let scanned = 0;
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
        } catch {
          // best-effort
        }
      }
      return { scanned, linked, suggested };
    });

    // Phase B: re-sync tier + alka**tera** live data for already-linked
    // brands. Tier sync is per-listing (one row per distributor's view
    // of the brand); live-data sync is per-directory so dedupe across
    // listings to avoid syncing the same canonical brand twice.
    const phaseB = await step.run('phase-b-resync', async () => {
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
        } catch {
          // best-effort
        }
      }
      return { tier_updates: tierUpdates, alkatera_synced: alkateraSynced };
    });

    return { ...phaseA, ...phaseB };
  },
);
