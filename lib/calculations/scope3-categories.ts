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
  // UK grid electricity factor for use phase
  electricity_kwh: { factor: 0.207, source: 'DEFRA 2024: UK Grid electricity' },

  // Refrigeration estimates per litre of beverage
  refrigeration_per_litre: {
    domestic_fridge: 0.0048, // kgCO2e per litre stored 1 week
    retail_display: 0.0092,  // kgCO2e per litre in retail chiller
    source: 'Estimated from typical refrigerator energy consumption',
  },

  // Carbonation CO2 release (for sparkling beverages)
  carbonation_release: {
    sparkling_wine: 0.0045, // kgCO2 per 750ml bottle
    beer: 0.0025,           // kgCO2 per 330ml can
    soft_drink: 0.0035,     // kgCO2 per 500ml bottle
    source: 'IPCC: Direct CO2 release from dissolved gas',
  },
};

// ============================================================================
// CATEGORY 4: UPSTREAM TRANSPORTATION & DISTRIBUTION
// ============================================================================

/**
 * Calculate Scope 3 Category 4: Upstream Transportation & Distribution
 *
 * This category includes:
 * - Transportation of purchased goods from tier 1 suppliers to the company
 * - Third-party distribution services (inbound logistics)
 * - Transportation between company facilities (if not Scope 1/2)
 *
 * Methods supported:
 * 1. Distance-based: tonnes × km × emission factor per tonne-km
 * 2. Spend-based: logistics spend × emission factor per £
 * 3. Supplier-specific: Primary data from suppliers
 *
 * @param supabase - Supabase client
 * @param organizationId - Organization UUID
 * @param yearStart - Start of reporting period (YYYY-MM-DD)
 * @param yearEnd - End of reporting period (YYYY-MM-DD)
 */
