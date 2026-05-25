import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOrCreateDirectoryEntry } from '@/lib/distributor/directory/matcher';
import { queueDirectoryBrandsForScraping } from '@/lib/distributor/scraping/agent-dispatcher';
import type { BrandFieldKey } from './field-specs';

export interface BulkBrandsResult {
  rows_processed: number;
  brands_created: number;
  brands_linked: number;
  /**
   * Rows that resolved via the alkatera-org fallback — either reused an
   * existing alkatera-linked directory row, or minted one tied to the
   * matched org. Counted in addition to brands_linked / brands_created
   * so the admin sees how often the second matcher pass saved a dupe.
   */
  brands_alkatera_linked: number;
  errors: Array<{ row: number; brand: string; error: string }>;
  /** Directory IDs that were freshly created by this run. */
  created_directory_ids: string[];
  /** Outcome of the auto-scrape enqueue pass (best-effort). */
  scrape_enqueue: {
    queued: number;
    skipped_no_website: number;
    skipped_already_queued: number;
  };
}

interface Args {
  service: SupabaseClient;
  rows: Record<string, string>[];
  mapping: Partial<Record<BrandFieldKey, string>>;
}

/**
 * Walk an admin-uploaded brand CSV and seed the canonical
 * `brand_directory`. Each row is resolved via the existing matcher:
 *   - exact / fuzzy name match → returns the existing directory id;
 *     missing optional columns are filled but populated columns are
 *     never overwritten.
 *   - no match → creates a fresh entry with `discovered_via='manual'`.
 *
 * Aliases (semicolon-separated) are appended idempotently.
 */
export async function processBulkBrands(args: Args): Promise<BulkBrandsResult> {
  const { service, rows, mapping } = args;
  const result: BulkBrandsResult = {
    rows_processed: 0,
    brands_created: 0,
    brands_linked: 0,
    brands_alkatera_linked: 0,
    errors: [],
    created_directory_ids: [],
    scrape_enqueue: { queued: 0, skipped_no_website: 0, skipped_already_queued: 0 },
  };

  if (!mapping.name) {
    result.errors.push({ row: 0, brand: '', error: 'name column not mapped' });
    return result;
  }

  // Track seen normalised names so the same row repeated in the CSV
  // doesn't double-count.
  const seen = new Set<string>();

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const name = (row[mapping.name] ?? '').trim();
    if (!name) {
      result.errors.push({ row: i + 2, brand: '', error: 'missing brand name' });
      continue;
    }
    result.rows_processed += 1;

    const website = pick(row, mapping.website);
    const category = pick(row, mapping.category);
    const country = pick(row, mapping.country_of_origin);
    const foundingYearRaw = pick(row, mapping.founding_year);
    const parentCompany = pick(row, mapping.parent_company);
    const description = pick(row, mapping.description);
    const aliasesRaw = pick(row, mapping.aliases);

    const foundingYear = parseInt(foundingYearRaw ?? '', 10);

    try {
      const resolved = await resolveOrCreateDirectoryEntry(service, {
        displayName: name,
        website,
        category,
        countryOfOrigin: country,
        discoveredByDistributorOrgId: null,
        discoveredVia: 'manual',
      });
      if (resolved.created) {
        result.brands_created += 1;
        result.created_directory_ids.push(resolved.directoryId);
      } else {
        result.brands_linked += 1;
      }
      if (resolved.alkateraLinked) {
        result.brands_alkatera_linked += 1;
      }

      // Fill optional columns, never overwrite an existing populated value.
      const fill: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (foundingYear && Number.isFinite(foundingYear)) fill.founding_year = foundingYear;
      if (parentCompany) fill.parent_company = parentCompany;
      if (description && description.length > 0) fill.description = description;
      // Pull the current row so we know which columns are already filled.
      const { data: current } = await service
        .from('brand_directory')
        .select('founding_year, parent_company, description, aliases')
        .eq('id', resolved.directoryId)
        .maybeSingle();
      const cur = current as {
        founding_year: number | null;
        parent_company: string | null;
        description: string | null;
        aliases: string[] | null;
      } | null;
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (cur?.founding_year == null && foundingYear && Number.isFinite(foundingYear)) {
        patch.founding_year = foundingYear;
      }
      if (cur?.parent_company == null && parentCompany) {
        patch.parent_company = parentCompany;
      }
      if ((cur?.description == null || cur.description.length === 0) && description) {
        patch.description = description;
      }
      const aliasesToAdd = parseAliases(aliasesRaw, cur?.aliases ?? []);
      if (aliasesToAdd.length > 0) {
        patch.aliases = [...(cur?.aliases ?? []), ...aliasesToAdd];
      }
      if (Object.keys(patch).length > 1) {
        await service.from('brand_directory').update(patch).eq('id', resolved.directoryId);
      }

      // Dedup within the upload.
      const norm = name.toLowerCase().trim();
      if (seen.has(norm)) {
        result.brands_linked += 0; // intentional no-op — count was already booked
      }
      seen.add(norm);
    } catch (err) {
      result.errors.push({
        row: i + 2,
        brand: name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Auto-scrape: kick the brand-website source against every newly
  // created entry that has a website. The reviewer's queue gets richer
  // data without a second click. Failures here are non-fatal — the
  // ingest result still returns; admins can hand-trigger later.
  if (result.created_directory_ids.length > 0) {
    try {
      const queued = await queueDirectoryBrandsForScraping({
        supabase: service,
        brandDirectoryIds: result.created_directory_ids,
        triggeredBy: 'admin_intake',
      });
      result.scrape_enqueue = {
        queued: queued.queued,
        skipped_no_website: queued.skipped_no_website,
        skipped_already_queued: queued.skipped_already_queued,
      };
    } catch {
      // best-effort
    }
  }

  return result;
}

function pick(
  row: Record<string, string>,
  column: string | undefined,
): string | null {
  if (!column) return null;
  const v = (row[column] ?? '').trim();
  return v ? v : null;
}

function parseAliases(raw: string | null, existing: string[]): string[] {
  if (!raw) return [];
  const parts = raw
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  const existingSet = new Set(existing.map((a) => a.toLowerCase()));
  const out: string[] = [];
  for (const p of parts) {
    const lower = p.toLowerCase();
    if (existingSet.has(lower)) continue;
    existingSet.add(lower);
    out.push(p);
  }
  return out;
}
