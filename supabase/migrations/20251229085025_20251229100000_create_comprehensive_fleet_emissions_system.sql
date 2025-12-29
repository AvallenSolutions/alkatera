/*
  # Comprehensive Fleet Emissions Management System

  ## Summary
  Creates a complete fleet emissions tracking system that supports:
  - Multiple vehicle ownership types (company-owned, leased, employee-owned, rental)
  - Automatic scope assignment based on ownership and fuel type
  - Multiple data entry methods (volume, distance, spend, consumption)
  - Integration with existing DEFRA 2025 emission factors
  - Full audit trail and calculation provenance

  ## Tables Created/Modified

  ### 1. fleet_emission_sources (NEW Reference Table)
  Immutable reference table linking vehicle types to emission factors:
  - source_name: Descriptive name for the emission source
  - fuel_type: diesel, petrol, electric, lpg, hybrid_diesel, hybrid_petrol, biodiesel
  - vehicle_category: car, van, hgv, motorcycle
  - calculated_scope: Auto-determined GHG Protocol scope
  - Supports multiple data entry methods with linked emission factors

  ### 2. vehicles table (ENHANCED)
  Added columns:
  - ownership_type: company_owned, company_leased, employee_owned, rental
  - calculated_scope: Scope 1, Scope 2, Scope 3 Cat 6

  ### 3. fleet_activities table (ENHANCED)
  Added columns for multiple data entry methods:
  - data_entry_method: volume, distance, spend, consumption
  - fuel_volume_litres, spend_amount, spend_currency, electricity_kwh
  - data_quality: Primary, Secondary, Tertiary
  - provenance_id: Link to data provenance trail

  ## Security
  - RLS enabled on all tables
  - Organization-scoped access policies
  - Admin-only management for vehicle registry

  ## Triggers
  - Auto-calculate vehicle scope on insert/update
  - Auto-calculate activity scope based on vehicle or manual fields
*/

-- ============================================
-- PART 1: Create fleet_emission_sources reference table
-- ============================================

CREATE TABLE IF NOT EXISTS fleet_emission_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  fuel_type TEXT NOT NULL CHECK (fuel_type IN ('diesel', 'petrol', 'electric', 'lpg', 'hybrid_diesel', 'hybrid_petrol', 'biodiesel', 'cng', 'hydrogen')),
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('car', 'van', 'hgv', 'motorcycle', 'bus', 'taxi')),
  calculated_scope TEXT NOT NULL CHECK (calculated_scope IN ('Scope 1', 'Scope 2', 'Scope 3 Cat 6')),
  default_unit TEXT NOT NULL,
  supports_volume BOOLEAN DEFAULT false,
  supports_distance BOOLEAN DEFAULT false,
  supports_spend BOOLEAN DEFAULT false,
  supports_consumption BOOLEAN DEFAULT false,
  emission_factor_volume_id UUID REFERENCES emissions_factors(factor_id),
  emission_factor_distance_id UUID REFERENCES emissions_factors(factor_id),
  emission_factor_spend_id UUID REFERENCES emissions_factors(factor_id),
  emission_factor_consumption_id UUID REFERENCES emissions_factors(factor_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(fuel_type, vehicle_category, calculated_scope)
);

CREATE INDEX IF NOT EXISTS idx_fleet_emission_sources_fuel_category 
ON fleet_emission_sources(fuel_type, vehicle_category);

CREATE INDEX IF NOT EXISTS idx_fleet_emission_sources_scope 
ON fleet_emission_sources(calculated_scope);

COMMENT ON TABLE fleet_emission_sources IS 'Reference table mapping vehicle fuel/category combinations to emission factors and supported data entry methods';

-- ============================================
-- PART 2: Enhance vehicles table
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'ownership_type') THEN
    ALTER TABLE vehicles ADD COLUMN ownership_type TEXT 
      CHECK (ownership_type IN ('company_owned', 'company_leased', 'employee_owned', 'rental'))
      DEFAULT 'company_owned';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'calculated_scope') THEN
    ALTER TABLE vehicles ADD COLUMN calculated_scope TEXT 
      CHECK (calculated_scope IN ('Scope 1', 'Scope 2', 'Scope 3 Cat 6'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'driver_name') THEN
    ALTER TABLE vehicles ADD COLUMN driver_name TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'department') THEN
    ALTER TABLE vehicles ADD COLUMN department TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'cost_center') THEN
    ALTER TABLE vehicles ADD COLUMN cost_center TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'date_acquired') THEN
    ALTER TABLE vehicles ADD COLUMN date_acquired DATE DEFAULT CURRENT_DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'vehicles' AND column_name = 'date_disposed') THEN
    ALTER TABLE vehicles ADD COLUMN date_disposed DATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vehicles_ownership ON vehicles(organization_id, ownership_type);
CREATE INDEX IF NOT EXISTS idx_vehicles_scope ON vehicles(organization_id, calculated_scope);

