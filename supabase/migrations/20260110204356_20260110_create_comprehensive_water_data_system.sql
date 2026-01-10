/*
  # Comprehensive Water Data System

  ## Overview
  Creates a comprehensive water data tracking system for facility-level water consumption,
  discharge, source breakdown, and quality metrics. Supports the enhanced Water Risk 
  Analysis card with granular data and AWARE methodology integration.

  ## New Tables
  1. `facility_water_data` - Primary water consumption and discharge records
     - Stores monthly/quarterly consumption data by facility
     - Tracks water sources (municipal, groundwater, surface, recycled)
     - Includes discharge volumes and data quality indicators

  2. `facility_water_sources` - Detailed source breakdown per facility
     - Tracks consumption by source type
     - Supports multiple sources per facility

  3. `facility_water_discharge_quality` - Discharge water quality metrics
     - BOD, COD, suspended solids, pH, temperature
     - Treatment level tracking

  4. `aware_factors` - AWARE methodology water scarcity factors by region
     - Location-specific scarcity factors
     - Risk level classifications

  ## Views
  - `facility_water_summary` - Aggregated water metrics per facility
  - `company_water_overview` - Organisation-level water aggregation

  ## Security
  - RLS enabled on all tables
  - Organisation-scoped access control
*/

-- ============================================================================
-- STEP 1: Create Water Source Type Enum (if not exists)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'water_source_type') THEN
    CREATE TYPE water_source_type AS ENUM (
      'municipal',
      'groundwater',
      'surface_water',
      'rainwater',
      'recycled',
      'seawater',
      'other'
    );
  END IF;
END $$;

COMMENT ON TYPE water_source_type IS 'Types of water sources for facility consumption tracking';

-- ============================================================================
-- STEP 2: Create Water Quality Level Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'water_treatment_level') THEN
    CREATE TYPE water_treatment_level AS ENUM (
      'none',
      'primary',
      'secondary',
      'tertiary',
      'advanced'
    );
  END IF;
END $$;

COMMENT ON TYPE water_treatment_level IS 'Discharge water treatment levels';

-- ============================================================================
-- STEP 3: Create Facility Water Data Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facility_water_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Time period
  reporting_year INTEGER NOT NULL,
  reporting_month INTEGER CHECK (reporting_month >= 1 AND reporting_month <= 12),
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  
  -- Consumption metrics (in cubic metres)
  total_consumption_m3 NUMERIC NOT NULL DEFAULT 0 CHECK (total_consumption_m3 >= 0),
  municipal_consumption_m3 NUMERIC DEFAULT 0 CHECK (municipal_consumption_m3 >= 0),
  groundwater_consumption_m3 NUMERIC DEFAULT 0 CHECK (groundwater_consumption_m3 >= 0),
  surface_water_consumption_m3 NUMERIC DEFAULT 0 CHECK (surface_water_consumption_m3 >= 0),
  rainwater_consumption_m3 NUMERIC DEFAULT 0 CHECK (rainwater_consumption_m3 >= 0),
  recycled_consumption_m3 NUMERIC DEFAULT 0 CHECK (recycled_consumption_m3 >= 0),
  
  -- Discharge metrics
  total_discharge_m3 NUMERIC DEFAULT 0 CHECK (total_discharge_m3 >= 0),
  discharge_to_municipal_m3 NUMERIC DEFAULT 0,
  discharge_to_surface_water_m3 NUMERIC DEFAULT 0,
  discharge_treatment_level water_treatment_level DEFAULT 'none',
  
  -- Calculated metrics
  net_consumption_m3 NUMERIC GENERATED ALWAYS AS (total_consumption_m3 - COALESCE(total_discharge_m3, 0)) STORED,
  recycling_rate NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN total_consumption_m3 > 0 
      THEN ROUND((COALESCE(recycled_consumption_m3, 0) / total_consumption_m3) * 100, 2)
      ELSE 0 
    END
  ) STORED,
  
  -- Production context for intensity calculations
  production_volume NUMERIC,
  production_unit TEXT DEFAULT 'units',
  water_intensity_m3_per_unit NUMERIC GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(production_volume, 0) > 0 
      THEN ROUND(total_consumption_m3 / production_volume, 6)
      ELSE NULL 
    END
  ) STORED,
  
  -- Data quality
  data_quality TEXT DEFAULT 'estimated' CHECK (data_quality IN ('measured', 'metered', 'estimated', 'proxy')),
  measurement_method TEXT,
  data_source TEXT,
  notes TEXT,
  
  -- AWARE methodology
  aware_factor NUMERIC,
  scarcity_weighted_consumption_m3 NUMERIC GENERATED ALWAYS AS (
    total_consumption_m3 * COALESCE(aware_factor, 1)
  ) STORED,
  risk_level TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN COALESCE(aware_factor, 1) >= 10 THEN 'high'
      WHEN COALESCE(aware_factor, 1) >= 1 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  
  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Prevent duplicate entries for same facility/period
  UNIQUE(facility_id, reporting_year, reporting_month)
);

