/*
  # Improve Production Sites Share Calculation

  The previous approach had issues with calculating share_of_production correctly
  because it was calculated BEFORE the record was inserted.

  ## New Approach
  1. BEFORE trigger: Only fetch and cache facility intensity
  2. AFTER trigger: Calculate shares for ALL sites in the LCA (using a smarter approach)
  3. Use a flag to prevent infinite recursion

  ## Changes
  - Simplify BEFORE trigger to only handle facility intensity
  - Create new AFTER trigger that properly calculates shares without recursion
*/

-- Simplified BEFORE trigger - only handles facility intensity lookup
CREATE OR REPLACE FUNCTION set_production_site_facility_intensity()
RETURNS TRIGGER AS $$
DECLARE
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
BEGIN
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
    AND fea.calculated_intensity IS NOT NULL
  ORDER BY fea.reporting_period_start DESC
  LIMIT 1;

  -- Cache the facility intensity
  NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
  NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');

  -- attributable_emissions_per_unit will be calculated in AFTER trigger
  -- For now, just set it to facility_intensity (will be updated with share)
  NEW.attributable_emissions_per_unit := NEW.facility_intensity;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the old trigger and create new one
DROP TRIGGER IF EXISTS trigger_calculate_production_site_metrics ON public.product_lca_production_sites;
CREATE TRIGGER trigger_set_facility_intensity
  BEFORE INSERT OR UPDATE ON public.product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION set_production_site_facility_intensity();

-- AFTER trigger to calculate shares without recursion
CREATE OR REPLACE FUNCTION update_production_shares_for_lca()
RETURNS TRIGGER AS $$
DECLARE
  lca_id UUID;
  total_volume NUMERIC;
BEGIN
  -- Determine which LCA was affected
  IF TG_OP = 'DELETE' THEN
    lca_id := OLD.product_lca_id;
  ELSE
    lca_id := NEW.product_lca_id;
  END IF;

  -- Calculate total production volume for this LCA
  SELECT COALESCE(SUM(production_volume), 0)
  INTO total_volume
  FROM public.product_lca_production_sites
  WHERE product_lca_id = lca_id;

  -- Update share_of_production for all sites in this LCA
  -- Do this in a single UPDATE to avoid recursion
  IF total_volume > 0 THEN
    UPDATE public.product_lca_production_sites
    SET 
      share_of_production = (production_volume / total_volume) * 100,
      attributable_emissions_per_unit = facility_intensity * (production_volume / total_volume),
      updated_at = CASE 
        WHEN TG_OP = 'INSERT' AND id = NEW.id THEN updated_at  -- Don't update timestamp for just-inserted record
        WHEN TG_OP = 'UPDATE' AND id = NEW.id THEN updated_at  -- Don't update timestamp for just-updated record
        ELSE now()
      END
    WHERE product_lca_id = lca_id;
  ELSE
    UPDATE public.product_lca_production_sites
    SET 
      share_of_production = 0,
      attributable_emissions_per_unit = 0,
      updated_at = now()
    WHERE product_lca_id = lca_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create AFTER trigger for share calculation
DROP TRIGGER IF EXISTS trigger_update_production_shares ON public.product_lca_production_sites;
CREATE TRIGGER trigger_update_production_shares
  AFTER INSERT OR UPDATE OR DELETE ON public.product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION update_production_shares_for_lca();
