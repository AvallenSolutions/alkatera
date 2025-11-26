/*
  ================================================================
  SYSTEM PURGE SCRIPT - CLEAR ALL TEST DATA
  ================================================================

  WARNING: This script will delete ALL product and activity data.

  PRESERVED:
  - Users (auth.users)
  - Organizations (organizations)
  - Organization Members (organization_members)
  - Emission Factors (emissions_factors, staging_emission_factors)

  DELETED:
  - All Products and Product LCAs
  - All Product Materials (Ingredients & Packaging)
  - All Activity Data (scope 1, 2, 3)
  - All Production Logs
  - All Calculation Logs
  - All Audit Trails

  EXECUTE IN SUPABASE SQL EDITOR:
  Copy and paste this entire script into the SQL editor and run.
*/

-- =====================================================
-- STEP 1: PURGE PRODUCT LCA DATA
-- =====================================================

DELETE FROM product_lca_results;
-- Expected: Removes all LCA calculation results

DELETE FROM product_lca_materials;
-- Expected: Removes all materials linked to LCAs

DELETE FROM product_lcas;
-- Expected: Removes all LCA records

DELETE FROM products;
-- Expected: Removes all products (CASCADE will handle dependent records)

-- =====================================================
-- STEP 2: PURGE ACTIVITY DATA
-- =====================================================

DELETE FROM calculated_emissions;
-- Expected: Removes all calculated emission records

DELETE FROM calculated_metrics;
-- Expected: Removes all calculated metrics

DELETE FROM activity_data;
-- Expected: Removes all raw activity data entries

-- =====================================================
-- STEP 3: PURGE PRODUCTION DATA
-- =====================================================

DELETE FROM production_logs;
-- Expected: Removes all production log entries

-- =====================================================
-- STEP 4: PURGE CORPORATE CARBON FOOTPRINT DATA
-- =====================================================

DELETE FROM corporate_overheads WHERE id IS NOT NULL;
-- Expected: Removes all corporate overhead records

DELETE FROM corporate_overhead_categories WHERE id IS NOT NULL;
-- Expected: Removes all overhead categories

-- =====================================================
-- STEP 5: PURGE CALCULATION LOGS
-- =====================================================

DELETE FROM calculation_logs;
-- Expected: Removes all calculation audit logs

-- =====================================================
-- STEP 6: PURGE AUDIT TRAILS
-- =====================================================

DELETE FROM ingredient_selection_audit WHERE id IS NOT NULL;
-- Expected: Removes ingredient selection audit trail

DELETE FROM data_provenance_trail WHERE id IS NOT NULL;
-- Expected: Removes data provenance records

-- =====================================================
-- STEP 7: VERIFICATION QUERY
-- =====================================================

SELECT
  'products' as table_name,
  COUNT(*) as remaining_records
FROM products
UNION ALL
SELECT 'product_lcas', COUNT(*) FROM product_lcas
UNION ALL
SELECT 'product_lca_materials', COUNT(*) FROM product_lca_materials
UNION ALL
SELECT 'activity_data', COUNT(*) FROM activity_data
UNION ALL
SELECT 'calculation_logs', COUNT(*) FROM calculation_logs
UNION ALL
SELECT 'production_logs', COUNT(*) FROM production_logs
UNION ALL
SELECT '--- PRESERVED DATA ---', NULL
UNION ALL
SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL
SELECT 'organization_members', COUNT(*) FROM organization_members
UNION ALL
SELECT 'staging_emission_factors', COUNT(*) FROM staging_emission_factors
UNION ALL
SELECT 'emissions_factors', COUNT(*) FROM emissions_factors
ORDER BY table_name;

-- =====================================================
-- EXPECTED RESULT:
-- All product/activity tables should show 0 records
-- Preserved tables should show existing counts
-- =====================================================
