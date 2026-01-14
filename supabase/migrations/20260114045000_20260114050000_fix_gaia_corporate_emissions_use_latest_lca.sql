/*
  # Fix Gaia Corporate Emissions - Use Latest LCA Only

  ## Issue
  The RPC function was summing ALL LCA versions for each product, causing
  massive over-counting. The frontend correctly uses only the LATEST completed
  LCA per product.

  ## Fix
  Use DISTINCT ON (product_id) with ORDER BY updated_at DESC to get only
  the most recent LCA for each product, matching the frontend behaviour.
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS calculate_gaia_corporate_emissions(uuid, int);

-- Create the corrected RPC function
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
  v_year_start := make_date(p_year, 1, 1);
  v_year_end := make_date(p_year, 12, 31);

  -- =========================================================================
  -- SCOPE 1: Direct emissions from owned/controlled sources
  -- =========================================================================
  
  FOR rec IN
    SELECT 
      fad.quantity,
      ef.value::numeric as factor_value
    FROM facility_activity_data fad
    JOIN scope_1_2_emission_sources ses ON fad.emission_source_id = ses.id
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

  FOR rec IN
    SELECT emissions_tco2e
    FROM fleet_activities
    WHERE organization_id = p_organization_id
      AND scope = 'Scope 1'
      AND reporting_period_start >= v_year_start
      AND reporting_period_end <= v_year_end
  LOOP
    v_scope1 := v_scope1 + (COALESCE(rec.emissions_tco2e, 0) * 1000);
    v_has_data := true;
  END LOOP;

  -- =========================================================================
  -- SCOPE 2: Indirect emissions from purchased energy
  -- =========================================================================
  
  FOR rec IN
    SELECT 
      fad.quantity,
      ef.value::numeric as factor_value
    FROM facility_activity_data fad
    JOIN scope_1_2_emission_sources ses ON fad.emission_source_id = ses.id
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
  -- SCOPE 3: Category 1 - Products (using LATEST LCA only per product)
  -- =========================================================================
  -- CRITICAL FIX: Use DISTINCT ON to get only the most recent LCA per product
  -- This matches the frontend behaviour exactly
  
  FOR rec IN
    WITH latest_lcas AS (
      SELECT DISTINCT ON (product_id)
        product_id,
        (aggregated_impacts->'breakdown'->'by_scope'->>'scope3')::numeric as scope3_per_unit
      FROM product_lcas
      WHERE organization_id = p_organization_id
        AND status = 'completed'
        AND aggregated_impacts->'breakdown'->'by_scope'->>'scope3' IS NOT NULL
      ORDER BY product_id, updated_at DESC
    )
    SELECT 
      pl.units_produced,
      ll.scope3_per_unit
    FROM production_logs pl
    JOIN latest_lcas ll ON ll.product_id = pl.product_id
    WHERE pl.organization_id = p_organization_id
      AND pl.date >= v_year_start
      AND pl.date <= v_year_end
      AND pl.units_produced > 0
  LOOP
    v_scope3_products := v_scope3_products + (COALESCE(rec.scope3_per_unit, 0) * rec.units_produced);
    v_has_data := true;
  END LOOP;

  -- =========================================================================
  -- SCOPE 3: Categories 2-8 - Corporate Overheads
  -- =========================================================================

  SELECT id INTO v_report_id
  FROM corporate_reports
  WHERE organization_id = p_organization_id
    AND year = p_year
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

  -- Grey Fleet (Scope 3 Cat 6)
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

  -- Calculate totals
  v_scope3_total := v_scope3_products + v_scope3_business_travel + v_scope3_purchased_services +
                    v_scope3_employee_commuting + v_scope3_capital_goods + v_scope3_operational_waste +
                    v_scope3_downstream_logistics + v_scope3_marketing_materials;

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

GRANT EXECUTE ON FUNCTION calculate_gaia_corporate_emissions(uuid, int) TO authenticated;

COMMENT ON FUNCTION calculate_gaia_corporate_emissions IS 
'Authoritative corporate emissions calculation for Gaia AI assistant. 
Uses DISTINCT ON to get only the latest LCA per product, matching frontend behaviour.
Returns complete scope breakdown following GHG Protocol.';
