/*
  # Calculation Verification Queries - January 2026

  Run these queries after triggering calculations to verify expected vs actual results.

  ## Expected Results:

  ### Product LCAs:
  - Highland Single Malt Whisky: 0.876 kg CO2e (±10% = 0.79 - 0.96)
  - Marlborough Sauvignon Blanc: 1.34 kg CO2e (±10% = 1.21 - 1.47)
  - Oxford Craft Lager: 0.20 kg CO2e (±10% = 0.18 - 0.22)

  ### Facility Emissions (Test Distillery):
  - Scope 1: 15.22 tCO2e (±10%)
  - Scope 2: 20.70 tCO2e (±10%)
  - Scope 3: 205.20 tCO2e (±10%)
  - Total: 241.12 tCO2e (±10%)

  ## Tolerance: ±10%
*/

-- ============================================================================
-- 1. PRODUCT LCA VERIFICATION
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'PRODUCT LCA VERIFICATION' as section;
SELECT
  '============================================' as section;

-- Compare expected vs actual for all products
SELECT
  p.name AS product_name,
  p.sku,
  p.unit_size_value || p.unit_size_unit AS volume,
  CASE p.sku
    WHEN 'TEST-SPR-001' THEN 0.876
    WHEN 'TEST-WIN-001' THEN 1.34
    WHEN 'TEST-BER-001' THEN 0.20
  END AS expected_kg_co2e,
  COALESCE((pl.aggregated_impacts->>'climate_change_gwp100')::numeric, 0) AS actual_kg_co2e,
  ROUND(
    ABS(
      COALESCE((pl.aggregated_impacts->>'climate_change_gwp100')::numeric, 0) -
      CASE p.sku
        WHEN 'TEST-SPR-001' THEN 0.876
        WHEN 'TEST-WIN-001' THEN 1.34
        WHEN 'TEST-BER-001' THEN 0.20
      END
    ) /
    CASE p.sku
      WHEN 'TEST-SPR-001' THEN 0.876
      WHEN 'TEST-WIN-001' THEN 1.34
      WHEN 'TEST-BER-001' THEN 0.20
    END * 100, 2
  ) AS variance_percent,
  CASE
    WHEN ABS(
      COALESCE((pl.aggregated_impacts->>'climate_change_gwp100')::numeric, 0) -
      CASE p.sku
        WHEN 'TEST-SPR-001' THEN 0.876
        WHEN 'TEST-WIN-001' THEN 1.34
        WHEN 'TEST-BER-001' THEN 0.20
      END
    ) /
    CASE p.sku
      WHEN 'TEST-SPR-001' THEN 0.876
      WHEN 'TEST-WIN-001' THEN 1.34
      WHEN 'TEST-BER-001' THEN 0.20
    END <= 0.10 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS status,
  pl.status AS lca_status
FROM products p
LEFT JOIN product_lcas pl ON pl.id = p.latest_lca_id
WHERE p.organization_id = get_current_organization_id()
  AND p.sku IN ('TEST-SPR-001', 'TEST-WIN-001', 'TEST-BER-001')
ORDER BY p.sku;

-- ============================================================================
-- 2. GHG BREAKDOWN VERIFICATION
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'GHG BREAKDOWN (Fossil vs Biogenic)' as section;
SELECT
  '============================================' as section;

SELECT
  p.name AS product_name,
  p.sku,
  COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'fossil')::numeric, 0) AS fossil_kg_co2e,
  COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'biogenic')::numeric, 0) AS biogenic_kg_co2e,
  COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'luluc')::numeric, 0) AS luluc_kg_co2e,
  COALESCE((pl.aggregated_impacts->>'climate_change_gwp100')::numeric, 0) AS total_kg_co2e,
  CASE
    WHEN ABS(
      COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'fossil')::numeric, 0) +
      COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'biogenic')::numeric, 0) +
      COALESCE((pl.aggregated_impacts->'ghg_breakdown'->>'luluc')::numeric, 0) -
      COALESCE((pl.aggregated_impacts->>'climate_change_gwp100')::numeric, 0)
    ) < 0.01 THEN '✅ SUM OK'
    ELSE '❌ SUM MISMATCH'
  END AS breakdown_check
FROM products p
LEFT JOIN product_lcas pl ON pl.id = p.latest_lca_id
WHERE p.organization_id = get_current_organization_id()
  AND p.sku IN ('TEST-SPR-001', 'TEST-WIN-001', 'TEST-BER-001')
ORDER BY p.sku;

-- ============================================================================
-- 3. WATER & NATURE IMPACTS VERIFICATION
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'WATER & NATURE IMPACTS' as section;
SELECT
  '============================================' as section;

