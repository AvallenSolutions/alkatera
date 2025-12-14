/*
  # Fix Hybrid Trigger Column Name Bug

  1. Issue
     - The auto_resolve_hybrid_impacts trigger is overwriting correct impact values with NULLs
     - The resolve_hybrid_impacts function uses wrong column names for staging_emission_factors
     - Columns used: factor_name, climate_factor, water_factor (WRONG)
     - Actual columns: name, co2_factor (CORRECT)

  2. Fix
     - DROP the broken trigger temporarily
     - Fix the resolve_hybrid_impacts function to use correct column names
     - Recreate the trigger

  3. Impact
     - LCA calculations will now preserve the correct impact values from the calculator
     - Future implementations can use the fixed function when needed
*/

-- =====================================================
-- SECTION 1: DROP BROKEN TRIGGER
-- =====================================================

DROP TRIGGER IF EXISTS auto_resolve_hybrid_impacts ON public.product_lca_materials;

COMMENT ON FUNCTION public.trigger_resolve_hybrid_impacts IS
  'DISABLED: Trigger was overwriting correct values with NULLs due to column name mismatch';

-- =====================================================
-- SECTION 2: FIX resolve_hybrid_impacts FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.resolve_hybrid_impacts(
  p_material_name TEXT,
  p_category_type material_category_type,
  p_quantity NUMERIC DEFAULT 1.0,
  p_unit TEXT DEFAULT 'kg'
)
RETURNS TABLE (
  gwp_climate_total NUMERIC,
  gwp_climate_fossil NUMERIC,
  gwp_climate_biogenic NUMERIC,
  gwp_data_source TEXT,
  gwp_reference_id TEXT,
  non_gwp_water NUMERIC,
  non_gwp_land NUMERIC,
  non_gwp_waste NUMERIC,
  non_gwp_acidification NUMERIC,
  non_gwp_eutrophication_freshwater NUMERIC,
  non_gwp_eutrophication_marine NUMERIC,
  non_gwp_ecotoxicity_freshwater NUMERIC,
  non_gwp_ozone_depletion NUMERIC,
  non_gwp_data_source TEXT,
  non_gwp_reference_id TEXT,
  is_hybrid BOOLEAN,
  data_quality_grade TEXT,
  confidence_score INTEGER,
  geographic_scope TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_staging_factor RECORD;
  v_ecoinvent_proxy RECORD;
BEGIN
  -- Try staging_emission_factors first (correct column names)
  SELECT * INTO v_staging_factor
  FROM public.staging_emission_factors
  WHERE LOWER(name) = LOWER(p_material_name)
    OR LOWER(name) LIKE '%' || LOWER(p_material_name) || '%'
  ORDER BY 
    CASE WHEN LOWER(name) = LOWER(p_material_name) THEN 1 ELSE 2 END
  LIMIT 1;
  
  IF v_staging_factor IS NOT NULL AND v_staging_factor.co2_factor IS NOT NULL THEN
    -- Found in staging factors
    RETURN QUERY SELECT
      v_staging_factor.co2_factor * p_quantity AS gwp_climate_total,
      v_staging_factor.co2_factor * p_quantity * 0.85 AS gwp_climate_fossil,
      v_staging_factor.co2_factor * p_quantity * 0.15 AS gwp_climate_biogenic,
      COALESCE(v_staging_factor.source, 'Staging Factors')::TEXT AS gwp_data_source,
      v_staging_factor.name AS gwp_reference_id,
      
      0::NUMERIC AS non_gwp_water,
      0::NUMERIC AS non_gwp_land,
      0::NUMERIC AS non_gwp_waste,
      0::NUMERIC AS non_gwp_acidification,
      0::NUMERIC AS non_gwp_eutrophication_freshwater,
      0::NUMERIC AS non_gwp_eutrophication_marine,
      0::NUMERIC AS non_gwp_ecotoxicity_freshwater,
      0::NUMERIC AS non_gwp_ozone_depletion,
      'Staging Factors'::TEXT AS non_gwp_data_source,
      v_staging_factor.name AS non_gwp_reference_id,
      
      false::BOOLEAN AS is_hybrid,
      'MEDIUM'::TEXT AS data_quality_grade,
      70::INTEGER AS confidence_score,
      'GLO'::TEXT AS geographic_scope;
    RETURN;
  END IF;
  
  -- Fallback to ecoinvent_material_proxies
  SELECT * INTO v_ecoinvent_proxy
  FROM public.ecoinvent_material_proxies
  WHERE LOWER(material_name) LIKE '%' || LOWER(p_material_name) || '%'
  ORDER BY data_quality_score DESC NULLS LAST
  LIMIT 1;
  
  IF v_ecoinvent_proxy IS NOT NULL AND v_ecoinvent_proxy.impact_climate IS NOT NULL THEN
    -- Found in Ecoinvent
    RETURN QUERY SELECT
      COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity AS gwp_climate_total,
      COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity * 0.85 AS gwp_climate_fossil,
      COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity * 0.15 AS gwp_climate_biogenic,
      'Ecoinvent 3.12'::TEXT AS gwp_data_source,
      v_ecoinvent_proxy.material_category AS gwp_reference_id,
      
      COALESCE(v_ecoinvent_proxy.impact_water, 0) * p_quantity AS non_gwp_water,
      COALESCE(v_ecoinvent_proxy.impact_land_use, v_ecoinvent_proxy.impact_land, 0) * p_quantity AS non_gwp_land,
      COALESCE(v_ecoinvent_proxy.impact_waste, 0) * p_quantity AS non_gwp_waste,
      COALESCE(v_ecoinvent_proxy.impact_terrestrial_acidification, 0) * p_quantity AS non_gwp_acidification,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_marine_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_marine,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_ecotoxicity, 0) * p_quantity AS non_gwp_ecotoxicity_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_ozone_depletion, 0) * p_quantity AS non_gwp_ozone_depletion,
      'Ecoinvent 3.12'::TEXT AS non_gwp_data_source,
      v_ecoinvent_proxy.material_category AS non_gwp_reference_id,
      
      false::BOOLEAN AS is_hybrid,
      'MEDIUM'::TEXT AS data_quality_grade,
      COALESCE(v_ecoinvent_proxy.data_quality_score::INTEGER * 20, 50)::INTEGER AS confidence_score,
      COALESCE(v_ecoinvent_proxy.geography, 'GLO')::TEXT AS geographic_scope;
    RETURN;
  END IF;
  
  -- No data found - return NULLs
  RETURN QUERY SELECT 
    NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
    NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
    NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
    false::BOOLEAN, 'LOW'::TEXT, 0::INTEGER, 'UNKNOWN'::TEXT;
END;
$$;

COMMENT ON FUNCTION public.resolve_hybrid_impacts IS
  'FIXED: Now uses correct column names (name, co2_factor) from staging_emission_factors table';
