/*
  # Fix Existing Facility Activity Data

  This migration repairs existing activity_data records and adds automation
  for facility emissions calculations.

  ## Changes

  1. Backfill facility_id from utility_data_entries
  2. Backfill fuel_type based on activity name/category
  3. Backfill reporting periods from activity_date
  4. Create trigger to auto-update facility_emissions_aggregated
  5. Create function to recalculate all facility emissions
*/

-- =============================================================================
-- 1. Backfill facility_id from utility_data_entries
-- =============================================================================

-- Match activity_data to utility_data_entries based on organization and date
UPDATE public.activity_data ad
SET facility_id = ude.facility_id
FROM public.utility_data_entries ude
WHERE ad.facility_id IS NULL
  AND ad.organization_id = (
    SELECT f.organization_id
    FROM public.facilities f
    WHERE f.id = ude.facility_id
  )
  AND ad.activity_date BETWEEN ude.reporting_period_start AND ude.reporting_period_end
  AND (
    -- Match by quantity and similar names
    ad.quantity = ude.quantity
    OR lower(ad.name) LIKE '%' || lower(ude.utility_type) || '%'
  );

-- Also match via facility_emissions_aggregated sessions
UPDATE public.activity_data ad
SET facility_id = fea.facility_id,
    reporting_period_start = COALESCE(ad.reporting_period_start, fea.reporting_period_start),
    reporting_period_end = COALESCE(ad.reporting_period_end, fea.reporting_period_end)
FROM public.facility_emissions_aggregated fea
WHERE ad.facility_id IS NULL
  AND ad.organization_id = fea.organization_id
  AND ad.activity_date BETWEEN fea.reporting_period_start AND fea.reporting_period_end;

-- =============================================================================
-- 2. Backfill fuel_type based on activity name
-- =============================================================================

-- Backfill using DEFRA-compatible fuel types
UPDATE public.activity_data
SET fuel_type = CASE
  -- Electricity
  WHEN lower(name) LIKE '%electricity%' OR lower(name) LIKE '%grid%' THEN 'grid_electricity'
  -- Natural Gas - check unit to determine kWh vs m3
  WHEN lower(name) LIKE '%natural gas%' AND (lower(name) LIKE '%kwh%' OR lower(unit) = 'kwh') THEN 'natural_gas_kwh'
  WHEN lower(name) LIKE '%natural gas%' AND (lower(name) LIKE '%m3%' OR lower(name) LIKE '%m³%' OR lower(unit) IN ('m3', 'm³')) THEN 'natural_gas_m3'
  WHEN lower(name) LIKE '%natural gas%' THEN 'natural_gas_kwh'
  -- LPG
  WHEN lower(name) LIKE '%lpg%' OR lower(name) LIKE '%propane%' OR lower(name) LIKE '%butane%' THEN 'lpg_litre'
  -- Diesel (both stationary and mobile use same DEFRA factor)
  WHEN lower(name) LIKE '%diesel%' THEN 'diesel_stationary'
  -- Petrol/Gasoline
  WHEN lower(name) LIKE '%petrol%' OR lower(name) LIKE '%gasoline%' THEN 'petrol'
  -- Heavy Fuel Oil
  WHEN lower(name) LIKE '%fuel oil%' OR lower(name) LIKE '%heavy oil%' THEN 'heavy_fuel_oil'
  -- Biomass
  WHEN lower(name) LIKE '%biomass%' OR lower(name) LIKE '%biogas%' THEN 'biomass_wood_chips'
  -- Heat/Steam
  WHEN lower(name) LIKE '%heat%' OR lower(name) LIKE '%steam%' THEN 'heat_steam'
  -- Refrigerant
  WHEN lower(name) LIKE '%refrigerant%' THEN 'refrigerant_r410a'
  ELSE fuel_type
END
WHERE fuel_type IS NULL;

-- =============================================================================
-- 3. Backfill reporting periods from activity_date
-- =============================================================================

-- For records without reporting_period_start/end, derive from activity_date
UPDATE public.activity_data
SET
  reporting_period_start = COALESCE(
    reporting_period_start,
    date_trunc('year', activity_date)::DATE
  ),
  reporting_period_end = COALESCE(
    reporting_period_end,
    (date_trunc('year', activity_date) + interval '1 year - 1 day')::DATE
  )
WHERE (reporting_period_start IS NULL OR reporting_period_end IS NULL)
  AND activity_date IS NOT NULL;

-- =============================================================================
-- 4. Create function to recalculate facility emissions
-- =============================================================================

CREATE OR REPLACE FUNCTION recalculate_facility_emissions(
  p_facility_id UUID DEFAULT NULL,
  p_organization_id UUID DEFAULT NULL
)
RETURNS TABLE (
  facility_id UUID,
  facility_name TEXT,
  period_start DATE,
  period_end DATE,
  total_co2e NUMERIC,
  scope1_co2e NUMERIC,
  scope2_co2e NUMERIC,
  activity_count INTEGER,
  factor_year INTEGER,
  updated BOOLEAN
) AS $$
DECLARE
  v_fea RECORD;
  v_calc RECORD;
  v_production_volume NUMERIC;
  v_calculated_intensity NUMERIC;