SELECT
  p.name AS product_name,
  p.sku,
  COALESCE((pl.aggregated_impacts->>'water_consumption')::numeric, 0) AS water_m3,
  COALESCE((pl.aggregated_impacts->>'land_use')::numeric, 0) AS land_use_m2,
  COALESCE((pl.aggregated_impacts->>'waste_generation')::numeric, 0) AS waste_kg,
  CASE
    WHEN (pl.aggregated_impacts->>'water_consumption')::numeric > 0 THEN '✅'
    ELSE '❌'
  END AS water_ok,
  CASE
    WHEN (pl.aggregated_impacts->>'land_use')::numeric > 0 THEN '✅'
    ELSE '❌'
  END AS land_ok
FROM products p
LEFT JOIN product_lcas pl ON pl.id = p.latest_lca_id
WHERE p.organization_id = get_current_organization_id()
  AND p.sku IN ('TEST-SPR-001', 'TEST-WIN-001', 'TEST-BER-001')
ORDER BY p.sku;

-- ============================================================================
-- 4. FACILITY EMISSIONS VERIFICATION
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'FACILITY EMISSIONS VERIFICATION' as section;
SELECT
  '============================================' as section;

-- Expected values for Test Distillery:
-- Scope 1: 15.22 tCO2e, Scope 2: 20.70 tCO2e

SELECT
  f.name AS facility_name,
  f.location AS facility_location,
  fea.reporting_period_start,
  fea.reporting_period_end,
  ROUND(fea.total_co2e / 1000, 2) AS total_tco2e,
  fea.results_payload->>'disaggregated_summary' AS breakdown
FROM facilities f
LEFT JOIN facility_emissions_aggregated fea ON fea.facility_id = f.id
WHERE f.organization_id = get_current_organization_id()
  AND f.name LIKE 'Calculation Verification%';

-- ============================================================================
-- 5. FACILITY ACTIVITY DATA SUMMARY
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'FACILITY ACTIVITY DATA' as section;
SELECT
  '============================================' as section;

SELECT
  f.name AS facility_name,
  s.scope,
  s.source_name,
  fad.quantity,
  fad.unit,
  s.emission_factor_co2e AS ef_kgco2e_per_unit,
  ROUND(fad.quantity * s.emission_factor_co2e / 1000, 2) AS calculated_tco2e,
  CASE s.scope
    WHEN 'scope_1' THEN
      CASE s.source_name
        WHEN '[CALC-VERIFY] Natural Gas' THEN 9.15
        WHEN '[CALC-VERIFY] Diesel Vehicles' THEN 5.28
        WHEN '[CALC-VERIFY] LPG' THEN 0.79
      END
    WHEN 'scope_2' THEN 20.70
  END AS expected_tco2e
FROM facility_activity_data fad
JOIN facilities f ON f.id = fad.facility_id
JOIN scope_1_2_emission_sources s ON s.id = fad.emission_source_id
WHERE f.organization_id = get_current_organization_id()
  AND f.name = 'Calculation Verification Distillery'
ORDER BY s.scope, s.source_name;

-- ============================================================================
-- 6. SCOPE TOTALS COMPARISON
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'SCOPE TOTALS COMPARISON' as section;
SELECT
  '============================================' as section;

WITH scope_totals AS (
  SELECT
    s.scope,
    SUM(fad.quantity * s.emission_factor_co2e / 1000) AS calculated_tco2e
  FROM facility_activity_data fad
  JOIN facilities f ON f.id = fad.facility_id
  JOIN scope_1_2_emission_sources s ON s.id = fad.emission_source_id
  WHERE f.organization_id = get_current_organization_id()
    AND f.name = 'Calculation Verification Distillery'
  GROUP BY s.scope
)
SELECT
  scope,
  ROUND(calculated_tco2e, 2) AS calculated_tco2e,
  CASE scope
    WHEN 'scope_1' THEN 15.22
    WHEN 'scope_2' THEN 20.70
  END AS expected_tco2e,
  ROUND(
    ABS(
      calculated_tco2e -
      CASE scope
        WHEN 'scope_1' THEN 15.22
        WHEN 'scope_2' THEN 20.70
      END
    ) /
    CASE scope
      WHEN 'scope_1' THEN 15.22
      WHEN 'scope_2' THEN 20.70
    END * 100, 2
  ) AS variance_percent,
  CASE
    WHEN ABS(
      calculated_tco2e -
      CASE scope
        WHEN 'scope_1' THEN 15.22
        WHEN 'scope_2' THEN 20.70
      END
    ) /
    CASE scope
      WHEN 'scope_1' THEN 15.22
      WHEN 'scope_2' THEN 20.70
    END <= 0.10 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS status
FROM scope_totals
ORDER BY scope;

