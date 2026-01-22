/*
  # Rename Product LCA to Product Carbon Footprint (PCF)

  This migration renames all LCA-related tables to use Product Carbon Footprint (PCF)
  terminology, which more accurately describes the methodology being used.

  ## Rationale
  - "LCA" (Life Cycle Assessment) implies full ISO 14044 compliance with critical review
  - "Product Carbon Footprint" (PCF) aligns with ISO 14067 and GHG Protocol Product Standard
  - This terminology better represents our actual methodology and avoids overclaiming

  ## Changes
  1. Rename tables:
     - product_lcas → product_carbon_footprints
     - product_lca_inputs → product_carbon_footprint_inputs
     - product_lca_results → product_carbon_footprint_results
     - product_lca_materials → product_carbon_footprint_materials
     - product_lca_production_sites → product_carbon_footprint_production_sites

  2. Rename foreign key columns:
     - product_lca_id → product_carbon_footprint_id

  3. Update triggers, functions, indexes, and RLS policies

  4. Create backward-compatible views for transition period (can be dropped later)

  ## Safety
  - All renames use IF EXISTS to handle partial migrations gracefully
  - Backward-compatible views maintain old query compatibility
  - No data is modified, only schema names
*/

-- ============================================================================
-- STEP 1: Rename Main Tables
-- ============================================================================

-- Rename product_lcas → product_carbon_footprints
ALTER TABLE IF EXISTS public.product_lcas
  RENAME TO product_carbon_footprints;

-- Rename product_lca_inputs → product_carbon_footprint_inputs
ALTER TABLE IF EXISTS public.product_lca_inputs
  RENAME TO product_carbon_footprint_inputs;

-- Rename product_lca_results → product_carbon_footprint_results
ALTER TABLE IF EXISTS public.product_lca_results
  RENAME TO product_carbon_footprint_results;

-- Rename product_lca_materials → product_carbon_footprint_materials
ALTER TABLE IF EXISTS public.product_lca_materials
  RENAME TO product_carbon_footprint_materials;

-- Rename product_lca_production_sites → product_carbon_footprint_production_sites
ALTER TABLE IF EXISTS public.product_lca_production_sites
  RENAME TO product_carbon_footprint_production_sites;

-- ============================================================================
-- STEP 2: Rename Foreign Key Columns
-- ============================================================================

-- Rename product_lca_id → product_carbon_footprint_id in inputs table
ALTER TABLE IF EXISTS public.product_carbon_footprint_inputs
  RENAME COLUMN product_lca_id TO product_carbon_footprint_id;

-- Rename product_lca_id → product_carbon_footprint_id in results table
ALTER TABLE IF EXISTS public.product_carbon_footprint_results
  RENAME COLUMN product_lca_id TO product_carbon_footprint_id;

-- Rename product_lca_id → product_carbon_footprint_id in materials table
ALTER TABLE IF EXISTS public.product_carbon_footprint_materials
  RENAME COLUMN product_lca_id TO product_carbon_footprint_id;

-- Rename product_lca_id → product_carbon_footprint_id in production sites table
ALTER TABLE IF EXISTS public.product_carbon_footprint_production_sites
  RENAME COLUMN product_lca_id TO product_carbon_footprint_id;

-- ============================================================================
-- STEP 3: Rename Indexes
-- ============================================================================

-- Main table indexes
ALTER INDEX IF EXISTS idx_product_lcas_organization_id
  RENAME TO idx_product_carbon_footprints_organization_id;

ALTER INDEX IF EXISTS idx_product_lcas_status
  RENAME TO idx_product_carbon_footprints_status;

-- Inputs table indexes
ALTER INDEX IF EXISTS idx_product_lca_inputs_lca_id
  RENAME TO idx_product_carbon_footprint_inputs_pcf_id;

-- Results table indexes
ALTER INDEX IF EXISTS idx_product_lca_results_lca_id
  RENAME TO idx_product_carbon_footprint_results_pcf_id;

ALTER INDEX IF EXISTS idx_product_lca_results_category
  RENAME TO idx_product_carbon_footprint_results_category;

-- Materials table indexes
ALTER INDEX IF EXISTS idx_product_lca_materials_product_lca_id
  RENAME TO idx_product_carbon_footprint_materials_pcf_id;

ALTER INDEX IF EXISTS idx_product_lca_materials_material_type
  RENAME TO idx_product_carbon_footprint_materials_material_type;

ALTER INDEX IF EXISTS idx_product_lca_materials_material_id
  RENAME TO idx_product_carbon_footprint_materials_material_id;

-- Production sites table indexes
ALTER INDEX IF EXISTS idx_product_lca_production_sites_lca_id
  RENAME TO idx_product_carbon_footprint_production_sites_pcf_id;

ALTER INDEX IF EXISTS idx_product_lca_production_sites_facility_id
  RENAME TO idx_product_carbon_footprint_production_sites_facility_id;

ALTER INDEX IF EXISTS idx_product_lca_production_sites_org_lca
  RENAME TO idx_product_carbon_footprint_production_sites_org_pcf;

