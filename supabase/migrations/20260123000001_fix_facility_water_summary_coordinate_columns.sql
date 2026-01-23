-- ============================================================================
-- FIX: facility_water_summary view uses wrong column names for coordinates
-- ============================================================================
-- The view was using f.latitude and f.longitude, but the facilities table
-- has columns named address_lat and address_lng. This caused the map to show
-- no facilities because the coordinates were always NULL.
-- ============================================================================

-- Recreate the view with correct column names
CREATE OR REPLACE VIEW public.facility_water_summary AS
SELECT
  f.id AS facility_id,
  f.organization_id,
  f.name AS facility_name,
  f.address_city AS city,
  f.address_country AS country,
  f.location_country_code AS country_code,
  -- FIX: Use correct column names from facilities table
  f.address_lat AS latitude,
  f.address_lng AS longitude,

  -- Aggregated consumption (last 12 months)
  COALESCE(SUM(fwd.total_consumption_m3), 0) AS total_consumption_m3,
  COALESCE(SUM(fwd.municipal_consumption_m3), 0) AS municipal_consumption_m3,
  COALESCE(SUM(fwd.groundwater_consumption_m3), 0) AS groundwater_consumption_m3,
  COALESCE(SUM(fwd.surface_water_consumption_m3), 0) AS surface_water_consumption_m3,
  COALESCE(SUM(fwd.rainwater_consumption_m3), 0) AS rainwater_consumption_m3,
  COALESCE(SUM(fwd.recycled_consumption_m3), 0) AS recycled_consumption_m3,

  -- Discharge
  COALESCE(SUM(fwd.total_discharge_m3), 0) AS total_discharge_m3,
  COALESCE(SUM(fwd.net_consumption_m3), 0) AS net_consumption_m3,

  -- Scarcity weighted impact
  COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) AS aware_factor,
  COALESCE(SUM(fwd.scarcity_weighted_consumption_m3), 0) AS scarcity_weighted_consumption_m3,

  -- Risk level (from most recent entry or calculated)
  CASE
    WHEN COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) >= 10 THEN 'high'
    WHEN COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) >= 1 THEN 'medium'
    ELSE 'low'
  END AS risk_level,

  -- Recycling rate
  CASE
    WHEN COALESCE(SUM(fwd.total_consumption_m3), 0) > 0
    THEN ROUND((COALESCE(SUM(fwd.recycled_consumption_m3), 0) / SUM(fwd.total_consumption_m3)) * 100, 1)
    ELSE 0
  END AS recycling_rate_percent,

  -- Intensity
  CASE
    WHEN COALESCE(SUM(fwd.production_volume), 0) > 0
    THEN ROUND(SUM(fwd.total_consumption_m3) / SUM(fwd.production_volume), 4)
    ELSE NULL
  END AS avg_water_intensity_m3_per_unit,

  -- Data quality
  COUNT(DISTINCT fwd.id) AS data_points_count,
  COUNT(DISTINCT CASE WHEN fwd.data_quality = 'measured' OR fwd.data_quality = 'metered' THEN fwd.id END) AS measured_data_points,

  -- Time range
  MIN(fwd.reporting_period_start) AS earliest_data,
  MAX(fwd.reporting_period_end) AS latest_data

FROM public.facilities f
LEFT JOIN public.facility_water_data fwd ON f.id = fwd.facility_id
  AND fwd.reporting_period_start >= (CURRENT_DATE - INTERVAL '12 months')
LEFT JOIN public.aware_factors af ON f.location_country_code = af.country_code
GROUP BY f.id, f.organization_id, f.name, f.address_city, f.address_country,
         f.location_country_code, f.address_lat, f.address_lng, af.aware_factor;

COMMENT ON VIEW public.facility_water_summary IS 'Aggregated water metrics per facility with AWARE risk assessment. Fixed to use correct coordinate column names (address_lat, address_lng).';
