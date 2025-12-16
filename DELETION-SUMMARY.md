# Data Deletion Summary

## Quick Reference

**Script:** `DELETE-ALL-ORGANIZATION-DATA.sql`
**Guide:** `DATA-DELETION-GUIDE.md`
**Safety:** Transaction-wrapped with ROLLBACK capability
**Scope:** Current organisation only (via RLS)

## Execution Steps

1. Open Supabase SQL Editor
2. Copy contents of `DELETE-ALL-ORGANIZATION-DATA.sql`
3. Run the script
4. Review verification counts (all should be 0)
5. Run `COMMIT;` to finalize or `ROLLBACK;` to undo

## Expected Dashboard State After Deletion

```
┌─────────────────────────────────────────┐
│ Emissions Metrics                       │
├─────────────────────────────────────────┤
│ Total:    0 tCO2e                      │
│ Scope 1:  0 tCO2e                      │
│ Scope 2:  0 tCO2e                      │
│ Scope 3:  0 tCO2e                      │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Inventory Counts                        │
├─────────────────────────────────────────┤
│ Products:    0                          │
│ Facilities:  0                          │
│ Suppliers:   0                          │
│ LCAs:        0                          │
└─────────────────────────────────────────┘
```

## 17 Deletion Phases

1. **LCA Reports & Passport Data** - Published reports and public passports
2. **Product LCA Calculations** - All calculation results and queue items
3. **Product LCA Structures** - Materials, production sites, inputs
4. **BOM Import Data** - Imported bill of materials sessions
5. **Products & Production** - Product master data and production logs
6. **Supplier Data** - Suppliers, products, engagements, invitations
7. **Facility Emissions** - Activity data and emissions calculations
8. **Contract Manufacturer** - CM allocations and energy inputs
9. **Facilities** - Facility master records
10. **Corporate Emissions** - Corporate reports and overhead activities
11. **Calculation Logs** - All calculation history and provenance
12. **Test Emission Sources** - Test data marked with [TEST DATA]
13. **Dashboard Data** - Preferences, notifications, activity log
14. **Knowledge Bank** - Documents, categories, tags, views
15. **Platform Analytics** - Usage metrics and feature tracking
16. **Pending/Staging** - Unapproved data awaiting review
17. **KPI Data** - KPI definitions and historical data points

## Tables Deleted (50+ tables)

### Product & LCA Data
- `product_lcas`, `product_lca_materials`, `product_lca_inputs`, `product_lca_results`
- `product_lca_production_sites`, `product_lca_calculation_logs`
- `lca_production_mix`, `lca_reports`, `lca_social_indicators`
- `lca_workflow_audit`, `lca_methodology_audit_log`
- `lca_recalculation_queue`, `lca_recalculation_batches`
- `ingredient_selection_audit`, `passport_views`
- `products`, `production_logs`

### BOM Import
- `bom_imports`, `bom_extracted_items`

### Supplier Data
- `suppliers`, `supplier_products`, `supplier_engagements`
- `supplier_invitations`

### Facility & Emissions Data
- `facilities`, `facility_activity_data`, `facility_emissions_aggregated`
- `facility_data_contracts`, `utility_data_entries`
- `activity_data`, `calculated_emissions`
- `scope_1_2_emission_sources` (only test data)

### Contract Manufacturing
- `contract_manufacturer_allocations`
- `contract_manufacturer_energy_inputs`

### Corporate Footprint
- `ghg_emissions`, `corporate_overheads`, `corporate_reports`

### Calculation & Provenance
- `calculation_logs`, `calculated_metrics`
- `data_provenance_trail`, `data_provenance_verification_history`
- `data_point_version_history`

### Dashboard & Analytics
- `user_dashboard_preferences`, `user_notifications`
- `activity_log`
- `platform_usage_metrics`, `platform_organization_stats`
- `platform_feature_usage`, `platform_activity_log`
- `organization_usage_log`

### Knowledge Bank
- `knowledge_bank_items`, `knowledge_bank_categories`
- `knowledge_bank_tags`, `knowledge_bank_item_tags`
- `knowledge_bank_views`, `knowledge_bank_favorites`

### Pending/Staging Data
- `pending_activity_data`, `pending_facilities`
- `pending_products`, `pending_suppliers`
- `staging_emission_factors`

### KPI Tracking
- `kpis`, `kpi_data_points`

## Tables Preserved

### Core System
- `organizations` - Your organisation record
- `profiles` - User accounts
- `organization_members` - Team memberships
- `roles`, `permissions`, `role_permissions` - RBAC system

### Reference Data
- `facility_types` - Facility type definitions
- `lca_life_cycle_stages`, `lca_sub_stages` - LCA stage definitions
- `ghg_categories` - GHG category definitions
- `product_category_proxy_mappings` - Category mappings

### Emission Factor Libraries
- `emissions_factors` - Generic emission factors
- `defra_energy_emission_factors` - DEFRA 2025 factors
- `ecoinvent_material_proxies` - ecoinvent proxy mappings
- `defra_ecoinvent_impact_mappings` - Hybrid system mappings
- `ef31_impact_categories` - EF 3.1 impact categories
- `ef31_normalisation_factors` - EF 3.1 normalisation
- `ef31_weighting_sets`, `ef31_weighting_factors` - EF 3.1 weighting
- `ef31_process_mappings` - EF 3.1 process mappings

### System Configuration
- `subscription_tier_limits` - Tier limits configuration
- `subscription_tier_features` - Feature access configuration
- `openlca_configurations` - OpenLCA connection settings
- `openlca_process_cache` - Process cache (regenerates automatically)
- `dashboard_widgets` - Widget definitions

## Verification Queries

Run these after deletion to confirm success:

```sql
-- Should all return 0
SELECT COUNT(*) FROM products WHERE organization_id = get_current_organization_id();
SELECT COUNT(*) FROM facilities WHERE organization_id = get_current_organization_id();
SELECT COUNT(*) FROM suppliers WHERE organization_id = get_current_organization_id();
SELECT COUNT(*) FROM product_lcas WHERE organization_id = get_current_organization_id();
SELECT COUNT(*) FROM ghg_emissions WHERE organization_id = get_current_organization_id();

-- Should return 0 for total emissions
SELECT
  COALESCE(SUM(scope_1_emissions), 0) +
  COALESCE(SUM(scope_2_emissions), 0) +
  COALESCE(SUM(scope_3_emissions), 0) as total_tco2e
FROM ghg_emissions
WHERE organization_id = get_current_organization_id();
```

## Benefits of Clean Slate

1. **Accurate Testing** - Test calculations with known inputs and expected outputs
2. **Clean Metrics** - Dashboard starts from true zero baseline
3. **Proper Workflows** - Test complete user journeys from scratch
4. **Data Quality** - Ensure all new data has proper provenance tracking
5. **Documentation** - Create test scenarios with clear before/after states

## Next Steps After Deletion

1. ✅ Verify dashboard shows all zeros
2. ✅ Create test facility with realistic energy data
3. ✅ Add test products with proper BOMs
4. ✅ Set up supplier relationships
5. ✅ Log production volumes for allocation
6. ✅ Calculate LCAs and verify results
7. ✅ Test CCF calculation pathways
8. ✅ Generate reports and validate outputs

---

**Ready to proceed?** Review the `DATA-DELETION-GUIDE.md` for detailed instructions.
