import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findBrandsBatched,
  type SourcingFilters,
  type BatchProgress,
} from '@/lib/admin/sourcing/find-brands';
import { loadKnownBrandNames } from '@/lib/admin/sourcing/known-brand-names';

/**
 * Core worker for admin brand sourcing — ported from
 * `netlify/functions/directory-sourcing-background.ts` onto Inngest
 * (`lib/inngest/functions/distributor-jobs.ts`, event
 * `directory/sourcing.run`). A single web-search sourcing call reliably
 * takes 40-60s, well past a synchronous route's ceiling.
 *
 * Reads the job's filters/target_count off `brand_sourcing_jobs`, runs the
 * grounded web search, and writes the raw brands/products back onto the row
 * (status='searched'). The admin GET route then ingests the results as
 * pending directory entries.
 */
export async function runSourcingJob(params: {
  supabase: SupabaseClient;
  jobId: string;
}): Promise<void> {
  const { supabase, jobId } = params;

  const updateJob = async (patch: Record<string, unknown>) => {
    await supabase
      .from('brand_sourcing_jobs')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', jobId);
  };

  try {
    const { data: job, error: jobErr } = await supabase
      .from('brand_sourcing_jobs')
      .select('id, filters, target_count')
      .eq('id', jobId)
      .maybeSingle();
    if (jobErr || !job) {
      console.error('[directory/sourcing] job not found:', jobErr?.message);
      return;
    }

    const targetCount =
      typeof (job as { target_count?: number }).target_count === 'number'
        ? (job as { target_count: number }).target_count
        : 12;

    await updateJob({
      status: 'searching',
      phase_message: `Searching the web — chunk 1 of up to ${Math.max(1, Math.ceil(targetCount / 25))}…`,
      progress: {
        chunks_run: 0,
        chunks_target: Math.max(1, Math.ceil(targetCount / 25)),
        found: 0,
        duplicates_skipped: 0,
        zero_streak: 0,
        last_chunk_added: 0,
      },
    });

    const baseFilters = (job.filters ?? {}) as SourcingFilters;
    const knownNames = await loadKnownBrandNames(supabase);
    const mergedFilters: SourcingFilters = {
      ...baseFilters,
      excludeNames: [...(baseFilters.excludeNames ?? []), ...knownNames],
    };

    const batch = await findBrandsBatched({
      filters: mergedFilters,
      targetCount,
      onChunk: async (progress: BatchProgress) => {
        const phase =
          progress.chunks_run < progress.chunks_target
            ? `Chunk ${progress.chunks_run}/${progress.chunks_target} · ${progress.found} brand${progress.found === 1 ? '' : 's'} so far…`
            : `Found ${progress.found} brand${progress.found === 1 ? '' : 's'}. Adding to the directory…`;
        await updateJob({ progress, phase_message: phase });
      },
    });

    if (batch.error && batch.brands.length === 0) {
      await updateJob({
        status: 'error',
        error: batch.error.slice(0, 500),
        phase_message: null,
      });
      return;
    }

    await updateJob({
      status: 'searched',
      phase_message: `Found ${batch.brands.length} brand${batch.brands.length === 1 ? '' : 's'}. Adding to the directory…`,
      progress: batch.progress,
      found: { brands: batch.brands, products: batch.products, summary: batch.summary ?? null },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[directory/sourcing] error:', message);
    await updateJob({ status: 'error', error: message.slice(0, 500), phase_message: null });
  }
}