COMMENT ON TABLE public.facility_water_data IS 'Facility-level water consumption and discharge tracking with AWARE methodology';
COMMENT ON COLUMN public.facility_water_data.aware_factor IS 'AWARE water scarcity factor for facility location (higher = more water stress)';
COMMENT ON COLUMN public.facility_water_data.scarcity_weighted_consumption_m3 IS 'Consumption weighted by AWARE factor (m³ world equivalent)';

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_facility_water_data_facility_id 
  ON public.facility_water_data(facility_id);

CREATE INDEX IF NOT EXISTS idx_facility_water_data_org_id 
  ON public.facility_water_data(organization_id);

CREATE INDEX IF NOT EXISTS idx_facility_water_data_period 
  ON public.facility_water_data(reporting_year, reporting_month);

CREATE INDEX IF NOT EXISTS idx_facility_water_data_risk 
  ON public.facility_water_data(risk_level);

-- ============================================================================
-- STEP 4: Create AWARE Factors Reference Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.aware_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  region TEXT,
  sub_region TEXT,
  aware_factor NUMERIC NOT NULL CHECK (aware_factor > 0),
  baseline_water_stress NUMERIC,
  risk_level TEXT GENERATED ALWAYS AS (
    CASE 
      WHEN aware_factor >= 10 THEN 'high'
      WHEN aware_factor >= 1 THEN 'medium'
      ELSE 'low'
    END
  ) STORED,
  source TEXT DEFAULT 'AWARE v1.3',
  year INTEGER DEFAULT 2023,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.aware_factors IS 'AWARE water scarcity characterisation factors by region';
COMMENT ON COLUMN public.aware_factors.aware_factor IS 'Available Water Remaining factor - higher values indicate greater scarcity';

CREATE INDEX IF NOT EXISTS idx_aware_factors_country 
  ON public.aware_factors(country_code);

CREATE INDEX IF NOT EXISTS idx_aware_factors_region 
  ON public.aware_factors(region);

-- ============================================================================
-- STEP 5: Seed Initial AWARE Factors for Common Countries
-- ============================================================================

