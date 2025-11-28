/*
  # Simplify Production Sites Triggers - Prevent Recursion

  The complex trigger setup was causing infinite recursion. 
  
  ## Simple Solution
  1. BEFORE INSERT/UPDATE: Set facility intensity and initial values
  2. Remove the AFTER trigger completely - we don't need automatic recalculation
  3. Let the application handle share calculations when needed

  This is simpler, more predictable, and avoids all recursion issues.

  ## Changes
  - Keep only the BEFORE trigger for setting facility intensity
  - Calculate share_of_production in the BEFORE trigger based on current data
  - Remove all AFTER triggers
*/

-- Drop all AFTER triggers
DROP TRIGGER IF EXISTS trigger_update_production_shares ON public.product_lca_production_sites;
DROP TRIGGER IF EXISTS trigger_update_production_shares_statement ON public.product_lca_production_sites;
DROP FUNCTION IF EXISTS update_production_shares_for_lca();
DROP FUNCTION IF EXISTS update_production_shares_statement();

-- Simple BEFORE trigger that handles everything
CREATE OR REPLACE FUNCTION set_production_site_metrics()
RETURNS TRIGGER AS $$
DECLARE
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
  total_volume NUMERIC;
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

  -- Calculate total volume including this record (for INSERT) or updated value (for UPDATE)
  SELECT COALESCE(SUM(production_volume), 0) + NEW.production_volume
  INTO total_volume
  FROM public.product_lca_production_sites
  WHERE product_lca_id = NEW.product_lca_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Calculate share of production
  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 100;  -- If this is the only record, it's 100%
  END IF;

  -- Calculate attributable emissions
  NEW.attributable_emissions_per_unit := NEW.facility_intensity * (NEW.share_of_production / 100);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS trigger_set_facility_intensity ON public.product_lca_production_sites;
DROP TRIGGER IF EXISTS trigger_calculate_production_site_metrics ON public.product_lca_production_sites;

CREATE TRIGGER trigger_set_production_site_metrics
  BEFORE INSERT OR UPDATE ON public.product_lca_production_sites
  FOR EACH ROW
  EXECUTE FUNCTION set_production_site_metrics();
