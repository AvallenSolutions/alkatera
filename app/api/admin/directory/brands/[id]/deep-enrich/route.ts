import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { inngest } from '@/lib/inngest/client';
import { isProductionRuntime } from '@/lib/deployment/base-url';

/**
 * POST /api/admin/directory/brands/[id]/deep-enrich
 *
 * Enqueues a deep-enrich job and returns the jobId immediately. The heavy
 * work (Claude Sonnet + 10 web_search calls) runs in the `enrich/brand.run`
 * Inngest function (lib/inngest/functions/enrich.ts); the client polls
 * GET /api/admin/directory/deep-enrich/[jobId] for status + result.
 *
 * Locally, if Inngest isn't configured (no dev server running), we fall
 * back to a floating inline run so the dev server still completes the job
 * via polling. In production a dispatch failure is a hard error — a
 * floating promise inside a serverless function response isn't reliable.
 */
export const runtime = 'nodejs';
export const maxDuration = 26;

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

  let triggered = false;
  try {
    await inngest.send({
      name: 'enrich/brand.run',
      data: { brand_directory_id: params.id, job_id: jobId },
    });
    triggered = true;
  } catch (err) {
    console.error('[deep-enrich] inngest.send failed:', err);
  }

  if (!triggered) {
    // A serverless function's floating promises aren't reliable once the
    // response is sent, so production REQUIRES the Inngest dispatch to
    // succeed. Locally (no Inngest dev server running) we fall back to a
    // deferred-import inline run so polling still completes — the dynamic
    // import keeps the Anthropic SDK out of the production lambda bundle.
    if (isProductionRuntime()) {
      await auth.service
        .from('deep_enrich_jobs')
        .update({
          status: 'error',
          error: 'background_trigger_failed_in_production',
          phase_message: null,
        })
        .eq('id', jobId);
      return NextResponse.json(
        {
          error: 'background_unavailable',
          detail: 'Could not dispatch the deep-enrich job to Inngest.',
        },
        { status: 503 },
      );
    }
    void (async () => {
      try {
        const { runInline } = await import('./_inline');
        await runInline(auth.service, jobId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await auth.service
          .from('deep_enrich_jobs')
          .update({ status: 'error', error: `inline_failed: ${message}`, phase_message: null })
          .eq('id', jobId);
      }
    })();
  }

  return NextResponse.json({ jobId }, { status: 202 });
}

