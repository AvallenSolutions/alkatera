import { getSupabaseBrowserClient } from './supabase/browser-client';
import { DEFAULT_AWARE_FACTOR, getAwareFactorValue } from './calculations/water-risk';
// OpenLCA calculations now happen server-side via /api/openlca/calculate

export type MaterialCategoryType =
  | 'SCOPE_1_2_ENERGY'
  | 'SCOPE_3_TRANSPORT'
  | 'SCOPE_3_COMMUTING'
  | 'MANUFACTURING_MATERIAL'
  | 'WASTE';

export interface ProductMaterial {
  id: string;
  product_id: string;
  material_name: string;
  material_type: 'ingredient' | 'packaging';
  quantity: string | number;
  unit: string;
  data_source?: string;
  data_source_id?: string; // OpenLCA process UUID when data_source='openlca'
  supplier_product_id?: string;
  packaging_category?: string;
  origin_country?: string;
  is_organic_certified?: boolean;
  category_type?: MaterialCategoryType;
}

export interface WaterfallResult {
  // Core 4 impacts (existing)
  impact_climate: number;
  impact_climate_fossil: number;
  impact_climate_biogenic: number;
  impact_climate_dluc: number;
  impact_water: number;
  impact_water_scarcity: number;
  impact_land: number;
  impact_waste: number;

  // GHG Gas Breakdown (ISO 14067 / IPCC AR6)
  ch4_kg?: number;           // Total methane (kg CH4)
  ch4_fossil_kg?: number;    // Fossil methane (kg CH4) - GWP 29.8
  ch4_biogenic_kg?: number;  // Biogenic methane (kg CH4) - GWP 27.2
  n2o_kg?: number;           // Nitrous oxide (kg N2O) - GWP 273

  // Extended ReCiPe 2016 impacts (complete 18 categories)
  impact_ozone_depletion: number;
  impact_photochemical_ozone_formation: number;
  impact_ionising_radiation: number;
  impact_particulate_matter: number;
  impact_human_toxicity_carcinogenic: number;
  impact_human_toxicity_non_carcinogenic: number;
  impact_terrestrial_ecotoxicity: number;
  impact_freshwater_ecotoxicity: number;
  impact_marine_ecotoxicity: number;
  impact_freshwater_eutrophication: number;
  impact_marine_eutrophication: number;
  impact_terrestrial_acidification: number;
  impact_mineral_resource_scarcity: number;
  impact_fossil_resource_scarcity: number;

  // Provenance tracking
  data_priority: 1 | 2 | 3;
  data_quality_tag: 'Primary_Verified' | 'Regional_Standard' | 'Secondary_Modelled' | 'Secondary_Estimated';
  data_quality_grade: 'HIGH' | 'MEDIUM' | 'LOW';
  source_reference: string;
  confidence_score: number;
  methodology: string;

  // Split source tracking for hybrid approach
  gwp_data_source: string;
  non_gwp_data_source: string;
  gwp_reference_id?: string;
  non_gwp_reference_id?: string;
  is_hybrid_source: boolean;

  // Optional IDs
  supplier_lca_id?: string;
  category_type: MaterialCategoryType;
}

/**
 * Type for supplier product impact data (from supplier_products or platform_supplier_products tables)
 */
interface SupplierProductImpacts {
  id: string;
  product_name: string;
  impact_climate?: number | null;
  impact_water?: number | null;
  impact_waste?: number | null;
  impact_land?: number | null;
  ghg_fossil?: number | null;
  ghg_biogenic?: number | null;
  ghg_land_use_change?: number | null;
  water_blue?: number | null;
  water_green?: number | null;
  water_grey?: number | null;
  water_scarcity_factor?: number | null;
  terrestrial_ecotoxicity?: number | null;
  freshwater_eutrophication?: number | null;
  terrestrial_acidification?: number | null;
  data_quality_score?: number | null;
  data_confidence_pct?: number | null;
  data_source_type?: string | null;
  methodology_standard?: string | null;
  functional_unit?: string | null;
  system_boundary?: string | null;
  is_externally_verified?: boolean | null;
  verifier_name?: string | null;
}

/**
 * Checks if a supplier product has any impact data available
 */
function hasSupplierProductImpactData(product: SupplierProductImpacts | null): boolean {
  if (!product) return false;
  return !!(
    product.impact_climate ||
    product.impact_water ||
    product.impact_waste ||
    product.impact_land
  );
}

/**
 * Builds a WaterfallResult from supplier product impact data
 */
