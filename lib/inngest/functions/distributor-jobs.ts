import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { runSourcingJob } from '@/lib/admin/sourcing/run-sourcing-job';
import { runFindWebsitesJob } from '@/lib/distributor/run-find-websites-job';
import { runSkuImport } from '@/lib/distributor/run-sku-import';
import type { ColumnMapping } from '@/types/distributor';

/**
 * Distributor / admin-directory one-shot background jobs, on Inngest.
 * Replaces three Netlify -background functions that 404 on Vercel:
 *
 *   - `directory-sourcing-background.ts` (admin brand sourcing web-search)
 *   - `find-websites-background.ts` (distributor "find brand websites" backfill)
 *   - `process-sku-import-background.ts` (distributor SKU-list import)
 *
 * Grouped together because all three are single-shot "do the heavy work,
 * write one job/run row" workers off the distributor portal / admin
 * directory, not fan-out queues.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const directorySourcingRun = inngest.createFunction(
  {
    id: 'directory-sourcing-run',
    name: 'Admin directory: web-search brand sourcing',
    concurrency: { limit: 3 },
    // runSourcingJob never throws (every failure path writes status: 'error'
    // onto the job row itself), so a retry only fires on a genuine
    // infra-level failure.
    retries: 1,
    triggers: [{ event: 'directory/sourcing.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { job_id?: string };
      if (!original?.job_id) return;
      const supabase = service();
      await supabase
        .from('brand_sourcing_jobs')
        .update({
          status: 'error',
          error: `Failed after retries: ${error.message}`.slice(0, 500),
          phase_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.job_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { job_id } = event.data as { job_id: string };
    await step.run('run-sourcing', () => runSourcingJob({ supabase, jobId: job_id }));
    return { job_id };
  },
);

export const findWebsitesRun = inngest.createFunction(
  {
    id: 'distributor-find-websites-run',
    name: 'Distributor: find brand websites backfill',
    concurrency: { limit: 3 },
    retries: 1,
    triggers: [{ event: 'distributor/find-websites.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { run_id?: string | null };
      if (!original?.run_id) return;
      const supabase = service();
      await supabase
        .from('distributor_backfill_runs')
        .update({
          status: 'error',
          message: `Failed after retries: ${error.message}`.slice(0, 500),
          finished_at: new Date().toISOString(),
        })
        .eq('id', original.run_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { distributor_org_id, brand_profile_id, run_id } = event.data as {
      distributor_org_id: string;
      brand_profile_id: string | null;
      run_id: string | null;
    };
    await step.run('find-websites', () =>
      runFindWebsitesJob({
        supabase,
        distributorOrgId: distributor_org_id,
        brandProfileId: brand_profile_id,
        runId: run_id,
      }),
    );
    return { distributor_org_id, run_id };
  },
);

export const skuImportRun = inngest.createFunction(
  {
    id: 'distributor-sku-import-run',
    name: 'Distributor: process an uploaded SKU list',
    concurrency: { limit: 3 },
    // No retries: processSkuList does plain (non-upserting) SKU inserts, so
    // re-running after a partial failure would duplicate rows. The original
    // Netlify function had the same at-most-once semantics — no retry
    // mechanism existed there either.
    retries: 0,
    triggers: [{ event: 'distributor/sku-import.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { sku_list_id?: string };
      if (!original?.sku_list_id) return;
      const supabase = service();
      await supabase
        .from('distributor_sku_lists')
        .update({
          status: 'error',
          error_message: `Failed after retries: ${error.message}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.sku_list_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { sku_list_id, distributor_org_id, mapping } = event.data as {
      sku_list_id: string;
      distributor_org_id: string;
      mapping: ColumnMapping;
    };

    await step.run('run-sku-import', async () => {
      try {
        await runSkuImport({
          supabase,
          skuListId: sku_list_id,
          distributorOrgId: distributor_org_id,
          mapping,
        });
      } catch (err) {
        // runSkuImport already stamps status='error' on the row for the
        // failure modes it owns; this catch is the backstop for anything
        // else, matching the original Netlify function's behaviour. Doesn't
        // re-throw — with retries: 0 there's nothing to retry, and throwing
        // would just trigger a duplicate (idempotent) onFailure write.
        const message = err instanceof Error ? err.message : 'import_failed';
        console.error('[distributor/sku-import] import failed:', message);
        await supabase
          .from('distributor_sku_lists')
          .update({ status: 'error', error_message: message, updated_at: new Date().toISOString() })
          .eq('id', sku_list_id);
      }
    });

    return { sku_list_id };
  },
);