-- ============================================
-- PART 3: Enhance fleet_activities table
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'data_entry_method') THEN
    ALTER TABLE fleet_activities ADD COLUMN data_entry_method TEXT 
      CHECK (data_entry_method IN ('volume', 'distance', 'spend', 'consumption'))
      DEFAULT 'distance';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'fuel_volume_litres') THEN
    ALTER TABLE fleet_activities ADD COLUMN fuel_volume_litres NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'spend_amount') THEN
    ALTER TABLE fleet_activities ADD COLUMN spend_amount NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'spend_currency') THEN
    ALTER TABLE fleet_activities ADD COLUMN spend_currency TEXT 
      CHECK (spend_currency IN ('GBP', 'USD', 'EUR'))
      DEFAULT 'GBP';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'electricity_kwh') THEN
    ALTER TABLE fleet_activities ADD COLUMN electricity_kwh NUMERIC;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'grid_region') THEN
    ALTER TABLE fleet_activities ADD COLUMN grid_region TEXT DEFAULT 'UK';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'data_quality') THEN
    ALTER TABLE fleet_activities ADD COLUMN data_quality TEXT 
      CHECK (data_quality IN ('Primary', 'Secondary', 'Tertiary'))
      DEFAULT 'Secondary';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'data_source_notes') THEN
    ALTER TABLE fleet_activities ADD COLUMN data_source_notes TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'provenance_id') THEN
    ALTER TABLE fleet_activities ADD COLUMN provenance_id UUID REFERENCES data_provenance_trail(provenance_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'reporting_period_start') THEN
    ALTER TABLE fleet_activities ADD COLUMN reporting_period_start DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'reporting_period_end') THEN
    ALTER TABLE fleet_activities ADD COLUMN reporting_period_end DATE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'manual_vehicle_category') THEN
    ALTER TABLE fleet_activities ADD COLUMN manual_vehicle_category TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'manual_fuel_type') THEN
    ALTER TABLE fleet_activities ADD COLUMN manual_fuel_type TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'manual_ownership_type') THEN
    ALTER TABLE fleet_activities ADD COLUMN manual_ownership_type TEXT 
      CHECK (manual_ownership_type IN ('company_owned', 'company_leased', 'employee_owned', 'rental'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'fleet_activities' AND column_name = 'emission_factor_id') THEN
    ALTER TABLE fleet_activities ADD COLUMN emission_factor_id UUID REFERENCES emissions_factors(factor_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fleet_activities_period ON fleet_activities(reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_fleet_activities_method ON fleet_activities(organization_id, data_entry_method);

-- ============================================
-- PART 4: Create automatic scope calculation triggers
-- ============================================

CREATE OR REPLACE FUNCTION auto_calculate_vehicle_scope()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ownership_type IN ('company_owned', 'company_leased') THEN
    IF NEW.propulsion_type IN ('ice', 'hybrid') AND 
       NEW.fuel_type IN ('diesel', 'petrol', 'lpg', 'biodiesel', 'cng') THEN
      NEW.calculated_scope := 'Scope 1';
    ELSIF NEW.propulsion_type = 'bev' OR NEW.fuel_type = 'electric' THEN
      NEW.calculated_scope := 'Scope 2';
    ELSE
      NEW.calculated_scope := 'Scope 1';
    END IF;
  ELSIF NEW.ownership_type IN ('employee_owned', 'rental') THEN
    NEW.calculated_scope := 'Scope 3 Cat 6';
  ELSE
    NEW.calculated_scope := 'Scope 1';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_vehicle_scope ON vehicles;

CREATE TRIGGER trg_auto_calculate_vehicle_scope
  BEFORE INSERT OR UPDATE OF ownership_type, propulsion_type, fuel_type ON vehicles
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_vehicle_scope();

CREATE OR REPLACE FUNCTION auto_calculate_fleet_activity_scope()
RETURNS TRIGGER AS $$
DECLARE
  v_vehicle_scope TEXT;
  v_fuel_type TEXT;
  v_ownership_type TEXT;
BEGIN
  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT calculated_scope INTO v_vehicle_scope
    FROM vehicles WHERE id = NEW.vehicle_id;
    
    IF v_vehicle_scope IS NOT NULL THEN
      NEW.scope := v_vehicle_scope;
      RETURN NEW;
    END IF;
  END IF;
  
  v_fuel_type := COALESCE(NEW.manual_fuel_type, 'petrol');
  v_ownership_type := COALESCE(NEW.manual_ownership_type, 'company_owned');
  
  IF v_ownership_type IN ('company_owned', 'company_leased') THEN
    IF v_fuel_type IN ('diesel', 'petrol', 'lpg', 'biodiesel', 'cng', 'hybrid_diesel', 'hybrid_petrol') THEN
      NEW.scope := 'Scope 1';
    ELSIF v_fuel_type = 'electric' THEN
      NEW.scope := 'Scope 2';
    ELSE
      NEW.scope := 'Scope 1';
    END IF;
  ELSIF v_ownership_type IN ('employee_owned', 'rental') THEN
    NEW.scope := 'Scope 3 Cat 6';
  ELSE
    NEW.scope := 'Scope 1';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_fleet_activity_scope ON fleet_activities;

CREATE TRIGGER trg_auto_calculate_fleet_activity_scope
  BEFORE INSERT OR UPDATE ON fleet_activities
  FOR EACH ROW EXECUTE FUNCTION auto_calculate_fleet_activity_scope();

-- ============================================
-- PART 5: Create RLS policies
-- ============================================

ALTER TABLE fleet_emission_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view fleet emission sources" ON fleet_emission_sources;
CREATE POLICY "Anyone can view fleet emission sources"
  ON fleet_emission_sources FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view vehicles in their organization" ON vehicles;
CREATE POLICY "Users can view vehicles in their organization"
  ON vehicles FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
CREATE POLICY "Admins can manage vehicles"
  ON vehicles FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT om.organization_id FROM organization_members om
    JOIN roles r ON om.role_id = r.id
    WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
  ))
  WITH CHECK (organization_id IN (
    SELECT om.organization_id FROM organization_members om
    JOIN roles r ON om.role_id = r.id
    WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
  ));

DROP POLICY IF EXISTS "Users can view fleet activities in their organization" ON fleet_activities;
CREATE POLICY "Users can view fleet activities in their organization"
  ON fleet_activities FOR SELECT TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can insert fleet activities for their organization" ON fleet_activities;
CREATE POLICY "Users can insert fleet activities for their organization"
  ON fleet_activities FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Users can update their own fleet activities" ON fleet_activities;
CREATE POLICY "Users can update their own fleet activities"
  ON fleet_activities FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid() OR
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN roles r ON om.role_id = r.id
      WHERE om.user_id = auth.uid() AND r.name IN ('owner', 'admin')
    )
  );

