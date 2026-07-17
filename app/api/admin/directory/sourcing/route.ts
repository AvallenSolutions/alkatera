import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { MAX_TARGET_COUNT } from '@/lib/admin/sourcing/find-brands';
import { runSourcingJob } from '@/lib/admin/sourcing/run-sourcing-job';
import { inngest } from '@/lib/inngest/client';
import { isProductionRuntime } from '@/lib/deployment/base-url';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/directory/sourcing
 * Body: { category?, country?, certifications?, keywords?, query?, limit? }
 *
 * Enqueues an async sourcing job and returns its id immediately. The heavy
 * web-search call (40-60s) runs in the `directory/sourcing.run` Inngest
 * function (lib/inngest/functions/distributor-jobs.ts); the client polls
 * GET .../sourcing/[jobId].
 *
 * If Inngest dispatch fails (e.g. no dev server running locally) we fall
 * back to running the search inline as a floating promise — safe in the
 * long-lived Next dev process, but not attempted in production, where a
 * serverless function's floating promises aren't reliable once the
 * response is sent.
 */
export const runtime = 'nodejs';
export const maxDuration = 26;

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

  let triggered = false;
  try {
    await inngest.send({ name: 'directory/sourcing.run', data: { job_id: jobId } });
    triggered = true;
  } catch (err) {
    console.error('[directory-sourcing] inngest.send failed:', err);
  }

  if (!triggered) {
    if (isProductionRuntime()) {
      await auth.service
        .from('brand_sourcing_jobs')
        .update({ status: 'error', error: 'background_trigger_failed_in_production', phase_message: null })
        .eq('id', jobId);
      return NextResponse.json(
        { error: 'background_unavailable', detail: 'Could not dispatch the sourcing job to Inngest.' },
        { status: 503 },
      );
    }
    // Local fallback: don't await — let it run in the background of the
    // long-lived dev process; the client polls for completion.
    void runSourcingJob({ supabase: auth.service as unknown as SupabaseClient, jobId });
  }

  return NextResponse.json({ jobId }, { status: 202 });
}
