/*
  # DELETE ALL DATA FROM TEST ORGANISATION

  This script deletes ALL operational data for the Test organisation,
  returning it to a clean slate for final testing.

  Target Organisation: Test
  Organisation ID: 1a82261c-0722-4e9f-9b92-bf8ac914f77e

  ## What This Deletes:
  - All products and LCA assessments
  - All suppliers and supplier products
  - All facilities and activity data
  - All emissions calculations (Scope 1, 2, 3)
  - All production logs and inventory data
  - All calculation logs and provenance trails
  - All dashboard preferences and analytics
  - All pending/staging data

  ## What This PRESERVES:
  - The Test organization record itself
  - User profiles and authentication
  - Organization memberships and roles
  - Reference data (emission factors, categories)

  ## How to Use:
  1. Run this script in Supabase SQL Editor (as service role)
  2. Review the verification counts
  3. Run COMMIT; to finalize or ROLLBACK; to undo
*/

-- Define the target organization ID
DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  org_name text;
BEGIN
  SELECT name INTO org_name FROM organizations WHERE id = target_org_id;

  IF org_name IS NULL THEN
    RAISE EXCEPTION 'Organization not found with ID: %', target_org_id;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DELETION WILL AFFECT ORGANIZATION:';
  RAISE NOTICE 'ID: %', target_org_id;
  RAISE NOTICE 'Name: %', org_name;
  RAISE NOTICE '========================================';
END $$;

-- Start transaction for safety
BEGIN;

-- ============================================================================
-- PHASE 1: LCA Reports and Passport Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 1: Deleting LCA reports and passport data...';

  DELETE FROM public.passport_views WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - passport_views: % rows deleted', row_count;

  DELETE FROM public.lca_workflow_audit WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_workflow_audit: % rows deleted', row_count;

  DELETE FROM public.lca_social_indicators WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_social_indicators: % rows deleted', row_count;

  DELETE FROM public.lca_reports WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_reports: % rows deleted', row_count;

  DELETE FROM public.lca_methodology_audit_log WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_methodology_audit_log: % rows deleted', row_count;

  RAISE NOTICE 'Phase 1 complete';
END $$;

-- ============================================================================
-- PHASE 2: Product LCA Data (Calculations & Results)
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 2: Deleting product LCA calculations and results...';

  DELETE FROM public.lca_recalculation_queue WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_recalculation_queue: % rows deleted', row_count;

  DELETE FROM public.lca_recalculation_batches WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_recalculation_batches: % rows deleted', row_count;

  DELETE FROM public.product_lca_calculation_logs WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lca_calculation_logs: % rows deleted', row_count;

  DELETE FROM public.product_lca_results WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lca_results: % rows deleted', row_count;

  DELETE FROM public.ingredient_selection_audit WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - ingredient_selection_audit: % rows deleted', row_count;

  RAISE NOTICE 'Phase 2 complete';
END $$;

-- ============================================================================
-- PHASE 3: Product LCA Structures (Materials, Sites, Inputs)
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 3: Deleting product LCA structures...';

  DELETE FROM public.product_lca_production_sites WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lca_production_sites: % rows deleted', row_count;

  DELETE FROM public.lca_production_mix WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - lca_production_mix: % rows deleted', row_count;

  DELETE FROM public.product_lca_materials WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lca_materials: % rows deleted', row_count;

  DELETE FROM public.product_lca_inputs WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lca_inputs: % rows deleted', row_count;

  DELETE FROM public.product_lcas WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - product_lcas: % rows deleted', row_count;

  RAISE NOTICE 'Phase 3 complete';
END $$;

