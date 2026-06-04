import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { inngest } from '@/lib/inngest/client';

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

  // Prefer Inngest in production; fall back to the legacy HMAC →
  // Netlify-background path when INNGEST_EVENT_KEY isn't set yet, and
  // to a floating inline run when neither is configured (local dev).
  const inngestKey = process.env.INNGEST_EVENT_KEY;
  const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
  const baseUrl =
    process.env.URL ||
    process.env.DEPLOY_URL ||
    `${new URL(request.url).protocol}//${request.headers.get('host')}`;
  const target = `${baseUrl}/.netlify/functions/deep-enrich-background`;

  let triggered = false;
  if (inngestKey) {
    try {
      await inngest.send({
        name: 'enrich/brand.run',
        data: { brand_directory_id: params.id, job_id: jobId },
      });
      triggered = true;
    } catch {
      triggered = false;
    }
  }
  if (!triggered && hmacSecret) {
    triggered = await triggerBackground(target, hmacSecret, jobId).catch(() => false);
  }
  if (!triggered) {
    // Netlify waits for floating promises to settle before terminating
    // a lambda instance, so void-firing the inline Sonnet call here
    // would tie the response up for 60s+ — the connection gets killed
    // by the platform sync timeout before the 202 reaches the browser.
    // Production REQUIRES the HMAC-signed background fn path. Locally
    // we use a deferred-import dynamic to avoid bundling the Anthropic
    // SDK into this route, then fire-and-forget.
    if (process.env.NODE_ENV === 'production') {
      await auth.service
        .from('deep_enrich_jobs')
        .update({
          status: 'error',
          error: hmacSecret
            ? 'background_trigger_failed_in_production'
            : 'missing_internal_job_hmac_secret',
          phase_message: null,
        })
        .eq('id', jobId);
      return NextResponse.json(
        {
          error: 'background_unavailable',
          detail: hmacSecret
            ? 'Background function did not respond; check Netlify deploy + function logs.'
            : 'INTERNAL_JOB_HMAC_SECRET is not set on this environment.',
        },
        { status: 503 },
      );
    }
    // Local dev: import + fire inline. Dynamic import keeps the
    // Anthropic SDK out of the production lambda bundle.
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