function buildSupplierProductResult(
  product: SupplierProductImpacts,
  quantity_kg: number,
  awareFactor: number,
  category: MaterialCategoryType,
  isPlatformProduct: boolean = false
): WaterfallResult {
  // Calculate water scarcity - use product's scarcity factor if available, else use AWARE factor
  const waterScarcityFactor = product.water_scarcity_factor ?? awareFactor;

  // Calculate GHG breakdown - use product-specific values or estimate from total
  const climateTotal = Number(product.impact_climate || 0);
  const ghgFossil = product.ghg_fossil !== null && product.ghg_fossil !== undefined
    ? Number(product.ghg_fossil)
    : climateTotal * 0.85;
  const ghgBiogenic = product.ghg_biogenic !== null && product.ghg_biogenic !== undefined
    ? Number(product.ghg_biogenic)
    : climateTotal * 0.15;
  const ghgDluc = Number(product.ghg_land_use_change || 0);

  // Calculate water breakdown - use product-specific values or use total
  const waterTotal = Number(product.impact_water || 0);
  const waterBlue = Number(product.water_blue || waterTotal);

  // Map data quality score (1-5) to confidence percentage
  const dataQuality = product.data_quality_score ?? 3;
  const confidenceFromQuality = [0, 50, 65, 75, 85, 95][dataQuality] || 75;
  const confidenceScore = product.data_confidence_pct ?? confidenceFromQuality;

  // Determine data quality tag based on source type and verification
  let dataQualityTag: 'Primary_Verified' | 'Regional_Standard' | 'Secondary_Modelled' = 'Secondary_Modelled';
  let dataQualityGrade: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

  if (product.data_source_type === 'primary_verified' || product.is_externally_verified) {
    dataQualityTag = 'Primary_Verified';
    dataQualityGrade = 'HIGH';
  } else if (product.data_source_type === 'hybrid_proxy') {
    dataQualityTag = 'Regional_Standard';
    dataQualityGrade = 'MEDIUM';
  }

  const sourceType = isPlatformProduct ? 'Platform Supplier' : 'Supplier';
  const methodology = product.methodology_standard || 'ISO 14067';
  const verifierInfo = product.is_externally_verified && product.verifier_name
    ? ` (Verified by ${product.verifier_name})`
    : '';

  return {
    impact_climate: climateTotal * quantity_kg,
    impact_climate_fossil: ghgFossil * quantity_kg,
    impact_climate_biogenic: ghgBiogenic * quantity_kg,
    impact_climate_dluc: ghgDluc * quantity_kg,
    impact_water: waterTotal * quantity_kg,
    impact_water_scarcity: waterBlue * quantity_kg * waterScarcityFactor,
    impact_land: Number(product.impact_land || 0) * quantity_kg,
    impact_waste: Number(product.impact_waste || 0) * quantity_kg,
    // Extended impacts - use product values if available
    impact_ozone_depletion: 0,
    impact_photochemical_ozone_formation: 0,
    impact_ionising_radiation: 0,
    impact_particulate_matter: 0,
    impact_human_toxicity_carcinogenic: 0,
    impact_human_toxicity_non_carcinogenic: 0,
    impact_terrestrial_ecotoxicity: Number(product.terrestrial_ecotoxicity || 0) * quantity_kg,
    impact_freshwater_ecotoxicity: 0,
    impact_marine_ecotoxicity: 0,
    impact_freshwater_eutrophication: Number(product.freshwater_eutrophication || 0) * quantity_kg,
    impact_marine_eutrophication: 0,
    impact_terrestrial_acidification: Number(product.terrestrial_acidification || 0) * quantity_kg,
    impact_mineral_resource_scarcity: 0,
    impact_fossil_resource_scarcity: 0,
    // Provenance tracking
    data_priority: 1,
    data_quality_tag: dataQualityTag,
    data_quality_grade: dataQualityGrade,
    source_reference: `${sourceType} Product: ${product.product_name}${verifierInfo}`,
    confidence_score: confidenceScore,
    methodology: methodology,
    gwp_data_source: `${sourceType} Product`,
    non_gwp_data_source: `${sourceType} Product`,
    gwp_reference_id: product.id,
    non_gwp_reference_id: product.id,
    is_hybrid_source: false,
    supplier_lca_id: product.id,
    category_type: category,
  };
}

export function normalizeToKg(quantity: string | number, unit: string): number {
  let qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
  const unitLower = unit?.toLowerCase() || 'kg';

  if (unitLower === 'g' || unitLower === 'grams') {
    return qty / 1000;
  } else if (unitLower === 'ml' || unitLower === 'millilitres' || unitLower === 'milliliters') {
    return qty / 1000;
  } else if (unitLower === 'l' || unitLower === 'litres' || unitLower === 'liters') {
    return qty;
  }

  return qty;
}

/**
 * Detects the category type of a material based on its name and properties.
 * This determines which data resolution path to use (hybrid vs full dataset).
 */
