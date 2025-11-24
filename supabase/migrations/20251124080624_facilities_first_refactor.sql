/*
  # Facilities-First Refactor: Utility Type Enum and Scope Mapping

  ## Overview
  This migration implements the "Glass Box" data provenance principle by:
  1. Creating a comprehensive utility_type enum with auto-scope mapping
  2. Adding facility metadata fields (functions, operational_control, address)
  3. Creating utility_data_entries table with automatic scope tagging
  4. Creating data_contract table to track facility data commitments

  ## New Tables
  - `utility_data_entries`: Facility utility consumption data
  - `facility_data_contracts`: Defines what data each facility will provide

  ## Schema Changes
  - Add `functions` (text[]) to facilities
  - Add `operational_control` (enum) to facilities  
  - Add `address_line1`, `address_city`, `address_country` to facilities

  ## Utility Type Master Dictionary
  Each utility type automatically maps to Scope 1 or Scope 2:
  - Scope 1: Natural gas, LPG, diesel, fuel oil, biomass, refrigerants, fleet fuels
  - Scope 2: Purchased electricity, heat, steam

  ## Security
  - RLS enabled on all new tables
  - Organization-scoped access control
*/

-- ============================================================================
-- STEP 1: Create Utility Type Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'utility_type_enum') THEN
    CREATE TYPE utility_type_enum AS ENUM (
      'electricity_grid',
      'heat_steam_purchased',
      'natural_gas',
      'lpg',
      'diesel_stationary',
      'heavy_fuel_oil',
      'biomass_solid',
      'refrigerant_leakage',
      'diesel_mobile',
      'petrol_mobile'
    );
  END IF;
END $$;

COMMENT ON TYPE utility_type_enum IS 'Predefined utility types with automatic Scope 1/2 classification';

-- ============================================================================
-- STEP 2: Create Operational Control Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'operational_control_enum') THEN
    CREATE TYPE operational_control_enum AS ENUM (
      'owned',
      'third_party'
    );
  END IF;
END $$;

COMMENT ON TYPE operational_control_enum IS 'Determines if facility data goes to Scope 1&2 or Scope 3';

-- ============================================================================
-- STEP 3: Create Data Quality Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'data_quality_enum') THEN
    CREATE TYPE data_quality_enum AS ENUM (
      'actual',
      'estimated'
    );
  END IF;
END $$;

COMMENT ON TYPE data_quality_enum IS 'Quality flag for utility data entries';

-- ============================================================================
-- STEP 4: Create Frequency Enum
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'frequency_enum') THEN
    CREATE TYPE frequency_enum AS ENUM (
      'monthly',
      'yearly'
    );
  END IF;
END $$;

COMMENT ON TYPE frequency_enum IS 'Reporting frequency for facility data contracts';

-- ============================================================================
-- STEP 5: Extend Facilities Table
-- ============================================================================

DO $$
BEGIN
  -- Add functions array
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'facilities'
    AND column_name = 'functions'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN functions TEXT[] DEFAULT '{}';
    
    COMMENT ON COLUMN public.facilities.functions IS 'Array of facility functions: Brewing, Bottling, Warehousing, etc.';
  END IF;

  -- Add operational control
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'facilities'
    AND column_name = 'operational_control'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN operational_control operational_control_enum DEFAULT 'owned';
    
    COMMENT ON COLUMN public.facilities.operational_control IS 'Determines scope classification: owned = Scope 1&2, third_party = Scope 3';
  END IF;

  -- Add address fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'facilities'
    AND column_name = 'address_line1'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN address_line1 TEXT,
      ADD COLUMN address_city TEXT,
      ADD COLUMN address_country TEXT,
      ADD COLUMN address_postcode TEXT,
      ADD COLUMN address_lat NUMERIC(10, 7),
      ADD COLUMN address_lng NUMERIC(10, 7);
    
    COMMENT ON COLUMN public.facilities.address_line1 IS 'Street address for grid emission factor selection';
    COMMENT ON COLUMN public.facilities.address_country IS 'Country code for regional emission factors';
  END IF;
END $$;

-- ============================================================================
-- STEP 6: Create Utility Data Entries Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.utility_data_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  utility_type utility_type_enum NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL,
  reporting_period_start DATE NOT NULL,
  reporting_period_end DATE NOT NULL,
  data_quality data_quality_enum DEFAULT 'actual',
  calculated_scope TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.utility_data_entries IS 'Facility utility consumption data with automatic scope tagging';