-- ============================================================================
-- 7. CORPORATE OVERHEAD (Scope 3) VERIFICATION
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'SCOPE 3 (Corporate Overhead) VERIFICATION' as section;
SELECT
  '============================================' as section;

SELECT
  category,
  sub_category,
  description,
  quantity AS kg_co2e,
  ROUND(quantity / 1000, 2) AS tco2e
FROM corporate_overheads
WHERE organization_id = get_current_organization_id()
  AND description LIKE '[CALC-VERIFY]%'
ORDER BY category;

-- Expected Scope 3 Total: 205.2 tCO2e
SELECT
  'Scope 3 Total' AS metric,
  ROUND(SUM(quantity) / 1000, 2) AS calculated_tco2e,
  205.2 AS expected_tco2e,
  ROUND(
    ABS(SUM(quantity) / 1000 - 205.2) / 205.2 * 100, 2
  ) AS variance_percent,
  CASE
    WHEN ABS(SUM(quantity) / 1000 - 205.2) / 205.2 <= 0.10 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS status
FROM corporate_overheads
WHERE organization_id = get_current_organization_id()
  AND description LIKE '[CALC-VERIFY]%';

-- ============================================================================
-- 8. TOTAL COMPANY FOOTPRINT
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'TOTAL COMPANY FOOTPRINT' as section;
SELECT
  '============================================' as section;

WITH all_emissions AS (
  -- Scope 1 & 2 from facility activity data
  SELECT
    s.scope,
    SUM(fad.quantity * s.emission_factor_co2e / 1000) AS tco2e
  FROM facility_activity_data fad
  JOIN facilities f ON f.id = fad.facility_id
  JOIN scope_1_2_emission_sources s ON s.id = fad.emission_source_id
  WHERE f.organization_id = get_current_organization_id()
    AND f.name = 'Calculation Verification Distillery'
  GROUP BY s.scope

  UNION ALL

  -- Scope 3 from corporate overheads
  SELECT
    'scope_3' AS scope,
    SUM(quantity) / 1000 AS tco2e
  FROM corporate_overheads
  WHERE organization_id = get_current_organization_id()
    AND description LIKE '[CALC-VERIFY]%'
)
SELECT
  'GRAND TOTAL' AS metric,
  ROUND(SUM(tco2e), 2) AS calculated_tco2e,
  241.12 AS expected_tco2e,
  ROUND(
    ABS(SUM(tco2e) - 241.12) / 241.12 * 100, 2
  ) AS variance_percent,
  CASE
    WHEN ABS(SUM(tco2e) - 241.12) / 241.12 <= 0.10 THEN '✅ PASS'
    ELSE '❌ FAIL'
  END AS status
FROM all_emissions;

-- ============================================================================
-- 9. DATA QUALITY SUMMARY
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'DATA QUALITY SUMMARY' as section;
SELECT
  '============================================' as section;

SELECT
  p.name AS product_name,
  pl.data_quality_summary->>'score' AS quality_score,
  pl.data_quality_summary->>'rating' AS quality_rating,
  pl.data_quality_summary->'breakdown'->>'primary_share' AS primary_data,
  pl.data_quality_summary->'breakdown'->>'regional_share' AS regional_data,
  pl.data_quality_summary->'breakdown'->>'secondary_share' AS secondary_data
FROM products p
LEFT JOIN product_lcas pl ON pl.id = p.latest_lca_id
WHERE p.organization_id = get_current_organization_id()
  AND p.sku IN ('TEST-SPR-001', 'TEST-WIN-001', 'TEST-BER-001')
ORDER BY p.sku;

-- ============================================================================
-- 10. CALCULATION LOGS (Audit Trail)
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'RECENT CALCULATION LOGS' as section;
SELECT
  '============================================' as section;

SELECT
  log_id,
  methodology_version,
  output_value AS output_co2e,
  created_at
FROM calculation_logs
WHERE organization_id = get_current_organization_id()
ORDER BY created_at DESC
LIMIT 10;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================

SELECT
  '============================================' as section;
SELECT
  'VERIFICATION SUMMARY' as section;
SELECT
  '============================================' as section;

SELECT '
Expected Results:
-----------------
Product LCAs (kg CO2e):
  - Whisky (TEST-SPR-001): 0.876 ±10%
  - Wine (TEST-WIN-001): 1.34 ±10%
  - Beer (TEST-BER-001): 0.20 ±10%

Facility Emissions (tCO2e):
  - Scope 1: 15.22 ±10%
  - Scope 2: 20.70 ±10%
  - Scope 3: 205.20 ±10%
  - Total: 241.12 ±10%

If all checks show ✅ PASS, calculations are verified!
' AS verification_guide;
