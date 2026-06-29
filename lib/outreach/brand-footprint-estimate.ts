/**
 * Brand footprint estimator (Spec A of the outbound reply-hook).
 *
 * Produces a defensible, *sourced* carbon + water footprint estimate for a
 * drinks brand from minimal inputs — a brand name and, ideally, a category,
 * country and a few SKUs. It is the data behind the personalised report we
 * attach to cold outbound: "we already estimated your footprint".
 *
 * Design choices (verified with Tim, 2026-06-28):
 *  - This is the INDUSTRY-BENCHMARK path, not the per-material LCA engine.
 *    `calculateProductCarbonFootprint` needs real material/packaging/facility
 *    rows, which a cold prospect does not have; running it would mean inventing
 *    fake inputs. The BIER 2023 et al. benchmarks in `industry-benchmarks.ts`
 *    are themselves lifecycle-LCA figures, and every number we return carries a
 *    citable source — honest in a cold email.
 *  - Pure and deterministic: no network, no LLM. The auto-enrich step that turns
 *    a cold brand name into these inputs lives one layer up (Spec C); this input
 *    shape is deliberately close to `deepEnrichBrand`'s output so wiring is trivial.
 *  - Nothing is fabricated. We never invent an annual production volume; the
 *    headline figures are per-litre and per-bottle, which the benchmarks support
 *    directly. An annual total is only produced when the caller supplies a volume.
 */

import {
  getBenchmarkForCategory,
  getBenchmarkForProductType,
  getWaterBenchmarkForCategory,
  getWaterBenchmarkForProductType,
  getGroupForCategory,
  inferCategoryFromText,
  isKnownCategory,
  isProductGroup,
  type IndustryBenchmark,
  type WaterBenchmark,
} from '@/lib/industry-benchmarks';

/** A single product the brand sells, as known to the estimator. */
export interface EstimatorSku {
  name: string;
  /** Container size in millilitres. Defaulted per category when absent. */
  containerSizeMl?: number | null;
  /** Specific category for this SKU, if known (overrides text inference). */
  category?: string | null;
  /** Captured for completeness; not used in the v1 estimate. */
  abv?: number | null;
}

/** Inputs to the estimator. Only `brandName` is required. */
export interface BrandFootprintInput {
  brandName: string;
  /** A specific category ("Whisky") or a product group ("Spirits"). Optional. */
  category?: string | null;
  countryOfOrigin?: string | null;
  skus?: EstimatorSku[];
  /**
   * Optional, caller-supplied estimate of annual production in litres. Only
   * when present do we surface an annual total — we never guess it ourselves.
   */
  estimatedAnnualLitres?: number | null;
}

/** How confident we are in the category that drives the benchmark. */
export type EstimateConfidence = 'high' | 'medium' | 'low';

/** How the category used for the benchmark was arrived at. */
export type CategorySource =
  | 'provided' // caller gave a recognised specific category
  | 'provided-group' // caller gave a product group only
  | 'inferred' // inferred from brand + SKU names
  | 'default'; // nothing usable — industry-average benchmark

export interface SkuFootprintEstimate {
  name: string;
  category: string | null;
  containerSizeMl: number;
  /** True when the container size was assumed rather than supplied. */
  containerAssumed: boolean;
  litres: number;
  kgCO2ePerBottle: number;
  litresWaterPerBottle: number;
}

export interface FootprintSource {
  name: string;
  url: string;
  year: number;
}