function detectMaterialCategory(material: ProductMaterial): MaterialCategoryType {
  // If category explicitly set, use it
  if (material.category_type) {
    return material.category_type;
  }

  const nameLower = material.material_name.toLowerCase();

  // Scope 1 & 2 Energy (electricity, gas, fuels)
  if (
    nameLower.includes('electricity') ||
    nameLower.includes('natural gas') ||
    nameLower.includes('diesel') ||
    nameLower.includes('coal') ||
    nameLower.includes('fuel') ||
    nameLower.includes('heating')
  ) {
    return 'SCOPE_1_2_ENERGY';
  }

  // Scope 3 Transport (freight, logistics)
  if (
    nameLower.includes('transport') ||
    nameLower.includes('hgv') ||
    nameLower.includes('lorry') ||
    nameLower.includes('truck') ||
    nameLower.includes('freight') ||
    nameLower.includes('shipping') ||
    nameLower.includes('rail freight') ||
    nameLower.includes('air freight')
  ) {
    return 'SCOPE_3_TRANSPORT';
  }

  // Scope 3 Commuting (employee travel)
  if (
    nameLower.includes('commut') ||
    nameLower.includes('passenger car') ||
    nameLower.includes('bus') ||
    nameLower.includes('rail passenger') ||
    nameLower.includes('air travel') ||
    nameLower.includes('underground') ||
    nameLower.includes('metro')
  ) {
    return 'SCOPE_3_COMMUTING';
  }

  // Waste
  if (nameLower.includes('waste') || nameLower.includes('disposal')) {
    return 'WASTE';
  }

  // Default: Manufacturing material (ingredients, packaging)
  return 'MANUFACTURING_MATERIAL';
}

/**
 * Main impact waterfall resolver with category-aware hybrid data approach.
 * Implements ISO 14044/14067 compliant data resolution prioritizing:
 * 1. Supplier verified data (all sources)
 * 2. DEFRA GWP + Ecoinvent non-GWP hybrid (for energy/transport/commuting)
 * 2.5. OpenLCA live calculation (for materials linked to ecoInvent processes)
 * 3. Full Ecoinvent/staging factors (for manufacturing materials)
 *
 * @param material - The product material to resolve impacts for
 * @param quantity_kg - Quantity in kilograms
 * @param organizationId - Optional organization ID for OpenLCA config lookup
 */