-- ============================================================================
-- STEP 4: Rename Constraints
-- ============================================================================

-- Rename unique constraint on production sites
ALTER TABLE IF EXISTS public.product_carbon_footprint_production_sites
  RENAME CONSTRAINT unique_lca_facility TO unique_pcf_facility;

-- ============================================================================
-- STEP 5: Update Triggers and Functions
-- ============================================================================

-- Drop old trigger on main table
DROP TRIGGER IF EXISTS product_lcas_updated_at ON public.product_carbon_footprints;

-- Rename the function
ALTER FUNCTION IF EXISTS update_product_lca_updated_at()
  RENAME TO update_product_carbon_footprint_updated_at;

-- Recreate trigger with new name
CREATE TRIGGER product_carbon_footprints_updated_at
  BEFORE UPDATE ON public.product_carbon_footprints
  FOR EACH ROW
  EXECUTE FUNCTION update_product_carbon_footprint_updated_at();

-- Drop old trigger on materials table
DROP TRIGGER IF EXISTS update_product_lca_materials_updated_at ON public.product_carbon_footprint_materials;

-- Recreate with new name (uses existing update_updated_at_column function)
CREATE TRIGGER update_product_carbon_footprint_materials_updated_at
  BEFORE UPDATE ON public.product_carbon_footprint_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update production sites triggers
DROP TRIGGER IF EXISTS trigger_calculate_production_site_metrics ON public.product_carbon_footprint_production_sites;
DROP TRIGGER IF EXISTS trigger_recalculate_production_shares ON public.product_carbon_footprint_production_sites;

-- Recreate production site triggers with same functions (function body uses NEW/OLD which work regardless of table name)
CREATE TRIGGER trigger_calculate_pcf_production_site_metrics
  BEFORE INSERT OR UPDATE ON public.product_carbon_footprint_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION calculate_production_site_metrics();

CREATE TRIGGER trigger_recalculate_pcf_production_shares
  AFTER INSERT OR UPDATE OR DELETE ON public.product_carbon_footprint_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_all_production_shares();

-- ============================================================================
-- STEP 6: Update RLS Policies (Drop and Recreate with New Names)
-- ============================================================================

-- Main table policies
DROP POLICY IF EXISTS "Users can manage LCAs for their organization" ON public.product_carbon_footprints;

CREATE POLICY "Users can manage PCFs for their organization"
ON public.product_carbon_footprints
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_carbon_footprints.organization_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_carbon_footprints.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Inputs table policies
DROP POLICY IF EXISTS "Users can manage inputs for their organization's LCAs" ON public.product_carbon_footprint_inputs;

CREATE POLICY "Users can manage inputs for their organization's PCFs"
ON public.product_carbon_footprint_inputs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_inputs.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_inputs.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Results table policies
DROP POLICY IF EXISTS "Users can view results for their organization's LCAs" ON public.product_carbon_footprint_results;

CREATE POLICY "Users can view results for their organization's PCFs"
ON public.product_carbon_footprint_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_results.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Materials table policies
DROP POLICY IF EXISTS "Users can view materials for their organization's LCAs" ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can insert materials for their organization's LCAs" ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can update materials for their organization's LCAs" ON public.product_carbon_footprint_materials;
DROP POLICY IF EXISTS "Users can delete materials for their organization's LCAs" ON public.product_carbon_footprint_materials;

CREATE POLICY "Users can view materials for their organization's PCFs"
ON public.product_carbon_footprint_materials
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_materials.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert materials for their organization's PCFs"
ON public.product_carbon_footprint_materials
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_materials.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update materials for their organization's PCFs"
ON public.product_carbon_footprint_materials
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_materials.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_materials.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete materials for their organization's PCFs"
ON public.product_carbon_footprint_materials
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_carbon_footprints
    JOIN public.organization_members ON product_carbon_footprints.organization_id = organization_members.organization_id
    WHERE product_carbon_footprints.id = product_carbon_footprint_materials.product_carbon_footprint_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Production sites table policies
DROP POLICY IF EXISTS "Users can manage production sites for their organization" ON public.product_carbon_footprint_production_sites;

CREATE POLICY "Users can manage production sites for their organization"
ON public.product_carbon_footprint_production_sites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_carbon_footprint_production_sites.organization_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_carbon_footprint_production_sites.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 7: Update Table Comments
-- ============================================================================

COMMENT ON TABLE public.product_carbon_footprints IS 'Product Carbon Footprint (PCF) records - aligned with ISO 14067 and GHG Protocol Product Standard';
COMMENT ON TABLE public.product_carbon_footprint_inputs IS 'Input data for Product Carbon Footprint calculations';
COMMENT ON TABLE public.product_carbon_footprint_results IS 'Calculated results for Product Carbon Footprints by impact category';
COMMENT ON TABLE public.product_carbon_footprint_materials IS 'Materials (ingredients and packaging) associated with a Product Carbon Footprint. Uses polymorphic pattern where material_id references either ingredients or packaging_types based on material_type.';
COMMENT ON TABLE public.product_carbon_footprint_production_sites IS 'Links Product Carbon Footprints to manufacturing facilities with production volumes for weighted average allocation';

