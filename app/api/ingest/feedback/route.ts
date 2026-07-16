import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { applyFieldAliases, computeFieldDiff } from '@/lib/ingest/feedback-diff';
import { supplierKeyForResult } from '@/lib/ingest/supplier-key';
import { deriveHints, sanitiseHintValue } from '@/lib/ingest/feedback-hints';
import { unwrapResultPayload } from '@/lib/ingest/wire-shape';
import { docSignature } from '@/lib/ingest/doc-signature';
import { bumpDocumentProfile } from '@/lib/ingest/profile-upsert';

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
      .select(
        'id, user_id, organization_id, status, result_type, result_payload, original_result_type, file_name',
      )
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

    // A reclassified job carries the classifier's first answer in
    // original_result_type; result_type is the final (user-confirmed) type.
    const originalType: string = job.original_result_type ?? job.result_type;
    const wasCorrected = !!job.original_result_type && job.original_result_type !== job.result_type;

    // Dismiss-without-save: a weak, metrics-only signal (admin dismiss rate).
    // Insert-only — it must never overwrite a confirmed save or touch the
    // document profiles, and it is never injected into classifier prompts.
    const dismissed = context.dismissed === true && Object.keys(savedPayloadRaw).length === 0;
    if (dismissed) {
      const { data: existingRow } = await supabase
        .from('ingest_feedback')
        .select('id')
        .eq('job_id', jobId)
        .maybeSingle();
      if (!existingRow) {
        await supabase.from('ingest_feedback').insert({
          job_id: jobId,
          organization_id: job.organization_id,
          user_id: user.id,
          result_type: originalType,
          corrected_result_type: wasCorrected ? job.result_type : null,
          misclassified: wasCorrected,
          supplier_key: null,
          classifier_payload: unwrapResultPayload(job.result_type, job.result_payload),
          saved_payload: {},
          field_diff: {},
          context,
        });
      }
      return NextResponse.json({ ok: true, dismissed: true });
    }

    // Corrections are always recorded, even for handoff types with no field
    // review — the type-level signal is the point.
    if (!LEARNABLE_TYPES.has(job.result_type) && !wasCorrected) {
      return NextResponse.json({ skipped: true, reason: 'result type not learnable' });
    }

    const classifierPayload = unwrapResultPayload(job.result_type, job.result_payload);

    const savedPayload = applyFieldAliases(job.result_type, savedPayloadRaw as Record<string, unknown>);
    const fieldDiff = computeFieldDiff(classifierPayload, savedPayload);
    const supplierKey = supplierKeyForResult(job.result_type, savedPayload, classifierPayload);

    // Idempotent on job_id: a retry updates the correction, but only the
    // first save bumps the document profile.
    const { data: existing } = await supabase
      .from('ingest_feedback')
      .select('id, saved_payload')
      .eq('job_id', jobId)
      .maybeSingle();

    const feedbackRow = {
      job_id: jobId,
      organization_id: job.organization_id,
      user_id: user.id,
      // result_type keeps the classifier's ORIGINAL answer; the corrected
      // type (when the user changed it) lives in corrected_result_type.
      result_type: originalType,
      corrected_result_type: wasCorrected ? job.result_type : null,
      misclassified: wasCorrected,
      supplier_key: supplierKey,
      classifier_payload: classifierPayload,
      saved_payload: savedPayload,
      field_diff: fieldDiff,
      context,
    };

    // A row can already exist for two reasons: a client retry of this save
    // (saved_payload populated — update it, but never double-bump profiles),
    // or a reclassify correction recorded server-side before the save
    // (saved_payload empty — this IS the first save, so the profile writes
    // below still run).
    const isRetriedSave =
      !!existing &&
      !!existing.saved_payload &&
      Object.keys(existing.saved_payload as Record<string, unknown>).length > 0;

    if (existing) {
      await supabase.from('ingest_feedback').update(feedbackRow).eq('id', existing.id);
      if (isRetriedSave) {
        return NextResponse.json({ ok: true, edited: fieldDiff.edited, repeat: true });
      }
    } else {
      const { error: insertErr } = await supabase.from('ingest_feedback').insert(feedbackRow);
      if (insertErr) {
        console.error('[ingest/feedback] Insert failed:', insertErr.message);
        return NextResponse.json({ error: 'Could not record feedback' }, { status: 500 });
      }
    }

    if (supplierKey) {
      const hints = deriveHints(job.result_type, savedPayload, context);
      await bumpDocumentProfile(supabase, {
        organizationId: job.organization_id,
        matchKind: 'supplier',
        supplierKey,
        resultType: job.result_type,
        hints,
        lastConfirmedPayload: savedPayload,
      });
    }

    // A confirmed save after a type correction also reinforces the
    // filename-keyed memory: files named like this are <corrected type>.
    if (wasCorrected) {
      const signature = docSignature(job.file_name || '');
      if (signature) {
        await bumpDocumentProfile(supabase, {
          organizationId: job.organization_id,
          matchKind: 'filename',
          supplierKey: signature,
          resultType: job.result_type,
          hints: {
            corrected_from: originalType,
            filename_example: sanitiseHintValue(job.file_name) ?? undefined,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, edited: fieldDiff.edited });
  } catch (err: any) {
    console.error('[ingest/feedback] Error:', err);
    return NextResponse.json({ error: 'Could not record feedback' }, { status: 500 });
  }
}
