import { createClient } from '@supabase/supabase-js';
import { createHmac, timingSafeEqual } from 'crypto';
// Relative imports only — Netlify's lambda zipper bundles via esbuild
// and doesn't honour the tsconfig `@/` alias reliably. deep-enrich.ts
// only imports from the Gemini helper + ./sources type-only, so the
// bundle stays small.
import { deepEnrichBrand } from '../../lib/admin/sourcing/deep-enrich';

/**
 * Background runner for admin deep-enrich. The Netlify -background
 * suffix gives a 15-minute window so the comprehensive multi-source
 * Gemini + web_search call doesn't hit the ~30s synchronous ceiling
 * the regular Next.js route was 504-ing on.
 *
 * The POST /api/admin/directory/brands/[id]/deep-enrich route inserts
 * a deep_enrich_jobs row, then HMAC-signs a request to this function.
 * We load the brand + existing products from the DB, run the enrich,
 * and write the raw result onto the job (status='searched'). The
 * client polls /api/admin/directory/deep-enrich/[jobId], which then
 * runs the persistence pipeline (matcher, ingester, recalc) and sets
 * status='done'.
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

console.log('[deep-enrich-background] boot', { node: process.version });

export const handler = async (event: {
  body?: string | null;
  headers: Record<string, string | undefined>;
}) => {
  const secret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!secret || !supabaseUrl || !serviceKey || !geminiKey) {
    console.error('[deep-enrich-background] missing env', {
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
      .from('deep_enrich_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    const { data: job, error: jobErr } = await supabase
      .from('deep_enrich_jobs')
      .select('id, brand_directory_id')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !job) {
      console.error('[deep-enrich-background] job not found:', jobErr?.message);
      return { statusCode: 404, body: 'job not found' };
    }
    const brandDirectoryId = (job as { brand_directory_id: string }).brand_directory_id;

    const { data: brand } = await supabase
      .from('brand_directory')
      .select('id, name, website, country_of_origin, category, founding_year, parent_company, description')
      .eq('id', brandDirectoryId)
      .maybeSingle();
    if (!brand) {
      await updateJob({ status: 'error', error: 'brand_not_found', phase_message: null });
      return { statusCode: 200, body: 'ok' };
    }
    const directory = brand as {
      id: string;
      name: string;
      website: string | null;
      country_of_origin: string | null;
      category: string | null;
      founding_year: number | null;
      parent_company: string | null;
      description: string | null;
    };

    const { data: existingRows } = await supabase
      .from('product_directory')
      .select('id, name')
      .eq('brand_directory_id', directory.id)
      .order('name');
    const existingProducts = ((existingRows ?? []) as Array<{ id: string; name: string }>);

    await updateJob({
      status: 'searching',
      phase_message: 'Searching authoritative sources for this brand…',
    });

    const enriched = await deepEnrichBrand({
      brandName: directory.name,
      website: directory.website,
      country: directory.country_of_origin,
      category: directory.category,
      existingBrand: {
        description: directory.description,
        founding_year: directory.founding_year,
        parent_company: directory.parent_company,
      },
      existingProducts,
    });

    if (
      enriched.error &&
      enriched.products.length === 0 &&
      enriched.documents.length === 0 &&
      enriched.credentials.length === 0 &&
      Object.keys(enriched.brand).length === 0
    ) {
      await updateJob({
        status: 'error',
        error: enriched.error.slice(0, 500),
        phase_message: null,
      });
      return { statusCode: 200, body: 'ok' };
    }

    await updateJob({
      status: 'searched',
      phase_message: 'Persisting findings…',
      enriched,
    });

    return { statusCode: 200, body: 'ok' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[deep-enrich-background] error:', message);
    await updateJob({ status: 'error', error: message.slice(0, 500), phase_message: null });
    return { statusCode: 200, body: 'ok' };
  }
};
