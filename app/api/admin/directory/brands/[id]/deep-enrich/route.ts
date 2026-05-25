import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';

/**
 * POST /api/admin/directory/brands/[id]/deep-enrich
 *
 * Enqueues a deep-enrich job and returns the jobId immediately. The
 * heavy work (Claude Sonnet + 10 web_search calls) runs in the
 * deep-enrich-background Netlify function; the client polls
 * GET /api/admin/directory/deep-enrich/[jobId] for status + result.
 *
 * Locally (no Netlify background infra) we fall back to a floating
 * inline run so the dev server still completes the job via polling.
 */
export const runtime = 'nodejs';
export const maxDuration = 26;

const TRIGGER_TIMEOUT_MS = 4000;

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: brand } = await auth.service
    .from('brand_directory')
    .select('id')
    .eq('id', params.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const { data: job, error: insertErr } = await auth.service
    .from('deep_enrich_jobs')
    .insert({
      brand_directory_id: params.id,
      created_by: auth.user.id,
      status: 'pending',
      phase_message: 'Queued…',
    })
    .select('id')
    .single();
  if (insertErr || !job) {
    return NextResponse.json(
      { error: 'create_job_failed', detail: insertErr?.message },
      { status: 500 },
    );
  }
  const jobId = (job as { id: string }).id;

  // Fire the background fn. Local dev / missing secret → inline floating
  // fallback so the polling flow still completes.
  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  const target = `${baseUrl}/.netlify/functions/deep-enrich-background`;

  let triggered = false;
  if (hmacSecret) {
    triggered = await triggerBackground(target, hmacSecret, jobId).catch(() => false);
  }
  if (!triggered) {
    void runInline(auth.service, jobId);
  }

  return NextResponse.json({ jobId }, { status: 202 });
}

async function triggerBackground(
  target: string,
  hmacSecret: string,
  jobId: string,
): Promise<boolean> {
  const payload = JSON.stringify({ jobId });
  const signature = createHmac('sha256', hmacSecret).update(payload).digest('hex');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TRIGGER_TIMEOUT_MS);
  try {
    const res = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
      body: payload,
      signal: ctrl.signal,
    });
    return res.status >= 200 && res.status < 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Inline fallback for local dev. Loads the brand context, runs the
 * Claude pass, writes `enriched` onto the job. The poll endpoint
 * picks it up from there.
 */
async function runInline(service: SupabaseClient, jobId: string): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    service
      .from('deep_enrich_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  try {
    const { data: job } = await service
      .from('deep_enrich_jobs')
      .select('brand_directory_id')
      .eq('id', jobId)
      .maybeSingle();
    if (!job) {
      await update({ status: 'error', error: 'job_not_found', phase_message: null });
      return;
    }
    const brandDirectoryId = (job as { brand_directory_id: string }).brand_directory_id;

    const { data: brand } = await service
      .from('brand_directory')
      .select(
        'id, name, website, country_of_origin, category, founding_year, parent_company, description',
      )
      .eq('id', brandDirectoryId)
      .maybeSingle();
    if (!brand) {
      await update({ status: 'error', error: 'brand_not_found', phase_message: null });
      return;
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

    const { data: existingRows } = await service
      .from('product_directory')
      .select('id, name')
      .eq('brand_directory_id', directory.id)
      .order('name');
    const existingProducts = ((existingRows ?? []) as Array<{ id: string; name: string }>);

    await update({ status: 'searching', phase_message: 'Searching the web for this brand…' });

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
      await update({ status: 'error', error: enriched.error.slice(0, 500), phase_message: null });
      return;
    }
    await update({
      status: 'searched',
      phase_message: 'Persisting findings…',
      enriched,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await update({ status: 'error', error: message.slice(0, 500), phase_message: null });
  }
}