export interface BrandFootprintEstimate {
  brandName: string;
  countryOfOrigin: string | null;
  /** The category actually used for the benchmark (specific or group), or null. */
  category: string | null;
  categorySource: CategorySource;
  confidence: EstimateConfidence;
  /** Always true — these are benchmark estimates, framed as such in the report. */
  isEstimate: true;
  carbon: {
    kgCO2ePerLitre: number;
    source: FootprintSource;
  };
  water: {
    litresPerLitre: number;
    source: FootprintSource;
  };
  /** A headline "per bottle" figure for the most representative container. */
  representativeBottle: {
    containerSizeMl: number;
    litres: number;
    kgCO2ePerBottle: number;
    litresWaterPerBottle: number;
  };
  /** Per-SKU breakdown (empty when no SKUs were supplied). */
  skus: SkuFootprintEstimate[];
  /** Present only when the caller supplied an annual production volume. */
  annual?: {
    litres: number;
    kgCO2e: number;
    litresWater: number;
  };
  /** Plain-English assumptions, for honest framing in the report. */
  assumptions: string[];
}

/** Sensible default container size (ml) per benchmark group. */
const DEFAULT_CONTAINER_ML: Record<string, number> = {
  Spirits: 700,
  Wine: 750,
  'Beer & Cider': 330,
  'Ready-to-Drink & Cocktails': 250,
  'Non-Alcoholic': 330,
};
const FALLBACK_CONTAINER_ML = 500;

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

function toSource(b: IndustryBenchmark | WaterBenchmark): FootprintSource {
  return { name: b.sourceName, url: b.sourceUrl, year: b.sourceYear };
}

function defaultContainerForGroup(group: string | null): number {
  if (group && DEFAULT_CONTAINER_ML[group] != null) return DEFAULT_CONTAINER_ML[group];
  return FALLBACK_CONTAINER_ML;
}

/**
 * Resolve the category that drives the benchmark, plus how we got there.
 * Order: a recognised specific category the caller gave → a product group the
 * caller gave → inference from the brand + SKU names → null (default benchmark).
 */
function resolveCategory(input: BrandFootprintInput): {
  category: string | null;
  group: string | null;
  source: CategorySource;
} {
  const provided = input.category?.trim() || null;

  if (provided) {
    if (isKnownCategory(provided)) {
      return { category: provided, group: getGroupForCategory(provided), source: 'provided' };
    }
    if (isProductGroup(provided)) {
      return { category: null, group: provided, source: 'provided-group' };
    }
    // Caller passed free text (e.g. "London Dry Gin"): try to infer from it.
    const fromProvided = inferCategoryFromText(provided);
    if (fromProvided) {
      return { category: fromProvided, group: getGroupForCategory(fromProvided), source: 'provided' };
    }
  }

  // Infer from the brand name plus any SKU names/categories.
  const text = [
    input.brandName,
    ...(input.skus ?? []).flatMap((s) => [s.name, s.category ?? '']),
  ]
    .filter(Boolean)
    .join(' ');
  const inferred = inferCategoryFromText(text);
  if (inferred) {
    return { category: inferred, group: getGroupForCategory(inferred), source: 'inferred' };
  }

  return { category: null, group: null, source: 'default' };
}

function carbonBenchmarkFor(category: string | null, group: string | null): IndustryBenchmark {
  if (category) return getBenchmarkForCategory(category);
  if (group) return getBenchmarkForProductType(group).benchmark;
  return getBenchmarkForCategory(null); // default
}

function waterBenchmarkFor(category: string | null, group: string | null): WaterBenchmark {
  if (category) return getWaterBenchmarkForCategory(category);
  if (group) return getWaterBenchmarkForProductType(group).benchmark;
  return getWaterBenchmarkForCategory(null); // default
}

function confidenceFor(source: CategorySource, skuCount: number): EstimateConfidence {
  if (source === 'default') return 'low';
  if (source === 'provided' || source === 'inferred') {
    return skuCount > 0 ? 'high' : 'medium';
  }
  // provided-group: we know the group but not the specific category.
  return 'medium';
}

/**
 * Estimate a drinks brand's carbon + water footprint from minimal inputs.
 * Pure and deterministic; safe to call anywhere (server or test).
 */
