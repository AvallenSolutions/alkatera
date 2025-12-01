import { getSupabaseBrowserClient } from './supabase/browser-client';

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
}

export interface WaterfallResult {
  impact_climate: number;
  impact_climate_fossil: number;
  impact_climate_biogenic: number;
  impact_climate_dluc: number;
  impact_water: number;
  impact_water_scarcity: number;
  impact_land: number;
  impact_waste: number;
  impact_terrestrial_ecotoxicity: number;
  impact_freshwater_eutrophication: number;
  impact_terrestrial_acidification: number;
  impact_fossil_resource_scarcity: number;
  data_priority: 1 | 2 | 3;
  data_quality_tag: 'Primary_Verified' | 'Regional_Standard' | 'Secondary_Modelled';
  source_reference: string;
  confidence_score: number;
  methodology: string;
  supplier_lca_id?: string;
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

export async function resolveImpactFactors(
  material: ProductMaterial,
  quantity_kg: number
): Promise<WaterfallResult> {
  const supabase = getSupabaseBrowserClient();

  // ===========================================================
  // PRIORITY 1: PRIMARY DATA (Supplier Verified)
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
            impact_water_scarcity: (impacts.water_scarcity_aware || impacts.water_consumption * 20 || 0) * quantity_kg,
            impact_land: (impacts.land_use || 0) * quantity_kg,
            impact_waste: (impacts.waste || 0) * quantity_kg,
            impact_terrestrial_ecotoxicity: (impacts.terrestrial_ecotoxicity || 0) * quantity_kg,
            impact_freshwater_eutrophication: (impacts.freshwater_eutrophication || 0) * quantity_kg,
            impact_terrestrial_acidification: (impacts.terrestrial_acidification || 0) * quantity_kg,
            impact_fossil_resource_scarcity: (impacts.fossil_resource_scarcity || 0) * quantity_kg,
            data_priority: 1,
            data_quality_tag: 'Primary_Verified',
            source_reference: `Supplier Product LCA ${supplierLca.id}`,
            confidence_score: 95,
            methodology: 'ISO 14067 / Supplier EPD',
            supplier_lca_id: supplierLca.id
          };
        }
      }
    } catch (error) {
      console.warn(`[Waterfall] Priority 1 failed for ${material.material_name}:`, error);
    }
  }

  // ===========================================================
  // PRIORITY 2: REGIONAL GOVERNMENT FACTORS (DEFRA/EPA)
  // ===========================================================
  // This priority is typically used for Scope 1 & 2 (energy, fuels, transport)
  // For now, we skip to Priority 3 for materials as DEFRA doesn't cover ingredients/packaging
  // Future: Add DEFRA factors for logistics/transport materials

  // ===========================================================
  // PRIORITY 3: SECONDARY DATA (Staging Factors → Ecoinvent)
  // ===========================================================
  console.log(`[Waterfall] Checking Priority 3 (Staging/Ecoinvent) for: ${material.material_name}`);

  // Try staging_emission_factors first
  const { data: stagingFactor } = await supabase
    .from('staging_emission_factors')
    .select('*')
    .ilike('name', material.material_name)
    .in('category', ['Ingredient', 'Packaging'])
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
      impact_water_scarcity: waterTotal * 20,
      impact_land: landTotal,
      impact_waste: wasteTotal,
      impact_terrestrial_ecotoxicity: 0,
      impact_freshwater_eutrophication: 0,
      impact_terrestrial_acidification: 0,
      impact_fossil_resource_scarcity: 0,
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
      source_reference: `Staging: ${stagingFactor.name} (${stagingFactor.source || 'Internal'})`,
      confidence_score: 70,
      methodology: 'ReCiPe 2016 Midpoint (H) / Ecoinvent 3.12'
    };
  }

  // Fallback to ecoinvent_material_proxies
  const { data: ecoinventProxy } = await supabase
    .from('ecoinvent_material_proxies')
    .select('*')
    .ilike('material_name', `%${material.material_name}%`)
    .limit(1)
    .maybeSingle();

  if (ecoinventProxy && ecoinventProxy.impact_climate) {
    console.log(`[Waterfall] ✓ Priority 3 SUCCESS: Using Ecoinvent proxy for ${material.material_name}`);

    const climateTotal = Number(ecoinventProxy.impact_climate) * quantity_kg;
    const waterTotal = Number(ecoinventProxy.impact_water || 0) * quantity_kg;
    const landTotal = Number(ecoinventProxy.impact_land || 0) * quantity_kg;
    const wasteTotal = Number(ecoinventProxy.impact_waste || 0) * quantity_kg;

    return {
      impact_climate: climateTotal,
      impact_climate_fossil: climateTotal * 0.85,
      impact_climate_biogenic: climateTotal * 0.15,
      impact_climate_dluc: 0,
      impact_water: waterTotal,
      impact_water_scarcity: waterTotal * 20,
      impact_land: landTotal,
      impact_waste: wasteTotal,
      impact_terrestrial_ecotoxicity: Number(ecoinventProxy.impact_human_toxicity || 0) * quantity_kg,
      impact_freshwater_eutrophication: Number(ecoinventProxy.impact_marine_eutrophication || 0) * quantity_kg,
      impact_terrestrial_acidification: 0,
      impact_fossil_resource_scarcity: 0,
      data_priority: 3,
      data_quality_tag: 'Secondary_Modelled',
      source_reference: `Ecoinvent 3.12: ${ecoinventProxy.material_name} (${ecoinventProxy.geography || 'GLO'})`,
      confidence_score: 50,
      methodology: `ReCiPe 2016 Midpoint (H) / Ecoinvent ${ecoinventProxy.ecoinvent_version || '3.12'}`
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
