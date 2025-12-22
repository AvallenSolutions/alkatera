/*
  # Recalculate Test LCAs with Per-Unit Emissions

  ## Issue
  The LCA calculations were mixing bulk volume (hectolitres) with consumer units (bottles).
  The total_ghg_emissions field was storing incorrect values that don't match the
  aggregated_impacts calculations.

  ## Fix
  1. Recalculate all test product LCAs to ensure per-unit (per bottle/can) emissions
  2. Update total_ghg_emissions to match the aggregated_impacts correctly
  3. Mark LCAs as per_unit_emissions_verified

  ## Test Products
  - TEST CALVADOS (700ml bottle)
  - TEST NON-ALC BEER (330ml can)
  - TEST WINE (750ml bottle)
*/

DO $$
DECLARE
  v_calvados_lca_id UUID;
  v_beer_lca_id UUID;
  v_wine_lca_id UUID;
  v_calvados_materials_total NUMERIC;
  v_calvados_mfg_total NUMERIC;
  v_beer_materials_total NUMERIC;
  v_wine_materials_total NUMERIC;
BEGIN

  -- Get LCA IDs
  SELECT latest_lca_id INTO v_calvados_lca_id FROM products WHERE name = 'TEST CALVADOS';
  SELECT latest_lca_id INTO v_beer_lca_id FROM products WHERE name = 'TEST NON-ALC BEER';
  SELECT latest_lca_id INTO v_wine_lca_id FROM products WHERE name = 'TEST WINE';

  -- =====================================================================
  -- CALVADOS: Calculate per-bottle emissions
  -- =====================================================================
  
  -- Materials total (already per bottle)
  SELECT COALESCE(SUM(impact_climate + COALESCE(impact_transport, 0)), 0)
  INTO v_calvados_materials_total
  FROM product_lca_materials
  WHERE product_lca_id = v_calvados_lca_id;

  -- Manufacturing from contract manufacturer (convert total to per-unit)
  -- Contract mfg allocated 3,750 kg for 100,000 bottles = 0.0375 kg per bottle
  SELECT COALESCE(
    SUM(allocated_emissions_kg_co2e / NULLIF(client_production_volume, 0)),
    0
  )
  INTO v_calvados_mfg_total
  FROM contract_manufacturer_allocations
  WHERE product_id = (SELECT id FROM products WHERE name = 'TEST CALVADOS');

  -- Update CALVADOS LCA with correct per-bottle emissions
  UPDATE product_lcas
  SET 
    total_ghg_emissions = v_calvados_materials_total + v_calvados_mfg_total,
    per_unit_emissions_verified = true,
    bulk_volume_per_functional_unit = 0.7,  -- 700ml = 0.7L
    volume_unit = 'L',
    aggregated_impacts = jsonb_set(
      COALESCE(aggregated_impacts, '{}'::jsonb),
      '{breakdown,by_lifecycle_stage}',
      jsonb_build_object(
        'raw_materials', v_calvados_materials_total,
        'processing', v_calvados_mfg_total,
        'packaging_stage', 0,
        'distribution', 0,
        'use_phase', 0,
        'end_of_life', 0
      )
    ),
    updated_at = now()
  WHERE id = v_calvados_lca_id;

  RAISE NOTICE 'CALVADOS: Materials=% kg, Mfg=% kg, Total=% kg per bottle',
    v_calvados_materials_total, v_calvados_mfg_total, 
    (v_calvados_materials_total + v_calvados_mfg_total);

  -- =====================================================================
  -- BEER: Calculate per-can emissions
  -- =====================================================================
  
  SELECT COALESCE(SUM(impact_climate + COALESCE(impact_transport, 0)), 0)
  INTO v_beer_materials_total
  FROM product_lca_materials
  WHERE product_lca_id = v_beer_lca_id;

  -- Update BEER LCA
  UPDATE product_lcas
  SET 
    total_ghg_emissions = v_beer_materials_total,
    per_unit_emissions_verified = true,
    bulk_volume_per_functional_unit = 0.33,  -- 330ml = 0.33L
    volume_unit = 'L',
    aggregated_impacts = jsonb_set(
      COALESCE(aggregated_impacts, '{}'::jsonb),
      '{breakdown,by_lifecycle_stage}',
      jsonb_build_object(
        'raw_materials', v_beer_materials_total,
        'processing', 0,
        'packaging_stage', 0,
        'distribution', 0,
        'use_phase', 0,
        'end_of_life', 0
      )
    ),
    updated_at = now()
  WHERE id = v_beer_lca_id;

  RAISE NOTICE 'BEER: Materials=% kg, Total=% kg per can',
    v_beer_materials_total, v_beer_materials_total;

  -- =====================================================================
  -- WINE: Calculate per-bottle emissions
  -- =====================================================================
  
  SELECT COALESCE(SUM(impact_climate + COALESCE(impact_transport, 0)), 0)
  INTO v_wine_materials_total
  FROM product_lca_materials
  WHERE product_lca_id = v_wine_lca_id;

  -- Update WINE LCA
  UPDATE product_lcas
  SET 
    total_ghg_emissions = v_wine_materials_total,
    per_unit_emissions_verified = true,
    bulk_volume_per_functional_unit = 0.75,  -- 750ml = 0.75L
    volume_unit = 'L',
    aggregated_impacts = jsonb_set(
      COALESCE(aggregated_impacts, '{}'::jsonb),
      '{breakdown,by_lifecycle_stage}',
      jsonb_build_object(
        'raw_materials', v_wine_materials_total,
        'processing', 0,
        'packaging_stage', 0,
        'distribution', 0,
        'use_phase', 0,
        'end_of_life', 0
      )
    ),
    updated_at = now()
  WHERE id = v_wine_lca_id;

  RAISE NOTICE 'WINE: Materials=% kg, Total=% kg per bottle',
    v_wine_materials_total, v_wine_materials_total;

END $$;

-- Verify the recalculation
SELECT 
  p.name as product_name,
  p.unit_size_value || p.unit_size_unit as unit_size,
  lca.functional_unit,
  ROUND(lca.total_ghg_emissions::numeric, 4) as kg_co2e_per_unit,
  ROUND((lca.total_ghg_emissions / lca.bulk_volume_per_functional_unit)::numeric, 4) as kg_co2e_per_litre,
  lca.per_unit_emissions_verified as verified,
  lca.aggregated_impacts->'breakdown'->'by_lifecycle_stage'->>'raw_materials' as materials_kg,
  lca.aggregated_impacts->'breakdown'->'by_lifecycle_stage'->>'processing' as processing_kg
FROM products p
JOIN product_lcas lca ON lca.id = p.latest_lca_id
WHERE p.name IN ('TEST CALVADOS', 'TEST NON-ALC BEER', 'TEST WINE')
ORDER BY p.name;