export function estimateBrandFootprint(input: BrandFootprintInput): BrandFootprintEstimate {
  const { category, group, source } = resolveCategory(input);
  const carbon = carbonBenchmarkFor(category, group);
  const water = waterBenchmarkFor(category, group);

  const kgPerLitre = carbon.kgCO2ePerLitre;
  const waterPerLitre = water.litresPerLitre;
  const groupDefaultMl = defaultContainerForGroup(group);

  const assumptions: string[] = [];

  // Per-SKU estimates.
  const skus: SkuFootprintEstimate[] = (input.skus ?? []).map((sku) => {
    const provided = typeof sku.containerSizeMl === 'number' && sku.containerSizeMl > 0;
    const containerSizeMl = provided ? (sku.containerSizeMl as number) : groupDefaultMl;
    const litres = containerSizeMl / 1000;
    return {
      name: sku.name,
      category: sku.category ?? category,
      containerSizeMl,
      containerAssumed: !provided,
      litres: round(litres, 4),
      kgCO2ePerBottle: round(kgPerLitre * litres, 3),
      litresWaterPerBottle: round(waterPerLitre * litres, 1),
    };
  });

  // Representative container: the most common supplied SKU size, else the
  // group default. This is what the report headlines as "per bottle".
  const repMl = mostCommonContainer(skus) ?? groupDefaultMl;
  const repLitres = repMl / 1000;
  const representativeBottle = {
    containerSizeMl: repMl,
    litres: round(repLitres, 4),
    kgCO2ePerBottle: round(kgPerLitre * repLitres, 3),
    litresWaterPerBottle: round(waterPerLitre * repLitres, 1),
  };

  // Assumptions, for honest framing.
  if (source === 'provided') {
    assumptions.push(`Footprint benchmarked against the "${category}" category.`);
  } else if (source === 'provided-group') {
    assumptions.push(`Footprint benchmarked against the "${group}" product group.`);
  } else if (source === 'inferred') {
    assumptions.push(`Category "${category}" inferred from the brand and product names.`);
  } else {
    assumptions.push('No category could be determined; the all-beverage industry average was used.');
  }
  if (skus.some((s) => s.containerAssumed)) {
    assumptions.push(`A ${groupDefaultMl} ml container was assumed where SKU sizes were unknown.`);
  }
  if (skus.length === 0) {
    assumptions.push(`A representative ${repMl} ml container was used for the per-bottle figure.`);
  }
  assumptions.push(
    'Figures are category-benchmark estimates from published lifecycle studies, not a brand-specific measured LCA.',
  );

  const estimate: BrandFootprintEstimate = {
    brandName: input.brandName,
    countryOfOrigin: input.countryOfOrigin?.trim() || null,
    category: category ?? group,
    categorySource: source,
    confidence: confidenceFor(source, skus.length),
    isEstimate: true,
    carbon: { kgCO2ePerLitre: kgPerLitre, source: toSource(carbon) },
    water: { litresPerLitre: waterPerLitre, source: toSource(water) },
    representativeBottle,
    skus,
    assumptions,
  };

  // Annual total only when the caller supplied a volume — never guessed.
  if (typeof input.estimatedAnnualLitres === 'number' && input.estimatedAnnualLitres > 0) {
    const litres = input.estimatedAnnualLitres;
    estimate.annual = {
      litres,
      kgCO2e: round(kgPerLitre * litres, 1),
      litresWater: round(waterPerLitre * litres, 0),
    };
  }

  return estimate;
}

/** The most frequently occurring supplied container size, or null. */
function mostCommonContainer(skus: SkuFootprintEstimate[]): number | null {
  const supplied = skus.filter((s) => !s.containerAssumed).map((s) => s.containerSizeMl);
  if (supplied.length === 0) return null;
  const counts = new Map<number, number>();
  for (const ml of supplied) counts.set(ml, (counts.get(ml) ?? 0) + 1);
  let best = supplied[0];
  let bestCount = 0;
  for (const [ml, count] of Array.from(counts.entries())) {
    if (count > bestCount) {
      bestCount = count;
      best = ml;
    }
  }
  return best;
}
