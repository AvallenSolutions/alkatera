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

// Keywords that mark an anchor as a sustainability-relevant document.
// Mirrors brand-website.ts's list — kept in sync so deep-enrich's
// post-Claude landing-page crawl recognises the same docs as the
// initial site scrape would.
const SUSTAINABILITY_PDF_KEYWORDS = [
  'epd',
  'environmental product declaration',
  'lca',
  'life cycle assessment',
  'life-cycle assessment',
  'sustainability report',
  'sustainability-report',
  'esg report',
  'esg-report',
  'impact report',
  'impact-report',
  'carbon report',
  'carbon-footprint',
  'b corp impact',
  'carbon negative',
  'carbon-negative',
];

/**
 * Fetch a landing-page URL and extract every link that looks like a
 * sustainability document (EPD / LCA / sustainability report / etc.).
 *
 * Claude's web_search tool can find the URL of a sustainability page
 * (e.g. twodriftersrum.com/pages/sustainability-report) but it doesn't
 * crawl the page itself, so the actual PDF links on that page never
 * make it into the deep_enrich result. This helper closes that gap:
 * deep-enrich persistence calls it for any "document" URL Claude
 * returned that isn't itself a direct PDF, and the discovered PDFs
 * (including Dropbox / Drive / OneDrive sharing links) flow into the
 * existing ingester just like crawler-discovered ones.
 *
 * Returns at most `maxLinks` documents (default 12) so a single page
 * with hundreds of anchors can't queue an unbounded batch of fetches.
 */
export async function discoverPdfsAtLandingPage(
  url: string,
  maxLinks = 12,
): Promise<CrawledDocument[]> {
  const { fetchPage } = await import('./http');
  const res = await fetchPage(url);
  if (!res.ok || !res.body) return [];
  const html = res.body;
  const candidates = new Map<string, { url: string; anchorText: string }>();
  const anchorRegex = /<a\b[^>]*href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorRegex.exec(html))) {
    const rawHref = decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? '');
    if (!rawHref) continue;
    const resolved = resolveRelativeUrl(rawHref, res.url);
    if (!resolved) continue;
    const anchorText = stripTags(match[4] ?? '').replace(/\s+/g, ' ').trim();
    // Hard gate on the URL: must be a direct .pdf URL or a known
    // cloud-share host (Dropbox / Drive / OneDrive). Anchor-text
    // keywords ("Carbon Negative", "Impact Report") are too eagerly
    // shared with non-PDF page navigation, so we don't use them as
    // sufficient signal here — Two Drifters' page links its own
    // /pages/carbon-negative HTML route with that anchor text, which
    // we don't want to ingest as a PDF.
    if (!looksLikePdfUrl(resolved)) continue;
    // Suppress same-page self-links and the obvious sibling Shopify
    // /pages/* HTML routes (caught defensively even though the URL
    // gate above already filters them — costs nothing).
    if (resolved.toLowerCase() === url.toLowerCase()) continue;
    const key = resolved.toLowerCase();
    if (candidates.has(key)) continue;
    candidates.set(key, { url: resolved, anchorText });
    if (candidates.size >= maxLinks) break;
  }
  const out: CrawledDocument[] = [];
  for (const c of Array.from(candidates.values())) {
    const kind = classifyDocumentKind(`${c.anchorText} ${c.url}`);
    if (!kind) continue;
    out.push({
      url: c.url,
      anchor_text: c.anchorText || c.url,
      kind,
      source_url: url,
    });
  }
  return out;
}

function classifyDocumentKind(haystackRaw: string): CrawledDocumentKind | null {
  const h = haystackRaw.toLowerCase();
  if (/(\bepd\b|environmental[- ]product[- ]declaration)/.test(h)) return 'epd';
  if (/(\blca\b|life[- ]cycle[- ]assessment)/.test(h)) return 'lca';
  if (/(sustainability[- ]report|impact[- ]report|esg[- ]report|carbon[- ]report|b[- ]corp[- ]impact)/.test(h)) {
    return 'sustainability_report';
  }
  if (/(datasheet|data[- ]sheet|technical[- ]sheet|product[- ]sheet|spec[- ]sheet)/.test(h)) {
    return 'datasheet';
  }
  for (const keyword of SUSTAINABILITY_PDF_KEYWORDS) {
    if (h.includes(keyword)) return 'other';
  }
  return null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '');
}

/** Decode the small set of HTML entities that commonly appear in
 *  hrefs. The big one is &amp; → & — Dropbox sharing links use multiple
 *  query params separated by &, which gets HTML-escaped in the page
 *  source. Without this, fetch() would call the URL with literal
 *  "&amp;" in the query string and the server would return 400. */
function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function resolveRelativeUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
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
