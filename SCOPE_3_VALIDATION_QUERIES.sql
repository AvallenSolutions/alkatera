-- ============================================
-- Scope 3 Issues - Validation & Diagnostic Queries
-- Run these in Supabase SQL Editor to identify root causes
-- ============================================

-- ============================================
-- TEST 1: Check Corporate Reports Exist
-- ============================================

-- Verify corporate_reports row exists for 2025
SELECT
  id as report_id,
  year,
  status,
  organization_id,
  total_emissions,
  created_at,
  updated_at
FROM corporate_reports
WHERE year = 2025
ORDER BY created_at DESC;

-- Expected: At least 1 row with your organization_id and year = 2025
-- If NO ROWS: Report not created, page initialization failing


-- ============================================
-- TEST 2: Check RLS Policies on corporate_overheads
-- ============================================

-- View all RLS policies for corporate_overheads table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual::text as using_expression,
  with_check::text as with_check_expression
FROM pg_policies
WHERE tablename = 'corporate_overheads'
ORDER BY policyname;

-- Expected: Should see policies for SELECT, INSERT, UPDATE, DELETE
-- Check: WITH CHECK expression should reference corporate_reports.organization_id


-- ============================================
-- TEST 3: Check corporate_overheads Schema
-- ============================================

-- View all columns in corporate_overheads
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'corporate_overheads'
ORDER BY ordinal_position;

-- Required columns:
-- - id (uuid, primary key)
-- - report_id (uuid, foreign key to corporate_reports.id)
-- - category (text, NOT NULL)
-- - description (text)
-- - computed_co2e (numeric)
-- - spend_amount (numeric)
-- - currency (text)
-- - entry_date (date)
-- Plus category-specific columns (transport_mode, distance_km, etc.)


-- ============================================
-- TEST 4: Test INSERT Permission (Manual Test)
-- ============================================

-- WARNING: This will insert test data. Delete afterward if successful.

-- First, get your report_id
SELECT id as report_id
FROM corporate_reports
WHERE year = 2025
LIMIT 1;

-- Then try to INSERT a test record (use report_id from above)
INSERT INTO corporate_overheads (
  report_id,
  category,
  description,
  spend_amount,
  currency,
  entry_date,
  computed_co2e
) VALUES (
  '<PASTE-REPORT-ID-HERE>',  -- Replace with actual report_id from query above
  'test_category',
  'Test entry from SQL',
  100,
  'GBP',
  '2025-01-01',
  50.5
);

-- If successful: RLS policies working, issue is in frontend/component
-- If FAILS with "new row violates row-level security policy": RLS blocking INSERT
-- If FAILS with foreign key violation: report_id doesn't exist

-- Clean up test data
DELETE FROM corporate_overheads
WHERE category = 'test_category' AND description = 'Test entry from SQL';


-- ============================================
-- TEST 5: Check Scope 3 Category 1 - Production Logs
-- ============================================

-- Check if production logs exist for 2025
SELECT
  pl.id,
  pl.date,
  pl.volume,
  pl.unit,
  p.name as product_name,
  p.functional_unit_quantity,
  pl.created_at
FROM production_logs pl
JOIN products p ON pl.product_id = p.id
WHERE pl.date >= '2025-01-01'
  AND pl.date <= '2025-12-31'
ORDER BY pl.date DESC
LIMIT 10;

-- Expected: Rows with production data for 2025
-- If NO ROWS: No production logs recorded → Cat 1 will show "No data"


-- ============================================
-- TEST 6: Check Product LCAs - Status & Structure
-- ============================================

-- Check product LCAs completed status
SELECT
  p.name as product_name,
  plca.status,
  plca.total_ghg_emissions,
  plca.total_ghg_emissions_fossil,
  plca.created_at
FROM product_lcas plca
JOIN products p ON plca.product_id = p.id
WHERE plca.status = 'completed'
ORDER BY plca.created_at DESC
LIMIT 10;

-- Expected: Rows with status = 'completed' and total_ghg_emissions > 0
-- If status != 'completed': LCAs not finalized → Cat 1 won't calculate


