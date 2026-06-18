-- Rosa AI Comprehensive Query RPCs
-- These functions give Rosa access to all platform data with filtering capabilities
-- Version: 1.0.0
-- Date: 2026-02-03

-- ============================================================================
-- 1. EMISSIONS BY PERIOD
-- Answers: "What were our emissions from corporate travel in April 2025?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_emissions_by_period(
  p_organization_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_category text DEFAULT NULL,  -- 'business_travel', 'employee_commuting', etc.
  p_scope text DEFAULT NULL      -- 'scope1', 'scope2', 'scope3'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_utility_emissions jsonb;
  v_fleet_emissions jsonb;
  v_overhead_emissions jsonb;
  v_start date;
  v_end date;
BEGIN
  -- Default to current year if no dates provided
  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  -- Get utility-based emissions (Scope 1 & 2) from facilities
  SELECT jsonb_build_object(
    'scope1', COALESCE(SUM(CASE WHEN ude.calculated_scope = 'Scope 1' THEN
      ude.quantity * CASE
        WHEN ude.utility_type = 'natural_gas' THEN 2.02
        WHEN ude.utility_type = 'diesel_stationary' THEN 2.68
        WHEN ude.utility_type = 'lpg' THEN 1.51
        WHEN ude.utility_type = 'diesel_mobile' THEN 2.68
        WHEN ude.utility_type = 'petrol_mobile' THEN 2.31
        ELSE 0
      END ELSE 0 END), 0),
    'scope2', COALESCE(SUM(CASE WHEN ude.calculated_scope = 'Scope 2' THEN
      ude.quantity * CASE
        WHEN ude.utility_type = 'electricity_grid' THEN 0.207
        WHEN ude.utility_type = 'heat_steam_purchased' THEN 0.17
        ELSE 0
      END ELSE 0 END), 0),
    'by_utility_type', jsonb_agg(DISTINCT jsonb_build_object(
      'utility_type', ude.utility_type,
      'scope', ude.calculated_scope,
      'quantity', ude.quantity,
      'unit', ude.unit,
      'period_start', ude.reporting_period_start,
      'period_end', ude.reporting_period_end
    )),
    'by_facility', (
      SELECT jsonb_agg(jsonb_build_object(
        'facility_name', f.name,
        'facility_id', f.id,
        'total_kg_co2e', sub.total_emissions
      ))
      FROM (
        SELECT ude2.facility_id, SUM(ude2.quantity *
          CASE
            WHEN ude2.utility_type = 'natural_gas' THEN 2.02
            WHEN ude2.utility_type = 'electricity_grid' THEN 0.207
            WHEN ude2.utility_type = 'diesel_stationary' THEN 2.68
            ELSE 0.5
          END) as total_emissions
        FROM utility_data_entries ude2
        JOIN facilities f2 ON f2.id = ude2.facility_id
        WHERE f2.organization_id = p_organization_id
          AND ude2.reporting_period_start >= v_start
          AND ude2.reporting_period_end <= v_end
        GROUP BY ude2.facility_id
      ) sub
      JOIN facilities f ON f.id = sub.facility_id
    )
  ) INTO v_utility_emissions
  FROM utility_data_entries ude
  JOIN facilities f ON f.id = ude.facility_id
  WHERE f.organization_id = p_organization_id
    AND ude.reporting_period_start >= v_start
    AND ude.reporting_period_end <= v_end
    AND (p_scope IS NULL OR ude.calculated_scope =
      CASE p_scope
        WHEN 'scope1' THEN 'Scope 1'
        WHEN 'scope2' THEN 'Scope 2'
        ELSE ude.calculated_scope
      END);

  -- Get fleet emissions
  SELECT jsonb_build_object(
    'total_tco2e', COALESCE(SUM(fa.emissions_tco2e), 0),
    'total_distance_km', COALESCE(SUM(fa.distance_km), 0),
    'by_vehicle_type', jsonb_agg(DISTINCT jsonb_build_object(
      'vehicle_type', v.vehicle_type,
      'fuel_type', v.fuel_type,
      'emissions_tco2e', fa.emissions_tco2e,
      'distance_km', fa.distance_km
    )),
    'by_scope', jsonb_build_object(
      'scope1', COALESCE(SUM(CASE WHEN fa.scope = 'Scope 1' THEN fa.emissions_tco2e ELSE 0 END), 0),
      'scope3', COALESCE(SUM(CASE WHEN fa.scope = 'Scope 3' THEN fa.emissions_tco2e ELSE 0 END), 0)
    )
  ) INTO v_fleet_emissions
  FROM fleet_activities fa
  JOIN fleet_vehicles v ON v.id = fa.vehicle_id
  WHERE v.organization_id = p_organization_id
    AND fa.activity_date >= v_start
    AND fa.activity_date <= v_end
    AND (p_scope IS NULL OR fa.scope =
      CASE p_scope
        WHEN 'scope1' THEN 'Scope 1'
        WHEN 'scope3' THEN 'Scope 3'
        ELSE fa.scope
      END);

  -- Get corporate overhead emissions (Scope 3)
  SELECT jsonb_build_object(
    'total_kg_co2e', COALESCE(SUM(co.computed_co2e), 0),
    'total_spend', COALESCE(SUM(co.spend_amount), 0),
    'by_category', jsonb_agg(jsonb_build_object(
      'category', co.category,
      'kg_co2e', co.computed_co2e,
      'spend_amount', co.spend_amount,
      'currency', co.currency,
      'description', co.description,
      'entry_date', co.entry_date
    )),
    'category_totals', (
      SELECT jsonb_object_agg(category, total_co2e)
      FROM (
        SELECT co2.category, SUM(co2.computed_co2e) as total_co2e
        FROM corporate_overheads co2
        JOIN corporate_reports cr2 ON cr2.id = co2.report_id
        WHERE cr2.organization_id = p_organization_id
          AND co2.entry_date >= v_start
          AND co2.entry_date <= v_end
          AND (p_category IS NULL OR co2.category = p_category)
        GROUP BY co2.category
      ) cat_totals
    )
  ) INTO v_overhead_emissions
  FROM corporate_overheads co
  JOIN corporate_reports cr ON cr.id = co.report_id
  WHERE cr.organization_id = p_organization_id
    AND co.entry_date >= v_start
    AND co.entry_date <= v_end
    AND (p_category IS NULL OR co.category = p_category)
    AND (p_scope IS NULL OR p_scope = 'scope3');

  -- Build final result
  v_result := jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', v_start,
      'end_date', v_end
    ),
    'filters_applied', jsonb_build_object(
      'category', p_category,
      'scope', p_scope
    ),
    'facility_emissions', COALESCE(v_utility_emissions, '{}'::jsonb),
    'fleet_emissions', COALESCE(v_fleet_emissions, '{}'::jsonb),
    'overhead_emissions', COALESCE(v_overhead_emissions, '{}'::jsonb),
    'summary', jsonb_build_object(
      'scope1_kg_co2e', COALESCE((v_utility_emissions->>'scope1')::numeric, 0) +
                        COALESCE((v_fleet_emissions->'by_scope'->>'scope1')::numeric * 1000, 0),
      'scope2_kg_co2e', COALESCE((v_utility_emissions->>'scope2')::numeric, 0),
      'scope3_kg_co2e', COALESCE((v_overhead_emissions->>'total_kg_co2e')::numeric, 0) +
                        COALESCE((v_fleet_emissions->'by_scope'->>'scope3')::numeric * 1000, 0)
    )
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.rosa_get_emissions_by_period IS 'Rosa AI: Query emissions data with date range and category/scope filtering';


