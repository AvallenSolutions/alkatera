import type { SupabaseClient } from '@supabase/supabase-js';
import type { CrawledDocument, CrawledDocumentKind } from './sources';

const MAX_PDF_BYTES = 25 * 1024 * 1024; // 25 MB — matches the brand-documents bucket limit.
const FETCH_TIMEOUT_MS = 30_000;
const STORAGE_BUCKET = 'brand-documents';

interface IngestArgs {
  supabase: SupabaseClient; // must be a service-role client.
  brandDirectoryId: string;
  /** Provide when the scrape came from a distributor listing so the
   *  submission carries audit metadata. Null for admin-intake jobs. */
  distributorOrgId: string | null;
  document: CrawledDocument;
}

export interface IngestResult {
  ingested: boolean;
  /** Reason we skipped (already-have, too-big, fetch-failed). */
  skipped_reason?: string;
  /** Non-fatal error to bubble back to the agent for logging. */
  error?: string;
  submission_id?: string;
}

/**
 * Download a discovered PDF, upload to the brand-documents bucket, and
 * create a submission + processing job that the existing doc-processor
 * cron picks up.
 *
 * Deduped by (brand_directory_id, file_name) — file_name is the
 * absolute URL of the source PDF, so re-scraping the same brand won't
 * re-ingest the same document. We deliberately key on the URL (not the
 * downloaded bytes) to keep the dedup cheap and to avoid re-downloading
 * the file just to compute a hash.
 */
export async function ingestDiscoveredPdf(args: IngestArgs): Promise<IngestResult> {
  const { supabase, brandDirectoryId, distributorOrgId, document } = args;

  // Already-have check: if a submission exists for this URL on this
  // brand, skip. file_name carries the URL for auto_scrape submissions.
  const { data: existing } = await supabase
    .from('brand_document_submissions')
    .select('id')
    .eq('brand_directory_id', brandDirectoryId)
    .eq('file_name', document.url)
    .eq('submission_source', 'auto_scrape')
    .maybeSingle();
  if (existing) {
    return { ingested: false, skipped_reason: 'already_ingested' };
  }

  // Download with timeout + size cap.
  let buffer: Buffer;
  try {
    buffer = await downloadPdf(document.url);
  } catch (err: unknown) {
    return {
      ingested: false,
      skipped_reason: 'fetch_failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
  if (buffer.length === 0) {
    return { ingested: false, skipped_reason: 'empty_body' };
  }
  if (buffer.length > MAX_PDF_BYTES) {
    return { ingested: false, skipped_reason: 'too_large' };
  }

  // Upload to storage at auto/{directory}/{timestamp}-{kind}.pdf.
  const filePath = buildStoragePath(brandDirectoryId, document);
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
  if (uploadError) {
    return {
      ingested: false,
      skipped_reason: 'upload_failed',
      error: uploadError.message,
    };
  }

  // Insert the submission row. file_name carries the source URL so the
  // dedup check above can find it on the next pass.
  const documentType = mapKindToDocumentType(document.kind);
  const { data: submission, error: subError } = await supabase
    .from('brand_document_submissions')
    .insert({
      brand_directory_id: brandDirectoryId,
      distributor_org_id: distributorOrgId,
      submission_source: 'auto_scrape',
      file_name: document.url,
      file_path: filePath,
      file_type: 'application/pdf',
      file_size_bytes: buffer.length,
      document_type: documentType,
      notes: `Discovered on ${document.source_url}; classified as ${document.kind}.`,
      processing_status: 'pending',
    })
    .select('id')
    .single();
  if (subError || !submission) {
    // Best-effort cleanup — leave the orphan blob behind rather than
    // double-failing if storage.delete also errors.
    await supabase.storage.from(STORAGE_BUCKET).remove([filePath]).catch(() => undefined);
    return {
      ingested: false,
      skipped_reason: 'submission_insert_failed',
      error: subError?.message ?? 'no_row_returned',
    };
  }

  // Queue the processor.
  const submissionId = (submission as { id: string }).id;
  const { error: jobError } = await supabase
    .from('document_processing_jobs')
    .insert({
      submission_id: submissionId,
      brand_directory_id: brandDirectoryId,
      distributor_org_id: distributorOrgId,
      brand_profile_id: null,
      status: 'queued',
    });
  if (jobError) {
    return {
      ingested: true,
      submission_id: submissionId,
      error: `job_insert_failed: ${jobError.message}`,
    };
  }

  return { ingested: true, submission_id: submissionId };
}

async function downloadPdf(url: string): Promise<Buffer> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: ctrl.signal,
      headers: {
        // Generic UA to discourage 403s from sites that block obvious
        // bots. We're not hiding what we are — we just need text PDFs.
        'User-Agent':
          'Mozilla/5.0 (compatible; alkatera-directory-bot/1.0; +https://www.alkatera.com)',
        Accept: 'application/pdf,*/*;q=0.8',
      },
    });
    if (!res.ok) {
      throw new Error(`http_${res.status}`);
    }
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType && !contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      throw new Error(`unexpected_content_type:${contentType}`);
    }
    // Size cap is enforced after read. Streaming with a hard byte cap
    // would be ideal but the small extra work doesn't justify the
    // additional code path for the URLs we'd encounter.
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } finally {
    clearTimeout(timeout);
  }
}

function buildStoragePath(brandDirectoryId: string, document: CrawledDocument): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safeKind = document.kind.replace(/[^a-zA-Z0-9_-]/g, '');
  return `auto/${brandDirectoryId}/${ts}-${safeKind}.pdf`;
}

function mapKindToDocumentType(kind: CrawledDocumentKind): string {
  // The submissions table CHECK constraint accepts:
  //   'lca_report','carbon_report','water_usage','sustainability_report',
  //   'packaging_data','certification','esg_report','other'
  switch (kind) {
    case 'epd':
      return 'lca_report';
    case 'lca':
      return 'lca_report';
    case 'sustainability_report':
      return 'sustainability_report';
    case 'datasheet':
      return 'other';
    default:
      return 'other';
  }
}
