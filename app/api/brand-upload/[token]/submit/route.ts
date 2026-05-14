import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '@/lib/supabase/api-client';
import { validateUploadToken } from '@/lib/distributor/outreach/token-validator';
import { consumeRateLimit, rateLimitKeyFromRequest } from '@/lib/distributor/outreach/rate-limit';
import {
  getOwnerEmails,
  sendDistributorNotification,
  sendSubmissionReceipt,
} from '@/lib/distributor/outreach/send';
import { getSiteUrl } from '@/lib/distributor/outreach/email-templates';

const MAX_BYTES_PER_FILE = 25 * 1024 * 1024;
const MAX_FILES_PER_SUBMISSION = 10;

const ALLOWED_DOCUMENT_TYPES = [
  'lca_report',
  'carbon_report',
  'water_usage',
  'sustainability_report',
  'packaging_data',
  'certification',
  'esg_report',
  'other',
] as const;
type DocumentType = (typeof ALLOWED_DOCUMENT_TYPES)[number];

const ALLOWED_MIME_PREFIXES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/plain',
  'image/',
];

interface FileMetadataInput {
  document_type?: string;
  vintage_year?: number | string | null;
  batch_reference?: string | null;
  /** Optional brand_skus ids that this file applies to. Empty/omitted = whole brand. */
  applied_sku_ids?: string[];
}

interface SubmissionMetadata {
  submitter_name?: string;
  submitter_email?: string;
  submitter_job_title?: string;
  notes?: string;
  files?: FileMetadataInput[];
}

/**
 * POST /api/brand-upload/[token]/submit
 *
 * Public endpoint. The brand uploader has no Supabase account so this
 * route does ALL of its work via the service-role client. The token
 * itself is the proof of authorisation — anyone with the token can
 * upload, by design.
 *
 * Body: multipart FormData containing
 *   - `metadata` field: JSON-encoded SubmissionMetadata
 *   - one or more `file{N}` fields: the actual files
 */
