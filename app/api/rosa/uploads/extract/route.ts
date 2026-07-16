/**
 * Rosa — document extraction endpoint.
 *
 * POST /api/rosa/uploads/extract
 * Body: { file_id: string }
 *
 * Pillar 1 rewire (data-revolution-plan.md): classifies the stashed file
 * through the SAME Claude classifier every other Smart Upload channel uses
 * (lib/ingest/classify-document.ts), against the ingest_jobs row the upload
 * step created (channel='rosa'). The old Gemini extractor
 * (lib/rosa/document-extraction.ts's extractStructured) is kept ONLY as a
 * fallback for the two cases the shared classifier can't help with:
 *   - the classifier answers 'unsupported'
 *   - the file predates this rewire and has no ingest_jobs row (a legacy
 *     rosa-uploads attachment)
 *
 * Only utility bills and water-intake bills map onto an importable
 * (facility, utility_type, quantity, period) shape the review modal can
 * write straight to facility_activity_entries / utility_data_entries — see
 * mapClassifierToReview below. Every other document type still classifies
 * correctly, it just offers "Send to Rosa" instead of an import form,
 * exactly as an unrecognised document did before this rewire.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { loadAttachment, extractStructured } from '@/lib/rosa/document-extraction';
import { checkRateLimit } from '@/lib/rosa/rate-limiter';
import { classifyDocument, shapeIngestResult } from '@/lib/ingest/classify-document';
import { buildIngestOrgContext } from '@/lib/ingest/org-context';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACT_RATE_LIMIT = 5; // per minute — vision calls are expensive even on Gemini Flash

interface ReviewFields {
  document_type: string;
  utility_type: string;
  supplier_name: string | null;
  account_number: string | null;
  period_start: string | null;
  period_end: string | null;
  quantity_value: number | null;
  quantity_unit: string | null;
  total_cost: number | null;
  currency: string | null;
  notes: string | null;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// Document types with no dedicated Rosa import form. documentTypeLabel() in
// DocumentReviewModal falls back to "Document" for anything not in its
// switch, so passing an unmapped classifier type through is safe — the
// client just offers "Send to Rosa" for these.
const NON_IMPORTABLE_LABELS: Partial<Record<string, string>> = {
  supplier_invoice: 'invoice',
  freight_invoice: 'invoice',
  historical_lca_report: 'lca_report',
  supplier_coa: 'supplier_spec',
  packaging_spec: 'supplier_spec',
};

/**
 * Map a classify-document.ts result onto the fields DocumentReviewModal
 * already knows how to render. Only 'utility_bill' and a 'water_bill' whose
 * first entry is water_intake become importable (document_type='utility_bill'
 * with a matching utility_type) — everything else identifies correctly but
 * routes to "Send to Rosa", matching the pre-rewire behaviour for anything
 * the old Gemini pass didn't recognise as a bill.
 */
function mapClassifierToReview(type: string, payload: Record<string, unknown>): ReviewFields {
  if (type === 'utility_bill') {
    const entries = Array.isArray((payload as any).entries) ? (payload as any).entries : [];
    const first = (entries[0] ?? {}) as Record<string, unknown>;
    const totalCost = num((payload as any).total_charged_gbp);
    return {
      document_type: 'utility_bill',
      utility_type: str(first.utility_type) ?? '',
      supplier_name: str((payload as any).supplier_name),
      account_number: str((payload as any).account_number),
      period_start: str((payload as any).period_start),
      period_end: str((payload as any).period_end),
      quantity_value: num(first.quantity),
      quantity_unit: str(first.unit),
      total_cost: totalCost,
      currency: totalCost != null ? 'GBP' : null,
      notes: entries.length > 1 ? `${entries.length} readings found on this bill; only the first is shown here.` : null,
    };
  }

  if (type === 'water_bill') {
    const entries = Array.isArray((payload as any).entries) ? (payload as any).entries : [];
    const first = (entries[0] ?? {}) as Record<string, unknown>;
    const importable = first.activity_category === 'water_intake';
    return {
      document_type: importable ? 'utility_bill' : 'water_bill',
      utility_type: importable ? 'water_intake' : '',
      supplier_name: str((payload as any).supplier_name),
      account_number: null,
      period_start: str((payload as any).period_start),
      period_end: str((payload as any).period_end),
      quantity_value: importable ? num(first.quantity) : null,
      quantity_unit: importable ? str(first.unit) : null,
      total_cost: null,
      currency: null,
      notes:
        !importable && entries.length > 0
          ? 'This looks like a wastewater / discharge bill rather than a water intake bill — send it to Rosa to discuss.'
          : entries.length > 1
            ? `${entries.length} entries found; only the first is shown here.`
            : null,
    };
  }

  const supplierish =
    str((payload as any).supplier_name) ??
    str((payload as any).carrier_name) ??
    str((payload as any).issuer) ??
    str((payload as any).lab_name) ??
    null;

  return {
    document_type: NON_IMPORTABLE_LABELS[type] ?? type,
    utility_type: '',
    supplier_name: supplierish,
    account_number: null,
    period_start: null,
    period_end: null,
    quantity_value: null,
    quantity_unit: null,
    total_cost: null,
    currency: null,
    notes: null,
  };
}

