import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { validateUploadToken } from '@/lib/distributor/outreach/token-validator';
import { consumeRateLimit, rateLimitKeyFromRequest } from '@/lib/distributor/outreach/rate-limit';
import {
  coerceFieldValue,
  getFieldDefinition,
  type FieldKey,
} from '@/lib/distributor/scraping/field-definitions';
import { getFieldLabel } from '@/lib/distributor/scraping/field-labels';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

const ALLOWED_METHODS = ['confirmed', 'corrected'] as const;
type VerificationMethod = (typeof ALLOWED_METHODS)[number];

const ALLOWED_EVIDENCE_DOC_TYPES = ['certification', 'sustainability_report'] as const;
const MAX_EVIDENCE_BYTES = 25 * 1024 * 1024;
const ALLOWED_EVIDENCE_MIME_PREFIXES = [
  'application/pdf',
  'image/',
];

interface VerificationInput {
  field_key?: string;
  brand_sku_id?: string | null;
  value?: unknown;
  verification_method?: string;
}

interface VerifyPayload {
  verified_by_name?: string;
  verified_by_email?: string;
  verifications?: VerificationInput[];
}

interface VerificationResult {
  field_key: FieldKey;
  brand_sku_id: string | null;
  verification_method: VerificationMethod;
  ok: boolean;
  scraped_id?: string;
  error?: string;
}

interface ProcessContext {
  supabase: SupabaseClient;
  brandId: string;
  distributorOrgId: string;
  validSkuIds: Set<string>;
  verifiedByName: string;
  verifiedByEmail: string;
}

/**
 * POST /api/brand-upload/[token]/verify
 *
 * Public endpoint. Two callable shapes:
 *
 *   1. application/json — bulk path. Body is { verified_by_name,
 *      verified_by_email, verifications: [...] }. No file uploads.
 *
 *   2. multipart/form-data — single-verification-with-evidence path.
 *      Fields: verified_by_name, verified_by_email, verification (JSON
 *      string of one VerificationInput), and an optional `file` field
 *      with a PDF / image. Used by the inline evidence upload on
 *      certification fields (B Corp, Carbon Trust, ISO, Fairtrade etc).
 *      When a file is present we upload it to Storage, insert a
 *      brand_document_submissions row tagged with the originating
 *      field, and queue a document_processing_job — the same pipeline
 *      the bulk upload path uses.
 *
 * Both paths supersede prior brand_verified rows in the same (brand,
 * sku, field) scope and trigger one scoring recalc at the end so the
 * distributor view reflects the new truth.
 */
