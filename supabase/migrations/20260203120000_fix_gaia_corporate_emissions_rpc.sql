-- Migration: Fix calculate_gaia_corporate_emissions to use correct tables
-- Issues fixed:
-- 1. Scope 1/2: Was using facility_activity_data, now uses utility_data_entries (via facilities)
-- 2. Scope 3 Products: Was using product_lcas with non-existent product_id column,
--    now uses product_carbon_footprints

CREATE OR REPLACE FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
  v_co2e numeric;
BEGIN
  v_year_start := make_date(p_year, 1, 1);
  v_year_end := make_date(p_year, 12, 31);

  -- ============================================
  -- SCOPE 1 & 2: Read from utility_data_entries
  -- This matches what the Company Emissions page uses
  -- ============================================
  FOR rec IN
    SELECT
      ude.utility_type,
      ude.quantity,
      ude.unit,
      ude.calculated_scope
    FROM utility_data_entries ude
    JOIN facilities f ON f.id = ude.facility_id
    WHERE f.organization_id = p_organization_id
      AND ude.reporting_period_start >= v_year_start
      AND ude.reporting_period_end <= v_year_end
      AND ude.quantity > 0
  LOOP
    -- Calculate CO2e based on utility type
    -- Emission factors matching the frontend EMISSION_FACTORS constant
    v_co2e := 0;

    CASE rec.utility_type
      WHEN 'diesel_stationary' THEN v_co2e := rec.quantity * 2.68787;    -- kgCO2e/litre
      WHEN 'diesel_mobile' THEN v_co2e := rec.quantity * 2.68787;        -- kgCO2e/litre
      WHEN 'petrol_mobile' THEN v_co2e := rec.quantity * 2.31;           -- kgCO2e/litre
      WHEN 'natural_gas' THEN
        -- Handle unit conversion for natural gas (m³ to kWh)
        IF rec.unit = 'm³' THEN
          v_co2e := rec.quantity * 10.55 * 0.18293;  -- m³ → kWh → kgCO2e
        ELSE
          v_co2e := rec.quantity * 0.18293;          -- kgCO2e/kWh
        END IF;
      WHEN 'lpg' THEN v_co2e := rec.quantity * 1.55537;                  -- kgCO2e/litre
      WHEN 'heavy_fuel_oil' THEN v_co2e := rec.quantity * 3.17740;       -- kgCO2e/litre
      WHEN 'biomass_solid' THEN v_co2e := rec.quantity * 0.01551;        -- kgCO2e/kg
      WHEN 'refrigerant_leakage' THEN v_co2e := rec.quantity * 1430;     -- kgCO2e/kg (R134a GWP)
      WHEN 'electricity_grid' THEN v_co2e := rec.quantity * 0.207;       -- kgCO2e/kWh
      WHEN 'heat_steam_purchased' THEN v_co2e := rec.quantity * 0.1662;  -- kgCO2e/kWh
      ELSE v_co2e := 0;
    END CASE;

    -- Assign to appropriate scope
    IF rec.calculated_scope = 'Scope 1' THEN
      v_scope1 := v_scope1 + v_co2e;
      v_has_data := true;
    ELSIF rec.calculated_scope = 'Scope 2' THEN
      v_scope2 := v_scope2 + v_co2e;
      v_has_data := true;
    END IF;
  END LOOP;

  -- Also check legacy facility_activity_data if any exists
  FOR rec IN
    SELECT
      fad.quantity,
      ef.value::numeric as factor_value,
      ses.scope
    FROM facility_activity_data fad
    JOIN scope_1_2_emission_sources ses ON fad.emission_source_id = ses.id
    JOIN emissions_factors ef ON ses.emission_factor_id = ef.factor_id
    WHERE fad.organization_id = p_organization_id
      AND fad.reporting_period_start >= v_year_start
      AND fad.reporting_period_end <= v_year_end
      AND fad.quantity IS NOT NULL
      AND ef.value IS NOT NULL
  LOOP
    IF rec.scope = 'Scope 1' THEN
      v_scope1 := v_scope1 + (rec.quantity * rec.factor_value);
    ELSIF rec.scope = 'Scope 2' THEN
      v_scope2 := v_scope2 + (rec.quantity * rec.factor_value);
    END IF;
    v_has_data := true;
  END LOOP;

  -- Fleet activities for Scope 1 & 2
  FOR rec IN
    SELECT emissions_tco2e, scope
    FROM fleet_activities
    WHERE organization_id = p_organization_id
      AND scope IN ('Scope 1', 'Scope 2')
      AND reporting_period_start >= v_year_start
      AND reporting_period_end <= v_year_end
  LOOP
    IF rec.scope = 'Scope 1' THEN
      v_scope1 := v_scope1 + (COALESCE(rec.emissions_tco2e, 0) * 1000);  -- tCO2e → kgCO2e
    ELSE
      v_scope2 := v_scope2 + (COALESCE(rec.emissions_tco2e, 0) * 1000);
    END IF;
    v_has_data := true;
  END LOOP;

  -- ============================================
  -- SCOPE 3: Products from product_carbon_footprints (PEIs)
  -- ============================================
  FOR rec IN
    WITH latest_pcfs AS (
      SELECT DISTINCT ON (product_id)
        product_id,
        total_ghg_emissions,  -- This is per unit in kgCO2e
        (aggregated_impacts->'breakdown'->'by_scope'->>'scope3')::numeric as scope3_per_unit
      FROM product_carbon_footprints
      WHERE organization_id = p_organization_id
        AND status = 'completed'
      ORDER BY product_id, updated_at DESC
    )
    SELECT
      pl.units_produced,
      COALESCE(lp.scope3_per_unit, lp.total_ghg_emissions, 0) as scope3_per_unit
    FROM production_logs pl
    JOIN latest_pcfs lp ON lp.product_id = pl.product_id
    WHERE pl.organization_id = p_organization_id
      AND pl.date >= v_year_start
      AND pl.date <= v_year_end
      AND pl.units_produced > 0
  LOOP
    v_scope3_products := v_scope3_products + (rec.scope3_per_unit * rec.units_produced);
    v_has_data := true;
  END LOOP;

  -- ============================================
  -- SCOPE 3: Corporate Overheads
  -- ============================================
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

  -- Fleet activities for Scope 3 Cat 6 (Business Travel)
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

  -- ============================================
  -- Calculate totals (all values in kgCO2e)
  -- ============================================
  v_scope3_total := v_scope3_products + v_scope3_business_travel + v_scope3_purchased_services +
    v_scope3_employee_commuting + v_scope3_capital_goods + v_scope3_operational_waste +
    v_scope3_downstream_logistics + v_scope3_marketing_materials;

  v_total := v_scope1 + v_scope2 + v_scope3_total;

  -- Build result JSON (values in kgCO2e, frontend converts to tCO2e by dividing by 1000)
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

COMMENT ON FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) IS 'Authoritative corporate emissions calculation for Rosa AI assistant.
Reads from:
- utility_data_entries (primary) + facility_activity_data (legacy) for Scope 1 & 2
- fleet_activities for Scope 1, 2, and 3 Cat 6
- product_carbon_footprints + production_logs for Scope 3 products
- corporate_overheads for Scope 3 categories
Returns emissions breakdown by scope following GHG Protocol Corporate Standard.';