-- ============================================================================
-- PHASE 4: BOM Import Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 4: Deleting BOM import data...';

  DELETE FROM public.bom_extracted_items
  WHERE import_id IN (
    SELECT id FROM public.bom_imports WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - bom_extracted_items: % rows deleted', row_count;

  DELETE FROM public.bom_imports WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - bom_imports: % rows deleted', row_count;

  RAISE NOTICE 'Phase 4 complete';
END $$;

-- ============================================================================
-- PHASE 5: Products and Production Logs
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 5: Deleting products and production logs...';

  DELETE FROM public.production_logs WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - production_logs: % rows deleted', row_count;

  DELETE FROM public.products WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - products: % rows deleted', row_count;

  RAISE NOTICE 'Phase 5 complete';
END $$;

-- ============================================================================
-- PHASE 6: Supplier Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 6: Deleting supplier data...';

  DELETE FROM public.supplier_engagements WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - supplier_engagements: % rows deleted', row_count;

  DELETE FROM public.supplier_invitations WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - supplier_invitations: % rows deleted', row_count;

  DELETE FROM public.supplier_products
  WHERE supplier_id IN (
    SELECT id FROM public.suppliers WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - supplier_products: % rows deleted', row_count;

  DELETE FROM public.suppliers WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - suppliers: % rows deleted', row_count;

  RAISE NOTICE 'Phase 6 complete';
END $$;

-- ============================================================================
-- PHASE 7: Facility Emissions and Activity Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 7: Deleting facility emissions and activity data...';

  DELETE FROM public.calculated_emissions WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - calculated_emissions: % rows deleted', row_count;

  DELETE FROM public.facility_emissions_aggregated WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - facility_emissions_aggregated: % rows deleted', row_count;

  DELETE FROM public.facility_activity_data
  WHERE facility_id IN (
    SELECT id FROM public.facilities WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - facility_activity_data: % rows deleted', row_count;

  DELETE FROM public.utility_data_entries
  WHERE facility_id IN (
    SELECT id FROM public.facilities WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - utility_data_entries: % rows deleted', row_count;

  DELETE FROM public.facility_data_contracts
  WHERE facility_id IN (
    SELECT id FROM public.facilities WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - facility_data_contracts: % rows deleted', row_count;

  DELETE FROM public.activity_data WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - activity_data: % rows deleted', row_count;

  RAISE NOTICE 'Phase 7 complete';
END $$;

-- ============================================================================
-- PHASE 8: Contract Manufacturer Allocation Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 8: Deleting contract manufacturer allocations...';

  DELETE FROM public.contract_manufacturer_energy_inputs
  WHERE allocation_id IN (
    SELECT id FROM public.contract_manufacturer_allocations WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - contract_manufacturer_energy_inputs: % rows deleted', row_count;

  DELETE FROM public.contract_manufacturer_allocations WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - contract_manufacturer_allocations: % rows deleted', row_count;

  RAISE NOTICE 'Phase 8 complete';
END $$;

-- ============================================================================
-- PHASE 9: Facilities
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 9: Deleting facilities...';

  DELETE FROM public.facilities WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - facilities: % rows deleted', row_count;

  RAISE NOTICE 'Phase 9 complete';
END $$;

-- ============================================================================
-- PHASE 10: Corporate-Level Emissions and Reports
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 10: Deleting corporate emissions and reports...';

  DELETE FROM public.ghg_emissions WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - ghg_emissions: % rows deleted', row_count;

  DELETE FROM public.corporate_overheads WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - corporate_overheads: % rows deleted', row_count;

  DELETE FROM public.corporate_reports WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - corporate_reports: % rows deleted', row_count;

  RAISE NOTICE 'Phase 10 complete';
END $$;

-- ============================================================================
-- PHASE 11: Calculation Logs and Provenance
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 11: Deleting calculation logs and provenance trails...';

  DELETE FROM public.calculation_logs WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - calculation_logs: % rows deleted', row_count;

  DELETE FROM public.data_provenance_verification_history
  WHERE trail_id IN (
    SELECT id FROM public.data_provenance_trail WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - data_provenance_verification_history: % rows deleted', row_count;

  DELETE FROM public.data_provenance_trail WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - data_provenance_trail: % rows deleted', row_count;

  DELETE FROM public.calculated_metrics WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - calculated_metrics: % rows deleted', row_count;

  RAISE NOTICE 'Phase 11 complete';
END $$;

-- ============================================================================
-- PHASE 12: Dashboard and Analytics
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 12: Deleting dashboard and analytics data...';

  DELETE FROM public.activity_log WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - activity_log: % rows deleted', row_count;

  RAISE NOTICE 'Phase 12 complete';
END $$;

-- ============================================================================
-- PHASE 13: Knowledge Bank Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 13: Deleting knowledge bank data...';

  DELETE FROM public.knowledge_bank_views
  WHERE item_id IN (
    SELECT id FROM public.knowledge_bank_items WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_views: % rows deleted', row_count;

  DELETE FROM public.knowledge_bank_favorites
  WHERE item_id IN (
    SELECT id FROM public.knowledge_bank_items WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_favorites: % rows deleted', row_count;

  DELETE FROM public.knowledge_bank_item_tags
  WHERE item_id IN (
    SELECT id FROM public.knowledge_bank_items WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_item_tags: % rows deleted', row_count;

  DELETE FROM public.knowledge_bank_items WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_items: % rows deleted', row_count;

  DELETE FROM public.knowledge_bank_tags WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_tags: % rows deleted', row_count;

  DELETE FROM public.knowledge_bank_categories WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - knowledge_bank_categories: % rows deleted', row_count;

  RAISE NOTICE 'Phase 13 complete';
END $$;

-- ============================================================================
-- PHASE 14: Platform Analytics (Organization-specific)
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 14: Deleting platform analytics...';

  DELETE FROM public.platform_activity_log WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - platform_activity_log: % rows deleted', row_count;

  DELETE FROM public.platform_feature_usage WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - platform_feature_usage: % rows deleted', row_count;

  DELETE FROM public.platform_organization_stats WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - platform_organization_stats: % rows deleted', row_count;

  DELETE FROM public.platform_usage_metrics WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - platform_usage_metrics: % rows deleted', row_count;

  DELETE FROM public.organization_usage_log WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - organization_usage_log: % rows deleted', row_count;

  RAISE NOTICE 'Phase 14 complete';
END $$;

-- ============================================================================
-- PHASE 15: Pending/Staging Data
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 15: Deleting pending and staging data...';

  DELETE FROM public.pending_activity_data WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - pending_activity_data: % rows deleted', row_count;

  DELETE FROM public.pending_facilities WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - pending_facilities: % rows deleted', row_count;

  DELETE FROM public.pending_products WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - pending_products: % rows deleted', row_count;

  DELETE FROM public.pending_suppliers WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - pending_suppliers: % rows deleted', row_count;

  DELETE FROM public.staging_emission_factors WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - staging_emission_factors: % rows deleted', row_count;

  RAISE NOTICE 'Phase 15 complete';
END $$;

-- ============================================================================
-- PHASE 16: KPI Data Points
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  row_count integer;
BEGIN
  RAISE NOTICE 'PHASE 16: Deleting KPI data points...';

  DELETE FROM public.kpi_data_points
  WHERE kpi_id IN (
    SELECT id FROM public.kpis WHERE organization_id = target_org_id
  );
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - kpi_data_points: % rows deleted', row_count;

  DELETE FROM public.kpis WHERE organization_id = target_org_id;
  GET DIAGNOSTICS row_count = ROW_COUNT;
  RAISE NOTICE '  - kpis: % rows deleted', row_count;

  RAISE NOTICE 'Phase 16 complete';
END $$;

-- ============================================================================
-- VERIFICATION: Count Remaining Records
-- ============================================================================

DO $$
DECLARE
  target_org_id uuid := '1a82261c-0722-4e9f-9b92-bf8ac914f77e';
  count_val integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION: Counting remaining records';
  RAISE NOTICE '========================================';

  SELECT COUNT(*) INTO count_val FROM public.products WHERE organization_id = target_org_id;
  RAISE NOTICE 'Products remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.facilities WHERE organization_id = target_org_id;
  RAISE NOTICE 'Facilities remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.suppliers WHERE organization_id = target_org_id;
  RAISE NOTICE 'Suppliers remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.product_lcas WHERE organization_id = target_org_id;
  RAISE NOTICE 'Product LCAs remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.ghg_emissions WHERE organization_id = target_org_id;
  RAISE NOTICE 'GHG emissions remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.corporate_overheads WHERE organization_id = target_org_id;
  RAISE NOTICE 'Corporate overheads remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.calculation_logs WHERE organization_id = target_org_id;
  RAISE NOTICE 'Calculation logs remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.production_logs WHERE organization_id = target_org_id;
  RAISE NOTICE 'Production logs remaining: %', count_val;

  SELECT COUNT(*) INTO count_val FROM public.kpis WHERE organization_id = target_org_id;
  RAISE NOTICE 'KPIs remaining: %', count_val;

  -- Verify organization still exists
  SELECT COUNT(*) INTO count_val FROM public.organizations WHERE id = target_org_id;
  RAISE NOTICE '';
  RAISE NOTICE 'Organization record preserved: %', CASE WHEN count_val = 1 THEN 'YES' ELSE 'NO - ERROR!' END;

  RAISE NOTICE '';
  RAISE NOTICE 'All counts should be 0 (except organization = YES)';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DELETION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'To finalize: Run COMMIT;';
  RAISE NOTICE 'To undo: Run ROLLBACK;';
END $$;
