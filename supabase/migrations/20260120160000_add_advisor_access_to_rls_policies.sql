/*
  # Add Advisor Access to RLS Policies

  This migration updates RLS policies across multiple tables to allow advisors
  to read and write data for organizations they have access to.

  ## Tables Updated
  - facility_activity_entries
  - emissions_calculation_context
  - utility_data_entries
  - activity_data
  - facilities (read access)
  - facility_emissions_aggregated
*/

-- =============================================================================
-- Helper function to check if user has advisor access to an organization
-- =============================================================================

CREATE OR REPLACE FUNCTION user_has_organization_access(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check regular membership
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check advisor access
  IF EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE organization_id = org_id
      AND advisor_user_id = auth.uid()
      AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION user_has_organization_access IS 'Check if the current user has access to an organization (either as member or advisor)';
GRANT EXECUTE ON FUNCTION user_has_organization_access(UUID) TO authenticated;

-- =============================================================================
-- Update facility_activity_entries policies
-- =============================================================================

DROP POLICY IF EXISTS "fae_select_policy" ON facility_activity_entries;
CREATE POLICY "fae_select_policy" ON facility_activity_entries FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "fae_insert_policy" ON facility_activity_entries;
CREATE POLICY "fae_insert_policy" ON facility_activity_entries FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "fae_update_policy" ON facility_activity_entries;
CREATE POLICY "fae_update_policy" ON facility_activity_entries FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "fae_delete_policy" ON facility_activity_entries;
CREATE POLICY "fae_delete_policy" ON facility_activity_entries FOR DELETE TO authenticated
  USING (user_has_organization_access(organization_id));

-- =============================================================================
-- Update emissions_calculation_context policies
-- =============================================================================

DROP POLICY IF EXISTS "ecc_select_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_select_policy" ON emissions_calculation_context FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "ecc_insert_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_insert_policy" ON emissions_calculation_context FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "ecc_update_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_update_policy" ON emissions_calculation_context FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

-- =============================================================================
-- Update utility_data_entries policies (if table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'utility_data_entries') THEN
    -- Drop existing policies
    DROP POLICY IF EXISTS "utility_data_entries_select" ON utility_data_entries;
    DROP POLICY IF EXISTS "utility_data_entries_insert" ON utility_data_entries;
    DROP POLICY IF EXISTS "utility_data_entries_update" ON utility_data_entries;
    DROP POLICY IF EXISTS "utility_data_entries_delete" ON utility_data_entries;

    -- Create new policies with advisor access
    EXECUTE 'CREATE POLICY "utility_data_entries_select" ON utility_data_entries FOR SELECT TO authenticated
      USING (EXISTS (
        SELECT 1 FROM facilities f
        WHERE f.id = utility_data_entries.facility_id
        AND user_has_organization_access(f.organization_id)
      ))';

    EXECUTE 'CREATE POLICY "utility_data_entries_insert" ON utility_data_entries FOR INSERT TO authenticated
      WITH CHECK (EXISTS (
        SELECT 1 FROM facilities f
        WHERE f.id = utility_data_entries.facility_id
        AND user_has_organization_access(f.organization_id)
      ))';

    EXECUTE 'CREATE POLICY "utility_data_entries_update" ON utility_data_entries FOR UPDATE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM facilities f
        WHERE f.id = utility_data_entries.facility_id
        AND user_has_organization_access(f.organization_id)
      ))';

    EXECUTE 'CREATE POLICY "utility_data_entries_delete" ON utility_data_entries FOR DELETE TO authenticated
      USING (EXISTS (
        SELECT 1 FROM facilities f
        WHERE f.id = utility_data_entries.facility_id
        AND user_has_organization_access(f.organization_id)
      ))';
  END IF;
END $$;

-- =============================================================================
-- Update activity_data policies
-- =============================================================================

DROP POLICY IF EXISTS "activity_data_select" ON activity_data;
CREATE POLICY "activity_data_select" ON activity_data FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "activity_data_insert" ON activity_data;
CREATE POLICY "activity_data_insert" ON activity_data FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "activity_data_update" ON activity_data;
CREATE POLICY "activity_data_update" ON activity_data FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "activity_data_delete" ON activity_data;
CREATE POLICY "activity_data_delete" ON activity_data FOR DELETE TO authenticated
  USING (user_has_organization_access(organization_id));

-- =============================================================================
-- Update facilities policies to include advisor read access
-- =============================================================================

DROP POLICY IF EXISTS "facilities_select" ON facilities;
CREATE POLICY "facilities_select" ON facilities FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

-- Keep existing insert/update/delete policies for regular members only
-- Advisors should not be able to create/delete facilities

-- =============================================================================
-- Update facility_emissions_aggregated policies
-- =============================================================================

DROP POLICY IF EXISTS "fea_select_policy" ON facility_emissions_aggregated;
CREATE POLICY "fea_select_policy" ON facility_emissions_aggregated FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "fea_insert_policy" ON facility_emissions_aggregated;
CREATE POLICY "fea_insert_policy" ON facility_emissions_aggregated FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "fea_update_policy" ON facility_emissions_aggregated;
CREATE POLICY "fea_update_policy" ON facility_emissions_aggregated FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

-- =============================================================================
-- Update calculated_emissions policies
-- =============================================================================

DROP POLICY IF EXISTS "calculated_emissions_select" ON calculated_emissions;
CREATE POLICY "calculated_emissions_select" ON calculated_emissions FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "calculated_emissions_insert" ON calculated_emissions;
CREATE POLICY "calculated_emissions_insert" ON calculated_emissions FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

-- =============================================================================
-- Update products and product_lcas policies for advisor access
-- =============================================================================

DROP POLICY IF EXISTS "products_select" ON products;
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "products_insert" ON products;
CREATE POLICY "products_insert" ON products FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "products_update" ON products;
CREATE POLICY "products_update" ON products FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

-- Product LCAs
DROP POLICY IF EXISTS "product_lcas_select" ON product_lcas;
CREATE POLICY "product_lcas_select" ON product_lcas FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "product_lcas_insert" ON product_lcas;
CREATE POLICY "product_lcas_insert" ON product_lcas FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "product_lcas_update" ON product_lcas;
CREATE POLICY "product_lcas_update" ON product_lcas FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

-- Product LCA production sites
DROP POLICY IF EXISTS "plps_select" ON product_lca_production_sites;
CREATE POLICY "plps_select" ON product_lca_production_sites FOR SELECT TO authenticated
  USING (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "plps_insert" ON product_lca_production_sites;
CREATE POLICY "plps_insert" ON product_lca_production_sites FOR INSERT TO authenticated
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "plps_update" ON product_lca_production_sites;
CREATE POLICY "plps_update" ON product_lca_production_sites FOR UPDATE TO authenticated
  USING (user_has_organization_access(organization_id))
  WITH CHECK (user_has_organization_access(organization_id));

DROP POLICY IF EXISTS "plps_delete" ON product_lca_production_sites;
CREATE POLICY "plps_delete" ON product_lca_production_sites FOR DELETE TO authenticated
  USING (user_has_organization_access(organization_id));
