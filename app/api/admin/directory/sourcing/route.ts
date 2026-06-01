import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHmac } from 'crypto';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import {
  findBrandsBatched,
  MAX_TARGET_COUNT,
  type SourcingFilters,
  type BatchProgress,
} from '@/lib/admin/sourcing/find-brands';
import { loadKnownBrandNames } from '@/lib/admin/sourcing/known-brand-names';
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

const SourcingPayloadSchema = z
  .object({
    category: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    certifications: z.array(z.string()).optional(),
    keywords: z.string().nullable().optional(),
    query: z.string().nullable().optional(),
    limit: z.number().optional(),
    excludeNames: z.array(z.string()).optional(),
    target_count: z.number().optional(),
  })
  .strict();

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = SourcingPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_json', details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;

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

  const targetCount = Math.max(
    1,
    Math.min(
      MAX_TARGET_COUNT,
      typeof body.target_count === 'number' && Number.isFinite(body.target_count)
        ? body.target_count
        : 12,
    ),
  );

  // Filters get persisted on the job and re-read by the bg fn; strip
  // target_count out of them since it lives on its own column now.
  const { target_count: _ignored, ...filters } = body;

  // Insert the job (pending).
  const { data: job, error: insertErr } = await auth.service
    .from('brand_sourcing_jobs')
    .insert({
      created_by: auth.user.id,
      status: 'pending',
      phase_message: 'Queued…',
      filters,
      target_count: targetCount,
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
    void runSearchInline(auth.service, jobId, filters as SourcingFilters, targetCount);
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
  targetCount: number,
): Promise<void> {
  const update = (patch: Record<string, unknown>) =>
    service
      .from('brand_sourcing_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  try {
    const chunksTarget = Math.max(1, Math.ceil(targetCount / 25));
    await update({
      status: 'searching',
      phase_message: `Searching the web — chunk 1 of up to ${chunksTarget}…`,
      progress: {
        chunks_run: 0,
        chunks_target: chunksTarget,
        found: 0,
        duplicates_skipped: 0,
        zero_streak: 0,
        last_chunk_added: 0,
      },
    });
    const knownNames = await loadKnownBrandNames(service);
    const mergedFilters: SourcingFilters = {
      ...filters,
      excludeNames: [...(filters.excludeNames ?? []), ...knownNames],
    };
    const batch = await findBrandsBatched({
      filters: mergedFilters,
      targetCount,
      onChunk: async (progress: BatchProgress) => {
        const phase =
          progress.chunks_run < progress.chunks_target
            ? `Chunk ${progress.chunks_run}/${progress.chunks_target} · ${progress.found} brand${progress.found === 1 ? '' : 's'} so far…`
            : `Found ${progress.found} brand${progress.found === 1 ? '' : 's'}. Adding to the directory…`;
        await update({ progress, phase_message: phase });
      },
    });
    if (batch.error && batch.brands.length === 0) {
      await update({ status: 'error', error: batch.error.slice(0, 500), phase_message: null });
      return;
    }
    await update({
      status: 'searched',
      phase_message: `Found ${batch.brands.length} brand${batch.brands.length === 1 ? '' : 's'}. Adding to the directory…`,
      progress: batch.progress,
      found: { brands: batch.brands, products: batch.products, summary: batch.summary ?? null },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await update({ status: 'error', error: message.slice(0, 500), phase_message: null });
  }
}
