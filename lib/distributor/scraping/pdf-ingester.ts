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

  // Queue the processor. document_processing_jobs only has
  // brand_profile_id (now nullable post-migration); distributor_org_id
  // audit lives on the submission row alone.
  const submissionId = (submission as { id: string }).id;
  const { error: jobError } = await supabase
    .from('document_processing_jobs')
    .insert({
      submission_id: submissionId,
      brand_directory_id: brandDirectoryId,
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
    const resolved = resolveSharingUrl(url);
    const res = await fetch(resolved, {
      method: 'GET',
      signal: ctrl.signal,
      // follow: cloud-share URLs typically redirect to the actual
      // bytes; default follow-redirects=true handles this.
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
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    const looksPdf =
      contentType.includes('pdf') || contentType.includes('octet-stream') || !contentType;
    if (!looksPdf) {
      throw new Error(`unexpected_content_type:${contentType}`);
    }
    const arrayBuf = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuf);
    // Belt-and-braces: when the Content-Type isn't set explicitly,
    // sniff the magic bytes. A PDF file starts with %PDF-.
    if (!contentType && !buf.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
      throw new Error('magic_bytes_not_pdf');
    }
    return buf;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve common cloud-share sharing URLs to their direct-download
 * variants so fetch() returns the actual PDF bytes rather than an
 * HTML preview page.
 *
 * Handled:
 *   - Dropbox shared links: www.dropbox.com/scl/fi/... and the older
 *     /s/ format. Flip dl=0 → dl=1.
 *   - Google Drive sharing: drive.google.com/file/d/{id}/view →
 *     drive.google.com/uc?export=download&id={id}
 *   - OneDrive 1drv.ms / onedrive.live.com: append download=1
 *
 * Untouched: anything that already looks like a direct PDF URL.
 */
export function resolveSharingUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();

    // Dropbox
    if (host === 'www.dropbox.com' || host === 'dropbox.com') {
      // dl=1 forces a binary download. Some link patterns also accept
      // ?raw=1 — dl=1 is the most reliable for both /s/ and /scl/fi/.
      u.searchParams.set('dl', '1');
      return u.toString();
    }
    if (host === 'dl.dropboxusercontent.com') {
      // Already the direct host.
      return rawUrl;
    }

    // Google Drive
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
      if (fileMatch) {
        return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
      }
      // Already a /uc?id=… style; ensure export=download.
      if (u.pathname === '/uc' && u.searchParams.get('id')) {
        u.searchParams.set('export', 'download');
        return u.toString();
      }
    }

    // OneDrive
    if (host === 'onedrive.live.com' || host === '1drv.ms') {
      // Append download=1 — works for most "shared" OneDrive links.
      // For some links the resolved URL after a HEAD redirect is the
      // direct one; we let fetch follow redirects either way.
      u.searchParams.set('download', '1');
      return u.toString();
    }

    return rawUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * True when the URL looks like it ought to deliver a PDF, either by
 * suffix (.pdf) or by being a known cloud-share hosting service.
 * Used at the crawler + deep-enrich + dedup level — actual PDF
 * verification happens inside downloadPdf via Content-Type + magic
 * bytes.
 */
export function looksLikePdfUrl(rawUrl: string): boolean {
  if (/\.pdf(\?|#|$)/i.test(rawUrl)) return true;
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host === 'www.dropbox.com' || host === 'dropbox.com' || host === 'dl.dropboxusercontent.com') {
      // Dropbox shared links often end in the file name; if the path
      // ends in .pdf we know it's a PDF. Otherwise we'll let the
      // Content-Type check decide at download time.
      return /\.pdf$/i.test(u.pathname) || u.pathname.includes('.pdf');
    }
    if (host === 'drive.google.com' || host === 'docs.google.com') {
      // Drive sharing URLs don't reveal the file type. We accept them
      // optimistically; downloadPdf rejects non-PDF responses.
      return /\/file\/d\//.test(u.pathname) || /\/uc\b/.test(u.pathname);
    }
    if (host === 'onedrive.live.com' || host === '1drv.ms') {
      return true; // optimistic — Content-Type will gate.
    }
    return false;
  } catch {
    return false;
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
