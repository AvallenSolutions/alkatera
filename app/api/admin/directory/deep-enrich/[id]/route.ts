import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import {
  resolveOrCreateProductEntrySmart,
  clearProductDedupCache,
} from '@/lib/distributor/directory/product-dedup';
import {
  discoverPdfsAtLandingPage,
  ingestDiscoveredPdf,
  looksLikePdfUrl,
} from '@/lib/distributor/scraping/pdf-ingester';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';
import {
  dedupeAgainstExisting,
  type DeepEnrichResult,
  type EnrichedAward,
  type EnrichedCredential,
  type EnrichedProduct,
} from '@/lib/admin/sourcing/deep-enrich';

/**
 * GET /api/admin/directory/deep-enrich/[id]
 *
 * Poll endpoint for an async deep-enrich job. Mirrors the sourcing
 * pattern (POST returns jobId, this route advances state on each
 * poll). When the background fn finishes the Claude call we see
 * status='searched' here and run the persistence pipeline:
 *   - brand_directory column patch (coalesce(new, existing))
 *   - credentials → scraped_brand_data with source 'admin_deep_enrich'
 *   - products via smart matcher (LLM dedup against existing rows)
 *   - PDFs via the existing ingester
 *   - completeness recalc
 *
 * Persistence happens here (not in the bg fn) because the bulk
 * processors + matchers use the `@/` alias which Netlify's lambda
 * zipper doesn't bundle reliably — same constraint as sourcing.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const SOURCE_NAME = 'admin_deep_enrich';
const CREDENTIAL_CONFIDENCE = 0.85;

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: jobRow } = await auth.service
    .from('deep_enrich_jobs')
    .select('id, brand_directory_id, status, phase_message, enriched, result, error')
    .eq('id', params.id)
    .maybeSingle();
  if (!jobRow) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const job = jobRow as {
    id: string;
    brand_directory_id: string;
    status: string;
    phase_message: string | null;
    enriched: DeepEnrichResult | null;
    result: Record<string, unknown> | null;
    error: string | null;
  };

  if (job.status === 'searched') {
    // Atomic claim → only one poll runs the ingest.
    const { data: claimed } = await auth.service
      .from('deep_enrich_jobs')
      .update({ status: 'ingesting', phase_message: 'Persisting findings…' })
      .eq('id', job.id)
      .eq('status', 'searched')
      .select('id');
    if (Array.isArray(claimed) && claimed.length === 1 && job.enriched) {
      const result = await persistEnriched(auth.service, job.brand_directory_id, job.enriched);
      await auth.service
        .from('deep_enrich_jobs')
        .update({
          status: 'done',
          phase_message: null,
          result,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
      return NextResponse.json({ status: 'done', result });
    }
    // Another poll claimed it — return current state.
  }

  return NextResponse.json({
    status: job.status,
    phase_message: job.phase_message,
    result: job.result,
    error: job.error,
  });
}

interface IngestSummary {
  summary: string | null;
  brand: { fields_updated: number; patch: Record<string, unknown> };
  credentials: { written: number; errors: string[] };
  products: {
    created: number;
    linked: number;
    skipped_by_dedup: number;
    errors: string[];
  };
  documents: {
    ingested: number;
    skipped: number;
    landing_pages_crawled: Array<{ landingUrl: string; foundCount: number }>;
    details: Array<{ url: string; status: string; reason?: string }>;
  };
  awards: { added: number; existing: number; errors: string[] };
  notable_facts: { added: number; existing: number };
  enrich_error: string | null;
}

async function persistEnriched(
  service: SupabaseClient,
  brandDirectoryId: string,
  enriched: DeepEnrichResult,
): Promise<IngestSummary> {
  // ── 1. Load the directory row so we know which columns are empty. ──
  const { data: brand } = await service
    .from('brand_directory')
    .select('id, name, website, country_of_origin, category, founding_year, parent_company, description, alkatera_org_id')
    .eq('id', brandDirectoryId)
    .maybeSingle();
  const directory = (brand ?? {}) as {
    name?: string;
    website?: string | null;
    country_of_origin?: string | null;
    category?: string | null;
    founding_year?: number | null;
    parent_company?: string | null;
    description?: string | null;
  };

  const brandPatch: Record<string, unknown> = {};
  if (!directory.description && enriched.brand.description) {
    brandPatch.description = enriched.brand.description;
  }
  if (!directory.category && enriched.brand.category) {
    brandPatch.category = enriched.brand.category;
  }
  if (!directory.country_of_origin && enriched.brand.country_of_origin) {
    brandPatch.country_of_origin = enriched.brand.country_of_origin;
  }
  if (!directory.founding_year && enriched.brand.founding_year) {
    brandPatch.founding_year = enriched.brand.founding_year;
  }
  if (!directory.parent_company && enriched.brand.parent_company) {
    brandPatch.parent_company = enriched.brand.parent_company;
  }
  if (!directory.website && enriched.brand.website) {
    brandPatch.website = enriched.brand.website;
  }
  let brandFieldsUpdated = 0;
  if (Object.keys(brandPatch).length > 0) {
    brandPatch.updated_at = new Date().toISOString();
    const { error } = await service
      .from('brand_directory')
      .update(brandPatch)
      .eq('id', brandDirectoryId);
    if (!error) brandFieldsUpdated = Object.keys(brandPatch).length - 1;
  }

  // ── 2. Credentials → scraped_brand_data. ──
  let credentialsWritten = 0;
  const credentialErrors: string[] = [];
  for (const cred of enriched.credentials) {
    try {
      const written = await persistCredential(service, brandDirectoryId, cred);
      if (written) credentialsWritten += 1;
    } catch (err: unknown) {
      credentialErrors.push(
        `${cred.field_key}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── 3. Products via smart matcher (LLM dedup against existing). ──
  let productsCreated = 0;
  let productsLinked = 0;
  let productsSkippedByMap = 0;
  let productsSkippedByLlm = 0;
  const productErrors: string[] = [];
  const productSeen = new Set<string>();
  clearProductDedupCache();
  for (const p of enriched.products as EnrichedProduct[]) {
    if (p.matches_existing_id) {
      productsSkippedByMap += 1;
      continue;
    }
    const key = p.name.trim().toLowerCase();
    if (!key || productSeen.has(key)) continue;
    productSeen.add(key);
    try {
      const result = await resolveOrCreateProductEntrySmart(
        service,
        {
          brandDirectoryId,
          brandName: directory.name ?? '',
          displayName: p.name,
          category: p.category ?? null,
          abv: p.abv ?? null,
          containerSizeMl: p.container_size_ml ?? null,
          containerFormat: p.container_format ?? null,
        },
        { discoveredVia: 'manual' },
      );
      if (result.created) productsCreated += 1;
      else if (result.llmDeduped) productsSkippedByLlm += 1;
      else productsLinked += 1;
    } catch (err: unknown) {
      productErrors.push(`${p.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── 4. Documents → PDF ingester. ──
  // Direct PDF URLs go straight to the ingester. For URLs that aren't
  // PDFs (landing pages — e.g. Shopify's /pages/sustainability-report
  // listing several Dropbox EPDs), fetch the page and run a focused
  // anchor crawl. Each discovered PDF is then fed through the same
  // ingester. Bounded to 12 discovered PDFs per landing page.
  let docsIngested = 0;
  let docsSkipped = 0;
  const docDetails: Array<{ url: string; status: string; reason?: string }> = [];
  const ingestQueue: typeof enriched.documents = [];
  const landingPageDetails: Array<{ landingUrl: string; foundCount: number }> = [];
  for (const doc of enriched.documents) {
    if (looksLikePdfUrl(doc.url)) {
      ingestQueue.push(doc);
      continue;
    }
    try {
      const discovered = await discoverPdfsAtLandingPage(doc.url);
      landingPageDetails.push({ landingUrl: doc.url, foundCount: discovered.length });
      if (discovered.length === 0) {
        docsSkipped += 1;
        docDetails.push({ url: doc.url, status: 'skipped', reason: 'landing_page_no_pdfs' });
        continue;
      }
      docDetails.push({
        url: doc.url,
        status: 'landing_page_crawled',
        reason: `${discovered.length}_pdfs_found`,
      });
      ingestQueue.push(...discovered);
    } catch (err: unknown) {
      docsSkipped += 1;
      docDetails.push({
        url: doc.url,
        status: 'failed',
        reason: `landing_page_crawl_failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  for (const doc of ingestQueue) {
    try {
      const result = await ingestDiscoveredPdf({
        supabase: service,
        brandDirectoryId,
        distributorOrgId: null,
        document: doc,
      });
      if (result.ingested) {
        docsIngested += 1;
        docDetails.push({ url: doc.url, status: 'ingested' });
      } else {
        docsSkipped += 1;
        docDetails.push({
          url: doc.url,
          status: 'skipped',
          reason: result.skipped_reason ?? result.error ?? 'unknown',
        });
      }
    } catch (err: unknown) {
      docsSkipped += 1;
      docDetails.push({
        url: doc.url,
        status: 'failed',
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ── 5. Awards. Upsert each row keyed by (brand, product, body, name, year). ──
  let awardsAdded = 0;
  let awardsExisting = 0;
  const awardErrors: string[] = [];
  for (const award of enriched.awards as EnrichedAward[]) {
    try {
      const wasAdded = await persistAward(service, brandDirectoryId, award);
      if (wasAdded) awardsAdded += 1;
      else awardsExisting += 1;
    } catch (err: unknown) {
      awardErrors.push(
        `${award.awarding_body} ${award.award_name}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── 6. Notable facts. Append to the directory column with semantic
  //    dedup — token-Jaccard so different phrasings of the same fact
  //    ("B Corp certified" / "Certified B Corporation with B Impact
  //    score of 89.8") collapse to one entry. Cap the column at 8 so
  //    repeat runs can't grow the list indefinitely.
  let notableAdded = 0;
  let notableExisting = 0;
  if (enriched.notable_facts.length > 0) {
    const { data: current } = await service
      .from('brand_directory')
      .select('notable_facts')
      .eq('id', brandDirectoryId)
      .maybeSingle();
    const existing = ((current as { notable_facts?: string[] } | null)?.notable_facts ?? []);
    const toAdd = dedupeAgainstExisting(enriched.notable_facts, existing);
    notableExisting = enriched.notable_facts.length - toAdd.length;
    if (toAdd.length > 0) {
      const NOTABLE_FACTS_CAP = 8;
      const combined = [...existing, ...toAdd];
      const next = combined.length > NOTABLE_FACTS_CAP
        ? combined.slice(combined.length - NOTABLE_FACTS_CAP)
        : combined;
      const { error } = await service
        .from('brand_directory')
        .update({ notable_facts: next, updated_at: new Date().toISOString() })
        .eq('id', brandDirectoryId);
      if (!error) notableAdded = toAdd.length;
    }
  }

  // ── 7. Recalc completeness so scores update immediately. ──
  try {
    await recalculateCompleteness(service, brandDirectoryId);
  } catch {
    // best-effort
  }

  return {
    summary: enriched.summary ?? null,
    brand: { fields_updated: brandFieldsUpdated, patch: brandPatch },
    credentials: { written: credentialsWritten, errors: credentialErrors },
    products: {
      created: productsCreated,
      linked: productsLinked,
      skipped_by_dedup: productsSkippedByMap + productsSkippedByLlm,
      errors: productErrors,
    },
    documents: {
      ingested: docsIngested,
      skipped: docsSkipped,
      landing_pages_crawled: landingPageDetails,
      details: docDetails,
    },
    awards: { added: awardsAdded, existing: awardsExisting, errors: awardErrors },
    notable_facts: { added: notableAdded, existing: notableExisting },
    enrich_error: enriched.error ?? null,
  };
}

async function persistAward(
  service: SupabaseClient,
  brandDirectoryId: string,
  award: EnrichedAward,
): Promise<boolean> {
  // Semantic dedup. Awards from successive deep-enrich runs come back
  // with the same body / award / year but slightly different prose
  // ("Wine & Spirit Competition" vs "Wine and Spirit Competition";
  // "Green Spirit Trophy" vs "Green Spirit Initiative Trophy"). A
  // straight ilike misses these — normalise the body + name first,
  // then compare. We also pull every award row on this brand once
  // and dedup in JS rather than try to express the normalisation in
  // a Postgres filter.
  const normNewBody = normaliseAwardKey(award.awarding_body);
  const normNewName = normaliseAwardKey(award.award_name);
  const newYear = award.year ?? null;
  const newProductId = award.matches_product_id ?? null;
  const { data: rows } = await service
    .from('brand_awards')
    .select('id, awarding_body, award_name, year, product_directory_id')
    .eq('brand_directory_id', brandDirectoryId);
  const existingRows = (rows ?? []) as Array<{
    id: string;
    awarding_body: string;
    award_name: string;
    year: number | null;
    product_directory_id: string | null;
  }>;
  for (const r of existingRows) {
    if ((r.year ?? null) !== newYear) continue;
    if ((r.product_directory_id ?? null) !== newProductId) continue;
    if (normaliseAwardKey(r.awarding_body) !== normNewBody) continue;
    if (!awardNamesMatch(r.award_name, award.award_name)) continue;
    return false;
  }
  const { error } = await service.from('brand_awards').insert({
    brand_directory_id: brandDirectoryId,
    product_directory_id: award.matches_product_id,
    awarding_body: award.awarding_body,
    award_name: award.award_name,
    medal_tier: award.medal_tier,
    year: award.year,
    source_url: award.source_url,
    notes: award.notes,
    discovered_via: 'deep_enrich',
  });
  if (error) throw new Error(error.message);
  return true;
}

/** Lowercase, replace & with " and ", strip leading "the ", drop
 *  punctuation and collapse whitespace. Used as the body-equality key
 *  for award dedup. */
function normaliseAwardKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/^the\s+/, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const AWARD_NAME_STOP_WORDS = new Set([
  'a','an','the','of','for','and','or','to','in','at','by','on',
  'award','awards','prize','trophy','medal','category',
]);

/** True when two award names refer to the same prize. Tokenises after
 *  the body-style normalisation, drops generic award-suffix words
 *  ("Trophy", "Award", "Prize"), then requires Jaccard ≥ 0.5 on the
 *  remaining tokens OR the smaller token set (size ≥ 2) being a strict
 *  subset of the larger. Catches "Green Spirit Trophy" vs "Green Spirit
 *  Initiative Trophy" without false-matching "Sustainability Award" to
 *  "Best Sustainability Initiative" via single-token subset. */
function awardNamesMatch(a: string, b: string): boolean {
  const tokenise = (s: string): Set<string> => {
    const tokens = normaliseAwardKey(s)
      .split(' ')
      .filter((t) => t.length > 1 && !AWARD_NAME_STOP_WORDS.has(t));
    return new Set(tokens);
  };
  const ta = tokenise(a);
  const tb = tokenise(b);
  if (ta.size === 0 && tb.size === 0) return true;
  if (ta.size === 0 || tb.size === 0) return false;
  let intersect = 0;
  for (const t of Array.from(ta)) if (tb.has(t)) intersect += 1;
  const union = ta.size + tb.size - intersect;
  const jaccard = union === 0 ? 0 : intersect / union;
  if (jaccard >= 0.5) return true;
  // Strict-subset fallback — only fires when the smaller set has ≥ 2
  // tokens, so "Sustainability" (1 token) doesn't claim a match
  // against "Best Sustainability Initiative".
  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  if (smaller.size < 2) return false;
  for (const t of Array.from(smaller)) {
    if (!larger.has(t)) return false;
  }
  return true;
}