-- ============================================
-- TEST 7: Check LCA Aggregated Impacts JSON Structure
-- ============================================

-- Check if aggregated_impacts has correct structure
SELECT
  p.name as product_name,
  plca.status,
  plca.total_ghg_emissions,
  jsonb_pretty(plca.aggregated_impacts) as full_json,
  jsonb_pretty(plca.aggregated_impacts->'breakdown'->'by_lifecycle_stage') as lifecycle_stages
FROM product_lcas plca
JOIN products p ON plca.product_id = p.id
WHERE plca.status = 'completed'
  AND plca.aggregated_impacts IS NOT NULL
ORDER BY plca.created_at DESC
LIMIT 3;

-- Expected JSON structure:
-- {
--   "breakdown": {
--     "by_lifecycle_stage": [
--       {
--         "stage": "raw_materials",
--         "climate_change": 1234.56,
--         ...
--       },
--       {
--         "stage": "packaging",
--         "climate_change": 567.89,
--         ...
--       }
--     ]
--   }
-- }

-- Check: Do stages include "raw_materials" and "packaging"?
-- Check: Does each stage have "climate_change" field?


-- ============================================
-- TEST 8: Check Category 1 Calculation Manually
-- ============================================

-- Manually calculate what Cat 1 SHOULD show
WITH production_with_lca AS (
  SELECT
    p.name as product_name,
    pl.volume as production_volume,
    pl.unit as production_unit,
    p.functional_unit_quantity,
    plca.aggregated_impacts->'breakdown'->'by_lifecycle_stage' as stages
  FROM production_logs pl
  JOIN products p ON pl.product_id = p.id
  JOIN LATERAL (
    SELECT *
    FROM product_lcas
    WHERE product_id = pl.product_id
      AND status = 'completed'
    ORDER BY created_at DESC
    LIMIT 1
  ) plca ON true
  WHERE pl.date >= '2025-01-01'
    AND pl.date <= '2025-12-31'
)
SELECT
  product_name,
  production_volume,
  production_unit,
  functional_unit_quantity,
  (
    SELECT (stage->>'climate_change')::numeric
    FROM jsonb_array_elements(stages) stage
    WHERE stage->>'stage' = 'raw_materials'
  ) as materials_per_unit,
  (
    SELECT (stage->>'climate_change')::numeric
    FROM jsonb_array_elements(stages) stage
    WHERE stage->>'stage' = 'packaging'
  ) as packaging_per_unit,
  -- Calculate total emissions
  (
    (
      SELECT (stage->>'climate_change')::numeric
      FROM jsonb_array_elements(stages) stage
      WHERE stage->>'stage' = 'raw_materials'
    ) +
    (
      SELECT (stage->>'climate_change')::numeric
      FROM jsonb_array_elements(stages) stage
      WHERE stage->>'stage' = 'packaging'
    )
  ) * (production_volume / functional_unit_quantity) / 1000 as total_tco2e
FROM production_with_lca;

-- Expected: Shows calculated emissions for each product
-- If NULL values: JSON structure doesn't match expected format


-- ============================================
-- TEST 9: Check Existing Scope 3 Overhead Data
-- ============================================

-- Check if any Scope 3 data already saved in corporate_overheads
SELECT
  co.category,
  COUNT(*) as entry_count,
  SUM(co.computed_co2e) as total_co2e,
  MIN(co.entry_date) as earliest_entry,
  MAX(co.entry_date) as latest_entry
FROM corporate_overheads co
JOIN corporate_reports cr ON co.report_id = cr.id
WHERE cr.year = 2025
GROUP BY co.category
ORDER BY co.category;

-- Expected: Rows grouped by category (business_travel, purchased_services, etc.)
-- If NO ROWS: No Scope 3 data entered yet (confirms save issue)
-- If HAS ROWS: Data saving works, issue is display/aggregation


-- ============================================
-- TEST 10: Check Foreign Key Constraints
-- ============================================

