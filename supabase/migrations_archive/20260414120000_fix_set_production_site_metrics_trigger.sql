-- Fix: set_production_site_metrics trigger references NEW.product_lca_id
-- which does not exist on the product_carbon_footprint_production_sites table.
-- The actual column is product_carbon_footprint_id.
-- Also references deprecated view product_lca_production_sites instead of the real table.
-- This caused: record "new" has no field "product_lca_id" (errorCode 42703)

CREATE OR REPLACE FUNCTION "public"."set_production_site_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
  total_volume NUMERIC;
BEGIN
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

  NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
  NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');

  SELECT COALESCE(SUM(production_volume), 0) + NEW.production_volume
  INTO total_volume
  FROM public.product_carbon_footprint_production_sites
  WHERE product_carbon_footprint_id = NEW.product_carbon_footprint_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 100;
  END IF;

  NEW.attributable_emissions_per_unit := NEW.facility_intensity * (NEW.share_of_production / 100);

  RETURN NEW;
END;
$$;
