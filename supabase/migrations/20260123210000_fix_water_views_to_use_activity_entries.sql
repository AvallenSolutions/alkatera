/*
  # Fix Water Views to Use facility_activity_entries

  The water views (facility_water_summary, company_water_overview) were reading from
  facility_water_data table which is empty. The actual water data is stored in
  facility_activity_entries with activity_category values:
  - 'water_intake'
  - 'water_discharge'
  - 'water_recycled'

  This migration updates the views to aggregate water data from the correct source.
*/

-- ============================================================================
-- STEP 1: Create/Replace facility_water_summary view
-- ============================================================================

CREATE OR REPLACE VIEW public.facility_water_summary AS
WITH water_data AS (
  SELECT
    fae.facility_id,
    fae.organization_id,
    fae.reporting_period_start,
    fae.reporting_period_end,
    -- Water intake by source type
    CASE WHEN fae.activity_category = 'water_intake' THEN fae.quantity ELSE 0 END AS intake_m3,
    CASE WHEN fae.activity_category = 'water_intake' AND fae.water_source_type = 'municipal' THEN fae.quantity ELSE 0 END AS municipal_m3,
    CASE WHEN fae.activity_category = 'water_intake' AND fae.water_source_type = 'groundwater' THEN fae.quantity ELSE 0 END AS groundwater_m3,
    CASE WHEN fae.activity_category = 'water_intake' AND fae.water_source_type = 'surface_water' THEN fae.quantity ELSE 0 END AS surface_m3,
    CASE WHEN fae.activity_category = 'water_intake' AND fae.water_source_type = 'rainwater' THEN fae.quantity ELSE 0 END AS rainwater_m3,
    -- Discharge
    CASE WHEN fae.activity_category = 'water_discharge' THEN fae.quantity ELSE 0 END AS discharge_m3,
    -- Recycled
    CASE WHEN fae.activity_category = 'water_recycled' THEN fae.quantity ELSE 0 END AS recycled_m3,
    -- Data quality
    fae.data_provenance
  FROM facility_activity_entries fae
  WHERE fae.activity_category IN ('water_intake', 'water_discharge', 'water_recycled')
    AND fae.reporting_period_start >= (CURRENT_DATE - INTERVAL '12 months')
)
SELECT
  f.id AS facility_id,
  f.organization_id,
  f.name AS facility_name,
  f.address_city AS city,
  f.address_country AS country,
  f.location_country_code AS country_code,
  f.address_lat AS latitude,
  f.address_lng AS longitude,

  -- Aggregated consumption
  COALESCE(SUM(wd.intake_m3), 0) AS total_consumption_m3,
  COALESCE(SUM(wd.municipal_m3), 0) AS municipal_consumption_m3,
  COALESCE(SUM(wd.groundwater_m3), 0) AS groundwater_consumption_m3,
  COALESCE(SUM(wd.surface_m3), 0) AS surface_water_consumption_m3,
  COALESCE(SUM(wd.rainwater_m3), 0) AS rainwater_consumption_m3,
  COALESCE(SUM(wd.recycled_m3), 0) AS recycled_consumption_m3,

  -- Discharge and net consumption
  COALESCE(SUM(wd.discharge_m3), 0) AS total_discharge_m3,
  GREATEST(COALESCE(SUM(wd.intake_m3), 0) - COALESCE(SUM(wd.discharge_m3), 0), 0) AS net_consumption_m3,

  -- AWARE factor and scarcity-weighted impact
  COALESCE(af.aware_factor, 1) AS aware_factor,
  GREATEST(COALESCE(SUM(wd.intake_m3), 0) - COALESCE(SUM(wd.discharge_m3), 0), 0) * COALESCE(af.aware_factor, 1) AS scarcity_weighted_consumption_m3,

  -- Risk level based on AWARE factor
  CASE
    WHEN COALESCE(af.aware_factor, 1) >= 10 THEN 'high'
    WHEN COALESCE(af.aware_factor, 1) >= 1 THEN 'medium'
    ELSE 'low'
  END AS risk_level,

  -- Recycling rate
  CASE
    WHEN COALESCE(SUM(wd.intake_m3), 0) > 0
    THEN ROUND((COALESCE(SUM(wd.recycled_m3), 0) / SUM(wd.intake_m3)) * 100, 1)
    ELSE 0
  END AS recycling_rate_percent,

  -- Intensity (placeholder - would need production data)
  NULL::numeric AS avg_water_intensity_m3_per_unit,

  -- Data quality metrics
  COUNT(DISTINCT CASE WHEN wd.intake_m3 > 0 OR wd.discharge_m3 > 0 OR wd.recycled_m3 > 0 THEN 1 END) AS data_points_count,
  COUNT(DISTINCT CASE WHEN wd.data_provenance IN ('primary_verified_measured', 'primary_verified_metered') THEN 1 END) AS measured_data_points,

  -- Time range
  MIN(wd.reporting_period_start) AS earliest_data,
  MAX(wd.reporting_period_end) AS latest_data

