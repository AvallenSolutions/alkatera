/**
 * Scope 3 Category Calculations
 *
 * This module provides calculation functions for currently unimplemented
 * Scope 3 categories per the GHG Protocol Corporate Value Chain Standard.
 *
 * ## Implemented Categories (in corporate-emissions.ts)
 * - Cat 1: Purchased Goods & Services (via product LCAs)
 * - Cat 2: Capital Goods
 * - Cat 3: Fuel & Energy (WTT)
 * - Cat 5: Waste Generated in Operations
 * - Cat 6: Business Travel
 * - Cat 7: Employee Commuting
 *
 * ## Categories Implemented Here
 * - Cat 4: Upstream Transportation & Distribution
 * - Cat 9: Downstream Transportation & Distribution
 * - Cat 11: Use of Sold Products
 *
 * ## Standards Compliance
 * - GHG Protocol Scope 3 Technical Guidance
 * - ISO 14064-1:2018
 * - DEFRA 2024 Emission Factors
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { GRID_FACTORS_BY_COUNTRY } from '@/lib/grid-emission-factors';
import { isStageIncluded, boundaryFromDbEnum } from '@/lib/system-boundaries';

// ============================================================================
// TYPES
// ============================================================================

export interface TransportEmission {
  mode: TransportMode;
  distanceKm: number;
  weightTonnes: number;
  emissionFactor: number;
  emissionsKgCO2e: number;
  source: string;
}

export interface UsePhaseEmission {
  productId: string;
  productName: string;
  useCategory: UsePhaseCategory;
  energyKwh: number;
  emissionFactor: number;
  emissionsKgCO2e: number;
  assumptionsUsed: string[];
}

export type TransportMode =
  | 'road_hgv'           // Heavy goods vehicle
  | 'road_lgv'           // Light goods vehicle
  | 'road_van'           // Van/small truck
  | 'rail_freight'       // Rail freight
  | 'sea_container'      // Container ship
  | 'sea_bulk'           // Bulk carrier
  | 'air_freight'        // Air cargo
  | 'air_freight_long'   // Long-haul air
  | 'pipeline';          // Pipeline (for liquids/gas)

export type UsePhaseCategory =
  | 'refrigeration'      // Product requires refrigeration
  | 'heating'            // Product requires heating
  | 'processing'         // Consumer processing (e.g., brewing tea)
  | 'carbonation'        // For carbonated beverages (CO2 release)
  | 'none';              // No use-phase energy

// ============================================================================
// EMISSION FACTORS (DEFRA 2024)
// ============================================================================

/**
 * Transport emission factors in kgCO2e per tonne-km
 * Source: DEFRA 2024 UK Government GHG Conversion Factors
 */
export const TRANSPORT_EMISSION_FACTORS: Record<TransportMode, { factor: number; source: string }> = {
  // Road transport
  road_hgv: { factor: 0.10516, source: 'DEFRA 2024: HGV (all diesel) Average laden' },
  road_lgv: { factor: 0.26680, source: 'DEFRA 2024: LGV (3.5t-7.5t)' },
  road_van: { factor: 0.60517, source: 'DEFRA 2024: Van (up to 3.5t)' },

  // Rail transport
  rail_freight: { factor: 0.02768, source: 'DEFRA 2024: Rail freight' },

  // Sea transport
  sea_container: { factor: 0.01601, source: 'DEFRA 2024: Container ship' },
  sea_bulk: { factor: 0.00485, source: 'DEFRA 2024: Bulk carrier' },

  // Air transport
  air_freight: { factor: 0.98495, source: 'DEFRA 2024: Air freight (domestic/short-haul)' },
  air_freight_long: { factor: 0.59910, source: 'DEFRA 2024: Air freight (long-haul international)' },

  // Pipeline
  pipeline: { factor: 0.00200, source: 'DEFRA 2024: Liquids pipeline (estimated)' },
};

/**
 * Use phase emission factors
 * Based on typical energy consumption patterns
 */
export const USE_PHASE_EMISSION_FACTORS = {
  // Default grid electricity factor (UK) - use GRID_FACTORS_BY_COUNTRY for country-specific values
  electricity_kwh: { factor: GRID_FACTORS_BY_COUNTRY['GB'], source: 'DEFRA 2024: UK Grid electricity (default; use GRID_FACTORS_BY_COUNTRY for country-specific)' },

  // Refrigeration estimates per litre of beverage
  refrigeration_per_litre: {
    domestic_fridge: 0.0048, // kgCO2e per litre stored 1 week
    retail_display: 0.0092,  // kgCO2e per litre in retail chiller
    source: 'Estimated from typical refrigerator energy consumption',
  },

  // Carbonation CO2 release (for sparkling beverages)
  // NOTE: These values are also defined in lib/use-phase-factors.ts (CARBONATION_FACTORS).
  // Keep both in sync if updating. A future refactor should consolidate to a single source.
  carbonation_release: {
    sparkling_wine: 0.0045, // kgCO2 per 750ml bottle
    beer: 0.0025,           // kgCO2 per 330ml can
    soft_drink: 0.0035,     // kgCO2 per 500ml bottle
    source: 'IPCC: Direct CO2 release from dissolved gas',
  },
};

