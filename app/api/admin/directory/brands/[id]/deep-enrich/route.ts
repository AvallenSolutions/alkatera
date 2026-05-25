import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAlkateraAdmin } from '@/lib/admin/auth';
import { deepEnrichBrand } from '@/lib/admin/sourcing/deep-enrich';
import {
  resolveOrCreateProductEntrySmart,
  clearProductDedupCache,
} from '@/lib/distributor/directory/product-dedup';
import { ingestDiscoveredPdf } from '@/lib/distributor/scraping/pdf-ingester';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/admin/directory/brands/[id]/deep-enrich
 *
 * Comprehensive single-brand enrichment. Runs Claude + web_search
 * across authoritative sources (B Corp directory, organic certifiers,
 * Fairtrade, Rainforest Alliance, Carbon Trust, IWCA, Porto Protocol,
 * Ethical Consumer, Companies House, the brand's own sustainability
 * pages) and:
 *
 *   1. Fills empty columns on brand_directory (description, category,
 *      country, founding_year, parent_company, website) — coalesce
 *      semantics, so alka**tera**-customer data is never overwritten.
 *   2. Writes every verified credential as a scraped_brand_data row
 *      with source_name='admin_deep_enrich' and confidence 0.85. The
 *      data-merger keeps brand_verified / alkatera_live ahead of
 *      these, but they outrank generic open-web scrapes.
 *   3. Persists new products via the matcher; skips findings Claude
 *      mapped to an existing product_directory row.
 *   4. Auto-ingests every PDF URL via the existing pdf-ingester so the
 *      document processor extracts metrics from EPDs / LCAs.
 *   5. Recalculates completeness so the score on the brand-detail
 *      page reflects the new data without a manual refresh.
 */
export const runtime = 'nodejs';
export const maxDuration = 120;

const SOURCE_NAME = 'admin_deep_enrich';
const CREDENTIAL_CONFIDENCE = 0.85;

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAlkateraAdmin();
  if (!auth.ok) return auth.response;

  const { data: brand } = await auth.service
    .from('brand_directory')
    .select(
      'id, name, website, country_of_origin, category, founding_year, parent_company, description, alkatera_org_id',
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const directory = brand as {
    id: string;
    name: string;
    website: string | null;
    country_of_origin: string | null;
    category: string | null;
    founding_year: number | null;
    parent_company: string | null;
    description: string | null;
    alkatera_org_id: string | null;
  };

  const { data: existingProductRows } = await auth.service
    .from('product_directory')
    .select('id, name')
    .eq('brand_directory_id', directory.id)
    .order('name');
  const existingProducts = ((existingProductRows ?? []) as Array<{ id: string; name: string }>);

  const enriched = await deepEnrichBrand({
    brandName: directory.name,
    website: directory.website,
    country: directory.country_of_origin,
    category: directory.category,
    existingBrand: {
      description: directory.description,
      founding_year: directory.founding_year,
      parent_company: directory.parent_company,
    },
    existingProducts,
  });

  if (
    enriched.error &&
    enriched.products.length === 0 &&
    enriched.documents.length === 0 &&
    enriched.credentials.length === 0 &&
    Object.keys(enriched.brand).length === 0
  ) {
    return NextResponse.json(
      { error: 'enrich_failed', detail: enriched.error },
      { status: 502 },
    );
  }

  // ──────────────────────────────────────────────────────────────
  // 1. Brand columns. alka**tera**-linked rows never get overwritten
  //    here — only empty columns are filled. For non-linked rows the
  //    same coalesce(new, existing) rule applies so we don't replace
  //    a curated value with an enrich guess.
  // ──────────────────────────────────────────────────────────────
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
    const { error: updateErr } = await auth.service
      .from('brand_directory')
      .update(brandPatch)
      .eq('id', directory.id);
    if (!updateErr) brandFieldsUpdated = Object.keys(brandPatch).length - 1;
  }

  // ──────────────────────────────────────────────────────────────
  // 2. Credentials → scraped_brand_data rows. We supersede any prior
  //    admin_deep_enrich finding for the same field so the merger
  //    sees one active row per field per source.
  // ──────────────────────────────────────────────────────────────
  let credentialsWritten = 0;
  const credentialErrors: string[] = [];
  for (const cred of enriched.credentials) {
    try {
      const written = await persistCredential(auth.service, directory.id, cred);
      if (written) credentialsWritten += 1;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      credentialErrors.push(`${cred.field_key}: ${message}`);
    }
  }

  // ──────────────────────────────────────────────────────────────
  // 3. Products. Skip findings Claude mapped to an existing row.
  //    Persist the rest via the matcher (it handles GTIN / name
  //    dedup at insert time).
  // ──────────────────────────────────────────────────────────────
  let productsCreated = 0;
  let productsLinked = 0;
  let productsSkippedByMap = 0;
  let productsSkippedByLlm = 0;
  const productErrors: string[] = [];
  const productSeen = new Set<string>();
  // Reset the smart-matcher cache so it sees a fresh existing-products
  // snapshot for this brand.
  clearProductDedupCache();
  for (const p of enriched.products) {
    if (p.matches_existing_id) {
      productsSkippedByMap += 1;
      continue;
    }
    const key = p.name.trim().toLowerCase();
    if (!key || productSeen.has(key)) continue;
    productSeen.add(key);
    try {
      const result = await resolveOrCreateProductEntrySmart(
        auth.service,
        {
          brandDirectoryId: directory.id,
          brandName: directory.name,
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

  // ──────────────────────────────────────────────────────────────
  // 4. Documents → PDF ingester (download + queue for processor).
  //    Non-PDF URLs echoed back so the admin can decide.
  // ──────────────────────────────────────────────────────────────
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
        supabase: auth.service,
        brandDirectoryId: directory.id,
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

  // ──────────────────────────────────────────────────────────────
  // 5. Refresh completeness so the score updates.
  // ──────────────────────────────────────────────────────────────
  try {
    await recalculateCompleteness(auth.service, directory.id);
  } catch {
    // best-effort
  }

  return NextResponse.json({
    ok: true,
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
  });
}

/**
 * Insert a scraped_brand_data row for the credential, superseding any
 * prior admin_deep_enrich row for the same field on this brand so the
 * "active" view always returns exactly one row per (brand, field,
 * source).
 */
async function persistCredential(
  service: SupabaseClient,
  brandDirectoryId: string,
  cred: { field_key: string; value: string | number | boolean | null; source_url: string | null },
): Promise<boolean> {
  const { fieldValue, fieldValueNumeric } = coerce(cred.value);
  if (fieldValue === null && fieldValueNumeric === null) return false;

  // Find the previous admin_deep_enrich row to mark superseded.
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
