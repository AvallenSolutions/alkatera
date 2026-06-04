import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { persistEnriched } from '@/lib/distributor/enrichment/persist';
import type { DeepEnrichResult } from '@/lib/admin/sourcing/deep-enrich';

/**
 * GET /api/admin/directory/deep-enrich/[id]
 *
 * Poll endpoint for an async deep-enrich job. When the background
 * (Inngest enrichBrandRun or legacy Netlify bg fn) finishes the
 * Gemini call we see status='searched' here and run the persistence
 * pipeline. The actual persistence logic lives in
 * lib/distributor/enrichment/persist.ts so Phase B's auto-enrich
 * pipeline can also call it without an admin poll.
 *
 * Persistence runs in this route (not in the Inngest function)
 * historically because the bulk processors + matchers use the `@/`
 * alias which Netlify's lambda zipper didn't bundle reliably for
 * Netlify background fns. The Inngest function uses the same shared
 * lib and runs on Inngest's runtime where the alias works, so the
 * "ingesting" step now also runs there for the auto-enrich path —
 * this admin route still owns it for the manual button case.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: jobRow } = await auth.service
    .from('deep_enrich_jobs')
    .select('id, brand_directory_id, status, phase_message, enriched, result, error')
    .eq('id', params.id)
    .maybeSingle();
  if (!jobRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const job = jobRow as {
    id: string;
    brand_directory_id: string;
    status: string;
    phase_message: string | null;
    enriched: DeepEnrichResult | null;
    result: Record<string, unknown> | null;
    error: string | null;
  };

  if (job.status === 'searched') {
    // Atomic claim → only one poll runs the ingest.
    const { data: claimed } = await auth.service
      .from('deep_enrich_jobs')
      .update({ status: 'ingesting', phase_message: 'Persisting findings…' })
      .eq('id', job.id)
      .eq('status', 'searched')
      .select('id');
    if (Array.isArray(claimed) && claimed.length === 1 && job.enriched) {
      const result = await persistEnriched(auth.service, job.brand_directory_id, job.enriched);
      await auth.service
        .from('deep_enrich_jobs')
        .update({
          status: 'done',
          phase_message: null,
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return NextResponse.json({ status: 'done', result });
    }
    // Another poll claimed it — return current state.
  }

  return NextResponse.json({
    status: job.status,
    phase_message: job.phase_message,
    result: job.result,
    error: job.error,
  });
}
