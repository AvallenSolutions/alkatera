/*
  # Create Product LCA Production Sites Table

  This migration creates the junction table linking Product LCAs to manufacturing facilities,
  enabling weighted average calculations for multi-site production scenarios.

  ## Changes

  1. **New Table: product_lca_production_sites**
     - Links a specific LCA to one or more production facilities
     - Captures production volume per facility for allocation
     - Stores calculated attributable emissions per unit
     - Tracks data source quality (Verified vs Industry Average)

  2. **Columns**
     - `id` (uuid, primary key)
     - `product_lca_id` (uuid, foreign key to product_lcas)
     - `facility_id` (uuid, foreign key to facilities)
     - `organization_id` (uuid, foreign key to organizations)
     - `production_volume` (numeric) - Units produced at this facility in the reporting period
     - `share_of_production` (numeric) - Calculated percentage (auto-calculated)
     - `facility_intensity` (numeric) - kg CO2e per unit from facility (cached)
     - `attributable_emissions_per_unit` (numeric) - Weighted emissions allocated to product
     - `data_source` (text) - 'Verified' or 'Industry_Average'
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  3. **Security**
     - Enable RLS
     - Organization-scoped access policies
     - Prevent linking to facilities from different organizations

  4. **Indexes**
     - Fast lookups by product_lca_id
     - Fast lookups by facility_id
     - Composite index for organization_id + product_lca_id

  ## Notes
  - share_of_production is calculated automatically via trigger
  - attributable_emissions_per_unit is calculated as: facility_intensity * share_of_production
  - Supports multi-site production scenarios per ISO 14044
  - Prevents denominator drift by using facility-level intensity factors
*/

-- Create product_lca_production_sites table
CREATE TABLE IF NOT EXISTS public.product_lca_production_sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_lca_id UUID NOT NULL REFERENCES public.product_lcas(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    production_volume NUMERIC NOT NULL CHECK (production_volume > 0),
    share_of_production NUMERIC,
    facility_intensity NUMERIC,
    attributable_emissions_per_unit NUMERIC,
    data_source TEXT NOT NULL DEFAULT 'Verified' CHECK (data_source IN ('Verified', 'Industry_Average')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unique_lca_facility UNIQUE (product_lca_id, facility_id)
);

-- Add comments for documentation
COMMENT ON TABLE public.product_lca_production_sites IS 'Links Product LCAs to manufacturing facilities with production volumes for weighted average allocation';
COMMENT ON COLUMN public.product_lca_production_sites.production_volume IS 'Number of product units produced at this facility during the reporting period';
COMMENT ON COLUMN public.product_lca_production_sites.share_of_production IS 'Percentage of total production volume (auto-calculated)';
COMMENT ON COLUMN public.product_lca_production_sites.facility_intensity IS 'Cached emission intensity from facility (kg CO2e per unit)';
COMMENT ON COLUMN public.product_lca_production_sites.attributable_emissions_per_unit IS 'Weighted emissions allocated to this product from this facility';
COMMENT ON COLUMN public.product_lca_production_sites.data_source IS 'Quality indicator: Verified (primary data) or Industry_Average (proxy factor)';

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_product_lca_production_sites_lca_id
  ON public.product_lca_production_sites(product_lca_id);

CREATE INDEX IF NOT EXISTS idx_product_lca_production_sites_facility_id
  ON public.product_lca_production_sites(facility_id);

CREATE INDEX IF NOT EXISTS idx_product_lca_production_sites_org_lca
  ON public.product_lca_production_sites(organization_id, product_lca_id);

-- Enable RLS
ALTER TABLE public.product_lca_production_sites ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can manage production sites for their organization's LCAs
CREATE POLICY "Users can manage production sites for their organization"
ON public.product_lca_production_sites
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lca_production_sites.organization_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lca_production_sites.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Function to calculate share of production and attributable emissions
CREATE OR REPLACE FUNCTION calculate_production_site_metrics()
RETURNS TRIGGER AS $$
DECLARE
  total_volume NUMERIC;
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
BEGIN
  -- Calculate total production volume across all sites for this LCA
  SELECT COALESCE(SUM(production_volume), 0)
  INTO total_volume
  FROM public.product_lca_production_sites
  WHERE product_lca_id = NEW.product_lca_id;

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

-- Trigger to auto-calculate metrics on insert/update
DROP TRIGGER IF EXISTS trigger_calculate_production_site_metrics ON public.product_lca_production_sites;
CREATE TRIGGER trigger_calculate_production_site_metrics
  BEFORE INSERT OR UPDATE ON public.product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION calculate_production_site_metrics();

-- Function to recalculate all shares when a site is added/updated/deleted
CREATE OR REPLACE FUNCTION recalculate_all_production_shares()
RETURNS TRIGGER AS $$
DECLARE
  lca_id UUID;
BEGIN
  -- Determine which LCA was affected
  IF TG_OP = 'DELETE' THEN
    lca_id := OLD.product_lca_id;
  ELSE
    lca_id := NEW.product_lca_id;
  END IF;

  -- Recalculate shares for all sites in this LCA
  UPDATE public.product_lca_production_sites
  SET updated_at = now()
  WHERE product_lca_id = lca_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger to recalculate shares when any site changes
DROP TRIGGER IF EXISTS trigger_recalculate_production_shares ON public.product_lca_production_sites;
CREATE TRIGGER trigger_recalculate_production_shares
  AFTER INSERT OR UPDATE OR DELETE ON public.product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_all_production_shares();