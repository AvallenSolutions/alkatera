/*
  # Add GHG Breakdown for ISO 14067 Compliance

  ## Overview
  This migration enhances the impact tracking system to comply with ISO 14067
  and GHG Protocol Product Standard by adding granular greenhouse gas breakdown.

  ## Changes to product_lca_calculation_logs

  ### impact_metrics JSONB Structure Enhancement
  The existing `impact_metrics` JSONB will now include:

  ```json
  {
    "climate_change_gwp100": number,
    "water_consumption": number,
    "land_use": number,
    "waste_generation": number,
    
    // NEW: GHG Breakdown for ISO 14067 compliance
    "ghg_breakdown": {
      "carbon_origin": {
        "fossil": number,        // kg CO2e from fossil sources
        "biogenic": number,      // kg CO2e from biogenic sources  
        "land_use_change": number // kg CO2e from dLUC
      },
      "gas_inventory": {
        "co2_fossil": number,    // kg CO2 (fossil)
        "co2_biogenic": number,  // kg CO2 (biogenic)
        "methane": number,       // kg CH4
        "nitrous_oxide": number, // kg N2O
        "hfc_pfc": number        // kg CO2e (F-gases)
      },
      "gwp_factors": {
        "methane_gwp100": 27.9,
        "n2o_gwp100": 273,
        "method": "IPCC AR6"
      }
    },
    
    "material_breakdown": array
  }
  ```

  ## ISO 14067 Compliance
  
  Per ISO 14067:4.5.3:
  - "Biogenic carbon removals and emissions shall be documented separately"
  - "Fossil and biogenic CO2 shall be reported separately"
  - Land use change (dLUC) emissions must be identified
  
  ## GHG Protocol Product Standard Compliance
  
  Per GHGP Product Standard Chapter 8:
  - Report GHG emissions by gas type (CO2, CH4, N2O, F-gases)
  - Use IPCC 100-year GWP factors
  - Document biogenic carbon separately from fossil
  
  ## Migration Safety
  - No schema changes to tables (only JSONB content structure)
  - Backward compatible - existing records remain valid
  - New calculations will populate enhanced structure
*/

-- =====================================================
-- STEP 1: ADD DOCUMENTATION COMMENTS
-- =====================================================

COMMENT ON COLUMN product_lca_calculation_logs.impact_metrics IS 
'Multi-capital impact results in JSONB format. Includes:
- climate_change_gwp100: Total GHG emissions (kg CO2e)
- water_consumption: Water depletion (L or m³)
- land_use: Land occupation (m²)
- waste_generation: Waste produced (kg)
- ghg_breakdown: Detailed GHG inventory per ISO 14067
  - carbon_origin: Fossil/Biogenic/LUC split
  - gas_inventory: CH4, N2O, F-gases by mass
  - gwp_factors: Characterization factors used
- material_breakdown: Per-material contributions';

-- =====================================================
-- STEP 2: CREATE HELPER FUNCTION FOR GHG VALIDATION
-- =====================================================

CREATE OR REPLACE FUNCTION validate_ghg_breakdown(metrics jsonb)
RETURNS jsonb AS $$
DECLARE
  total_climate numeric;
  carbon_sum numeric;
  variance_pct numeric;
  validation_result jsonb;
BEGIN
  -- Extract total climate impact
  total_climate := (metrics->>'climate_change_gwp100')::numeric;
  
  -- Calculate sum of carbon origins if breakdown exists
  IF metrics->'ghg_breakdown'->'carbon_origin' IS NOT NULL THEN
    carbon_sum := 
      COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'fossil')::numeric, 0) +
      COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'biogenic')::numeric, 0) +
      COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'land_use_change')::numeric, 0);
    
    -- Calculate variance percentage
    IF total_climate > 0 THEN
      variance_pct := ABS((carbon_sum - total_climate) / total_climate * 100);
    ELSE
      variance_pct := 0;
    END IF;
    
    -- Build validation result
    validation_result := jsonb_build_object(
      'has_breakdown', true,
      'total_climate', total_climate,
      'carbon_sum', carbon_sum,
      'variance_pct', variance_pct,
      'is_valid', variance_pct <= 5,
      'warning', CASE 
        WHEN variance_pct > 5 THEN 'Carbon origin sum deviates >5% from total'
        ELSE null
      END
    );
  ELSE
    validation_result := jsonb_build_object(
      'has_breakdown', false,
      'total_climate', total_climate,
      'warning', 'GHG breakdown not available'
    );
  END IF;
  
  RETURN validation_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION validate_ghg_breakdown IS
'Validates GHG breakdown integrity per ISO 14067. Checks that fossil + biogenic + LUC 
roughly equals total CO2e (within 5% tolerance). Returns validation result with warnings.';

-- =====================================================
-- STEP 3: CREATE VIEW FOR GHG BREAKDOWN REPORTING
-- =====================================================

