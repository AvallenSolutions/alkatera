/*
  # Fix Embedded Water - Use Only Latest LCA Per Product

  1. Problem
    - Multiple LCA records exist for each product (22 for Test Calvados)
    - The view was summing water across ALL LCAs, multiplying the footprint
    - Correct: Use only the MOST RECENT completed LCA per product

  2. Solution
    - Update company_water_overview to select only the latest LCA per product
    - Exclude process water from embedded calculation
    - Ensure production logs are joined correctly

  3. Expected Result
    - Test Calvados: 4.807 m³/unit × 100,000 units = 480,700 m³ embedded water
    - Process water (2 m³/unit) tracked separately in operational water
*/

DROP VIEW IF EXISTS public.company_water_overview CASCADE;

CREATE OR REPLACE VIEW public.company_water_overview AS
WITH operational_water AS (
  -- Operational water from facility_water_summary
  SELECT
    organization_id,
    SUM(total_consumption_m3) AS operational_intake_m3,
    SUM(total_discharge_m3) AS operational_discharge_m3,
    SUM(net_consumption_m3) AS operational_net_m3,
    SUM(scarcity_weighted_consumption_m3) AS operational_scarcity_weighted_m3,
    SUM(municipal_consumption_m3) AS municipal_consumption_m3,
    SUM(groundwater_consumption_m3) AS groundwater_consumption_m3,
    SUM(surface_water_consumption_m3) AS surface_water_consumption_m3,
    SUM(rainwater_consumption_m3) AS rainwater_consumption_m3,
    SUM(recycled_consumption_m3) AS recycled_consumption_m3,
    COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_facilities,
    COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_facilities,
    COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_facilities,
    COUNT(*) AS total_facilities,
    AVG(aware_factor) AS avg_aware_factor,
    AVG(recycling_rate_percent) AS avg_recycling_rate
  FROM public.facility_water_summary
  WHERE total_consumption_m3 > 0
  GROUP BY organization_id
),
latest_lcas AS (
  -- Get only the MOST RECENT completed LCA per product
  SELECT DISTINCT ON (product_id)
    id as lca_id,
    product_id
  FROM product_lcas
  WHERE status = 'completed'
  ORDER BY product_id, created_at DESC
),
embedded_water AS (
  -- Embedded water from product LCA materials (EXCLUDING process water, ONLY latest LCA)
  SELECT
    p.organization_id,
    SUM(
      plm.impact_water * COALESCE(prod_logs.total_production, 0)
    ) AS embedded_water_m3,
    SUM(
      COALESCE(plm.impact_water_scarcity, plm.impact_water) * COALESCE(prod_logs.total_production, 0)
    ) AS embedded_scarcity_weighted_m3
  FROM products p
  INNER JOIN latest_lcas ll ON p.id = ll.product_id  -- Only latest LCAs
  LEFT JOIN product_lca_materials plm ON ll.lca_id = plm.product_lca_id
  LEFT JOIN (
    SELECT product_id, SUM(units_produced) as total_production
    FROM production_logs
    GROUP BY product_id
  ) prod_logs ON p.id = prod_logs.product_id
  WHERE (plm.name NOT ILIKE '%process water%' OR plm.name IS NULL)  -- EXCLUDE process water
  GROUP BY p.organization_id
)
SELECT
  COALESCE(ow.organization_id, ew.organization_id) AS organization_id,

  -- OPERATIONAL WATER (Direct facility consumption)
  COALESCE(ow.operational_intake_m3, 0) AS operational_intake_m3,
  COALESCE(ow.operational_discharge_m3, 0) AS operational_discharge_m3,
  COALESCE(ow.operational_net_m3, 0) AS operational_net_m3,
  COALESCE(ow.operational_scarcity_weighted_m3, 0) AS operational_scarcity_weighted_m3,

  -- EMBEDDED WATER (Supply chain water from products - EXCLUDING process water, ONLY latest LCA)
  COALESCE(ew.embedded_water_m3, 0) AS embedded_water_m3,
  COALESCE(ew.embedded_scarcity_weighted_m3, 0) AS embedded_scarcity_weighted_m3,

  -- TOTAL WATER FOOTPRINT (Operational + Embedded - no double counting)
  COALESCE(ow.operational_net_m3, 0) + COALESCE(ew.embedded_water_m3, 0) AS total_water_footprint_m3,
  COALESCE(ow.operational_scarcity_weighted_m3, 0) + COALESCE(ew.embedded_scarcity_weighted_m3, 0) AS total_scarcity_weighted_m3,

  -- Legacy fields (for backwards compatibility - derived from operational)
  COALESCE(ow.operational_intake_m3, 0) AS total_consumption_m3,
  COALESCE(ow.operational_net_m3, 0) AS net_consumption_m3,
  COALESCE(ow.operational_scarcity_weighted_m3, 0) AS scarcity_weighted_consumption_m3,

  -- Source breakdown (operational water only)
  COALESCE(ow.municipal_consumption_m3, 0) AS municipal_consumption_m3,
  COALESCE(ow.groundwater_consumption_m3, 0) AS groundwater_consumption_m3,
  COALESCE(ow.surface_water_consumption_m3, 0) AS surface_water_consumption_m3,
  COALESCE(ow.rainwater_consumption_m3, 0) AS rainwater_consumption_m3,
  COALESCE(ow.recycled_consumption_m3, 0) AS recycled_consumption_m3,
  COALESCE(ow.operational_discharge_m3, 0) AS total_discharge_m3,

  -- Percentages (based on operational intake)
  CASE
    WHEN COALESCE(ow.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ow.municipal_consumption_m3, 0) / ow.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS municipal_percent,
  CASE
    WHEN COALESCE(ow.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ow.groundwater_consumption_m3, 0) / ow.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS groundwater_percent,
  CASE
    WHEN COALESCE(ow.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ow.surface_water_consumption_m3, 0) / ow.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS surface_water_percent,
  CASE
    WHEN COALESCE(ow.operational_intake_m3, 0) > 0
    THEN ROUND((COALESCE(ow.recycled_consumption_m3, 0) / ow.operational_intake_m3) * 100, 1)
    ELSE 0
  END AS recycled_percent,

  -- Facility risk metrics
  COALESCE(ow.high_risk_facilities, 0) AS high_risk_facilities,
  COALESCE(ow.medium_risk_facilities, 0) AS medium_risk_facilities,
  COALESCE(ow.low_risk_facilities, 0) AS low_risk_facilities,
  COALESCE(ow.total_facilities, 0) AS total_facilities,
  COALESCE(ow.avg_aware_factor, 1) AS avg_aware_factor,
  COALESCE(ow.avg_recycling_rate, 0) AS avg_recycling_rate

FROM operational_water ow
FULL OUTER JOIN embedded_water ew ON ow.organization_id = ew.organization_id;

COMMENT ON VIEW public.company_water_overview IS
'Organization-level water aggregation with operational/embedded breakdown. Uses ONLY the latest completed LCA per product. Embedded water EXCLUDES process water to avoid double counting with facility operational data.';
