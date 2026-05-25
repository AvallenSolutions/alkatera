import { NextResponse } from 'next/server';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { resolveOrCreateDirectoryEntry } from '@/lib/distributor/directory/matcher';
import { queueDirectoryBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';

/**
 * POST /api/admin/directory/intake/list
 *
 * Body: { lines: string[] }
 *
 * Each line is either a brand name or a URL. We resolve each one
 * against the canonical directory: exact / alias / fuzzy match → linked;
 * unmatched → fresh entry created (discovered_via='manual'). URLs land
 * with the URL stored as the website so the auto-scrape pass can fill
 * out the rest. Names land as stubs the reviewer can refine later via
 * Find Brands or document upload.
 *
 * The endpoint returns per-line resolution so the UI can show what
 * happened to each entry, plus rolled-up counts.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_LINES = 500;
const URL_PATTERN = /^https?:\/\//i;

interface ResolvedLine {
  line: string;
  status: 'linked' | 'created' | 'alkatera_linked' | 'invalid';
  brand_name: string | null;
  directory_id: string | null;
  match_via: 'exact_name' | 'alias' | 'fuzzy' | 'created' | 'alkatera_org' | null;
  error?: string;
}

export async function POST(request: Request) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  let body: { lines?: unknown };
  try {
    body = (await request.json()) as { lines?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!Array.isArray(body.lines)) {
    return NextResponse.json(
      { error: 'invalid_payload', detail: '`lines` must be a string array.' },
      { status: 400 },
    );
  }

  const lines = (body.lines as unknown[])
    .filter((l): l is string => typeof l === 'string')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_LINES);

  if (lines.length === 0) {
    return NextResponse.json(
      { error: 'no_lines', detail: 'Paste at least one brand name or URL.' },
      { status: 400 },
    );
  }

  const resolved: ResolvedLine[] = [];
  let createdCount = 0;
  let linkedCount = 0;
  let alkateraLinkedCount = 0;
  let invalidCount = 0;
  const createdDirectoryIds: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      resolved.push({
        line,
        status: 'invalid',
        brand_name: null,
        directory_id: null,
        match_via: null,
        error: 'Could not derive a brand name from this line.',
      });
      invalidCount += 1;
      continue;
    }

    try {
      const result = await resolveOrCreateDirectoryEntry(auth.service, {
        displayName: parsed.displayName,
        website: parsed.website,
        discoveredVia: 'manual',
      });
      if (result.created) {
        createdCount += 1;
        createdDirectoryIds.push(result.directoryId);
      } else {
        linkedCount += 1;
      }
      if (result.alkateraLinked) alkateraLinkedCount += 1;
      const status: ResolvedLine['status'] = result.alkateraLinked
        ? 'alkatera_linked'
        : result.created
          ? 'created'
          : 'linked';
      resolved.push({
        line,
        status,
        brand_name: result.canonicalName,
        directory_id: result.directoryId,
        match_via: result.matchVia,
      });
    } catch (err) {
      resolved.push({
        line,
        status: 'invalid',
        brand_name: null,
        directory_id: null,
        match_via: null,
        error: err instanceof Error ? err.message : String(err),
      });
      invalidCount += 1;
    }
  }

  // Auto-scrape on ingest. Best-effort — the response still goes back
  // with full per-line resolution even if the enqueue fails.
  let scrapeEnqueue = { queued: 0, skipped_no_website: 0, skipped_already_queued: 0 };
  if (createdDirectoryIds.length > 0) {
    try {
      const queued = await queueDirectoryBrandsForScraping({
        supabase: auth.service,
        brandDirectoryIds: createdDirectoryIds,
        triggeredBy: 'admin_intake',
      });
      scrapeEnqueue = {
        queued: queued.queued,
        skipped_no_website: queued.skipped_no_website,
        skipped_already_queued: queued.skipped_already_queued,
      };
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    counts: {
      total: lines.length,
      created: createdCount,
      linked: linkedCount,
      alkatera_linked: alkateraLinkedCount,
      invalid: invalidCount,
    },
    resolved,
    created_directory_ids: createdDirectoryIds,
    scrape_enqueue: scrapeEnqueue,
  });
}

interface ParsedLine {
  displayName: string;
  website: string | null;
}

function parseLine(line: string): ParsedLine | null {
  if (URL_PATTERN.test(line)) {
    try {
      const url = new URL(line);
      const host = url.hostname.replace(/^www\./i, '');
      const displayName = humaniseHost(host);
      if (!displayName) return null;
      return { displayName, website: url.toString() };
    } catch {
      return null;
    }
  }
  if (line.includes('.') && !line.includes(' ')) {
    // Bare domain like "avallenspirits.com"
    const host = line.replace(/^www\./i, '');
    const displayName = humaniseHost(host);
    if (!displayName) return null;
    return { displayName, website: `https://${host}` };
  }
  return { displayName: line, website: null };
}

function humaniseHost(host: string): string {
  const root = host.split('.')[0] ?? host;
  if (!root) return '';
  // CamelCase splits, then capitalise each token.
  return root
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}
