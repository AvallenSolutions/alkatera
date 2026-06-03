import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
// Relative imports (not `@/`) — Netlify's lambda zipper bundles via esbuild and
// doesn't reliably honour tsconfig path aliases at a function's entrypoint.
// These two modules are already pulled into the bundle graph of
// process-sku-import-background (run-sku-import imports both), so they bundle
// cleanly here too, including their transitive Gemini helper imports.
import { findBrandWebsites, type BrandWebsiteInput } from '../../lib/distributor/website-finder';
import { queueBrandsForScraping } from '../../lib/distributor/scraping/agent-dispatcher';

/**
 * Background runner for the distributor "find brand websites" backfill.
 *
 * The -background suffix gives this up to 15 minutes — the synchronous route
 * 504'd because a single Gemini grounded-search call reliably takes 40-60s,
 * which blows Netlify's ~26s synchronous ceiling no matter how small the page.
 *
 * The Next route POST /api/distributor/brands/find-websites flips no row; it
 * just HMAC-signs { distributorOrgId, brandProfileId? } and fires this. We find
 * official websites for the org's website-less brands, save them, and queue a
 * forced scrape for each one we located. The client polls
 * GET /api/distributor/brands/find-websites (status) and watches the
 * website-less count fall.
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
    console.error('[find-websites-bg] missing env', {
      hasSecret: !!secret,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
    });
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sig = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sig, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { distributorOrgId?: string; brandProfileId?: string; runId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { distributorOrgId, brandProfileId, runId } = payload;
  if (!distributorOrgId) {
    return { statusCode: 400, body: 'missing distributorOrgId' };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Record progress/outcome onto the run row the route created, so the portal
  // can show WHY a run found nothing instead of a silent 0.
  const finishRun = async (fields: Record<string, unknown>) => {
    if (!runId) return;
    await supabase
      .from('distributor_backfill_runs')
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq('id', runId);
  };
  const geminiConfigured = !!process.env.GEMINI_API_KEY;

  // Load the brands still missing a website (or the one requested).
  let query = supabase
    .from('brand_profiles')
    .select('id, name, country_of_origin')
    .eq('distributor_org_id', distributorOrgId)
    .eq('listing_status', 'active')
    .is('website', null)
    .order('id', { ascending: true });
  if (brandProfileId) query = query.eq('id', brandProfileId);

  const { data: rows, error: loadErr } = await query;
  if (loadErr) {
    console.error('[find-websites-bg] load failed:', loadErr.message);
    await finishRun({ status: 'error', message: `load_failed: ${loadErr.message}`, gemini_configured: geminiConfigured });
    return { statusCode: 200, body: 'load-error' };
  }
  const candidates = (rows ?? []) as Array<BrandWebsiteInput & { id: string }>;
  if (candidates.length === 0) {
    console.log('[find-websites-bg] nothing to do', { org: distributorOrgId });
    await finishRun({ status: 'done', message: 'nothing-to-do', gemini_configured: geminiConfigured });
    return { statusCode: 200, body: 'nothing-to-do' };
  }

  console.log('[find-websites-bg] start', { org: distributorOrgId, total: candidates.length });

  const result = await findBrandWebsites(candidates, {
    onProgress: (done, total) => {
      console.log(`[find-websites-bg] looked up ${done}/${total}`);
    },
  });
  const updates = Array.from(result.found.entries());

  // Persist discovered websites, scoped to this org and only where still null.
  let saved = 0;
  for (const [id, website] of updates) {
    const { error: updErr } = await supabase
      .from('brand_profiles')
      .update({ website })
      .eq('id', id)
      .eq('distributor_org_id', distributorOrgId)
      .is('website', null);
    if (!updErr) saved += 1;
  }

  // Queue a fresh, forced scrape for every brand we just gave a website.
  let queued = 0;
  if (updates.length > 0) {
    try {
      const queueResult = await queueBrandsForScraping({
        supabase,
        distributorOrgId,
        brandProfileIds: updates.map(([id]) => id),
        triggeredBy: 'manual',
        forceScrape: true,
      });
      queued = queueResult.queued;
    } catch (err) {
      console.error('[find-websites-bg] queue failed:', err instanceof Error ? err.message : err);
    }
  }

  console.log('[find-websites-bg] done', {
    org: distributorOrgId,
    attempted: result.attempted,
    found: saved,
    queued,
    errors: result.errors,
  });
  await finishRun({
    status: 'done',
    total: result.attempted,
    found: saved,
    queued,
    gemini_configured: geminiConfigured,
    errors: result.errors,
    samples: result.samples,
  });
  return { statusCode: 200, body: 'ok' };
};