FROM public.facilities f
LEFT JOIN water_data wd ON f.id = wd.facility_id
LEFT JOIN public.aware_factors af ON f.location_country_code = af.country_code
GROUP BY f.id, f.organization_id, f.name, f.address_city, f.address_country,
         f.location_country_code, f.address_lat, f.address_lng, af.aware_factor;

COMMENT ON VIEW public.facility_water_summary IS
'Aggregated water metrics per facility from facility_activity_entries. Includes AWARE risk assessment.';

-- ============================================================================
-- STEP 2: Create/Replace company_water_overview view
-- ============================================================================

CREATE OR REPLACE VIEW public.company_water_overview AS
WITH facility_totals AS (
  SELECT
    organization_id,
    SUM(total_consumption_m3) AS operational_intake_m3,
    SUM(total_discharge_m3) AS operational_discharge_m3,
    SUM(net_consumption_m3) AS operational_net_m3,
    SUM(scarcity_weighted_consumption_m3) AS operational_scarcity_weighted_m3,
    SUM(municipal_consumption_m3) AS municipal_m3,
    SUM(groundwater_consumption_m3) AS groundwater_m3,
    SUM(surface_water_consumption_m3) AS surface_m3,
    SUM(rainwater_consumption_m3) AS rainwater_m3,
    SUM(recycled_consumption_m3) AS recycled_m3,
    AVG(aware_factor) AS avg_aware,
    AVG(recycling_rate_percent) AS avg_recycling,
    COUNT(CASE WHEN risk_level = 'high' THEN 1 END) AS high_risk,
    COUNT(CASE WHEN risk_level = 'medium' THEN 1 END) AS medium_risk,
    COUNT(CASE WHEN risk_level = 'low' THEN 1 END) AS low_risk,
    COUNT(*) AS total_facilities
  FROM facility_water_summary
  WHERE total_consumption_m3 > 0 OR total_discharge_m3 > 0
  GROUP BY organization_id
),
embedded_water AS (
  -- Get embedded water from product LCAs (supply chain water)
  SELECT
    pcf.organization_id,
    SUM(COALESCE((pcf.aggregated_impacts->>'water_consumption')::numeric, 0) * COALESCE(pl.units_produced, 1)) AS embedded_m3,
    SUM(COALESCE((pcf.aggregated_impacts->>'water_scarcity_aware')::numeric, 0) * COALESCE(pl.units_produced, 1)) AS embedded_scarcity_m3
  FROM product_carbon_footprints pcf
  LEFT JOIN production_logs pl ON pcf.product_id = pl.product_id
  WHERE pcf.status = 'completed'
    AND pcf.aggregated_impacts IS NOT NULL
  GROUP BY pcf.organization_id
)
SELECT
  COALESCE(ft.organization_id, ew.organization_id) AS organization_id,

  -- Operational water (direct facility consumption)
  COALESCE(ft.operational_intake_m3, 0) AS operational_intake_m3,
  COALESCE(ft.operational_discharge_m3, 0) AS operational_discharge_m3,
  COALESCE(ft.operational_net_m3, 0) AS operational_net_m3,
  COALESCE(ft.operational_scarcity_weighted_m3, 0) AS operational_scarcity_weighted_m3,

  -- Embedded water (supply chain from products)
  COALESCE(ew.embedded_m3, 0) AS embedded_water_m3,
  COALESCE(ew.embedded_scarcity_m3, 0) AS embedded_scarcity_weighted_m3,

  -- Total water footprint
  COALESCE(ft.operational_net_m3, 0) + COALESCE(ew.embedded_m3, 0) AS total_water_footprint_m3,
  COALESCE(ft.operational_scarcity_weighted_m3, 0) + COALESCE(ew.embedded_scarcity_m3, 0) AS total_scarcity_weighted_m3,

  -- Legacy fields for backwards compatibility
  COALESCE(ft.operational_intake_m3, 0) AS total_consumption_m3,
  COALESCE(ft.operational_net_m3, 0) AS net_consumption_m3,
  COALESCE(ft.operational_scarcity_weighted_m3, 0) AS scarcity_weighted_consumption_m3,
  COALESCE(ft.municipal_m3, 0) AS municipal_consumption_m3,
  COALESCE(ft.groundwater_m3, 0) AS groundwater_consumption_m3,
  COALESCE(ft.surface_m3, 0) AS surface_water_consumption_m3,
  COALESCE(ft.rainwater_m3, 0) AS rainwater_consumption_m3,
  COALESCE(ft.recycled_m3, 0) AS recycled_consumption_m3,
  COALESCE(ft.operational_discharge_m3, 0) AS total_discharge_m3,

  -- Percentages
  CASE WHEN COALESCE(ft.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ft.municipal_m3, 0) / ft.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS municipal_percent,
  CASE WHEN COALESCE(ft.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ft.groundwater_m3, 0) / ft.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS groundwater_percent,
  CASE WHEN COALESCE(ft.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ft.surface_m3, 0) / ft.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS surface_water_percent,
  CASE WHEN COALESCE(ft.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ft.recycled_m3, 0) / ft.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS recycled_percent,

  -- Facility risk counts
  COALESCE(ft.high_risk, 0)::integer AS high_risk_facilities,
  COALESCE(ft.medium_risk, 0)::integer AS medium_risk_facilities,
  COALESCE(ft.low_risk, 0)::integer AS low_risk_facilities,
  COALESCE(ft.total_facilities, 0)::integer AS total_facilities,

  -- Averages
  COALESCE(ft.avg_aware, 1) AS avg_aware_factor,
  COALESCE(ft.avg_recycling, 0) AS avg_recycling_rate

FROM facility_totals ft
FULL OUTER JOIN embedded_water ew ON ft.organization_id = ew.organization_id;

COMMENT ON VIEW public.company_water_overview IS
'Company-wide water metrics combining operational (facility) and embedded (supply chain) water. Data from facility_activity_entries and product LCAs.';

-- ============================================================================
-- STEP 3: Verification
-- ============================================================================

DO $$
DECLARE
  facility_count INTEGER;
  company_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO facility_count FROM facility_water_summary WHERE total_consumption_m3 > 0;
  SELECT COUNT(*) INTO company_count FROM company_water_overview WHERE total_water_footprint_m3 > 0;

  RAISE NOTICE 'Water Views Updated:';
  RAISE NOTICE '  Facilities with water data: %', facility_count;
  RAISE NOTICE '  Organizations with water overview: %', company_count;
  RAISE NOTICE '  ✓ Views now read from facility_activity_entries';
END $$;
