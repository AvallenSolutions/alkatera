import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { findBrands, type SourcingFilters } from '@/lib/admin/sourcing/find-brands';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/directory/sourcing
 * Body: { category?, country?, certifications?, keywords?, query?, limit? }
 *
 * Enqueues an async sourcing job and returns its id immediately. The
 * heavy web-search call (40-60s) runs in the directory-sourcing-background
 * Netlify function; the client polls GET .../sourcing/[jobId].
 *
 * Locally (no Netlify background infra) we fall back to running the
 * search inline as a floating promise — the Next dev server keeps the
 * process alive long enough to finish.
 */
export const runtime = 'nodejs';
export const maxDuration = 26;

const TRIGGER_TIMEOUT_MS = 4000;

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: SourcingFilters;
  try {
    body = (await request.json()) as SourcingFilters;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const hasCriteria =
    !!body.query?.trim() ||
    !!body.category ||
    !!body.country ||
    (Array.isArray(body.certifications) && body.certifications.length > 0) ||
    !!body.keywords?.trim();
  if (!hasCriteria) {
    return NextResponse.json(
      { error: 'no_criteria', detail: 'Provide a search query or at least one filter.' },
      { status: 400 },
    );
  }

  // Insert the job (pending).
  const { data: job, error: insertErr } = await auth.service
    .from('brand_sourcing_jobs')
    .insert({
      created_by: auth.user.id,
      status: 'pending',
      phase_message: 'Queued…',
      filters: body,
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

  // Fire the background function (production). If the trigger isn't
  // available (local dev / missing secret), fall back to an inline
  // floating search so the same polling flow still completes.
  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  const target = `${baseUrl}/.netlify/functions/directory-sourcing-background`;

  let triggered = false;
  if (hmacSecret) {
    triggered = await triggerBackground(target, hmacSecret, jobId).catch(() => false);
  }
  if (!triggered) {
    // Local / fallback path. Don't await — let it run in the background
    // of the dev process; the client polls for completion.
    void runSearchInline(auth.service, jobId, body);
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

async function runSearchInline(
  service: SupabaseClient,
  jobId: string,
  filters: SourcingFilters,
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    service
      .from('brand_sourcing_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  try {
    await update({ status: 'searching', phase_message: 'Searching the web for brands…' });
    const found = await findBrands(filters);
    if (found.error) {
      await update({ status: 'error', error: found.error.slice(0, 500), phase_message: null });
      return;
    }
    await update({
      status: 'searched',
      phase_message: `Found ${found.brands.length} brand(s). Adding to the directory…`,
      found: { brands: found.brands, products: found.products, summary: found.summary ?? null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await update({ status: 'error', error: message.slice(0, 500), phase_message: null });
  }
}