INSERT INTO public.aware_factors (country_code, country_name, region, aware_factor, baseline_water_stress)
VALUES
  ('GB', 'United Kingdom', 'Northern Europe', 0.42, 0.13),
  ('IE', 'Ireland', 'Northern Europe', 0.18, 0.04),
  ('FR', 'France', 'Western Europe', 1.24, 0.17),
  ('DE', 'Germany', 'Western Europe', 0.89, 0.22),
  ('ES', 'Spain', 'Southern Europe', 12.5, 0.32),
  ('IT', 'Italy', 'Southern Europe', 4.82, 0.28),
  ('PT', 'Portugal', 'Southern Europe', 8.34, 0.25),
  ('NL', 'Netherlands', 'Western Europe', 0.56, 0.21),
  ('BE', 'Belgium', 'Western Europe', 0.78, 0.31),
  ('AT', 'Austria', 'Central Europe', 0.31, 0.07),
  ('CH', 'Switzerland', 'Central Europe', 0.25, 0.05),
  ('PL', 'Poland', 'Eastern Europe', 0.95, 0.19),
  ('CZ', 'Czech Republic', 'Eastern Europe', 1.12, 0.16),
  ('SE', 'Sweden', 'Northern Europe', 0.15, 0.03),
  ('NO', 'Norway', 'Northern Europe', 0.08, 0.02),
  ('DK', 'Denmark', 'Northern Europe', 0.38, 0.11),
  ('FI', 'Finland', 'Northern Europe', 0.12, 0.02),
  ('US', 'United States', 'North America', 2.45, 0.24),
  ('CA', 'Canada', 'North America', 0.35, 0.08),
  ('MX', 'Mexico', 'Central America', 5.67, 0.35),
  ('BR', 'Brazil', 'South America', 0.89, 0.09),
  ('AR', 'Argentina', 'South America', 2.34, 0.21),
  ('CL', 'Chile', 'South America', 6.78, 0.48),
  ('AU', 'Australia', 'Oceania', 9.45, 0.42),
  ('NZ', 'New Zealand', 'Oceania', 0.28, 0.05),
  ('JP', 'Japan', 'East Asia', 1.56, 0.19),
  ('CN', 'China', 'East Asia', 3.89, 0.43),
  ('KR', 'South Korea', 'East Asia', 1.78, 0.26),
  ('IN', 'India', 'South Asia', 8.92, 0.54),
  ('SG', 'Singapore', 'Southeast Asia', 0.45, 0.12),
  ('TH', 'Thailand', 'Southeast Asia', 1.23, 0.11),
  ('VN', 'Vietnam', 'Southeast Asia', 0.98, 0.09),
  ('ID', 'Indonesia', 'Southeast Asia', 0.78, 0.06),
  ('MY', 'Malaysia', 'Southeast Asia', 0.56, 0.05),
  ('ZA', 'South Africa', 'Southern Africa', 14.2, 0.42),
  ('EG', 'Egypt', 'North Africa', 25.8, 0.85),
  ('MA', 'Morocco', 'North Africa', 18.4, 0.45),
  ('AE', 'United Arab Emirates', 'Middle East', 45.6, 0.95),
  ('SA', 'Saudi Arabia', 'Middle East', 52.3, 0.98),
  ('IL', 'Israel', 'Middle East', 32.1, 0.72)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- STEP 6: Create Facility Water Discharge Quality Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facility_water_discharge_quality (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_water_data_id UUID NOT NULL REFERENCES public.facility_water_data(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  
  -- Quality parameters
  bod_mg_l NUMERIC CHECK (bod_mg_l >= 0),
  cod_mg_l NUMERIC CHECK (cod_mg_l >= 0),
  tss_mg_l NUMERIC CHECK (tss_mg_l >= 0),
  ph NUMERIC CHECK (ph >= 0 AND ph <= 14),
  temperature_c NUMERIC,
  total_nitrogen_mg_l NUMERIC CHECK (total_nitrogen_mg_l >= 0),
  total_phosphorus_mg_l NUMERIC CHECK (total_phosphorus_mg_l >= 0),
  
  -- Compliance
  meets_local_standards BOOLEAN DEFAULT true,
  compliance_notes TEXT,
  
  -- Audit
  sample_date DATE,
  lab_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.facility_water_discharge_quality IS 'Discharge water quality metrics for environmental compliance';

CREATE INDEX IF NOT EXISTS idx_water_discharge_quality_facility 
  ON public.facility_water_discharge_quality(facility_id);

-- ============================================================================
-- STEP 7: Create Facility Water Summary View
-- ============================================================================

CREATE OR REPLACE VIEW public.facility_water_summary AS
SELECT 
  f.id AS facility_id,
  f.organization_id,
  f.name AS facility_name,
  f.address_city AS city,
  f.address_country AS country,
  f.location_country_code AS country_code,
  f.latitude,
  f.longitude,
  
  -- Aggregated consumption (last 12 months)
  COALESCE(SUM(fwd.total_consumption_m3), 0) AS total_consumption_m3,
  COALESCE(SUM(fwd.municipal_consumption_m3), 0) AS municipal_consumption_m3,
  COALESCE(SUM(fwd.groundwater_consumption_m3), 0) AS groundwater_consumption_m3,
  COALESCE(SUM(fwd.surface_water_consumption_m3), 0) AS surface_water_consumption_m3,
  COALESCE(SUM(fwd.rainwater_consumption_m3), 0) AS rainwater_consumption_m3,
  COALESCE(SUM(fwd.recycled_consumption_m3), 0) AS recycled_consumption_m3,
  
  -- Discharge
  COALESCE(SUM(fwd.total_discharge_m3), 0) AS total_discharge_m3,
  COALESCE(SUM(fwd.net_consumption_m3), 0) AS net_consumption_m3,
  
  -- Scarcity weighted impact
  COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) AS aware_factor,
  COALESCE(SUM(fwd.scarcity_weighted_consumption_m3), 0) AS scarcity_weighted_consumption_m3,
  
  -- Risk level (from most recent entry or calculated)
  CASE 
    WHEN COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) >= 10 THEN 'high'
    WHEN COALESCE(AVG(fwd.aware_factor), af.aware_factor, 1) >= 1 THEN 'medium'
    ELSE 'low'
  END AS risk_level,
  
  -- Recycling rate
  CASE 
    WHEN COALESCE(SUM(fwd.total_consumption_m3), 0) > 0 
    THEN ROUND((COALESCE(SUM(fwd.recycled_consumption_m3), 0) / SUM(fwd.total_consumption_m3)) * 100, 1)
    ELSE 0 
  END AS recycling_rate_percent,
  
  -- Intensity
  CASE 
    WHEN COALESCE(SUM(fwd.production_volume), 0) > 0 
    THEN ROUND(SUM(fwd.total_consumption_m3) / SUM(fwd.production_volume), 4)
    ELSE NULL 
  END AS avg_water_intensity_m3_per_unit,
  
  -- Data quality
  COUNT(DISTINCT fwd.id) AS data_points_count,
  COUNT(DISTINCT CASE WHEN fwd.data_quality = 'measured' OR fwd.data_quality = 'metered' THEN fwd.id END) AS measured_data_points,
  
  -- Time range
  MIN(fwd.reporting_period_start) AS earliest_data,
  MAX(fwd.reporting_period_end) AS latest_data

