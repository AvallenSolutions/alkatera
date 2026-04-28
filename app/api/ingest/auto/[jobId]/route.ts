import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

// Belt-and-braces stuck-job recovery: if a job has been sitting in 'pending'
// for longer than this, the poll endpoint re-fires the background trigger
// once. Covers transient fetch failures or the rare case where the original
// fire-and-forget got dropped before the lambda received it.
const STUCK_PENDING_MS = 20_000;

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } },
) {
  const { client, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: job, error } = await (client as any)
    .from('ingest_jobs')
    .select(
      'id, user_id, status, phase_message, result_type, result_payload, error, created_at, retry_count',
    )
    .eq('id', params.jobId)
    .maybeSingle();

  if (error || !job || job.user_id !== user.id) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  // If the row is still 'pending' well after enqueue, the background
  // function never picked it up. Re-fire the trigger once. We bump
  // retry_count using a conditional update so concurrent polls can't
  // double-fire.
  if (
    job.status === 'pending' &&
    Date.now() - new Date(job.created_at).getTime() > STUCK_PENDING_MS &&
    (job.retry_count ?? 0) === 0
  ) {
    const hmacSecret = process.env.INTERNAL_JOB_HMAC_SECRET;
    if (hmacSecret) {
      const { data: claimed } = await (client as any)
        .from('ingest_jobs')
        .update({ retry_count: 1, phase_message: 'Retrying…', updated_at: new Date().toISOString() })
        .eq('id', job.id)
        .eq('retry_count', 0)
        .select('id')
        .maybeSingle();

      if (claimed) {
        const triggerPayload = JSON.stringify({ jobId: job.id });
        const signature = createHmac('sha256', hmacSecret)
          .update(triggerPayload)
          .digest('hex');
        const baseUrl =
          process.env.URL ||
          process.env.DEPLOY_URL ||
          `${request.nextUrl.protocol}//${request.headers.get('host')}`;
        void fetch(`${baseUrl}/.netlify/functions/ingest-auto-background`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-hmac': signature },
          body: triggerPayload,
        }).catch((err) => {
          console.error('[ingest/auto/[jobId]] Re-trigger failed:', err?.message);
        });
      }
    }
  }

  return NextResponse.json({
    status: job.status,
    phaseMessage: job.phase_message,
    resultType: job.result_type,
    result: job.result_payload ?? null,
    error: job.error,
  });
}
