// Parametric packaging factor derivation.
//
// Replaces factor search for packaging: given a vetted endpoint row
// (packaging_factor_endpoints) and the item's recycled content, the
// cradle-to-gate factor is a pure linear interpolation:
//
//     factor_per_kg = virgin_ef - r * (virgin_ef - recycled_ef)    r in [0, 1]
//
// This is the standard recycled-content (cut-off) treatment (PAS 2050, GHG
// Protocol Product Standard, PEF): linear, monotonic, bounded by the two
// endpoints, and fully reproducible. Every impact category interpolates the
// same way. Because the recycling benefit is claimed here on the INPUT side,
// end-of-life for parametric rows must use cut-off allocation (no recycling
// credit) — enforced in lib/product-lca-aggregator.ts.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WaterfallResult } from '@/lib/impact-waterfall-resolver';

/** Row shape of public.packaging_factor_endpoints. */
export interface PackagingFactorEndpoint {
  id: string;
  material_class: string;
  variant: string;
  region: string;
  virgin_climate: number;
  recycled_climate: number;
  virgin_climate_fossil: number;
  recycled_climate_fossil: number;
  virgin_climate_biogenic: number | null;
  recycled_climate_biogenic: number | null;
  virgin_climate_dluc: number | null;
  recycled_climate_dluc: number | null;
  virgin_water: number | null;
  recycled_water: number | null;
  virgin_water_scarcity: number | null;
  recycled_water_scarcity: number | null;
  virgin_land: number | null;
  recycled_land: number | null;
  virgin_waste: number | null;
  recycled_waste: number | null;
  virgin_terrestrial_ecotoxicity: number | null;
  recycled_terrestrial_ecotoxicity: number | null;
  virgin_freshwater_eutrophication: number | null;
  recycled_freshwater_eutrophication: number | null;
  virgin_terrestrial_acidification: number | null;
  recycled_terrestrial_acidification: number | null;
  virgin_fossil_resource_scarcity: number | null;
  recycled_fossil_resource_scarcity: number | null;
  source: string;
  dataset: string;
  dataset_version: string;
  system_model: string;
  reference_year: number | null;
  notes: string | null;
  library_version: number;
  is_provisional: boolean;
}

/** Self-contained derivation record persisted to
 *  product_carbon_footprint_materials.factor_derivation and rendered
 *  verbatim in reports. */
export interface FactorDerivation {
  material_class: string;
  variant: string;
  region: string;
  recycled_content_pct: number;
  virgin_climate: number;
  recycled_climate: number;
  derived_ef_climate: number;
  dataset: string;
  dataset_version: string;
  system_model: string;
  library_version: number;
  endpoint_id: string;
  is_provisional: boolean;
  allocation_method: 'cut-off';
}

/** Interpolate one impact category; null endpoints mean "not characterised". */
function interpolate(virgin: number | null, recycled: number | null, r: number): number | null {
  if (virgin === null || virgin === undefined) return null;
  const rec = recycled === null || recycled === undefined ? virgin : recycled;
  return virgin - r * (virgin - rec);
}

