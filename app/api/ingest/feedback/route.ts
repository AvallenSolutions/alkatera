import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { applyFieldAliases, computeFieldDiff } from '@/lib/ingest/feedback-diff';
import { supplierKeyForResult } from '@/lib/ingest/supplier-key';
import { deriveHints } from '@/lib/ingest/feedback-hints';

/**
 * POST /api/ingest/feedback
 *
 * The Smart Upload learning hook. Called fire-and-forget by the review panels
 * after a successful save with what the user ACTUALLY saved. We diff that
 * against what the classifier extracted (still on the ingest_jobs row),
 * record the correction in ingest_feedback, and fold the confirmed document
 * into the org's ingest_document_profiles memory so the next upload from the
 * same supplier classifies with hints.
 *
 * The client treats every response as best-effort — this route must never
 * break the save UX, so non-learnable types return 200 { skipped: true }
 * rather than an error.
 *
 * getSupabaseAPIClient() returns a service-role DB client, so scoping is
 * enforced explicitly: the job must exist, belong to the caller, and the org
 * comes from the job row — never from the request body.
 */

// Types where the user reviews/edits extracted fields before saving. The
// deterministic paths (smart_meter_csv, bulk_xlsx, accounts_csv) and the
// handoff types (spray_diary, bom, soil_carbon_evidence) have no single
// confirm event worth learning from.
const LEARNABLE_TYPES = new Set([
  'utility_bill',
  'water_bill',
  'waste_bill',
  'supplier_invoice',
  'freight_invoice',
  'refrigerant_service',
  'packaging_spec',
  'supplier_coa',
  'certification',
  'soil_carbon_lab',
  'historical_sustainability_report',
  'historical_lca_report',
]);

// result_payload on the job row is the shaped wire format from
// shapeIngestResult(): { type, <wrapperKey>: payload }. Unwrap before diffing.
const WRAPPER_KEYS: Record<string, string> = {
  utility_bill: 'utilityBill',
  water_bill: 'waterBill',
  waste_bill: 'wasteBill',
  supplier_invoice: 'supplierInvoice',
  freight_invoice: 'freightInvoice',
  refrigerant_service: 'refrigerantService',
  packaging_spec: 'packagingSpec',
  supplier_coa: 'supplierCoa',
  certification: 'certification',
  soil_carbon_lab: 'soilCarbonLab',
  historical_sustainability_report: 'historicalSustainabilityReport',
  historical_lca_report: 'historicalLcaReport',
};

