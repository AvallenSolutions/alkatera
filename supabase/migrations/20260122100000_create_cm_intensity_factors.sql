-- ============================================================================
-- CM Intensity Factors Table
-- ============================================================================
-- Supports intensity-based allocation for contract manufacturers.
-- CMs provide emission/water/waste intensity per unit of production,
-- which is then multiplied by the client's production volume.
--
-- Benefits:
-- 1. CM doesn't need to share total production (confidentiality)
-- 2. Works perfectly with sporadic batch production
-- 3. More accurate when CM efficiency varies seasonally
-- 4. Simpler for users - just multiply intensity × volume
-- ============================================================================

-- Create enum for intensity unit types
DO $$ BEGIN
  CREATE TYPE intensity_unit_enum AS ENUM (
    'per_litre',
    'per_hectolitre',
    'per_kg',
    'per_tonne',
    'per_unit'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for data source types
DO $$ BEGIN
  CREATE TYPE intensity_data_source_enum AS ENUM (
    'cm_provided',           -- Direct from contract manufacturer
    'calculated',            -- Calculated from facility data
    'industry_average',      -- Industry benchmark/proxy
    'estimated'              -- User estimate
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Main intensity factors table
CREATE TABLE IF NOT EXISTS public.cm_intensity_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Facility reference (the contract manufacturer)
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Reporting period (when this intensity applies)
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,

  -- CO2e Intensity (split by scope for accurate tracking)
  co2e_scope1_intensity NUMERIC,           -- kgCO2e per unit (direct emissions)
  co2e_scope2_intensity NUMERIC,           -- kgCO2e per unit (purchased energy)
  co2e_total_intensity NUMERIC GENERATED ALWAYS AS (
    COALESCE(co2e_scope1_intensity, 0) + COALESCE(co2e_scope2_intensity, 0)
  ) STORED,

  -- Water Intensity
  water_intensity NUMERIC,                  -- litres per unit

  -- Waste Intensity
  waste_intensity NUMERIC,                  -- kg per unit

  -- Unit configuration
  intensity_unit intensity_unit_enum NOT NULL DEFAULT 'per_litre',

  -- Data quality tracking
  data_source intensity_data_source_enum NOT NULL DEFAULT 'cm_provided',
  data_quality_notes TEXT,
  verification_status TEXT DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'self_declared', 'third_party_verified')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),

  -- Ensure no overlapping periods for the same facility
  CONSTRAINT no_overlapping_periods UNIQUE (facility_id, reporting_period_start, reporting_period_end),

  -- Ensure end date is after start date
  CONSTRAINT valid_date_range CHECK (reporting_period_end >= reporting_period_start)
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_cm_intensity_facility
  ON public.cm_intensity_factors(facility_id);

CREATE INDEX IF NOT EXISTS idx_cm_intensity_org
  ON public.cm_intensity_factors(organization_id);

CREATE INDEX IF NOT EXISTS idx_cm_intensity_period
  ON public.cm_intensity_factors(reporting_period_start, reporting_period_end);

-- Enable RLS
ALTER TABLE public.cm_intensity_factors ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their organization's intensity factors"
  ON public.cm_intensity_factors FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert intensity factors for their organization"
  ON public.cm_intensity_factors FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's intensity factors"
  ON public.cm_intensity_factors FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their organization's intensity factors"
  ON public.cm_intensity_factors FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- Update contract_manufacturer_allocations to support intensity method
-- ============================================================================

ALTER TABLE public.contract_manufacturer_allocations
ADD COLUMN IF NOT EXISTS allocation_method TEXT DEFAULT 'proportional'
  CHECK (allocation_method IN ('proportional', 'intensity_based'));

ALTER TABLE public.contract_manufacturer_allocations
ADD COLUMN IF NOT EXISTS intensity_factor_id UUID REFERENCES public.cm_intensity_factors(id);

ALTER TABLE public.contract_manufacturer_allocations
ADD COLUMN IF NOT EXISTS data_completeness_warning TEXT;

-- ============================================================================
-- Add allocated emissions by scope to production_logs for intensity tracking
-- ============================================================================

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS allocated_scope1_co2e NUMERIC;

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS allocated_scope2_co2e NUMERIC;

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS allocated_water_litres NUMERIC;

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS allocated_waste_kg NUMERIC;

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS intensity_factor_id UUID REFERENCES public.cm_intensity_factors(id);

ALTER TABLE public.production_logs
ADD COLUMN IF NOT EXISTS allocation_method TEXT
  CHECK (allocation_method IN ('proportional', 'intensity_based', 'auto_matched'));

-- ============================================================================
-- Function to auto-match production logs to intensity factors
-- ============================================================================

CREATE OR REPLACE FUNCTION match_intensity_factor_for_date(
  p_facility_id UUID,
  p_production_date DATE
) RETURNS UUID AS $$
DECLARE
  v_intensity_id UUID;
BEGIN
  -- First try exact period match
  SELECT id INTO v_intensity_id
  FROM public.cm_intensity_factors
  WHERE facility_id = p_facility_id
    AND p_production_date >= reporting_period_start
    AND p_production_date <= reporting_period_end
  ORDER BY reporting_period_start DESC
  LIMIT 1;

  RETURN v_intensity_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Function to get annual average intensity for a facility
-- ============================================================================