function clampRecycledPct(pct: number | null | undefined): number {
  const n = Number(pct);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function buildFactorDerivation(
  endpoint: PackagingFactorEndpoint,
  recycledContentPct: number | null | undefined,
): FactorDerivation {
  const pct = clampRecycledPct(recycledContentPct);
  const r = pct / 100;
  return {
    material_class: endpoint.material_class,
    variant: endpoint.variant,
    region: endpoint.region,
    recycled_content_pct: pct,
    virgin_climate: endpoint.virgin_climate,
    recycled_climate: endpoint.recycled_climate,
    derived_ef_climate: endpoint.virgin_climate - r * (endpoint.virgin_climate - endpoint.recycled_climate),
    dataset: endpoint.dataset,
    dataset_version: endpoint.dataset_version,
    system_model: endpoint.system_model,
    library_version: endpoint.library_version,
    endpoint_id: endpoint.id,
    is_provisional: endpoint.is_provisional,
    allocation_method: 'cut-off',
  };
}

/**
 * Derive a full WaterfallResult from an endpoint at the item's recycled
 * content, scaled to quantityKg (matching resolveImpactFactors semantics,
 * which returns quantity-scaled absolute impacts).
 *
 * Pure and deterministic: same endpoint + inputs always produce the same
 * result. Throws on invalid input — a throw here is a curation or caller
 * bug, never a user-data condition.
 */
export function derivePackagingFactor(args: {
  endpoint: PackagingFactorEndpoint;
  recycledContentPct: number | null | undefined;
  quantityKg: number;
}): WaterfallResult {
  const { endpoint, quantityKg } = args;

  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new Error(
      `derivePackagingFactor: quantityKg must be a positive finite number (got ${quantityKg})`,
    );
  }
  // Defence in depth behind the DB CHECK constraint.
  if (endpoint.virgin_climate < endpoint.recycled_climate) {
    throw new Error(
      `derivePackagingFactor: endpoint ${endpoint.material_class}/${endpoint.variant} has virgin_climate < recycled_climate — library curation error`,
    );
  }

  const pct = clampRecycledPct(args.recycledContentPct);
  const r = pct / 100;

  const uncharacterised: string[] = [];
  const per = (name: string, virgin: number | null, recycled: number | null): number => {
    const v = interpolate(virgin, recycled, r);
    if (v === null) {
      uncharacterised.push(name);
      return 0;
    }
    return v;
  };

  const efClimate = per('climate', endpoint.virgin_climate, endpoint.recycled_climate);
  const efClimateFossil = per('climate fossil', endpoint.virgin_climate_fossil, endpoint.recycled_climate_fossil);
  const efClimateBiogenic = per('climate biogenic', endpoint.virgin_climate_biogenic, endpoint.recycled_climate_biogenic);
  const efClimateDluc = per('climate dLUC', endpoint.virgin_climate_dluc, endpoint.recycled_climate_dluc);
  const efWater = per('water', endpoint.virgin_water, endpoint.recycled_water);
  const efWaterScarcity = per('water scarcity', endpoint.virgin_water_scarcity, endpoint.recycled_water_scarcity);
  const efLand = per('land', endpoint.virgin_land, endpoint.recycled_land);
  const efWaste = per('waste', endpoint.virgin_waste, endpoint.recycled_waste);
  const efTerrestrialEcotoxicity = per('terrestrial ecotoxicity', endpoint.virgin_terrestrial_ecotoxicity, endpoint.recycled_terrestrial_ecotoxicity);
  const efFreshwaterEutrophication = per('freshwater eutrophication', endpoint.virgin_freshwater_eutrophication, endpoint.recycled_freshwater_eutrophication);
  const efTerrestrialAcidification = per('terrestrial acidification', endpoint.virgin_terrestrial_acidification, endpoint.recycled_terrestrial_acidification);
  const efFossilResourceScarcity = per('fossil resource scarcity', endpoint.virgin_fossil_resource_scarcity, endpoint.recycled_fossil_resource_scarcity);

  const methodologyParts = [
    `Parametric packaging factor: EF = virgin - r x (virgin - recycled) at r = ${pct}% recycled content (recycled-content cut-off convention, PAS 2050 / GHG Protocol Product Standard)`,
  ];
  if (uncharacterised.length > 0) {
    methodologyParts.push(`Not characterised in the endpoint library: ${uncharacterised.join(', ')}`);
  }

  return {
    impact_climate: efClimate * quantityKg,
    impact_climate_fossil: efClimateFossil * quantityKg,
    impact_climate_biogenic: efClimateBiogenic * quantityKg,
    impact_climate_dluc: efClimateDluc * quantityKg,
    impact_water: efWater * quantityKg,
    impact_water_scarcity: efWaterScarcity * quantityKg,
    impact_land: efLand * quantityKg,
    impact_waste: efWaste * quantityKg,

    // Endpoints are CO2e aggregates; no gas-level inventory is carried.
    ch4_kg: 0,
    ch4_fossil_kg: 0,
    ch4_biogenic_kg: 0,
    n2o_kg: 0,
    // The fossil/biogenic split IS characterised (dedicated endpoint columns).
    carbon_split_estimated: false,

    impact_ozone_depletion: 0,
    impact_photochemical_ozone_formation: 0,
    impact_ionising_radiation: 0,
    impact_particulate_matter: 0,
    impact_human_toxicity_carcinogenic: 0,
    impact_human_toxicity_non_carcinogenic: 0,
    impact_terrestrial_ecotoxicity: efTerrestrialEcotoxicity * quantityKg,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: efFreshwaterEutrophication * quantityKg,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: efTerrestrialAcidification * quantityKg,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: efFossilResourceScarcity * quantityKg,

    data_priority: 2,
    data_quality_tag: 'Regional_Standard',
    data_quality_grade: endpoint.is_provisional ? 'MEDIUM' : 'HIGH',
    source_reference:
      `${endpoint.dataset} ${endpoint.dataset_version} ${endpoint.system_model} - ` +
      `${endpoint.material_class}/${endpoint.variant} (${endpoint.region}), ` +
      `${pct}% recycled, library v${endpoint.library_version}`,
    confidence_score: endpoint.is_provisional ? 70 : 90,
    methodology: methodologyParts.join('. '),

    gwp_data_source: 'packaging_parametric',
    non_gwp_data_source: 'packaging_parametric',
    gwp_reference_id: endpoint.id,
    non_gwp_reference_id: endpoint.id,
    is_hybrid_source: false,

    geographic_scope: endpoint.region,
    data_collection_year: endpoint.reference_year ?? undefined,

    category_type: 'MANUFACTURING_MATERIAL',
    resolved_factor_id: endpoint.id,
  };
}

