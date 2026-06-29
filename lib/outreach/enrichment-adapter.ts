import type { BrandFootprintInput, EstimatorSku } from './brand-footprint-estimate';

/**
 * Map `deepEnrichBrand` output to the estimator's input.
 *
 * The gotcha this resolves: deepEnrichBrand returns COARSE lowercase categories
 * ('spirits' | 'wine' | 'beer' | 'non_alc' | 'other') that do NOT match the
 * estimator's category vocabulary. Passing one through raw as `category` would
 * make the estimator settle for the broad product-group benchmark and STOP —
 * never inferring the more specific, better-sourced category (e.g. "Whisky")
 * from the rich product names enrichment gives us.
 *
 * So we deliberately do NOT pass the coarse category as the estimator's
 * `category`. Instead we feed the real product names as SKUs and let the
 * estimator's text inference find the specific category. The coarse group is
 * used only as a last-resort fallback when there are no usable product names.
 */

/** What we consume from a deepEnrichBrand result (a structural subset). */
export interface EnrichmentLike {
  brand?: {
    category?: string | null;
    country_of_origin?: string | null;
  } | null;
  products?: Array<{
    name?: string | null;
    container_size_ml?: number | null;
    abv?: number | null;
  }> | null;
}

/** deepEnrich's coarse category → the estimator's product-group name. */
const COARSE_GROUP: Record<string, string> = {
  spirits: 'Spirits',
  wine: 'Wine',
  beer: 'Beer & Cider',
  non_alc: 'Non-Alcoholic',
  // 'other' intentionally absent → no group hint, estimator falls back to default.
};

export function enrichmentToEstimatorInput(
  brandName: string,
  enriched: EnrichmentLike,
): BrandFootprintInput {
  // category left undefined on purpose — inference works off each `name`.
  const skus: EstimatorSku[] = [];
  for (const p of enriched.products ?? []) {
    const name = p?.name?.trim();
    if (!name) continue;
    skus.push({
      name,
      containerSizeMl: typeof p.container_size_ml === 'number' ? p.container_size_ml : null,
      abv: typeof p.abv === 'number' ? p.abv : null,
    });
  }

  const coarse = enriched.brand?.category?.toLowerCase().trim();
  // Only fall back to the coarse group hint when we have no product names for
  // the estimator to infer a specific category from.
  const fallbackGroup = skus.length === 0 && coarse ? (COARSE_GROUP[coarse] ?? null) : null;

  return {
    brandName,
    category: fallbackGroup,
    countryOfOrigin: enriched.brand?.country_of_origin ?? null,
    skus,
  };
}