-- Verify foreign key from corporate_overheads to corporate_reports
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'corporate_overheads'
  AND tc.constraint_type = 'FOREIGN KEY';

-- Expected: FK from corporate_overheads.report_id → corporate_reports.id


-- ============================================
-- TEST 11: Check Facility Waste Logs (Operational Waste)
-- ============================================

-- Check if facility waste logs exist (for auto-calculation)
SELECT
  fw.date,
  fw.waste_type,
  fw.disposal_method,
  fw.quantity,
  fw.unit,
  f.name as facility_name,
  fw.created_at
FROM facility_waste_logs fw
JOIN facilities f ON fw.facility_id = f.id
WHERE fw.date >= '2025-01-01'
  AND fw.date <= '2025-12-31'
ORDER BY fw.date DESC
LIMIT 10;

-- Expected: Rows with waste data entered at facility level
-- If NO ROWS: No waste logged → operational waste won't auto-calculate


-- ============================================
-- TEST 12: Count All Scope 3 Categories
-- ============================================

-- Get overview of all Scope 3 data availability
SELECT
  'Production Logs (2025)' as data_source,
  COUNT(*)::text as count
FROM production_logs
WHERE date >= '2025-01-01' AND date <= '2025-12-31'

UNION ALL

SELECT
  'Completed Product LCAs',
  COUNT(*)::text
FROM product_lcas
WHERE status = 'completed'

UNION ALL

SELECT
  'Corporate Reports (2025)',
  COUNT(*)::text
FROM corporate_reports
WHERE year = 2025

UNION ALL

SELECT
  'Corporate Overheads (all)',
  COUNT(*)::text
FROM corporate_overheads

UNION ALL

SELECT
  'Facility Waste Logs (2025)',
  COUNT(*)::text
FROM facility_waste_logs
WHERE date >= '2025-01-01' AND date <= '2025-12-31';

-- Expected: All counts > 0 for full Scope 3 functionality
-- If any = 0: Identifies missing data source


-- ============================================
-- SUMMARY: What Each Test Tells You
-- ============================================

/*
TEST 1: Corporate Reports
- If NO ROWS → Page initialization failing, report not auto-created
- If HAS ROWS → Report structure OK

TEST 2: RLS Policies
- Check if policies exist for INSERT
- Verify WITH CHECK references organization_id correctly

TEST 3: Schema Check
- Confirms all required columns exist
- Check for missing columns causing INSERT failures

TEST 4: Manual INSERT Test
- If FAILS with RLS error → Policies too restrictive
- If FAILS with FK error → report_id invalid
- If SUCCESS → Issue is in frontend component

TEST 5: Production Logs
- If NO ROWS → Cat 1 will show "No data" correctly
- If HAS ROWS → Data exists, check LCA structure

TEST 6: LCA Status
- If status != 'completed' → LCAs not finalized
- If total_ghg_emissions = 0 → LCA calculations failed

TEST 7: LCA JSON Structure
- Checks if aggregated_impacts matches expected format
- If NULL or wrong structure → Cat 1 calculation will fail

TEST 8: Manual Cat 1 Calculation
- Simulates frontend logic
- If returns NULL → JSON structure mismatch
- If returns values → Confirms calculation should work

TEST 9: Existing Scope 3 Data
- If NO ROWS → Confirms save issue
- If HAS ROWS → Data saves OK, display issue

TEST 10: Foreign Keys
- Verifies database constraints correct

TEST 11: Waste Logs
- Checks operational waste auto-calculation data

TEST 12: Overview
- Quick check of all data sources
*/


-- ============================================
-- NEXT STEPS AFTER RUNNING QUERIES
-- ============================================

/*
1. Run TEST 1 first to confirm corporate_reports exists
2. Run TEST 4 to test if manual INSERT works (identifies RLS issue)
3. Run TEST 9 to check if any Scope 3 data already saved
4. Run TEST 5-8 to diagnose Cat 1 (Purchased Goods) issue
5. Share results to identify root cause and create fix
*/