// ============================================================================
// CATEGORY 4: UPSTREAM TRANSPORTATION & DISTRIBUTION — accounted elsewhere
// ============================================================================
//
// There is deliberately NO calculateScope3Cat4 here. Category 4 is covered by:
//
//   1. Inbound (supplier → factory) transport is part of each product's
//      cradle-to-gate LCA: the aggregator adds per-material impact_transport
//      into the per-unit scope 3, which Cat 1 multiplies by units produced
//      (lib/calculations/corporate-emissions.ts). Computing Cat 4 from the
//      same LCA materials would double-count it.
//   2. Paid logistics spend is entered as corporate_overheads with category
//      'upstream_logistics' or 'upstream_transport', counted once by the
//      overhead loop in corporate-emissions.ts.
//
// The previous Method 1 here also summed PER-FUNCTIONAL-UNIT material
// quantities (kg per bottle) as if they were annual shipped tonnage — a
// dimensionally meaningless number — with no reporting-period filter.

/**
 * Latest completed PCF per product whose system boundary already includes the
 * given lifecycle stage. Cat 9 / Cat 11 estimators must skip these products:
 * their distribution / use-phase emissions are inside the per-unit LCA scope 3
 * that Cat 1 multiplies by units produced, so estimating them again here
 * double-counts.
 */
async function getProductIdsWithStageInLca(
  supabase: SupabaseClient,
  organizationId: string,
  stage: 'distribution' | 'use_phase',
): Promise<Set<string>> {
  const { data } = await supabase
    .from('product_carbon_footprints')
    .select('product_id, system_boundary, updated_at')
    .eq('organization_id', organizationId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: false });

  const latestBoundary = new Map<string, string>();
  for (const row of (data || []) as Array<{ product_id: unknown; system_boundary: string | null }>) {
    const pid = String(row.product_id);
    if (!latestBoundary.has(pid)) {
      latestBoundary.set(pid, row.system_boundary || 'cradle-to-gate');
    }
  }

  const included = new Set<string>();
  latestBoundary.forEach((boundary, productId) => {
    if (isStageIncluded(boundaryFromDbEnum(boundary), stage)) included.add(productId);
  });
  return included;
}

// ============================================================================
// CATEGORY 9: DOWNSTREAM TRANSPORTATION & DISTRIBUTION
// ============================================================================

/**
 * Calculate Scope 3 Category 9: Downstream Transportation & Distribution
 *
 * This category includes:
 * - Transportation of sold products from company to end customer
 * - Retail distribution (if not operated by reporting company)
 * - Storage in warehouses/distribution centers
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization UUID
 * @param yearStart - Start of reporting period
 * @param yearEnd - End of reporting period
 */
