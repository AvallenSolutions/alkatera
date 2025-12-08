import { getSupabaseBrowserClient } from './supabase/browser-client';
import { resolveImpactFactors, normalizeToKg, type ProductMaterial } from './impact-waterfall-resolver';
import { calculateTransportEmissions, type TransportMode } from './utils/transport-emissions-calculator';

export interface CalculateLCAParams {
  productId: string;
  functionalUnit?: string;
  systemBoundary?: 'cradle-to-gate' | 'cradle-to-grave';
  referenceYear?: number;
}

export interface CalculateLCAResult {
  success: boolean;
  lcaId?: string;
  error?: string;
}

export async function calculateProductLCA(params: CalculateLCAParams): Promise<CalculateLCAResult> {
  const supabase = getSupabaseBrowserClient();
  const { productId, functionalUnit, systemBoundary, referenceYear } = params;

  try {
    console.log(`[calculateProductLCA] Starting calculation for product: ${productId}`);

    // 1. Get user and organization
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
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

    console.log(`[calculateProductLCA] Product: ${product.name}`);

    // 3. Fetch all product materials (ingredients + packaging)
    const { data: materials, error: materialsError } = await supabase
      .from('product_materials')
      .select('*')
      .eq('product_id', productId);

    if (materialsError) {
      throw new Error(`Failed to fetch materials: ${materialsError.message}`);
    }

    if (!materials || materials.length === 0) {
      throw new Error('No materials found for this product. Please add ingredients and packaging first.');
    }

    console.log(`[calculateProductLCA] Found ${materials.length} materials to process`);

    // 4. Create product_lca record
    const { data: lca, error: lcaError } = await supabase
      .from('product_lcas')
      .insert({
        organization_id: product.organization_id,
        product_id: parseInt(productId),
        product_name: product.name,
        product_description: product.product_description,
        product_image_url: product.product_image_url,
        functional_unit: functionalUnit || `1 ${product.unit || 'unit'} of ${product.name}`,
        system_boundary: systemBoundary || 'cradle-to-gate',
        reference_year: referenceYear || new Date().getFullYear(),
        lca_version: '1.0',
        lca_scope_type: systemBoundary || 'cradle-to-gate',
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (lcaError || !lca) {
      throw new Error(`Failed to create LCA: ${lcaError?.message || 'Unknown error'}`);
    }

    console.log(`[calculateProductLCA] Created LCA record: ${lca.id}`);

    // 5. Resolve impact factors for each material using waterfall logic
    const lcaMaterialsWithImpacts = [];

    for (const material of materials) {
      try {
        // Normalize quantity to kg
        const quantityKg = normalizeToKg(material.quantity, material.unit);

        console.log(`[calculateProductLCA] Processing material: ${material.material_name} (${quantityKg} kg)`);

        // Apply waterfall logic to get impact factors
        const resolved = await resolveImpactFactors(material as ProductMaterial, quantityKg);

        // Calculate transport emissions if transport data is available
        let transportEmissions = 0;
        if (material.transport_mode && material.distance_km) {
          try {
            const transportResult = await calculateTransportEmissions({
              weightKg: quantityKg,
              distanceKm: Number(material.distance_km),
              transportMode: material.transport_mode as TransportMode
            });
            transportEmissions = transportResult.emissions;
            console.log(`[calculateProductLCA] ✓ Transport emissions for ${material.material_name}: ${transportEmissions.toFixed(4)} kg CO2e (${material.transport_mode}, ${material.distance_km} km)`);
          } catch (error: any) {
            console.warn(`[calculateProductLCA] ⚠ Failed to calculate transport emissions for ${material.material_name}:`, error.message);
          }
        }

        // Build LCA material record with all impact data
        const lcaMaterial = {
          product_lca_id: lca.id,
          name: material.material_name,
          material_name: material.material_name,
          material_type: material.material_type,
          quantity: quantityKg,
          unit: 'kg',
          unit_name: material.unit,
          packaging_category: material.packaging_category,
          origin_country: material.origin_country,
          country_of_origin: material.origin_country,
          is_organic: material.is_organic_certified,
          is_organic_certified: material.is_organic_certified,
          supplier_product_id: material.supplier_product_id,
          data_source: material.data_source || 'database',

          // Transport data
          transport_mode: material.transport_mode || null,
          distance_km: material.distance_km || null,
          impact_transport: transportEmissions,

          // Origin geolocation
          origin_address: material.origin_address || null,
          origin_lat: material.origin_lat || null,
          origin_lng: material.origin_lng || null,
          origin_country_code: material.origin_country_code || null,

          // Impact values
          impact_climate: resolved.impact_climate,
          impact_climate_fossil: resolved.impact_climate_fossil,
          impact_climate_biogenic: resolved.impact_climate_biogenic,
          impact_climate_dluc: resolved.impact_climate_dluc,
          impact_water: resolved.impact_water,
          impact_water_scarcity: resolved.impact_water_scarcity,
          impact_land: resolved.impact_land,
          impact_waste: resolved.impact_waste,
          impact_terrestrial_ecotoxicity: resolved.impact_terrestrial_ecotoxicity,
          impact_freshwater_eutrophication: resolved.impact_freshwater_eutrophication,
          impact_terrestrial_acidification: resolved.impact_terrestrial_acidification,
          impact_fossil_resource_scarcity: resolved.impact_fossil_resource_scarcity,

          // Data quality & provenance
          data_priority: resolved.data_priority,
          data_quality_tag: resolved.data_quality_tag,
          supplier_lca_id: resolved.supplier_lca_id || null,
          confidence_score: resolved.confidence_score,
          methodology: resolved.methodology,
          source_reference: resolved.source_reference,
          impact_source: resolved.data_quality_tag,
          impact_reference_id: resolved.supplier_lca_id || material.data_source_id || null,
        };

        lcaMaterialsWithImpacts.push(lcaMaterial);

        const totalMaterialEmissions = resolved.impact_climate + transportEmissions;
        console.log(`[calculateProductLCA] ✓ Resolved ${material.material_name}: ${resolved.impact_climate.toFixed(3)} kg CO2e + ${transportEmissions.toFixed(3)} kg transport = ${totalMaterialEmissions.toFixed(3)} kg CO2e total (Priority ${resolved.data_priority})`);

      } catch (error: any) {
        console.error(`[calculateProductLCA] ✗ Failed to resolve ${material.material_name}:`, error.message);

        // Clean up: delete the LCA record since we can't proceed
        await supabase.from('product_lcas').delete().eq('id', lca.id);

        throw new Error(`Missing emission data for material "${material.material_name}". ${error.message}`);
      }
    }

    // 6. Insert all materials with impact values into product_lca_materials
    const { error: insertError } = await supabase
      .from('product_lca_materials')
      .insert(lcaMaterialsWithImpacts);

    if (insertError) {
      // Clean up
      await supabase.from('product_lcas').delete().eq('id', lca.id);
      throw new Error(`Failed to insert materials: ${insertError.message}`);
    }

    console.log(`[calculateProductLCA] Inserted ${lcaMaterialsWithImpacts.length} materials into database`);

    // 7. Call aggregation edge function to calculate totals
    console.log(`[calculateProductLCA] Calling aggregation engine...`);

    const { data: aggregationResult, error: aggregationError } = await supabase.functions.invoke(
      'calculate-product-lca-impacts',
      {
        body: { product_lca_id: lca.id }
      }
    );

    if (aggregationError) {
      console.error('[calculateProductLCA] Aggregation error:', aggregationError);
      throw new Error(`Calculation failed: ${aggregationError.message}`);
    }

    console.log(`[calculateProductLCA] ✓ Calculation complete for LCA: ${lca.id}`);

    return {
      success: true,
      lcaId: lca.id
    };

  } catch (error: any) {
    console.error('[calculateProductLCA] Error:', error);
    return {
      success: false,
      error: error.message || 'Failed to calculate LCA'
    };
  }
}