export async function POST(request: Request, { params }: { params: { token: string } }) {
  const limit = consumeRateLimit(`brand-upload-submit:${rateLimitKeyFromRequest(request)}`);
  if (!limit.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let supabase: SupabaseClient;
  try {
    supabase = getSupabaseAdminClient() as SupabaseClient;
  } catch {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const validation = await validateUploadToken(supabase, params.token);
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason },
      { status: validation.reason === 'expired' ? 410 : 404 },
    );
  }
  const brand = validation.brand;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form_data' }, { status: 400 });
  }

  let metadata: SubmissionMetadata = {};
  const metadataRaw = formData.get('metadata');
  if (typeof metadataRaw === 'string' && metadataRaw.length > 0) {
    try {
      metadata = JSON.parse(metadataRaw);
    } catch {
      return NextResponse.json({ error: 'invalid_metadata_json' }, { status: 400 });
    }
  }

  const submitterEmail = sanitiseEmail(metadata.submitter_email);
  const submitterName = (metadata.submitter_name ?? '').trim().slice(0, 200) || null;
  const submitterJobTitle = (metadata.submitter_job_title ?? '').trim().slice(0, 200) || null;
  const submissionNotes = (metadata.notes ?? '').trim().slice(0, 4000) || null;

  if (!submitterEmail) {
    return NextResponse.json({ error: 'submitter_email_required' }, { status: 400 });
  }
  if (!submitterName) {
    return NextResponse.json({ error: 'submitter_name_required' }, { status: 400 });
  }

  const fileFields: Array<[string, File]> = [];
  for (const [key, value] of Array.from(formData.entries())) {
    if (key === 'metadata') continue;
    if (value instanceof File) fileFields.push([key, value]);
  }
  if (fileFields.length === 0) {
    return NextResponse.json({ error: 'no_files' }, { status: 400 });
  }
  if (fileFields.length > MAX_FILES_PER_SUBMISSION) {
    return NextResponse.json(
      { error: 'too_many_files', max: MAX_FILES_PER_SUBMISSION },
      { status: 400 },
    );
  }

  const fileMeta = metadata.files ?? [];

  // Pre-fetch this brand's valid SKU IDs once so we can validate any
  // applied_sku_ids the uploader sent — we silently drop unknown IDs
  // rather than fail the whole submission.
  const { data: validSkuRows } = await supabase
    .from('brand_skus')
    .select('id')
    .eq('brand_profile_id', brand.id);
  const validSkuIds = new Set(((validSkuRows ?? []) as Array<{ id: string }>).map((r) => r.id));

  type WrittenFile = { filename: string; storage_path: string; submission_id: string };
  const written: WrittenFile[] = [];

  // Upload + insert each file. We bail on the first failure and roll
  // back already-uploaded files so the submission is all-or-nothing
  // from the brand's perspective.
  const uploadedStoragePaths: string[] = [];
  for (let i = 0; i < fileFields.length; i++) {
    const [, file] = fileFields[i];
    if (file.size > MAX_BYTES_PER_FILE) {
      await rollback(supabase, uploadedStoragePaths);
      return NextResponse.json(
        { error: 'file_too_large', file: file.name, max_bytes: MAX_BYTES_PER_FILE },
        { status: 400 },
      );
    }
    const mime = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p))) {
      await rollback(supabase, uploadedStoragePaths);
      return NextResponse.json(
        { error: 'unsupported_file_type', file: file.name, type: mime },
        { status: 400 },
      );
    }

    const docType = (fileMeta[i]?.document_type ?? 'other') as DocumentType;
    if (!ALLOWED_DOCUMENT_TYPES.includes(docType)) {
      await rollback(supabase, uploadedStoragePaths);
      return NextResponse.json(
        { error: 'invalid_document_type', file: file.name },
        { status: 400 },
      );
    }
    const vintageYear = coerceVintage(fileMeta[i]?.vintage_year);
    const batchReference = (fileMeta[i]?.batch_reference ?? '').toString().trim().slice(0, 100) || null;
    const rawAppliedSkuIds = fileMeta[i]?.applied_sku_ids;
    const appliedSkuIds = Array.isArray(rawAppliedSkuIds)
      ? rawAppliedSkuIds.filter((v): v is string => typeof v === 'string' && validSkuIds.has(v))
      : [];

    const sanitised = sanitiseFileName(file.name);
    const storagePath = `${brand.id}/${Date.now()}_${i}_${sanitised}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from('brand-documents')
      .upload(storagePath, buffer, {
        contentType: mime,
        upsert: false,
      });
    if (uploadError) {
      await rollback(supabase, uploadedStoragePaths);
      return NextResponse.json(
        { error: 'upload_failed', detail: uploadError.message },
        { status: 500 },
      );
    }
    uploadedStoragePaths.push(storagePath);

    const { data: inserted, error: insertError } = await supabase
      .from('brand_document_submissions')
      .insert({
        brand_profile_id: brand.id,
        distributor_org_id: brand.distributor_org_id,
        file_name: file.name,
        file_path: storagePath,
        file_type: mime,
        file_size_bytes: file.size,
        document_type: docType,
        vintage_year: vintageYear,
        batch_reference: batchReference,
        brand_sku_ids: appliedSkuIds,
        submitter_name: submitterName,
        submitter_email: submitterEmail,
        submitter_job_title: submitterJobTitle,
        notes: submissionNotes,
        processing_status: 'pending',
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      await rollback(supabase, uploadedStoragePaths);
      return NextResponse.json(
        { error: 'record_failed', detail: insertError?.message },
        { status: 500 },
      );
    }
    written.push({
      filename: file.name,
      storage_path: storagePath,
      submission_id: (inserted as { id: string }).id,
    });
  }

  // Queue a Phase 4 document processing job for each new submission so
  // the cron route can extract structured fields out of the file
  // contents. Best-effort — if the document_processing_jobs table is
  // not present (Phase 4 migration not yet applied), this is a no-op.
  if (written.length > 0) {
    try {
      await supabase.from('document_processing_jobs').insert(
        written.map((w) => ({
          submission_id: w.submission_id,
          brand_profile_id: brand.id,
          status: 'queued',
        })),
      );
    } catch {
      // swallow — the submission itself is durable in Storage + the
      // submissions table; the cron route is a follow-on.
    }
  }

  // Stamp brand_profiles with the submission timestamps + tier bump.
  const { data: brandRow } = await supabase
    .from('brand_profiles')
    .select('first_submission_at, alkatera_tier')
    .eq('id', brand.id)
    .maybeSingle();
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = { last_submission_at: nowIso };
  if (!brandRow?.first_submission_at) update.first_submission_at = nowIso;
  if (brandRow?.alkatera_tier === 1) update.alkatera_tier = 2;
  await supabase.from('brand_profiles').update(update).eq('id', brand.id);

  // Best-effort notifications. We never block the success response on
  // these — the data is safely in Storage either way.
  void sendSubmissionReceipt(submitterEmail, {
    brandName: brand.name,
    distributorName: (await supabase
      .from('distributor_organizations')
      .select('name')
      .eq('id', brand.distributor_org_id)
      .maybeSingle()).data?.name ?? 'your distributor',
    submitterName: submitterName ?? 'there',
    fileNames: written.map((w) => w.filename),
  }).catch(() => undefined);

  void notifyDistributorOwners(supabase, brand.distributor_org_id, {
    brandName: brand.name,
    submitterName: submitterName ?? 'a representative',
    submitterEmail,
    fileCount: written.length,
    brandDetailUrl: `${getSiteUrl()}/distributor/brands/${brand.id}`,
  }).catch(() => undefined);

  return NextResponse.json({ success: true, submission_count: written.length });
}

async function notifyDistributorOwners(
  supabase: SupabaseClient,
  distributorOrgId: string,
  args: {
    brandName: string;
    submitterName: string;
    submitterEmail: string;
    fileCount: number;
    brandDetailUrl: string;
  },
) {
  const recipients = await getOwnerEmails(supabase, distributorOrgId);
  if (recipients.length === 0) return;
  const { data: distributor } = await supabase
    .from('distributor_organizations')
    .select('name')
    .eq('id', distributorOrgId)
    .maybeSingle();
  await sendDistributorNotification(recipients, {
    ...args,
    distributorName: distributor?.name ?? 'your distributor',
  });
}

async function rollback(supabase: SupabaseClient, storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  try {
    await supabase.storage.from('brand-documents').remove(storagePaths);
  } catch {
    // best-effort
  }
}

function sanitiseFileName(name: string): string {
  return name
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 100);
}

function sanitiseEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed.slice(0, 200);
}

function coerceVintage(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1700 || n > 2200) return null;
  return n;
}
