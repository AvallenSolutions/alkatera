import { getSupabaseBrowserClient } from './supabase/browser-client';
import { isServerContext, type CalculationContext } from './lca/calculation-context';
import { resolveImpactFactors, normalizeToKg, tryNormalizeToKg, type ProductMaterial, type WaterfallResult, type FallbackEvent } from './impact-waterfall-resolver';
import { calculateTransportEmissions, type TransportMode } from './utils/transport-emissions-calculator';
import { calculateDistributionEmissions } from './distribution-factors';
import { resolveImpactSource } from './utils/data-quality-mapper';
import { aggregateProductImpacts, type FacilityEmissionsData } from './product-lca-aggregator';
import { generateLcaInterpretation } from './lca-interpretation-engine';
import { calculateDistance } from './utils/distance-calculator';
import { boundaryToDbEnum } from './system-boundaries';
import { computeBottlesPerBatch, type ProductionStage } from './types/products';
import { calculateMaturationImpacts } from './maturation-calculator';
import type { MaturationProfile } from './types/maturation';
import { resolveMaturationAbv } from './types/maturation';
import { isMaturationEligibleProduct } from './maturation-eligibility';
import { calculateViticultureImpacts } from './viticulture-calculator';
import { calculateMultiVintageAverage } from './viticulture-multi-vintage';
import type { VineyardGrowingProfile, Vineyard } from './types/viticulture';
import { calculateOrchardImpacts } from './orchard-calculator';
import { calculateMultiHarvestAverage } from './orchard-multi-harvest';
import type { Orchard } from './types/orchard';
import { calculateArableMultiHarvestAverage } from './arable-multi-harvest';
import type { ArableField, ArableCalculatorInput } from './types/arable';
import { getGridFactor } from './grid-emission-factors';
import { getAwareFactor } from './calculations/water-risk';
import { DEFAULT_RECYCLED_CONTENT_CREDIT, RECYCLED_CONTENT_DISPLACEMENT, FACTOR_EMBEDS_RECYCLED_CONTENT } from './constants/packaging-defaults';
import { getPackagingUnitsPerGroup, SHARED_PACKAGING_CATEGORIES, getMaterialFactorKey } from './end-of-life-factors';
import { getMaterialClass, isParametricClass, resolveVariant } from './constants/packaging-material-classes';
import {
  derivePackagingFactor,
  fetchActivePackagingEndpoints,
  buildFactorDerivation,
  endpointLookupKey,
  type PackagingFactorEndpoint,
} from './calculations/packaging-factor';
import { checkPackagingWeight, checkIngredientAmount } from './constants/packaging-weight-ranges';
import { overlapFraction } from './calculations/utility-factors';
import { resolveRefrigerantGwp } from './ghg-constants';
import { checkRunIntensity } from './validation/production-run-sanity';
import {
  getFacilityArchetypeById,
  resolveProxyEmissions,
  type FacilityArchetype,
} from './facility-archetypes';

export type FacilityDataCollectionMode = 'primary' | 'archetype_proxy' | 'hybrid';

export interface FacilityArchetypeOverrides {
  electricity_kwh_per_unit?: number;
  natural_gas_kwh_per_unit?: number;
  thermal_fuel_kwh_per_unit?: number;
  water_litres_per_unit?: number;
}

export interface FacilityAllocationInput {
  facilityId: string;
  facilityName: string;
  operationalControl: 'owned' | 'third_party';
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  productionVolume: number;
  productionVolumeUnit: string;
  facilityTotalProduction: number;
  /**
   * Unit of facilityTotalProduction. When absent, it is assumed to equal
   * productionVolumeUnit (the historical behaviour); a warning is pushed when
   * the resulting attribution ratio looks implausible. When present and
   * different from productionVolumeUnit, both volumes are normalised to a
   * common basis before computing the facility share, preventing silent
   * litres-vs-hectolitres style errors (100x).
   */
  facilityTotalProductionUnit?: string;

  /**
   * How data was collected. Defaults to 'primary' (the historical behaviour).
   * When 'archetype_proxy' or 'hybrid', the calculator pulls industry-typical
   * intensities from facility_archetypes instead of (or in addition to)
   * querying utility_data_entries.
   */
  dataCollectionMode?: FacilityDataCollectionMode;
  archetypeId?: string | null;
  proxyJustification?: string;
  hybridOverrides?: FacilityArchetypeOverrides;
}

export interface CalculatePCFParams {
  productId: string;
  functionalUnit?: string;
  systemBoundary?: 'cradle-to-gate' | 'cradle-to-shelf' | 'cradle-to-consumer' | 'cradle-to-grave';
  referenceYear?: number;
  facilityAllocations?: FacilityAllocationInput[];
  onProgress?: (step: string, percent: number) => void;
  usePhaseConfig?: import('./use-phase-factors').UsePhaseConfig;
  eolConfig?: import('./end-of-life-factors').EoLConfig;
  distributionConfig?: import('./distribution-factors').DistributionConfig;
  productLossConfig?: import('./system-boundaries').ProductLossConfig;
  /** When set, re-use the exact emission factor values from this PCF instead of
   *  re-resolving through the waterfall. Enables deterministic re-calculation. */
  pinnedPcfId?: string;
  /** When set, promote this existing draft PCF row to a full calculation
   *  (UPDATE in place) rather than inserting a new row. Used by the wizard's
   *  autosave flow so draft state survives the calc without creating a
   *  duplicate row. */
  draftPcfId?: string;
  /**
   * Where this calculation is running. Omit in the browser and everything
   * behaves exactly as it always has: the memoised browser client, the
   * signed-in user's session for internal API hops.
   *
   * A server run (the Inngest function) must supply a service-role client and
   * a service credential. Without the credential the supplier and OpenLCA
   * branches cannot authenticate, and the run will report that rather than
   * quietly resolving from worse factors.
   */
  context?: CalculationContext;
  /**
   * Who this calculation is attributed to. Required when `context.supabase`
   * is injected, because there is no session to read a user from. Ignored in
   * the browser, where the signed-in user is authoritative.
   */
  userId?: string;
}

/** @deprecated Use CalculatePCFParams instead */
export type CalculateLCAParams = CalculatePCFParams;

export interface CalculatePCFResult {
  success: boolean;
  pcfId?: string;
  /** @deprecated Use pcfId instead */
  lcaId?: string;
  error?: string;
}

/** @deprecated Use CalculatePCFResult instead */
export type CalculateLCAResult = CalculatePCFResult;

// ============================================================================
// CALCULATION DETERMINISM HELPERS
// ============================================================================

/**
 * Generate a SHA-256 fingerprint of all inputs that affect the calculation result.
 * Two calculations with identical fingerprints must produce identical outputs.
 * Uses the Web Crypto API (available in both browser and Next.js).
 */
