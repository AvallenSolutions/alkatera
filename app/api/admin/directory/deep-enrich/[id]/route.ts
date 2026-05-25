import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import {
  resolveOrCreateProductEntrySmart,
  clearProductDedupCache,
} from '@/lib/distributor/directory/product-dedup';
import { ingestDiscoveredPdf } from '@/lib/distributor/scraping/pdf-ingester';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';
import type {
  DeepEnrichResult,
  EnrichedCredential,
  EnrichedProduct,
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
    details: Array<{ url: string; status: string; reason?: string }>;
  };
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
  let docsIngested = 0;
  let docsSkipped = 0;
  const docDetails: Array<{ url: string; status: string; reason?: string }> = [];
  for (const doc of enriched.documents) {
    if (!/\.pdf(\?|#|$)/i.test(doc.url)) {
      docsSkipped += 1;
      docDetails.push({ url: doc.url, status: 'skipped', reason: 'not_a_pdf' });
      continue;
    }
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

  // ── 5. Recalc completeness so scores update immediately. ──
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
    documents: { ingested: docsIngested, skipped: docsSkipped, details: docDetails },
    enrich_error: enriched.error ?? null,
  };
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