async function persistCredential(
  service: SupabaseClient,
  brandDirectoryId: string,
  cred: EnrichedCredential,
): Promise<boolean> {
  const { fieldValue, fieldValueNumeric } = coerce(cred.value);
  if (fieldValue === null && fieldValueNumeric === null) return false;

  const { data: priors } = await service
    .from('scraped_brand_data')
    .select('id')
    .eq('brand_directory_id', brandDirectoryId)
    .eq('field_key', cred.field_key)
    .eq('source_name', SOURCE_NAME)
    .is('superseded_by', null);

  const { data: inserted, error: insertError } = await service
    .from('scraped_brand_data')
    .insert({
      brand_directory_id: brandDirectoryId,
      field_key: cred.field_key,
      field_value: fieldValue,
      field_value_numeric: fieldValueNumeric,
      source_name: SOURCE_NAME,
      source_url: cred.source_url,
      confidence: CREDENTIAL_CONFIDENCE,
      extraction_method: 'llm_extract',
    })
    .select('id')
    .single();
  if (insertError || !inserted) return false;

  if (priors && priors.length > 0) {
    const ids = priors.map((p: { id: string }) => p.id);
    await service
      .from('scraped_brand_data')
      .update({ superseded_by: (inserted as { id: string }).id })
      .in('id', ids);
  }
  return true;
}

function coerce(value: string | number | boolean | null): {
  fieldValue: string | null;
  fieldValueNumeric: number | null;
} {
  if (value === null || value === undefined) return { fieldValue: null, fieldValueNumeric: null };
  if (typeof value === 'boolean') {
    return { fieldValue: value ? 'true' : 'false', fieldValueNumeric: value ? 1 : 0 };
  }
  if (typeof value === 'number') {
    return { fieldValue: String(value), fieldValueNumeric: Number.isFinite(value) ? value : null };
  }
  const trimmed = String(value).trim();
  if (!trimmed) return { fieldValue: null, fieldValueNumeric: null };
  const asNumber = Number(trimmed);
  return {
    fieldValue: trimmed,
    fieldValueNumeric: Number.isFinite(asNumber) ? asNumber : null,
  };
}
