import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { snapshotOrgProductIntensity } from '@/lib/benchmarks/product-intensity';

/**
 * Backfill the peer-benchmark cohort from the completed PCFs we already hold.
 *
 * Step 2 of Phase 1: without it, the cohort starts empty and every product
 * sits on the literature or no-benchmark rung until each one happens to be
 * recalculated. The figures exist already; this only reads them out into the
 * shape a benchmark needs.
 *
 * On Inngest rather than inline in the admin route because it walks every
 * organisation and issues three queries each, which is exactly the shape that
 * has repeatedly hit the synchronous function ceiling here.
 *
 * Re-runnable: the writer upserts on (product_id, metric_key, snapshot_date),
 * so running it twice in a day is a no-op rather than a duplicate.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const benchmarksBackfillRun = inngest.createFunction(
  {
    id: 'benchmarks-backfill-intensity',
    name: 'Benchmarks: backfill product intensity cohort',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'benchmarks/intensity.backfill' }],
  },
  async ({ step }) => {
    const supabase = service();

    const orgIds = await step.run('list-organisations', async () => {
      const { data, error } = await supabase.from('organizations').select('id');
      if (error) throw new Error(error.message);
      return (data ?? []).map((o: { id: string }) => o.id);
    });

    // One step per organisation: a single org's bad data retries on its own
    // rather than restarting the whole sweep, and progress survives a crash.
    let written = 0;
    const skipped: Record<string, number> = {};
    const failures: Array<{ organization_id: string; error: string }> = [];

    for (const orgId of orgIds) {
      const result = await step.run(`snapshot-${orgId}`, async () => {
        const asOf = new Date();
        return snapshotOrgProductIntensity(supabase, orgId, asOf);
      });
      if (result.error) {
        failures.push({ organization_id: orgId, error: result.error });
        continue;
      }
      written += result.written;
      for (const [reason, count] of Object.entries(result.skipped ?? {})) {
        skipped[reason] = (skipped[reason] ?? 0) + (count as number);
      }
    }

    return {
      organisations: orgIds.length,
      rows_written: written,
      // Reported, never swallowed. A backfill that silently drops half the
      // catalogue would produce a cohort of something other than what we think.
      skipped,
      failures,
    };
  },
);
