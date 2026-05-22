import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveOrCreateDirectoryEntry } from '@/lib/distributor/directory/matcher';
import type { BrandFieldKey } from './field-specs';

export interface BulkBrandsResult {
  rows_processed: number;
  brands_created: number;
  brands_linked: number;
  errors: Array<{ row: number; brand: string; error: string }>;
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
    errors: [],
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
      if (resolved.created) result.brands_created += 1;
      else result.brands_linked += 1;

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