-- ============================================
-- PART 6: Create reporting views
-- ============================================

DROP VIEW IF EXISTS fleet_emissions_by_scope;
CREATE VIEW fleet_emissions_by_scope AS
SELECT
  organization_id,
  scope as calculated_scope,
  data_entry_method,
  COUNT(*) as entry_count,
  SUM(emissions_tco2e) as total_tco2e,
  MIN(COALESCE(reporting_period_start, activity_date)) as earliest_period,
  MAX(COALESCE(reporting_period_end, activity_date)) as latest_period
FROM fleet_activities
WHERE emissions_tco2e IS NOT NULL
GROUP BY organization_id, scope, data_entry_method;

DROP VIEW IF EXISTS fleet_vehicle_summary;
CREATE VIEW fleet_vehicle_summary AS
SELECT
  organization_id,
  calculated_scope,
  fuel_type,
  vehicle_class as vehicle_category,
  ownership_type,
  COUNT(*) FILTER (WHERE status = 'active') as active_vehicles,
  COUNT(*) FILTER (WHERE status != 'active') as inactive_vehicles,
  COUNT(*) as total_vehicles
FROM vehicles
GROUP BY organization_id, calculated_scope, fuel_type, vehicle_class, ownership_type;

DROP VIEW IF EXISTS fleet_annual_emissions;
CREATE VIEW fleet_annual_emissions AS
SELECT
  organization_id,
  EXTRACT(YEAR FROM COALESCE(reporting_period_start, activity_date))::INTEGER as reporting_year,
  scope as calculated_scope,
  SUM(emissions_tco2e) as total_tco2e,
  SUM(distance_km) as total_distance_km,
  SUM(fuel_volume_litres) as total_fuel_litres,
  COUNT(*) as activity_count
FROM fleet_activities
WHERE emissions_tco2e IS NOT NULL
GROUP BY organization_id, EXTRACT(YEAR FROM COALESCE(reporting_period_start, activity_date)), scope;

-- ============================================
-- PART 7: Create RPC function for CCF aggregation
-- ============================================

CREATE OR REPLACE FUNCTION get_fleet_emissions_for_ccf(
  p_organization_id UUID,
  p_reporting_year INTEGER,
  p_scope TEXT DEFAULT NULL
)
RETURNS TABLE(
  scope TEXT,
  total_tco2e NUMERIC,
  entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    fa.scope,
    COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
    COUNT(*)::BIGINT as entry_count
  FROM fleet_activities fa
  WHERE fa.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
    AND (p_scope IS NULL OR fa.scope = p_scope)
  GROUP BY fa.scope;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_fleet_emissions_for_ccf TO authenticated;

COMMENT ON FUNCTION get_fleet_emissions_for_ccf IS 'Returns aggregated fleet emissions by scope for corporate carbon footprint reporting';