FROM public.facilities f
LEFT JOIN public.facility_water_data fwd ON f.id = fwd.facility_id
  AND fwd.reporting_period_start >= (CURRENT_DATE - INTERVAL '12 months')
LEFT JOIN public.aware_factors af ON f.location_country_code = af.country_code
GROUP BY f.id, f.organization_id, f.name, f.address_city, f.address_country, 
         f.location_country_code, f.latitude, f.longitude, af.aware_factor;

COMMENT ON VIEW public.facility_water_summary IS 'Aggregated water metrics per facility with AWARE risk assessment';

-- ============================================================================
-- STEP 8: Create Company Water Overview View
-- ============================================================================

CREATE OR REPLACE VIEW public.company_water_overview AS
SELECT 
  organization_id,
  
  -- Total consumption
  SUM(total_consumption_m3) AS total_consumption_m3,
  SUM(net_consumption_m3) AS net_consumption_m3,
  SUM(scarcity_weighted_consumption_m3) AS scarcity_weighted_consumption_m3,
  
  -- Source breakdown
  SUM(municipal_consumption_m3) AS municipal_consumption_m3,
  SUM(groundwater_consumption_m3) AS groundwater_consumption_m3,
  SUM(surface_water_consumption_m3) AS surface_water_consumption_m3,
  SUM(rainwater_consumption_m3) AS rainwater_consumption_m3,
  SUM(recycled_consumption_m3) AS recycled_consumption_m3,
  
  -- Discharge
  SUM(total_discharge_m3) AS total_discharge_m3,
  
  -- Percentages
  CASE 
    WHEN SUM(total_consumption_m3) > 0 
    THEN ROUND((SUM(municipal_consumption_m3) / SUM(total_consumption_m3)) * 100, 1)
    ELSE 0 
  END AS municipal_percent,
  CASE 
    WHEN SUM(total_consumption_m3) > 0 
    THEN ROUND((SUM(groundwater_consumption_m3) / SUM(total_consumption_m3)) * 100, 1)
    ELSE 0 
  END AS groundwater_percent,
  CASE 
    WHEN SUM(total_consumption_m3) > 0 
    THEN ROUND((SUM(surface_water_consumption_m3) / SUM(total_consumption_m3)) * 100, 1)
    ELSE 0 
  END AS surface_water_percent,
  CASE 
    WHEN SUM(total_consumption_m3) > 0 
    THEN ROUND((SUM(recycled_consumption_m3) / SUM(total_consumption_m3)) * 100, 1)
    ELSE 0 
  END AS recycled_percent,
  
  -- Facility counts by risk
  COUNT(*) FILTER (WHERE risk_level = 'high') AS high_risk_facilities,
  COUNT(*) FILTER (WHERE risk_level = 'medium') AS medium_risk_facilities,
  COUNT(*) FILTER (WHERE risk_level = 'low') AS low_risk_facilities,
  COUNT(*) AS total_facilities,
  
  -- Average metrics
  AVG(aware_factor) AS avg_aware_factor,
  AVG(recycling_rate_percent) AS avg_recycling_rate