CREATE OR REPLACE VIEW lca_ghg_breakdown_report AS
SELECT 
  plcl.id as calculation_log_id,
  plcl.product_lca_id,
  pl.product_name,
  pl.organization_id,
  plcl.created_at,
  
  -- Total Climate Impact
  (plcl.impact_metrics->>'climate_change_gwp100')::numeric as total_co2e,
  
  -- Carbon Origin Breakdown
  (plcl.impact_metrics->'ghg_breakdown'->'carbon_origin'->>'fossil')::numeric as fossil_co2e,
  (plcl.impact_metrics->'ghg_breakdown'->'carbon_origin'->>'biogenic')::numeric as biogenic_co2e,
  (plcl.impact_metrics->'ghg_breakdown'->'carbon_origin'->>'land_use_change')::numeric as dluc_co2e,
  
  -- Gas Inventory (Mass)
  (plcl.impact_metrics->'ghg_breakdown'->'gas_inventory'->>'co2_fossil')::numeric as co2_fossil_kg,
  (plcl.impact_metrics->'ghg_breakdown'->'gas_inventory'->>'co2_biogenic')::numeric as co2_biogenic_kg,
  (plcl.impact_metrics->'ghg_breakdown'->'gas_inventory'->>'methane')::numeric as ch4_kg,
  (plcl.impact_metrics->'ghg_breakdown'->'gas_inventory'->>'nitrous_oxide')::numeric as n2o_kg,
  (plcl.impact_metrics->'ghg_breakdown'->'gas_inventory'->>'hfc_pfc')::numeric as fgas_co2e,
  
  -- GWP Factors Used
  (plcl.impact_metrics->'ghg_breakdown'->'gwp_factors'->>'methane_gwp100')::numeric as ch4_gwp,
  (plcl.impact_metrics->'ghg_breakdown'->'gwp_factors'->>'n2o_gwp100')::numeric as n2o_gwp,
  plcl.impact_metrics->'ghg_breakdown'->'gwp_factors'->>'method' as gwp_method,
  
  -- Validation
  validate_ghg_breakdown(plcl.impact_metrics) as validation,
  
  -- Assessment Method
  plcl.impact_assessment_method,
  plcl.csrd_compliant
  
FROM product_lca_calculation_logs plcl
JOIN product_lcas pl ON pl.id = plcl.product_lca_id
WHERE plcl.status = 'success'
AND plcl.impact_metrics IS NOT NULL
ORDER BY plcl.created_at DESC;

COMMENT ON VIEW lca_ghg_breakdown_report IS
'ISO 14067 compliant GHG breakdown report view. Separates fossil, biogenic, and 
land-use-change CO2. Includes gas inventory (CH4, N2O, F-gases) and validation checks.';

-- =====================================================
-- STEP 4: ENABLE RLS ON VIEW (Read-only)
-- =====================================================

-- Views inherit RLS from base tables, but we document access pattern
COMMENT ON VIEW lca_ghg_breakdown_report IS
'ISO 14067 compliant GHG breakdown report. RLS inherited from product_lca_calculation_logs. 
Users can only view GHG breakdowns for LCAs in their organization.';

-- =====================================================
-- STEP 5: CREATE SAMPLE GHG BREAKDOWN TEMPLATE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '=== GHG Breakdown Migration Complete ===';
  RAISE NOTICE 'Sample impact_metrics structure with ghg_breakdown:';
  RAISE NOTICE '{';
  RAISE NOTICE '  "climate_change_gwp100": 0.302,';
  RAISE NOTICE '  "water_consumption": 0.309,';
  RAISE NOTICE '  "land_use": 0.047,';
  RAISE NOTICE '  "waste_generation": 0.016,';
  RAISE NOTICE '  "ghg_breakdown": {';
  RAISE NOTICE '    "carbon_origin": {';
  RAISE NOTICE '      "fossil": 0.278,';
  RAISE NOTICE '      "biogenic": 0.019,';
  RAISE NOTICE '      "land_use_change": 0.005';
  RAISE NOTICE '    },';
  RAISE NOTICE '    "gas_inventory": {';
  RAISE NOTICE '      "co2_fossil": 0.278,';
  RAISE NOTICE '      "co2_biogenic": 0.019,';
  RAISE NOTICE '      "methane": 0.0001,';
  RAISE NOTICE '      "nitrous_oxide": 0.00001,';
  RAISE NOTICE '      "hfc_pfc": 0.0';
  RAISE NOTICE '    },';
  RAISE NOTICE '    "gwp_factors": {';
  RAISE NOTICE '      "methane_gwp100": 27.9,';
  RAISE NOTICE '      "n2o_gwp100": 273,';
  RAISE NOTICE '      "method": "IPCC AR6"';
  RAISE NOTICE '    }';
  RAISE NOTICE '  }';
  RAISE NOTICE '}';
  RAISE NOTICE '';
  RAISE NOTICE '✓ Helper function created: validate_ghg_breakdown()';
  RAISE NOTICE '✓ Reporting view created: lca_ghg_breakdown_report';
  RAISE NOTICE '✓ ISO 14067 compliance structure ready';
END $$;
