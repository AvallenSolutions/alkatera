import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
// Relative imports (not `@/`) — Netlify's lambda zipper bundles via esbuild and
// doesn't reliably honour tsconfig path aliases at a function's entrypoint.
import { runBrandAgent } from '../../lib/distributor/scraping/brand-agent';

/**
 * Background runner for a single distributor brand scrape.
 *
 * The -background suffix gives this up to 15 minutes. The brand agent
 * crawls ~12 pages + makes several Gemini calls + ingests PDFs, which
 * reliably exceeds Netlify's ~26s synchronous ceiling — so it can't run
 * inside a synchronous route OR an Inngest step (both invoke over public
 * HTTP and 504 at 30s of inactivity). The scheduled queue tick claims
 * queued jobs, marks them `running`, and HMAC-fires this per job; we run
 * the agent and write the terminal job status (the agent recalculates
 * the brand's score on the way out).
 */

function verifyHmac(body: string, signature: string | undefined, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(signature, 'hex');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const handler = async (event: {
  body?: string | null;
  headers: Record<string, string | undefined>;
}) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) {
    console.error('[scrape-brand-bg] missing env');
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sig = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sig, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { jobId?: string; brandProfileId?: string | null; brandDirectoryId?: string | null };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { jobId, brandProfileId, brandDirectoryId } = payload;
  if (!jobId) return { statusCode: 400, body: 'missing jobId' };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const r = await runBrandAgent({
      supabase,
      brandProfileId: brandProfileId ?? undefined,
      brandDirectoryId: brandDirectoryId ?? undefined,
      jobId,
    });
    const finalStatus =
      r.errors.length > 0 && r.sources_succeeded === 0 ? 'error' : 'complete';
    const messageLines = [
      ...r.errors.slice(0, 5),
      ...r.skip_reasons.slice(0, 5),
    ];
    await supabase
      .from('scraping_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        sources_attempted: r.sources_attempted,
        sources_succeeded: r.sources_succeeded,
        error_message: messageLines.length ? messageLines.join('; ').slice(0, 1000) : null,
      })
      .eq('id', jobId);
    console.log('[scrape-brand-bg] done', { jobId, status: finalStatus, written: r.findings_written });
    return { statusCode: 200, body: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[scrape-brand-bg] failed', { jobId, message });
    await supabase
      .from('scraping_jobs')
      .update({ status: 'error', completed_at: new Date().toISOString(), error_message: message.slice(0, 1000) })
      .eq('id', jobId);
    return { statusCode: 200, body: 'error-handled' };
  }
};