async function generateCalculationFingerprint(params: {
  materials: Array<{ name: string; quantity_kg: number; data_source_id?: string | null }>;
  factorValues: Array<{ name: string; impact_climate_per_kg: number; gwp_data_source?: string }>;
  facilityAllocations?: FacilityAllocationInput[];
  systemBoundary: string;
  referenceYear: number;
}): Promise<string> {
  // Build a canonical JSON with sorted keys for reproducibility
  const canonical = JSON.stringify({
    boundary: params.systemBoundary,
    facilities: (params.facilityAllocations || []).map(f => ({
      id: f.facilityId,
      production: f.productionVolume,
      productionUnit: f.productionVolumeUnit || '',
      total: f.facilityTotalProduction,
      totalUnit: f.facilityTotalProductionUnit || '',
    })).sort((a, b) => a.id.localeCompare(b.id)),
    factors: params.factorValues
      .map(f => ({ n: f.name, v: Number(f.impact_climate_per_kg.toFixed(8)), s: f.gwp_data_source }))
      .sort((a, b) => a.n.localeCompare(b.n)),
    materials: params.materials
      .map(m => ({ n: m.name, q: Number(m.quantity_kg.toFixed(6)), d: m.data_source_id || '' }))
      .sort((a, b) => a.n.localeCompare(b.n)),
    year: params.referenceYear,
  });
  const encoder = new TextEncoder();
  const data = encoder.encode(canonical);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Unit families recognised for production volumes. Shared by the
// functional-unit conversion and the facility attribution ratio so the two
// can never disagree about what a unit string means.
const LITRE_FAMILY = ['l', 'litre', 'litres', 'liter', 'liters'];
const HECTOLITRE_FAMILY = ['hl', 'hectolitre', 'hectolitres', 'hectoliter', 'hectoliters'];
const MILLILITRE_FAMILY = ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'];
const COUNT_FAMILY = ['unit', 'units', 'bottle', 'bottles', 'can', 'cans'];
const MASS_KG_FAMILY = ['kg', 'kilogram', 'kilograms', 'kgs'];
const MASS_TONNE_FAMILY = ['t', 'tonne', 'tonnes', 'metric ton', 'metric tons'];

/**
 * Convert a production volume to a comparable basis: litres for volume-family
 * units (counts convert via the product's unit size when known), kilograms
 * for mass-family units. Returns null when the unit can't be converted
 * (cases, pallets, or counts when the product's unit size is unknown —
 * converting counts via a guessed bottle size would be worse than not
 * converting at all).
 */
function allocationVolumeToBasis(
  volume: number,
  unit: string,
  fuSizeLitres: number,
  fuSizeKnown: boolean,
): { kind: 'volume' | 'mass'; value: number } | null {
  const u = (unit || '').toLowerCase().trim();
  if (LITRE_FAMILY.includes(u)) return { kind: 'volume', value: volume };
  if (HECTOLITRE_FAMILY.includes(u)) return { kind: 'volume', value: volume * 100 };
  if (MILLILITRE_FAMILY.includes(u)) return { kind: 'volume', value: volume / 1000 };
  if (COUNT_FAMILY.includes(u) && fuSizeKnown) return { kind: 'volume', value: volume * fuSizeLitres };
  if (MASS_KG_FAMILY.includes(u)) return { kind: 'mass', value: volume };
  if (MASS_TONNE_FAMILY.includes(u)) return { kind: 'mass', value: volume * 1000 };
  return null;
}

/**
 * Compute the facility attribution ratio (productionVolume / facilityTotal)
 * with unit normalisation. Returns the raw (unclamped) ratio plus any
 * plain-language warnings for the user.
 *
 * Rules:
 * - No facilityTotalProductionUnit, or same unit as productionVolumeUnit:
 *   divide directly (units cancel) — the historical behaviour.
 * - Different units of the same kind (litres vs hectolitres, kg vs tonnes,
 *   bottles vs litres when the bottle size is known): normalise both to a
 *   common basis before dividing.
 * - Different units that can't be reconciled: divide directly and warn,
 *   since the ratio may be wrong by the unit factor.
 *
 * Exported so UI previews can show the same ratio (and the same caveats)
 * the calculation will use.
 */
export function computeAttributionRatio(
  allocation: Pick<
    FacilityAllocationInput,
    'facilityName' | 'productionVolume' | 'productionVolumeUnit' | 'facilityTotalProduction' | 'facilityTotalProductionUnit'
  >,
  fuSizeLitres: number,
  fuSizeKnown: boolean,
): { rawRatio: number; warnings: string[] } {
  const warnings: string[] = [];
  const prod = Number(allocation.productionVolume) || 0;
  const total = Number(allocation.facilityTotalProduction) || 0;
  if (total <= 0) return { rawRatio: 0, warnings };

  const prodUnit = (allocation.productionVolumeUnit || '').toLowerCase().trim();
  const totalUnit = (allocation.facilityTotalProductionUnit || '').toLowerCase().trim();

  let rawRatio: number;
  if (!totalUnit || totalUnit === prodUnit) {
    rawRatio = prod / total;
  } else {
    const prodBasis = allocationVolumeToBasis(prod, prodUnit, fuSizeLitres, fuSizeKnown);
    const totalBasis = allocationVolumeToBasis(total, totalUnit, fuSizeLitres, fuSizeKnown);
    if (prodBasis && totalBasis && prodBasis.kind === totalBasis.kind && totalBasis.value > 0) {
      rawRatio = prodBasis.value / totalBasis.value;
    } else {
      rawRatio = prod / total;
      warnings.push(
        `For facility "${allocation.facilityName}", your production volume is in "${allocation.productionVolumeUnit}" ` +
        `but the facility's total output is in "${allocation.facilityTotalProductionUnit}", and these can't be converted automatically. ` +
        `The two numbers were compared as entered, so this facility's share of emissions may be inaccurate. ` +
        `Please enter both volumes in the same unit.`
      );
    }
  }

  if (rawRatio > 1) {
    warnings.push(
      `More of this product was attributed to facility "${allocation.facilityName}" than the facility's total output ` +
      `(${prod} ${allocation.productionVolumeUnit || 'units'} vs ${total} ${allocation.facilityTotalProductionUnit || allocation.productionVolumeUnit || 'units'}). ` +
      `The facility share has been capped at 100%. Check that both volumes are correct and use the same unit.`
    );
  } else if (rawRatio > 0 && rawRatio < 0.0001) {
    warnings.push(
      `This product accounts for less than 0.01% of facility "${allocation.facilityName}"'s output. ` +
      `If that doesn't sound right, double-check the two production volumes and their units.`
    );
  }

  return { rawRatio, warnings };
}

/**
 * Reconstruct a WaterfallResult from a previously stored product_carbon_footprint_materials row.
 * Used in pinned-mode to skip the waterfall resolver and use the exact same factor values.
 */
export function buildResultFromPinnedMaterial(pinned: any, newQuantityKg: number): WaterfallResult {
  // The pinned material stores total impacts for its original quantity.
  // Scale to the new quantity: scale = newQty / oldQty
  const oldQuantity = Number(pinned.quantity) || 1;
  const scale = newQuantityKg / oldQuantity;

  return {
    impact_climate: (pinned.impact_climate || 0) * scale,
    impact_climate_fossil: (pinned.impact_climate_fossil || 0) * scale,
    impact_climate_biogenic: (pinned.impact_climate_biogenic || 0) * scale,
    impact_climate_dluc: (pinned.impact_climate_dluc || 0) * scale,
    // Carry the OpenLCA-decomposition markers forward. On the decomposition
    // path the pinned impact_climate ALREADY has user transport folded in, and
    // the aggregator only skips re-adding impact_transport when these two are
    // both > 0. Dropping them (the old behaviour) made every pinned recalc
    // double-count inbound transport. Scaled to stay consistent with impact_climate;
    // geography is a passthrough label.
    impact_climate_production: (pinned.impact_climate_production || 0) * scale,
    impact_climate_transport_embedded: (pinned.impact_climate_transport_embedded || 0) * scale,
    embedded_electricity_geography: pinned.embedded_electricity_geography ?? null,
    impact_water: (pinned.impact_water || 0) * scale,
    impact_water_scarcity: (pinned.impact_water_scarcity || 0) * scale,
    impact_land: (pinned.impact_land || 0) * scale,
    impact_waste: (pinned.impact_waste || 0) * scale,
    impact_ozone_depletion: (pinned.impact_ozone_depletion || 0) * scale,
    impact_photochemical_ozone_formation: (pinned.impact_photochemical_ozone_formation || 0) * scale,
    impact_ionising_radiation: (pinned.impact_ionising_radiation || 0) * scale,
    impact_particulate_matter: (pinned.impact_particulate_matter || 0) * scale,
    impact_human_toxicity_carcinogenic: (pinned.impact_human_toxicity_carcinogenic || 0) * scale,
    impact_human_toxicity_non_carcinogenic: (pinned.impact_human_toxicity_non_carcinogenic || 0) * scale,
    impact_terrestrial_ecotoxicity: (pinned.impact_terrestrial_ecotoxicity || 0) * scale,
    impact_freshwater_ecotoxicity: (pinned.impact_freshwater_ecotoxicity || 0) * scale,
    impact_marine_ecotoxicity: (pinned.impact_marine_ecotoxicity || 0) * scale,
    impact_freshwater_eutrophication: (pinned.impact_freshwater_eutrophication || 0) * scale,
    impact_marine_eutrophication: (pinned.impact_marine_eutrophication || 0) * scale,
    impact_terrestrial_acidification: (pinned.impact_terrestrial_acidification || 0) * scale,
    impact_mineral_resource_scarcity: (pinned.impact_mineral_resource_scarcity || 0) * scale,
    impact_fossil_resource_scarcity: (pinned.impact_fossil_resource_scarcity || 0) * scale,
    ch4_kg: (pinned.ch4_kg || 0) * scale,
    ch4_fossil_kg: (pinned.ch4_fossil_kg || 0) * scale,
    ch4_biogenic_kg: (pinned.ch4_biogenic_kg || 0) * scale,
    n2o_kg: (pinned.n2o_kg || 0) * scale,
    data_priority: pinned.data_priority || 3,
    data_quality_tag: pinned.data_quality_tag || 'Secondary_Estimated',
    data_quality_grade: pinned.data_quality_grade || 'LOW',
    source_reference: `Pinned from previous calculation: ${pinned.source_reference || 'unknown'}`,
    confidence_score: pinned.confidence_score || 50,
    methodology: `${pinned.methodology || 'Unknown'} (pinned)`,
    gwp_data_source: `Pinned: ${pinned.gwp_data_source || 'unknown'}`,
    non_gwp_data_source: `Pinned: ${pinned.non_gwp_data_source || 'unknown'}`,
    gwp_reference_id: pinned.gwp_reference_id,
    non_gwp_reference_id: pinned.non_gwp_reference_id,
    is_hybrid_source: pinned.is_hybrid_source || false,
    resolved_factor_id: pinned.resolved_factor_id,
    category_type: pinned.category_type || 'MANUFACTURING_MATERIAL',
  };
}

/**
 * Build a valid ISO 14044 / ISO 14067 functional unit string.
 *
 * MEDIUM FIX #21: The functional unit must be unambiguous (ISO 14044 §4.2.3.2).
 * It defines BOTH the quantitative reference (e.g. "1") AND the reference flow
 * (e.g. "750 mL bottle of Whisky Brand").
 *
 * Rules:
 *   1. If the caller explicitly passes a functional unit string, use it as-is
 *      (caller has provided the most specific description).
 *   2. Otherwise, build it from product.unit_size_value + unit_size_unit + product.name:
 *      e.g. "1 x 700 mL bottle of Knockando 12-Year Single Malt Whisky"
 *   3. Fall back to "1 unit of <name>" if size data is absent.
 *
 * The resulting string must match the quantity used in impact_climate fields
 * (i.e. impacts must be per-bottle, not per-litre, when the FU is "1 x 750 mL bottle").
 * This is verified separately in the aggregation step.
 */
function buildFunctionalUnit(
  explicitFU: string | undefined,
  product: { name: string; unit?: string | null; unit_size_value?: number | string | null; unit_size_unit?: string | null }
): string {
  if (explicitFU && explicitFU.trim().length > 0) {
    return explicitFU.trim();
  }

  const sizeValue = product.unit_size_value ? Number(product.unit_size_value) : null;
  const sizeUnit = product.unit_size_unit || null;

  if (sizeValue && sizeValue > 0 && sizeUnit) {
    // Format: "1 x 700 mL bottle of Product Name"
    // Omit "unit" if unit_size_unit is already descriptive (ml, L, g, kg, cl)
    const sizeLabel = sizeUnit.toLowerCase() === 'l'
      ? `${sizeValue} L`
      : sizeUnit.toLowerCase() === 'ml'
      ? `${sizeValue} mL`
      : sizeUnit.toLowerCase() === 'cl'
      ? `${sizeValue} cL`
      : sizeUnit.toLowerCase() === 'kg'
      ? `${sizeValue} kg`
      : sizeUnit.toLowerCase() === 'g'
      ? `${sizeValue} g`
      : `${sizeValue} ${sizeUnit}`;

    return `1 × ${sizeLabel} ${product.unit && !['ml', 'l', 'cl', 'kg', 'g'].includes(product.unit.toLowerCase()) ? product.unit + ' ' : ''}of ${product.name}`;
  }

  // Final fallback — honest about what we don't know
  const unitLabel = product.unit || 'unit';
  return `1 ${unitLabel} of ${product.name}`;
}

/**
 * Calculate Product Carbon Footprint for a product
 * Uses GHG Protocol Product Standard and ISO 14067 methodology
 */
export async function calculateProductCarbonFootprint(params: CalculatePCFParams): Promise<CalculatePCFResult> {
  const ctx = params.context;
  const supabase = ctx?.supabase ?? getSupabaseBrowserClient();
  const { productId, functionalUnit, systemBoundary, referenceYear, onProgress } = params;

  try {
    console.log(`[calculateProductCarbonFootprint] Starting calculation for product: ${productId}`);
    onProgress?.('Loading product data...', 5);

    // 1. Establish who this calculation belongs to.
    // In the browser that is the signed-in user. On a server run there is no
    // session to read, so the caller must name the user explicitly; the
    // organisation is taken off the product row either way, so nothing else
    // downstream depends on this.
    let actingUserId: string;
    if (isServerContext(ctx)) {
      if (!params.userId) {
        throw new Error(
          'A server-side calculation must supply userId: there is no session to attribute it to',
        );
      }
      actingUserId = params.userId;
    } else {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated');
      }
      actingUserId = user.id;
    }

    // 2. Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .maybeSingle();

    if (productError || !product) {
      throw new Error(`Product not found: ${productError?.message || 'Unknown error'}`);
    }

    console.log(`[calculateProductCarbonFootprint] Product: ${product.name}`);

    // 3. Fetch all product materials (ingredients + packaging)
    const { data: materials, error: materialsError } = await supabase
      .from('product_materials')
      .select('*')
      .eq('product_id', productId);

    if (materialsError) {
      throw new Error(`Failed to fetch materials: ${materialsError.message}`);
    }

    // Plain-language warnings for the user, passed through the aggregator into
    // aggregated_impacts.calculation_warnings so they appear in the LCA report.
    const calculatorWarnings: string[] = [];

    // ── Multipack footprint path ────────────────────────────────────────────
    // A multipack is an assembly of other products. Its footprint is the sum of
    // its component products' latest completed footprints (× quantity) plus its
    // OWN packaging — ordinary product_materials packaging rows (transit/grouping
    // packaging), processed by the loop below exactly like a single SKU. We fetch
    // the component footprints up front so we can (a) allow the calculation to
    // proceed even when a multipack carries no own packaging, and (b) inject them
    // as material rows before aggregation. NOTE: this carries the component
    // climate footprint (with fossil/biogenic/DLUC split); component water/land
    // are a known v1 gap tracked separately from the headline GHG total.
    let multipackComponentFootprints: Array<{
      name: string;
      quantity: number;
      total: number;
      fossil: number;
      biogenic: number;
      dluc: number;
    }> = [];
    if (product.is_multipack) {
      const { data: mpComponents, error: mpErr } = await supabase
        .from('multipack_components')
        .select('quantity, component_product:products!component_product_id(id, name)')
        .eq('multipack_product_id', productId);
      if (mpErr) {
        throw new Error(`Failed to fetch multipack components: ${mpErr.message}`);
      }
      for (const comp of (mpComponents || []) as any[]) {
        const cp: any = comp.component_product;
        if (!cp) continue;
        // Latest completed footprint for this component product. The single
        // source of truth for a footprint is aggregated_impacts — the client
        // aggregator writes ONLY that JSON and leaves the total_ghg_emissions
        // scalar column at 0 (it is deprecated, see product-lca-aggregator).
        // We read aggregated_impacts first and fall back to the legacy columns
        // for older/seeded rows that predate aggregated_impacts.
        const { data: cpcf } = await supabase
          .from('product_carbon_footprints')
          .select('aggregated_impacts, system_boundary, total_ghg_emissions, total_ghg_emissions_fossil, total_ghg_emissions_biogenic, total_ghg_emissions_dluc')
          .eq('product_id', cp.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        const qty = Number(comp.quantity) || 0;
        const agg = (cpcf?.aggregated_impacts || null) as any;
        const componentTotal =
          agg?.climate_change_gwp100 ?? agg?.total_carbon_footprint ?? cpcf?.total_ghg_emissions ?? null;
        if (!cpcf || componentTotal == null) {
          calculatorWarnings.push(
            `The product "${cp.name || `#${cp.id}`}" in this multipack doesn't have a finished footprint yet, so it adds 0 to the multipack total. Calculate that product's footprint first, then recalculate this multipack.`
          );
          continue;
        }
        // Boundary consistency: summing a cradle-to-gate component into a
        // cradle-to-grave multipack silently omits that component's
        // distribution/use/end-of-life; the mirror case double counts them.
        // We proceed (the component's own study is its source of truth) but
        // the mismatch must be visible in the report.
        const multipackBoundary = (systemBoundary || 'cradle-to-gate').toLowerCase();
        const componentBoundary = (cpcf.system_boundary || '').toLowerCase().replace(/_/g, '-');
        if (componentBoundary && componentBoundary !== multipackBoundary) {
          calculatorWarnings.push(
            `The product "${cp.name || `#${cp.id}`}" was calculated as ${componentBoundary} but this multipack is being calculated as ${multipackBoundary}. ` +
            `The lifecycle stages covered will not line up, which can leave stages out or count them twice. ` +
            `Recalculate the component product with the same boundary as the multipack for a consistent result.`
          );
        }
        const componentFossil = agg?.total_climate_fossil ?? cpcf?.total_ghg_emissions_fossil ?? 0;
        const componentBiogenic = agg?.total_climate_biogenic ?? cpcf?.total_ghg_emissions_biogenic ?? 0;
        const componentDluc = agg?.total_climate_dluc ?? cpcf?.total_ghg_emissions_dluc ?? 0;
        // Negative totals are legitimate (biogenic-credit-heavy products);
        // clamping them to zero silently inflated the multipack. Keep the
        // signed value and note it in the report instead.
        if (Number(componentTotal) < 0) {
          calculatorWarnings.push(
            `The product "${cp.name || `#${cp.id}`}" has a net-negative footprint (${Number(componentTotal).toFixed(3)} kg CO2e per unit), which reduces the multipack total. This is usually due to carbon removals and is carried through as-is.`
          );
        }
        multipackComponentFootprints.push({
          name: cp.name || `Product ${cp.id}`,
          quantity: qty,
          total: Number(componentTotal) * qty,
          fossil: Number(componentFossil) * qty,
          biogenic: Number(componentBiogenic) * qty,
          dluc: Number(componentDluc) * qty,
        });
      }
      console.log(`[calculateProductCarbonFootprint] Multipack: aggregated ${multipackComponentFootprints.length} component footprints`);
      // Component rows carry only the climate footprint: water, land and the
      // other non-climate categories of the components are a known gap, so a
      // multipack report's non-climate figures reflect its own packaging only.
      if (multipackComponentFootprints.length > 0) {
        calculatorWarnings.push(
          `Multipack water, land and other non-carbon figures cover only the multipack's own packaging. ` +
          `The products inside contribute their carbon footprint only, so treat non-carbon categories as partial.`
        );
      }
    }

    const hasOwnMaterials = !!materials && materials.length > 0;
    if (!hasOwnMaterials && multipackComponentFootprints.length === 0) {
      throw new Error('No materials found for this product. Please add ingredients and packaging first.');
    }

    console.log(`[calculateProductCarbonFootprint] Found ${materials?.length || 0} materials to process`);
    onProgress?.(`Resolving impact factors for ${materials.length} materials...`, 20);

    // 3b. Recalculate distances based on current production facilities
    // Distances are stored at ingredient creation time and become stale when facilities change
    if (params.facilityAllocations && params.facilityAllocations.length > 0) {
      // Get coordinates for the primary (highest production share) facility
      const primaryAllocation = params.facilityAllocations[0]; // First facility is primary
      const { data: primaryFacility } = await supabase
        .from('facilities')
        .select('address_lat, address_lng, name')
        .eq('id', primaryAllocation.facilityId)
        .single();

      if (primaryFacility?.address_lat && primaryFacility?.address_lng) {
        const facilityLat = Number(primaryFacility.address_lat);
        const facilityLng = Number(primaryFacility.address_lng);
        console.log(`[calculateProductCarbonFootprint] Recalculating distances to primary facility: ${primaryFacility.name} (${facilityLat}, ${facilityLng})`);

        let updatedCount = 0;
        for (const material of materials) {
          if (material.origin_lat && material.origin_lng) {
            const newDistance = calculateDistance(
              Number(material.origin_lat),
              Number(material.origin_lng),
              facilityLat,
              facilityLng
            );

            if (newDistance !== Number(material.distance_km || 0)) {
              console.log(`[calculateProductCarbonFootprint] Distance update for ${material.material_name}: ${material.distance_km || 0} km → ${newDistance} km`);
              material.distance_km = newDistance;
              updatedCount++;

              // Persist the corrected distance back to product_materials
              await supabase
                .from('product_materials')
                .update({ distance_km: newDistance })
                .eq('id', material.id);
            }
          }
        }

        if (updatedCount > 0) {
          console.log(`[calculateProductCarbonFootprint] Updated distances for ${updatedCount} materials`);
        }
      }
    }

    // 4. Create or promote product_lca record.
    // When draftPcfId is set, we UPDATE the existing draft row in place so
    // the wizard's pre-calculation autosave state carries through to the
    // final calculation (no duplicate row). Otherwise we INSERT a fresh row.
    const corePayload = {
      organization_id: product.organization_id,
      product_id: parseInt(productId),
      product_name: product.name,
      product_description: product.product_description,
      product_image_url: product.product_image_url,
      functional_unit: buildFunctionalUnit(functionalUnit, product),
      system_boundary: systemBoundary || 'cradle-to-gate',
      reference_year: referenceYear || new Date().getFullYear(),
      lca_version: '1.0',
      lca_scope_type: systemBoundary || 'cradle-to-gate',
      status: 'pending',
    };

    let lca: any = null;
    let lcaError: any = null;
    let reusedExistingPcf = false;
    if (params.draftPcfId) {
      const { data, error } = await supabase
        .from('product_carbon_footprints')
        .update({ ...corePayload, updated_at: new Date().toISOString() })
        .eq('id', params.draftPcfId)
        .select()
        .maybeSingle();
      lca = data;
      lcaError = error;
      reusedExistingPcf = !error && !!data;
      // Stale draftPcfId (row deleted, org switched, RLS blocked, etc.):
      // UPDATE returned no row. Fall through to INSERT so the calculation
      // can still proceed instead of failing the whole run.
      if (!lcaError && !lca) {
        console.warn(
          `[calculateProductCarbonFootprint] draftPcfId ${params.draftPcfId} did not match any row; inserting a fresh PCF instead`
        );
      }
    }
    if (!lca) {
      const { data, error } = await supabase
        .from('product_carbon_footprints')
        .insert({ ...corePayload, created_at: new Date().toISOString() })
        .select()
        .single();
      lca = data;
      lcaError = error;
    }

    if (lcaError || !lca) {
      throw new Error(`Failed to create LCA: ${lcaError?.message || 'Unknown error'}`);
    }

    // Sync system_boundary to products table so list/detail pages show the correct value
    if (systemBoundary) {
      await supabase
        .from('products')
        .update({ system_boundary: boundaryToDbEnum(systemBoundary) })
        .eq('id', productId);
    }

    // Increment LCA count for subscription tracking
    try {
      await supabase.rpc('increment_lca_count', {
        p_organization_id: product.organization_id,
      });
    } catch (err) {
      // Non-critical — live COUNT(*) in get_organization_usage is the source of truth
      console.warn('[calculateProductCarbonFootprint] Failed to increment LCA count:', err);
    }

    console.log(`[calculateProductCarbonFootprint] Created LCA record: ${lca.id}`);

    // When recalculating into an existing (reused) draft PCF, the derived child
    // rows from the previous run are still attached to this PCF id. The
    // persistence below is insert-only, so without this reset each recalc would
    // APPEND a second full set — duplicating every material and production site
    // (root cause of the tripled-ingredient reports). Clear them so a recalc
    // replaces rather than accumulates. No-op for a freshly-inserted PCF.
    if (reusedExistingPcf) {
      const { error: clearMaterialsError } = await supabase
        .from('product_carbon_footprint_materials')
        .delete()
        .eq('product_carbon_footprint_id', lca.id);
      const { error: clearSitesError } = await supabase
        .from('product_carbon_footprint_production_sites')
        .delete()
        .eq('product_carbon_footprint_id', lca.id);
      if (clearMaterialsError || clearSitesError) {
        console.warn(
          `[calculateProductCarbonFootprint] ⚠️ Failed to clear stale child rows for reused PCF ${lca.id}:`,
          clearMaterialsError?.message || clearSitesError?.message
        );
      } else {
        console.log(`[calculateProductCarbonFootprint] Cleared previous-run child rows for reused PCF ${lca.id}`);
      }
    }

    onProgress?.('Processing facility allocations...', 50);

    // 4a. Handle facility allocations
    const { facilityAllocations } = params;

    // The aggregator's contract is "productVolume = units of THIS PRODUCT
    // produced" (it divides facility emissions by it for per-unit values).
    // Allocations may carry the volume in litres/hl instead (the archetype
    // proxy path defaults to litres), which silently skewed per-bottle
    // processing emissions by the bottle-size factor (~43% for a 700 ml
    // bottle). Convert volume units to functional units here; unconvertible
    // units (kg, cases, pallets) keep the previous treated-as-units
    // behaviour, with a warning so the data entry can be fixed.
    const fuSizeKnown = Number.isFinite(Number(product.unit_size_value)) && Number(product.unit_size_value) > 0;
    const fuSizeLitres = (() => {
      const v = Number(product.unit_size_value);
      if (!Number.isFinite(v) || v <= 0) return 0.75;
      const u = (product.unit_size_unit || '').toLowerCase();
      if (u === 'ml') return v / 1000;
      if (u === 'cl') return v / 100;
      return v; // assume litres
    })();
    const volumeToFunctionalUnits = (volume: number, unit: string | undefined, facilityName: string): number => {
      const vol = Number(volume) || 0;
      if (vol <= 0) return vol;
      const u = (unit || 'units').toLowerCase().trim();
      let litres: number | null = null;
      if (LITRE_FAMILY.includes(u)) litres = vol;
      else if (HECTOLITRE_FAMILY.includes(u)) litres = vol * 100;
      else if (MILLILITRE_FAMILY.includes(u)) litres = vol / 1000;
      if (litres === null) {
        if (!COUNT_FAMILY.includes(u)) {
          console.warn(
            `[calculateProductCarbonFootprint] ⚠ Production volume for ${facilityName} is in '${u}', ` +
            `which cannot be converted to functional units — treating as units. ` +
            `Enter the volume in units or litres for accurate per-unit processing emissions.`
          );
        }
        return vol;
      }
      return litres / fuSizeLitres;
    };

    const collectedFacilityEmissions: FacilityEmissionsData[] = [];

    if (facilityAllocations && facilityAllocations.length > 0) {
      // New flow: Use facility allocations provided by user
      console.log(`[calculateProductCarbonFootprint] Processing ${facilityAllocations.length} facility allocations...`);

      for (const allocation of facilityAllocations) {
        // Calculate facility emissions from utility_data_entries
        // This is the same data source used by the Company Emissions page (scope-1-2)
        let facilityTotalEmissions = 0;
        let scope1Raw = 0;
        let scope2Raw = 0;
        let totalWaterFromUtility = 0;

        // Fetch facility country code so we can apply the correct grid factor.
        // Defaults to global average if country not set (conservative/honest).
        const { data: facilityRecord } = await supabase
          .from('facilities')
          .select('location_country_code')
          .eq('id', allocation.facilityId)
          .single();

        const facilityCountryCode = facilityRecord?.location_country_code || null;
        const gridFactorResult = getGridFactor(facilityCountryCode, 'global');
        console.log(
          `[calculateProductCarbonFootprint] Grid factor for ${allocation.facilityName}` +
          ` (${facilityCountryCode ?? 'unknown'}): ${gridFactorResult.factor} kg CO2e/kWh` +
          ` — ${gridFactorResult.source}${gridFactorResult.isEstimated ? ' [ESTIMATED]' : ''}`
        );
        if (gridFactorResult.dataGapWarning) {
          console.warn(`[calculateProductCarbonFootprint] ⚠️ DATA GAP — ${allocation.facilityName}: ${gridFactorResult.dataGapWarning}`);
        }

        // ─── Facility archetype proxy branch ─────────────────────────────────
        // If the user has declared they cannot obtain primary data from this
        // facility, resolve emissions from industry-typical intensities
        // (facility_archetypes) instead of querying utility_data_entries.
        // Reported transparently per ISO 14044 §4.2.3.6.
        const collectionMode = allocation.dataCollectionMode ?? 'primary';
        if (collectionMode === 'archetype_proxy' || collectionMode === 'hybrid') {
          if (!allocation.archetypeId) {
            throw new Error(
              `Facility "${allocation.facilityName}" is set to ${collectionMode} mode but no archetype was selected. Pick a facility archetype in the wizard before recalculating.`
            );
          }
          const archetype: FacilityArchetype | null = await getFacilityArchetypeById(
            supabase as any,
            allocation.archetypeId,
          );
          if (!archetype) {
            throw new Error(
              `Facility archetype ${allocation.archetypeId} not found — reference data may not be seeded.`
            );
          }

          const proxy = resolveProxyEmissions({
            archetype,
            mode: collectionMode,
            clientProductionVolume: allocation.productionVolume,
            clientProductionUnit: allocation.productionVolumeUnit || 'litres',
            gridEmissionFactor: gridFactorResult.factor,
            gridFactorSource: gridFactorResult.source,
            overrides: allocation.hybridOverrides,
          });

          const isContractManufacturer = allocation.operationalControl === 'third_party';

          const energyBreakdown: Array<{ type: string; quantity: number; unit: string; emissions: number; scope: 'Scope 1' | 'Scope 2' }> = [];
          if (proxy.breakdown.electricityKwh > 0) {
            energyBreakdown.push({
              type: 'electricity_grid',
              quantity: proxy.breakdown.electricityKwh,
              unit: 'kWh',
              emissions: proxy.breakdown.electricityCo2eKg,
              scope: 'Scope 2',
            });
          }
          if (proxy.breakdown.naturalGasKwh > 0) {
            energyBreakdown.push({
              type: 'natural_gas',
              quantity: proxy.breakdown.naturalGasKwh,
              unit: 'kWh',
              emissions: proxy.breakdown.naturalGasCo2eKg,
              scope: 'Scope 1',
            });
          }
          if (proxy.breakdown.thermalFuelKwh > 0) {
            energyBreakdown.push({
              type: 'thermal_fuel',
              quantity: proxy.breakdown.thermalFuelKwh,
              unit: 'kWh',
              emissions: proxy.breakdown.thermalFuelCo2eKg,
              scope: 'Scope 1',
            });
          }

          collectedFacilityEmissions.push({
            facilityId: allocation.facilityId,
            facilityName: allocation.facilityName,
            isContractManufacturer,
            allocatedEmissions: proxy.breakdown.totalKg,
            scope1Emissions: proxy.breakdown.scope1Kg,
            scope2Emissions: proxy.breakdown.scope2Kg,
            allocatedWater: proxy.breakdown.waterLitres,
            allocatedWaste: 0,
            // Proxy resolution is per-unit × client volume, so the attribution
            // ratio is implicit in the volume. Surfaced as 1.0 for the report.
            attributionRatio: 1,
            productVolume: volumeToFunctionalUnits(
              allocation.productionVolume, allocation.productionVolumeUnit, allocation.facilityName,
            ),
            countryCode: facilityCountryCode || undefined,
            gridEmissionFactor: gridFactorResult.factor,
            electricityKwh: proxy.breakdown.electricityKwh,
            dataSource: 'facility_allocation',
            energyBreakdown,
            dataCollectionMode: collectionMode,
            archetypeSlug: archetype.slug,
            archetypeName: archetype.displayName,
            proxyJustification: allocation.proxyJustification,
            proxyPedigree: proxy.pedigreeScores,
            proxyUncertaintyPct: proxy.uncertaintyPct,
            proxySourceCitation: archetype.sourceCitation,
          });

          if (isContractManufacturer) {
            const cmRecord = {
              organization_id: product.organization_id,
              product_id: parseInt(productId),
              facility_id: allocation.facilityId,
              reporting_period_start: allocation.reportingPeriodStart,
              reporting_period_end: allocation.reportingPeriodEnd,
              total_facility_production_volume: allocation.facilityTotalProduction || allocation.productionVolume,
              production_volume_unit: allocation.productionVolumeUnit || 'units',
              total_facility_co2e_kg: proxy.breakdown.totalKg,
              co2e_entry_method: 'calculated_from_energy',
              client_production_volume: allocation.productionVolume,
              scope1_emissions_kg_co2e: proxy.breakdown.scope1Kg,
              scope2_emissions_kg_co2e: proxy.breakdown.scope2Kg,
              scope3_emissions_kg_co2e: 0,
              allocated_water_litres: proxy.breakdown.waterLitres,
              allocated_waste_kg: 0,
              status: 'provisional',
              is_energy_intensive_process: false,
              data_source_tag: collectionMode === 'hybrid' ? 'Hybrid - Archetype + Primary' : 'Secondary - Archetype Proxy',
              data_collection_mode: collectionMode,
              archetype_id: archetype.id,
              proxy_basis_snapshot: {
                archetype_id: archetype.id,
                slug: archetype.slug,
                display_name: archetype.displayName,
                unit: archetype.unit,
                electricity_kwh_per_unit: archetype.electricityKwhPerUnit,
                natural_gas_kwh_per_unit: archetype.naturalGasKwhPerUnit,
                thermal_fuel_kwh_per_unit: archetype.thermalFuelKwhPerUnit,
                water_litres_per_unit: archetype.waterLitresPerUnit,
                pedigree: proxy.pedigreeScores,
                uncertainty_pct: archetype.uncertaintyPct,
                source_citation: archetype.sourceCitation,
                source_url: archetype.sourceUrl,
                source_year: archetype.sourceYear,
                resolved_at: new Date().toISOString(),
                emission_factors: proxy.emissionFactors,
              },
              proxy_justification: allocation.proxyJustification ?? null,
              hybrid_overrides: collectionMode === 'hybrid' ? allocation.hybridOverrides ?? null : null,
            };

            await supabase
              .from('contract_manufacturer_allocations')
              .delete()
              .eq('product_id', parseInt(productId))
              .eq('facility_id', allocation.facilityId)
              .is('superseded_at', null);

            const { error: insertError } = await supabase
              .from('contract_manufacturer_allocations')
              .insert(cmRecord);

            if (insertError) {
              console.warn(`[calculateProductCarbonFootprint] ⚠️ Failed to insert proxy CM allocation for ${allocation.facilityName}:`, insertError);
            } else {
              console.log(`[calculateProductCarbonFootprint] 🟡 Created ${collectionMode} CM allocation for ${allocation.facilityName}: ${proxy.breakdown.totalKg.toFixed(2)} kg CO2e (${archetype.displayName})`);
            }
          }

          // Skip the primary-data utility query path for this allocation
          continue;
        }

        // ─── Check for direct production run resource data (highest quality) ───
        // Direct run data is product-specific — no attribution ratio needed for
        // electricity and water. This bypasses facility-level allocation for
        // those resources while still using utility data for Scope 1 fuels.
        // Priority in the allocation cascade:
        //   1. Direct Run Data (this check) — 95% confidence
        //   2. Facility-Level Allocation (below) — 70% confidence
        const { data: directRunData } = await supabase
          .from('production_run_resource_data')
          .select('electricity_computed_kwh, water_intake_m3, wastewater_discharge_m3, production_volume, production_volume_unit')
          .eq('product_id', parseInt(productId))
          .eq('facility_id', allocation.facilityId)
          .gte('production_date', allocation.reportingPeriodStart)
          .lte('production_date', allocation.reportingPeriodEnd);

        const hasDirectRunData = directRunData && directRunData.length > 0;
        let runElectricityKwh = 0;
        let runWaterM3 = 0;

        if (hasDirectRunData) {
          for (const run of directRunData) {
            runElectricityKwh += Number(run.electricity_computed_kwh || 0);
            runWaterM3 += Number(run.water_intake_m3 || 0);
          }
          console.log(
            `[calculateProductCarbonFootprint] ✨ DIRECT RUN DATA for ${allocation.facilityName}: ` +
            `${directRunData.length} run(s), ${runElectricityKwh.toFixed(1)} kWh electricity, ` +
            `${runWaterM3.toFixed(2)} m³ water — no allocation needed for these resources`
          );

          // Sanity guard: in the Direct Run Data path these resources are divided
          // straight by the run's production volume with no attribution, so a
          // facility-period figure entered against a small batch (or a wrong
          // production volume) silently inflates the processing footprint. Flag
          // implausible per-unit intensities so they don't reach a published report
          // unnoticed. Non-fatal — the calculation still proceeds with the data given.
          const intensityWarnings = checkRunIntensity({
            productionVolume: allocation.productionVolume,
            productionVolumeUnit: allocation.productionVolumeUnit || 'units',
            electricityKwh: runElectricityKwh,
            waterM3: runWaterM3,
          });
          for (const w of intensityWarnings) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ IMPLAUSIBLE RUN INTENSITY for ${allocation.facilityName} ` +
              `(${w.field}): ${w.perUnit} per ${w.denominatorLabel} exceeds the ${w.threshold} ceiling. ` +
              `Verify the production run resource data — this likely indicates a facility-period figure ` +
              `entered against a single product run, or an incorrect production volume.`
            );
            // Also surface to the user: this warning used to die in the console
            // where nobody would see an implausible figure reaching a report.
            calculatorWarnings.push(
              `The ${w.field} for "${allocation.facilityName}" works out to ${w.perUnit} per ${w.denominatorLabel}, which is unusually high. ` +
              `Check the production run data for this product — a whole-facility figure may have been entered against one batch, or the production volume may be wrong.`
            );
          }
        }

        const { data: utilityEntries, error: utilityError } = await supabase
          .from('utility_data_entries')
          .select('utility_type, quantity, unit, calculated_scope, reporting_period_start, reporting_period_end, refrigerant_type')
          .eq('facility_id', allocation.facilityId)
          .lte('reporting_period_start', allocation.reportingPeriodEnd)
          .gte('reporting_period_end', allocation.reportingPeriodStart);

        if (utilityError) {
          console.warn(`[calculateProductCarbonFootprint] Failed to query utility_data_entries for ${allocation.facilityName}:`, utilityError);
        }

        // Hoisted here so it is in scope for both the utility loop and the
        // activity-entries section below where the deduplication logic runs.
        let waterFromUtilityTable = 0;

        // Collect per-energy-type breakdown for report transparency
        const energyBreakdown: Array<{ type: string; quantity: number; unit: string; emissions: number; scope: 'Scope 1' | 'Scope 2' }> = [];

        if (utilityEntries && utilityEntries.length > 0) {
          console.log(`[calculateProductCarbonFootprint] Found ${utilityEntries.length} utility entries for ${allocation.facilityName}`);

          // Emission factors — DEFRA 2025 for combustion fuels (UK-authoritative and
          // widely used internationally for Scope 1 fuels).
          // Electricity (Scope 2) uses a country-specific grid factor resolved above
          // from IEA/DEFRA 2023 data, not a hardcoded UK-only value.
          // Sources:
          //   Scope 1 fuels: DEFRA 2025 GHG Conversion Factors
          //   https://www.gov.uk/government/collections/government-conversion-factors-for-greenhouse-gas-reporting
          //   Scope 2 electricity: lib/grid-emission-factors.ts (IEA 2023 / DEFRA 2025)
          //   Refrigerant HFC-134a GWP-100: IPCC AR6 (GWP = 1430)
          const EMISSION_FACTORS: Record<string, { factor: number; scope: 'Scope 1' | 'Scope 2' }> = {
            diesel_stationary: { factor: 2.68787, scope: 'Scope 1' },   // DEFRA 2025 kg CO2e/litre
            diesel_mobile: { factor: 2.68787, scope: 'Scope 1' },       // DEFRA 2025 kg CO2e/litre
            petrol_mobile: { factor: 2.31, scope: 'Scope 1' },          // DEFRA 2025 kg CO2e/litre
            natural_gas: { factor: 0.18293, scope: 'Scope 1' },         // DEFRA 2025 kg CO2e/kWh
            natural_gas_m3: { factor: 0.18293 * 10.55, scope: 'Scope 1' }, // per m³ (1 m³ ≈ 10.55 kWh) — first-class utility_type, was silently dropped
            lpg: { factor: 1.55537, scope: 'Scope 1' },                 // DEFRA 2025 kg CO2e/litre
            heavy_fuel_oil: { factor: 3.17740, scope: 'Scope 1' },      // DEFRA 2025 kg CO2e/litre
            biomass_solid: { factor: 0.01551, scope: 'Scope 1' },       // DEFRA 2025 kg CO2e/kWh
            refrigerant_leakage: { factor: 1430, scope: 'Scope 1' },    // IPCC AR6 GWP-100 HFC-134a
            // Country-specific electricity factor resolved from lib/grid-emission-factors.ts
            electricity_grid: { factor: gridFactorResult.factor, scope: 'Scope 2' },
            heat_steam_purchased: { factor: 0.1662, scope: 'Scope 2' }, // DEFRA 2025 kg CO2e/kWh
          };

          for (const entry of utilityEntries) {
            // When direct run data exists, skip electricity_grid entries from utility —
            // we have product-specific electricity measurements that are more accurate.
            // Also skip water entries — run data provides product-specific water.
            if (hasDirectRunData) {
              if (entry.utility_type === 'electricity_grid') {
                console.log(`[calculateProductCarbonFootprint] ⏭ Skipping utility electricity_grid for ${allocation.facilityName} — using direct run data instead`);
                continue;
              }
              if (entry.utility_type === 'water' || entry.utility_type === 'water_supply') {
                continue; // Water comes from run data
              }
            }

            // Overlap-matched entries are pro-rated to the share of their
            // billing period that falls inside the reporting period: a
            // 12-month bill overlapping a 3-month period must contribute
            // ~1/4 of its quantity, not all of it.
            const periodFraction = overlapFraction(
              (entry as any).reporting_period_start,
              (entry as any).reporting_period_end,
              allocation.reportingPeriodStart,
              allocation.reportingPeriodEnd,
            );
            const proratedQuantity = Number(entry.quantity) * periodFraction;

            const config = EMISSION_FACTORS[entry.utility_type];
            if (!config) {
              // Water entries in utility_data_entries (utility_type: water / water_supply)
              // are accumulated separately — NOT added to totalWaterFromUtility yet.
              // We defer the merge until after checking facility_activity_entries so we can
              // pick the best source and avoid double-counting.
              if (entry.utility_type === 'water' || entry.utility_type === 'water_supply') {
                let qty = proratedQuantity || 0;
                if (entry.unit === 'litres' || entry.unit === 'L') qty /= 1000; // normalise to m³
                waterFromUtilityTable += qty;
              }
              continue;
            }

            let co2e = proratedQuantity * config.factor;

            // Refrigerant leakage: resolve the GWP for the actual refrigerant
            // rather than assuming HFC-134a (1430). R-404A is 3922, so the flat
            // assumption understated leakage ~2.7x and disagreed with the
            // company Scope 1/2 report built from the same rows.
            if (entry.utility_type === 'refrigerant_leakage') {
              co2e = proratedQuantity * resolveRefrigerantGwp((entry as any).refrigerant_type);
            }

            // Handle natural gas m³ → kWh conversion (10.55 kWh/m³).
            // The UI writes 'm3' (utility-types defaultUnit); accept the
            // typographic 'm³' too — matching only 'm³' meant real entries
            // were treated as kWh, a 10.55x undercount.
            const unitNorm = (entry.unit || '').toLowerCase().trim();
            if (entry.utility_type === 'natural_gas' && (unitNorm === 'm3' || unitNorm === 'm³')) {
              co2e = proratedQuantity * 10.55 * config.factor;
            }

            if (config.scope === 'Scope 1') {
              scope1Raw += co2e;
            } else {
              scope2Raw += co2e;
            }
            facilityTotalEmissions += co2e;

            // Collect energy type breakdown for report
            energyBreakdown.push({
              type: entry.utility_type,
              quantity: proratedQuantity,
              unit: entry.unit || (entry.utility_type === 'natural_gas' ? 'kWh' : 'units'),
              emissions: co2e,
              scope: config.scope,
            });
          }

          console.log(`[calculateProductCarbonFootprint] Utility-based emissions for ${allocation.facilityName}:`, {
            totalEmissions: facilityTotalEmissions,
            scope1: scope1Raw,
            scope2: scope2Raw,
            waterLitres: totalWaterFromUtility,
            entryCount: utilityEntries.length,
          });
        } else {
          console.warn(`[calculateProductCarbonFootprint] No utility data entries found for ${allocation.facilityName}`);
        }

        // Query water data from facility_activity_entries (separate table from utilities).
        // Skip this query when direct run data exists — run data provides product-specific water.
        // IMPORTANT: This table and utility_data_entries can both contain water data for the
        // same facility/period. We must NOT add both to the same total — that would double-count.
        // Priority: Direct run data > facility_activity_entries > utility_data_entries.
        let waterEntries: { activity_category: string; quantity: number; unit: string }[] | null = null;
        if (!hasDirectRunData) {
          const { data: waterData, error: waterError } = await supabase
            .from('facility_activity_entries')
            .select('activity_category, quantity, unit, reporting_period_start, reporting_period_end')
            .eq('facility_id', allocation.facilityId)
            .in('activity_category', ['water_intake', 'water_recycled'])
            .lte('reporting_period_start', allocation.reportingPeriodEnd)
            .gte('reporting_period_end', allocation.reportingPeriodStart);

          if (waterError) {
            console.warn(`[calculateProductCarbonFootprint] Failed to query water data for ${allocation.facilityName}:`, waterError);
          }
          waterEntries = waterData;
        }

        // ─── Determine final emissions and water values ───
        // Two paths:
        //   A) Direct run data exists → electricity & water are product-specific (no attribution).
        //      Scope 1 fuels from utility data still need facility-level attribution.
        //   B) No run data → everything uses facility-level attribution (existing approach).

        let scope1Emissions = 0;
        let scope2Emissions = 0;
        let allocatedEmissions = 0;
        let allocatedWater = 0;
        let allocatedWaste = 0;
        let attributionRatio = 0;
        let hasVerifiedFacilityData = false;

        if (hasDirectRunData) {
          // ─── Path A: Direct run data (highest quality) ───
          // Scope 2 from direct run electricity — product-specific, no attribution needed
          const runScope2 = runElectricityKwh * gridFactorResult.factor;

          // Add direct run electricity to energy breakdown
          if (runElectricityKwh > 0) {
            energyBreakdown.push({
              type: 'electricity_grid',
              quantity: runElectricityKwh,
              unit: 'kWh',
              emissions: runScope2,
              scope: 'Scope 2',
            });
          }

          // Scope 1 from utility data (fuels, gas, etc.) — still needs attribution
          // because fuel usage is facility-level, not product-specific. Use the
          // SAME unit-normalised ratio as Path B (computeAttributionRatio), so
          // mixed units (e.g. product in litres, facility total in hectolitres)
          // don't skew the facility share by 100x and silently clamp to 100%.
          const { rawRatio: rawAttributionRatio, warnings: ratioWarnings } =
            computeAttributionRatio(allocation, fuSizeLitres, fuSizeKnown);
          if (ratioWarnings.length > 0) {
            calculatorWarnings.push(...ratioWarnings);
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ Facility allocation for ${allocation.facilityName}:`,
              ratioWarnings.join(' | ')
            );
          }
          attributionRatio = Math.min(1, Math.max(0, rawAttributionRatio));
          scope1Emissions = scope1Raw * attributionRatio;

          // Scope 2 = ONLY from direct run data (no attribution)
          // Any heat_steam_purchased from utility is still attributed (it's in scope2Raw)
          const attributedOtherScope2 = scope2Raw * attributionRatio;
          scope2Emissions = runScope2 + attributedOtherScope2;

          allocatedEmissions = scope1Emissions + scope2Emissions;

          // Water from direct run data — product-specific, no attribution
          allocatedWater = runWaterM3 * 1000; // m³ → litres
          allocatedWaste = 0;
          hasVerifiedFacilityData = true; // Direct run data is always verified

          console.log(`[calculateProductCarbonFootprint] ✨ Facility ${allocation.facilityName} — DIRECT RUN DATA path:`, {
            runElectricityKwh,
            runScope2_kgCO2e: runScope2,
            scope1FromUtility: scope1Emissions,
            otherScope2Attributed: attributedOtherScope2,
            totalAllocated: allocatedEmissions,
            waterFromRunData_litres: allocatedWater,
            attributionRatioForScope1: attributionRatio,
            gridFactor: gridFactorResult.factor,
          });
        } else {
          // ─── Path B: Facility-level allocation (existing approach) ───
          // Merge water from utility and activity tables
          let waterFromActivityTable = 0;
          if (waterEntries && waterEntries.length > 0) {
            for (const entry of waterEntries) {
              // Pro-rated to the overlap with the reporting period (see the
              // utility loop above).
              const fraction = overlapFraction(
                (entry as any).reporting_period_start,
                (entry as any).reporting_period_end,
                allocation.reportingPeriodStart,
                allocation.reportingPeriodEnd,
              );
              let quantityM3 = Number(entry.quantity || 0) * fraction;
              if (entry.unit === 'litres' || entry.unit === 'L') {
                quantityM3 = quantityM3 / 1000;
              }
              waterFromActivityTable += quantityM3;
            }
          }

          // Merge water: prefer activity_entries if present (avoids double-counting).
          if (waterFromActivityTable > 0 && waterFromUtilityTable > 0) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ WATER DOUBLE-COUNT RISK for ${allocation.facilityName}: ` +
              `Both utility_data_entries (${waterFromUtilityTable.toFixed(2)} m³) and ` +
              `facility_activity_entries (${waterFromActivityTable.toFixed(2)} m³) contain water data. ` +
              `Using facility_activity_entries only (more specific). ` +
              `Check that users are not entering water in both places.`
            );
            totalWaterFromUtility = waterFromActivityTable;
          } else if (waterFromActivityTable > 0) {
            totalWaterFromUtility = waterFromActivityTable;
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: ${waterFromActivityTable.toFixed(2)} m³ from facility_activity_entries`);
          } else if (waterFromUtilityTable > 0) {
            totalWaterFromUtility = waterFromUtilityTable;
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: ${waterFromUtilityTable.toFixed(2)} m³ from utility_data_entries (fallback)`);
          } else {
            console.log(`[calculateProductCarbonFootprint] Water for ${allocation.facilityName}: no water data found in either table`);
          }

          // CRITICAL FIX: Attribution ratio must be in [0, 1].
          // Volumes are normalised to a common unit first (litres) when the
          // two units differ, so litres-vs-hectolitres entries no longer skew
          // the facility share by 100x. Plain-language warnings surface in
          // the LCA report via calculatorWarnings.
          const { rawRatio: rawAttributionRatio, warnings: ratioWarnings } =
            computeAttributionRatio(allocation, fuSizeLitres, fuSizeKnown);
          if (ratioWarnings.length > 0) {
            calculatorWarnings.push(...ratioWarnings);
            console.warn(
              `[calculateProductCarbonFootprint] ⚠️ Facility allocation for ${allocation.facilityName}:`,
              ratioWarnings.join(' | ')
            );
          }
          attributionRatio = Math.min(1, Math.max(0, rawAttributionRatio));
          allocatedEmissions = facilityTotalEmissions * attributionRatio;
          scope1Emissions = scope1Raw * attributionRatio;
          scope2Emissions = scope2Raw * attributionRatio;

          hasVerifiedFacilityData = facilityTotalEmissions > 0;

          console.log(`[calculateProductCarbonFootprint] Facility ${allocation.facilityName} emissions data:`, {
            hasUtilityData: facilityTotalEmissions > 0,
            hasVerifiedFacilityData,
            facilityTotalEmissions,
            scope1BeforeAllocation: scope1Raw,
            scope2BeforeAllocation: scope2Raw,
            attributionRatio,
            allocatedScope1: scope1Emissions,
            allocatedScope2: scope2Emissions,
          });

          const totalWater = totalWaterFromUtility;
          const totalWaste = 0;
          allocatedWater = totalWater * attributionRatio;
          allocatedWaste = totalWaste * attributionRatio;
        }

        // Collect for aggregator (passed directly, bypasses broken DB trigger)
        const isContractManufacturer = allocation.operationalControl === 'third_party';
        // Compute total electricity kWh for this facility (attributed)
        // Pro-rate each bill by the share of its billing period inside the
        // reporting period, exactly as the emissions figure above does: a
        // 12-month bill overlapping a 3-month period contributes ~1/4 of its
        // kWh, otherwise the report's energy table cannot reconcile with its
        // CO2e figures.
        const totalElectricityKwh = hasDirectRunData
          ? runElectricityKwh
          : (utilityEntries || [])
              .filter((e: any) => e.utility_type === 'electricity_grid')
              .reduce((sum: number, e: any) => {
                const fraction = overlapFraction(
                  e.reporting_period_start,
                  e.reporting_period_end,
                  allocation.reportingPeriodStart,
                  allocation.reportingPeriodEnd,
                );
                return sum + Number(e.quantity || 0) * fraction;
              }, 0) * attributionRatio;

        collectedFacilityEmissions.push({
          facilityId: allocation.facilityId,
          facilityName: allocation.facilityName,
          isContractManufacturer,
          allocatedEmissions,
          scope1Emissions,
          scope2Emissions,
          allocatedWater,
          allocatedWaste,
          attributionRatio,
          productVolume: volumeToFunctionalUnits(
            allocation.productionVolume, allocation.productionVolumeUnit, allocation.facilityName,
          ),
          countryCode: facilityCountryCode || undefined,
          gridEmissionFactor: gridFactorResult.factor,
          electricityKwh: totalElectricityKwh,
          dataSource: hasDirectRunData ? 'direct_run' : 'facility_allocation',
          energyBreakdown: energyBreakdown.length > 0 ? energyBreakdown : undefined,
        });

        // Route to correct table based on facility ownership
        // - Owned facilities → product_carbon_footprint_production_sites (Scope 1 & 2)
        // - Third party (contract manufacturers) → contract_manufacturer_allocations (Scope 3)

        if (isContractManufacturer) {
          // Insert to contract_manufacturer_allocations table
          const cmAllocationRecord = {
            organization_id: product.organization_id,
            product_id: parseInt(productId),
            facility_id: allocation.facilityId,
            reporting_period_start: allocation.reportingPeriodStart,
            reporting_period_end: allocation.reportingPeriodEnd,
            total_facility_production_volume: allocation.facilityTotalProduction,
            production_volume_unit: allocation.productionVolumeUnit || 'units',
            total_facility_co2e_kg: hasDirectRunData ? allocatedEmissions : facilityTotalEmissions,
            co2e_entry_method: hasDirectRunData ? 'direct_run_data' : 'direct',
            client_production_volume: allocation.productionVolume,
            // These are auto-calculated by trigger but we can provide them:
            // attribution_ratio, allocated_emissions_kg_co2e, emission_intensity_kg_co2e_per_unit
            scope1_emissions_kg_co2e: scope1Emissions,
            scope2_emissions_kg_co2e: scope2Emissions,
            scope3_emissions_kg_co2e: 0,
            allocated_water_litres: allocatedWater,
            allocated_waste_kg: allocatedWaste,
            status: hasVerifiedFacilityData ? 'verified' : 'provisional',
            is_energy_intensive_process: false,
            data_source_tag: hasDirectRunData ? 'Direct_Run_Data' : (hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input'),
          };

          // Delete any existing allocations for this product/facility to avoid
          // "overlapping allocation periods" constraint violation, then insert fresh.
          await supabase
            .from('contract_manufacturer_allocations')
            .delete()
            .eq('product_id', parseInt(productId))
            .eq('facility_id', allocation.facilityId);

          const { error: insertError } = await supabase
            .from('contract_manufacturer_allocations')
            .insert(cmAllocationRecord);

          if (insertError) {
            console.warn(`[calculateProductCarbonFootprint] ⚠️ Failed to insert CM allocation for ${allocation.facilityName}:`, insertError);
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Created contract manufacturer allocation for ${allocation.facilityName}: ${allocatedEmissions.toFixed(2)} kg CO2e (Scope 3)`);
          }
        } else {
          // Insert to product_carbon_footprint_production_sites table for owned facilities
          // Safeguard against division by zero for intensity calculations
          const safeProductionVolume = allocation.productionVolume > 0 ? allocation.productionVolume : 1;

          const productionSiteRecord = {
            product_carbon_footprint_id: lca.id,
            organization_id: product.organization_id,
            facility_id: allocation.facilityId,
            production_volume: allocation.productionVolume,
            share_of_production: attributionRatio * 100,
            facility_intensity: facilityTotalEmissions > 0 && allocation.facilityTotalProduction > 0
              ? facilityTotalEmissions / allocation.facilityTotalProduction
              : 0,
            // IMPORTANT: data_source has CHECK constraint: only 'Verified' or 'Industry_Average' allowed
            data_source: hasVerifiedFacilityData ? 'Verified' : 'Industry_Average',
            reporting_period_start: allocation.reportingPeriodStart,
            reporting_period_end: allocation.reportingPeriodEnd,
            attribution_ratio: attributionRatio * 100,
            allocated_emissions_kg_co2e: allocatedEmissions,
            allocated_water_litres: allocatedWater,
            allocated_waste_kg: allocatedWaste,
            emission_intensity_kg_co2e_per_unit: allocatedEmissions / safeProductionVolume,
            water_intensity_litres_per_unit: allocatedWater / safeProductionVolume,
            waste_intensity_kg_per_unit: allocatedWaste / safeProductionVolume,
            scope1_emissions_kg_co2e: scope1Emissions,
            scope2_emissions_kg_co2e: scope2Emissions,
            status: hasVerifiedFacilityData ? 'verified' : 'provisional',
            is_energy_intensive_process: false,
            uses_proxy_data: !hasVerifiedFacilityData,
            data_source_tag: hasDirectRunData ? 'Direct_Run_Data' : (hasVerifiedFacilityData ? 'Facility_Verified' : 'User_Input'),
            co2e_entry_method: hasDirectRunData ? 'Direct Run Data' : 'Production Volume Allocation',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          console.log(`[calculateProductCarbonFootprint] Attempting to insert owned production site:`, {
            facilityId: allocation.facilityId,
            facilityName: allocation.facilityName,
            operationalControl: allocation.operationalControl,
            productionVolume: allocation.productionVolume,
            allocatedEmissions,
            scope1Emissions,
            scope2Emissions,
          });

          const { error: insertError } = await supabase
            .from('product_carbon_footprint_production_sites')
            .insert(productionSiteRecord);

          if (insertError) {
            console.error(`[calculateProductCarbonFootprint] ❌ Failed to insert owned production site for ${allocation.facilityName}:`, {
              errorMessage: insertError.message,
              errorCode: insertError.code,
              errorDetails: insertError.details,
              errorHint: insertError.hint,
              record: productionSiteRecord,
            });
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Created owned production site for ${allocation.facilityName}: ${allocatedEmissions.toFixed(2)} kg CO2e (Scope 1/2)`);
          }
        }
      }
    } else {
      // Legacy flow: Copy owned production site allocations from previous PCF (if any)
      // This ensures Scope 1/2 data persists across PCF recalculations
      const { data: previousPCF } = await supabase
        .from('product_carbon_footprints')
        .select('id')
        .eq('product_id', parseInt(productId))
        .neq('id', lca.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (previousPCF) {
        console.log(`[calculateProductCarbonFootprint] Found previous PCF: ${previousPCF.id}, checking for owned production sites...`);

        const { data: previousSites, error: sitesError } = await supabase
          .from('product_carbon_footprint_production_sites')
          .select('*')
          .eq('product_carbon_footprint_id', previousPCF.id);

        if (sitesError) {
          console.warn('[calculateProductCarbonFootprint] ⚠️ Failed to query previous production sites:', sitesError);
        } else if (previousSites && previousSites.length > 0) {
          console.log(`[calculateProductCarbonFootprint] Found ${previousSites.length} owned production sites from previous PCF`);

          // Copy sites to new PCF (excluding id and timestamps)
          const newSites = previousSites.map(site => {
            const { id: _id, created_at: _createdAt, updated_at: _updatedAt, ...siteData } = site;
            return {
              ...siteData,
              product_carbon_footprint_id: lca.id,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          });

          const { error: insertError } = await supabase
            .from('product_carbon_footprint_production_sites')
            .insert(newSites);

          if (insertError) {
            console.warn('[calculateProductCarbonFootprint] ⚠️ Failed to copy production sites:', insertError);
            console.warn('[calculateProductCarbonFootprint] This may affect Scope 1/2 calculations');
          } else {
            console.log(`[calculateProductCarbonFootprint] ✅ Copied ${newSites.length} owned production sites to new PCF`);

            // HIGH FIX #26: Also populate collectedFacilityEmissions from the copied sites
            // so that Scope 1/2 processing emissions are included in the aggregation.
            // Previously the legacy flow left collectedFacilityEmissions empty, causing
            // all processing emissions to be zero in the aggregated result even when
            // facility data existed in the DB.
            for (const site of newSites) {
              collectedFacilityEmissions.push({
                facilityId: site.facility_id || '',
                facilityName: `Facility (legacy copy from ${previousPCF.id.substring(0, 8)})`,
                isContractManufacturer: false,
                allocatedEmissions: site.allocated_emissions_kg_co2e || 0,
                scope1Emissions: site.scope1_emissions_kg_co2e || 0,
                scope2Emissions: site.scope2_emissions_kg_co2e || 0,
                allocatedWater: site.allocated_water_litres || 0,
                allocatedWaste: site.allocated_waste_kg || 0,
                attributionRatio: site.attribution_ratio || 1,
                // Pass the raw volume: a missing value must reach the
                // aggregator's invalid-volume guard (which excludes the
                // facility with a visible warning) rather than silently
                // becoming 1 and booking the whole run against one unit.
                productVolume: Number(site.production_volume) || 0,
              });
            }

            // Log the emissions being carried forward
            const totalCopiedEmissions = newSites.reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
            const totalScope1 = newSites.reduce((sum, s) => sum + (s.scope1_emissions_kg_co2e || 0), 0);
            const totalScope2 = newSites.reduce((sum, s) => sum + (s.scope2_emissions_kg_co2e || 0), 0);
            console.log(`[calculateProductCarbonFootprint] Copied emissions: Total=${totalCopiedEmissions.toFixed(2)} kg, Scope1=${totalScope1.toFixed(2)} kg, Scope2=${totalScope2.toFixed(2)} kg`);
          }
        } else {
          console.log('[calculateProductCarbonFootprint] No owned production sites found in previous PCF');
        }
      } else {
        console.log('[calculateProductCarbonFootprint] No previous PCF found, skipping production site copy');
      }
    }

    // 5. Resolve impact factors for each material using waterfall logic
    const lcaMaterialsWithImpacts = [];
    const fallbackEvents: FallbackEvent[] = [];

    // Load pinned factors if pinnedPcfId is set (idempotent recalculation mode)
    let pinnedMaterials: Map<string, any> | null = null;
    if (params.pinnedPcfId) {
      console.log(`[calculateProductCarbonFootprint] Pinned mode: loading factors from PCF ${params.pinnedPcfId}`);
      const { data: prevMaterials } = await supabase
        .from('product_carbon_footprint_materials')
        .select('*')
        .eq('product_carbon_footprint_id', params.pinnedPcfId);
      if (prevMaterials && prevMaterials.length > 0) {
        // Key by the originating product_materials id when the previous PCF
        // recorded it (source_material_id); fall back to material_name for
        // PCFs persisted before that column existed. Name keys collapse
        // duplicate-named rows, which is exactly why the id key exists.
        pinnedMaterials = new Map(
          prevMaterials.map((m: any) => [
            m.source_material_id ? String(m.source_material_id) : m.material_name,
            m,
          ])
        );
        console.log(`[calculateProductCarbonFootprint] Pinned mode: loaded ${pinnedMaterials.size} material factors`);
      } else {
        console.warn(`[calculateProductCarbonFootprint] Pinned mode: no materials found for PCF ${params.pinnedPcfId}, falling back to live resolution`);
      }
    }

    // Fetch production stages (v2). Empty array means v1 batch-mode applies.
    const { data: stagesRows } = await supabase
      .from('production_stages')
      .select('*')
      .eq('product_id', productId)
      .order('ordinal', { ascending: true });
    const productionStages: ProductionStage[] = (stagesRows || []) as ProductionStage[];

    // Resolve the per-bottle allocation divisor. Production-chain mode uses the
    // bottling stage's output volume as the source of truth for total bottles.
    // If no chain is defined, fall back to v1 per_batch / per_unit semantics.
    let chainDivisor: number;
    if (productionStages.length > 0) {
      const bottling = productionStages.find(s => s.stage_type === 'bottling');
      const sizeUnit = (product.unit_size_unit || '').toString().toLowerCase();
      const sizeFactor = sizeUnit === 'ml' ? 0.001 : sizeUnit === 'l' ? 1 : null;
      if (
        bottling?.output_volume_l &&
        bottling.output_volume_l > 0 &&
        product.unit_size_value &&
        sizeFactor
      ) {
        const bottleLitres = Number(product.unit_size_value) * sizeFactor;
        chainDivisor = bottling.output_volume_l / bottleLitres;
      } else {
        throw new Error(
          'Production chain is configured but the bottling stage is missing output_volume_l ' +
          'or the product has no unit_size_value/unit_size_unit. Allocation cannot proceed.',
        );
      }
    } else {
      chainDivisor = computeBottlesPerBatch(product);
    }
    const bottlesPerBatch = chainDivisor;
    console.log(
      `[calculateProductCarbonFootprint] Allocation divisor: ${chainDivisor} bottles ` +
      `(${productionStages.length > 0 ? 'production-chain' : 'v1 batch-mode/per-unit'})`,
    );

    // The batch/chain divisor allocates BATCH-scoped quantities to one
    // functional unit. Only ingredient quantities are entered per batch: the
    // packaging forms (and the live impact preview) are strictly per-unit, so
    // packaging rows must never be divided or they collapse towards zero for
    // every per_batch and production-chain product.
    const isPackagingRow = (m: { material_type?: string | null }) => {
      const t = (m.material_type || '').toLowerCase();
      return t === 'packaging' || t === 'packaging_material';
    };
    const allocationDivisorFor = (m: { material_type?: string | null }) =>
      isPackagingRow(m) ? 1 : bottlesPerBatch;

    // Pre-resolve all impact factors in parallel (OpenLCA calls are the slow part).
    // This turns N sequential API calls into concurrent ones, capped at 4 to avoid
    // overwhelming the OpenLCA server.
    const OPENLCA_CONCURRENCY = 4;
    // Keyed by the material row's uuid, never by name: duplicate-named rows
    // (e.g. the same ingredient from two suppliers at different quantities)
    // used to overwrite each other in this map, booking one row's
    // quantity-scaled impact twice.
    const resolvedFactors = new Map<string, WaterfallResult>();
    const getPinnedRow = (m: any) =>
      pinnedMaterials?.get(String(m.id)) ?? pinnedMaterials?.get(m.material_name) ?? null;
    // Factor UUIDs actually used, collected for the ISO 14067 §6.5.6 audit log.
    // Tracked separately because lcaMaterial rows are inserted verbatim and the
    // PCF materials table has no resolved_factor_id column.
    const resolvedFactorIdsUsed: string[] = [];

    // Build list of materials that need live resolution (not pinned)
    const materialsToResolve = materials.filter(m => !getPinnedRow(m));

    // ------------------------------------------------------------------
    // Parametric packaging: factors are DERIVED, never searched.
    // A packaging row with a parametric material class resolves as a pure
    // function of (endpoint library row, recycled content, weight) — the
    // same inputs always produce the same number. Supplier-declared rows
    // keep the supplier path (primary data beats the parametric model);
    // gap-filler composite classes pin their curated staging factor by ID;
    // legacy rows without a class fall through to the old resolver with a
    // visible data-quality warning until the Phase 3 backfill maps them.
    // ------------------------------------------------------------------
    const isSupplierMaterial = (m: any) =>
      m.data_source === 'supplier' || Boolean(m.supplier_product_id);
    const isParametricMaterial = (m: any) =>
      isPackagingRow(m) && !isSupplierMaterial(m) && isParametricClass(m.packaging_material_class);

    const parametricMaterials = materialsToResolve.filter(isParametricMaterial);
    const materialsForResolver = materialsToResolve.filter(m => !isParametricMaterial(m));
    // Endpoint + derivation pinned per material row id, written onto the
    // PCF material snapshot below (reproducibility across library updates).
    const parametricEndpointByMaterialId = new Map<string, PackagingFactorEndpoint>();

    if (parametricMaterials.length > 0) {
      const wanted = parametricMaterials.map((m: any) => ({
        materialClass: m.packaging_material_class as string,
        variant: resolveVariant(m.packaging_material_class, m.packaging_material_variant),
        // Endpoints are curated per region with EU-27 -> GLO fallback inside
        // the fetch; origin country rarely matches a curated region directly.
        region: m.origin_country_code || 'EU-27',
      }));
      const endpoints = await fetchActivePackagingEndpoints(supabase, wanted);
      parametricMaterials.forEach((m: any, i) => {
        const w = wanted[i];
        const endpoint = endpoints.get(endpointLookupKey(w.materialClass, w.variant, w.region));
        if (!endpoint) {
          // Every parametric class is guaranteed a seeded endpoint; a miss is
          // a factor-library curation bug, not a user-data condition.
          throw new Error(
            `No packaging factor endpoint found for material class "${w.materialClass}" (${w.variant}). ` +
            `The packaging factor library is missing an entry — contact support.`,
          );
        }
        const quantityKg = normalizeToKg(m.quantity, m.unit) / allocationDivisorFor(m);
        resolvedFactors.set(String(m.id), derivePackagingFactor({
          endpoint,
          recycledContentPct: m.recycled_content_percentage,
          quantityKg,
        }));
        parametricEndpointByMaterialId.set(String(m.id), endpoint);
      });
      console.log(`[calculateProductCarbonFootprint] Derived ${parametricMaterials.length} parametric packaging factors`);
    }

    // Gap-filler composite classes (bag-in-box, laminate pouch, liquid
    // carton): force resolution to the curated staging factor BY ID so the
    // row can never fuzzy-match, regardless of what was saved on it.
    for (const m of materialsForResolver as any[]) {
      if (!isPackagingRow(m) || isSupplierMaterial(m)) continue;
      const classDef = getMaterialClass(m.packaging_material_class);
      if (classDef?.kind === 'gap_filler' && classDef.gapFillerFactorId) {
        m.data_source = 'openlca';
        m.data_source_id = classDef.gapFillerFactorId;
      } else if (!classDef) {
        // Legacy packaging row: still resolves via the old (now
        // category-scoped and deterministically ordered) path, but flagged.
        calculatorWarnings.push(
          `"${m.material_name}" predates packaging material classes, so its emission factor was matched by name. ` +
          `Edit the item and choose a material class for a fully reproducible factor.`
        );
        fallbackEvents.push({
          material_name: m.material_name,
          material_id: m.id?.toString() ?? '',
          attempted_priority: 'parametric packaging',
          resolved_priority: 3,
          fallback_reason: 'No packaging material class assigned; factor resolved via legacy name matching.',
          factor_value_kg_co2e: 0,
          source_reference: 'Legacy packaging resolution',
          category: 'data_quality',
        });
      }
    }

    if (materialsForResolver.length > 0) {
      console.log(`[calculateProductCarbonFootprint] Resolving ${materialsForResolver.length} materials in parallel (concurrency: ${OPENLCA_CONCURRENCY})`);

      // Semaphore-based concurrency limiter
      const queue = materialsForResolver.map(m => async () => {
        const quantityKg = normalizeToKg(m.quantity, m.unit) / allocationDivisorFor(m);
        console.log(`[calculateProductCarbonFootprint] Processing material: ${m.material_name} (${quantityKg} kg)`);
        console.log(`[calculateProductCarbonFootprint] Material OpenLCA data:`, {
          data_source: m.data_source,
          data_source_id: m.data_source_id,
          organization_id: product.organization_id,
        });
        const result = await resolveImpactFactors(m as ProductMaterial, quantityKg, product.organization_id, fallbackEvents, ctx);
        resolvedFactors.set(String(m.id), result);
      });

      // Run with concurrency limit
      const results: Promise<void>[] = [];
      const executing = new Set<Promise<void>>();
      for (const task of queue) {
        const p = task();
        results.push(p);
        executing.add(p);
        const cleanup = () => { executing.delete(p); };
        p.then(cleanup, cleanup);
        if (executing.size >= OPENLCA_CONCURRENCY) {
          await Promise.race(executing);
        }
      }
      await Promise.allSettled(results);

      // Ingredient factor pinning: when a row with NO pinned factor resolved
      // through the priority-3 local fallback (name/keyword matching), write
      // the winning factor's id back onto product_materials so the choice
      // never drifts on later runs (a new library row changing an unpinned
      // fuzzy match is exactly how the two-run packaging swing happened).
      // Packaging (parametric now), supplier and integration-owned rows are
      // excluded. Non-fatal: a failed write just means re-resolution next run.
      try {
        const pinUpdates = materialsForResolver.filter((m: any) => {
          if (isPackagingRow(m)) return false;
          if (m.data_source_id) return false;
          if (m.data_source && m.data_source !== 'openlca') return false;
          const r = resolvedFactors.get(String(m.id));
          return Boolean(r && r.data_priority === 3 && r.resolved_factor_id && m.id);
        });
        for (const m of pinUpdates as any[]) {
          const r = resolvedFactors.get(String(m.id))!;
          const { error: pinError } = await supabase
            .from('product_materials')
            .update({
              data_source: 'openlca',
              data_source_id: r.resolved_factor_id,
              matched_source_name: (m as any).matched_source_name || r.source_reference,
            })
            .eq('id', m.id);
          if (pinError) {
            console.warn(`[calculateProductCarbonFootprint] Factor pin write-back failed for ${m.material_name}:`, pinError.message);
          } else {
            console.log(`[calculateProductCarbonFootprint] Pinned factor ${r.resolved_factor_id} onto ${m.material_name}`);
          }
        }
      } catch (pinErr: any) {
        console.warn('[calculateProductCarbonFootprint] Factor pin write-back failed (non-fatal):', pinErr?.message);
      }
    }

    for (const material of materials) {
      try {
        // Normalize quantity to kg, allocating batch totals to the functional
        // unit. Packaging rows are already per-unit and are never divided.
        const normalised = tryNormalizeToKg(material.quantity, material.unit);
        const quantityKg = normalised.kg / allocationDivisorFor(material);

        // An unrecognised unit passes through as kg, which can be wildly wrong.
        // Surface it as a data-quality warning instead of failing silently.
        if (!normalised.recognised) {
          fallbackEvents.push({
            material_name: material.material_name,
            material_id: material.id?.toString() ?? '',
            attempted_priority: 'unit normalisation',
            resolved_priority: 0,
            fallback_reason: `Quantity unit '${material.unit}' was not recognised, so the value was treated as kilograms. Please change this item's unit to one from the unit list.`,
            factor_value_kg_co2e: 0,
            source_reference: 'Unit conversion',
            category: 'data_quality',
          });
        }

        // Mass plausibility (same rules the entry forms use, applied here so
        // imported, legacy, and placeholder rows that never went through a
        // form are also caught). A 1 kg "aluminium can" is a placeholder or
        // entry mistake, not a can — flag it in the report rather than
        // silently inflating the footprint. Advisory only; never blocks.
        // Skipped for count units (mass is meaningless) and unrecognised
        // units (already warned above).
        if (normalised.recognised && (normalised.kind === 'mass' || normalised.kind === 'volume') && quantityKg > 0) {
          const materialTypeForCheck = (material.material_type || '').toLowerCase();
          const unitSizeMl = fuSizeKnown ? fuSizeLitres * 1000 : null;
          if (materialTypeForCheck === 'packaging' || materialTypeForCheck === 'packaging_material') {
            const check = checkPackagingWeight({
              packagingCategory: material.packaging_category,
              materialName: material.material_name,
              containerSizeMl: unitSizeMl,
              weightG: quantityKg * 1000,
            });
            if (check.level === 'warning' && check.message) {
              calculatorWarnings.push(`${material.material_name}: ${check.message}`);
            }
          } else if (materialTypeForCheck === 'ingredient') {
            const check = checkIngredientAmount({
              amountKgPerUnit: quantityKg,
              unitSizeMl,
              ingredientName: material.material_name,
            });
            if (check.level === 'warning' && check.message) {
              calculatorWarnings.push(check.message);
            }
          }
        }

        // Count-vs-kg factor mismatch: a count quantity ("6 units") passes
        // through unchanged, but reference factors (ecoinvent, DEFRA, staging)
        // are overwhelmingly per kilogram — multiplying books each item as if
        // it weighed 1 kg. Supplier-declared factors are exempt (they are
        // frequently genuinely per item).
        if (
          normalised.recognised &&
          normalised.kind === 'count' &&
          quantityKg > 0 &&
          material.data_source !== 'supplier'
        ) {
          calculatorWarnings.push(
            `"${material.material_name}" is measured as a count (${material.quantity} ${material.unit}), but its matched emission factor is very likely per kilogram, so each item was treated as weighing 1 kg. ` +
            `Edit the item and enter its weight in grams or kilograms for an accurate figure.`
          );
        }

        // Use pre-resolved factors (parallel) or pinned factors
        let resolved: WaterfallResult;
        // Pinned rows come from a previously persisted PCF, so their stored
        // impacts ALREADY include the reuse amortisation, recycled-content
        // credit, units_per_group allocation, and inbound-container carbon
        // applied below. Those steps must be skipped for pinned materials or
        // they compound on every pinned recalculation.
        const pinnedRow = getPinnedRow(material);
        const isPinned = pinnedRow !== null;
        if (isPinned) {
          console.log(`[calculateProductCarbonFootprint] Using pinned factors for: ${material.material_name}`);
          resolved = buildResultFromPinnedMaterial(pinnedRow, quantityKg);
        } else if (resolvedFactors.has(String(material.id))) {
          resolved = resolvedFactors.get(String(material.id))!;
        } else {
          // Fallback: resolve individually (should not happen, but safe)
          resolved = await resolveImpactFactors(material as ProductMaterial, quantityKg, product.organization_id, fallbackEvents, ctx);
        }

        // Calculate transport emissions (multi-modal preferred, single-leg fallback)
        let transportEmissions = 0;
        if (material.transport_legs && material.transport_legs.length > 0) {
          // Multi-modal: sum emissions across all legs
          try {
            const distResult = await calculateDistributionEmissions({
              legs: material.transport_legs,
              productWeightKg: quantityKg,
            });
            transportEmissions = distResult.total;
            console.log(
              `[calculateProductCarbonFootprint] ✓ Multi-modal transport for ${material.material_name}: ` +
              `${transportEmissions.toFixed(4)} kg CO2e (${material.transport_legs.length} legs)`
            );
          } catch (error: any) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Failed multi-modal transport for ${material.material_name}:`,
              error.message
            );
          }
        } else if (material.transport_mode && material.distance_km) {
          // Legacy single-leg fallback (old rows without transport_legs)
          try {
            const transportResult = await calculateTransportEmissions({
              weightKg: quantityKg,
              distanceKm: Number(material.distance_km),
              transportMode: material.transport_mode as TransportMode
            });
            transportEmissions = transportResult.emissions;
            console.log(
              `[calculateProductCarbonFootprint] ✓ Transport emissions for ${material.material_name}: ` +
              `${transportEmissions.toFixed(4)} kg CO2e (${material.transport_mode}, ${material.distance_km} km)`
            );
          } catch (error: any) {
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Failed to calculate transport emissions for ${material.material_name}:`,
              error.message
            );
          }
        }

        // Circularity: reuse + recycled content.
        // For reusable containers (firkin = 100 trips, keg = 150, refillable
        // bottle = 30) the same physical item serves multiple sales, so the
        // per-unit packaging impact is 1/N of the single-trip impact. The
        // quantity column stores the full container weight; we amortise here.
        //
        // Recycled-content credit (LEGACY rows only): recycled inputs carry a
        // material-specific share of the virgin footprint (PAS 2050 cut-off
        // convention), applied as a post-hoc climate multiplier. Parametric
        // rows NEVER take this credit — their recycled content is already in
        // the endpoint interpolation — and supplier rows carry declared
        // impacts that must not be adjusted.
        const isParametricResolvedRow = parametricEndpointByMaterialId.has(String(material.id));
        const isSupplierResolvedRow = isSupplierMaterial(material);
        const rawReuseTrips = (material as any).reuse_trips;
        const reuseTrips = Number.isFinite(Number(rawReuseTrips)) && Number(rawReuseTrips) >= 1
          ? Number(rawReuseTrips)
          : 1;
        const rawRecycledPct = (material as any).recycled_content_percentage;
        const recycledPct = Number.isFinite(Number(rawRecycledPct))
          ? Math.max(0, Math.min(100, Number(rawRecycledPct)))
          : 0;
        // Material-specific displacement (aluminium saves far more than glass)
        // rather than a flat 0.5 for everything, and NO credit when the
        // resolved factor's own name says it already embeds recycled content
        // (e.g. "glass, 60% cullet") — applying it again double-counted.
        const materialKeyForCredit = getMaterialFactorKey(
          material.packaging_category || '',
          material.material_name,
          (material as any).matched_source_name || undefined,
        );
        const displacementRate =
          RECYCLED_CONTENT_DISPLACEMENT[materialKeyForCredit] ?? DEFAULT_RECYCLED_CONTENT_CREDIT;
        const factorNameForCreditCheck = [
          (material as any).matched_source_name,
          resolved.source_reference,
        ].filter(Boolean).join(' ');
        const factorEmbedsRecycled = FACTOR_EMBEDS_RECYCLED_CONTENT.test(factorNameForCreditCheck);
        if (factorEmbedsRecycled && recycledPct > 0) {
          console.log(
            `[calculateProductCarbonFootprint] Skipping recycled-content credit for ${material.material_name}: ` +
            `the matched factor ("${factorNameForCreditCheck.slice(0, 80)}") already embeds recycled content`
          );
        }
        const recycledMultiplier = factorEmbedsRecycled
          ? 1
          : 1 - (recycledPct / 100) * displacementRate;

        if (!isPinned && material.material_type === 'packaging' && reuseTrips > 1) {
          console.log(
            `[calculateProductCarbonFootprint] Applying reuse amortisation: ÷${reuseTrips} trips for ${material.material_name}`
          );
          resolved.impact_climate /= reuseTrips;
          resolved.impact_climate_fossil /= reuseTrips;
          resolved.impact_climate_biogenic /= reuseTrips;
          resolved.impact_climate_dluc /= reuseTrips;
          if (resolved.ch4_kg) resolved.ch4_kg /= reuseTrips;
          if (resolved.ch4_fossil_kg) resolved.ch4_fossil_kg /= reuseTrips;
          if (resolved.ch4_biogenic_kg) resolved.ch4_biogenic_kg /= reuseTrips;
          if (resolved.n2o_kg) resolved.n2o_kg /= reuseTrips;
          resolved.impact_water /= reuseTrips;
          resolved.impact_water_scarcity /= reuseTrips;
          resolved.impact_land /= reuseTrips;
          resolved.impact_waste /= reuseTrips;
          if (resolved.impact_terrestrial_ecotoxicity) resolved.impact_terrestrial_ecotoxicity /= reuseTrips;
          if (resolved.impact_freshwater_eutrophication) resolved.impact_freshwater_eutrophication /= reuseTrips;
          if (resolved.impact_terrestrial_acidification) resolved.impact_terrestrial_acidification /= reuseTrips;
          if (resolved.impact_fossil_resource_scarcity) resolved.impact_fossil_resource_scarcity /= reuseTrips;
          transportEmissions /= reuseTrips;
        }

        if (
          !isPinned &&
          !isParametricResolvedRow &&
          !isSupplierResolvedRow &&
          material.material_type === 'packaging' &&
          recycledMultiplier < 1
        ) {
          console.log(
            `[calculateProductCarbonFootprint] Applying recycled-content credit: ×${recycledMultiplier.toFixed(3)} (${recycledPct}% recycled) for ${material.material_name}`
          );
          resolved.impact_climate *= recycledMultiplier;
          resolved.impact_climate_fossil *= recycledMultiplier;
          resolved.impact_climate_biogenic *= recycledMultiplier;
          resolved.impact_climate_dluc *= recycledMultiplier;
        }

        // ISO 14044 §4.3.4.2 — Physical allocation for shared packaging
        // Secondary/shipment/tertiary packaging serves multiple product units.
        // Divide all impacts by units_per_group to get the per-unit share.
        // Primary packaging (container/label/closure) always has units_per_group=1 (no-op).
        //
        // CRITICAL FIX #4: Validate units_per_group before dividing.
        // A zero or NaN value would produce Infinity or NaN in all downstream
        // impact calculations, silently corrupting the entire carbon footprint.
        // We guard against this and warn with a recoverable fallback of 1.
        //
        // CRITICAL FIX #6: Secondary packaging without units_per_group used to
        // silently default to 1, meaning the full packaging impact was attributed
        // to each unit rather than being shared — a systematic over-count.
        // Now we warn explicitly so the data entry issue is surfaced.
        //
        // The divisor itself comes from getPackagingUnitsPerGroup(), the same
        // helper the EoL path uses, so production and end-of-life can never
        // amortise the same packaging by different amounts.
        const materialTypeLower = (material.material_type || '').toLowerCase();
        const isSharedPackaging = (
          (materialTypeLower === 'packaging' || materialTypeLower === 'packaging_material') &&
          SHARED_PACKAGING_CATEGORIES.includes((material.packaging_category || '').toLowerCase())
        );

        const unitsPerGroup = getPackagingUnitsPerGroup(material as any);
        // Only warn when units_per_group is genuinely missing/invalid. An
        // explicit 1 (e.g. one shipper per unit, or the multipack builder's
        // deliberate per-pack rows) is valid data, and warning on it put a
        // false alarm in every multipack report.
        const rawUnitsPerGroupValue = Number((material as any).units_per_group);
        const unitsPerGroupIsExplicit = Number.isFinite(rawUnitsPerGroupValue) && rawUnitsPerGroupValue >= 1;
        if (isSharedPackaging && unitsPerGroup === 1 && !unitsPerGroupIsExplicit) {
          console.warn(
            `[calculateProductCarbonFootprint] ⚠️ PACKAGING ALLOCATION: "${material.material_name}" ` +
            `(${material.packaging_category}) is shared packaging but has no valid units_per_group ` +
            `(value: ${(material as any).units_per_group}). Defaulting to 1 (full impact per unit — likely an over-count).`
          );
          calculatorWarnings.push(
            `The packaging item "${material.material_name}" is a multipack or shipping pack, but it doesn't say how many products share it. ` +
            `Its full impact has been counted against every single unit, which likely overstates the footprint. ` +
            `Edit this packaging item and set "units per pack" to fix this.`
          );
        }

        if (!isPinned && unitsPerGroup > 1) {
          console.log(`[calculateProductCarbonFootprint] Applying packaging allocation: ÷${unitsPerGroup} units for ${material.material_name}`);
          // Divide all resolved impact values by units served
          resolved.impact_climate /= unitsPerGroup;
          resolved.impact_climate_fossil /= unitsPerGroup;
          resolved.impact_climate_biogenic /= unitsPerGroup;
          resolved.impact_climate_dluc /= unitsPerGroup;
          if (resolved.ch4_kg) resolved.ch4_kg /= unitsPerGroup;
          if (resolved.ch4_fossil_kg) resolved.ch4_fossil_kg /= unitsPerGroup;
          if (resolved.ch4_biogenic_kg) resolved.ch4_biogenic_kg /= unitsPerGroup;
          if (resolved.n2o_kg) resolved.n2o_kg /= unitsPerGroup;
          resolved.impact_water /= unitsPerGroup;
          resolved.impact_water_scarcity /= unitsPerGroup;
          resolved.impact_land /= unitsPerGroup;
          resolved.impact_waste /= unitsPerGroup;
          if (resolved.impact_terrestrial_ecotoxicity) resolved.impact_terrestrial_ecotoxicity /= unitsPerGroup;
          if (resolved.impact_freshwater_eutrophication) resolved.impact_freshwater_eutrophication /= unitsPerGroup;
          if (resolved.impact_terrestrial_acidification) resolved.impact_terrestrial_acidification /= unitsPerGroup;
          if (resolved.impact_fossil_resource_scarcity) resolved.impact_fossil_resource_scarcity /= unitsPerGroup;
          // Transport of the packaging itself is also shared
          transportEmissions /= unitsPerGroup;
        }

        // ──────────────────────────────────────────────────────────────
        // Impact decomposition adjustments
        //
        // When we have decomposed impacts from OpenLCA contribution analysis,
        // we can replace the generic ecoinvent transport/electricity with
        // user-specific values:
        //
        // Transport: If user provided origin + mode + distance, use their
        //   DEFRA-calculated transport instead of ecoinvent's generic transport.
        //   adjusted = (total - embedded_transport) + user_transport
        //
        // Electricity: If user's origin country differs from the factor's
        //   embedded electricity geography, adjust using the grid factor ratio.
        //   adjusted += embedded_electricity × (user_grid / factor_grid - 1)
        // ──────────────────────────────────────────────────────────────
        let adjustedClimate = resolved.impact_climate;
        // Fossil components folded into adjustedClimate below (DEFRA transport
        // replacement, grid adjustment, inbound container carbon). Tracked so
        // the is_biogenic_carbon reclassification never relabels them biogenic.
        let fossilAddersInClimate = 0;

        const hasDecomposition = (resolved.impact_climate_production ?? 0) > 0;
        const embeddedTransport = resolved.impact_climate_transport_embedded ?? 0;
        const embeddedElectricity = resolved.impact_climate_electricity_embedded ?? 0;
        const embeddedElecGeo = resolved.embedded_electricity_geography;

        // Transport replacement: swap ecoinvent generic transport for user's actual transport
        if (transportEmissions > 0 && hasDecomposition && embeddedTransport > 0) {
          adjustedClimate = resolved.impact_climate - embeddedTransport + transportEmissions;
          fossilAddersInClimate += transportEmissions;
          console.log(
            `[calculateProductCarbonFootprint] ⚡ Transport replaced for ${material.material_name}: ` +
            `ecoinvent=${embeddedTransport.toFixed(3)} → DEFRA=${transportEmissions.toFixed(3)} kg CO2e`
          );
        }

        // Electricity grid adjustment: correct for processing country's actual grid mix
        if (hasDecomposition && embeddedElectricity > 0 && embeddedElecGeo && (material as any).origin_country_code) {
          const userGrid = getGridFactor((material as any).origin_country_code);
          const factorGrid = getGridFactor(embeddedElecGeo);

          // Only adjust if both grids are known (not estimated) and different
          if (!userGrid.isEstimated && !factorGrid.isEstimated && Math.abs(userGrid.factor - factorGrid.factor) > 0.001) {
            const electricityAdjustment = embeddedElectricity * (userGrid.factor / factorGrid.factor - 1);
            adjustedClimate += electricityAdjustment;
            fossilAddersInClimate += electricityAdjustment;
            console.log(
              `[calculateProductCarbonFootprint] ⚡ Electricity adjusted for ${material.material_name}: ` +
              `${embeddedElecGeo}=${factorGrid.factor.toFixed(3)} → ${(material as any).origin_country_code}=${userGrid.factor.toFixed(3)} ` +
              `(Δ=${electricityAdjustment >= 0 ? '+' : ''}${electricityAdjustment.toFixed(3)} kg CO2e)`
            );
          }
        }

        // ──────────────────────────────────────────────────────────────────────
        // Inbound delivery container embodied carbon (optional, ingredient only)
        //
        // When an ingredient is delivered in a bulk container (IBC, drum,
        // flexitank, road tanker), its manufacturing footprint is amortised
        // over reuse cycles and allocated to this ingredient's volume share.
        //
        // Formula (ISO 14044 §4.3.4.2 physical allocation by volume):
        //   ef_per_fill        = container_ef × tare_kg / reuse_cycles
        //   fill_fraction      = ingredient_qty_litres / container_volume_l
        //   container_co2/unit = ef_per_fill × fill_fraction
        //
        // The result is added directly to adjustedClimate and stored separately
        // on the lcaMaterial row for audit traceability.
        //
        // Unit handling:
        //   l / ml → converted to litres (density-neutral; normalizeToKg treats
        //            1 L as 1 kg, so quantityKg already equals litres for volume units)
        //   kg     → use quantityKg as litre approximation (density ≈ 1 kg/L);
        //            a console.warn flags the imprecision for spirits (~0.8 kg/L)
        //   unit   → skip (cannot convert to litres); container impact = 0
        // ──────────────────────────────────────────────────────────────────────
        let containerCO2PerUnit = 0;
        const containerType = (material as any).inbound_container_type as string | null;

        if (isPinned && material.material_type === 'ingredient' && containerType) {
          // Pinned: container carbon is already inside the stored impact_climate.
          // Carry the scaled audit value forward without adding it again.
          const pinnedOldQuantity = Number(pinnedRow.quantity) || 1;
          containerCO2PerUnit =
            Number(pinnedRow.inbound_container_co2_per_unit || 0) * (quantityKg / pinnedOldQuantity);
        } else if (material.material_type === 'ingredient' && containerType) {
          try {
            const containerTareKg  = Number((material as any).inbound_container_tare_kg  || 0);
            const containerVolumeL = Number((material as any).inbound_container_volume_l || 0);
            const reuseCycles      = Math.max(1, Number((material as any).inbound_container_reuse_cycles || 1));
            let   containerEf      = Number((material as any).inbound_container_ef || 0);

            // For custom containers: look up EF from the stored material field
            if (!containerEf && containerType === 'custom') {
              const containerMaterial = (material as any).inbound_container_material as string | null;
              if (containerMaterial) {
                const MATERIAL_EF: Record<string, number> = {
                  hdpe: 1.93, ldpe: 2.10, pp: 1.72, pet: 3.40,
                  steel_mild: 1.46, steel_ss: 2.89, aluminium: 8.24,
                  glass: 0.85, cardboard: 0.94,
                };
                containerEf = MATERIAL_EF[containerMaterial] ?? 0;
              }
            }

            // Look up EF from staging_emission_factors when not overridden inline
            if (!containerEf && containerType !== 'custom') {
              const CONTAINER_FACTOR_NAMES: Record<string, string> = {
                ibc_1000l:          'Inbound Container - IBC 1000L (HDPE)',
                ibc_500l:           'Inbound Container - IBC 500L (HDPE)',
                drum_200l:          'Inbound Container - Drum 200L (HDPE)',
                flexitank_24000l:   'Inbound Container - Flexitank 24000L (LDPE)',
                bulk_tanker_25000l: 'Inbound Container - Bulk Tanker 25000L (Stainless steel)',
                // Glass bottles — for ingredients purchased in retail units
                bottle_700ml_glass: 'Inbound Container - Glass Bottle 700ml (standard)',
                bottle_750ml_glass: 'Inbound Container - Glass Bottle 750ml (standard)',
                bottle_1l_glass:    'Inbound Container - Glass Bottle 1L (standard)',
              };
              const factorName = CONTAINER_FACTOR_NAMES[containerType];
              if (factorName) {
                const { data: containerFactor } = await supabase
                  .from('staging_emission_factors')
                  .select('co2_factor')
                  .eq('name', factorName)
                  .eq('category', 'Inbound Container')
                  .maybeSingle();
                containerEf = Number(containerFactor?.co2_factor || 0);
              }
            }

            if (containerEf > 0 && containerTareKg > 0 && containerVolumeL > 0) {
              // Determine ingredient quantity in litres for volume-based allocation
              const unitLower = (material.unit || '').toLowerCase();
              let ingredientLitres = 0;

              if (['l', 'litre', 'litres', 'liter', 'liters'].includes(unitLower)) {
                ingredientLitres = quantityKg; // normalizeToKg treats L as 1:1 with kg
              } else if (['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'].includes(unitLower)) {
                ingredientLitres = quantityKg; // already converted to kg-equivalent
              } else if (['kg', 'kilograms', 'kilogram'].includes(unitLower)) {
                ingredientLitres = quantityKg; // density ≈ 1 kg/L approximation
                console.warn(
                  `[calculateProductCarbonFootprint] ⚠ Container allocation for "${material.material_name}": ` +
                  `unit is kg (weight), not volume. Using 1 kg ≈ 1 L. ` +
                  `Spirits are ~0.8 kg/L — switch to litres for accuracy.`
                );
              } else {
                console.warn(
                  `[calculateProductCarbonFootprint] ⚠ Container allocation skipped for "${material.material_name}": ` +
                  `cannot convert unit '${material.unit}' to litres.`
                );
              }

              if (ingredientLitres > 0) {
                const efPerFill    = (containerEf * containerTareKg) / reuseCycles;
                const fillFraction = ingredientLitres / containerVolumeL;
                containerCO2PerUnit = efPerFill * fillFraction;

                console.log(
                  `[calculateProductCarbonFootprint] ✓ Container impact for "${material.material_name}" ` +
                  `(${containerType}): ef=${containerEf} tare=${containerTareKg}kg ` +
                  `reuse=${reuseCycles} vol=${containerVolumeL}L qty=${ingredientLitres.toFixed(3)}L ` +
                  `→ ${containerCO2PerUnit.toFixed(5)} kg CO2e/unit`
                );
              }
            } else if (containerType && containerType !== 'custom') {
              console.warn(
                `[calculateProductCarbonFootprint] ⚠ Container impact skipped for "${material.material_name}": ` +
                `missing or zero ef (${containerEf}), tare (${containerTareKg}kg), or volume (${containerVolumeL}L).`
              );
            }
          } catch (containerErr: any) {
            // Non-fatal: log and continue; container impact stays at 0
            console.warn(
              `[calculateProductCarbonFootprint] ⚠ Container impact calculation failed for "${material.material_name}":`,
              containerErr.message
            );
          }

          // Add container embodied carbon to the ingredient's climate total
          adjustedClimate += containerCO2PerUnit;
          fossilAddersInClimate += containerCO2PerUnit;
        }

        // Build LCA material record with all impact data
        // Note: data_source must be 'openlca', 'supplier', 'parametric', or
        // NULL per constraint. For staging factors, we use NULL.
        let dataSource = null;
        if (isParametricResolvedRow) {
          dataSource = 'parametric';
        } else if (material.data_source === 'openlca' && material.data_source_id) {
          dataSource = 'openlca';
        } else if (material.data_source === 'supplier' && material.supplier_product_id) {
          dataSource = 'supplier';
        }

        // Parametric pin: endpoint identity + full derivation, persisted so
        // the report can show the working and a recalculation after a library
        // update remains attributable to a specific library version. Pinned
        // recalcs carry the previous PCF's pin forward verbatim.
        const parametricEndpoint = parametricEndpointByMaterialId.get(String(material.id)) ?? null;
        const pinnedSource = isPinned ? (pinnedRow as any) : null;
        const packagingPin = parametricEndpoint
          ? {
              packaging_material_class: parametricEndpoint.material_class,
              packaging_material_variant: parametricEndpoint.variant,
              packaging_endpoint_id: parametricEndpoint.id,
              packaging_library_version: parametricEndpoint.library_version,
              factor_derivation: buildFactorDerivation(parametricEndpoint, material.recycled_content_percentage),
            }
          : {
              packaging_material_class: pinnedSource?.packaging_material_class ?? (material as any).packaging_material_class ?? null,
              packaging_material_variant: pinnedSource?.packaging_material_variant ?? (material as any).packaging_material_variant ?? null,
              packaging_endpoint_id: pinnedSource?.packaging_endpoint_id ?? null,
              packaging_library_version: pinnedSource?.packaging_library_version ?? null,
              factor_derivation: pinnedSource?.factor_derivation ?? null,
            };
        // End-of-life allocation: parametric rows are always cut-off (the
        // recycling benefit is already claimed on the input side); other
        // packaging rows record the requested method, defaulting to cut-off.
        const eolAllocationMethod = isPackagingRow(material)
          ? (parametricEndpoint || pinnedSource?.packaging_endpoint_id
              ? 'cut-off'
              : (params.eolConfig?.allocationMethod ?? 'cut-off'))
          : null;
        // Pinned rows re-assert their previous data_source (a pinned
        // parametric row is still parametric on the fresh snapshot).
        if (isPinned && pinnedSource?.data_source === 'parametric' && pinnedSource?.packaging_endpoint_id) {
          dataSource = 'parametric';
        }

        const lcaMaterial = {
          product_carbon_footprint_id: lca.id,
          name: material.material_name,
          material_name: material.material_name,
          material_type: material.material_type,
          quantity: quantityKg,
          unit: 'kg',
          unit_name: material.unit,
          packaging_category: material.packaging_category,
          units_per_group: unitsPerGroup,
          // Circularity/identity projection: the aggregator's end-of-life loop
          // reads these off PCF material rows (reuse amortisation of disposal,
          // recyclability caps, stored pathway, material classification), and
          // source_material_id gives EoL pathway overrides a stable key.
          source_material_id: material.id ?? null,
          reuse_trips: (material as any).reuse_trips ?? null,
          recyclability_percent: (material as any).recyclability_percent ?? null,
          end_of_life_pathway: (material as any).end_of_life_pathway ?? null,
          container_material: (material as any).container_material ?? null,
          matched_source_name: (material as any).matched_source_name ?? null,
          origin_country: material.origin_country,
          country_of_origin: material.origin_country,
          is_organic: material.is_organic_certified,
          is_organic_certified: material.is_organic_certified,
          recycled_content_percentage: material.recycled_content_percentage ?? null,
          supplier_product_id: material.supplier_product_id,
          data_source: dataSource,
          data_source_id: material.data_source_id || null,

          // Parametric packaging pin (null for non-parametric rows)
          ...packagingPin,
          eol_allocation_method: eolAllocationMethod,

          // Transport data
          transport_mode: material.transport_mode || null,
          distance_km: material.distance_km || null,
          impact_transport: transportEmissions,

          // Origin geolocation
          origin_address: material.origin_address || null,
          origin_lat: material.origin_lat || null,
          origin_lng: material.origin_lng || null,
          origin_country_code: material.origin_country_code || null,

          // ISO 14067 §7 biogenic carbon classification
          is_biogenic_carbon: (material as any).is_biogenic_carbon || false,

          // Impact values
          impact_climate: adjustedClimate,
          // ISO 14067 fossil/biogenic split: a biogenic-flagged ingredient's
          // OWN carbon is biogenic, but the fossil components folded into
          // adjustedClimate (DEFRA transport, grid adjustment, inbound
          // container) must stay classified fossil.
          impact_climate_fossil: (material as any).is_biogenic_carbon
            ? Math.max(0, fossilAddersInClimate)
            : resolved.impact_climate_fossil,
          impact_climate_biogenic: (material as any).is_biogenic_carbon
            ? Math.max(0, adjustedClimate - Math.max(0, fossilAddersInClimate))
            : resolved.impact_climate_biogenic,
          impact_climate_dluc: resolved.impact_climate_dluc,
          // True when the resolver could not characterise a fossil/biogenic split
          // and attributed the whole total to fossil (ISO 14067 §6.4.9.3 disclosure).
          carbon_split_estimated: resolved.carbon_split_estimated || false,
          // GHG gas breakdown (ISO 14067)
          ch4_kg: resolved.ch4_kg || 0,
          ch4_fossil_kg: resolved.ch4_fossil_kg || 0,
          ch4_biogenic_kg: resolved.ch4_biogenic_kg || 0,
          n2o_kg: resolved.n2o_kg || 0,
          impact_water: resolved.impact_water,
          impact_water_scarcity: resolved.impact_water_scarcity,
          impact_land: resolved.impact_land,
          impact_waste: resolved.impact_waste,
          impact_terrestrial_ecotoxicity: resolved.impact_terrestrial_ecotoxicity,
          impact_freshwater_eutrophication: resolved.impact_freshwater_eutrophication,
          impact_terrestrial_acidification: resolved.impact_terrestrial_acidification,
          impact_fossil_resource_scarcity: resolved.impact_fossil_resource_scarcity,

          // Decomposition metadata (for UI transparency)
          impact_climate_production: resolved.impact_climate_production,
          impact_climate_transport_embedded: resolved.impact_climate_transport_embedded,
          impact_climate_electricity_embedded: resolved.impact_climate_electricity_embedded,
          embedded_electricity_geography: resolved.embedded_electricity_geography,

          // Data quality & provenance
          data_priority: resolved.data_priority,
          data_quality_tag: resolved.data_quality_tag,
          data_quality_grade: resolved.data_quality_grade,
          supplier_lca_id: resolved.supplier_lca_id || null,
          confidence_score: resolved.confidence_score,
          methodology: resolved.methodology,
          source_reference: resolved.source_reference,
          impact_source: resolveImpactSource(resolved.data_quality_tag, resolved.data_priority),
          impact_reference_id: resolved.supplier_lca_id || null,

          // Data source tracking for quality metrics
          gwp_data_source: resolved.gwp_data_source,
          non_gwp_data_source: resolved.non_gwp_data_source,
          is_hybrid_source: resolved.is_hybrid_source,
          category_type: resolved.category_type,

          // Inbound delivery container (ingredient rows only; for audit traceability)
          // containerCO2PerUnit is already included in impact_climate above.
          inbound_container_type: containerType ?? null,
          inbound_container_co2_per_unit: containerCO2PerUnit,
        };

        lcaMaterialsWithImpacts.push(lcaMaterial);
        if ((resolved as any).resolved_factor_id) {
          resolvedFactorIdsUsed.push((resolved as any).resolved_factor_id);
        }

        const allocationNote = unitsPerGroup > 1 ? ` (allocated ÷${unitsPerGroup} units)` : '';
        const adjustedNote = adjustedClimate !== resolved.impact_climate ? ` (adjusted from ${resolved.impact_climate.toFixed(3)})` : '';
        console.log(`[calculateProductCarbonFootprint] ✓ Resolved ${material.material_name}: ${adjustedClimate.toFixed(3)} kg CO2e${adjustedNote} (Priority ${resolved.data_priority})${allocationNote}`);

      } catch (error: any) {
        console.error(`[calculateProductCarbonFootprint] ✗ Failed to resolve ${material.material_name}:`, error.message);

        // NEVER delete: this row is (or was promoted from) the wizard's
        // autosaved draft, and deleting it destroyed the user's goal/scope
        // text, ISO fields and facility allocations on any transient failure
        // (e.g. the OpenLCA certificate expiring mid-calculation). Mark it
        // failed so the wizard can resume it.
        await supabase
          .from('product_carbon_footprints')
          .update({
            status: 'failed',
            error_message: `Missing emission data for material "${material.material_name}". ${error.message}`.slice(0, 1000),
            updated_at: new Date().toISOString(),
          })
          .eq('id', lca.id);

        throw new Error(`Missing emission data for material "${material.material_name}". ${error.message}`);
      }
    }

    // 5b. Check for maturation profile and calculate maturation impacts
    //
    // LOW FIX #24: Guard against maturation profile being present for product types
    // that don't barrel-age (beer, cider, soft drinks). Applying barrel CO2e, angel's
    // share VOC, and warehouse energy to a beer product would produce nonsensical results.
    //
    // Maturation is only valid for aged spirits and wines:
    //   Spirits  — whisky, rum, brandy, calvados, cognac, armagnac, etc.
    //   Wine     — barrel-aged wine (Chardonnay, Rioja, Barolo, etc.)
    //   RTD      — excluded (RTDs are not barrel-aged)
    //   Beer/Cider — excluded (beer is not barrel-aged; barrel-finishing is rare)
    //
    // product.product_type is drawn from PRODUCT_TYPE_OPTIONS in industry-benchmarks.ts:
    //   'Spirits', 'Beer & Cider', 'Wine', 'Ready-to-Drink & Cocktails', 'Non-Alcoholic'
    // Shared predicate (lib/maturation-eligibility.ts): the SAME rule gates
    // the recipe editor's Maturation tab, so a profile the user could enter
    // is never silently dropped here. Checks product_type AND category, since
    // barrel-aged products are often typed loosely (e.g. an aged RTD).
    const isMaturationEligible = isMaturationEligibleProduct({
      productType: product.product_type ?? null,
      category: (product as any).category ?? null,
    });

    const { data: maturationProfile } = await supabase
      .from('maturation_profiles')
      .select('*')
      .eq('product_id', parseInt(productId))
      .maybeSingle();

    if (maturationProfile && !isMaturationEligible) {
      console.warn(
        `[calculateProductCarbonFootprint] ⚠️ MATURATION TYPE MISMATCH: Product "${product.name}" has product_type="${product.product_type}" which is not typically barrel-aged. ` +
        `Maturation profile found (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months) will be SKIPPED to prevent erroneous impacts. ` +
        `If this product is genuinely barrel-aged, update the product type to "Spirits" or "Wine".`
      );
      // Must be user-visible: a filled-in maturation card silently missing
      // from the published LCA erodes trust in every other number.
      calculatorWarnings.push(
        `This product has a maturation profile (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months), but its product type "${product.product_type || 'not set'}" is not one that barrel-ages, so maturation was left out of this calculation. ` +
        `If it really is barrel-aged, set the product type to Spirits or Wine and recalculate.`
      );
    }

    if (maturationProfile && isMaturationEligible) {
      console.log(`[calculateProductCarbonFootprint] Processing maturation profile (${maturationProfile.barrel_type}, ${maturationProfile.aging_duration_months} months)...`);
      // Warehouse country: the profile's own warehouse_country_code is the
      // user's explicit answer and always wins. Only when the profile has no
      // country do we fall back to the primary production facility's country
      // as a proxy (options override the profile inside the maturation
      // calculator, so passing the facility country unconditionally used to
      // silently override "distil in Ireland, mature in Scotland").
      const facilityCountryFallback = !maturationProfile.warehouse_country_code && params.facilityAllocations?.[0]
        ? (await supabase.from('facilities').select('location_country_code').eq('id', params.facilityAllocations[0].facilityId).single()).data?.location_country_code ?? null
        : null;
      // ABV dilution matters: a spirit filled at cask strength (e.g. 63.5%) and
      // bottled lower (e.g. 46%) yields proportionally MORE bottles. The
      // fallback chain is shared with the preview (resolveMaturationAbv) so the
      // card and the persisted LCA can never disagree.
      const maturationAbv = resolveMaturationAbv({
        profileCaskFillAbvPercent: (maturationProfile as MaturationProfile).cask_fill_abv_percent,
        productCategory: (product as any).category ?? product.product_type ?? null,
        productAbvPercent: Number(product.alcohol_content_abv),
      });
      const matResult = calculateMaturationImpacts(maturationProfile as MaturationProfile, {
        warehouseCountryCode: maturationProfile.warehouse_country_code ?? facilityCountryFallback,
        caskFillAbvPercent: maturationAbv.caskFillAbvPercent,
        bottleAbvPercent: maturationAbv.bottleAbvPercent,
      });

      // --- Per-bottle allocation ---
      // Regular materials are already per-functional-unit (per bottle). Maturation
      // impacts must be normalized the same way so the aggregator sums correctly.
      const rawBottleSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75); // fallback 750ml
      // ACCURACY FIX: Guard against zero/negative bottle size which would cause
      // division-by-zero in per-bottle allocation (Infinity CO2e per bottle).
      const bottleSizeLitres = rawBottleSize > 0 ? rawBottleSize : 0.75;
      if (rawBottleSize <= 0) {
        console.warn(
          `[calculateProductCarbonFootprint] ⚠ Bottle size resolved to ${rawBottleSize}L ` +
          `(unit_size_value: ${product.unit_size_value}, unit: ${product.unit_size_unit}). ` +
          `Using default 0.75L to avoid division-by-zero in maturation allocation.`
        );
      }

      // Use user-specified bottle count if set, otherwise derive from the
      // BOTTLED output volume (post-dilution), not the cask-strength volume —
      // dividing totals by cask-strength bottle counts over-stated per-bottle
      // impacts for every diluted spirit.
      const maturationDerivedBottles = maturationProfile.bottles_produced
        ? Number(maturationProfile.bottles_produced)
        : (matResult.output_volume_bottled_litres > 0 && bottleSizeLitres > 0)
          ? matResult.output_volume_bottled_litres / bottleSizeLitres
          : 1;
      // Denominator reconciliation: in production-chain mode every OTHER row
      // in this PCF is divided by chainDivisor (bottling output ÷ bottle
      // size). Using a different bottle count for maturation rows put two
      // inconsistent per-bottle bases inside one footprint, so the chain
      // divisor wins, with a visible note when the two disagree materially.
      let totalBottles = maturationDerivedBottles;
      if (productionStages.length > 0 && chainDivisor > 0) {
        const disagreement = maturationDerivedBottles > 0
          ? Math.abs(chainDivisor - maturationDerivedBottles) / maturationDerivedBottles
          : 0;
        if (disagreement > 0.1) {
          calculatorWarnings.push(
            `The maturation profile implies about ${Math.round(maturationDerivedBottles).toLocaleString()} bottles, but the production chain's bottling output implies about ${Math.round(chainDivisor).toLocaleString()}. ` +
            `The bottling output was used for all per-bottle figures. Check the maturation fill volume, angel's share and bottles produced against the bottling stage.`
          );
        }
        totalBottles = chainDivisor;
      }

      const barrelPerBottle = totalBottles > 0 ? matResult.barrel_total_co2e / totalBottles : 0;
      const warehousePerBottle = totalBottles > 0 ? matResult.warehouse_co2e_total / totalBottles : 0;
      const vocPerBottle = totalBottles > 0 ? matResult.angel_share_photochemical_ozone / totalBottles : 0;

      console.log(`[calculateProductCarbonFootprint] Maturation per-bottle: ${totalBottles.toFixed(0)} bottles from ${matResult.output_volume_bottled_litres.toFixed(1)}L bottled (${(bottleSizeLitres * 1000).toFixed(0)}ml/bottle), barrel=${barrelPerBottle.toFixed(4)}/bottle, warehouse=${warehousePerBottle.toFixed(4)}/bottle`);

      // Evaporation uplift (per-unit recipes only): the angel's share means
      // the distillery consumed MORE raw material per surviving bottle than
      // the per-bottle recipe says — the ~18% of a 10-year temperate
      // maturation that evaporated still carried its full grain/new-make
      // burden. Batch and production-chain modes already capture this
      // (batch inputs ÷ bottled output), so the uplift applies only when
      // quantities were entered per finished bottle.
      const angelShareRetention = 1 - (matResult.angel_share_loss_percent_total / 100);
      if (
        productionStages.length === 0 &&
        bottlesPerBatch === 1 &&
        angelShareRetention > 0.05 &&
        angelShareRetention < 1
      ) {
        const evaporationUplift = 1 / angelShareRetention;
        const UPLIFTED_FIELDS = [
          'quantity', 'impact_climate', 'impact_climate_fossil', 'impact_climate_biogenic',
          'impact_climate_dluc', 'ch4_kg', 'ch4_fossil_kg', 'ch4_biogenic_kg', 'n2o_kg',
          'impact_water', 'impact_water_scarcity', 'impact_land', 'impact_waste',
          'impact_terrestrial_ecotoxicity', 'impact_freshwater_eutrophication',
          'impact_terrestrial_acidification', 'impact_fossil_resource_scarcity',
          'impact_transport', 'inbound_container_co2_per_unit',
          'impact_climate_production', 'impact_climate_transport_embedded',
          'impact_climate_electricity_embedded',
        ] as const;
        let upliftedCount = 0;
        for (const row of lcaMaterialsWithImpacts as any[]) {
          if ((row.material_type || '').toLowerCase() !== 'ingredient') continue;
          for (const field of UPLIFTED_FIELDS) {
            if (typeof row[field] === 'number' && Number.isFinite(row[field])) {
              row[field] = row[field] * evaporationUplift;
            }
          }
          upliftedCount++;
        }
        if (upliftedCount > 0) {
          console.log(
            `[calculateProductCarbonFootprint] Evaporation uplift ×${evaporationUplift.toFixed(3)} applied to ${upliftedCount} ingredient rows ` +
            `(angel's share ${matResult.angel_share_loss_percent_total.toFixed(1)}% over ${(maturationProfile.aging_duration_months / 12).toFixed(1)} years)`
          );
          calculatorWarnings.push(
            `Because ${matResult.angel_share_loss_percent_total.toFixed(0)}% of this spirit evaporates during maturation, the ingredients for each bottle sold were scaled up by ${((evaporationUplift - 1) * 100).toFixed(0)}% to cover the share that was lost. ` +
            `This assumes all ingredients go in before maturation; if some are added at bottling, the uplift slightly overstates them.`
          );
        }
      }

      // Inject barrel allocation as a synthetic material (per-bottle)
      lcaMaterialsWithImpacts.push({
        product_carbon_footprint_id: lca.id,
        name: '[Maturation] Oak Barrel Allocation',
        material_name: '[Maturation] Oak Barrel Allocation',
        material_type: 'ingredient',
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: null,
        country_of_origin: null,
        is_organic: false,
        is_organic_certified: false,
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: null,
        origin_lng: null,
        origin_country_code: null,
        impact_climate: barrelPerBottle,
        // Barrel allocation fossil/biogenic split:
        // Oak barrel manufacturing involves timber (biogenic carbon, ~55% of mass
        // is carbon stored in wood) plus kiln-drying, cooperage energy, and transport
        // (all fossil). Based on Ecoinvent 3.x wooden barrel datasets, approximately
        // 40% of the cradle-to-gate barrel CO2e is fossil (energy use in cooperage
        // + transport) and 60% is biogenic (wood combustion/decomposition credits).
        // Source: Pettersson (2016) LCA of Swedish single malt whisky; SWA (2006).
        // This is preferable to the previous 95/5 split which had no documented basis.
        impact_climate_fossil: barrelPerBottle * 0.40,
        impact_climate_biogenic: barrelPerBottle * 0.60,
        impact_climate_dluc: 0,
        ch4_kg: 0,
        ch4_fossil_kg: 0,
        ch4_biogenic_kg: 0,
        n2o_kg: 0,
        impact_water: 0,
        impact_water_scarcity: 0,
        impact_land: 0,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0,
        impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0,
        impact_fossil_resource_scarcity: 0,
        impact_photochemical_ozone_formation: vocPerBottle,
        data_priority: 3,
        data_quality_tag: 'Secondary_Estimated',
        supplier_lca_id: null,
        confidence_score: 60,
        methodology: 'Cut-off allocation / Literature estimates',
        source_reference: `Barrel allocation: ${matResult.barrel_total_co2e.toFixed(1)} kg total ÷ ${totalBottles.toFixed(0)} bottles = ${barrelPerBottle.toFixed(4)} kg/bottle (${(bottleSizeLitres * 1000).toFixed(0)}ml, ${matResult.output_volume_litres.toFixed(1)}L output). ${matResult.methodology_notes}`,
        impact_source: 'secondary_modelled',
        impact_reference_id: null,
        data_quality_grade: 'LOW',
        gwp_data_source: 'alkatera staging factor',
        non_gwp_data_source: 'alkatera staging factor',
        is_hybrid_source: false,
        category_type: 'maturation',
      });

      // Inject warehouse energy as a synthetic material (per-bottle)
      lcaMaterialsWithImpacts.push({
        product_carbon_footprint_id: lca.id,
        name: '[Maturation] Warehouse Energy',
        material_name: '[Maturation] Warehouse Energy',
        material_type: 'ingredient',
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: null,
        country_of_origin: null,
        is_organic: false,
        is_organic_certified: false,
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: null,
        origin_lng: null,
        origin_country_code: null,
        impact_climate: warehousePerBottle,
        impact_climate_fossil: warehousePerBottle,
        impact_climate_biogenic: 0,
        impact_climate_dluc: 0,
        ch4_kg: 0,
        ch4_fossil_kg: 0,
        ch4_biogenic_kg: 0,
        n2o_kg: 0,
        impact_water: 0,
        impact_water_scarcity: 0,
        impact_land: 0,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0,
        impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0,
        impact_fossil_resource_scarcity: 0,
        data_priority: 3,
        data_quality_tag: 'Secondary_Estimated',
        supplier_lca_id: null,
        confidence_score: 55,
        methodology: 'DEFRA 2025 grid factors',
        source_reference: `Warehouse energy: ${matResult.warehouse_co2e_total.toFixed(1)} kg total ÷ ${totalBottles.toFixed(0)} bottles = ${warehousePerBottle.toFixed(4)} kg/bottle. ${maturationProfile.warehouse_energy_kwh_per_barrel_year} kWh/barrel/yr (${maturationProfile.warehouse_energy_source})`,
        impact_source: 'secondary_modelled',
        impact_reference_id: null,
        data_quality_grade: 'LOW',
        gwp_data_source: 'DEFRA 2025',
        non_gwp_data_source: 'DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'maturation',
      });

      console.log(`[calculateProductCarbonFootprint] ✓ Maturation impacts (per-bottle): barrel=${barrelPerBottle.toFixed(4)} kg CO2e, warehouse=${warehousePerBottle.toFixed(4)} kg CO2e, angel's share=${matResult.angel_share_loss_percent_total.toFixed(1)}% volume loss, VOC=${vocPerBottle.toFixed(4)} kg/bottle`);

      // Double-count guard: warehouse energy can also live in a linked
      // facility's utility data. There is no facility link on maturation
      // profiles yet, so we cannot dedupe automatically — but we can make
      // sure nobody double-enters it unknowingly.
      if (matResult.warehouse_co2e_total > 0 && (params.facilityAllocations?.length ?? 0) > 0) {
        calculatorWarnings.push(
          `Warehouse energy for maturation (${maturationProfile.warehouse_energy_kwh_per_barrel_year} kWh per barrel per year) is included from the maturation profile. ` +
          `If the ageing warehouse is one of the production facilities linked to this product, make sure its electricity is not ALSO in that facility's utility data, or it will be counted twice.`
        );
      }
    }

    // Average a series of per-year values with the SAME method the multi-year
    // impact averaging used ('single'/'average_2yr' = mean, 'median_3yr' =
    // median), so allocation denominators stay consistent with the numerators.
    const averageForMethod = (values: number[], method: string): number => {
      if (values.length === 0) return 0;
      if (method === 'median_3yr') {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      }
      return values.reduce((a, b) => a + b, 0) / values.length;
    };

    // 5c. Check for vineyard growing profile and calculate viticulture impacts
    //
    // For producers who grow their own agricultural inputs (e.g. vineyards
    // growing grapes), the viticulture calculator computes field-level emissions
    // from fertiliser N2O, machinery fuel, irrigation, and soil carbon removals.
    //
    // FLAG Alignment: Emissions and removals are injected as separate synthetic
    // rows. Removals use impact_removals_co2e (never impact_climate) per SBTi
    // FLAG Guidance v1.2.
    // Find vineyard_id from self-grown ingredients linked to this product
    const { data: selfGrownIngredients } = await supabase
      .from('product_materials')
      .select('vineyard_id')
      .eq('product_id', parseInt(productId))
      .eq('is_self_grown', true)
      .not('vineyard_id', 'is', null);

    const vineyardIds = Array.from(new Set(
      (selfGrownIngredients || []).map((m: any) => m.vineyard_id).filter(Boolean)
    ));

    // Process the first linked vineyard (most products have one vineyard)
    const vineyardId = vineyardIds[0];
    const { data: viticultureProfiles } = vineyardId
      ? await supabase
          .from('vineyard_growing_profiles')
          .select('*, vineyards(*)')
          .eq('vineyard_id', vineyardId)
          .order('vintage_year', { ascending: false })
      : { data: null };

    // Use the first profile for vineyard metadata (all profiles share the same vineyard)
    const viticultureProfile = viticultureProfiles?.[0];

    if (viticultureProfile) {
      const vineyard = viticultureProfile.vineyards as unknown as Vineyard;
      const profileCount = viticultureProfiles!.length;
      console.log(`[calculateProductCarbonFootprint] Processing viticulture for vineyard "${vineyard?.name || 'unknown'}" (${profileCount} vintage${profileCount > 1 ? 's' : ''})...`);

      // Resolve AWARE water scarcity factor for vineyard country
      const vineyardCountryCode = vineyard?.location_country_code;
      let vineyardAwareFactor = 1.0;
      if (vineyardCountryCode) {
        const awareData = await getAwareFactor(supabase, vineyardCountryCode);
        if (awareData) vineyardAwareFactor = Number(awareData.aware_factor);
      }

      // Build inputs for all available vintages
      const vintageInputs = viticultureProfiles!.map((p: any) => ({
        vintage_year: p.vintage_year,
        input: {
          climate_zone: vineyard?.climate_zone || 'temperate',
          certification: vineyard?.certification || 'conventional',
          location_country_code: vineyard?.location_country_code || null,
          aware_factor: vineyardAwareFactor,
          area_ha: p.area_ha,
          soil_management: p.soil_management,
          pruning_residue_returned: p.pruning_residue_returned ?? true,
          fertiliser_type: p.fertiliser_type,
          fertiliser_quantity_kg: p.fertiliser_quantity_kg,
          fertiliser_n_content_percent: p.fertiliser_n_content_percent,
          uses_pesticides: p.uses_pesticides,
          pesticide_applications_per_year: p.pesticide_applications_per_year,
          pesticide_type: p.pesticide_type || 'generic',
          uses_herbicides: p.uses_herbicides,
          herbicide_applications_per_year: p.herbicide_applications_per_year,
          herbicide_type: p.herbicide_type || 'generic',
          diesel_litres_per_year: p.diesel_litres_per_year,
          petrol_litres_per_year: p.petrol_litres_per_year,
          is_irrigated: p.is_irrigated,
          water_m3_per_ha: p.water_m3_per_ha,
          irrigation_energy_source: p.irrigation_energy_source,
          grape_yield_tonnes: p.grape_yield_tonnes,
          soil_carbon_override_kg_co2e_per_ha: p.soil_carbon_override_kg_co2e_per_ha,
          soil_carbon_annual_change_kg_co2e_per_ha: p.soil_carbon_annual_change_kg_co2e_per_ha,
          soil_carbon_change_methodology: p.soil_carbon_change_methodology,
          soil_carbon_change_confidence: p.soil_carbon_change_confidence,
          previous_land_use_type: vineyard?.previous_land_use_type,
          land_conversion_year: vineyard?.land_conversion_year,
          vintage_year: p.vintage_year,
          vine_age: vineyard?.vine_planting_year != null
            ? p.vintage_year - vineyard.vine_planting_year
            : null,
          removal_verification_status: (p as any).removal_verification_status ?? 'unverified',
          removal_verifier_body: (p as any).removal_verifier_body,
          removal_verifier_standard: (p as any).removal_verifier_standard,
          removal_verification_date: (p as any).removal_verification_date,
          removal_verification_expiry: (p as any).removal_verification_expiry,
          ecosystem_type: (p as any).ecosystem_type ?? undefined,
          in_biodiversity_sensitive_area: (p as any).in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: (p as any).sensitive_area_details ?? undefined,
          water_stress_index: (p as any).water_stress_index ?? undefined,
        },
      }));

      // Multi-vintage averaging (median for 3+, mean for 2, single for 1)
      const multiVintageResult = calculateMultiVintageAverage(vintageInputs);
      const vitResult = multiVintageResult.averaged_impacts;
      const vintageNote = profileCount > 1
        ? ` (${multiVintageResult.method}: vintages ${multiVintageResult.vintages_used.join(', ')})`
        : '';

      // --- Per-bottle allocation ---
      // Viticulture impacts are computed for the entire vineyard area.
      // Normalise to per-bottle using grape yield and bottle size.
      const rawBottleSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75);
      const bottleSizeLitres = rawBottleSize > 0 ? rawBottleSize : 0.75;

      // Grapes per bottle: prefer the actual self-grown grape quantity from the
      // ingredient row(s) linked to this vineyard (normalised to kg per unit).
      // Fall back to the 1.3 kg grapes per 0.75L bottle industry average
      // (typical wine yield ~0.7-0.8 L per kg grapes), scaled by bottle size.
      const selfGrownGrapeRows = (materials || []).filter(
        (m: any) => m.is_self_grown && m.vineyard_id === vineyardId
      );
      let grapeKgPerBottle = selfGrownGrapeRows.reduce((sum: number, m: any) => {
        const norm = tryNormalizeToKg(m.quantity, m.unit);
        return sum + (norm.recognised && norm.kind !== 'count' ? norm.kg / allocationDivisorFor(m) : 0);
      }, 0);
      if (!(grapeKgPerBottle > 0)) {
        grapeKgPerBottle = (bottleSizeLitres / 0.75) * 1.3;
        console.log(`[calculateProductCarbonFootprint] Viticulture: no usable self-grown grape quantity on the ingredient row — falling back to ${grapeKgPerBottle.toFixed(2)} kg grapes per bottle (1.3 kg/750ml industry average)`);
      }

      // Bottle-count denominator uses the multi-vintage AVERAGE yield so it is
      // consistent with the multi-vintage averaged impact numerators above.
      const averagedGrapeYieldKg = averageForMethod(
        viticultureProfiles!.map((p: any) => (Number(p.grape_yield_tonnes) || 0) * 1000),
        multiVintageResult.method
      );
      const totalBottles = grapeKgPerBottle > 0 ? averagedGrapeYieldKg / grapeKgPerBottle : 0;

      // Per-bottle factors
      const fertFieldPerBottle = totalBottles > 0
        ? (vitResult.flag_emissions.total_flag_co2e + vitResult.non_flag_emissions.fertiliser_production_co2e) / totalBottles
        : 0;
      const fuelPerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.machinery_fuel_co2e / totalBottles
        : 0;
      const irrigationPerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.irrigation_energy_co2e / totalBottles
        : 0;
      const waterPerBottle = totalBottles > 0
        ? vitResult.water_m3 / totalBottles
        : 0;
      const waterScarcityPerBottle = totalBottles > 0
        ? vitResult.water_scarcity_m3_eq / totalBottles
        : 0;
      const landPerBottle = totalBottles > 0
        ? vitResult.flag_emissions.land_use_m2 / totalBottles
        : 0;
      const removalsPerBottle = totalBottles > 0
        ? vitResult.total_removals / totalBottles
        : 0;
      const pesticidePerBottle = totalBottles > 0
        ? vitResult.non_flag_emissions.pesticide_production_co2e / totalBottles
        : 0;
      const n2oKgPerBottle = totalBottles > 0
        ? vitResult.n2o_kg / totalBottles
        : 0;
      const lucPerBottle = totalBottles > 0
        ? vitResult.flag_emissions.luc_co2e / totalBottles
        : 0;

      console.log(`[calculateProductCarbonFootprint] Viticulture per-bottle: ${totalBottles.toFixed(0)} bottles, fert+N2O=${fertFieldPerBottle.toFixed(4)}, fuel=${fuelPerBottle.toFixed(4)}, irrigation=${irrigationPerBottle.toFixed(4)}, removals=${removalsPerBottle.toFixed(4)}`);

      // Synthetic row template (shared fields)
      const vitBaseRow = {
        product_carbon_footprint_id: lca.id,
        material_type: 'ingredient' as const,
        quantity: bottleSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: vineyard?.address_country || null,
        country_of_origin: vineyard?.address_country || null,
        is_organic: vineyard?.certification === 'organic' || vineyard?.certification === 'biodynamic',
        is_organic_certified: vineyard?.certification === 'organic',
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: vineyard?.address_lat || null,
        origin_lng: vineyard?.address_lng || null,
        origin_country_code: vineyard?.location_country_code || null,
        data_priority: 2 as const,
        data_quality_tag: 'Secondary_Modelled' as const,
        supplier_lca_id: null,
        impact_source: 'secondary_modelled' as const,
        impact_reference_id: null,
        gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        non_gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'MANUFACTURING_MATERIAL',
      };

      // Row 1: Fertiliser & Field Emissions (N2O + production)
      lcaMaterialsWithImpacts.push({
        ...vitBaseRow,
        name: '[Viticulture] Fertiliser & Field Emissions',
        material_name: '[Viticulture] Fertiliser & Field Emissions',
        impact_climate: fertFieldPerBottle + pesticidePerBottle,
        // C31: fossil + biogenic must sum exactly to the fertiliser total; the 5% biogenic share covers urea/organic inputs
        impact_climate_fossil: fertFieldPerBottle * 0.95 + pesticidePerBottle,
        impact_climate_biogenic: fertFieldPerBottle * 0.05,
        impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0,
        n2o_kg: n2oKgPerBottle,
        impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
        impact_freshwater_ecotoxicity: totalBottles > 0 ? vitResult.freshwater_ecotoxicity / totalBottles : 0,
        impact_terrestrial_ecotoxicity: totalBottles > 0 ? vitResult.terrestrial_ecotoxicity / totalBottles : 0,
        impact_human_toxicity_non_carcinogenic: totalBottles > 0 ? vitResult.human_toxicity_non_carcinogenic / totalBottles : 0,
        impact_freshwater_eutrophication: totalBottles > 0 ? vitResult.freshwater_eutrophication / totalBottles : 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 65,
        methodology: vitResult.methodology_notes,
        source_reference: `Fertiliser: ${vitResult.flag_emissions.n2o_direct_co2e.toFixed(1)} kg CO2e direct N2O + ${vitResult.flag_emissions.n2o_indirect_co2e.toFixed(1)} kg indirect + ${vitResult.non_flag_emissions.fertiliser_production_co2e.toFixed(1)} kg production${vintageNote}`,
        data_quality_grade: vitResult.data_quality_grade,
      });

      // Row 2: Machinery Fuel
      if (fuelPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Machinery Fuel',
          material_name: '[Viticulture] Machinery Fuel',
          impact_climate: fuelPerBottle,
          impact_climate_fossil: fuelPerBottle,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2025 fuel combustion factors',
          source_reference: `Diesel: ${viticultureProfile.diesel_litres_per_year} L/yr, Petrol: ${viticultureProfile.petrol_litres_per_year} L/yr. Total: ${vitResult.non_flag_emissions.machinery_fuel_co2e.toFixed(1)} kg CO2e / ${totalBottles.toFixed(0)} bottles`,
          data_quality_grade: vitResult.data_quality_grade,
        });
      }

      // Row 3: Irrigation
      if (irrigationPerBottle > 0 || waterPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Irrigation',
          material_name: '[Viticulture] Irrigation',
          impact_climate: irrigationPerBottle,
          impact_climate_fossil: irrigationPerBottle,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: waterPerBottle,
          impact_water_scarcity: waterScarcityPerBottle, // AWARE-weighted
          impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 60,
          methodology: 'DEFRA 2025 / grid emission factors',
          source_reference: `Irrigation: ${vitResult.water_m3.toFixed(0)} m3 water, ${viticultureProfile.irrigation_energy_source}. Energy: ${vitResult.non_flag_emissions.irrigation_energy_co2e.toFixed(1)} kg CO2e`,
          data_quality_grade: vitResult.data_quality_grade,
        });
      }

      // Row 4: Land Occupation
      lcaMaterialsWithImpacts.push({
        ...vitBaseRow,
        name: '[Viticulture] Land Occupation',
        material_name: '[Viticulture] Land Occupation',
        impact_climate: 0, // Land occupation itself has no direct climate impact
        impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
        impact_water: 0, impact_water_scarcity: 0,
        impact_land: landPerBottle,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 80,
        methodology: 'Direct land occupation measurement',
        source_reference: `Vineyard: ${viticultureProfile.area_ha} ha (${vitResult.flag_emissions.land_use_m2.toFixed(0)} m2) / ${totalBottles.toFixed(0)} bottles`,
        data_quality_grade: 'HIGH',
      });

      // Row 4b: Land Use Change (dLUC) — IPCC 2019, amortised over 20 years
      if (lucPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture] Land Use Change (dLUC)',
          material_name: '[Viticulture] Land Use Change (dLUC)',
          impact_climate: lucPerBottle,
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: lucPerBottle,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 50,
          methodology: 'IPCC 2019 direct land use change, amortised 20 years',
          source_reference: `dLUC: ${vitResult.flag_emissions.luc_co2e.toFixed(1)} kg CO2e from ${vineyard?.previous_land_use_type || 'unknown'} conversion`,
          data_quality_grade: 'MEDIUM',
        });
      }

      // Row 5: Soil Carbon Removals (FLAG: separate from emissions)
      if (removalsPerBottle > 0) {
        lcaMaterialsWithImpacts.push({
          ...vitBaseRow,
          name: '[Viticulture Removals] Soil Carbon',
          material_name: '[Viticulture Removals] Soil Carbon',
          impact_climate: 0, // FLAG: removals NEVER stored in impact_climate
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          // FLAG-compliant: removals in dedicated column
          impact_removals_co2e: removalsPerBottle,
          confidence_score: vitResult.flag_removals.is_verified ? 75 : 45,
          methodology: `Soil carbon: ${vitResult.flag_removals.methodology}`,
          source_reference: `Soil management: ${viticultureProfile.soil_management}. Total removals: ${vitResult.total_removals.toFixed(1)} kg CO2e/yr (${vitResult.flag_removals.methodology}). Per bottle: ${removalsPerBottle.toFixed(4)} kg CO2e`,
          data_quality_grade: vitResult.flag_removals.is_verified ? 'MEDIUM' : 'LOW',
        });
      }

      console.log(`[calculateProductCarbonFootprint] ✓ Viticulture impacts: emissions=${vitResult.total_emissions.toFixed(1)} kg CO2e, removals=${vitResult.total_removals.toFixed(1)} kg CO2e (${vitResult.flag_removals.methodology}), per-kg=${vitResult.total_emissions_per_kg.toFixed(4)} kg CO2e/kg grapes`);
    }

    // ========================================================================
    // 5b. ORCHARD (Fruit Growing) — Self-grown fruit integration
    // ========================================================================
    //
    // Mirrors viticulture integration above. For producers who grow their own
    // fruit (e.g. apples for calvados/cider, pears for perry), the orchard
    // calculator computes field-level emissions from fertiliser N2O, machinery
    // fuel, irrigation, transport, and soil carbon removals.
    //
    // Conversion factors (kg fruit per litre finished product):
    //   Calvados / apple brandy: ~8 kg apples per litre (distillation concentration)
    //   Cider:                   ~1.5 kg apples per litre
    //   Perry:                   ~1.5 kg pears per litre
    //   Fruit wine:              ~1.3 kg fruit per litre (similar to grape wine)
    //   Fruit liqueur:           ~3 kg fruit per litre (maceration + sugar)
    //   Default:                 ~2 kg fruit per litre

    // Find orchard_id from self-grown ingredients linked to this product
    const { data: selfGrownOrchardIngredients } = await supabase
      .from('product_materials')
      .select('orchard_id')
      .eq('product_id', parseInt(productId))
      .eq('is_self_grown', true)
      .not('orchard_id', 'is', null);

    const orchardIds = Array.from(new Set(
      (selfGrownOrchardIngredients || []).map((m: any) => m.orchard_id).filter(Boolean)
    ));

    const orchardId = orchardIds[0]; // Process first linked orchard
    const { data: orchardProfiles } = orchardId
      ? await supabase
          .from('orchard_growing_profiles')
          .select('*, orchards(*)')
          .eq('orchard_id', orchardId)
          .order('harvest_year', { ascending: false })
      : { data: null };

    const orchardProfile = orchardProfiles?.[0];

    if (orchardProfile) {
      const orchard = orchardProfile.orchards as unknown as Orchard;
      const orchardProfileCount = orchardProfiles!.length;
      console.log(`[calculateProductCarbonFootprint] Processing orchard for "${orchard?.name || 'unknown'}" (${orchardProfileCount} harvest${orchardProfileCount > 1 ? 's' : ''})...`);

      // Resolve AWARE water scarcity factor for orchard country
      const orchardCountryCode = orchard?.location_country_code;
      let orchardAwareFactor = 1.0;
      if (orchardCountryCode) {
        const orchAwareData = await getAwareFactor(supabase, orchardCountryCode);
        if (orchAwareData) orchardAwareFactor = Number(orchAwareData.aware_factor);
      }

      // Build inputs for all available harvests
      const harvestInputs = orchardProfiles!.map((p: any) => ({
        harvest_year: p.harvest_year,
        input: {
          orchard_type: orchard?.orchard_type || 'apple',
          climate_zone: orchard?.climate_zone || 'temperate',
          certification: orchard?.certification || 'conventional',
          location_country_code: orchard?.location_country_code || null,
          aware_factor: orchardAwareFactor,
          area_ha: p.area_ha,
          soil_management: p.soil_management,
          pruning_residue_returned: p.pruning_residue_returned ?? true,
          fertiliser_type: p.fertiliser_type,
          fertiliser_quantity_kg: p.fertiliser_quantity_kg,
          fertiliser_n_content_percent: p.fertiliser_n_content_percent,
          uses_pesticides: p.uses_pesticides,
          pesticide_applications_per_year: p.pesticide_applications_per_year,
          pesticide_type: p.pesticide_type || 'generic',
          uses_herbicides: p.uses_herbicides,
          herbicide_applications_per_year: p.herbicide_applications_per_year,
          herbicide_type: p.herbicide_type || 'generic',
          diesel_litres_per_year: p.diesel_litres_per_year,
          petrol_litres_per_year: p.petrol_litres_per_year,
          is_irrigated: p.is_irrigated,
          water_m3_per_ha: p.water_m3_per_ha,
          irrigation_energy_source: p.irrigation_energy_source,
          fruit_yield_tonnes: p.fruit_yield_tonnes,
          transport_distance_km: p.transport_distance_km || 0,
          transport_mode: p.transport_mode || 'road',
          soil_carbon_override_kg_co2e_per_ha: p.soil_carbon_override_kg_co2e_per_ha,
          soil_carbon_annual_change_kg_co2e_per_ha: p.soil_carbon_annual_change_kg_co2e_per_ha,
          soil_carbon_change_methodology: p.soil_carbon_change_methodology,
          soil_carbon_change_confidence: p.soil_carbon_change_confidence,
          previous_land_use_type: orchard?.previous_land_use_type,
          land_conversion_year: orchard?.land_conversion_year,
          harvest_year: p.harvest_year,
          tree_age: orchard?.planting_year != null
            ? p.harvest_year - orchard.planting_year
            : null,
          removal_verification_status: (p as any).removal_verification_status ?? 'unverified',
          removal_verifier_body: (p as any).removal_verifier_body,
          removal_verifier_standard: (p as any).removal_verifier_standard,
          removal_verification_date: (p as any).removal_verification_date,
          removal_verification_expiry: (p as any).removal_verification_expiry,
          ecosystem_type: (p as any).ecosystem_type ?? undefined,
          in_biodiversity_sensitive_area: (p as any).in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: (p as any).sensitive_area_details ?? undefined,
          water_stress_index: (p as any).water_stress_index ?? undefined,
        },
      }));

      // Multi-harvest averaging (median for 3+, mean for 2, single for 1)
      const multiHarvestResult = calculateMultiHarvestAverage(harvestInputs);
      const orchResult = multiHarvestResult.averaged_impacts;
      const harvestNote = orchardProfileCount > 1
        ? ` (${multiHarvestResult.method}: harvests ${multiHarvestResult.harvests_used.join(', ')})`
        : '';

      // --- Per-unit allocation ---
      // Orchard impacts are computed for the entire orchard area.
      // Normalise to per-unit using fruit yield and product-specific conversion.
      const rawUnitSize = product.unit_size_unit === 'ml'
        ? Number(product.unit_size_value) / 1000.0
        : Number(product.unit_size_value || 0.75);
      const unitSizeLitres = rawUnitSize > 0 ? rawUnitSize : 0.75;

      // Fruit-to-product conversion factor (kg fruit per litre finished product)
      // Determined by product type and production process.
      const FRUIT_CONVERSION_FACTORS: Record<string, number> = {
        spirits: 8.0,    // Calvados, fruit brandy: ~8 kg apples per litre (distillation)
        cider: 1.5,      // Cider/perry: ~1.5 kg fruit per litre
        wine: 1.3,       // Fruit wine: ~1.3 kg per litre (similar to grape)
        liqueur: 3.0,    // Fruit liqueur: ~3 kg per litre (maceration)
      };
      const productType = (product.product_type || '').toLowerCase();
      let fruitKgPerLitre = FRUIT_CONVERSION_FACTORS[productType] || 2.0; // Default 2 kg/L

      // Refine for specific spirit subtypes
      if (productType === 'spirits' || productType.includes('spirit')) {
        // Calvados and apple/pear brandy use high fruit concentration
        const productName = (product.name || '').toLowerCase();
        if (productName.includes('calvados') || productName.includes('brandy')) {
          fruitKgPerLitre = 8.0;
        } else if (productName.includes('liqueur')) {
          fruitKgPerLitre = 3.0;
        }
      }
      // Beer & Cider category
      if (productType.includes('cider') || productType.includes('beer')) {
        fruitKgPerLitre = 1.5;
      }

      const fruitKgPerUnit = unitSizeLitres * fruitKgPerLitre;
      const totalUnits = (orchardProfile.fruit_yield_tonnes * 1000) / fruitKgPerUnit;

      // Per-unit impact factors
      const orchFertFieldPerUnit = totalUnits > 0
        ? (orchResult.flag_emissions.total_flag_co2e + orchResult.non_flag_emissions.fertiliser_production_co2e) / totalUnits
        : 0;
      const orchFuelPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.machinery_fuel_co2e / totalUnits
        : 0;
      const orchIrrigationPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.irrigation_energy_co2e / totalUnits
        : 0;
      const orchTransportPerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.transport_co2e / totalUnits
        : 0;
      const orchWaterPerUnit = totalUnits > 0
        ? orchResult.water_m3 / totalUnits
        : 0;
      const orchWaterScarcityPerUnit = totalUnits > 0
        ? orchResult.water_scarcity_m3_eq / totalUnits
        : 0;
      const orchLandPerUnit = totalUnits > 0
        ? orchResult.flag_emissions.land_use_m2 / totalUnits
        : 0;
      const orchRemovalsPerUnit = totalUnits > 0
        ? orchResult.total_removals / totalUnits
        : 0;
      const orchPesticidePerUnit = totalUnits > 0
        ? orchResult.non_flag_emissions.pesticide_production_co2e / totalUnits
        : 0;
      const orchN2oKgPerUnit = totalUnits > 0
        ? orchResult.n2o_kg / totalUnits
        : 0;
      const orchLucPerUnit = totalUnits > 0
        ? orchResult.flag_emissions.luc_co2e / totalUnits
        : 0;

      console.log(`[calculateProductCarbonFootprint] Orchard per-unit: ${totalUnits.toFixed(0)} units (${fruitKgPerLitre} kg fruit/L), fert+N2O=${orchFertFieldPerUnit.toFixed(4)}, fuel=${orchFuelPerUnit.toFixed(4)}, transport=${orchTransportPerUnit.toFixed(4)}, removals=${orchRemovalsPerUnit.toFixed(4)}`);

      // Synthetic row template (shared fields)
      const orchBaseRow = {
        product_carbon_footprint_id: lca.id,
        material_type: 'ingredient' as const,
        quantity: unitSizeLitres,
        unit: 'L',
        unit_name: 'L',
        packaging_category: null,
        origin_country: orchard?.address_country || null,
        country_of_origin: orchard?.address_country || null,
        is_organic: orchard?.certification === 'organic' || orchard?.certification === 'biodynamic',
        is_organic_certified: orchard?.certification === 'organic',
        supplier_product_id: null,
        data_source: null,
        data_source_id: null,
        transport_mode: null,
        distance_km: null,
        impact_transport: 0,
        origin_address: null,
        origin_lat: orchard?.address_lat || null,
        origin_lng: orchard?.address_lng || null,
        origin_country_code: orchard?.location_country_code || null,
        data_priority: 2 as const,
        data_quality_tag: 'Secondary_Modelled' as const,
        supplier_lca_id: null,
        impact_source: 'secondary_modelled' as const,
        impact_reference_id: null,
        gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        non_gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
        is_hybrid_source: false,
        category_type: 'MANUFACTURING_MATERIAL',
      };

      // Row 1: Fertiliser & Field Emissions (N2O + production)
      lcaMaterialsWithImpacts.push({
        ...orchBaseRow,
        name: '[Orchard] Fertiliser & Field Emissions',
        material_name: '[Orchard] Fertiliser & Field Emissions',
        impact_climate: orchFertFieldPerUnit + orchPesticidePerUnit,
        // C31: fossil + biogenic must sum exactly to the fertiliser total; the 5% biogenic share covers urea/organic inputs
        impact_climate_fossil: orchFertFieldPerUnit * 0.95 + orchPesticidePerUnit,
        impact_climate_biogenic: orchFertFieldPerUnit * 0.05,
        impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0,
        n2o_kg: orchN2oKgPerUnit,
        impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
        impact_freshwater_ecotoxicity: totalUnits > 0 ? orchResult.freshwater_ecotoxicity / totalUnits : 0,
        impact_terrestrial_ecotoxicity: totalUnits > 0 ? orchResult.terrestrial_ecotoxicity / totalUnits : 0,
        impact_human_toxicity_non_carcinogenic: totalUnits > 0 ? orchResult.human_toxicity_non_carcinogenic / totalUnits : 0,
        impact_freshwater_eutrophication: totalUnits > 0 ? orchResult.freshwater_eutrophication / totalUnits : 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 65,
        methodology: orchResult.methodology_notes,
        source_reference: `Fertiliser: ${orchResult.flag_emissions.n2o_direct_co2e.toFixed(1)} kg CO2e direct N2O + ${orchResult.flag_emissions.n2o_indirect_co2e.toFixed(1)} kg indirect + ${orchResult.non_flag_emissions.fertiliser_production_co2e.toFixed(1)} kg production${harvestNote}`,
        data_quality_grade: orchResult.data_quality_grade,
      });

      // Row 2: Machinery Fuel
      if (orchFuelPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Machinery Fuel',
          material_name: '[Orchard] Machinery Fuel',
          impact_climate: orchFuelPerUnit,
          impact_climate_fossil: orchFuelPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2025 fuel combustion factors',
          source_reference: `Diesel: ${orchardProfile.diesel_litres_per_year} L/yr, Petrol: ${orchardProfile.petrol_litres_per_year} L/yr. Total: ${orchResult.non_flag_emissions.machinery_fuel_co2e.toFixed(1)} kg CO2e / ${totalUnits.toFixed(0)} units`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 3: Irrigation
      if (orchIrrigationPerUnit > 0 || orchWaterPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Irrigation',
          material_name: '[Orchard] Irrigation',
          impact_climate: orchIrrigationPerUnit,
          impact_climate_fossil: orchIrrigationPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: orchWaterPerUnit,
          impact_water_scarcity: orchWaterScarcityPerUnit, // AWARE-weighted
          impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 60,
          methodology: 'DEFRA 2025 / grid emission factors',
          source_reference: `Irrigation: ${orchResult.water_m3.toFixed(0)} m3 water, ${orchardProfile.irrigation_energy_source}. Energy: ${orchResult.non_flag_emissions.irrigation_energy_co2e.toFixed(1)} kg CO2e`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 4: Transport (orchard to processing facility)
      if (orchTransportPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Transport to Facility',
          material_name: '[Orchard] Transport to Facility',
          impact_climate: orchTransportPerUnit,
          impact_climate_fossil: orchTransportPerUnit,
          impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 70,
          methodology: 'DEFRA 2024 tonne-km factors',
          source_reference: `Transport: ${orchardProfile.transport_distance_km || 0} km by ${orchardProfile.transport_mode || 'road'}. ${orchResult.non_flag_emissions.transport_co2e.toFixed(1)} kg CO2e / ${totalUnits.toFixed(0)} units`,
          data_quality_grade: orchResult.data_quality_grade,
        });
      }

      // Row 5: Land Occupation
      lcaMaterialsWithImpacts.push({
        ...orchBaseRow,
        name: '[Orchard] Land Occupation',
        material_name: '[Orchard] Land Occupation',
        impact_climate: 0,
        impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
        ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
        impact_water: 0, impact_water_scarcity: 0,
        impact_land: orchLandPerUnit,
        impact_waste: 0,
        impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
        impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
        confidence_score: 80,
        methodology: 'Direct land occupation measurement',
        source_reference: `Orchard: ${orchardProfile.area_ha} ha (${orchResult.flag_emissions.land_use_m2.toFixed(0)} m2) / ${totalUnits.toFixed(0)} units`,
        data_quality_grade: 'HIGH',
      });

      // Row 5b: Land Use Change (dLUC) — IPCC 2019, amortised over 20 years
      if (orchLucPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard] Land Use Change (dLUC)',
          material_name: '[Orchard] Land Use Change (dLUC)',
          impact_climate: orchLucPerUnit,
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: orchLucPerUnit,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 50,
          methodology: 'IPCC 2019 direct land use change, amortised 20 years',
          source_reference: `dLUC: ${orchResult.flag_emissions.luc_co2e.toFixed(1)} kg CO2e from ${orchard?.previous_land_use_type || 'unknown'} conversion`,
          data_quality_grade: 'MEDIUM',
        });
      }

      // Row 6: Soil Carbon Removals (FLAG: separate from emissions)
      if (orchRemovalsPerUnit > 0) {
        lcaMaterialsWithImpacts.push({
          ...orchBaseRow,
          name: '[Orchard Removals] Soil Carbon',
          material_name: '[Orchard Removals] Soil Carbon',
          impact_climate: 0, // FLAG: removals NEVER stored in impact_climate
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          impact_removals_co2e: orchRemovalsPerUnit,
          confidence_score: orchResult.flag_removals.is_verified ? 75 : 45,
          methodology: `Soil carbon: ${orchResult.flag_removals.methodology}`,
          source_reference: `Soil management: ${orchardProfile.soil_management}. Total removals: ${orchResult.total_removals.toFixed(1)} kg CO2e/yr (${orchResult.flag_removals.methodology}). Per unit: ${orchRemovalsPerUnit.toFixed(4)} kg CO2e`,
          data_quality_grade: orchResult.flag_removals.is_verified ? 'MEDIUM' : 'LOW',
        });
      }

      console.log(`[calculateProductCarbonFootprint] ✓ Orchard impacts: emissions=${orchResult.total_emissions.toFixed(1)} kg CO2e, removals=${orchResult.total_removals.toFixed(1)} kg CO2e (${orchResult.flag_removals.methodology}), transport=${orchResult.non_flag_emissions.transport_co2e.toFixed(1)} kg CO2e, per-kg=${orchResult.total_emissions_per_kg.toFixed(4)} kg CO2e/kg fruit`);
    }

    // ========================================================================
    // 5d. ARABLE (Grain Growing) — Self-grown grain integration
    // ========================================================================
    //
    // Mirrors the viticulture and orchard integrations above. For producers who
    // grow their own grain (e.g. barley for whisky, wheat for vodka), the
    // arable calculator computes field-level emissions from fertiliser N2O,
    // crop residues, lime, machinery fuel, grain drying, irrigation, transport
    // and soil carbon removals.
    //
    // Allocation: unlike the vineyard/orchard sections, this section never
    // assumes the whole field feeds this product. Per-bottle arable impact =
    // (field emissions per kg of grain, from the multi-harvest average yield)
    // x (kg of self-grown grain per bottle from the actual ingredient row).

    // Find arable_field_id from self-grown ingredients linked to this product
    const { data: selfGrownArableIngredients } = await supabase
      .from('product_materials')
      .select('arable_field_id')
      .eq('product_id', parseInt(productId))
      .eq('is_self_grown', true)
      .not('arable_field_id', 'is', null);

    const arableFieldIds = Array.from(new Set(
      (selfGrownArableIngredients || []).map((m: any) => m.arable_field_id).filter(Boolean)
    ));

    const arableFieldId = arableFieldIds[0]; // Process first linked field
    const { data: arableProfilesRaw } = arableFieldId
      ? await supabase
          .from('arable_growing_profiles')
          .select('*, arable_fields(*)')
          .eq('arable_field_id', arableFieldId)
          .order('harvest_year', { ascending: false })
      : { data: null };

    // Draft profiles are incomplete questionnaires — never calculate from them
    const arableProfiles = (arableProfilesRaw || []).filter((p: any) => !p.is_draft);
    const arableProfile = arableProfiles[0];

    if (arableFieldId && !arableProfile) {
      calculatorWarnings.push(
        'A self-grown ingredient is linked to an arable field with no completed growing profile, so its farming emissions count as 0 in this footprint. Complete the growing profile for that field and recalculate to include them.'
      );
    }

    if (arableProfile) {
      const arableField = arableProfile.arable_fields as unknown as ArableField;
      const arableProfileCount = arableProfiles.length;
      console.log(`[calculateProductCarbonFootprint] Processing arable field "${arableField?.name || 'unknown'}" (${arableProfileCount} harvest${arableProfileCount > 1 ? 's' : ''})...`);

      // Resolve AWARE water scarcity factor for the field's country
      const arableCountryCode = arableField?.location_country_code;
      let arableAwareFactor = 1.0;
      if (arableCountryCode) {
        const arableAwareData = await getAwareFactor(supabase, arableCountryCode);
        if (arableAwareData) arableAwareFactor = Number(arableAwareData.aware_factor);
      }

      // Build inputs for all available harvests (same shape the arable field
      // page and questionnaire pass to calculateArableImpacts)
      const arableHarvestInputs = arableProfiles.map((p: any) => ({
        harvest_year: p.harvest_year,
        input: {
          crop_type: arableField?.crop_type || 'other',
          climate_zone: arableField?.climate_zone || 'temperate',
          certification: arableField?.certification || 'conventional',
          location_country_code: arableField?.location_country_code || null,
          aware_factor: arableAwareFactor,
          area_ha: p.area_ha,
          soil_management: p.soil_management,
          straw_management: p.straw_management,
          straw_yield_tonnes_per_ha: p.straw_yield_tonnes_per_ha,
          lime_applied_kg_per_ha: p.lime_applied_kg_per_ha,
          lime_type: p.lime_type,
          fertiliser_type: p.fertiliser_type,
          fertiliser_quantity_kg: p.fertiliser_quantity_kg,
          fertiliser_n_content_percent: p.fertiliser_n_content_percent,
          uses_pesticides: p.uses_pesticides,
          pesticide_applications_per_year: p.pesticide_applications_per_year,
          pesticide_type: p.pesticide_type || 'generic',
          uses_herbicides: p.uses_herbicides,
          herbicide_applications_per_year: p.herbicide_applications_per_year,
          herbicide_type: p.herbicide_type || 'generic',
          uses_growth_regulators: p.uses_growth_regulators,
          growth_regulator_applications: p.growth_regulator_applications,
          seed_rate_kg_per_ha: p.seed_rate_kg_per_ha,
          diesel_litres_per_year: p.diesel_litres_per_year,
          petrol_litres_per_year: p.petrol_litres_per_year,
          grain_drying_fuel: p.grain_drying_fuel,
          grain_drying_energy_kwh_per_tonne: p.grain_drying_energy_kwh_per_tonne,
          is_irrigated: p.is_irrigated,
          water_m3_per_ha: p.water_m3_per_ha,
          irrigation_energy_source: p.irrigation_energy_source,
          grain_yield_tonnes: p.grain_yield_tonnes,
          grain_moisture_percent: p.grain_moisture_percent,
          transport_distance_km: p.transport_distance_km,
          transport_mode: p.transport_mode,
          soil_carbon_override_kg_co2e_per_ha: p.soil_carbon_override_kg_co2e_per_ha,
          soil_carbon_annual_change_kg_co2e_per_ha: p.soil_carbon_annual_change_kg_co2e_per_ha,
          soil_carbon_change_methodology: p.soil_carbon_change_methodology,
          soil_carbon_change_confidence: p.soil_carbon_change_confidence,
          previous_land_use_type: arableField?.previous_land_use_type,
          land_conversion_year: arableField?.land_conversion_year,
          harvest_year: p.harvest_year,
          land_ownership_type: (p as any).land_ownership_type ?? undefined,
          lease_expiry_date: (p as any).lease_expiry_date ?? null,
          is_boundary_controlled: (p as any).is_boundary_controlled ?? undefined,
          removal_verification_status: (p as any).removal_verification_status ?? 'unverified',
          removal_verifier_body: (p as any).removal_verifier_body ?? undefined,
          removal_verifier_standard: (p as any).removal_verifier_standard ?? undefined,
          removal_verification_date: (p as any).removal_verification_date ?? undefined,
          removal_verification_expiry: (p as any).removal_verification_expiry ?? undefined,
          ecosystem_type: (p as any).ecosystem_type ?? undefined,
          in_biodiversity_sensitive_area: (p as any).in_biodiversity_sensitive_area ?? false,
          sensitive_area_details: (p as any).sensitive_area_details ?? undefined,
          water_stress_index: (p as any).water_stress_index ?? undefined,
        } as ArableCalculatorInput,
      }));

      // Multi-harvest averaging (median for 3+, mean for 2, single for 1)
      const multiHarvestArable = calculateArableMultiHarvestAverage(arableHarvestInputs);
      const araResult = multiHarvestArable.averaged_impacts;
      const arableHarvestNote = arableProfileCount > 1
        ? ` (${multiHarvestArable.method}: harvests ${multiHarvestArable.harvests_used.join(', ')})`
        : '';

      // --- Per-bottle allocation ---
      // kg of self-grown grain per bottle from the actual ingredient row(s):
      // batch-scoped ingredient quantities are normalised to kg and divided by
      // the same bottles-per-batch divisor used for every other ingredient.
      const selfGrownGrainRows = (materials || []).filter(
        (m: any) => m.is_self_grown && m.arable_field_id === arableFieldId
      );
      const grainKgPerBottle = selfGrownGrainRows.reduce((sum: number, m: any) => {
        const norm = tryNormalizeToKg(m.quantity, m.unit);
        return sum + (norm.recognised && norm.kind !== 'count' ? norm.kg / allocationDivisorFor(m) : 0);
      }, 0);

      // Per-kg grain intensity denominator: multi-harvest AVERAGE yield,
      // consistent with the multi-harvest averaged impact numerators.
      const avgGrainYieldKg = averageForMethod(
        arableProfiles.map((p: any) => (Number(p.grain_yield_tonnes) || 0) * 1000),
        multiHarvestArable.method
      );

      if (!(grainKgPerBottle > 0)) {
        calculatorWarnings.push(
          `The self-grown ingredient from arable field "${arableField?.name || 'unknown'}" has no usable weight, so its farming emissions count as 0 in this footprint. Enter the ingredient quantity in a weight unit (e.g. kg) and recalculate.`
        );
      } else if (!(avgGrainYieldKg > 0)) {
        calculatorWarnings.push(
          `The growing profile for arable field "${arableField?.name || 'unknown'}" has no grain yield, so its farming emissions count as 0 in this footprint. Add the grain yield to the growing profile and recalculate.`
        );
      } else {
        // Per-bottle = (field-level total / field yield in kg) x kg grain per bottle
        const arPerBottle = (fieldTotal: number) =>
          (fieldTotal / avgGrainYieldKg) * grainKgPerBottle;

        // FLAG field emissions excluding dLUC (dLUC gets its own row below,
        // total_flag_co2e includes luc_co2e so subtract it to avoid double count)
        const araFlagExLuc = araResult.flag_emissions.total_flag_co2e - araResult.flag_emissions.luc_co2e;
        const araFertFieldPerBottle = arPerBottle(araFlagExLuc + araResult.non_flag_emissions.fertiliser_production_co2e);
        const araInputsPerBottle = arPerBottle(
          araResult.non_flag_emissions.pesticide_production_co2e +
          araResult.non_flag_emissions.seed_production_co2e +
          araResult.non_flag_emissions.growth_regulator_co2e
        );
        const araFuelPerBottle = arPerBottle(araResult.non_flag_emissions.machinery_fuel_co2e);
        const araDryingPerBottle = arPerBottle(araResult.non_flag_emissions.grain_drying_co2e);
        const araIrrigationPerBottle = arPerBottle(araResult.non_flag_emissions.irrigation_energy_co2e);
        const araTransportPerBottle = arPerBottle(araResult.non_flag_emissions.transport_co2e);
        const araWaterPerBottle = arPerBottle(araResult.water_m3);
        const araWaterScarcityPerBottle = arPerBottle(araResult.water_scarcity_m3_eq);
        const araLandPerBottle = arPerBottle(araResult.flag_emissions.land_use_m2);
        const araRemovalsPerBottle = arPerBottle(araResult.total_removals);
        const araN2oKgPerBottle = arPerBottle(araResult.n2o_kg);
        const araLucPerBottle = arPerBottle(araResult.flag_emissions.luc_co2e);

        console.log(`[calculateProductCarbonFootprint] Arable per-bottle: ${grainKgPerBottle.toFixed(3)} kg grain/bottle, yield=${avgGrainYieldKg.toFixed(0)} kg, fert+field=${araFertFieldPerBottle.toFixed(4)}, fuel=${araFuelPerBottle.toFixed(4)}, drying=${araDryingPerBottle.toFixed(4)}, removals=${araRemovalsPerBottle.toFixed(4)}`);

        const rawArableUnitSize = product.unit_size_unit === 'ml'
          ? Number(product.unit_size_value) / 1000.0
          : Number(product.unit_size_value || 0.75);
        const arableUnitSizeLitres = rawArableUnitSize > 0 ? rawArableUnitSize : 0.75;

        const CROP_LABELS: Record<string, string> = {
          barley: 'Barley', wheat: 'Wheat', oats: 'Oats', rye: 'Rye', maize: 'Maize', other: 'Grain',
        };
        const cropLabel = CROP_LABELS[arableField?.crop_type || 'other'] || 'Grain';

        // Synthetic row template (shared fields — same shape as the
        // [Viticulture]/[Orchard] rows so the DB insert cannot fail)
        const araBaseRow = {
          product_carbon_footprint_id: lca.id,
          material_type: 'ingredient' as const,
          quantity: arableUnitSizeLitres,
          unit: 'L',
          unit_name: 'L',
          packaging_category: null,
          origin_country: arableField?.address_country || null,
          country_of_origin: arableField?.address_country || null,
          is_organic: arableField?.certification === 'organic',
          is_organic_certified: arableField?.certification === 'organic',
          supplier_product_id: null,
          data_source: null,
          data_source_id: null,
          transport_mode: null,
          distance_km: null,
          impact_transport: 0,
          origin_address: null,
          origin_lat: arableField?.address_lat || null,
          origin_lng: arableField?.address_lng || null,
          origin_country_code: arableField?.location_country_code || null,
          data_priority: 2 as const,
          data_quality_tag: 'Secondary_Modelled' as const,
          supplier_lca_id: null,
          impact_source: 'secondary_modelled' as const,
          impact_reference_id: null,
          gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
          non_gwp_data_source: 'IPCC 2019 Tier 1 / DEFRA 2025',
          is_hybrid_source: false,
          // NOTE: category_type is a Postgres enum (material_category_type)
          // without an 'arable' value, so the shared manufacturing bucket is
          // used; the aggregator buckets these rows by the [Arable] name prefix.
          category_type: 'MANUFACTURING_MATERIAL',
        };

        // Row 1: Fertiliser & Field Emissions (N2O + residues + lime + input production)
        lcaMaterialsWithImpacts.push({
          ...araBaseRow,
          name: `[Arable] ${cropLabel} Fertiliser & Field Emissions`,
          material_name: `[Arable] ${cropLabel} Fertiliser & Field Emissions`,
          impact_climate: araFertFieldPerBottle + araInputsPerBottle,
          // C31: fossil + biogenic must sum exactly to the fertiliser total; the 5% biogenic share covers urea/organic inputs
          impact_climate_fossil: araFertFieldPerBottle * 0.95 + araInputsPerBottle,
          impact_climate_biogenic: araFertFieldPerBottle * 0.05,
          impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0,
          n2o_kg: araN2oKgPerBottle,
          impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
          impact_freshwater_ecotoxicity: arPerBottle(araResult.freshwater_ecotoxicity),
          impact_terrestrial_ecotoxicity: arPerBottle(araResult.terrestrial_ecotoxicity),
          impact_human_toxicity_non_carcinogenic: arPerBottle(araResult.human_toxicity_non_carcinogenic),
          impact_freshwater_eutrophication: arPerBottle(araResult.freshwater_eutrophication),
          impact_terrestrial_acidification: arPerBottle(araResult.terrestrial_acidification),
          impact_fossil_resource_scarcity: 0,
          confidence_score: 65,
          methodology: araResult.methodology_notes,
          source_reference: `Fertiliser: ${araResult.flag_emissions.n2o_direct_co2e.toFixed(1)} kg CO2e direct N2O + ${araResult.flag_emissions.n2o_indirect_co2e.toFixed(1)} kg indirect + ${araResult.flag_emissions.n2o_crop_residue_co2e.toFixed(1)} kg crop residue + ${araResult.flag_emissions.lime_co2e.toFixed(1)} kg lime + ${araResult.non_flag_emissions.fertiliser_production_co2e.toFixed(1)} kg production${arableHarvestNote}`,
          data_quality_grade: araResult.data_quality_grade,
        });

        // Row 2: Machinery Fuel
        if (araFuelPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable] ${cropLabel} Machinery Fuel`,
            material_name: `[Arable] ${cropLabel} Machinery Fuel`,
            impact_climate: araFuelPerBottle,
            impact_climate_fossil: araFuelPerBottle,
            impact_climate_biogenic: 0, impact_climate_dluc: 0,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            confidence_score: 70,
            methodology: 'DEFRA 2025 fuel combustion factors',
            source_reference: `Diesel: ${arableProfile.diesel_litres_per_year} L/yr, Petrol: ${arableProfile.petrol_litres_per_year} L/yr. Total: ${araResult.non_flag_emissions.machinery_fuel_co2e.toFixed(1)} kg CO2e for the field`,
            data_quality_grade: araResult.data_quality_grade,
          });
        }

        // Row 3: Grain Drying
        if (araDryingPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable] ${cropLabel} Grain Drying`,
            material_name: `[Arable] ${cropLabel} Grain Drying`,
            impact_climate: araDryingPerBottle,
            impact_climate_fossil: araDryingPerBottle,
            impact_climate_biogenic: 0, impact_climate_dluc: 0,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            confidence_score: 70,
            methodology: 'DEFRA 2025 fuel combustion / grid emission factors',
            source_reference: `Grain drying: ${arableProfile.grain_drying_fuel}, ${arableProfile.grain_drying_energy_kwh_per_tonne} kWh/t. Total: ${araResult.non_flag_emissions.grain_drying_co2e.toFixed(1)} kg CO2e for the field`,
            data_quality_grade: araResult.data_quality_grade,
          });
        }

        // Row 4: Irrigation
        if (araIrrigationPerBottle > 0 || araWaterPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable] ${cropLabel} Irrigation`,
            material_name: `[Arable] ${cropLabel} Irrigation`,
            impact_climate: araIrrigationPerBottle,
            impact_climate_fossil: araIrrigationPerBottle,
            impact_climate_biogenic: 0, impact_climate_dluc: 0,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: araWaterPerBottle,
            impact_water_scarcity: araWaterScarcityPerBottle, // AWARE-weighted
            impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            confidence_score: 60,
            methodology: 'DEFRA 2025 / grid emission factors',
            source_reference: `Irrigation: ${araResult.water_m3.toFixed(0)} m3 water, ${arableProfile.irrigation_energy_source}. Energy: ${araResult.non_flag_emissions.irrigation_energy_co2e.toFixed(1)} kg CO2e`,
            data_quality_grade: araResult.data_quality_grade,
          });
        }

        // Row 5: Transport (field to processing facility)
        if (araTransportPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable] ${cropLabel} Transport to Facility`,
            material_name: `[Arable] ${cropLabel} Transport to Facility`,
            impact_climate: araTransportPerBottle,
            impact_climate_fossil: araTransportPerBottle,
            impact_climate_biogenic: 0, impact_climate_dluc: 0,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            confidence_score: 70,
            methodology: 'DEFRA 2024 tonne-km factors',
            source_reference: `Transport: ${arableProfile.transport_distance_km || 0} km by ${arableProfile.transport_mode || 'road'}. ${araResult.non_flag_emissions.transport_co2e.toFixed(1)} kg CO2e for the field`,
            data_quality_grade: araResult.data_quality_grade,
          });
        }

        // Row 6: Land Occupation
        lcaMaterialsWithImpacts.push({
          ...araBaseRow,
          name: `[Arable] ${cropLabel} Land Occupation`,
          material_name: `[Arable] ${cropLabel} Land Occupation`,
          impact_climate: 0, // Land occupation itself has no direct climate impact
          impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
          ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
          impact_water: 0, impact_water_scarcity: 0,
          impact_land: araLandPerBottle,
          impact_waste: 0,
          impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
          impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
          confidence_score: 80,
          methodology: 'Direct land occupation measurement',
          source_reference: `Field: ${arableProfile.area_ha} ha (${araResult.flag_emissions.land_use_m2.toFixed(0)} m2), ${grainKgPerBottle.toFixed(3)} kg grain per bottle`,
          data_quality_grade: 'HIGH',
        });

        // Row 6b: Land Use Change (dLUC) — IPCC 2019, amortised over 20 years
        if (araLucPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable] ${cropLabel} Land Use Change (dLUC)`,
            material_name: `[Arable] ${cropLabel} Land Use Change (dLUC)`,
            impact_climate: araLucPerBottle,
            impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: araLucPerBottle,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            confidence_score: 50,
            methodology: 'IPCC 2019 direct land use change, amortised 20 years',
            source_reference: `dLUC: ${araResult.flag_emissions.luc_co2e.toFixed(1)} kg CO2e from ${arableField?.previous_land_use_type || 'unknown'} conversion`,
            data_quality_grade: 'MEDIUM',
          });
        }

        // Row 7: Soil Carbon Removals (FLAG: separate from emissions)
        if (araRemovalsPerBottle > 0) {
          lcaMaterialsWithImpacts.push({
            ...araBaseRow,
            name: `[Arable Removals] ${cropLabel} Soil Carbon`,
            material_name: `[Arable Removals] ${cropLabel} Soil Carbon`,
            impact_climate: 0, // FLAG: removals NEVER stored in impact_climate
            impact_climate_fossil: 0, impact_climate_biogenic: 0, impact_climate_dluc: 0,
            ch4_kg: 0, ch4_fossil_kg: 0, ch4_biogenic_kg: 0, n2o_kg: 0,
            impact_water: 0, impact_water_scarcity: 0, impact_land: 0, impact_waste: 0,
            impact_terrestrial_ecotoxicity: 0, impact_freshwater_eutrophication: 0,
            impact_terrestrial_acidification: 0, impact_fossil_resource_scarcity: 0,
            // FLAG-compliant: removals in dedicated column (always positive)
            impact_removals_co2e: araRemovalsPerBottle,
            confidence_score: araResult.flag_removals.is_verified ? 75 : 45,
            methodology: `Soil carbon: ${araResult.flag_removals.methodology}`,
            source_reference: `Soil management: ${arableProfile.soil_management}. Total removals: ${araResult.total_removals.toFixed(1)} kg CO2e/yr (${araResult.flag_removals.methodology}). Per bottle: ${araRemovalsPerBottle.toFixed(4)} kg CO2e`,
            data_quality_grade: araResult.flag_removals.is_verified ? 'MEDIUM' : 'LOW',
          });
        }

        console.log(`[calculateProductCarbonFootprint] ✓ Arable impacts: emissions=${araResult.total_emissions.toFixed(1)} kg CO2e, removals=${araResult.total_removals.toFixed(1)} kg CO2e (${araResult.flag_removals.methodology}), per-kg=${araResult.total_emissions_per_kg.toFixed(4)} kg CO2e/kg grain, ${grainKgPerBottle.toFixed(3)} kg grain/bottle`);
      }
    }

    // 6. Insert all materials with impact values into product_lca_materials
    // Inject multipack component footprints as material rows so the aggregator
    // folds them into the headline total. Each row carries a component product's
    // full lifecycle footprint (already per functional unit) × quantity. With a
    // material_type that isn't 'packaging' and a plain name, they land in the
    // aggregator's raw-materials ("contents") bucket. impact_source must be one
    // of the enum values (secondary_modelled) per the DB CHECK.
    for (const cf of multipackComponentFootprints) {
      lcaMaterialsWithImpacts.push({
        product_carbon_footprint_id: lca.id,
        name: `${cf.name} (×${cf.quantity})`,
        material_name: `${cf.name} (×${cf.quantity})`,
        material_type: 'multipack_component',
        quantity: cf.quantity,
        unit: 'unit',
        unit_name: 'unit',
        impact_climate: cf.total,
        impact_climate_fossil: cf.fossil,
        impact_climate_biogenic: cf.biogenic,
        impact_climate_dluc: cf.dluc,
        impact_transport: 0,
        is_biogenic_carbon: false,
        carbon_split_estimated: false,
        // The component footprint is itself a fully resolved PCF, so treat its
        // data quality as good rather than dragging the multipack DQI down.
        confidence_score: 80,
        data_priority: 1,
        data_quality_grade: 'HIGH',
        source_reference: 'Component product footprint',
        impact_source: 'secondary_modelled',
        methodology: 'Aggregated component PCF',
      });
    }
    if (multipackComponentFootprints.length > 0) {
      console.log(`[calculateProductCarbonFootprint] Injected ${multipackComponentFootprints.length} multipack component rows`);
    }

    // Ensure every row has impact_removals_co2e set (NOT NULL column, DEFAULT 0).
    // The Supabase JS client sends undefined as null which violates the constraint.
    const materialsWithDefaults = lcaMaterialsWithImpacts.map((m: any) => ({
      ...m,
      impact_removals_co2e: m.impact_removals_co2e ?? 0,
    }));

    const { error: insertError } = await supabase
      .from('product_carbon_footprint_materials')
      .insert(materialsWithDefaults);

    if (insertError) {
      // NEVER delete the row: it carries the user's autosaved wizard state.
      // Mark it failed so the wizard can resume it.
      await supabase
        .from('product_carbon_footprints')
        .update({
          status: 'failed',
          error_message: `Failed to insert materials: ${insertError.message}`.slice(0, 1000),
          updated_at: new Date().toISOString(),
        })
        .eq('id', lca.id);
      throw new Error(`Failed to insert materials: ${insertError.message}`);
    }

    console.log(`[calculateProductCarbonFootprint] Inserted ${lcaMaterialsWithImpacts.length} materials into database`);

    // 7. Import current production site allocations
    // ALWAYS use fresh data from contract_manufacturer_allocations, not stale LCA data
    console.log(`[calculateProductCarbonFootprint] Loading current production site allocations for product ${productId}...`);

    const { data: cmAllocations, error: cmError } = await supabase
      .from('contract_manufacturer_allocations')
      .select('*')
      .eq('product_id', parseInt(productId))
      .eq('organization_id', product.organization_id)
      .order('reporting_period_start', { ascending: false });

    if (cmError) {
      console.error('[calculateProductCarbonFootprint] ❌ Failed to query contract manufacturer allocations');
      console.error('[calculateProductCarbonFootprint] Error details:', cmError);
      console.error('[calculateProductCarbonFootprint] This might indicate:');
      console.error('[calculateProductCarbonFootprint]   - RLS policy blocking access');
      console.error('[calculateProductCarbonFootprint]   - Database connection issue');
      console.error('[calculateProductCarbonFootprint]   - Missing table/columns (run: supabase db reset --local)');

      throw new Error(`Failed to fetch production site data: ${cmError.message}`);
    }

    console.log(`[calculateProductCarbonFootprint] ✓ Contract manufacturer query successful`);
    console.log(`[calculateProductCarbonFootprint] Found ${cmAllocations?.length || 0} allocations for product ${productId}`);

    if (!cmAllocations || cmAllocations.length === 0) {
      console.warn('[calculateProductCarbonFootprint] ⚠️  No contract manufacturer allocations found');
      console.warn('[calculateProductCarbonFootprint] Expected at least 1 allocation for TEST CALVADOS');
      console.warn('[calculateProductCarbonFootprint] Check if migration 20251219165224 was applied: supabase db reset --local');
      console.warn('[calculateProductCarbonFootprint] Or create allocation manually in Production Sites tab');
    } else {
      console.log('[calculateProductCarbonFootprint] Allocation details:', cmAllocations.map(a => ({
        id: a.id,
        facility_id: a.facility_id,
        emissions: a.allocated_emissions_kg_co2e,
        scope1: a.scope1_emissions_kg_co2e,
        scope2: a.scope2_emissions_kg_co2e,
        status: a.status
      })));
    }

    if (cmAllocations && cmAllocations.length > 0) {
      // Contract manufacturer allocations stay in their own table
      // The Edge Function will read from both product_lca_production_sites AND contract_manufacturer_allocations
      console.log(`[calculateProductCarbonFootprint] Found ${cmAllocations.length} contract manufacturer allocations`);
      console.log(`[calculateProductCarbonFootprint] These will be read directly by the Edge Function from contract_manufacturer_allocations table`);
      console.log('[calculateProductCarbonFootprint] Contract manufacturers:', cmAllocations.map(a => ({
        facility_id: a.facility_id,
        emissions: a.allocated_emissions_kg_co2e,
        scope1: a.scope1_emissions_kg_co2e,
        scope2: a.scope2_emissions_kg_co2e,
        status: a.status
      })));

      const totalAllocationEmissions = cmAllocations.reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductCarbonFootprint] Total contract manufacturer emissions: ${totalAllocationEmissions.toFixed(2)} kg CO2e`);
    } else {
      console.log(`[calculateProductCarbonFootprint] No contract manufacturer allocations found for this product`);
    }

    // Verify data sources are available
    console.log('[calculateProductCarbonFootprint] 🔍 Verifying production data sources...');

    // Check owned production sites
    const { data: ownedSitesData, error: ownedVerifyError } = await supabase
      .from('product_carbon_footprint_production_sites')
      .select('id, facility_id, allocated_emissions_kg_co2e, scope1_emissions_kg_co2e, scope2_emissions_kg_co2e')
      .eq('product_carbon_footprint_id', lca.id);

    if (ownedVerifyError) {
      console.error('[calculateProductCarbonFootprint] ❌ Failed to verify owned sites:', ownedVerifyError);
    } else {
      const ownedEmissions = (ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductCarbonFootprint] Owned production sites: ${ownedSitesData?.length || 0} (${ownedEmissions.toFixed(2)} kg CO2e)`);
    }

    // Check contract manufacturer allocations
    const cmEmissions = (cmAllocations || []).reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
    console.log(`[calculateProductCarbonFootprint] Contract manufacturers: ${cmAllocations?.length || 0} (${cmEmissions.toFixed(2)} kg CO2e)`);

    const totalSites = (ownedSitesData?.length || 0) + (cmAllocations?.length || 0);
    const totalEmissions = ((ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0)) + cmEmissions;

    if (totalSites > 0) {
      console.log(`[calculateProductCarbonFootprint] ✅ Total production sources: ${totalSites} (${totalEmissions.toFixed(2)} kg CO2e)`);
      console.log('[calculateProductCarbonFootprint] Edge Function will read from both tables');
    } else {
      console.warn('[calculateProductCarbonFootprint] ⚠️  No production sites or contract manufacturers found');
      console.warn('[calculateProductCarbonFootprint] Processing emissions will be zero unless manually entered');
    }

    // 8. Run aggregation to calculate totals (client-side, no edge function needed)
    onProgress?.('Aggregating lifecycle impacts...', 75);
    console.log(`[calculateProductCarbonFootprint] Calling aggregation engine...`);

    // 8a. Finalise pending fallback events with actual resolution data.
    // Events pushed by the waterfall resolver have resolved_priority=0; update them
    // with the final resolved priority and factor value from the material that was saved.
    for (const evt of fallbackEvents) {
      if (evt.resolved_priority === 0) {
        const mat = lcaMaterialsWithImpacts.find((m: any) => m.material_name === evt.material_name);
        if (mat) {
          evt.resolved_priority = mat.data_priority || 3;
          evt.factor_value_kg_co2e = mat.quantity > 0 ? mat.impact_climate / mat.quantity : 0;
          evt.source_reference = mat.source_reference || '';
        }
      }
    }

    // 8b. Build per-material resolution snapshot for fingerprinting and audit
    const materialResolutions = lcaMaterialsWithImpacts.map((m: any) => ({
      name: m.material_name,
      quantity_kg: m.quantity,
      impact_climate_per_kg: m.quantity > 0 ? m.impact_climate / m.quantity : 0,
      priority_resolved: m.data_priority,
      source: m.source_reference,
      confidence: m.confidence_score,
      gwp_data_source: m.gwp_data_source,
    }));

    // 8c. Generate calculation fingerprint for determinism verification
    let calculationFingerprint = '';
    try {
      calculationFingerprint = await generateCalculationFingerprint({
        materials: materials.map(m => {
          // Parametric packaging rows fingerprint their endpoint pin so a
          // library version bump marks dependent products stale, while
          // unchanged inputs stay byte-identical.
          const pin = parametricEndpointByMaterialId.get(String(m.id));
          return {
            name: m.material_name,
            quantity_kg: normalizeToKg(m.quantity, m.unit) / allocationDivisorFor(m),
            data_source_id: pin
              ? `${pin.material_class}|${pin.variant}|${pin.id}|v${pin.library_version}|r${m.recycled_content_percentage ?? 0}`
              : m.data_source_id,
          };
        }),
        factorValues: materialResolutions.map((r: any) => ({
          name: r.name,
          impact_climate_per_kg: r.impact_climate_per_kg,
          gwp_data_source: r.gwp_data_source,
        })),
        facilityAllocations: params.facilityAllocations,
        systemBoundary: systemBoundary || 'cradle-to-gate',
        referenceYear: referenceYear || new Date().getFullYear(),
      });
      console.log(`[calculateProductCarbonFootprint] Calculation fingerprint: ${calculationFingerprint.slice(0, 16)}...`);
    } catch (fpErr) {
      console.warn('[calculateProductCarbonFootprint] Fingerprint generation failed (non-fatal):', fpErr);
    }

    console.log(`[calculateProductCarbonFootprint] Passing ${collectedFacilityEmissions.length} facility emissions to aggregator (boundary: ${systemBoundary || 'cradle-to-gate'})`);
    const aggregationResult = await aggregateProductImpacts(
      supabase,
      lca.id,
      collectedFacilityEmissions,
      systemBoundary,
      params.usePhaseConfig,
      params.eolConfig,
      params.distributionConfig,
      params.productLossConfig,
      calculationFingerprint,
      fallbackEvents,
      materialResolutions,
      referenceYear,
      calculatorWarnings,
    );

    if (!aggregationResult.success) {
      console.error('[calculateProductCarbonFootprint] Aggregation error:', aggregationResult.error);
      throw new Error(`Calculation failed: ${aggregationResult.error}`);
    }

    console.log(`[calculateProductCarbonFootprint] ✓ Calculation complete for LCA: ${lca.id}`);

    // 8d. Write to immutable calculation audit log (LOW FIX #23).
    //
    // ISO 14067 §6.5.6 and GHG Protocol Product Standard Annex B require that
    // calculation parameters are retained to enable third-party verification.
    // The calculation_logs table is append-only (UPDATE/DELETE are blocked by DB triggers).
    //
    // AUDITABILITY FIX: Collect resolved_factor_id from each material's waterfall
    // result for full factor traceability. Every return path in resolveImpactFactors
    // now sets resolved_factor_id to the actual DB record UUID used, eliminating
    // the previous sentinel placeholder.
    try {
      const factorIdsUsed = resolvedFactorIdsUsed.filter(Boolean);
      // Deduplicate and fall back to a descriptive marker if no IDs were collected
      const uniqueFactorIds = Array.from(new Set(factorIdsUsed));
      if (uniqueFactorIds.length === 0) {
        console.warn(`[calculateProductCarbonFootprint] ⚠ No resolved_factor_id found on any material — factor traceability gap. Skipping audit log (factor_ids_used requires valid UUIDs).`);
      } else {
      const { error: auditErr } = await supabase
        .from('calculation_logs')
        .insert({
          organization_id: product.organization_id,
          user_id: actingUserId,
          calculation_id: null, // FK references calculated_emissions, not product_carbon_footprints
          input_data: {
            product_id: productId,
            product_carbon_footprint_id: lca.id,
            product_name: product.name,
            system_boundary: systemBoundary || 'cradle-to-gate',
            reference_year: referenceYear || new Date().getFullYear(),
            materials_count: lcaMaterialsWithImpacts.length,
            facility_allocations_count: facilityAllocations?.length || 0,
            calculation_fingerprint: calculationFingerprint || null,
            pinned_from_pcf_id: params.pinnedPcfId || null,
            material_resolutions: materialResolutions,
            fallback_events: fallbackEvents.length > 0 ? fallbackEvents : undefined,
          },
          output_value: aggregationResult.total_carbon_footprint,
          output_unit: 'kg CO2e per functional unit',
          methodology_version: 'ISO 14067:2018 / GHG Protocol Product v2.1.0',
          factor_ids_used: uniqueFactorIds,
          data_quality_tier: aggregationResult.impacts?.data_quality?.score >= 80 ? 1
            : aggregationResult.impacts?.data_quality?.score >= 50 ? 2 : 3,
          multiplication_proof: `${aggregationResult.total_carbon_footprint.toFixed(6)} kg CO2e = sum of ${lcaMaterialsWithImpacts.length} materials`,
        });
      if (auditErr) {
        // Non-fatal: audit log failure should never abort a successful calculation
        console.warn(`[calculateProductCarbonFootprint] ⚠️ Audit log write failed (non-fatal): ${auditErr.message}`);
      } else {
        console.log(`[calculateProductCarbonFootprint] ✓ Audit log written for LCA ${lca.id}`);
      }
      }
    } catch (auditWriteErr: any) {
      console.warn(`[calculateProductCarbonFootprint] ⚠️ Audit log write exception (non-fatal): ${auditWriteErr.message}`);
    }

    // 9. Auto-generate Life Cycle Interpretation (ISO 14044 Section 4.5)
    try {
      onProgress?.('Generating life cycle interpretation...', 90);
      console.log(`[calculateProductCarbonFootprint] Generating Life Cycle Interpretation...`);
      const interpretationResult = await generateLcaInterpretation(supabase, {
        productCarbonFootprintId: lca.id,
        organizationId: product.organization_id,
      });
      if (interpretationResult.success) {
        console.log(`[calculateProductCarbonFootprint] ✓ Interpretation generated successfully`);
      } else {
        console.warn(`[calculateProductCarbonFootprint] ⚠ Interpretation generation failed: ${interpretationResult.error}`);
      }
    } catch (interpError: any) {
      console.warn(`[calculateProductCarbonFootprint] ⚠ Non-critical: Interpretation generation error: ${interpError.message}`);
    }

    onProgress?.('Calculation complete', 100);

    return {
      success: true,
      pcfId: lca.id,
      lcaId: lca.id // backward compatibility
    };

  } catch (error: any) {
    console.error('[calculateProductCarbonFootprint] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate Product Carbon Footprint'
    };
  }
}

/** @deprecated Use calculateProductCarbonFootprint instead */
export const calculateProductLCA = calculateProductCarbonFootprint;