BEGIN
  -- Loop through all facility_emissions_aggregated records matching criteria
  FOR v_fea IN
    SELECT
      fea.id,
      fea.facility_id,
      f.name AS facility_name,
      fea.reporting_period_start,
      fea.reporting_period_end,
      fea.total_production_volume,
      fea.volume_unit,
      fea.organization_id
    FROM public.facility_emissions_aggregated fea
    JOIN public.facilities f ON f.id = fea.facility_id
    WHERE (p_facility_id IS NULL OR fea.facility_id = p_facility_id)
      AND (p_organization_id IS NULL OR fea.organization_id = p_organization_id)
  LOOP
    -- Calculate emissions for this facility and period
    SELECT * INTO v_calc
    FROM calculate_facility_emissions_from_activity(
      v_fea.facility_id,
      v_fea.reporting_period_start,
      v_fea.reporting_period_end
    );

    -- Calculate intensity (CO2e per unit of production)
    v_production_volume := COALESCE(v_fea.total_production_volume, 0);
    IF v_production_volume > 0 THEN
      v_calculated_intensity := v_calc.total_co2e / v_production_volume;
    ELSE
      v_calculated_intensity := 0;
    END IF;

    -- Update the aggregated record
    UPDATE public.facility_emissions_aggregated
    SET
      total_co2e = v_calc.total_co2e,
      scope1_co2e = v_calc.scope1_co2e,
      scope2_co2e = v_calc.scope2_co2e,
      calculated_intensity = v_calculated_intensity,
      results_payload = jsonb_build_object(
        'scope1_co2e', v_calc.scope1_co2e,
        'scope2_co2e', v_calc.scope2_co2e,
        'total_co2e', v_calc.total_co2e,
        'activity_count', v_calc.activity_count,
        'defra_factor_year', v_calc.factor_year,
        'production_volume', v_production_volume,
        'production_unit', v_fea.volume_unit,
        'calculated_intensity', v_calculated_intensity,
        'recalculated_at', now()
      ),
      updated_at = now()
    WHERE id = v_fea.id;

    -- Return the result
    facility_id := v_fea.facility_id;
    facility_name := v_fea.facility_name;
    period_start := v_fea.reporting_period_start;
    period_end := v_fea.reporting_period_end;
    total_co2e := v_calc.total_co2e;
    scope1_co2e := v_calc.scope1_co2e;
    scope2_co2e := v_calc.scope2_co2e;
    activity_count := v_calc.activity_count;
    factor_year := v_calc.factor_year;
    updated := TRUE;

    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION recalculate_facility_emissions IS 'Recalculates emissions for facility(ies) and updates facility_emissions_aggregated. Pass NULL for both params to recalculate all.';

GRANT EXECUTE ON FUNCTION recalculate_facility_emissions(UUID, UUID) TO authenticated;

-- =============================================================================
-- 5. Create trigger to auto-update emissions when activity_data changes
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_update_facility_emissions()
RETURNS TRIGGER AS $$
DECLARE
  v_facility_id UUID;
  v_period_start DATE;
  v_period_end DATE;
BEGIN
  -- Get facility_id and period from the affected row
  IF TG_OP = 'DELETE' THEN
    v_facility_id := OLD.facility_id;
    v_period_start := OLD.reporting_period_start;
    v_period_end := OLD.reporting_period_end;
  ELSE
    v_facility_id := NEW.facility_id;
    v_period_start := NEW.reporting_period_start;
    v_period_end := NEW.reporting_period_end;
  END IF;

  -- Only proceed if we have a facility_id
  IF v_facility_id IS NOT NULL AND v_period_start IS NOT NULL AND v_period_end IS NOT NULL THEN
    -- Recalculate emissions for this facility
    PERFORM recalculate_facility_emissions(v_facility_id, NULL);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS activity_data_emissions_update ON public.activity_data;

CREATE TRIGGER activity_data_emissions_update
  AFTER INSERT OR UPDATE OR DELETE ON public.activity_data
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_facility_emissions();

-- =============================================================================
-- 6. Add scope1_co2e and scope2_co2e columns to facility_emissions_aggregated
-- =============================================================================

ALTER TABLE public.facility_emissions_aggregated
  ADD COLUMN IF NOT EXISTS scope1_co2e NUMERIC DEFAULT 0;

ALTER TABLE public.facility_emissions_aggregated
  ADD COLUMN IF NOT EXISTS scope2_co2e NUMERIC DEFAULT 0;

COMMENT ON COLUMN public.facility_emissions_aggregated.scope1_co2e IS 'Total Scope 1 CO2e emissions for this facility and period';
COMMENT ON COLUMN public.facility_emissions_aggregated.scope2_co2e IS 'Total Scope 2 CO2e emissions for this facility and period';

-- =============================================================================
-- 7. Run initial recalculation for all existing facility emissions
-- =============================================================================

-- This will fix all existing records
SELECT * FROM recalculate_facility_emissions(NULL, NULL);
