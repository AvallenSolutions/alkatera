import { getSupabaseBrowserClient } from './supabase/browser-client';
import { resolveImpactFactors, normalizeToKg, type ProductMaterial } from './impact-waterfall-resolver';
import { calculateTransportEmissions, type TransportMode } from './utils/transport-emissions-calculator';
import { resolveImpactSource } from './utils/data-quality-mapper';

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

    // 4a. Copy owned production site allocations from previous LCA (if any)
    // This ensures Scope 1/2 data persists across LCA recalculations
    const { data: previousLCA } = await supabase
      .from('product_lcas')
      .select('id')
      .eq('product_id', parseInt(productId))
      .neq('id', lca.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previousLCA) {
      console.log(`[calculateProductLCA] Found previous LCA: ${previousLCA.id}, checking for owned production sites...`);

      const { data: previousSites, error: sitesError } = await supabase
        .from('product_lca_production_sites')
        .select('*')
        .eq('product_lca_id', previousLCA.id);

      if (sitesError) {
        console.warn('[calculateProductLCA] ⚠️ Failed to query previous production sites:', sitesError);
      } else if (previousSites && previousSites.length > 0) {
        console.log(`[calculateProductLCA] Found ${previousSites.length} owned production sites from previous LCA`);

        // Copy sites to new LCA (excluding id and timestamps)
        const newSites = previousSites.map(site => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { id, created_at, updated_at, ...siteData } = site;
          return {
            ...siteData,
            product_lca_id: lca.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        });

        const { error: insertError } = await supabase
          .from('product_lca_production_sites')
          .insert(newSites);

        if (insertError) {
          console.warn('[calculateProductLCA] ⚠️ Failed to copy production sites:', insertError);
          console.warn('[calculateProductLCA] This may affect Scope 1/2 calculations');
        } else {
          console.log(`[calculateProductLCA] ✅ Copied ${newSites.length} owned production sites to new LCA`);

          // Log the emissions being carried forward
          const totalCopiedEmissions = newSites.reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
          const totalScope1 = newSites.reduce((sum, s) => sum + (s.scope1_emissions_kg_co2e || 0), 0);
          const totalScope2 = newSites.reduce((sum, s) => sum + (s.scope2_emissions_kg_co2e || 0), 0);
          console.log(`[calculateProductLCA] Copied emissions: Total=${totalCopiedEmissions.toFixed(2)} kg, Scope1=${totalScope1.toFixed(2)} kg, Scope2=${totalScope2.toFixed(2)} kg`);
        }
      } else {
        console.log('[calculateProductLCA] No owned production sites found in previous LCA');
      }
    } else {
      console.log('[calculateProductLCA] No previous LCA found, skipping production site copy');
    }

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
        // Note: data_source must be 'openlca', 'supplier', or NULL per constraint
        // For staging factors, we use NULL
        let dataSource = null;
        if (material.data_source === 'openlca' && material.data_source_id) {
          dataSource = 'openlca';
        } else if (material.data_source === 'supplier' && material.supplier_product_id) {
          dataSource = 'supplier';
        }

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
          data_source: dataSource,
          data_source_id: material.data_source_id || null,

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
          impact_source: resolveImpactSource(resolved.data_quality_tag, resolved.data_priority),
          impact_reference_id: resolved.supplier_lca_id || null,
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

    // 7. Import current production site allocations
    // ALWAYS use fresh data from contract_manufacturer_allocations, not stale LCA data
    console.log(`[calculateProductLCA] Loading current production site allocations for product ${productId}...`);

    const { data: cmAllocations, error: cmError } = await supabase
      .from('contract_manufacturer_allocations')
      .select('*')
      .eq('product_id', parseInt(productId))
      .eq('organization_id', product.organization_id)
      .order('reporting_period_start', { ascending: false });

    if (cmError) {
      console.error('[calculateProductLCA] ❌ Failed to query contract manufacturer allocations');
      console.error('[calculateProductLCA] Error details:', cmError);
      console.error('[calculateProductLCA] This might indicate:');
      console.error('[calculateProductLCA]   - RLS policy blocking access');
      console.error('[calculateProductLCA]   - Database connection issue');
      console.error('[calculateProductLCA]   - Missing table/columns (run: supabase db reset --local)');

      throw new Error(`Failed to fetch production site data: ${cmError.message}`);
    }

    console.log(`[calculateProductLCA] ✓ Contract manufacturer query successful`);
    console.log(`[calculateProductLCA] Found ${cmAllocations?.length || 0} allocations for product ${productId}`);

    if (!cmAllocations || cmAllocations.length === 0) {
      console.warn('[calculateProductLCA] ⚠️  No contract manufacturer allocations found');
      console.warn('[calculateProductLCA] Expected at least 1 allocation for TEST CALVADOS');
      console.warn('[calculateProductLCA] Check if migration 20251219165224 was applied: supabase db reset --local');
      console.warn('[calculateProductLCA] Or create allocation manually in Production Sites tab');
    } else {
      console.log('[calculateProductLCA] Allocation details:', cmAllocations.map(a => ({
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
      console.log(`[calculateProductLCA] Found ${cmAllocations.length} contract manufacturer allocations`);
      console.log(`[calculateProductLCA] These will be read directly by the Edge Function from contract_manufacturer_allocations table`);
      console.log('[calculateProductLCA] Contract manufacturers:', cmAllocations.map(a => ({
        facility_id: a.facility_id,
        emissions: a.allocated_emissions_kg_co2e,
        scope1: a.scope1_emissions_kg_co2e,
        scope2: a.scope2_emissions_kg_co2e,
        status: a.status
      })));

      const totalAllocationEmissions = cmAllocations.reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductLCA] Total contract manufacturer emissions: ${totalAllocationEmissions.toFixed(2)} kg CO2e`);
    } else {
      console.log(`[calculateProductLCA] No contract manufacturer allocations found for this product`);
    }

    // Verify data sources are available
    console.log('[calculateProductLCA] 🔍 Verifying production data sources...');

    // Check owned production sites
    const { data: ownedSitesData, error: ownedVerifyError } = await supabase
      .from('product_lca_production_sites')
      .select('id, facility_id, allocated_emissions_kg_co2e, scope1_emissions_kg_co2e, scope2_emissions_kg_co2e')
      .eq('product_lca_id', lca.id);

    if (ownedVerifyError) {
      console.error('[calculateProductLCA] ❌ Failed to verify owned sites:', ownedVerifyError);
    } else {
      const ownedEmissions = (ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0);
      console.log(`[calculateProductLCA] Owned production sites: ${ownedSitesData?.length || 0} (${ownedEmissions.toFixed(2)} kg CO2e)`);
    }

    // Check contract manufacturer allocations
    const cmEmissions = (cmAllocations || []).reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);
    console.log(`[calculateProductLCA] Contract manufacturers: ${cmAllocations?.length || 0} (${cmEmissions.toFixed(2)} kg CO2e)`);

    const totalSites = (ownedSitesData?.length || 0) + (cmAllocations?.length || 0);
    const totalEmissions = ((ownedSitesData || []).reduce((sum, s) => sum + (s.allocated_emissions_kg_co2e || 0), 0)) + cmEmissions;

    if (totalSites > 0) {
      console.log(`[calculateProductLCA] ✅ Total production sources: ${totalSites} (${totalEmissions.toFixed(2)} kg CO2e)`);
      console.log('[calculateProductLCA] Edge Function will read from both tables');
    } else {
      console.warn('[calculateProductLCA] ⚠️  No production sites or contract manufacturers found');
      console.warn('[calculateProductLCA] Processing emissions will be zero unless manually entered');
    }

    // 8. Call aggregation edge function to calculate totals
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
