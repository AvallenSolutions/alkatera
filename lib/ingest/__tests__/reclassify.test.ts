import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the extraction primitive (Claude) and the pure shaper.
vi.mock('@/lib/ingest/classify-document', () => ({
  extractWithForcedTool: vi.fn(),
  shapeIngestResult: vi.fn((type: string, _payload: unknown) => ({
    result_type: type,
    result_payload: { shaped: true, type },
  })),
}));
// The side-effect helpers are exercised elsewhere; here we only care that
// runReclassify orchestrates them, so stub them out.
vi.mock('@/lib/ingest/org-context', () => ({ buildIngestOrgContext: vi.fn(async () => 'ORG_CTX') }));
vi.mock('@/lib/ingest/wire-shape', () => ({ unwrapResultPayload: vi.fn(() => ({ original: true })) }));
vi.mock('@/lib/ingest/doc-signature', () => ({ docSignature: vi.fn(() => 'sig-123') }));
vi.mock('@/lib/ingest/feedback-hints', () => ({ sanitiseHintValue: vi.fn((v: unknown) => v) }));
vi.mock('@/lib/ingest/profile-upsert', () => ({ bumpDocumentProfile: vi.fn(async () => {}) }));

import { runReclassify, ReclassifyUnsupportedError, type ReclassifyJob } from '@/lib/ingest/reclassify';
import { extractWithForcedTool } from '@/lib/ingest/classify-document';

const extractMock = extractWithForcedTool as unknown as ReturnType<typeof vi.fn>;

/** A minimal chainable Supabase stub that records ingest_jobs updates. */
function makeSupabase() {
  const jobUpdates: Record<string, unknown>[] = [];
  const feedbackInserts: Record<string, unknown>[] = [];

  const supabase: any = {
    from(table: string) {
      if (table === 'ingest_jobs') {
        return {
          update(vals: Record<string, unknown>) {
            jobUpdates.push(vals);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'ingest_feedback') {
        return {
          // .select('id').eq('job_id', x).maybeSingle() -> no existing row
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          insert: async (row: Record<string, unknown>) => {
            feedbackInserts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { supabase, jobUpdates, feedbackInserts };
}

const baseJob: ReclassifyJob = {
  id: 'job-1',
  organization_id: 'org-1',
  user_id: 'user-1',
  result_type: 'utility_bill',
  result_payload: { utilityBill: {} },
  original_result_type: null,
  reclassify_count: 1,
  stash_path: 'org-1/job-1/file.pdf',
  file_name: 'file.pdf',
  file_mime: 'application/pdf',
};

const fileBytes = new Uint8Array([1, 2, 3]);

describe('runReclassify', () => {
  beforeEach(() => {
    extractMock.mockReset();
  });

  it('re-reads, overwrites the job result, and increments reclassify_count', async () => {
    extractMock.mockResolvedValue({ type: 'water_bill', payload: { waterBill: {} }, meta: {} });
    const { supabase, jobUpdates, feedbackInserts } = makeSupabase();

    const shaped = await runReclassify({
      supabase,
      job: baseJob,
      targetType: 'water_bill' as any,
      fileBytes,
    });

    // Returned the shaped new-type result.
    expect(shaped.result_type).toBe('water_bill');

    // Wrote the new result to the job, preserving the original type + bumping count.
    const resultUpdate = jobUpdates.find((u) => 'result_type' in u);
    expect(resultUpdate).toBeTruthy();
    expect(resultUpdate!.result_type).toBe('water_bill');
    expect(resultUpdate!.original_result_type).toBe('utility_bill'); // first correction records the original
    expect(resultUpdate!.reclassify_count).toBe(2); // 1 -> 2

    // Recorded the misclassification for the learning loop.
    expect(feedbackInserts).toHaveLength(1);
    expect(feedbackInserts[0].misclassified).toBe(true);
    expect(feedbackInserts[0].corrected_result_type).toBe('water_bill');

    // Never touches ingest_jobs.status — the caller owns the lifecycle.
    expect(jobUpdates.some((u) => 'status' in u)).toBe(false);
  });

  it('throws ReclassifyUnsupportedError and does not write the job when the file is not that type', async () => {
    extractMock.mockResolvedValue({ type: 'unsupported', payload: { reason: 'not a meter file' } });
    const { supabase, jobUpdates } = makeSupabase();

    await expect(
      runReclassify({ supabase, job: baseJob, targetType: 'smart_meter_csv' as any, fileBytes }),
    ).rejects.toBeInstanceOf(ReclassifyUnsupportedError);

    // The job result must be left untouched on an unsupported re-read.
    expect(jobUpdates).toHaveLength(0);
  });

  it('preserves an already-recorded original_result_type across a second reclassify', async () => {
    extractMock.mockResolvedValue({ type: 'waste_bill', payload: {}, meta: {} });
    const { supabase, jobUpdates } = makeSupabase();

    await runReclassify({
      supabase,
      job: { ...baseJob, original_result_type: 'invoice', result_type: 'water_bill', reclassify_count: 2 },
      targetType: 'waste_bill' as any,
      fileBytes,
    });

    const resultUpdate = jobUpdates.find((u) => 'result_type' in u)!;
    expect(resultUpdate.original_result_type).toBe('invoice'); // not clobbered to 'water_bill'
    expect(resultUpdate.reclassify_count).toBe(3);
  });
});
