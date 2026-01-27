/*
  # Fix calculate_production_site_metrics trigger

  The trigger was referencing non-existent columns on facility_emissions_aggregated:
  - reporting_year (doesn't exist, should be reporting_period_start)
  - reporting_period (doesn't exist, should be reporting_period_end)
  - calculated_intensity (doesn't exist)
  - data_source_type (doesn't exist)

  This caused the INSERT to product_carbon_footprint_production_sites to fail
  silently, preventing facility emissions from being allocated to products.

  Fix: Replace the broken query with a safe version that uses the correct
  column names and gracefully handles missing data.
*/

CREATE OR REPLACE FUNCTION calculate_production_site_metrics()
RETURNS TRIGGER AS $$
DECLARE
  total_volume NUMERIC;
BEGIN
  -- Calculate total production volume across all sites for this PCF
  SELECT COALESCE(SUM(production_volume), 0)
  INTO total_volume
  FROM public.product_carbon_footprint_production_sites
  WHERE product_carbon_footprint_id = NEW.product_carbon_footprint_id;

  -- Add the incoming row's volume (not yet in the table during BEFORE INSERT)
  total_volume := total_volume + COALESCE(NEW.production_volume, 0);

  -- Calculate share of production (percentage)
  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 0;
  END IF;

  -- Preserve facility_intensity and data_source if already set by the application
  -- Only override if not provided (NULL or 0)
  IF NEW.facility_intensity IS NULL OR NEW.facility_intensity = 0 THEN
    -- Try to fetch from facility_emissions_aggregated using correct column names
    BEGIN
      SELECT COALESCE(fea.total_co2e, 0)
      INTO NEW.facility_intensity
      FROM public.facility_emissions_aggregated fea
      WHERE fea.facility_id = NEW.facility_id
      ORDER BY fea.reporting_period_end DESC
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      NEW.facility_intensity := 0;
    END;
  END IF;

  -- Set data_source to 'Industry_Average' if not already set to a valid value
  IF NEW.data_source IS NULL OR NEW.data_source NOT IN ('Verified', 'Industry_Average') THEN
    NEW.data_source := 'Industry_Average';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