FROM public.facility_water_summary
WHERE total_consumption_m3 > 0
GROUP BY organization_id;

COMMENT ON VIEW public.company_water_overview IS 'Organisation-level water aggregation with source breakdown and risk summary';

-- ============================================================================
-- STEP 9: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.facility_water_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_water_discharge_quality ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view water data for their organisation
CREATE POLICY "Users can view facility water data for their organisation"
  ON public.facility_water_data
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Users can insert water data for their organisation
CREATE POLICY "Users can insert facility water data for their organisation"
  ON public.facility_water_data
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Users can update water data for their organisation
CREATE POLICY "Users can update facility water data for their organisation"
  ON public.facility_water_data
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS: Users can delete water data for their organisation
CREATE POLICY "Users can delete facility water data for their organisation"
  ON public.facility_water_data
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id 
      FROM public.organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- RLS for discharge quality
CREATE POLICY "Users can view discharge quality for their organisation"
  ON public.facility_water_discharge_quality
  FOR SELECT
  TO authenticated
  USING (
    facility_id IN (
      SELECT f.id FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage discharge quality for their organisation"
  ON public.facility_water_discharge_quality
  FOR ALL
  TO authenticated
  USING (
    facility_id IN (
      SELECT f.id FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    facility_id IN (
      SELECT f.id FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Grant access to views
GRANT SELECT ON public.facility_water_summary TO authenticated;
GRANT SELECT ON public.company_water_overview TO authenticated;
GRANT SELECT ON public.aware_factors TO authenticated;

-- ============================================================================
-- STEP 10: Create Updated At Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION update_facility_water_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER facility_water_data_updated_at
  BEFORE UPDATE ON public.facility_water_data
  FOR EACH ROW
  EXECUTE FUNCTION update_facility_water_data_updated_at();

-- ============================================================================
-- STEP 11: Create Helper Function to Get AWARE Factor for Facility
-- ============================================================================

CREATE OR REPLACE FUNCTION get_facility_aware_factor(p_facility_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_country_code TEXT;
  v_aware_factor NUMERIC;
BEGIN
  -- Get facility country code
  SELECT COALESCE(location_country_code, address_country) INTO v_country_code
  FROM public.facilities
  WHERE id = p_facility_id;
  
  -- Get AWARE factor for country
  SELECT aware_factor INTO v_aware_factor
  FROM public.aware_factors
  WHERE country_code = v_country_code
  LIMIT 1;
  
  -- Return factor or default to 1
  RETURN COALESCE(v_aware_factor, 1);
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_facility_aware_factor IS 'Returns the AWARE water scarcity factor for a facility based on its location';
