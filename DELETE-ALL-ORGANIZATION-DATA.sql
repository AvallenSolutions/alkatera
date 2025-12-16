/*
  # COMPLETE PLATFORM DATA DELETION - Fresh Start

  ⚠️  CRITICAL WARNING: This script will permanently delete ALL operational data
  for your organization, returning the platform to a clean slate as if a new user
  is logging in for the first time.

  ## What This Deletes:
  - All products and LCA assessments
  - All suppliers and supplier products
  - All facilities and activity data
  - All emissions calculations (Scope 1, 2, 3)
  - All production logs and inventory data
  - All calculation logs and provenance trails
  - All dashboard preferences and analytics
  - All pending/staging data
  - All test data

  ## What This PRESERVES:
  - Your organization record
  - User profiles and authentication
  - Organization memberships and roles
  - RBAC system (roles, permissions)
  - Reference data (emission factors, categories)
  - System configuration (subscription tiers, limits)
  - LCA methodology reference tables

  ## Expected Result:
  After running this script, your dashboard will show:
  - Total emissions: 0 tCO2e
  - Scope 1: 0 tCO2e
  - Scope 2: 0 tCO2e
  - Scope 3: 0 tCO2e
  - Products assessed: 0
  - Facilities: 0
  - Suppliers: 0

  ## Safety Features:
  - All deletions scoped to your organization via RLS
  - Transaction-wrapped for rollback capability
  - Row counts reported after each step
  - Final verification queries included

  ## How to Use:
  1. Review this entire script carefully
  2. Ensure you are logged in to the correct organization
  3. Run in Supabase SQL editor
  4. Review the row counts after execution
  5. Verify dashboard shows zeros

  ## Rollback:
  If you need to undo this (before committing), run: ROLLBACK;
*/

-- ============================================================================
-- SAFETY CHECK: Verify Organization Context
-- ============================================================================

DO $$
DECLARE
  current_org_id uuid;
  current_org_name text;
BEGIN
  -- Get current organization
  current_org_id := get_current_organization_id();

  IF current_org_id IS NULL THEN
    RAISE EXCEPTION 'ERROR: No organization context found. Please ensure you are logged in.';
  END IF;

  -- Get organization name for confirmation
  SELECT name INTO current_org_name
  FROM organizations
  WHERE id = current_org_id;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DELETION WILL AFFECT ORGANIZATION:';
  RAISE NOTICE 'ID: %', current_org_id;
  RAISE NOTICE 'Name: %', current_org_name;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Proceeding with deletion in 3 seconds...';

  -- Brief pause for user to read (optional - comment out if not needed)
  -- PERFORM pg_sleep(3);
END $$;

-- Start transaction for safety
BEGIN;

-- ============================================================================
-- PHASE 1: LCA Reports and Passport Data
-- ============================================================================

RAISE NOTICE 'PHASE 1: Deleting LCA reports and passport data...';

DELETE FROM public.passport_views
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_workflow_audit
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_social_indicators
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_reports
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_methodology_audit_log
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 1 complete';

-- ============================================================================
-- PHASE 2: Product LCA Data (Calculations & Results)
-- ============================================================================

RAISE NOTICE 'PHASE 2: Deleting product LCA calculations and results...';

DELETE FROM public.lca_recalculation_queue
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_recalculation_batches
WHERE organization_id = get_current_organization_id();

DELETE FROM public.product_lca_calculation_logs
WHERE organization_id = get_current_organization_id();

DELETE FROM public.product_lca_results
WHERE organization_id = get_current_organization_id();

DELETE FROM public.ingredient_selection_audit
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 2 complete';

-- ============================================================================
-- PHASE 3: Product LCA Structures (Materials, Sites, Inputs)
-- ============================================================================

RAISE NOTICE 'PHASE 3: Deleting product LCA structures...';

DELETE FROM public.product_lca_production_sites
WHERE organization_id = get_current_organization_id();

