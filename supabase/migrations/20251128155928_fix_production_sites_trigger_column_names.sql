/*
  # Fix Production Sites Trigger Column Names

  The calculate_production_site_metrics() function was referencing non-existent columns
  (reporting_year and reporting_period) in the facility_emissions_aggregated table.
  
  This migration fixes the trigger to use the correct column names:
  - reporting_period_start
  - reporting_period_end

  ## Changes
  - Update calculate_production_site_metrics() function to use correct columns
  - Order by reporting_period_start DESC to get the most recent intensity data
*/

-- Drop and recreate the function with correct column names
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
  -- FIXED: Use reporting_period_start instead of reporting_year and reporting_period
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

  -- Calculate attributable emissions (will be multiplied by product volume in final calculation)
  NEW.attributable_emissions_per_unit := NEW.facility_intensity;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