const MAX_SAVED_PAYLOAD_BYTES = 100 * 1024;

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const jobId: string | null = typeof body?.jobId === 'string' ? body.jobId : null;
    const savedPayloadRaw = body?.savedPayload;
    const context: Record<string, unknown> =
      body?.context && typeof body.context === 'object' && !Array.isArray(body.context) ? body.context : {};

    if (!jobId || !savedPayloadRaw || typeof savedPayloadRaw !== 'object' || Array.isArray(savedPayloadRaw)) {
      return NextResponse.json({ error: 'jobId and savedPayload required' }, { status: 400 });
    }
    if (JSON.stringify(savedPayloadRaw).length > MAX_SAVED_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'savedPayload too large' }, { status: 400 });
    }

    const { data: job } = await supabase
      .from('ingest_jobs')
      .select('id, user_id, organization_id, status, result_type, result_payload')
      .eq('id', jobId)
      .maybeSingle();

    // Same ownership check as the polling route: a job you didn't create is
    // indistinguishable from one that doesn't exist.
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const denied = await denyReadOnlyAdvisor(supabase, user, job.organization_id);
    if (denied) return denied;

    if (job.status !== 'completed' || !job.result_type) {
      return NextResponse.json({ skipped: true, reason: 'job not completed' });
    }
    if (!LEARNABLE_TYPES.has(job.result_type)) {
      return NextResponse.json({ skipped: true, reason: 'result type not learnable' });
    }

    const wrapperKey = WRAPPER_KEYS[job.result_type];
    const classifierPayload: Record<string, unknown> =
      (job.result_payload as Record<string, unknown> | null)?.[wrapperKey] &&
      typeof (job.result_payload as Record<string, unknown>)[wrapperKey] === 'object'
        ? ((job.result_payload as Record<string, unknown>)[wrapperKey] as Record<string, unknown>)
        : {};

    const savedPayload = applyFieldAliases(job.result_type, savedPayloadRaw as Record<string, unknown>);
    const fieldDiff = computeFieldDiff(classifierPayload, savedPayload);
    const supplierKey = supplierKeyForResult(job.result_type, savedPayload, classifierPayload);

    // Idempotent on job_id: a retry updates the correction, but only the
    // first insert bumps the document profile.
    const { data: existing } = await supabase
      .from('ingest_feedback')
      .select('id')
      .eq('job_id', jobId)
      .maybeSingle();

    const feedbackRow = {
      job_id: jobId,
      organization_id: job.organization_id,
      user_id: user.id,
      result_type: job.result_type,
      supplier_key: supplierKey,
      classifier_payload: classifierPayload,
      saved_payload: savedPayload,
      field_diff: fieldDiff,
      context,
    };

    if (existing) {
      await supabase.from('ingest_feedback').update(feedbackRow).eq('id', existing.id);
      return NextResponse.json({ ok: true, edited: fieldDiff.edited, repeat: true });
    }

    const { error: insertErr } = await supabase.from('ingest_feedback').insert(feedbackRow);
    if (insertErr) {
      console.error('[ingest/feedback] Insert failed:', insertErr.message);
      return NextResponse.json({ error: 'Could not record feedback' }, { status: 500 });
    }

    if (supplierKey) {
      const hints = deriveHints(job.result_type, savedPayload, context);
      // Read-then-write is fine here (low contention, single user confirming
      // one upload); the unique constraint is the backstop.
      const { data: profile } = await supabase
        .from('ingest_document_profiles')
        .select('id, times_seen, hints')
        .eq('organization_id', job.organization_id)
        .eq('supplier_key', supplierKey)
        .eq('result_type', job.result_type)
        .maybeSingle();

      if (profile) {
        await supabase
          .from('ingest_document_profiles')
          .update({
            times_seen: (profile.times_seen ?? 1) + 1,
            hints: { ...(profile.hints as Record<string, unknown>), ...hints },
            last_confirmed_payload: savedPayload,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', profile.id);
      } else {
        const { error: profileErr } = await supabase.from('ingest_document_profiles').insert({
          organization_id: job.organization_id,
          supplier_key: supplierKey,
          result_type: job.result_type,
          times_seen: 1,
          hints,
          last_confirmed_payload: savedPayload,
        });
        if (profileErr && profileErr.code === '23505') {
          // Lost a race with a concurrent confirm — bump the winner instead.
          const { data: winner } = await supabase
            .from('ingest_document_profiles')
            .select('id, times_seen, hints')
            .eq('organization_id', job.organization_id)
            .eq('supplier_key', supplierKey)
            .eq('result_type', job.result_type)
            .maybeSingle();
          if (winner) {
            await supabase
              .from('ingest_document_profiles')
              .update({
                times_seen: (winner.times_seen ?? 1) + 1,
                hints: { ...(winner.hints as Record<string, unknown>), ...hints },
                last_confirmed_payload: savedPayload,
                last_seen_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', winner.id);
          }
        } else if (profileErr) {
          console.error('[ingest/feedback] Profile insert failed:', profileErr.message);
        }
      }
    }

    return NextResponse.json({ ok: true, edited: fieldDiff.edited });
  } catch (err: any) {
    console.error('[ingest/feedback] Error:', err);
    return NextResponse.json({ error: 'Could not record feedback' }, { status: 500 });
  }
}
