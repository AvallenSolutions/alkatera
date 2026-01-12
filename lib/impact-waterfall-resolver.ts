import { getSupabaseBrowserClient } from './supabase/browser-client';
import { DEFAULT_AWARE_FACTOR, getAwareFactorValue } from './calculations/water-risk';

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
  data_quality_tag: 'Primary_Verified' | 'Regional_Standard' | 'Secondary_Modelled';
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
 * 3. Full Ecoinvent/staging factors (for manufacturing materials)
 */
export async function resolveImpactFactors(
  material: ProductMaterial,
  quantity_kg: number
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
  // ===========================================================
  if (material.data_source === 'supplier' && material.supplier_product_id) {
    console.log(`[Waterfall] Checking Priority 1 (Supplier) for: ${material.material_name}`);

    try {
      const { data: supplierProduct } = await supabase
        .from('products')
        .select('id, organization_id')
        .eq('id', material.supplier_product_id)
        .maybeSingle();

      if (supplierProduct) {
        const { data: supplierLca } = await supabase
          .from('product_lcas')
          .select('id, aggregated_impacts')
          .eq('product_id', supplierProduct.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (supplierLca?.aggregated_impacts) {
          const impacts = supplierLca.aggregated_impacts;
          console.log(`[Waterfall] ✓ Priority 1 SUCCESS: Using supplier LCA ${supplierLca.id}`);

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

        return {
          // GWP from DEFRA
          impact_climate: gwpTotal,
          impact_climate_fossil: gwpTotal * 0.85,
          impact_climate_biogenic: gwpTotal * 0.15,
          impact_climate_dluc: 0,

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

    return {
      impact_climate: co2Total,
      impact_climate_fossil: co2Total * 0.85,
      impact_climate_biogenic: co2Total * 0.15,
      impact_climate_dluc: 0,
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
      impact_terrestrial_ecotoxicity: 0,
      impact_freshwater_ecotoxicity: 0,
      impact_marine_ecotoxicity: 0,
      impact_freshwater_eutrophication: 0,
      impact_marine_eutrophication: 0,
      impact_terrestrial_acidification: 0,
      impact_mineral_resource_scarcity: 0,
      impact_fossil_resource_scarcity: 0,
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
      data_quality_grade: 'MEDIUM',
      source_reference: `Staging: ${stagingFactor.name} (${stagingFactor.source || 'Internal'})`,
      confidence_score: 70,
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

    return {
      impact_climate: Number(ecoinventProxy.impact_climate || 0) * quantity_kg,
      impact_climate_fossil: Number(ecoinventProxy.impact_climate || 0) * quantity_kg * 0.85,
      impact_climate_biogenic: Number(ecoinventProxy.impact_climate || 0) * quantity_kg * 0.15,
      impact_climate_dluc: 0,
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
  materials: ProductMaterial[]
): Promise<{
  valid: boolean;
  missingData: Array<{ material: ProductMaterial; error: string }>;
  validMaterials: Array<{ material: ProductMaterial; resolved: WaterfallResult }>;
}> {
  const missingData: Array<{ material: ProductMaterial; error: string }> = [];
  const validMaterials: Array<{ material: ProductMaterial; resolved: WaterfallResult }> = [];

  for (const material of materials) {
    try {
      const quantityKg = normalizeToKg(material.quantity, material.unit);
      const resolved = await resolveImpactFactors(material, quantityKg);
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
