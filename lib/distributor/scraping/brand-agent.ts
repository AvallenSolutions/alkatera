import type { SupabaseClient } from '@supabase/supabase-js';
import { ALL_SOURCES, type BrandSnapshot, type CrawledProduct, type SourceFinding } from './sources';
import { scoreConfidence } from './confidence-scorer';
import { coerceFieldValue, type FieldKey } from './field-definitions';
import { delay } from './http';
import { recalculateCompleteness } from '../scoring/recalculate';
import { resolveOrCreateProductEntry } from '../directory/product-matcher';

const DELAY_BETWEEN_SOURCES_MS = 2_000;

export interface RunBrandAgentArgs {
  supabase: SupabaseClient;
  /**
   * Listing the scraping job belongs to. Provided for jobs enqueued via
   * the distributor scrape dispatcher (one job per listing). Used to
   * resolve the directory entry that findings attach to and to auto-
   * fill outreach_email on the listing.
   *
   * Mutually exclusive with brandDirectoryId — exactly one must be set.
   */
  brandProfileId?: string;
  /**
   * Directory entry the scraping job targets directly. Provided for
   * admin-intake jobs that have no distributor listing yet. Findings
   * attach to this entry; no outreach_email auto-fill happens.
   *
   * Mutually exclusive with brandProfileId — exactly one must be set.
   */
  brandDirectoryId?: string;
  jobId: string;
}

export interface RunBrandAgentResult {
  sources_attempted: number;
  sources_succeeded: number;
  sources_skipped: number;
  findings_written: number;
  /** Products created in product_directory during this run. */
  products_created: number;
  /** Products linked to existing product_directory rows. */
  products_linked: number;
  errors: string[];
  /** Informational, not failure: "source X skipped because Y". */
  skip_reasons: string[];
}

interface ResolvedTarget {
  brandDirectoryId: string;
  snapshot: BrandSnapshot;
  /** Present only when this run originated from a distributor listing. */
  listingId: string | null;
  /** Present only on listing-driven runs; allows outreach_email auto-fill. */
  listingHasOutreachEmail: boolean;
}

/**
 * Run every source for a single brand and persist findings. Findings
 * attach to the canonical brand_directory entry (Phase 3) so any other
 * distributor that lists the same brand benefits immediately.
 *
 * Flow:
 *   1. Resolve the snapshot from either a listing or a directory entry.
 *   2. For each source: call run(brand), wait DELAY_BETWEEN_SOURCES_MS.
 *   3. For each finding: coerce → score confidence → soft-supersede any
 *      previous winner → insert a fresh scraped_brand_data row.
 *
 * The caller (cron route) is responsible for setting job status. This
 * function just returns counts + error messages.
 */