/**
 * Fetch the active (highest library_version) endpoint for each requested
 * (materialClass, variant, region), with deterministic region fallback:
 * exact region -> 'EU-27' -> 'GLO'.
 *
 * Returns a Map keyed by `${materialClass}|${variant}|${region}` (the
 * REQUESTED region, so callers can look up what they asked for even when a
 * fallback region satisfied it).
 */
export async function fetchActivePackagingEndpoints(
  supabase: SupabaseClient,
  wanted: Array<{ materialClass: string; variant: string; region: string }>,
): Promise<Map<string, PackagingFactorEndpoint>> {
  const result = new Map<string, PackagingFactorEndpoint>();
  if (wanted.length === 0) return result;

  const classes = Array.from(new Set(wanted.map((w) => w.materialClass)));
  const { data, error } = await supabase
    .from('packaging_factor_endpoints')
    .select('*')
    .in('material_class', classes)
    .order('library_version', { ascending: false });

  if (error) {
    throw new Error(`fetchActivePackagingEndpoints: ${error.message}`);
  }

  const rows = (data ?? []) as PackagingFactorEndpoint[];
  const byKey = new Map<string, PackagingFactorEndpoint>();
  for (const row of rows) {
    const key = `${row.material_class}|${row.variant}|${row.region}`;
    // Rows arrive ordered by library_version desc; first wins.
    if (!byKey.has(key)) byKey.set(key, row);
  }

  for (const w of wanted) {
    const candidates = [w.region, 'EU-27', 'GLO'];
    let found: PackagingFactorEndpoint | undefined;
    for (const region of candidates) {
      found = byKey.get(`${w.materialClass}|${w.variant}|${region}`);
      if (found) break;
    }
    if (found) {
      result.set(`${w.materialClass}|${w.variant}|${w.region}`, found);
    }
  }

  return result;
}

export function endpointLookupKey(materialClass: string, variant: string, region: string): string {
  return `${materialClass}|${variant}|${region}`;
}
