import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { runImportFromUrl } from '@/lib/products/import-from-url-worker';
import { classifyIngestJob } from '@/lib/ingest/run-classify-job';

/**
 * "Import products from website" and Smart Upload's large-file classify
 * path, on Inngest. Replace `netlify/functions/import-from-url-background.ts`
 * and `netlify/functions/ingest-auto-background.ts` — both were Netlify
 * -background functions (15-minute runtime, HMAC-signed invocation) that
 * 404 on Vercel. Inngest gives the same long runtime with no
 * platform-specific dispatch: `app/api/products/import-from-url/route.ts`
 * and `lib/ingest/enqueue.ts` just `inngest.send(...)` the event.
 *
 * Grouped together because both are single-shot "fetch/read one thing,
 * write one job row" workers on the product-creation / smart-upload path,
 * not fan-out queues like scraping/documents.
 */

export function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const importFromUrlRun = inngest.createFunction(
  {
    id: 'products-import-from-url-run',
    name: 'Import products from a website',
    // One import at a time per brand site would be ideal, but jobs are
    // independent (different orgs, different sites) — cap total concurrency
    // so a burst of imports can't melt the Anthropic quota.
    concurrency: { limit: 6 },
    // The worker function itself never throws (every failure path writes
    // status: 'failed' onto the job row), so retries are for genuine
    // infra-level failures (e.g. the step process dying mid-run).
    retries: 1,
    triggers: [{ event: 'products/import-from-url.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { job_id: string };
      if (!original?.job_id) return;
      const supabase = service();
      await supabase
        .from('product_import_jobs')
        .update({
          status: 'failed',
          error: `Failed after retries: ${error.message}`.slice(0, 500),
          phase_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.job_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { job_id, url } = event.data as { job_id: string; url: string };

    await step.run('import-from-url', () => runImportFromUrl({ supabase, jobId: job_id, url }));

    return { job_id };
  },
);

export const ingestAutoRun = inngest.createFunction(
  {
    id: 'ingest-auto-run',
    name: 'Smart Upload: classify a large document',
    concurrency: { limit: 8 },
    retries: 1,
    triggers: [{ event: 'ingest/auto.run' }],
    onFailure: async ({ event, error }) => {
      const original = event.data.event.data as { job_id: string };
      if (!original?.job_id) return;
      const supabase = service();
      await supabase
        .from('ingest_jobs')
        .update({
          status: 'failed',
          error: `Failed after retries: ${error.message}`.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq('id', original.job_id);
    },
  },
  async ({ event, step }) => {
    const supabase = service();
    const { job_id } = event.data as { job_id: string };

    await step.run('classify', () => classifyIngestJob({ supabase, jobId: job_id }));

    return { job_id };
  },
);