-- ============================================================================
-- 2. FACILITY METRICS
-- Answers: "Which facility uses the most electricity?", "Facility efficiency?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_facility_metrics(
  p_organization_id uuid,
  p_facility_id uuid DEFAULT NULL,
  p_metric_type text DEFAULT NULL,  -- 'electricity', 'gas', 'water', 'emissions'
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_start date;
  v_end date;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', v_start, 'end_date', v_end),
    'facilities', (
      SELECT jsonb_agg(jsonb_build_object(
        'facility_id', f.id,
        'facility_name', f.name,
        'facility_type', f.facility_type,
        'location', jsonb_build_object(
          'country', f.country,
          'city', f.city,
          'address', f.address_line_1
        ),
        'electricity', (
          SELECT jsonb_build_object(
            'total_kwh', COALESCE(SUM(quantity), 0),
            'emissions_kg_co2e', COALESCE(SUM(quantity * 0.207), 0)
          )
          FROM utility_data_entries
          WHERE facility_id = f.id
            AND utility_type = 'electricity_grid'
            AND reporting_period_start >= v_start
            AND reporting_period_end <= v_end
        ),
        'natural_gas', (
          SELECT jsonb_build_object(
            'total_kwh', COALESCE(SUM(quantity), 0),
            'emissions_kg_co2e', COALESCE(SUM(quantity * 2.02), 0)
          )
          FROM utility_data_entries
          WHERE facility_id = f.id
            AND utility_type = 'natural_gas'
            AND reporting_period_start >= v_start
            AND reporting_period_end <= v_end
        ),
        'water', (
          SELECT jsonb_build_object(
            'total_consumption_m3', COALESCE(SUM(total_consumption_m3), 0),
            'municipal_m3', COALESCE(SUM(municipal_consumption_m3), 0),
            'recycled_m3', COALESCE(SUM(recycled_consumption_m3), 0),
            'discharge_m3', COALESCE(SUM(total_discharge_m3), 0),
            'net_consumption_m3', COALESCE(SUM(net_consumption_m3), 0),
            'recycling_rate_avg', COALESCE(AVG(recycling_rate), 0)
          )
          FROM facility_water_data
          WHERE facility_id = f.id
            AND organization_id = p_organization_id
            AND reporting_period_start >= v_start
            AND reporting_period_end <= v_end
        ),
        'total_emissions', (
          SELECT jsonb_build_object(
            'scope1_kg_co2e', COALESCE(SUM(CASE WHEN calculated_scope = 'Scope 1' THEN
              quantity * CASE utility_type
                WHEN 'natural_gas' THEN 2.02
                WHEN 'diesel_stationary' THEN 2.68
                WHEN 'lpg' THEN 1.51
                ELSE 0
              END ELSE 0 END), 0),
            'scope2_kg_co2e', COALESCE(SUM(CASE WHEN calculated_scope = 'Scope 2' THEN
              quantity * CASE utility_type
                WHEN 'electricity_grid' THEN 0.207
                WHEN 'heat_steam_purchased' THEN 0.17
                ELSE 0
              END ELSE 0 END), 0)
          )
          FROM utility_data_entries
          WHERE facility_id = f.id
            AND reporting_period_start >= v_start
            AND reporting_period_end <= v_end
        )
      ))
      FROM facilities f
      WHERE f.organization_id = p_organization_id
        AND (p_facility_id IS NULL OR f.id = p_facility_id)
    ),
    'rankings', jsonb_build_object(
      'by_electricity', (
        SELECT jsonb_agg(jsonb_build_object(
          'facility_name', f.name,
          'total_kwh', sub.total_kwh,
          'rank', row_number() OVER (ORDER BY sub.total_kwh DESC)
        ))
        FROM (
          SELECT ude.facility_id, SUM(ude.quantity) as total_kwh
          FROM utility_data_entries ude
          JOIN facilities f ON f.id = ude.facility_id
          WHERE f.organization_id = p_organization_id
            AND ude.utility_type = 'electricity_grid'
            AND ude.reporting_period_start >= v_start
            AND ude.reporting_period_end <= v_end
          GROUP BY ude.facility_id
        ) sub
        JOIN facilities f ON f.id = sub.facility_id
      ),
      'by_water', (
        SELECT jsonb_agg(jsonb_build_object(
          'facility_name', f.name,
          'total_m3', sub.total_m3,
          'rank', row_number() OVER (ORDER BY sub.total_m3 DESC)
        ))
        FROM (
          SELECT fwd.facility_id, SUM(fwd.total_consumption_m3) as total_m3
          FROM facility_water_data fwd
          WHERE fwd.organization_id = p_organization_id
            AND fwd.reporting_period_start >= v_start
            AND fwd.reporting_period_end <= v_end
          GROUP BY fwd.facility_id
        ) sub
        JOIN facilities f ON f.id = sub.facility_id
      )
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_facility_metrics IS 'Rosa AI: Query facility-level metrics including utilities, water, and emissions';


-- ============================================================================
-- 3. PRODUCT FOOTPRINT DETAIL
-- Answers: "What's the carbon breakdown for London Dry Gin?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_product_footprint_detail(
  p_organization_id uuid,
  p_product_id uuid DEFAULT NULL,
  p_product_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'products', (
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', p.id,
        'product_name', p.name,
        'sku', p.sku,
        'category', p.category,
        'subcategory', p.subcategory,
        'has_lca', p.has_lca,
        'lca_status', pcf.status,
        'system_boundary', pcf.system_boundary,
        'functional_unit', jsonb_build_object(
          'type', pcf.functional_unit_type,
          'measure', pcf.functional_unit_measure,
          'value', pcf.functional_unit_value
        ),
        'total_ghg_emissions_kg_co2e', pcf.total_ghg_emissions,
        'aggregated_impacts', pcf.aggregated_impacts,
        'scope_breakdown', CASE
          WHEN pcf.aggregated_impacts IS NOT NULL THEN
            pcf.aggregated_impacts->'breakdown'->'by_scope'
          ELSE NULL
        END,
        'lifecycle_breakdown', CASE
          WHEN pcf.aggregated_impacts IS NOT NULL THEN
            pcf.aggregated_impacts->'breakdown'->'by_lifecycle_stage'
          ELSE NULL
        END,
        'materials', (
          SELECT jsonb_agg(jsonb_build_object(
            'material_name', pcfm.component_name,
            'material_type', pcfm.component_type,
            'quantity', pcfm.quantity,
            'unit', pcfm.unit,
            'gwp_kg_co2e', pcfm.gwp_kg_co2e,
            'water_scarcity_m3', pcfm.water_scarcity_m3,
            'land_use_m2a', pcfm.land_use_m2a
          ))
          FROM product_carbon_footprint_materials pcfm
          WHERE pcfm.product_carbon_footprint_id = pcf.id
        ),
        'production_volume', (
          SELECT jsonb_build_object(
            'total_units', COALESCE(SUM(pl.units_produced), 0),
            'total_scope3_tco2e', COALESCE(SUM(pl.units_produced) * pcf.total_ghg_emissions / 1000, 0)
          )
          FROM production_logs pl
          WHERE pl.product_id = p.id
            AND pl.organization_id = p_organization_id
        ),
        'last_updated', pcf.updated_at
      ))
      FROM products p
      LEFT JOIN product_carbon_footprints pcf ON pcf.product_id = p.id
      WHERE p.organization_id = p_organization_id
        AND (p_product_id IS NULL OR p.id = p_product_id)
        AND (p_product_name IS NULL OR p.name ILIKE '%' || p_product_name || '%')
    ),
    'summary', (
      SELECT jsonb_build_object(
        'total_products', COUNT(*),
        'products_with_lca', COUNT(*) FILTER (WHERE has_lca = true),
        'products_without_lca', COUNT(*) FILTER (WHERE has_lca = false OR has_lca IS NULL)
      )
      FROM products
      WHERE organization_id = p_organization_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_product_footprint_detail IS 'Rosa AI: Query detailed product carbon footprint including materials and lifecycle breakdown';


-- ============================================================================
-- 4. WATER METRICS
-- Answers: "Total water usage?", "Water by source?", "Water stress areas?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_water_metrics(
  p_organization_id uuid,
  p_facility_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_start date;
  v_end date;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', v_start, 'end_date', v_end),
    'totals', (
      SELECT jsonb_build_object(
        'total_consumption_m3', COALESCE(SUM(total_consumption_m3), 0),
        'municipal_m3', COALESCE(SUM(municipal_consumption_m3), 0),
        'groundwater_m3', COALESCE(SUM(groundwater_consumption_m3), 0),
        'surface_water_m3', COALESCE(SUM(surface_water_consumption_m3), 0),
        'rainwater_m3', COALESCE(SUM(rainwater_consumption_m3), 0),
        'recycled_m3', COALESCE(SUM(recycled_consumption_m3), 0),
        'total_discharge_m3', COALESCE(SUM(total_discharge_m3), 0),
        'net_consumption_m3', COALESCE(SUM(net_consumption_m3), 0),
        'avg_recycling_rate', COALESCE(AVG(recycling_rate), 0),
        'scarcity_weighted_m3', COALESCE(SUM(scarcity_weighted_consumption_m3), 0)
      )
      FROM facility_water_data
      WHERE organization_id = p_organization_id
        AND (p_facility_id IS NULL OR facility_id = p_facility_id)
        AND reporting_period_start >= v_start
        AND reporting_period_end <= v_end
    ),
    'by_facility', (
      SELECT jsonb_agg(jsonb_build_object(
        'facility_name', f.name,
        'facility_id', f.id,
        'total_consumption_m3', sub.total_m3,
        'recycled_m3', sub.recycled_m3,
        'recycling_rate', sub.avg_recycling,
        'water_intensity', sub.avg_intensity,
        'risk_level', sub.risk_level
      ))
      FROM (
        SELECT
          fwd.facility_id,
          SUM(fwd.total_consumption_m3) as total_m3,
          SUM(fwd.recycled_consumption_m3) as recycled_m3,
          AVG(fwd.recycling_rate) as avg_recycling,
          AVG(fwd.water_intensity_m3_per_unit) as avg_intensity,
          MAX(fwd.risk_level) as risk_level
        FROM facility_water_data fwd
        WHERE fwd.organization_id = p_organization_id
          AND (p_facility_id IS NULL OR fwd.facility_id = p_facility_id)
          AND fwd.reporting_period_start >= v_start
          AND fwd.reporting_period_end <= v_end
        GROUP BY fwd.facility_id
      ) sub
      JOIN facilities f ON f.id = sub.facility_id
    ),
    'by_month', (
      SELECT jsonb_agg(jsonb_build_object(
        'year', reporting_year,
        'month', reporting_month,
        'consumption_m3', SUM(total_consumption_m3),
        'discharge_m3', SUM(total_discharge_m3)
      ))
      FROM facility_water_data
      WHERE organization_id = p_organization_id
        AND (p_facility_id IS NULL OR facility_id = p_facility_id)
        AND reporting_period_start >= v_start
        AND reporting_period_end <= v_end
      GROUP BY reporting_year, reporting_month
      ORDER BY reporting_year, reporting_month
    ),
    'water_stress_summary', (
      SELECT jsonb_build_object(
        'high_stress_facilities', COUNT(*) FILTER (WHERE risk_level = 'high'),
        'medium_stress_facilities', COUNT(*) FILTER (WHERE risk_level = 'medium'),
        'low_stress_facilities', COUNT(*) FILTER (WHERE risk_level = 'low')
      )
      FROM (
        SELECT DISTINCT ON (facility_id) facility_id, risk_level
        FROM facility_water_data
        WHERE organization_id = p_organization_id
        ORDER BY facility_id, reporting_period_end DESC
      ) latest
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_water_metrics IS 'Rosa AI: Query water consumption, discharge, and stress metrics';


-- ============================================================================
-- 5. WASTE & CIRCULARITY METRICS
-- Answers: "Waste diversion rate?", "Recycling breakdown?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_waste_metrics(
  p_organization_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_start date;
  v_end date;
BEGIN
  v_start := COALESCE(p_start_date, date_trunc('year', CURRENT_DATE)::date);
  v_end := COALESCE(p_end_date, CURRENT_DATE);

  -- Get waste data from corporate_overheads (operational_waste category)
  SELECT jsonb_build_object(
    'period', jsonb_build_object('start_date', v_start, 'end_date', v_end),
    'waste_entries', (
      SELECT jsonb_agg(jsonb_build_object(
        'entry_date', co.entry_date,
        'disposal_method', co.disposal_method,
        'weight_kg', co.weight_kg,
        'emissions_kg_co2e', co.computed_co2e,
        'description', co.description
      ))
      FROM corporate_overheads co
      JOIN corporate_reports cr ON cr.id = co.report_id
      WHERE cr.organization_id = p_organization_id
        AND co.category = 'operational_waste'
        AND co.entry_date >= v_start
        AND co.entry_date <= v_end
    ),
    'by_disposal_method', (
      SELECT jsonb_object_agg(disposal_method, totals)
      FROM (
        SELECT
          co.disposal_method,
          jsonb_build_object(
            'weight_kg', SUM(co.weight_kg),
            'emissions_kg_co2e', SUM(co.computed_co2e),
            'count', COUNT(*)
          ) as totals
        FROM corporate_overheads co
        JOIN corporate_reports cr ON cr.id = co.report_id
        WHERE cr.organization_id = p_organization_id
          AND co.category = 'operational_waste'
          AND co.entry_date >= v_start
          AND co.entry_date <= v_end
          AND co.disposal_method IS NOT NULL
        GROUP BY co.disposal_method
      ) sub
    ),
    'totals', (
      SELECT jsonb_build_object(
        'total_waste_kg', COALESCE(SUM(co.weight_kg), 0),
        'total_emissions_kg_co2e', COALESCE(SUM(co.computed_co2e), 0),
        'recycled_kg', COALESCE(SUM(CASE WHEN co.disposal_method = 'recycling' THEN co.weight_kg ELSE 0 END), 0),
        'landfill_kg', COALESCE(SUM(CASE WHEN co.disposal_method = 'landfill' THEN co.weight_kg ELSE 0 END), 0),
        'composted_kg', COALESCE(SUM(CASE WHEN co.disposal_method = 'composting' THEN co.weight_kg ELSE 0 END), 0),
        'incinerated_kg', COALESCE(SUM(CASE WHEN co.disposal_method = 'incineration' THEN co.weight_kg ELSE 0 END), 0)
      )
      FROM corporate_overheads co
      JOIN corporate_reports cr ON cr.id = co.report_id
      WHERE cr.organization_id = p_organization_id
        AND co.category = 'operational_waste'
        AND co.entry_date >= v_start
        AND co.entry_date <= v_end
    ),
    'diversion_rate', (
      SELECT CASE
        WHEN SUM(co.weight_kg) > 0 THEN
          ROUND((SUM(CASE WHEN co.disposal_method IN ('recycling', 'composting', 'anaerobic_digestion')
            THEN co.weight_kg ELSE 0 END) / SUM(co.weight_kg)) * 100, 2)
        ELSE 0
      END
      FROM corporate_overheads co
      JOIN corporate_reports cr ON cr.id = co.report_id
      WHERE cr.organization_id = p_organization_id
        AND co.category = 'operational_waste'
        AND co.entry_date >= v_start
        AND co.entry_date <= v_end
    ),
    'packaging_circularity', (
      SELECT jsonb_agg(jsonb_build_object(
        'material_type', pcp.material_type,
        'material_name', pcp.material_name,
        'recyclability_score', pcp.recyclability_score,
        'recycled_content_pct', pcp.recycled_content_percentage,
        'is_compostable', pcp.is_compostable,
        'end_of_life_pathway', pcp.end_of_life_pathway
      ))
      FROM packaging_circularity_profiles pcp
      WHERE pcp.organization_id = p_organization_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_waste_metrics IS 'Rosa AI: Query waste disposal, diversion rates, and circularity metrics';


-- ============================================================================
-- 6. SUPPLIER SUMMARY
-- Answers: "How many suppliers verified?", "Supplier engagement?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_supplier_summary(
  p_organization_id uuid,
  p_engagement_status text DEFAULT NULL,
  p_category text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'totals', (
      SELECT jsonb_build_object(
        'total_suppliers', COUNT(*),
        'invited', COUNT(*) FILTER (WHERE engagement_status = 'invited'),
        'active', COUNT(*) FILTER (WHERE engagement_status = 'active'),
        'data_provided', COUNT(*) FILTER (WHERE engagement_status = 'data_provided'),
        'inactive', COUNT(*) FILTER (WHERE engagement_status = 'inactive'),
        'total_annual_spend', COALESCE(SUM(annual_spend_gbp), 0)
      )
      FROM organization_suppliers
      WHERE organization_id = p_organization_id
    ),
    'by_category', (
      SELECT jsonb_agg(jsonb_build_object(
        'category', category,
        'count', count,
        'total_spend', total_spend
      ))
      FROM (
        SELECT category, COUNT(*) as count, SUM(annual_spend_gbp) as total_spend
        FROM organization_suppliers
        WHERE organization_id = p_organization_id
          AND (p_category IS NULL OR category = p_category)
        GROUP BY category
        ORDER BY count DESC
      ) sub
    ),
    'by_country', (
      SELECT jsonb_agg(jsonb_build_object(
        'country', country,
        'count', count
      ))
      FROM (
        SELECT country, COUNT(*) as count
        FROM organization_suppliers
        WHERE organization_id = p_organization_id
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      ) sub
    ),
    'suppliers', (
      SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', os.id,
        'supplier_name', os.supplier_name,
        'category', os.category,
        'engagement_status', os.engagement_status,
        'country', os.country,
        'annual_spend_gbp', os.annual_spend_gbp,
        'primary_contact_email', os.primary_contact_email,
        'created_at', os.created_at
      ))
      FROM organization_suppliers os
      WHERE os.organization_id = p_organization_id
        AND (p_engagement_status IS NULL OR os.engagement_status::text = p_engagement_status)
        AND (p_category IS NULL OR os.category = p_category)
      ORDER BY os.annual_spend_gbp DESC NULLS LAST
      LIMIT 50
    ),
    'engagement_rate', (
      SELECT CASE
        WHEN COUNT(*) > 0 THEN
          ROUND((COUNT(*) FILTER (WHERE engagement_status IN ('active', 'data_provided'))::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END
      FROM organization_suppliers
      WHERE organization_id = p_organization_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_supplier_summary IS 'Rosa AI: Query supplier counts, engagement status, and spend analysis';


-- ============================================================================
-- 7. PEOPLE & CULTURE METRICS
-- Answers: "Gender diversity?", "Training hours?", "Pay gap?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_people_culture_metrics(
  p_organization_id uuid,
  p_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_year integer;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  SELECT jsonb_build_object(
    'year', v_year,
    'scores', (
      SELECT jsonb_build_object(
        'overall_score', overall_score,
        'fair_work_score', fair_work_score,
        'diversity_score', diversity_score,
        'wellbeing_score', wellbeing_score,
        'training_score', training_score,
        'data_completeness', data_completeness,
        'calculated_at', calculation_date
      )
      FROM people_culture_scores
      WHERE organization_id = p_organization_id
        AND reporting_year = v_year
      ORDER BY calculation_date DESC
      LIMIT 1
    ),
    'pay_equity', (
      SELECT jsonb_build_object(
        'living_wage_compliance_pct', living_wage_compliance,
        'gender_pay_gap_mean', gender_pay_gap_mean,
        'gender_pay_gap_median', gender_pay_gap_median,
        'ceo_worker_pay_ratio', ceo_worker_pay_ratio
      )
      FROM people_culture_scores
      WHERE organization_id = p_organization_id
        AND reporting_year = v_year
      ORDER BY calculation_date DESC
      LIMIT 1
    ),
    'training', (
      SELECT jsonb_build_object(
        'hours_per_employee', training_hours_per_employee,
        'engagement_score', employee_engagement_score
      )
      FROM people_culture_scores
      WHERE organization_id = p_organization_id
        AND reporting_year = v_year
      ORDER BY calculation_date DESC
      LIMIT 1
    ),
    'diversity_actions', (
      SELECT jsonb_agg(jsonb_build_object(
        'action_title', action_title,
        'action_type', action_type,
        'focus_dimension', focus_dimension,
        'status', status,
        'target_value', target_value,
        'current_value', current_value,
        'target_completion_date', target_completion_date
      ))
      FROM people_dei_actions
      WHERE organization_id = p_organization_id
        AND (status != 'completed' OR actual_completion_date >= (v_year || '-01-01')::date)
      LIMIT 20
    ),
    'historical_scores', (
      SELECT jsonb_agg(jsonb_build_object(
        'year', reporting_year,
        'overall_score', overall_score,
        'fair_work_score', fair_work_score,
        'diversity_score', diversity_score
      ) ORDER BY reporting_year DESC)
      FROM (
        SELECT DISTINCT ON (reporting_year) *
        FROM people_culture_scores
        WHERE organization_id = p_organization_id
        ORDER BY reporting_year DESC, calculation_date DESC
      ) sub
      LIMIT 5
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_people_culture_metrics IS 'Rosa AI: Query people & culture scores, pay equity, training, and diversity metrics';


-- ============================================================================
-- 8. GOVERNANCE METRICS
-- Answers: "Board diversity?", "Policy compliance?", "Stakeholder engagement?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_governance_metrics(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'scores', (
      SELECT jsonb_build_object(
        'overall_score', overall_score,
        'policy_score', policy_score,
        'stakeholder_score', stakeholder_score,
        'board_score', board_score,
        'ethics_score', ethics_score,
        'transparency_score', transparency_score,
        'data_completeness', data_completeness,
        'calculated_at', calculated_at
      )
      FROM governance_scores
      WHERE organization_id = p_organization_id
      ORDER BY calculated_at DESC
      LIMIT 1
    ),
    'board', (
      SELECT jsonb_build_object(
        'total_members', COUNT(*),
        'independent_members', COUNT(*) FILTER (WHERE is_independent = true),
        'female_members', COUNT(*) FILTER (WHERE gender = 'female'),
        'male_members', COUNT(*) FILTER (WHERE gender = 'male'),
        'avg_tenure_years', AVG(EXTRACT(YEAR FROM age(CURRENT_DATE, date_appointed))),
        'members', jsonb_agg(jsonb_build_object(
          'name', name,
          'role', role,
          'is_independent', is_independent,
          'gender', gender,
          'expertise_areas', expertise_areas,
          'date_appointed', date_appointed
        ))
      )
      FROM governance_board_members
      WHERE organization_id = p_organization_id
        AND (date_departed IS NULL OR date_departed > CURRENT_DATE)
    ),
    'policies', (
      SELECT jsonb_build_object(
        'total_policies', COUNT(*),
        'active_policies', COUNT(*) FILTER (WHERE status = 'active'),
        'under_review', COUNT(*) FILTER (WHERE status = 'under_review'),
        'by_category', (
          SELECT jsonb_object_agg(policy_category, count)
          FROM (
            SELECT policy_category, COUNT(*) as count
            FROM governance_policies
            WHERE organization_id = p_organization_id
            GROUP BY policy_category
          ) sub
        ),
        'recent_policies', (
          SELECT jsonb_agg(jsonb_build_object(
            'policy_name', policy_name,
            'policy_category', policy_category,
            'status', status,
            'approval_date', approval_date,
            'next_review_date', next_review_date
          ))
          FROM governance_policies
          WHERE organization_id = p_organization_id
          ORDER BY approval_date DESC NULLS LAST
          LIMIT 10
        )
      )
      FROM governance_policies
      WHERE organization_id = p_organization_id
    ),
    'stakeholders', (
      SELECT jsonb_build_object(
        'total_stakeholders', COUNT(*),
        'by_type', (
          SELECT jsonb_object_agg(stakeholder_type, count)
          FROM (
            SELECT stakeholder_type, COUNT(*) as count
            FROM governance_stakeholders
            WHERE organization_id = p_organization_id
            GROUP BY stakeholder_type
          ) sub
        ),
        'recent_engagements', (
          SELECT jsonb_agg(jsonb_build_object(
            'stakeholder_name', gs.stakeholder_name,
            'engagement_date', gse.engagement_date,
            'engagement_type', gse.engagement_type,
            'key_topics', gse.key_topics,
            'key_outcomes', gse.key_outcomes
          ))
          FROM governance_stakeholder_engagements gse
          JOIN governance_stakeholders gs ON gs.id = gse.stakeholder_id
          WHERE gse.organization_id = p_organization_id
          ORDER BY gse.engagement_date DESC
          LIMIT 10
        )
      )
      FROM governance_stakeholders
      WHERE organization_id = p_organization_id
    ),
    'ethics', (
      SELECT jsonb_build_object(
        'total_records', COUNT(*),
        'whistleblower_cases', COUNT(*) FILTER (WHERE record_type = 'whistleblower'),
        'conflicts_of_interest', COUNT(*) FILTER (WHERE record_type = 'conflict_of_interest'),
        'recent_records', jsonb_agg(jsonb_build_object(
          'record_type', record_type,
          'description', description,
          'status', status,
          'reported_date', reported_date
        ) ORDER BY reported_date DESC)
      )
      FROM governance_ethics_records
      WHERE organization_id = p_organization_id
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_governance_metrics IS 'Rosa AI: Query governance scores, board composition, policies, and stakeholder engagement';


-- ============================================================================
-- 9. COMMUNITY IMPACT METRICS
-- Answers: "Total donations?", "Volunteer hours?", "Local impact?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_community_impact_metrics(
  p_organization_id uuid,
  p_year integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
  v_year integer;
BEGIN
  v_year := COALESCE(p_year, EXTRACT(YEAR FROM CURRENT_DATE)::integer);

  -- Note: This assumes community impact tables exist - adjust based on actual schema
  SELECT jsonb_build_object(
    'year', v_year,
    'charitable_giving', (
      SELECT jsonb_build_object(
        'total_amount', COALESCE(SUM(co.spend_amount), 0),
        'currency', 'GBP',
        'entries', jsonb_agg(jsonb_build_object(
          'description', co.description,
          'amount', co.spend_amount,
          'date', co.entry_date
        ))
      )
      FROM corporate_overheads co
      JOIN corporate_reports cr ON cr.id = co.report_id
      WHERE cr.organization_id = p_organization_id
        AND co.category = 'other'
        AND co.description ILIKE '%donat%' OR co.description ILIKE '%charit%'
        AND EXTRACT(YEAR FROM co.entry_date) = v_year
    ),
    'vitality_scores', (
      SELECT jsonb_build_object(
        'overall_score', overall_score,
        'climate_score', climate_score,
        'water_score', water_score,
        'circularity_score', circularity_score,
        'nature_score', nature_score,
        'products_assessed', products_assessed,
        'data_quality_score', data_quality_score,
        'calculated_at', calculation_date
      )
      FROM organization_vitality_scores
      WHERE organization_id = p_organization_id
        AND year = v_year
      ORDER BY calculation_date DESC
      LIMIT 1
    ),
    'environmental_impact_summary', (
      SELECT jsonb_build_object(
        'total_emissions_kg', total_emissions_kg,
        'emissions_intensity', emissions_intensity,
        'water_consumption_m3', water_consumption_m3,
        'water_risk_level', water_risk_level,
        'waste_diversion_rate', waste_diversion_rate,
        'land_use_m2a', land_use_m2a,
        'biodiversity_risk', biodiversity_risk
      )
      FROM organization_vitality_scores
      WHERE organization_id = p_organization_id
        AND year = v_year
      ORDER BY calculation_date DESC
      LIMIT 1
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_community_impact_metrics IS 'Rosa AI: Query community impact, charitable giving, and overall vitality scores';


-- ============================================================================
-- 10. VITALITY SCORES WITH HISTORY
-- Answers: "Current vitality score?", "Score trends?"
-- ============================================================================

CREATE OR REPLACE FUNCTION public.rosa_get_vitality_scores(
  p_organization_id uuid,
  p_include_history boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'current', (
      SELECT jsonb_build_object(
        'year', year,
        'overall_score', overall_score,
        'climate_score', climate_score,
        'water_score', water_score,
        'circularity_score', circularity_score,
        'nature_score', nature_score,
        'total_emissions_kg', total_emissions_kg,
        'emissions_intensity', emissions_intensity,
        'water_consumption_m3', water_consumption_m3,
        'water_risk_level', water_risk_level,
        'waste_diversion_rate', waste_diversion_rate,
        'land_use_m2a', land_use_m2a,
        'biodiversity_risk', biodiversity_risk,
        'products_assessed', products_assessed,
        'data_quality_score', data_quality_score,
        'calculation_date', calculation_date
      )
      FROM organization_vitality_scores
      WHERE organization_id = p_organization_id
      ORDER BY year DESC, calculation_date DESC
      LIMIT 1
    ),
    'history', CASE WHEN p_include_history THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'year', year,
        'overall_score', overall_score,
        'climate_score', climate_score,
        'water_score', water_score,
        'circularity_score', circularity_score,
        'nature_score', nature_score,
        'calculation_date', calculation_date
      ) ORDER BY year DESC)
      FROM (
        SELECT DISTINCT ON (year) *
        FROM organization_vitality_scores
        WHERE organization_id = p_organization_id
        ORDER BY year DESC, calculation_date DESC
      ) sub
      LIMIT 5
    ) ELSE NULL END,
    'score_interpretation', jsonb_build_object(
      '0-25', 'Developing - Early stage sustainability journey',
      '26-50', 'Progressing - Building sustainability capabilities',
      '51-75', 'Maturing - Strong sustainability performance',
      '76-100', 'Leading - Excellence in sustainability'
    )
  ) INTO v_result;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;

COMMENT ON FUNCTION public.rosa_get_vitality_scores IS 'Rosa AI: Query organization vitality scores with optional history';


-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rosa_get_emissions_by_period TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_facility_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_product_footprint_detail TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_water_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_waste_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_supplier_summary TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_people_culture_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_governance_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_community_impact_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rosa_get_vitality_scores TO authenticated, service_role;