export async function POST(request: NextRequest) {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const rl = checkRateLimit(`extract:${user.id}`, EXTRACT_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many extraction requests. Please wait ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429 },
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Member OR active advisor for the caller's selected org (advisor reads honoured).
  const organizationId = await resolveAccessibleOrg(service, user);
  if (!organizationId) {
    return NextResponse.json({ error: 'No organisation' }, { status: 403 });
  }

  let body: { file_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const fileId = body?.file_id;
  if (!fileId || typeof fileId !== 'string') {
    return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
  }

  const [attachmentResult, facilitiesResult, jobResult] = await Promise.all([
    loadAttachment(service, fileId, organizationId, user.id),
    service
      .from('facilities')
      .select('id, name, address_country')
      .eq('organization_id', organizationId)
      .order('name'),
    service
      .from('ingest_jobs')
      .select('id, file_name')
      .eq('stash_path', fileId)
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  if (!attachmentResult) {
    return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
  }

  const facilities = (facilitiesResult.data ?? []) as Array<{
    id: string;
    name: string;
    address_country: string | null;
  }>;

  const job = jobResult.data as { id: string; file_name: string } | null;

  // Legacy path: a file with no ingest_jobs row (stashed before this rewire,
  // still sitting in rosa-uploads) goes straight to the Gemini fallback —
  // there is no job to classify against.
  if (!job) {
    return runGeminiFallback(attachmentResult, facilities, null);
  }

  let classified: Awaited<ReturnType<typeof classifyDocument>>;
  try {
    const orgContext = await buildIngestOrgContext(service, organizationId).catch(() => null);
    classified = await classifyDocument({
      fileBytes: attachmentResult.bytes,
      fileName: job.file_name || attachmentResult.filename,
      fileMime: attachmentResult.media_type,
      orgContext: orgContext ?? undefined,
    });
  } catch (err: any) {
    console.error('[rosa/uploads/extract] classifier failed:', err);
    await service
      .from('ingest_jobs')
      .update({ status: 'failed', error: err?.message?.slice(0, 500) || 'Classification failed', updated_at: new Date().toISOString() })
      .eq('id', job.id);
    return runGeminiFallback(attachmentResult, facilities, job.id);
  }

  const shaped = shapeIngestResult(classified.type, classified.payload, fileId, classified.meta);
  await service
    .from('ingest_jobs')
    .update({
      status: 'completed',
      phase_message: null,
      result_type: shaped.result_type,
      result_payload: shaped.result_payload,
      updated_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  // The classifier could not read this one — fall back to the old Gemini
  // pass rather than dead-ending the user (documented fallback).
  if (classified.type === 'unsupported') {
    return runGeminiFallback(attachmentResult, facilities, job.id);
  }

  const fields = mapClassifierToReview(classified.type, classified.payload);
  return NextResponse.json({
    ok: true,
    job_id: job.id,
    ...fields,
    facilities,
  });
}

/**
 * Fallback extraction via Gemini Flash vision — the pre-rewire behaviour,
 * kept for documents the shared classifier can't read and for legacy
 * (pre-rewire) attachments that have no ingest_jobs row to classify against.
 */
async function runGeminiFallback(
  attachment: NonNullable<Awaited<ReturnType<typeof loadAttachment>>>,
  facilities: Array<{ id: string; name: string; address_country: string | null }>,
  jobId: string | null,
) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json({
      ok: false,
      error: 'This document type is not supported yet. You can still send it to Rosa and ask her to read it.',
      job_id: jobId,
      facilities,
    });
  }

  const extraction = await extractStructured(
    geminiKey,
    attachment,
    [
      'document_type',
      'utility_type',
      'supplier_name',
      'account_number',
      'period_start',
      'period_end',
      'quantity_value',
      'quantity_unit',
      'total_cost',
      'currency',
      'notes',
    ],
    'utility bill, invoice, meter reading, supplier spec sheet, or LCA report',
  );

  if (!extraction.ok) {
    return NextResponse.json({ ok: false, error: extraction.error, job_id: jobId, facilities });
  }

  const data = extraction.data;
  return NextResponse.json({
    ok: true,
    job_id: jobId,
    document_type: normaliseDocumentType(String(data.document_type ?? '')),
    utility_type: normaliseUtilityType(String(data.utility_type ?? '')),
    supplier_name: data.supplier_name ?? null,
    account_number: data.account_number ?? null,
    period_start: data.period_start ?? null,
    period_end: data.period_end ?? null,
    quantity_value: data.quantity_value ?? null,
    quantity_unit: data.quantity_unit ?? null,
    total_cost: data.total_cost ?? null,
    currency: data.currency ?? null,
    notes: data.notes ?? null,
    facilities,
  });
}

function normaliseDocumentType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('utility') || lower.includes('bill') || lower.includes('electric') || lower.includes('gas') || lower.includes('water') || lower.includes('meter')) return 'utility_bill';
  if (lower.includes('invoice')) return 'invoice';
  if (lower.includes('lca') || lower.includes('life cycle')) return 'lca_report';
  if (lower.includes('supplier') || lower.includes('spec')) return 'supplier_spec';
  if (lower.includes('meter') || lower.includes('reading')) return 'meter_reading';
  return 'other';
}

function normaliseUtilityType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('electric')) return 'electricity_grid';
  if (lower.includes('gas') && !lower.includes('lpg')) return 'natural_gas';
  if (lower.includes('lpg') || lower.includes('propane')) return 'lpg';
  if (lower.includes('heat') || lower.includes('steam')) return 'heat_steam_purchased';
  if (lower.includes('water')) return 'water_intake';
  if (lower.includes('diesel') && (lower.includes('fleet') || lower.includes('vehicle') || lower.includes('mobile'))) return 'diesel_mobile';
  if (lower.includes('diesel')) return 'diesel_stationary';
  if (lower.includes('petrol') || lower.includes('gasoline')) return 'petrol_mobile';
  return '';
}
