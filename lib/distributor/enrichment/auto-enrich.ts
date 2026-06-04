import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';

/**
 * Auto-queue deep-enrich for a batch of brand_directory ids.
 *
 * Called from the SKU import flow (run-sku-import.ts) and the admin
 * "deep-enrich entire portfolio" tool. For each directory id:
 *
 *   1. Skip if a deep_enrich_jobs row already exists in
 *      pending/searching/searched/ingesting state — we don't want
 *      duplicate work.
 *   2. Skip if the brand was deep-enriched in the last 30 days
 *      (deep_enrich_jobs.status='done' with completed_at recent).
 *      Scraping refreshes the data; deep-enrich is the expensive
 *      grounded-search step we'd rather not re-run frequently.
 *   3. Otherwise insert a fresh deep_enrich_jobs row and fire one
 *      `enrich/brand.run` Inngest event.
 *
 * Throttling lives at the Inngest function level (concurrency: 4 in
 * `lib/inngest/functions/enrich.ts`). A 68-brand upload fans out
 * instantly; Inngest queues anything over the concurrency cap.
 *
 * Cost guard: one deep-enrich is ~1k-5k Gemini grounded-search
 * tokens, well under $0.05 per brand. The 30-day skip means
 * subsequent SKU uploads that touch the same brands don't re-spend.
 */
export interface AutoEnrichResult {
  queued: string[];
  skipped_recent: string[];
  skipped_in_flight: string[];
  errors: Array<{ brand_directory_id: string; error: string }>;
}

const REFRESH_INTERVAL_DAYS = 30;
const IN_FLIGHT_STATUSES = ['pending', 'searching', 'searched', 'ingesting'];

export async function autoEnrichBrands(
  supabase: SupabaseClient,
  brandDirectoryIds: string[],
  triggeredBy: string,
): Promise<AutoEnrichResult> {
  const out: AutoEnrichResult = {
    queued: [],
    skipped_recent: [],
    skipped_in_flight: [],
    errors: [],
  };
  if (brandDirectoryIds.length === 0) return out;

  // Bulk-fetch existing deep_enrich_jobs across the candidate set so
  // we don't issue 68 individual SELECTs for a 68-brand upload.
  const { data: existingJobs } = await supabase
    .from('deep_enrich_jobs')
    .select('brand_directory_id, status, completed_at')
    .in('brand_directory_id', brandDirectoryIds);
  type Job = {
    brand_directory_id: string;
    status: string;
    completed_at: string | null;
  };
  const recentCutoff = Date.now() - REFRESH_INTERVAL_DAYS * 24 * 60 * 60 * 1000;
  const inFlight = new Set<string>();
  const recentlyDone = new Set<string>();
  for (const j of (existingJobs ?? []) as Job[]) {
    if (IN_FLIGHT_STATUSES.includes(j.status)) inFlight.add(j.brand_directory_id);
    if (
      j.status === 'done' &&
      j.completed_at &&
      new Date(j.completed_at).getTime() >= recentCutoff
    ) {
      recentlyDone.add(j.brand_directory_id);
    }
  }

  for (const directoryId of brandDirectoryIds) {
    if (inFlight.has(directoryId)) {
      out.skipped_in_flight.push(directoryId);
      continue;
    }
    if (recentlyDone.has(directoryId)) {
      out.skipped_recent.push(directoryId);
      continue;
    }
    try {
      const { data: job, error: insertErr } = await supabase
        .from('deep_enrich_jobs')
        .insert({
          brand_directory_id: directoryId,
          status: 'pending',
          phase_message: `Queued by ${triggeredBy}`,
        })
        .select('id')
        .single();
      if (insertErr || !job) {
        out.errors.push({
          brand_directory_id: directoryId,
          error: insertErr?.message ?? 'insert_failed',
        });
        continue;
      }
      const jobId = (job as { id: string }).id;
      // Fire the Inngest event. inngest.send no-ops gracefully when
      // INNGEST_EVENT_KEY isn't set — the job row stays 'pending' and
      // the existing /api/cron/* fallback or a manual click can still
      // run it. So this never blocks a successful import.
      await inngest.send({
        name: 'enrich/brand.run',
        data: { brand_directory_id: directoryId, job_id: jobId },
      });
      out.queued.push(directoryId);
    } catch (err: unknown) {
      out.errors.push({
        brand_directory_id: directoryId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}
