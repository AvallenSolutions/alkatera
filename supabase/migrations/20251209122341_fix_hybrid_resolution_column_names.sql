/*
  # Fix Hybrid Resolution Function Column Names
  
  Corrects column names to match actual database schema:
  - staging_emission_factors.factor_name → name
  - staging_emission_factors.climate_factor → co2_factor
*/

CREATE OR REPLACE FUNCTION public.resolve_hybrid_impacts(
  p_material_name TEXT,
  p_category_type material_category_type,
  p_quantity NUMERIC DEFAULT 1.0,
  p_unit TEXT DEFAULT 'kg'
)
RETURNS TABLE (
  -- GWP from DEFRA
  gwp_climate_total NUMERIC,
  gwp_climate_fossil NUMERIC,
  gwp_climate_biogenic NUMERIC,
  gwp_data_source TEXT,
  gwp_reference_id TEXT,
  
  -- Non-GWP from Ecoinvent
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
  
  -- Metadata
  is_hybrid BOOLEAN,
  data_quality_grade TEXT,
  confidence_score INTEGER,
  geographic_scope TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_mapping RECORD;
  v_defra_factor RECORD;
  v_ecoinvent_proxy RECORD;
  v_is_hybrid BOOLEAN := false;
BEGIN
  -- Determine if this should use hybrid approach
  v_is_hybrid := p_category_type IN ('SCOPE_1_2_ENERGY', 'SCOPE_3_TRANSPORT', 'SCOPE_3_COMMUTING');
  
  IF v_is_hybrid THEN
    -- HYBRID APPROACH: DEFRA GWP + Ecoinvent non-GWP
    
    -- Find the mapping for this material
    SELECT * INTO v_mapping
    FROM public.defra_ecoinvent_impact_mappings
    WHERE LOWER(defra_factor_name) LIKE '%' || LOWER(p_material_name) || '%'
    ORDER BY confidence_score DESC
    LIMIT 1;
    
    IF v_mapping IS NULL THEN
      -- No mapping found, return nulls
      RETURN QUERY SELECT 
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
        false::BOOLEAN, 'LOW'::TEXT, 50::INTEGER, 'UNKNOWN'::TEXT;
      RETURN;
    END IF;
    
    -- Get DEFRA factor (for GWP) - use name column
    SELECT * INTO v_defra_factor
    FROM public.staging_emission_factors
    WHERE name = v_mapping.defra_factor_name
    LIMIT 1;
    
    -- Get Ecoinvent proxy (for non-GWP impacts)
    SELECT * INTO v_ecoinvent_proxy
    FROM public.ecoinvent_material_proxies
    WHERE material_category = v_mapping.ecoinvent_proxy_category
    LIMIT 1;
    
    -- Return hybrid data - use co2_factor column
    RETURN QUERY SELECT
      -- GWP from DEFRA
      COALESCE(v_defra_factor.co2_factor, 0) * p_quantity AS gwp_climate_total,
      COALESCE(v_defra_factor.co2_factor, 0) * p_quantity AS gwp_climate_fossil,
      0::NUMERIC AS gwp_climate_biogenic,
      'DEFRA 2025'::TEXT AS gwp_data_source,
      v_mapping.defra_factor_name AS gwp_reference_id,
      
      -- Non-GWP from Ecoinvent
      COALESCE(v_ecoinvent_proxy.impact_water, 0) * p_quantity AS non_gwp_water,
      COALESCE(v_ecoinvent_proxy.impact_land_use, 0) * p_quantity AS non_gwp_land,
      COALESCE(v_ecoinvent_proxy.impact_waste, 0) * p_quantity AS non_gwp_waste,
      COALESCE(v_ecoinvent_proxy.impact_terrestrial_acidification, 0) * p_quantity AS non_gwp_acidification,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_marine_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_marine,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_ecotoxicity, 0) * p_quantity AS non_gwp_ecotoxicity_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_ozone_depletion, 0) * p_quantity AS non_gwp_ozone_depletion,
      'Ecoinvent 3.12'::TEXT AS non_gwp_data_source,
      v_mapping.ecoinvent_proxy_category AS non_gwp_reference_id,
      
      -- Metadata
      true::BOOLEAN AS is_hybrid,
      'MEDIUM'::TEXT AS data_quality_grade,
      COALESCE(v_mapping.confidence_score, 80)::INTEGER AS confidence_score,
      COALESCE(v_mapping.geographic_alignment, 'UK')::TEXT AS geographic_scope;
    
  ELSE
    -- FULL ECOINVENT APPROACH: For manufacturing materials
    
    -- Get Ecoinvent proxy matching the material name
    SELECT * INTO v_ecoinvent_proxy
    FROM public.ecoinvent_material_proxies
    WHERE LOWER(material_name) LIKE '%' || LOWER(p_material_name) || '%'
    ORDER BY data_quality_score DESC
    LIMIT 1;
    
    IF v_ecoinvent_proxy IS NULL THEN
      -- Try staging factors as fallback - use name and co2_factor columns
      SELECT * INTO v_defra_factor
      FROM public.staging_emission_factors
      WHERE LOWER(name) LIKE '%' || LOWER(p_material_name) || '%'
      ORDER BY co2_factor DESC
      LIMIT 1;
      
      IF v_defra_factor IS NOT NULL THEN
        -- Return staging factor data
        RETURN QUERY SELECT
          COALESCE(v_defra_factor.co2_factor, 0) * p_quantity AS gwp_climate_total,
          COALESCE(v_defra_factor.co2_factor, 0) * p_quantity AS gwp_climate_fossil,
          0::NUMERIC AS gwp_climate_biogenic,
          'Staging Factors'::TEXT AS gwp_data_source,
          v_defra_factor.name AS gwp_reference_id,
          
          COALESCE(v_defra_factor.water_factor, 0) * p_quantity AS non_gwp_water,
          COALESCE(v_defra_factor.land_factor, 0) * p_quantity AS non_gwp_land,
          COALESCE(v_defra_factor.waste_factor, 0) * p_quantity AS non_gwp_waste,
          0::NUMERIC AS non_gwp_acidification,
          0::NUMERIC AS non_gwp_eutrophication_freshwater,
          0::NUMERIC AS non_gwp_eutrophication_marine,
          0::NUMERIC AS non_gwp_ecotoxicity_freshwater,
          0::NUMERIC AS non_gwp_ozone_depletion,
          'Staging Factors'::TEXT AS non_gwp_data_source,
          v_defra_factor.name AS non_gwp_reference_id,
          
          false::BOOLEAN AS is_hybrid,
          'LOW'::TEXT AS data_quality_grade,
          70::INTEGER AS confidence_score,
          COALESCE(v_defra_factor.geographic_scope, 'GLO')::TEXT AS geographic_scope;
        RETURN;
      END IF;
      
      -- No data found
      RETURN QUERY SELECT 
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
        NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
        false::BOOLEAN, 'LOW'::TEXT, 50::INTEGER, 'UNKNOWN'::TEXT;
      RETURN;
    END IF;
    
    -- Return full Ecoinvent data
    RETURN QUERY SELECT
      -- GWP from Ecoinvent
      COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity AS gwp_climate_total,
      COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity AS gwp_climate_fossil,
      0::NUMERIC AS gwp_climate_biogenic,
      'Ecoinvent 3.12'::TEXT AS gwp_data_source,
      v_ecoinvent_proxy.material_category AS gwp_reference_id,
      
      -- Non-GWP from Ecoinvent
      COALESCE(v_ecoinvent_proxy.impact_water, 0) * p_quantity AS non_gwp_water,
      COALESCE(v_ecoinvent_proxy.impact_land_use, 0) * p_quantity AS non_gwp_land,
      COALESCE(v_ecoinvent_proxy.impact_waste, 0) * p_quantity AS non_gwp_waste,
      COALESCE(v_ecoinvent_proxy.impact_terrestrial_acidification, 0) * p_quantity AS non_gwp_acidification,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_marine_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_marine,
      COALESCE(v_ecoinvent_proxy.impact_freshwater_ecotoxicity, 0) * p_quantity AS non_gwp_ecotoxicity_freshwater,
      COALESCE(v_ecoinvent_proxy.impact_ozone_depletion, 0) * p_quantity AS non_gwp_ozone_depletion,
      'Ecoinvent 3.12'::TEXT AS non_gwp_data_source,
      v_ecoinvent_proxy.material_category AS non_gwp_reference_id,
      
      -- Metadata
      false::BOOLEAN AS is_hybrid,
      'MEDIUM'::TEXT AS data_quality_grade,
      COALESCE(v_ecoinvent_proxy.data_quality_score::INTEGER * 20, 70)::INTEGER AS confidence_score,
      COALESCE(v_ecoinvent_proxy.geographic_scope, 'GLO')::TEXT AS geographic_scope;
    
  END IF;
END;
$$;