export async function calculateScope3Cat9(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<{
  totalKgCO2e: number;
  breakdown: TransportEmission[];
  dataQuality: 'primary' | 'secondary' | 'estimated';
  notes: string[];
}> {
  const emissions: TransportEmission[] = [];
  const notes: string[] = [];
  let dataQuality: 'primary' | 'secondary' | 'estimated' = 'estimated';

  // NOTE: corporate_overheads with category 'downstream_logistics' are
  // deliberately NOT read here — the overhead loop in corporate-emissions.ts
  // already counts them (breakdown.downstream_logistics). Reading them again
  // here double-counted every downstream-logistics entry in the total.

  // Estimate based on production volume and average distribution distance,
  // EXCLUDING products whose latest completed LCA already includes the
  // distribution stage (counted via Cat 1 per-unit scope 3).
  {
    const excludedProducts = await getProductIdsWithStageInLca(
      supabase, organizationId, 'distribution',
    );

    const { data: productionData } = await supabase
      .from('production_logs')
      .select('product_id, units_produced, products(unit_size_value, unit_size_unit)')
      .eq('organization_id', organizationId)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    if (productionData && productionData.length > 0) {
      // Estimate total weight of products distributed
      let totalWeightTonnes = 0;
      let excludedCount = 0;
      productionData.forEach((log: any) => {
        if (excludedProducts.has(String(log.product_id))) {
          excludedCount += 1;
          return;
        }
        const units = Number(log.units_produced || 0);
        const unitSizeL = log.products?.unit_size_unit === 'ml'
          ? Number(log.products.unit_size_value) / 1000
          : Number(log.products?.unit_size_value || 0.5);
        // Estimate weight: 1L of beverage ~= 1.1kg including packaging
        totalWeightTonnes += (units * unitSizeL * 1.1) / 1000;
      });

      if (excludedCount > 0) {
        notes.push(
          `${excludedCount} production log(s) excluded: their products' LCAs already ` +
          `include distribution (counted in Category 1).`
        );
      }

      if (totalWeightTonnes > 0) {
        // UK-centric assumption: 300km average distribution distance.
        // Source: DfT Domestic Road Freight Statistics (2023), Table RFS0104 —
        // average laden trip length for food/drink HGVs is 124km one-way (~250km
        // round trip). 300km used as conservative estimate including warehouse hops.
        // For non-UK operations, this should be overridden with actual logistics data.
        const avgDistanceKm = 300;
        const mode: TransportMode = 'road_hgv';
        const factorData = TRANSPORT_EMISSION_FACTORS[mode];
        const emissionsKgCO2e = totalWeightTonnes * avgDistanceKm * factorData.factor;

        emissions.push({
          mode,
          distanceKm: avgDistanceKm,
          weightTonnes: totalWeightTonnes,
          emissionFactor: factorData.factor,
          emissionsKgCO2e,
          source: `${factorData.source} - Estimated using industry average distance`,
        });

        dataQuality = 'estimated';
        notes.push(
          `Estimated based on ${totalWeightTonnes.toFixed(1)} tonnes distributed over average ${avgDistanceKm}km. ` +
          `Add actual distribution data for accuracy.`
        );
      }
    }
  }

  const totalKgCO2e = emissions.reduce((sum, e) => sum + e.emissionsKgCO2e, 0);

  if (emissions.length === 0) {
    notes.push('No downstream distribution data available. Add logistics data or production volumes.');
  }

  return {
    totalKgCO2e,
    breakdown: emissions,
    dataQuality,
    notes,
  };
}

// ============================================================================
// CATEGORY 11: USE OF SOLD PRODUCTS
// ============================================================================

/**
 * Calculate Scope 3 Category 11: Use of Sold Products
 *
 * For beverages, this primarily includes:
 * - Refrigeration energy (consumer or retail)
 * - CO2 release from carbonated beverages
 *
 * Note: This is highly product and region-dependent.
 * The calculation uses industry averages where specific data is unavailable.
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization UUID
 * @param yearStart - Start of reporting period
 * @param yearEnd - End of reporting period
 */
export async function calculateScope3Cat11(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<{
  totalKgCO2e: number;
  breakdown: UsePhaseEmission[];
  assumptions: string[];
  notes: string[];
}> {
  const emissions: UsePhaseEmission[] = [];
  const assumptions: string[] = [];
  const notes: string[] = [];

  // Products whose latest completed LCA already includes the use phase have
  // refrigeration/carbonation inside the per-unit scope 3 that Cat 1
  // multiplies by units produced — estimating them again here double-counts.
  const excludedProducts = await getProductIdsWithStageInLca(
    supabase, organizationId, 'use_phase',
  );

  // Fetch products with production volumes
  const { data: productsData } = await supabase
    .from('products')
    .select(`
      id,
      name,
      product_category,
      unit_size_value,
      unit_size_unit,
      functional_unit,
      production_logs(
        units_produced,
        date
      )
    `)
    .eq('organization_id', organizationId);

  if (!productsData || productsData.length === 0) {
    notes.push('No products found for use phase calculation.');
    return { totalKgCO2e: 0, breakdown: [], assumptions, notes };
  }

  // Define which product categories require refrigeration or carbonation
  const refrigeratedCategories = ['beer', 'cider', 'wine', 'sparkling', 'dairy', 'juice'];
  const carbonatedCategories = ['beer', 'cider', 'sparkling', 'soft_drink', 'soda'];

  let excludedCount = 0;
  productsData.forEach((product: any) => {
    if (excludedProducts.has(String(product.id))) {
      excludedCount += 1;
      return;
    }
    // Sum production within period
    const productionLogs = (product.production_logs || []).filter((log: any) =>
      log.date >= yearStart && log.date <= yearEnd
    );
    const totalUnits = productionLogs.reduce(
      (sum: number, log: any) => sum + Number(log.units_produced || 0),
      0
    );

    if (totalUnits <= 0) return;

    const category = (product.product_category || '').toLowerCase();
    const unitSizeL = product.unit_size_unit === 'ml'
      ? Number(product.unit_size_value) / 1000
      : Number(product.unit_size_value || 0.5);
    const totalLitres = totalUnits * unitSizeL;

    let usePhaseEmissions = 0;
    const productAssumptions: string[] = [];

    // Refrigeration emissions (if applicable)
    if (refrigeratedCategories.some(c => category.includes(c))) {
      // Assume retail refrigeration for 50% of products, domestic for 50%
      const retailRefrigEmissions = totalLitres * 0.5 * USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.retail_display;
      const domesticRefrigEmissions = totalLitres * 0.5 * USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.domestic_fridge;
      usePhaseEmissions += retailRefrigEmissions + domesticRefrigEmissions;
      productAssumptions.push('50% retail + 50% domestic refrigeration, 1 week storage');
    }

    // Carbonation CO2 release (if applicable)
    if (carbonatedCategories.some(c => category.includes(c))) {
      let carbonationPerUnit = 0;
      if (category.includes('beer')) {
        carbonationPerUnit = USE_PHASE_EMISSION_FACTORS.carbonation_release.beer * (unitSizeL / 0.33);
      } else if (category.includes('sparkling')) {
        carbonationPerUnit = USE_PHASE_EMISSION_FACTORS.carbonation_release.sparkling_wine * (unitSizeL / 0.75);
      } else {
        carbonationPerUnit = USE_PHASE_EMISSION_FACTORS.carbonation_release.soft_drink * (unitSizeL / 0.5);
      }
      usePhaseEmissions += totalUnits * carbonationPerUnit;
      productAssumptions.push('CO2 release from carbonation');
    }

    if (usePhaseEmissions > 0) {
      emissions.push({
        productId: String(product.id),
        productName: product.name,
        useCategory: refrigeratedCategories.some(c => category.includes(c)) ? 'refrigeration' : 'carbonation',
        energyKwh: 0, // Embedded in factors
        emissionFactor: 0, // Multiple factors used
        emissionsKgCO2e: usePhaseEmissions,
        assumptionsUsed: productAssumptions,
      });
    }
  });

  const totalKgCO2e = emissions.reduce((sum, e) => sum + e.emissionsKgCO2e, 0);

  if (excludedCount > 0) {
    notes.push(
      `${excludedCount} product(s) excluded: their LCAs already include the use phase ` +
      `(counted in Category 1).`
    );
  }

  if (emissions.length === 0) {
    notes.push('No use-phase emissions calculated. Products may not require refrigeration or be carbonated.');
  } else {
    assumptions.push(USE_PHASE_EMISSION_FACTORS.refrigeration_per_litre.source);
    assumptions.push(USE_PHASE_EMISSION_FACTORS.carbonation_release.source);
    notes.push(
      `Use phase calculated for ${emissions.length} products. ` +
      `Consider providing specific refrigeration and use data for accuracy.`
    );
  }

  return {
    totalKgCO2e,
    breakdown: emissions,
    assumptions,
    notes,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize transport mode string to enum
 */
function normalizeTransportMode(mode: string | null | undefined): TransportMode | null {
  if (!mode) return null;

  const normalized = mode.toLowerCase().replace(/[\s-_]+/g, '_');

  const modeMap: Record<string, TransportMode> = {
    truck: 'road_hgv',
    lorry: 'road_hgv',
    hgv: 'road_hgv',
    road: 'road_hgv',
    van: 'road_van',
    lgv: 'road_lgv',
    rail: 'rail_freight',
    train: 'rail_freight',
    sea: 'sea_container',
    ship: 'sea_container',
    container: 'sea_container',
    bulk: 'sea_bulk',
    air: 'air_freight',
    plane: 'air_freight',
    flight: 'air_freight',
    pipeline: 'pipeline',
    pipe: 'pipeline',
  };

  return modeMap[normalized] || null;
}

/**
 * Get summary of all calculated Scope 3 categories
 */
export async function getScope3Summary(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<{
  cat9_downstream_transport: number;
  cat11_use_phase: number;
  total: number;
  notes: string[];
}> {
  // Cat 4 is not summarised here: inbound transport is inside Cat 1 (per-unit
  // LCA scope 3) and paid logistics overheads are counted by the overhead
  // loop in corporate-emissions.ts. See the Category 4 banner above.
  const [cat9, cat11] = await Promise.all([
    calculateScope3Cat9(supabase, organizationId, yearStart, yearEnd),
    calculateScope3Cat11(supabase, organizationId, yearStart, yearEnd),
  ]);

  const total = cat9.totalKgCO2e + cat11.totalKgCO2e;
  const notes = [
    ...cat9.notes.map((n: string) => `[Cat 9] ${n}`),
    ...cat11.notes.map((n: string) => `[Cat 11] ${n}`),
  ];

  return {
    cat9_downstream_transport: cat9.totalKgCO2e,
    cat11_use_phase: cat11.totalKgCO2e,
    total,
    notes,
  };
}
