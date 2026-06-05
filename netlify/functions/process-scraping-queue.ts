import { schedule } from '@netlify/functions';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

/**
 * Distributor portal — scraping queue tick (Netlify Scheduled Function).
 *
 * Runs every 5 minutes. Claims queued scraping_jobs, marks them
 * `running`, and HMAC-fires the `scrape-brand-background` function once
 * per job. The actual scrape runs there (a 15-minute background
 * function) because a single brand agent crawls ~12 pages + makes
 * several Gemini calls and reliably exceeds Netlify's ~26s synchronous
 * ceiling — so it cannot run inside this scheduled tick, a synchronous
 * route, or an Inngest step (all invoke over public HTTP and 504 at 30s
 * of inactivity). This is the same background-function pattern used by
 * find-websites-background / directory-sourcing-background.
 *
 * Also self-heals: any job stuck `running` beyond STALE_MS (a function
 * crash mid-scrape) is reset to `queued` so the next tick re-fires it.
 */

const MAX_JOBS_PER_TICK = 8;
const STALE_MS = 15 * 60 * 1000;

export const handler = schedule('*/5 * * * *', async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const baseUrl = process.env.URL || process.env.DEPLOY_URL || 'https://alkatera.com';
  if (!supabaseUrl || !serviceKey || !secret) {
    console.error('[scraping-queue-tick] missing env');
    return { statusCode: 500, body: 'misconfigured' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Recover stale `running` jobs (a background function that died mid-run).
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();
  await supabase
    .from('scraping_jobs')
    .update({ status: 'queued', started_at: null })
    .eq('status', 'running')
    .lt('started_at', cutoff);

  // 2. Claim up to N queued jobs, oldest first.
  const { data: claimed } = await supabase
    .from('scraping_jobs')
    .select('id, brand_profile_id, brand_directory_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_TICK);
  const jobs = (claimed ?? []) as Array<{
    id: string;
    brand_profile_id: string | null;
    brand_directory_id: string | null;
  }>;
  if (jobs.length === 0) return { statusCode: 200, body: 'idle' };

  await supabase
    .from('scraping_jobs')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .in('id', jobs.map((j) => j.id));

  // 3. Fire one background scrape per job (fire-and-forget; each returns 202).
  const target = `${baseUrl}/.netlify/functions/scrape-brand-background`;
  await Promise.all(
    jobs.map((j) => {
      const body = JSON.stringify({
        jobId: j.id,
        brandProfileId: j.brand_profile_id,
        brandDirectoryId: j.brand_directory_id,
      });
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      return fetch(target, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
        body,
      }).catch((err) => {
        console.error('[scraping-queue-tick] fire failed for', j.id, err instanceof Error ? err.message : err);
      });
    }),
  );

  return { statusCode: 200, body: `fired ${jobs.length}` };
});