export async function calculateScope3Cat4(
  supabase: SupabaseClient,
  organizationId: string,
  yearStart: string,
  yearEnd: string
): Promise<{
  totalKgCO2e: number;
  breakdown: TransportEmission[];
  dataQuality: 'primary' | 'secondary' | 'spend_based';
  notes: string[];
}> {
  const emissions: TransportEmission[] = [];
  const notes: string[] = [];
  let dataQuality: 'primary' | 'secondary' | 'spend_based' = 'secondary';

  // Method 1: Fetch material transport data from product_lca_materials
  // Materials with transport distance and mode data
  const { data: materialsWithTransport, error: materialsError } = await supabase
    .from('product_lca_materials')
    .select(`
      id,
      material_name,
      quantity,
      unit,
      transport_mode,
      distance_km,
      product_lcas!inner(
        organization_id,
        status,
        created_at
      )
    `)
    .eq('product_lcas.organization_id', organizationId)
    .eq('product_lcas.status', 'completed')
    .not('transport_mode', 'is', null)
    .not('distance_km', 'is', null);

  if (materialsError) {
    console.error('[scope3-cat4] Error fetching materials transport:', materialsError);
    notes.push('Error fetching material transport data');
  }

  // Calculate emissions from material transport
  (materialsWithTransport || []).forEach((material: any) => {
    const mode = normalizeTransportMode(material.transport_mode);
    if (!mode) return;

    const distanceKm = Number(material.distance_km || 0);
    if (distanceKm <= 0) return;

    // Convert quantity to tonnes (assume kg if unit not specified)
    let weightTonnes = Number(material.quantity || 0) / 1000;
    if (material.unit?.toLowerCase() === 'tonnes' || material.unit?.toLowerCase() === 't') {
      weightTonnes = Number(material.quantity || 0);
    }

    const factorData = TRANSPORT_EMISSION_FACTORS[mode];
    const emissionsKgCO2e = weightTonnes * distanceKm * factorData.factor;

    emissions.push({
      mode,
      distanceKm,
      weightTonnes,
      emissionFactor: factorData.factor,
      emissionsKgCO2e,
      source: factorData.source,
    });

    dataQuality = 'primary';
  });

  // Method 2: Fallback to spend-based if no transport data
  if (emissions.length === 0) {
    const { data: overheadData } = await supabase
      .from('corporate_overheads')
      .select('computed_co2e, amount, material_type')
      .eq('organization_id', organizationId)
      .eq('category', 'upstream_logistics')
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd);

    if (overheadData && overheadData.length > 0) {
      overheadData.forEach((entry: any) => {
        emissions.push({
          mode: 'road_hgv', // Default assumption
          distanceKm: 0,
          weightTonnes: 0,
          emissionFactor: 0,
          emissionsKgCO2e: Number(entry.computed_co2e || 0),
          source: 'Spend-based estimate from corporate_overheads',
        });
      });
      dataQuality = 'spend_based';
      notes.push('Using spend-based estimation - consider adding transport distances for accuracy');
    }
  }

  const totalKgCO2e = emissions.reduce((sum, e) => sum + e.emissionsKgCO2e, 0);

  if (emissions.length === 0) {
    notes.push('No upstream transport data available. Add transport distances to materials or logistics spend data.');
  }

  return {
    totalKgCO2e,
    breakdown: emissions,
    dataQuality,
    notes,
  };
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

  // Method 1: Fetch distribution data from corporate_overheads
  const { data: distributionData } = await supabase
    .from('corporate_overheads')
    .select('computed_co2e, amount, material_type, notes')
    .eq('organization_id', organizationId)
    .eq('category', 'downstream_logistics')
    .gte('created_at', yearStart)
    .lte('created_at', yearEnd);

  if (distributionData && distributionData.length > 0) {
    distributionData.forEach((entry: any) => {
      emissions.push({
        mode: 'road_hgv',
        distanceKm: 0,
        weightTonnes: 0,
        emissionFactor: 0,
        emissionsKgCO2e: Number(entry.computed_co2e || 0),
        source: 'From corporate_overheads downstream_logistics',
      });
    });
    dataQuality = 'secondary';
  }

  // Method 2: Estimate based on production volume and average distribution distance
  if (emissions.length === 0) {
    // Get total production volume for the period
    const { data: productionData } = await supabase
      .from('production_logs')
      .select('units_produced, products(unit_size_value, unit_size_unit)')
      .eq('organization_id', organizationId)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    if (productionData && productionData.length > 0) {
      // Estimate total weight of products distributed
      let totalWeightTonnes = 0;
      productionData.forEach((log: any) => {
        const units = Number(log.units_produced || 0);
        const unitSizeL = log.products?.unit_size_unit === 'ml'
          ? Number(log.products.unit_size_value) / 1000
          : Number(log.products?.unit_size_value || 0.5);
        // Estimate weight: 1L of beverage ~= 1.1kg including packaging
        totalWeightTonnes += (units * unitSizeL * 1.1) / 1000;
      });

      if (totalWeightTonnes > 0) {
        // Industry average: ~300km average distribution distance (UK)
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

  productsData.forEach((product: any) => {
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
  cat4_upstream_transport: number;
  cat9_downstream_transport: number;
  cat11_use_phase: number;
  total: number;
  notes: string[];
}> {
  const [cat4, cat9, cat11] = await Promise.all([
    calculateScope3Cat4(supabase, organizationId, yearStart, yearEnd),
    calculateScope3Cat9(supabase, organizationId, yearStart, yearEnd),
    calculateScope3Cat11(supabase, organizationId, yearStart, yearEnd),
  ]);

  const total = cat4.totalKgCO2e + cat9.totalKgCO2e + cat11.totalKgCO2e;
  const notes = [
    ...cat4.notes.map(n => `[Cat 4] ${n}`),
    ...cat9.notes.map(n => `[Cat 9] ${n}`),
    ...cat11.notes.map(n => `[Cat 11] ${n}`),
  ];

  return {
    cat4_upstream_transport: cat4.totalKgCO2e,
    cat9_downstream_transport: cat9.totalKgCO2e,
    cat11_use_phase: cat11.totalKgCO2e,
    total,
    notes,
  };
}