COMMENT ON COLUMN public.utility_data_entries.calculated_scope IS 'Auto-calculated based on utility_type: Scope 1 or Scope 2';
COMMENT ON COLUMN public.utility_data_entries.data_quality IS 'Actual meter readings vs estimated consumption';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_utility_data_facility_id 
  ON public.utility_data_entries(facility_id);

CREATE INDEX IF NOT EXISTS idx_utility_data_utility_type 
  ON public.utility_data_entries(utility_type);

CREATE INDEX IF NOT EXISTS idx_utility_data_scope 
  ON public.utility_data_entries(calculated_scope);

CREATE INDEX IF NOT EXISTS idx_utility_data_period 
  ON public.utility_data_entries(reporting_period_start, reporting_period_end);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_utility_data_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER utility_data_updated_at
  BEFORE UPDATE ON public.utility_data_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_utility_data_updated_at();

-- ============================================================================
-- STEP 7: Create Facility Data Contracts Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.facility_data_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES public.facilities(id) ON DELETE CASCADE,
  utility_type utility_type_enum NOT NULL,
  frequency frequency_enum NOT NULL,
  data_quality data_quality_enum NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(facility_id, utility_type)
);

COMMENT ON TABLE public.facility_data_contracts IS 'Defines what utility data each facility commits to providing';
COMMENT ON COLUMN public.facility_data_contracts.frequency IS 'How often data will be reported: monthly or yearly';

CREATE INDEX IF NOT EXISTS idx_data_contracts_facility_id 
  ON public.facility_data_contracts(facility_id);

-- ============================================================================
-- STEP 8: Create Scope Mapping Function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_scope_for_utility_type(p_utility_type utility_type_enum)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE p_utility_type
    -- Scope 2: Purchased Energy
    WHEN 'electricity_grid' THEN 'Scope 2'
    WHEN 'heat_steam_purchased' THEN 'Scope 2'
    
    -- Scope 1: Direct Emissions
    WHEN 'natural_gas' THEN 'Scope 1'
    WHEN 'lpg' THEN 'Scope 1'
    WHEN 'diesel_stationary' THEN 'Scope 1'
    WHEN 'heavy_fuel_oil' THEN 'Scope 1'
    WHEN 'biomass_solid' THEN 'Scope 1'
    WHEN 'refrigerant_leakage' THEN 'Scope 1'
    WHEN 'diesel_mobile' THEN 'Scope 1'
    WHEN 'petrol_mobile' THEN 'Scope 1'
    
    ELSE 'Unknown'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_scope_for_utility_type IS 'Maps utility type to Scope 1 or Scope 2 automatically';

-- ============================================================================
-- STEP 9: Create Auto-Scope Tagging Trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_tag_utility_scope()
RETURNS TRIGGER AS $$
BEGIN
  NEW.calculated_scope := get_scope_for_utility_type(NEW.utility_type);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_tag_utility_scope
  BEFORE INSERT OR UPDATE OF utility_type ON public.utility_data_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_tag_utility_scope();

COMMENT ON TRIGGER trigger_auto_tag_utility_scope ON public.utility_data_entries IS 
  'Automatically sets calculated_scope based on utility_type on insert/update';

-- ============================================================================
-- STEP 10: Enable Row Level Security
-- ============================================================================

ALTER TABLE public.utility_data_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_data_contracts ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view utility data for facilities in their organization
CREATE POLICY "Users can view utility data for their organization facilities"
  ON public.utility_data_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = utility_data_entries.facility_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS: Users can insert utility data for their organization facilities
CREATE POLICY "Users can insert utility data for their organization facilities"
  ON public.utility_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = utility_data_entries.facility_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS: Users can update utility data for their organization facilities
CREATE POLICY "Users can update utility data for their organization facilities"
  ON public.utility_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = utility_data_entries.facility_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = utility_data_entries.facility_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS: Users can delete utility data for their organization facilities
CREATE POLICY "Users can delete utility data for their organization facilities"
  ON public.utility_data_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = utility_data_entries.facility_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS: Users can view data contracts for their organization facilities
CREATE POLICY "Users can view data contracts for their organization facilities"
  ON public.facility_data_contracts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = facility_data_contracts.facility_id
      AND om.user_id = auth.uid()
    )
  );

-- RLS: Users can manage data contracts for their organization facilities
CREATE POLICY "Users can manage data contracts for their organization facilities"
  ON public.facility_data_contracts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = facility_data_contracts.facility_id
      AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facilities f
      INNER JOIN public.organization_members om ON f.organization_id = om.organization_id
      WHERE f.id = facility_data_contracts.facility_id
      AND om.user_id = auth.uid()
    )
  );
