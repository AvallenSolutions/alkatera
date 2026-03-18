-- Fix: calculate_production_site_metrics trigger references non-existent columns
-- The trigger queried fea.reporting_year and fea.reporting_period on
-- facility_emissions_aggregated, but that table uses reporting_period_start
-- and reporting_period_end instead. This caused "column fea.reporting_year
-- does not exist" errors during LCA calculation.

CREATE OR REPLACE FUNCTION "public"."calculate_production_site_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_volume numeric;
  facility_calculated_intensity numeric;
  facility_data_source text;
BEGIN
  SELECT COALESCE(SUM(production_volume), 0) INTO total_volume
  FROM public.product_carbon_footprint_production_sites
  WHERE product_carbon_footprint_id = NEW.product_carbon_footprint_id;

  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 0;
  END IF;

  SELECT fea.calculated_intensity,
    CASE WHEN fea.data_source_type = 'Primary' THEN 'Verified' ELSE 'Industry_Average' END
  INTO facility_calculated_intensity, facility_data_source
  FROM public.facility_emissions_aggregated fea
  WHERE fea.facility_id = NEW.facility_id
  ORDER BY fea.reporting_period_end DESC
  LIMIT 1;

  NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
  NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');
  NEW.attributable_emissions_per_unit := NEW.facility_intensity;

  RETURN NEW;
END;
$$;
