import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
// Relative import (not `@/`) — Netlify's lambda zipper bundles via esbuild
// without honouring tsconfig path aliases reliably. find-brands.ts reaches the
// model via the Gemini helpers, so it bundles cleanly here. We deliberately do
// NOT import the bulk processors (they use the `@/` alias) — the ingest happens
// in the Next.js route once this function writes the raw results back.
import {
  findBrandsBatched,
  type SourcingFilters,
  type BatchProgress,
} from '../../lib/admin/sourcing/find-brands';
import { loadKnownBrandNames } from '../../lib/admin/sourcing/known-brand-names';

/**
 * Background runner for admin brand sourcing. The Netlify -background
 * suffix gives a 15-minute window, which removes the ~26s synchronous
 * ceiling that was returning a 504 — a single web-search sourcing call
 * reliably takes 40-60s.
 *
 * The Next route at /api/admin/directory/sourcing inserts a
 * brand_sourcing_jobs row, then fires an HMAC-signed request here. We
 * run the web search and write the raw brands/products onto the row
 * (status='searched'). The client polls /api/admin/directory/sourcing/
 * [jobId], which then ingests the results as pending.
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

console.log('[directory-sourcing-background] boot', { node: process.version });

export const handler = async (event: {
  body?: string | null;
  headers: Record<string, string | undefined>;
}) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!secret || !supabaseUrl || !serviceKey || !geminiKey) {
    console.error('[directory-sourcing-background] missing env', {
      hasSecret: !!secret,
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasGeminiKey: !!geminiKey,
    });
    return { statusCode: 500, body: 'misconfigured' };
  }

  const rawBody = event.body ?? '';
  const sigHeader = event.headers['x-internal-hmac'] ?? event.headers['X-Internal-Hmac'];
  if (!verifyHmac(rawBody, sigHeader, secret)) {
    return { statusCode: 401, body: 'unauthorized' };
  }

  let payload: { jobId?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return { statusCode: 400, body: 'invalid json' };
  }
  const { jobId } = payload;
  if (!jobId) return { statusCode: 400, body: 'missing jobId' };

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const updateJob = async (patch: Record<string, unknown>) => {
    await supabase
      .from('brand_sourcing_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    const { data: job, error: jobErr } = await supabase
      .from('brand_sourcing_jobs')
      .select('id, filters, target_count')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !job) {
      console.error('[directory-sourcing-background] job not found:', jobErr?.message);
      return { statusCode: 404, body: 'job not found' };
    }

    const targetCount =
      typeof (job as { target_count?: number }).target_count === 'number'
        ? (job as { target_count: number }).target_count
        : 12;

    await updateJob({
      status: 'searching',
      phase_message: `Searching the web — chunk 1 of up to ${Math.max(1, Math.ceil(targetCount / 25))}…`,
      progress: {
        chunks_run: 0,
        chunks_target: Math.max(1, Math.ceil(targetCount / 25)),
        found: 0,
        duplicates_skipped: 0,
        zero_streak: 0,
        last_chunk_added: 0,
      },
    });

    const baseFilters = (job.filters ?? {}) as SourcingFilters;
    const knownNames = await loadKnownBrandNames(supabase);
    const mergedFilters: SourcingFilters = {
      ...baseFilters,
      excludeNames: [...(baseFilters.excludeNames ?? []), ...knownNames],
    };

    const batch = await findBrandsBatched({
      filters: mergedFilters,
      targetCount,
      onChunk: async (progress: BatchProgress) => {
        const phase =
          progress.chunks_run < progress.chunks_target
            ? `Chunk ${progress.chunks_run}/${progress.chunks_target} · ${progress.found} brand${progress.found === 1 ? '' : 's'} so far…`
            : `Found ${progress.found} brand${progress.found === 1 ? '' : 's'}. Adding to the directory…`;
        await updateJob({ progress, phase_message: phase });
      },
    });

    if (batch.error && batch.brands.length === 0) {
      await updateJob({
        status: 'error',
        error: batch.error.slice(0, 500),
        phase_message: null,
      });
      return { statusCode: 200, body: 'ok' };
    }

    await updateJob({
      status: 'searched',
      phase_message: `Found ${batch.brands.length} brand${batch.brands.length === 1 ? '' : 's'}. Adding to the directory…`,
      progress: batch.progress,
      found: { brands: batch.brands, products: batch.products, summary: batch.summary ?? null },
    });

    return { statusCode: 200, body: 'ok' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[directory-sourcing-background] error:', message);
    await updateJob({ status: 'error', error: message.slice(0, 500), phase_message: null });
    return { statusCode: 200, body: 'ok' };
  }
};
