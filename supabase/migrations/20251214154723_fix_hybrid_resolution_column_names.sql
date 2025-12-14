/*
  # Fix Hybrid Resolution Function Column Names
  
  ## Issue
  The `update_material_with_hybrid_impacts` function was referencing incorrect column names:
  - `quantity_value` (should be `quantity`)
  - `quantity_unit` (should be `unit`)
  
  This was causing insert failures when creating product LCA materials.
  
  ## Changes
  - Update function to use correct column names from product_lca_materials table
*/

-- Drop and recreate the function with correct column names
CREATE OR REPLACE FUNCTION public.update_material_with_hybrid_impacts(
  p_material_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_material RECORD;
  v_impacts RECORD;
BEGIN
  -- Get the material details
  SELECT * INTO v_material
  FROM public.product_lca_materials
  WHERE id = p_material_id;
  
  IF v_material IS NULL THEN
    RETURN false;
  END IF;
  
  -- Resolve hybrid impacts using CORRECT column names
  SELECT * INTO v_impacts
  FROM public.resolve_hybrid_impacts(
    v_material.material_name,
    COALESCE(v_material.category_type, 'MANUFACTURING_MATERIAL'::material_category_type),
    v_material.quantity,  -- FIXED: was quantity_value
    v_material.unit       -- FIXED: was quantity_unit
  );
  
  -- Update the material with resolved impacts
  UPDATE public.product_lca_materials
  SET
    -- GWP impacts
    impact_climate = v_impacts.gwp_climate_total,
    impact_climate_fossil = v_impacts.gwp_climate_fossil,
    impact_climate_biogenic = v_impacts.gwp_climate_biogenic,
    gwp_data_source = v_impacts.gwp_data_source,
    gwp_reference_id = v_impacts.gwp_reference_id,
    
    -- Non-GWP impacts
    impact_water = v_impacts.non_gwp_water,
    impact_land = v_impacts.non_gwp_land,  -- Note: using impact_land (not impact_land_use)
    impact_waste = v_impacts.non_gwp_waste,
    impact_terrestrial_acidification = v_impacts.non_gwp_acidification,
    impact_freshwater_eutrophication = v_impacts.non_gwp_eutrophication_freshwater,
    impact_marine_eutrophication = v_impacts.non_gwp_eutrophication_marine,
    impact_freshwater_ecotoxicity = v_impacts.non_gwp_ecotoxicity_freshwater,
    impact_ozone_depletion = v_impacts.non_gwp_ozone_depletion,
    non_gwp_data_source = v_impacts.non_gwp_data_source,
    non_gwp_reference_id = v_impacts.non_gwp_reference_id,
    
    -- Metadata
    is_hybrid_source = v_impacts.is_hybrid,
    data_quality_grade = v_impacts.data_quality_grade,
    confidence_score = v_impacts.confidence_score,
    geographic_scope = v_impacts.geographic_scope,
    
    updated_at = now()
  WHERE id = p_material_id;
  
  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_material_with_hybrid_impacts IS
  'Updates a material''s impact data using hybrid resolution logic. Uses correct column names: quantity and unit.';