export async function runBrandAgent(args: RunBrandAgentArgs): Promise<RunBrandAgentResult> {
  const { supabase, brandProfileId, brandDirectoryId: directIdArg, jobId } = args;

  if (!!brandProfileId === !!directIdArg) {
    return {
      sources_attempted: 0,
      sources_succeeded: 0,
      sources_skipped: 0,
      findings_written: 0,
      products_created: 0,
      products_linked: 0,
      errors: ['runBrandAgent requires exactly one of brandProfileId or brandDirectoryId'],
      skip_reasons: [],
    };
  }

  const target = brandProfileId
    ? await loadFromListing(supabase, brandProfileId)
    : await loadFromDirectory(supabase, directIdArg!);
  if (!target) {
    const ref = brandProfileId ?? directIdArg;
    return {
      sources_attempted: 0,
      sources_succeeded: 0,
      sources_skipped: 0,
      findings_written: 0,
      products_created: 0,
      products_linked: 0,
      errors: [`brand_not_found: ${ref}`],
      skip_reasons: [],
    };
  }
  const { brandDirectoryId, snapshot, listingId, listingHasOutreachEmail } = target;

  const errors: string[] = [];
  const skipReasons: string[] = [];
  const crawledProducts: CrawledProduct[] = [];
  let attempted = 0;
  let succeeded = 0;
  let skipped = 0;
  let written = 0;
  let productsCreated = 0;
  let productsLinked = 0;

  for (let i = 0; i < ALL_SOURCES.length; i++) {
    const source = ALL_SOURCES[i];
    attempted += 1;
    try {
      const result = await source.run(snapshot);
      if (result.skipped) {
        // Skips are intentional and not errors — just no data here. We
        // do still record the reason so the job log explains why this
        // source produced nothing (the brand has no website, the
        // Wikipedia page is a disambiguation, etc.).
        skipped += 1;
        skipReasons.push(`${source.name}: skipped (${result.reason ?? 'no_reason'})`);
      } else if (!result.ok) {
        errors.push(`${source.name}: ${result.reason ?? 'unknown_error'}`);
      } else {
        succeeded += 1;
        const newCount = await persistFindings(supabase, {
          brandDirectoryId,
          jobId,
          sourceName: source.name,
          sourceType: source.source_type,
          findings: result.findings,
        });
        written += newCount;
        if (result.products && result.products.length > 0) {
          crawledProducts.push(...result.products);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${source.name}: threw ${message}`);
    }
    // Be polite — even on skip — so we don't flood a single source.
    if (i < ALL_SOURCES.length - 1) {
      await delay(DELAY_BETWEEN_SOURCES_MS);
    }
  }

  // Persist crawled products into product_directory. Matcher handles
  // dedup against existing rows (by GTIN or normalised name) so repeat
  // scrapes don't fan out duplicates.
  if (crawledProducts.length > 0) {
    const seenInRun = new Set<string>();
    for (const p of crawledProducts) {
      const key = p.name.trim().toLowerCase();
      if (!key || seenInRun.has(key)) continue;
      seenInRun.add(key);
      try {
        const result = await resolveOrCreateProductEntry(supabase, {
          brandDirectoryId,
          displayName: p.name,
          category: p.category ?? null,
          discoveredVia: 'manual',
        });
        if (result.created) productsCreated += 1;
        else productsLinked += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`product_persist_failed: ${p.name}: ${message}`);
      }
    }
  }

  // Promote a scraped contact_email up onto brand_profiles.outreach_email
  // so the Phase 3 outreach dashboard can populate without manual input.
  // Only runs on listing-driven jobs (admin-intake jobs have no listing
  // to write to), and only when the listing has no outreach_email set so
  // we never overwrite a value the distributor curated.
  if (listingId && !listingHasOutreachEmail) {
    const { data: emailFinding } = await supabase
      .from('scraped_brand_data')
      .select('field_value, confidence')
      .eq('brand_directory_id', brandDirectoryId)
      .eq('field_key', 'contact_email')
      .is('superseded_by', null)
      .order('confidence', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (emailFinding?.field_value && emailFinding.confidence >= 0.5 && isEmail(emailFinding.field_value)) {
      await supabase
        .from('brand_profiles')
        .update({ outreach_email: emailFinding.field_value })
        .eq('id', listingId)
        .is('outreach_email', null);
    }
  }

  // Refresh completeness score now that scraped_brand_data may have new
  // rows. Best-effort — if the Phase 5 migration is not yet applied,
  // the call no-ops because the snapshot insert fails silently.
  try {
    await recalculateCompleteness(supabase, brandDirectoryId);
  } catch {
    // swallow — score recalculation is a follow-on, not load-bearing.
  }

  return {
    sources_attempted: attempted,
    sources_succeeded: succeeded,
    sources_skipped: skipped,
    findings_written: written,
    products_created: productsCreated,
    products_linked: productsLinked,
    errors,
    skip_reasons: skipReasons,
  };
}

async function loadFromListing(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<ResolvedTarget | null> {
  const { data: brand, error } = await supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, name, normalized_name, website, country_of_origin, category, outreach_email')
    .eq('id', brandProfileId)
    .maybeSingle();
  if (error || !brand) return null;
  const directoryId = (brand as { brand_directory_id: string }).brand_directory_id;
  if (!directoryId) return null;
  return {
    brandDirectoryId: directoryId,
    snapshot: {
      id: brand.id,
      name: brand.name,
      normalized_name: brand.normalized_name,
      website: brand.website,
      country_of_origin: brand.country_of_origin,
      category: brand.category,
    },
    listingId: brand.id,
    listingHasOutreachEmail: !!brand.outreach_email,
  };
}

async function loadFromDirectory(
  supabase: SupabaseClient,
  brandDirectoryId: string,
): Promise<ResolvedTarget | null> {
  const { data: row, error } = await supabase
    .from('brand_directory')
    .select('id, name, normalized_name, website, country_of_origin, category')
    .eq('id', brandDirectoryId)
    .maybeSingle();
  if (error || !row) return null;
  return {
    brandDirectoryId: row.id,
    snapshot: {
      id: row.id,
      name: row.name,
      normalized_name: row.normalized_name,
      website: row.website,
      country_of_origin: row.country_of_origin,
      category: row.category,
    },
    listingId: null,
    listingHasOutreachEmail: false,
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function persistFindings(
  supabase: SupabaseClient,
  args: {
    brandDirectoryId: string;
    jobId: string;
    sourceName: string;
    sourceType: 'certification_db' | 'brand_website' | 'regulatory_body' | 'company_registry' | 'other';
    findings: SourceFinding[];
  },
): Promise<number> {
  if (args.findings.length === 0) return 0;

  // Bucket by field_key so we only emit one new row per field per source
  // per run. If a source returned both a pattern_match and an llm_extract
  // for the same field, prefer pattern_match (cheaper signal, higher
  // confidence ceiling).
  const bestByField = new Map<FieldKey, SourceFinding>();
  for (const finding of args.findings) {
    const existing = bestByField.get(finding.field_key);
    if (!existing) {
      bestByField.set(finding.field_key, finding);
      continue;
    }
    const order: Record<SourceFinding['extraction_method'], number> = {
      api: 0,
      dom_parse: 1,
      pattern_match: 2,
      llm_extract: 3,
    };
    if (order[finding.extraction_method] < order[existing.extraction_method]) {
      bestByField.set(finding.field_key, finding);
    }
  }

  let written = 0;
  for (const [fieldKey, finding] of Array.from(bestByField.entries())) {
    const coerced = coerceFieldValue(fieldKey, finding.raw_value);
    if (!coerced) continue;

    const confidence = scoreConfidence(args.sourceType, finding.extraction_method);

    // Supersede any previous active row for the same brand+field+source
    // so the "current truth" view always returns one row per field.
    const { data: priors } = await supabase
      .from('scraped_brand_data')
      .select('id')
      .eq('brand_directory_id', args.brandDirectoryId)
      .eq('field_key', fieldKey)
      .eq('source_name', args.sourceName)
      .is('superseded_by', null);

    const { data: inserted, error: insertError } = await supabase
      .from('scraped_brand_data')
      .insert({
        brand_directory_id: args.brandDirectoryId,
        scraping_job_id: args.jobId,
        field_key: fieldKey,
        field_value: coerced.text,
        field_value_numeric: coerced.numeric,
        source_name: args.sourceName,
        source_url: finding.source_url,
        confidence,
        extraction_method: finding.extraction_method,
      })
      .select('id')
      .single();

    if (insertError || !inserted) continue;
    written += 1;

    if (priors && priors.length > 0) {
      const ids = priors.map((p: { id: string }) => p.id);
      await supabase
        .from('scraped_brand_data')
        .update({ superseded_by: inserted.id })
        .in('id', ids);
    }
  }

  return written;
}
