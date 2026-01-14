/*
  # Create Gaia Authoritative Emissions RPC Function

  ## Purpose
  Provides a database-level function that calculates corporate emissions using
  the authoritative methodology, mirroring the TypeScript `calculateCorporateEmissions()` 
  function. This ensures Gaia always reports accurate, consistent figures.

  ## Key Features
  1. Calculates Scope 1, 2, and 3 emissions following GHG Protocol
  2. Avoids double-counting by extracting only Scope 3 portion from product LCAs
  3. Returns complete breakdown with all Scope 3 categories
  4. Includes data quality indicators

  ## Standards Compliance
  - GHG Protocol Corporate Standard
  - ISO 14064-1
  - No double counting between scopes

  ## New Functions
  1. `calculate_gaia_corporate_emissions(p_organization_id uuid, p_year int)` 
     - Returns JSONB with complete scope breakdown
*/

-- Create the main RPC function for Gaia to use
CREATE OR REPLACE FUNCTION calculate_gaia_corporate_emissions(
  p_organization_id uuid,
  p_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year_start date;
  v_year_end date;
  v_scope1 numeric := 0;
  v_scope2 numeric := 0;
  v_scope3_products numeric := 0;
  v_scope3_business_travel numeric := 0;
  v_scope3_purchased_services numeric := 0;
  v_scope3_employee_commuting numeric := 0;
  v_scope3_capital_goods numeric := 0;
  v_scope3_operational_waste numeric := 0;
  v_scope3_downstream_logistics numeric := 0;
  v_scope3_marketing_materials numeric := 0;
  v_scope3_total numeric := 0;
  v_total numeric := 0;
  v_has_data boolean := false;
  v_report_id uuid;
  v_result jsonb;
  rec RECORD;
BEGIN
  -- Set year boundaries
  v_year_start := make_date(p_year, 1, 1);
  v_year_end := make_date(p_year, 12, 31);

  -- =========================================================================
  -- SCOPE 1: Direct emissions from owned/controlled sources
  -- =========================================================================
  
  -- 1a. Facility activity data with Scope 1 emission sources
  FOR rec IN
    SELECT 
      fad.quantity,
      ef.value::numeric as factor_value
    FROM facility_activity_data fad
    JOIN scope_1_2_emission_sources ses ON fad.source_id = ses.id
    JOIN emissions_factors ef ON ses.emission_factor_id = ef.factor_id
    WHERE fad.organization_id = p_organization_id
      AND ses.scope = 'Scope 1'
      AND fad.reporting_period_start >= v_year_start
      AND fad.reporting_period_end <= v_year_end
      AND fad.quantity IS NOT NULL
      AND ef.value IS NOT NULL
  LOOP
    v_scope1 := v_scope1 + (rec.quantity * rec.factor_value);
    v_has_data := true;
  END LOOP;

  -- 1b. Fleet activities - Scope 1 (company-owned combustion vehicles)
  SELECT COALESCE(SUM(emissions_tco2e * 1000), 0) INTO v_scope1
  FROM (
    SELECT v_scope1 as base
    UNION ALL
    SELECT emissions_tco2e * 1000
    FROM fleet_activities
    WHERE organization_id = p_organization_id
      AND scope = 'Scope 1'
      AND reporting_period_start >= v_year_start
      AND reporting_period_end <= v_year_end
  ) combined;

  IF v_scope1 > 0 THEN
    v_has_data := true;
  END IF;

  -- =========================================================================
  -- SCOPE 2: Indirect emissions from purchased energy
  -- =========================================================================
  
  -- 2a. Facility activity data with Scope 2 emission sources
  FOR rec IN
    SELECT 
      fad.quantity,
      ef.value::numeric as factor_value
    FROM facility_activity_data fad
    JOIN scope_1_2_emission_sources ses ON fad.source_id = ses.id
    JOIN emissions_factors ef ON ses.emission_factor_id = ef.factor_id
    WHERE fad.organization_id = p_organization_id
      AND ses.scope = 'Scope 2'
      AND fad.reporting_period_start >= v_year_start
      AND fad.reporting_period_end <= v_year_end
      AND fad.quantity IS NOT NULL
      AND ef.value IS NOT NULL
  LOOP
    v_scope2 := v_scope2 + (rec.quantity * rec.factor_value);
    v_has_data := true;
  END LOOP;

  -- 2b. Fleet activities - Scope 2 (company-owned electric vehicles)
  FOR rec IN
    SELECT emissions_tco2e
    FROM fleet_activities
    WHERE organization_id = p_organization_id
      AND scope = 'Scope 2'
      AND reporting_period_start >= v_year_start
      AND reporting_period_end <= v_year_end
  LOOP
    v_scope2 := v_scope2 + (COALESCE(rec.emissions_tco2e, 0) * 1000);
    v_has_data := true;
  END LOOP;

  -- =========================================================================
  -- SCOPE 3: All other indirect emissions
  -- =========================================================================

  -- 3a. Category 1: Purchased Goods (Products)
  -- CRITICAL: Use aggregated_impacts.breakdown.by_scope.scope3 to avoid double counting
  -- This excludes owned facility Scope 1 & 2 which are already in corporate inventory
  FOR rec IN
    SELECT 
      pl.units_produced,
      (lca.aggregated_impacts->'breakdown'->'by_scope'->>'scope3')::numeric as scope3_per_unit
    FROM production_logs pl
    JOIN product_lcas lca ON pl.product_id = lca.product_id
    WHERE pl.organization_id = p_organization_id
      AND pl.date >= v_year_start
      AND pl.date <= v_year_end
      AND pl.units_produced > 0
      AND lca.status = 'completed'
      AND lca.aggregated_impacts->'breakdown'->'by_scope'->>'scope3' IS NOT NULL
  LOOP
    v_scope3_products := v_scope3_products + (COALESCE(rec.scope3_per_unit, 0) * rec.units_produced);
    v_has_data := true;
  END LOOP;

  -- 3b. Categories 2-8: Corporate Overheads
  SELECT id INTO v_report_id
  FROM corporate_reports
  WHERE organization_id = p_organization_id
    AND reporting_year = p_year
  LIMIT 1;

  IF v_report_id IS NOT NULL THEN
    FOR rec IN
      SELECT category, computed_co2e, material_type
      FROM corporate_overheads
      WHERE report_id = v_report_id
    LOOP
      v_has_data := true;
      
      CASE rec.category
        WHEN 'business_travel' THEN
          v_scope3_business_travel := v_scope3_business_travel + COALESCE(rec.computed_co2e, 0);
        WHEN 'employee_commuting' THEN
          v_scope3_employee_commuting := v_scope3_employee_commuting + COALESCE(rec.computed_co2e, 0);
        WHEN 'capital_goods' THEN
          v_scope3_capital_goods := v_scope3_capital_goods + COALESCE(rec.computed_co2e, 0);
        WHEN 'operational_waste' THEN
          v_scope3_operational_waste := v_scope3_operational_waste + COALESCE(rec.computed_co2e, 0);
        WHEN 'downstream_logistics' THEN
          v_scope3_downstream_logistics := v_scope3_downstream_logistics + COALESCE(rec.computed_co2e, 0);
        WHEN 'purchased_services' THEN
          IF rec.material_type IS NOT NULL THEN
            v_scope3_marketing_materials := v_scope3_marketing_materials + COALESCE(rec.computed_co2e, 0);
          ELSE
            v_scope3_purchased_services := v_scope3_purchased_services + COALESCE(rec.computed_co2e, 0);
          END IF;
        ELSE
          v_scope3_purchased_services := v_scope3_purchased_services + COALESCE(rec.computed_co2e, 0);
      END CASE;
    END LOOP;
  END IF;

  -- 3c. Category 6 Addition: Grey Fleet (Scope 3 Cat 6)
  FOR rec IN
    SELECT emissions_tco2e
    FROM fleet_activities
    WHERE organization_id = p_organization_id
      AND scope = 'Scope 3 Cat 6'
      AND reporting_period_start >= v_year_start
      AND reporting_period_end <= v_year_end
  LOOP
    v_scope3_business_travel := v_scope3_business_travel + (COALESCE(rec.emissions_tco2e, 0) * 1000);
    v_has_data := true;
  END LOOP;

  -- Calculate Scope 3 total
  v_scope3_total := v_scope3_products + v_scope3_business_travel + v_scope3_purchased_services +
                    v_scope3_employee_commuting + v_scope3_capital_goods + v_scope3_operational_waste +
                    v_scope3_downstream_logistics + v_scope3_marketing_materials;

  -- Calculate overall total
  v_total := v_scope1 + v_scope2 + v_scope3_total;

  -- Build result JSON
  v_result := jsonb_build_object(
    'year', p_year,
    'breakdown', jsonb_build_object(
      'scope1', ROUND(v_scope1, 2),
      'scope2', ROUND(v_scope2, 2),
      'scope3', jsonb_build_object(
        'products', ROUND(v_scope3_products, 2),
        'business_travel', ROUND(v_scope3_business_travel, 2),
        'purchased_services', ROUND(v_scope3_purchased_services, 2),
        'employee_commuting', ROUND(v_scope3_employee_commuting, 2),
        'capital_goods', ROUND(v_scope3_capital_goods, 2),
        'operational_waste', ROUND(v_scope3_operational_waste, 2),
        'downstream_logistics', ROUND(v_scope3_downstream_logistics, 2),
        'marketing_materials', ROUND(v_scope3_marketing_materials, 2),
        'logistics', ROUND(v_scope3_downstream_logistics, 2),
        'waste', ROUND(v_scope3_operational_waste, 2),
        'marketing', ROUND(v_scope3_marketing_materials, 2),
        'total', ROUND(v_scope3_total, 2)
      ),
      'total', ROUND(v_total, 2)
    ),
    'has_data', v_has_data,
    'calculation_date', NOW(),
    'methodology', 'GHG Protocol Corporate Standard',
    'data_source', 'calculate_gaia_corporate_emissions'
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION calculate_gaia_corporate_emissions(uuid, int) TO authenticated;

-- Add comment documenting the function
COMMENT ON FUNCTION calculate_gaia_corporate_emissions IS 
'Authoritative corporate emissions calculation for Gaia AI assistant. 
Returns complete scope breakdown following GHG Protocol.
Avoids double-counting by using only Scope 3 portion from product LCAs.';