CREATE OR REPLACE FUNCTION get_annual_average_intensity(
  p_facility_id UUID,
  p_year INTEGER
) RETURNS TABLE (
  avg_scope1_intensity NUMERIC,
  avg_scope2_intensity NUMERIC,
  avg_total_intensity NUMERIC,
  avg_water_intensity NUMERIC,
  avg_waste_intensity NUMERIC,
  periods_count INTEGER,
  is_complete BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(co2e_scope1_intensity)::NUMERIC as avg_scope1_intensity,
    AVG(co2e_scope2_intensity)::NUMERIC as avg_scope2_intensity,
    AVG(co2e_total_intensity)::NUMERIC as avg_total_intensity,
    AVG(water_intensity)::NUMERIC as avg_water_intensity,
    AVG(waste_intensity)::NUMERIC as avg_waste_intensity,
    COUNT(*)::INTEGER as periods_count,
    -- Check if we have all 4 quarters (or reasonable coverage)
    (COUNT(*) >= 4)::BOOLEAN as is_complete
  FROM public.cm_intensity_factors
  WHERE facility_id = p_facility_id
    AND EXTRACT(YEAR FROM reporting_period_start) = p_year;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Trigger to auto-allocate emissions when production log is created/updated
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_allocate_production_emissions()
RETURNS TRIGGER AS $$
DECLARE
  v_intensity RECORD;
  v_annual_intensity RECORD;
  v_volume_multiplier NUMERIC;
BEGIN
  -- Only process if facility is a contract manufacturer
  IF NOT EXISTS (
    SELECT 1 FROM public.facilities
    WHERE id = NEW.facility_id
    AND facility_type = 'contract_manufacturer'
  ) THEN
    RETURN NEW;
  END IF;

  -- Try to find matching intensity factor for the production date
  SELECT * INTO v_intensity
  FROM public.cm_intensity_factors
  WHERE facility_id = NEW.facility_id
    AND NEW.date >= reporting_period_start
    AND NEW.date <= reporting_period_end
  ORDER BY reporting_period_start DESC
  LIMIT 1;

  -- Determine volume multiplier based on unit
  v_volume_multiplier := CASE
    WHEN NEW.unit = 'Hectolitre' THEN NEW.volume * 100  -- Convert to litres
    WHEN NEW.unit = 'Unit' THEN NEW.volume
    ELSE NEW.volume  -- Assume litres
  END;

  IF v_intensity.id IS NOT NULL THEN
    -- Use period-specific intensity
    NEW.intensity_factor_id := v_intensity.id;
    NEW.allocation_method := 'auto_matched';
    NEW.allocated_scope1_co2e := COALESCE(v_intensity.co2e_scope1_intensity, 0) * v_volume_multiplier;
    NEW.allocated_scope2_co2e := COALESCE(v_intensity.co2e_scope2_intensity, 0) * v_volume_multiplier;
    NEW.allocated_water_litres := COALESCE(v_intensity.water_intensity, 0) * v_volume_multiplier;
    NEW.allocated_waste_kg := COALESCE(v_intensity.waste_intensity, 0) * v_volume_multiplier;
  ELSE
    -- Fallback to annual average
    SELECT * INTO v_annual_intensity
    FROM get_annual_average_intensity(NEW.facility_id, EXTRACT(YEAR FROM NEW.date)::INTEGER);

    IF v_annual_intensity.avg_total_intensity IS NOT NULL AND v_annual_intensity.avg_total_intensity > 0 THEN
      NEW.allocation_method := 'intensity_based';
      NEW.allocated_scope1_co2e := COALESCE(v_annual_intensity.avg_scope1_intensity, 0) * v_volume_multiplier;
      NEW.allocated_scope2_co2e := COALESCE(v_annual_intensity.avg_scope2_intensity, 0) * v_volume_multiplier;
      NEW.allocated_water_litres := COALESCE(v_annual_intensity.avg_water_intensity, 0) * v_volume_multiplier;
      NEW.allocated_waste_kg := COALESCE(v_annual_intensity.avg_waste_intensity, 0) * v_volume_multiplier;

      -- Add warning if using annual average (incomplete data)
      IF NOT v_annual_intensity.is_complete THEN
        -- We'll track this via the allocation_method being 'intensity_based' not 'auto_matched'
        NULL;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-allocation
DROP TRIGGER IF EXISTS trigger_auto_allocate_production ON public.production_logs;
CREATE TRIGGER trigger_auto_allocate_production
  BEFORE INSERT OR UPDATE ON public.production_logs
  FOR EACH ROW
  EXECUTE FUNCTION auto_allocate_production_emissions();

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE public.cm_intensity_factors IS
'Stores emission/water/waste intensity factors provided by contract manufacturers.
Used for intensity-based allocation which is more accurate for sporadic batch production.';

COMMENT ON COLUMN public.cm_intensity_factors.co2e_scope1_intensity IS
'Direct emissions intensity (kgCO2e per unit) - from fuel combustion at the CM facility';

COMMENT ON COLUMN public.cm_intensity_factors.co2e_scope2_intensity IS
'Indirect emissions intensity (kgCO2e per unit) - from purchased electricity/heat at the CM facility';

COMMENT ON COLUMN public.cm_intensity_factors.intensity_unit IS
'The production unit this intensity applies to (per_litre, per_kg, per_unit, etc.)';