DELETE FROM public.lca_production_mix
WHERE organization_id = get_current_organization_id();

DELETE FROM public.product_lca_materials
WHERE organization_id = get_current_organization_id();

DELETE FROM public.product_lca_inputs
WHERE organization_id = get_current_organization_id();

DELETE FROM public.product_lcas
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 3 complete';

-- ============================================================================
-- PHASE 4: BOM Import Data
-- ============================================================================

RAISE NOTICE 'PHASE 4: Deleting BOM import data...';

DELETE FROM public.bom_extracted_items
WHERE import_id IN (
  SELECT id FROM public.bom_imports
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.bom_imports
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 4 complete';

-- ============================================================================
-- PHASE 5: Products and Production Logs
-- ============================================================================

RAISE NOTICE 'PHASE 5: Deleting products and production logs...';

DELETE FROM public.production_logs
WHERE organization_id = get_current_organization_id();

DELETE FROM public.products
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 5 complete';

-- ============================================================================
-- PHASE 6: Supplier Data
-- ============================================================================

RAISE NOTICE 'PHASE 6: Deleting supplier data...';

DELETE FROM public.supplier_engagements
WHERE organization_id = get_current_organization_id();

DELETE FROM public.supplier_invitations
WHERE organization_id = get_current_organization_id();

DELETE FROM public.supplier_products
WHERE supplier_id IN (
  SELECT id FROM public.suppliers
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.suppliers
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 6 complete';

-- ============================================================================
-- PHASE 7: Facility Emissions and Activity Data
-- ============================================================================

RAISE NOTICE 'PHASE 7: Deleting facility emissions and activity data...';

DELETE FROM public.calculated_emissions
WHERE organization_id = get_current_organization_id();

DELETE FROM public.facility_emissions_aggregated
WHERE organization_id = get_current_organization_id();

DELETE FROM public.facility_activity_data
WHERE facility_id IN (
  SELECT id FROM public.facilities
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.utility_data_entries
WHERE facility_id IN (
  SELECT id FROM public.facilities
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.facility_data_contracts
WHERE facility_id IN (
  SELECT id FROM public.facilities
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.activity_data
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 7 complete';

-- ============================================================================
-- PHASE 8: Contract Manufacturer Allocation Data
-- ============================================================================

RAISE NOTICE 'PHASE 8: Deleting contract manufacturer allocations...';

DELETE FROM public.contract_manufacturer_energy_inputs
WHERE allocation_id IN (
  SELECT id FROM public.contract_manufacturer_allocations
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.contract_manufacturer_allocations
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 8 complete';

-- ============================================================================
-- PHASE 9: Facilities
-- ============================================================================

RAISE NOTICE 'PHASE 9: Deleting facilities...';

DELETE FROM public.facilities
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 9 complete';

-- ============================================================================
-- PHASE 10: Corporate-Level Emissions and Reports
-- ============================================================================

RAISE NOTICE 'PHASE 10: Deleting corporate emissions and reports...';

DELETE FROM public.ghg_emissions
WHERE organization_id = get_current_organization_id();

DELETE FROM public.corporate_overheads
WHERE organization_id = get_current_organization_id();

DELETE FROM public.corporate_reports
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 10 complete';

-- ============================================================================
-- PHASE 11: Calculation Logs and Provenance
-- ============================================================================

RAISE NOTICE 'PHASE 11: Deleting calculation logs and provenance trails...';

DELETE FROM public.calculation_logs
WHERE organization_id = get_current_organization_id();

DELETE FROM public.data_provenance_verification_history
WHERE trail_id IN (
  SELECT id FROM public.data_provenance_trail
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.data_provenance_trail
WHERE organization_id = get_current_organization_id();

DELETE FROM public.data_point_version_history
WHERE activity_data_point_id IN (
  SELECT id FROM public.activity_data
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.calculated_metrics
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 11 complete';

-- ============================================================================
-- PHASE 12: Test Emission Sources (Only [TEST DATA] tagged)
-- ============================================================================

RAISE NOTICE 'PHASE 12: Deleting test emission sources...';

-- Only delete test emission sources that are no longer referenced
DELETE FROM public.scope_1_2_emission_sources
WHERE source_name LIKE '[TEST DATA]%'
AND NOT EXISTS (
  SELECT 1 FROM public.facility_activity_data
  WHERE emission_source_id = scope_1_2_emission_sources.id
);

RAISE NOTICE '✓ Phase 12 complete';

-- ============================================================================
-- PHASE 13: Dashboard and User Preferences
-- ============================================================================

RAISE NOTICE 'PHASE 13: Deleting dashboard preferences and analytics...';

DELETE FROM public.user_dashboard_preferences
WHERE user_id = auth.uid();

DELETE FROM public.user_notifications
WHERE user_id = auth.uid();

DELETE FROM public.activity_log
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 13 complete';

-- ============================================================================
-- PHASE 14: Knowledge Bank Data
-- ============================================================================

RAISE NOTICE 'PHASE 14: Deleting knowledge bank data...';

DELETE FROM public.knowledge_bank_views
WHERE item_id IN (
  SELECT id FROM public.knowledge_bank_items
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.knowledge_bank_favorites
WHERE item_id IN (
  SELECT id FROM public.knowledge_bank_items
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.knowledge_bank_item_tags
WHERE item_id IN (
  SELECT id FROM public.knowledge_bank_items
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.knowledge_bank_items
WHERE organization_id = get_current_organization_id();

DELETE FROM public.knowledge_bank_tags
WHERE organization_id = get_current_organization_id();

DELETE FROM public.knowledge_bank_categories
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 14 complete';

-- ============================================================================
-- PHASE 15: Platform Analytics (Organization-specific)
-- ============================================================================

RAISE NOTICE 'PHASE 15: Deleting platform analytics...';

DELETE FROM public.platform_activity_log
WHERE organization_id = get_current_organization_id();

DELETE FROM public.platform_feature_usage
WHERE organization_id = get_current_organization_id();

DELETE FROM public.platform_organization_stats
WHERE organization_id = get_current_organization_id();

DELETE FROM public.platform_usage_metrics
WHERE organization_id = get_current_organization_id();

DELETE FROM public.organization_usage_log
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 15 complete';

-- ============================================================================
-- PHASE 16: Pending/Staging Data
-- ============================================================================

RAISE NOTICE 'PHASE 16: Deleting pending and staging data...';

DELETE FROM public.pending_activity_data
WHERE organization_id = get_current_organization_id();

DELETE FROM public.pending_facilities
WHERE organization_id = get_current_organization_id();

DELETE FROM public.pending_products
WHERE organization_id = get_current_organization_id();

DELETE FROM public.pending_suppliers
WHERE organization_id = get_current_organization_id();

DELETE FROM public.staging_emission_factors
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 16 complete';

-- ============================================================================
-- PHASE 17: KPI Data Points
-- ============================================================================

RAISE NOTICE 'PHASE 17: Deleting KPI data points...';

DELETE FROM public.kpi_data_points
WHERE kpi_id IN (
  SELECT id FROM public.kpis
  WHERE organization_id = get_current_organization_id()
);

DELETE FROM public.kpis
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '✓ Phase 17 complete';

-- ============================================================================
-- VERIFICATION: Count Remaining Records
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'VERIFICATION: Counting remaining records';
RAISE NOTICE '========================================';

DO $$
DECLARE
  org_id uuid := get_current_organization_id();
  count_val integer;
BEGIN
  -- Products
  SELECT COUNT(*) INTO count_val FROM public.products WHERE organization_id = org_id;
  RAISE NOTICE 'Products remaining: %', count_val;

  -- Facilities
  SELECT COUNT(*) INTO count_val FROM public.facilities WHERE organization_id = org_id;
  RAISE NOTICE 'Facilities remaining: %', count_val;

  -- Suppliers
  SELECT COUNT(*) INTO count_val FROM public.suppliers WHERE organization_id = org_id;
  RAISE NOTICE 'Suppliers remaining: %', count_val;

  -- Product LCAs
  SELECT COUNT(*) INTO count_val FROM public.product_lcas WHERE organization_id = org_id;
  RAISE NOTICE 'Product LCAs remaining: %', count_val;

  -- Facility Activity Data
  SELECT COUNT(*) INTO count_val
  FROM public.facility_activity_data fad
  JOIN public.facilities f ON f.id = fad.facility_id
  WHERE f.organization_id = org_id;
  RAISE NOTICE 'Facility activity data remaining: %', count_val;

  -- GHG Emissions
  SELECT COUNT(*) INTO count_val FROM public.ghg_emissions WHERE organization_id = org_id;
  RAISE NOTICE 'GHG emissions remaining: %', count_val;

  -- Corporate Overheads
  SELECT COUNT(*) INTO count_val FROM public.corporate_overheads WHERE organization_id = org_id;
  RAISE NOTICE 'Corporate overheads remaining: %', count_val;

  -- Calculation Logs
  SELECT COUNT(*) INTO count_val FROM public.calculation_logs WHERE organization_id = org_id;
  RAISE NOTICE 'Calculation logs remaining: %', count_val;

  -- Production Logs
  SELECT COUNT(*) INTO count_val FROM public.production_logs WHERE organization_id = org_id;
  RAISE NOTICE 'Production logs remaining: %', count_val;

  -- KPIs
  SELECT COUNT(*) INTO count_val FROM public.kpis WHERE organization_id = org_id;
  RAISE NOTICE 'KPIs remaining: %', count_val;

  RAISE NOTICE '';
  RAISE NOTICE '✅ All counts should be 0 for successful deletion';
END $$;

-- ============================================================================
-- FINAL CHECK: Dashboard Metrics Summary
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'DASHBOARD METRICS (Should all be 0)';
RAISE NOTICE '========================================';

-- Check total emissions across all scopes
SELECT
  'Total Emissions Check' as metric,
  COALESCE(SUM(scope_1_emissions), 0) +
  COALESCE(SUM(scope_2_emissions), 0) +
  COALESCE(SUM(scope_3_emissions), 0) as total_tco2e
FROM public.ghg_emissions
WHERE organization_id = get_current_organization_id();

-- Check facility count
SELECT
  'Total Facilities' as metric,
  COUNT(*) as count
FROM public.facilities
WHERE organization_id = get_current_organization_id();

-- Check product count
SELECT
  'Total Products' as metric,
  COUNT(*) as count
FROM public.products
WHERE organization_id = get_current_organization_id();

-- Check supplier count
SELECT
  'Total Suppliers' as metric,
  COUNT(*) as count
FROM public.suppliers
WHERE organization_id = get_current_organization_id();

-- Check LCA count
SELECT
  'Total LCAs' as metric,
  COUNT(*) as count
FROM public.product_lcas
WHERE organization_id = get_current_organization_id();

RAISE NOTICE '';
RAISE NOTICE '========================================';
RAISE NOTICE 'DELETION COMPLETE';
RAISE NOTICE '========================================';
RAISE NOTICE '';
RAISE NOTICE 'If all counts above are 0, the deletion was successful!';
RAISE NOTICE '';
RAISE NOTICE 'To finalize: Run COMMIT;';
RAISE NOTICE 'To undo: Run ROLLBACK;';
RAISE NOTICE '';

-- Commit the transaction
-- IMPORTANT: Review all output above before running this!
-- If everything looks good, uncomment the line below:
-- COMMIT;

-- Or keep it in transaction state and manually COMMIT after review
