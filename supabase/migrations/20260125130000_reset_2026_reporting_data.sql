-- Migration: Reset 2026 Reporting Data
-- Purpose: Delete all reporting/LCA data while preserving products, facilities, ingredients, and packaging
-- This allows testing the platform from a clean slate

BEGIN;

-- ============================================================================
-- SECTION 1: Product Carbon Footprint (LCA) Data
-- Delete child tables first, then parent
-- ============================================================================

-- Clear the latest_lca_id reference from products table first (preserves products, clears FK)
UPDATE products SET latest_lca_id = NULL WHERE latest_lca_id IS NOT NULL;

-- PCF child tables
DELETE FROM product_carbon_footprint_results WHERE TRUE;
DELETE FROM product_carbon_footprint_inputs WHERE TRUE;
DELETE FROM product_carbon_footprint_materials WHERE TRUE;
DELETE FROM product_carbon_footprint_production_sites WHERE TRUE;

-- PCF parent table
DELETE FROM product_carbon_footprints WHERE TRUE;

-- Legacy LCA reports
DELETE FROM lca_reports WHERE TRUE;
DELETE FROM lca_social_indicators WHERE TRUE;

-- ============================================================================
-- SECTION 2: Facility Activity & Emissions Data
-- ============================================================================

-- Facility emissions aggregations (depends on facility_activity_entries)
DELETE FROM facility_emissions_aggregated WHERE TRUE;

-- Facility activity data
DELETE FROM facility_activity_entries WHERE TRUE;
DELETE FROM facility_activity_data WHERE TRUE;

-- Production logs (allocation data)
DELETE FROM production_logs WHERE TRUE;

-- ============================================================================
-- SECTION 3: Water Reporting Data
-- ============================================================================

DELETE FROM facility_water_discharge_quality WHERE TRUE;
DELETE FROM facility_water_data WHERE TRUE;

-- ============================================================================
-- SECTION 4: Circularity Reporting Data
-- ============================================================================

DELETE FROM product_end_of_life_scenarios WHERE TRUE;
DELETE FROM circularity_targets WHERE TRUE;

-- ============================================================================
-- SECTION 5: Core Emissions & Calculations
-- ============================================================================

-- Calculated results (child of activity_data)
DELETE FROM calculated_emissions WHERE TRUE;
DELETE FROM calculated_metrics WHERE TRUE;

-- Calculation audit logs
DELETE FROM calculation_logs WHERE TRUE;

-- Core activity data
DELETE FROM activity_data WHERE TRUE;

-- GHG emissions records
DELETE FROM ghg_emissions WHERE TRUE;

-- ============================================================================
-- SECTION 7: Corporate Reporting
-- ============================================================================

DELETE FROM corporate_reports WHERE TRUE;
DELETE FROM corporate_overheads WHERE TRUE;

-- ============================================================================
-- SECTION 8: KPI Data
-- ============================================================================

DELETE FROM kpi_data_points WHERE TRUE;

-- ============================================================================
-- SECTION 9: Supplier Data Submissions
-- ============================================================================

DELETE FROM supplier_data_submissions WHERE TRUE;

-- ============================================================================
-- SECTION 10: Spend Import Data
-- ============================================================================

-- Child table first
DELETE FROM spend_import_items WHERE TRUE;
DELETE FROM spend_import_batches WHERE TRUE;

-- ============================================================================
-- SECTION 11: Data Provenance & Audit Trail
-- ============================================================================

-- Child table first
DELETE FROM data_provenance_verification_history WHERE TRUE;
DELETE FROM data_provenance_trail WHERE TRUE;

-- ============================================================================
-- SECTION 12: Certification & Scoring History
-- ============================================================================

DELETE FROM certification_score_history WHERE TRUE;
DELETE FROM organization_certifications WHERE TRUE;

COMMIT;

-- ============================================================================
-- PRESERVED DATA (for reference - these are NOT deleted):
-- ============================================================================
-- products                        - Product definitions
-- facilities                      - Facility definitions
-- supplier_products               - Ingredient catalog
-- product_lca_materials           - Product-to-ingredient/packaging links
-- ingredient_selection_audit      - Ingredient selection audit trail
-- packaging_material_components   - Packaging material breakdown
-- packaging_circularity_profiles  - Material circularity reference
-- emissions_factors               - Emission factors (immutable)
-- aware_factors                   - Water scarcity reference factors
-- profiles, organizations         - User/org data
-- All knowledge base tables
-- ============================================================================