export async function resolveImpactFactors(
  material: ProductMaterial,
  quantity_kg: number,
  organizationId?: string
): Promise<WaterfallResult> {
  const supabase = getSupabaseBrowserClient();
  const category = detectMaterialCategory(material);

  // Get location-specific AWARE factor for water scarcity weighting
  // Uses AWARE methodology (Available Water Remaining) v1.3
  const awareFactor = await getAwareFactorValue(supabase, material.origin_country);

  console.log(
    `[Waterfall] Resolving ${material.material_name} | Category: ${category} | Quantity: ${quantity_kg} kg | AWARE: ${awareFactor}`
  );

  // ===========================================================
  // PRIORITY 1: SUPPLIER VERIFIED DATA (All Categories)
  // Checks in order: supplier_products -> platform_supplier_products -> product_lcas
  // ===========================================================
  if (material.data_source === 'supplier' && material.supplier_product_id) {
    console.log(`[Waterfall] Checking Priority 1 (Supplier) for: ${material.material_name}`);

    try {
      // Priority 1a: Check supplier_products table (organization-specific suppliers)
      const { data: supplierProduct } = await supabase
        .from('supplier_products')
        .select('*')
        .eq('id', material.supplier_product_id)
        .maybeSingle();

      if (supplierProduct && hasSupplierProductImpactData(supplierProduct)) {
        console.log(`[Waterfall] ✓ Priority 1a SUCCESS: Using supplier product ${supplierProduct.id}`);
        return buildSupplierProductResult(supplierProduct, quantity_kg, awareFactor, category);
      }

      // Priority 1b: Check platform_supplier_products table (platform-wide shared suppliers)
      const { data: platformProduct } = await supabase
        .from('platform_supplier_products')
        .select('*')
        .eq('id', material.supplier_product_id)
        .maybeSingle();

      if (platformProduct && hasSupplierProductImpactData(platformProduct)) {
        console.log(`[Waterfall] ✓ Priority 1b SUCCESS: Using platform supplier product ${platformProduct.id}`);
        return buildSupplierProductResult(platformProduct, quantity_kg, awareFactor, category, true);
      }

      // Priority 1c: Fallback to product LCA (existing approach)
      const { data: productRecord } = await supabase
        .from('products')
        .select('id, organization_id')
        .eq('id', material.supplier_product_id)
        .maybeSingle();

      if (productRecord) {
        const { data: supplierLca } = await supabase
          .from('product_carbon_footprints')
          .select('id, aggregated_impacts')
          .eq('product_id', productRecord.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (supplierLca?.aggregated_impacts) {
          const impacts = supplierLca.aggregated_impacts;
          console.log(`[Waterfall] ✓ Priority 1c SUCCESS: Using supplier LCA ${supplierLca.id}`);

          return {
            impact_climate: (impacts.climate_change_gwp100 || 0) * quantity_kg,
            impact_climate_fossil: (impacts.climate_fossil || impacts.climate_change_gwp100 * 0.85 || 0) * quantity_kg,
            impact_climate_biogenic: (impacts.climate_biogenic || impacts.climate_change_gwp100 * 0.15 || 0) * quantity_kg,
            impact_climate_dluc: (impacts.climate_dluc || 0) * quantity_kg,
            impact_water: (impacts.water_consumption || 0) * quantity_kg,
            impact_water_scarcity: (impacts.water_scarcity_aware || impacts.water_consumption * awareFactor || 0) * quantity_kg,
            impact_land: (impacts.land_use || 0) * quantity_kg,
            impact_waste: (impacts.waste || 0) * quantity_kg,
            impact_ozone_depletion: (impacts.ozone_depletion || 0) * quantity_kg,
            impact_photochemical_ozone_formation: (impacts.photochemical_ozone_formation || 0) * quantity_kg,
            impact_ionising_radiation: (impacts.ionising_radiation || 0) * quantity_kg,
            impact_particulate_matter: (impacts.particulate_matter || 0) * quantity_kg,
            impact_human_toxicity_carcinogenic: (impacts.human_toxicity_carcinogenic || 0) * quantity_kg,
            impact_human_toxicity_non_carcinogenic: (impacts.human_toxicity_non_carcinogenic || 0) * quantity_kg,
            impact_terrestrial_ecotoxicity: (impacts.terrestrial_ecotoxicity || 0) * quantity_kg,
            impact_freshwater_ecotoxicity: (impacts.freshwater_ecotoxicity || 0) * quantity_kg,
            impact_marine_ecotoxicity: (impacts.marine_ecotoxicity || 0) * quantity_kg,
            impact_freshwater_eutrophication: (impacts.freshwater_eutrophication || 0) * quantity_kg,
            impact_marine_eutrophication: (impacts.marine_eutrophication || 0) * quantity_kg,
            impact_terrestrial_acidification: (impacts.terrestrial_acidification || 0) * quantity_kg,
            impact_mineral_resource_scarcity: (impacts.mineral_resource_scarcity || 0) * quantity_kg,
            impact_fossil_resource_scarcity: (impacts.fossil_resource_scarcity || 0) * quantity_kg,
            data_priority: 1,
            data_quality_tag: 'Primary_Verified',
            data_quality_grade: 'HIGH',
            source_reference: `Supplier Product LCA ${supplierLca.id}`,
            confidence_score: 95,
            methodology: 'ISO 14067 / Supplier EPD',
            gwp_data_source: 'Supplier EPD',
            non_gwp_data_source: 'Supplier EPD',
            gwp_reference_id: supplierLca.id,
            non_gwp_reference_id: supplierLca.id,
            is_hybrid_source: false,
            supplier_lca_id: supplierLca.id,
            category_type: category,
          };
        }
      }
    } catch (error) {
      console.warn(`[Waterfall] Priority 1 failed for ${material.material_name}:`, error);
    }
  }

  // ===========================================================
  // CATEGORY-SPECIFIC RESOLUTION PATHS
  // ===========================================================

  // Priority 2: DEFRA GWP + Ecoinvent non-GWP Hybrid
  // (For energy, transport, commuting only)
  if (
    category === 'SCOPE_1_2_ENERGY' ||
    category === 'SCOPE_3_TRANSPORT' ||
    category === 'SCOPE_3_COMMUTING'
  ) {
    console.log(`[Waterfall] Attempting Priority 2 (DEFRA+Ecoinvent Hybrid) for: ${material.material_name}`);

    // Try to find DEFRA mapping
    const { data: defraMapping } = await supabase
      .from('defra_ecoinvent_impact_mappings')
      .select('*, ecoinvent_proxy_id')
      .ilike('defra_factor_name', `%${material.material_name}%`)
      .limit(1)
      .maybeSingle();

    if (defraMapping) {
      // Get DEFRA GWP from staging_emission_factors
      const { data: defraFactor } = await supabase
        .from('staging_emission_factors')
        .select('*')
        .ilike('name', defraMapping.defra_factor_name)
        .maybeSingle();

      // Get Ecoinvent non-GWP impacts
      const { data: ecoinventProxy } = await supabase
        .from('ecoinvent_material_proxies')
        .select('*')
        .eq('material_category', defraMapping.ecoinvent_proxy_category)
        .maybeSingle();

      if (defraFactor && ecoinventProxy) {
        console.log(
          `[Waterfall] ✓ Priority 2 SUCCESS: Hybrid (DEFRA GWP + Ecoinvent non-GWP) for ${material.material_name}`
        );

        const gwpTotal = Number(defraFactor.co2_factor || 0) * quantity_kg;

        // Use actual GHG breakdown from Ecoinvent if available, else estimate
        const fossilRatio = ecoinventProxy.impact_climate_fossil && ecoinventProxy.impact_climate
          ? ecoinventProxy.impact_climate_fossil / ecoinventProxy.impact_climate
          : 0.85;
        const biogenicRatio = ecoinventProxy.impact_climate_biogenic && ecoinventProxy.impact_climate
          ? ecoinventProxy.impact_climate_biogenic / ecoinventProxy.impact_climate
          : 0.15;

        return {
          // GWP from DEFRA, split using Ecoinvent ratios
          impact_climate: gwpTotal,
          impact_climate_fossil: gwpTotal * fossilRatio,
          impact_climate_biogenic: gwpTotal * biogenicRatio,
          impact_climate_dluc: Number(ecoinventProxy.impact_climate_dluc || 0) * quantity_kg,
          // GHG gas breakdown from Ecoinvent
          ch4_kg: Number(ecoinventProxy.ch4_factor || 0) * quantity_kg,
          ch4_fossil_kg: Number(ecoinventProxy.ch4_fossil_factor || 0) * quantity_kg,
          ch4_biogenic_kg: Number(ecoinventProxy.ch4_biogenic_factor || 0) * quantity_kg,
          n2o_kg: Number(ecoinventProxy.n2o_factor || 0) * quantity_kg,

          // All other impacts from Ecoinvent
          impact_water: Number(ecoinventProxy.impact_water || 0) * quantity_kg,
          impact_water_scarcity: Number(ecoinventProxy.impact_water || 0) * quantity_kg * awareFactor,
          impact_land: Number(ecoinventProxy.impact_land_use || ecoinventProxy.impact_land || 0) * quantity_kg,
          impact_waste: Number(ecoinventProxy.impact_waste || 0) * quantity_kg,
          impact_ozone_depletion: Number(ecoinventProxy.impact_ozone_depletion || 0) * quantity_kg,
          impact_photochemical_ozone_formation: Number(ecoinventProxy.impact_photochemical_ozone_formation || 0) * quantity_kg,
          impact_ionising_radiation: Number(ecoinventProxy.impact_ionising_radiation || 0) * quantity_kg,
          impact_particulate_matter: Number(ecoinventProxy.impact_particulate_matter || 0) * quantity_kg,
          impact_human_toxicity_carcinogenic: Number(ecoinventProxy.impact_human_toxicity_carcinogenic || 0) * quantity_kg,
          impact_human_toxicity_non_carcinogenic: Number(ecoinventProxy.impact_human_toxicity_non_carcinogenic || 0) * quantity_kg,
          impact_terrestrial_ecotoxicity: Number(ecoinventProxy.impact_terrestrial_ecotoxicity || 0) * quantity_kg,
          impact_freshwater_ecotoxicity: Number(ecoinventProxy.impact_freshwater_ecotoxicity || 0) * quantity_kg,
          impact_marine_ecotoxicity: Number(ecoinventProxy.impact_marine_ecotoxicity || 0) * quantity_kg,
          impact_freshwater_eutrophication: Number(ecoinventProxy.impact_freshwater_eutrophication || 0) * quantity_kg,
          impact_marine_eutrophication: Number(ecoinventProxy.impact_marine_eutrophication || 0) * quantity_kg,
          impact_terrestrial_acidification: Number(ecoinventProxy.impact_terrestrial_acidification || 0) * quantity_kg,
          impact_mineral_resource_scarcity: Number(ecoinventProxy.impact_mineral_resource_scarcity || 0) * quantity_kg,
          impact_fossil_resource_scarcity: Number(ecoinventProxy.impact_fossil_fuel_scarcity || 0) * quantity_kg,

          // Provenance tracking
          data_priority: 2,
          data_quality_tag: 'Regional_Standard',
          data_quality_grade: 'MEDIUM',
          source_reference: `Hybrid: DEFRA 2025 (GWP) + Ecoinvent 3.12 (Environmental)`,
          confidence_score: 80,
          methodology: 'DEFRA 2025 / ReCiPe 2016 Midpoint (H) / Ecoinvent 3.12',
          gwp_data_source: 'DEFRA 2025',
          non_gwp_data_source: 'Ecoinvent 3.12',
          gwp_reference_id: defraFactor.id?.toString(),
          non_gwp_reference_id: ecoinventProxy.id,
          is_hybrid_source: true,
          category_type: category,
        };
      }
    }

    // Fallback to full Ecoinvent for energy/transport if no DEFRA mapping
    console.log(`[Waterfall] No DEFRA mapping found, falling back to full Ecoinvent for ${material.material_name}`);
  }

  // ===========================================================
  // PRIORITY 2.5: OPENLCA LIVE CALCULATION
  // (For materials linked to ecoInvent processes via OpenLCA)
  // Higher priority than staging - uses real ecoInvent 3.12 data
  // Calls server-side API to access OpenLCA IPC server
  // ===========================================================
  // Debug: Log what we received from product_materials
  const willAttemptOpenLCA = material.data_source === 'openlca' && !!material.data_source_id && !!organizationId;
  console.log(`[Waterfall] Priority 2.5 check for ${material.material_name}:`, {
    data_source: material.data_source,
    data_source_type: typeof material.data_source,
    data_source_id: material.data_source_id,
    data_source_id_type: typeof material.data_source_id,
    organizationId: organizationId,
    organizationId_type: typeof organizationId,
    will_attempt_openlca: willAttemptOpenLCA,
    check_data_source: material.data_source === 'openlca',
    check_data_source_id: !!material.data_source_id,
    check_organizationId: !!organizationId,
  });

  if (material.data_source === 'openlca' && material.data_source_id && organizationId) {
    console.log(`[Waterfall] Attempting Priority 2.5 (OpenLCA) for: ${material.material_name}`);

    try {
      // Get auth token for API call
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.access_token) {
        // Call server-side OpenLCA calculation API
        const response = await fetch('/api/openlca/calculate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            processId: material.data_source_id,
            quantity: quantity_kg,
            organizationId: organizationId,
          }),
        });

        if (response.ok) {
          const result = await response.json();

          if (result.success && result.impacts) {
            console.log(`[Waterfall] ✓ Priority 2.5 SUCCESS: OpenLCA calculation for ${material.material_name}`);
            console.log(`[Waterfall] Climate impact: ${result.impacts.impact_climate?.toFixed(4)} kg CO2e`);

            // Build WaterfallResult from API response
            return {
              impact_climate: result.impacts.impact_climate || 0,
              impact_climate_fossil: result.impacts.impact_climate_fossil || 0,
              impact_climate_biogenic: result.impacts.impact_climate_biogenic || 0,
              impact_climate_dluc: result.impacts.impact_climate_dluc || 0,
              impact_water: result.impacts.impact_water || 0,
              impact_water_scarcity: (result.impacts.impact_water || 0) * awareFactor,
              impact_land: result.impacts.impact_land || 0,
              impact_waste: result.impacts.impact_waste || 0,
              impact_ozone_depletion: result.impacts.impact_ozone_depletion || 0,
              impact_photochemical_ozone_formation: result.impacts.impact_photochemical_ozone_formation || 0,
              impact_ionising_radiation: result.impacts.impact_ionising_radiation || 0,
              impact_particulate_matter: result.impacts.impact_particulate_matter || 0,
              impact_human_toxicity_carcinogenic: 0,
              impact_human_toxicity_non_carcinogenic: 0,
              impact_terrestrial_ecotoxicity: result.impacts.impact_terrestrial_ecotoxicity || 0,
              impact_freshwater_ecotoxicity: result.impacts.impact_freshwater_ecotoxicity || 0,
              impact_marine_ecotoxicity: result.impacts.impact_marine_ecotoxicity || 0,
              impact_freshwater_eutrophication: result.impacts.impact_freshwater_eutrophication || 0,
              impact_marine_eutrophication: result.impacts.impact_marine_eutrophication || 0,
              impact_terrestrial_acidification: result.impacts.impact_terrestrial_acidification || 0,
              impact_mineral_resource_scarcity: result.impacts.impact_mineral_resource_scarcity || 0,
              impact_fossil_resource_scarcity: result.impacts.impact_fossil_resource_scarcity || 0,
              data_priority: 2,
              data_quality_tag: 'Secondary_Modelled',
              data_quality_grade: 'HIGH',
              source_reference: result.source || `OpenLCA: ${result.processName} (${result.geography}) via ecoInvent 3.12`,
              confidence_score: 85,
              methodology: 'ReCiPe 2016 Midpoint (H) / ecoInvent 3.12',
              gwp_data_source: 'OpenLCA/ecoInvent',
              non_gwp_data_source: 'OpenLCA/ecoInvent',
              gwp_reference_id: material.data_source_id,
              non_gwp_reference_id: material.data_source_id,
              is_hybrid_source: false,
              category_type: category,
            };
          }
        } else {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`[Waterfall] OpenLCA API error:`, errorData.error || response.statusText);
        }
      }
    } catch (error: any) {
      console.warn(`[Waterfall] Priority 2.5 (OpenLCA) failed for ${material.material_name}:`, error.message);
      // Fall through to Priority 3
    }
  }

  // ===========================================================
  // PRIORITY 3: FULL ECOINVENT/STAGING FACTORS
  // (For all categories as fallback, or primary for manufacturing materials)
  // ===========================================================
  console.log(`[Waterfall] Checking Priority 3 (Full Ecoinvent/Staging) for: ${material.material_name}`);

  // Try staging_emission_factors first
  const { data: stagingFactor } = await supabase
    .from('staging_emission_factors')
    .select('*')
    .ilike('name', material.material_name)
    .limit(1)
    .maybeSingle();

  if (stagingFactor && stagingFactor.co2_factor) {
    console.log(`[Waterfall] ✓ Priority 3 SUCCESS: Using staging factor for ${material.material_name}`);

    const co2Total = Number(stagingFactor.co2_factor) * quantity_kg;
    const waterTotal = Number(stagingFactor.water_factor || 0) * quantity_kg;
    const landTotal = Number(stagingFactor.land_factor || 0) * quantity_kg;
    const wasteTotal = Number(stagingFactor.waste_factor || 0) * quantity_kg;

    // Nature impact factors from ReCiPe 2016 columns
    const terrestrialEcotoxicity = Number(stagingFactor.terrestrial_ecotoxicity_factor || 0) * quantity_kg;
    const freshwaterEutrophication = Number(stagingFactor.freshwater_eutrophication_factor || 0) * quantity_kg;
    const terrestrialAcidification = Number(stagingFactor.terrestrial_acidification_factor || 0) * quantity_kg;
    const freshwaterEcotoxicity = Number(stagingFactor.freshwater_ecotoxicity_factor || 0) * quantity_kg;
    const marineEcotoxicity = Number(stagingFactor.marine_ecotoxicity_factor || 0) * quantity_kg;
    const marineEutrophication = Number(stagingFactor.marine_eutrophication_factor || 0) * quantity_kg;

    // Use actual GHG breakdown from staging factors if available
    const hasFossilBiogenicSplit = stagingFactor.co2_fossil_factor || stagingFactor.co2_biogenic_factor;
    const fossilCO2 = hasFossilBiogenicSplit
      ? Number(stagingFactor.co2_fossil_factor || 0) * quantity_kg
      : co2Total * 0.85;
    const biogenicCO2 = hasFossilBiogenicSplit
      ? Number(stagingFactor.co2_biogenic_factor || 0) * quantity_kg
      : co2Total * 0.15;
    const dlucCO2 = Number(stagingFactor.co2_dluc_factor || 0) * quantity_kg;

    return {
      impact_climate: co2Total,
      impact_climate_fossil: fossilCO2,
      impact_climate_biogenic: biogenicCO2,
      impact_climate_dluc: dlucCO2,
      // GHG gas breakdown
      ch4_kg: Number(stagingFactor.ch4_factor || 0) * quantity_kg,
      ch4_fossil_kg: Number(stagingFactor.ch4_fossil_factor || 0) * quantity_kg,
      ch4_biogenic_kg: Number(stagingFactor.ch4_biogenic_factor || 0) * quantity_kg,
      n2o_kg: Number(stagingFactor.n2o_factor || 0) * quantity_kg,
      impact_water: waterTotal,
      impact_water_scarcity: waterTotal * awareFactor,
      impact_land: landTotal,
      impact_waste: wasteTotal,
      impact_ozone_depletion: 0,
      impact_photochemical_ozone_formation: 0,
      impact_ionising_radiation: 0,
      impact_particulate_matter: 0,
      impact_human_toxicity_carcinogenic: 0,
      impact_human_toxicity_non_carcinogenic: 0,
      impact_terrestrial_ecotoxicity: terrestrialEcotoxicity,
      impact_freshwater_ecotoxicity: freshwaterEcotoxicity,
      impact_marine_ecotoxicity: marineEcotoxicity,
      impact_freshwater_eutrophication: freshwaterEutrophication,
      impact_marine_eutrophication: marineEutrophication,
      impact_terrestrial_acidification: terrestrialAcidification,
      impact_mineral_resource_scarcity: 0,
      impact_fossil_resource_scarcity: 0,
      data_priority: 3,
      data_quality_tag: hasFossilBiogenicSplit ? 'Secondary_Modelled' : 'Secondary_Estimated',
      data_quality_grade: 'MEDIUM',
      source_reference: `Staging: ${stagingFactor.name} (${stagingFactor.source || 'Internal'})`,
      confidence_score: hasFossilBiogenicSplit ? 75 : 70,
      methodology: 'ReCiPe 2016 Midpoint (H) / Ecoinvent 3.12',
      gwp_data_source: stagingFactor.source || 'Staging Factors',
      non_gwp_data_source: stagingFactor.source || 'Staging Factors',
      gwp_reference_id: stagingFactor.id?.toString(),
      is_hybrid_source: false,
      category_type: category,
    };
  }

  // Fallback to ecoinvent_material_proxies with full 18 categories
  const { data: ecoinventProxy } = await supabase
    .from('ecoinvent_material_proxies')
    .select('*')
    .ilike('material_name', `%${material.material_name}%`)
    .limit(1)
    .maybeSingle();

  if (ecoinventProxy && ecoinventProxy.impact_climate) {
    console.log(`[Waterfall] ✓ Priority 3 SUCCESS: Using Ecoinvent proxy for ${material.material_name}`);

    const climateTotal = Number(ecoinventProxy.impact_climate || 0) * quantity_kg;

    // Use actual GHG breakdown from Ecoinvent if available
    const hasGHGBreakdown = ecoinventProxy.impact_climate_fossil || ecoinventProxy.impact_climate_biogenic;
    const fossilCO2 = hasGHGBreakdown
      ? Number(ecoinventProxy.impact_climate_fossil || 0) * quantity_kg
      : climateTotal * 0.85;
    const biogenicCO2 = hasGHGBreakdown
      ? Number(ecoinventProxy.impact_climate_biogenic || 0) * quantity_kg
      : climateTotal * 0.15;

    return {
      impact_climate: climateTotal,
      impact_climate_fossil: fossilCO2,
      impact_climate_biogenic: biogenicCO2,
      impact_climate_dluc: Number(ecoinventProxy.impact_climate_dluc || 0) * quantity_kg,
      // GHG gas breakdown from Ecoinvent
      ch4_kg: Number(ecoinventProxy.ch4_factor || 0) * quantity_kg,
      ch4_fossil_kg: Number(ecoinventProxy.ch4_fossil_factor || 0) * quantity_kg,
      ch4_biogenic_kg: Number(ecoinventProxy.ch4_biogenic_factor || 0) * quantity_kg,
      n2o_kg: Number(ecoinventProxy.n2o_factor || 0) * quantity_kg,
      impact_water: Number(ecoinventProxy.impact_water || 0) * quantity_kg,
      impact_water_scarcity: Number(ecoinventProxy.impact_water || 0) * quantity_kg * awareFactor,
      impact_land: Number(ecoinventProxy.impact_land_use || ecoinventProxy.impact_land || 0) * quantity_kg,
      impact_waste: Number(ecoinventProxy.impact_waste || 0) * quantity_kg,
      impact_ozone_depletion: Number(ecoinventProxy.impact_ozone_depletion || 0) * quantity_kg,
      impact_photochemical_ozone_formation: Number(ecoinventProxy.impact_photochemical_ozone_formation || 0) * quantity_kg,
      impact_ionising_radiation: Number(ecoinventProxy.impact_ionising_radiation || 0) * quantity_kg,
      impact_particulate_matter: Number(ecoinventProxy.impact_particulate_matter || 0) * quantity_kg,
      impact_human_toxicity_carcinogenic: Number(ecoinventProxy.impact_human_toxicity_carcinogenic || 0) * quantity_kg,
      impact_human_toxicity_non_carcinogenic: Number(ecoinventProxy.impact_human_toxicity_non_carcinogenic || 0) * quantity_kg,
      impact_terrestrial_ecotoxicity: Number(ecoinventProxy.impact_terrestrial_ecotoxicity || 0) * quantity_kg,
      impact_freshwater_ecotoxicity: Number(ecoinventProxy.impact_freshwater_ecotoxicity || 0) * quantity_kg,
      impact_marine_ecotoxicity: Number(ecoinventProxy.impact_marine_ecotoxicity || 0) * quantity_kg,
      impact_freshwater_eutrophication: Number(ecoinventProxy.impact_freshwater_eutrophication || 0) * quantity_kg,
      impact_marine_eutrophication: Number(ecoinventProxy.impact_marine_eutrophication || 0) * quantity_kg,
      impact_terrestrial_acidification: Number(ecoinventProxy.impact_terrestrial_acidification || 0) * quantity_kg,
      impact_mineral_resource_scarcity: Number(ecoinventProxy.impact_mineral_resource_scarcity || 0) * quantity_kg,
      impact_fossil_resource_scarcity: Number(ecoinventProxy.impact_fossil_fuel_scarcity || 0) * quantity_kg,
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
      data_quality_grade: category === 'MANUFACTURING_MATERIAL' ? 'MEDIUM' : 'LOW',
      source_reference: `Ecoinvent 3.12: ${ecoinventProxy.material_name} (${ecoinventProxy.geography || 'GLO'})`,
      confidence_score: 50,
      methodology: `ReCiPe 2016 Midpoint (H) / Ecoinvent ${ecoinventProxy.ecoinvent_version || '3.12'}`,
      gwp_data_source: 'Ecoinvent 3.12',
      non_gwp_data_source: 'Ecoinvent 3.12',
      gwp_reference_id: ecoinventProxy.id,
      non_gwp_reference_id: ecoinventProxy.id,
      is_hybrid_source: false,
      category_type: category,
    };
  }

  // ===========================================================
  // NO DATA FOUND
  // ===========================================================
  console.error(`[Waterfall] ✗ NO DATA FOUND for: ${material.material_name}`);
  throw new Error(`No emission factor found for material: ${material.material_name}. Please add emission data or select a different material.`);
}

export async function validateMaterialsBeforeCalculation(
  materials: ProductMaterial[],
  organizationId?: string,
  onProgress?: (materialIndex: number, totalMaterials: number, materialName: string) => void
): Promise<{
  valid: boolean;
  missingData: Array<{ material: ProductMaterial; error: string }>;
  validMaterials: Array<{ material: ProductMaterial; resolved: WaterfallResult }>;
}> {
  const missingData: Array<{ material: ProductMaterial; error: string }> = [];
  const validMaterials: Array<{ material: ProductMaterial; resolved: WaterfallResult }> = [];

  for (let i = 0; i < materials.length; i++) {
    const material = materials[i];
    onProgress?.(i + 1, materials.length, material.material_name);
    try {
      const quantityKg = normalizeToKg(material.quantity, material.unit);
      const resolved = await resolveImpactFactors(material, quantityKg, organizationId);
      validMaterials.push({ material, resolved });
    } catch (error: any) {
      missingData.push({
        material,
        error: error.message || 'Unknown error'
      });
    }
  }

  return {
    valid: missingData.length === 0,
    missingData,
    validMaterials
  };
}