-- Update column comments
COMMENT ON COLUMN public.product_carbon_footprint_materials.product_carbon_footprint_id IS 'Foreign key linking to the parent Product Carbon Footprint.';

-- ============================================================================
-- STEP 8: Create Backward-Compatible Views (for transition period)
-- These can be dropped once all code is migrated
-- ============================================================================

-- Create views that alias old names to new tables
CREATE OR REPLACE VIEW public.product_lcas AS
SELECT
  id,
  organization_id,
  product_name,
  functional_unit,
  system_boundary,
  status,
  created_at,
  updated_at
FROM public.product_carbon_footprints;

CREATE OR REPLACE VIEW public.product_lca_inputs AS
SELECT
  id,
  product_carbon_footprint_id AS product_lca_id,
  input_data,
  created_at
FROM public.product_carbon_footprint_inputs;

CREATE OR REPLACE VIEW public.product_lca_results AS
SELECT
  id,
  product_carbon_footprint_id AS product_lca_id,
  impact_category,
  value,
  unit,
  created_at
FROM public.product_carbon_footprint_results;

-- Note: product_lca_materials and product_lca_production_sites views need
-- all columns - let me create comprehensive views

-- Full view for materials with column alias
CREATE OR REPLACE VIEW public.product_lca_materials AS
SELECT
  id,
  product_carbon_footprint_id AS product_lca_id,
  material_id,
  material_type,
  quantity,
  created_at,
  updated_at
FROM public.product_carbon_footprint_materials;

-- Full view for production sites with column alias
CREATE OR REPLACE VIEW public.product_lca_production_sites AS
SELECT
  id,
  product_carbon_footprint_id AS product_lca_id,
  facility_id,
  organization_id,
  production_volume,
  share_of_production,
  facility_intensity,
  attributable_emissions_per_unit,
  data_source,
  created_at,
  updated_at
FROM public.product_carbon_footprint_production_sites;

-- Add comments to views
COMMENT ON VIEW public.product_lcas IS 'DEPRECATED: Backward-compatible view - use product_carbon_footprints table instead';
COMMENT ON VIEW public.product_lca_inputs IS 'DEPRECATED: Backward-compatible view - use product_carbon_footprint_inputs table instead';
COMMENT ON VIEW public.product_lca_results IS 'DEPRECATED: Backward-compatible view - use product_carbon_footprint_results table instead';
COMMENT ON VIEW public.product_lca_materials IS 'DEPRECATED: Backward-compatible view - use product_carbon_footprint_materials table instead';
COMMENT ON VIEW public.product_lca_production_sites IS 'DEPRECATED: Backward-compatible view - use product_carbon_footprint_production_sites table instead';

-- ============================================================================
-- STEP 9: Update any database functions that reference old table names
-- ============================================================================

-- Update the calculate_production_site_metrics function to use new table name
CREATE OR REPLACE FUNCTION calculate_production_site_metrics()
RETURNS TRIGGER AS $$
DECLARE
  total_volume NUMERIC;
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
BEGIN
  -- Calculate total production volume across all sites for this PCF
  SELECT COALESCE(SUM(production_volume), 0)
  INTO total_volume
  FROM public.product_carbon_footprint_production_sites
  WHERE product_carbon_footprint_id = NEW.product_carbon_footprint_id;

  -- Calculate share of production (percentage)
  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 0;
  END IF;

  -- Fetch facility intensity from facility_emissions_aggregated
  SELECT
    fea.calculated_intensity,
    CASE
      WHEN fea.data_source_type = 'Primary' THEN 'Verified'
      ELSE 'Industry_Average'
    END
  INTO facility_calculated_intensity, facility_data_source
  FROM public.facility_emissions_aggregated fea
  WHERE fea.facility_id = NEW.facility_id
  ORDER BY fea.reporting_year DESC, fea.reporting_period DESC
  LIMIT 1;

  -- Cache the facility intensity
  NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
  NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');

  -- Calculate attributable emissions (will be multiplied by product volume in final calculation)
  NEW.attributable_emissions_per_unit := NEW.facility_intensity;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the recalculate_all_production_shares function to use new table name
CREATE OR REPLACE FUNCTION recalculate_all_production_shares()
RETURNS TRIGGER AS $$
DECLARE
  pcf_id UUID;
BEGIN
  -- Determine which PCF was affected
  IF TG_OP = 'DELETE' THEN
    pcf_id := OLD.product_carbon_footprint_id;
  ELSE
    pcf_id := NEW.product_carbon_footprint_id;
  END IF;

  -- Recalculate shares for all sites in this PCF
  UPDATE public.product_carbon_footprint_production_sites
  SET updated_at = now()
  WHERE product_carbon_footprint_id = pcf_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