export async function POST(request: Request, { params }: { params: { token: string } }) {
  const limit = consumeRateLimit(`brand-upload-verify:${rateLimitKeyFromRequest(request)}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdminClient() as SupabaseClient;
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const result = await validateUploadToken(supabase, params.token);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason },
      { status: result.reason === 'expired' ? 410 : 404 },
    );
  }
  const brand = result.brand;

  const contentType = request.headers.get('content-type') ?? '';
  const isMultipart = contentType.startsWith('multipart/form-data');

  let parsed:
    | { verifiedByName: string; verifiedByEmail: string; verifications: VerificationInput[]; file: File | null }
    | { error: string; status: number };

  try {
    parsed = isMultipart ? await parseMultipart(request) : await parseJson(request);
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const { verifiedByName, verifiedByEmail, verifications, file } = parsed;

  const validSkuIds = await loadValidSkuIds(supabase, brand.id);
  const ctx: ProcessContext = {
    supabase,
    brandId: brand.id,
    distributorOrgId: brand.distributor_org_id,
    validSkuIds,
    verifiedByName,
    verifiedByEmail,
  };

  const results: VerificationResult[] = [];
  for (const v of verifications) {
    results.push(await applyVerification(ctx, v));
  }

  // Attach evidence to the first successful verification, if a file came along.
  if (file) {
    const first = results.find((r) => r.ok && r.scraped_id);
    if (!first) {
      return NextResponse.json({
        ok: false,
        results,
        error: 'no_successful_verification_for_evidence',
      }, { status: 400 });
    }
    const evidenceResult = await attachEvidence(ctx, first, file);
    if (!evidenceResult.ok) {
      return NextResponse.json({
        ok: true,
        results,
        evidence: { ok: false, error: evidenceResult.error },
      });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  if (successCount > 0) {
    try {
      await recalculateCompleteness(supabase, brand.id);
    } catch {
      // Recalc is best-effort.
    }
  }

  return NextResponse.json({ ok: successCount > 0, results });
}

async function parseJson(request: Request): Promise<{
  verifiedByName: string;
  verifiedByEmail: string;
  verifications: VerificationInput[];
  file: null;
} | { error: string; status: number }> {
  const payload = (await request.json()) as VerifyPayload;
  const verifiedByName = (payload.verified_by_name ?? '').trim();
  const verifiedByEmail = (payload.verified_by_email ?? '').trim();
  if (verifiedByName.length < 2) return { error: 'missing_verified_by_name', status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedByEmail)) {
    return { error: 'invalid_verified_by_email', status: 400 };
  }
  const verifications = Array.isArray(payload.verifications) ? payload.verifications : [];
  if (verifications.length === 0) return { error: 'no_verifications', status: 400 };
  if (verifications.length > 50) return { error: 'too_many_verifications', status: 400 };
  return { verifiedByName, verifiedByEmail, verifications, file: null };
}

async function parseMultipart(request: Request): Promise<{
  verifiedByName: string;
  verifiedByEmail: string;
  verifications: VerificationInput[];
  file: File | null;
} | { error: string; status: number }> {
  const fd = await request.formData();
  const verifiedByName = ((fd.get('verified_by_name') as string | null) ?? '').trim();
  const verifiedByEmail = ((fd.get('verified_by_email') as string | null) ?? '').trim();
  if (verifiedByName.length < 2) return { error: 'missing_verified_by_name', status: 400 };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(verifiedByEmail)) {
    return { error: 'invalid_verified_by_email', status: 400 };
  }

  const verificationRaw = fd.get('verification');
  if (typeof verificationRaw !== 'string' || !verificationRaw.length) {
    return { error: 'missing_verification', status: 400 };
  }
  let verification: VerificationInput;
  try {
    verification = JSON.parse(verificationRaw) as VerificationInput;
  } catch {
    return { error: 'invalid_verification_json', status: 400 };
  }

  const fileEntry = fd.get('file');
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  return {
    verifiedByName,
    verifiedByEmail,
    verifications: [verification],
    file,
  };
}

async function applyVerification(
  ctx: ProcessContext,
  v: VerificationInput,
): Promise<VerificationResult> {
  const fieldKey = (v.field_key ?? '') as FieldKey;
  const def = getFieldDefinition(fieldKey);
  const skuId = v.brand_sku_id ?? null;
  const method = v.verification_method as VerificationMethod;
  const base: VerificationResult = {
    field_key: fieldKey,
    brand_sku_id: skuId,
    verification_method: method ?? 'corrected',
    ok: false,
  };

  if (!def) return { ...base, error: 'unknown_field_key' };
  if (!ALLOWED_METHODS.includes(method)) return { ...base, error: 'invalid_verification_method' };
  if (skuId !== null && !ctx.validSkuIds.has(skuId)) {
    return { ...base, error: 'invalid_brand_sku_id' };
  }

  const coerced = coerceFieldValue(fieldKey, v.value);
  if (coerced === null) return { ...base, error: 'invalid_value' };

  const priorQuery = ctx.supabase
    .from('scraped_brand_data')
    .select('id')
    .eq('brand_profile_id', ctx.brandId)
    .eq('field_key', fieldKey)
    .eq('source_name', 'brand_verified')
    .is('superseded_by', null);
  if (skuId === null) {
    priorQuery.is('brand_sku_id', null);
  } else {
    priorQuery.eq('brand_sku_id', skuId);
  }
  const { data: prior } = await priorQuery;

  const { data: inserted, error: insertError } = await ctx.supabase
    .from('scraped_brand_data')
    .insert({
      brand_profile_id: ctx.brandId,
      brand_sku_id: skuId,
      scraping_job_id: null,
      field_key: fieldKey,
      field_value: coerced.text,
      field_value_numeric: coerced.numeric,
      source_name: 'brand_verified',
      source_url: null,
      confidence: 1.0,
      extraction_method: 'brand_verified',
      verified_by_name: ctx.verifiedByName,
      verified_by_email: ctx.verifiedByEmail,
      verification_method: method,
    })
    .select('id')
    .single();

  if (insertError || !inserted) return { ...base, error: 'insert_failed' };
  const scrapedId = (inserted as { id: string }).id;

  if (prior && prior.length > 0) {
    const priorIds = (prior as Array<{ id: string }>).map((r) => r.id);
    await ctx.supabase
      .from('scraped_brand_data')
      .update({ superseded_by: scrapedId })
      .in('id', priorIds);
  }

  return { ...base, ok: true, scraped_id: scrapedId };
}

async function attachEvidence(
  ctx: ProcessContext,
  verification: VerificationResult,
  file: File,
): Promise<{ ok: true; submission_id: string } | { ok: false; error: string }> {
  const fieldLabel = getFieldLabel(verification.field_key);
  if (!fieldLabel?.acceptsEvidence) {
    return { ok: false, error: 'field_does_not_accept_evidence' };
  }

  if (file.size > MAX_EVIDENCE_BYTES) {
    return { ok: false, error: 'file_too_large' };
  }
  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_EVIDENCE_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
    return { ok: false, error: 'unsupported_file_type' };
  }
  const docType = fieldLabel.evidenceDocumentType ?? 'certification';
  if (!ALLOWED_EVIDENCE_DOC_TYPES.includes(docType)) {
    return { ok: false, error: 'invalid_document_type' };
  }

  const sanitised = sanitiseFileName(file.name);
  const storagePath = `${ctx.brandId}/evidence/${Date.now()}_${verification.field_key}_${sanitised}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await ctx.supabase.storage
    .from('brand-documents')
    .upload(storagePath, buffer, { contentType: mime, upsert: false });
  if (uploadError) return { ok: false, error: 'upload_failed' };

  const skuIds = verification.brand_sku_id ? [verification.brand_sku_id] : [];
  const { data: submission, error: submissionError } = await ctx.supabase
    .from('brand_document_submissions')
    .insert({
      brand_profile_id: ctx.brandId,
      distributor_org_id: ctx.distributorOrgId,
      file_name: file.name,
      file_path: storagePath,
      file_type: mime,
      file_size_bytes: file.size,
      document_type: docType,
      vintage_year: null,
      batch_reference: null,
      brand_sku_ids: skuIds,
      submitter_name: ctx.verifiedByName,
      submitter_email: ctx.verifiedByEmail,
      submitter_job_title: null,
      notes: `Evidence for "${fieldLabel.label}" attached during inline verification.`,
      processing_status: 'pending',
    })
    .select('id')
    .single();
  if (submissionError || !submission) {
    // Roll back the storage upload so we don't leave orphan files.
    await ctx.supabase.storage.from('brand-documents').remove([storagePath]).catch(() => undefined);
    return { ok: false, error: 'submission_failed' };
  }
  const submissionId = (submission as { id: string }).id;

  try {
    await ctx.supabase.from('document_processing_jobs').insert({
      submission_id: submissionId,
      brand_profile_id: ctx.brandId,
      status: 'queued',
    });
  } catch {
    // Phase 4 may not have its table yet; best-effort.
  }

  return { ok: true, submission_id: submissionId };
}

async function loadValidSkuIds(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from('brand_skus')
    .select('id')
    .eq('brand_profile_id', brandProfileId);
  return new Set(((data ?? []) as Array<{ id: string }>).map((r) => r.id));
}

function sanitiseFileName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}
