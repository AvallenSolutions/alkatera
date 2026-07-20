import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { processDocument } from '@/lib/distributor/document-processing/processor';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

/**
 * Cron: document processing queue
 *
 * POST /api/cron/process-document-queue
 *
 * Triggered every 2 minutes by netlify/functions/process-document-queue.ts.
 * Picks up to MAX_JOBS_PER_RUN queued document_processing_jobs (oldest
 * first), marks them 'processing', runs the processor against each.
 *
 * Auth: CRON_SECRET Bearer (same pattern as process-scraping-queue).
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_JOBS_PER_RUN = 3;

interface JobRow {
  id: string;
  submission_id: string;
  brand_profile_id: string;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'missing_supabase_config' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: noStoreFetch },
  }) as SupabaseClient;

  // Claim up to N queued jobs.
  const { data: claimed } = await supabase
    .from('document_processing_jobs')
    .select('id, submission_id, brand_profile_id')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (!claimed || claimed.length === 0) {
    return NextResponse.json({ processed: 0, message: 'no_jobs_queued' });
  }

  const startedAt = new Date().toISOString();
  await supabase
    .from('document_processing_jobs')
    .update({ status: 'processing', started_at: startedAt })
    .in('id', (claimed as JobRow[]).map((j) => j.id));

  const summaries = [];
  for (const job of claimed as JobRow[]) {
    let result;
    let threwMessage: string | null = null;
    try {
      result = await processDocument({
        supabase,
        submissionId: job.submission_id,
        jobId: job.id,
      });
    } catch (err: unknown) {
      threwMessage = err instanceof Error ? err.message : String(err);
      result = { ok: false, fields_extracted: 0, fields_conflicted: 0, errors: [threwMessage] };
    }

    const finalStatus = threwMessage || (!result.ok && result.fields_extracted === 0) ? 'error' : 'complete';
    const trimmedErrors = result.errors.slice(0, 5).join('\n');

    await supabase
      .from('document_processing_jobs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        fields_extracted: result.fields_extracted,
        fields_conflicted: result.fields_conflicted,
        error_message: trimmedErrors || null,
      })
      .eq('id', job.id);

    summaries.push({
      job_id: job.id,
      submission_id: job.submission_id,
      brand_profile_id: job.brand_profile_id,
      status: finalStatus,
      fields_extracted: result.fields_extracted,
      fields_conflicted: result.fields_conflicted,
      errors: result.errors,
    });
  }

  return NextResponse.json({
    processed: summaries.length,
    jobs: summaries,
  });
}
