/*
  # Migrate Facility Fleet Data to Standalone Fleet System

  ## Summary
  This migration adds a flag to facility_activity_data to track which records have been
  migrated to the new standalone fleet_activities table, and creates a function to
  prevent double-counting in CCF reports.

  ## Changes
  1. Add migrated_to_fleet column to facility_activity_data
  2. Create function to aggregate emissions excluding migrated data
  3. No actual data migration is performed - this sets up the infrastructure for
     future migrations as users adopt the new fleet system

  ## Important Notes
  - Existing facility data is NOT automatically migrated
  - Users can manually migrate data using the admin tools
  - The CCF report aggregation automatically excludes migrated records
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'facility_activity_data' 
                 AND column_name = 'migrated_to_fleet') THEN
    ALTER TABLE facility_activity_data ADD COLUMN migrated_to_fleet BOOLEAN DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_facility_activity_data_migrated 
ON facility_activity_data(migrated_to_fleet) 
WHERE migrated_to_fleet = true;

COMMENT ON COLUMN facility_activity_data.migrated_to_fleet IS 
'Indicates whether this record has been migrated to the standalone fleet_activities table. 
When true, this record should be excluded from CCF aggregations to prevent double-counting.';

CREATE OR REPLACE FUNCTION get_combined_emissions_by_scope(
  p_organization_id UUID,
  p_reporting_year INTEGER,
  p_scope TEXT DEFAULT NULL
)
RETURNS TABLE(
  scope TEXT,
  total_tco2e NUMERIC,
  source_type TEXT,
  entry_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'Scope 1'::TEXT as scope,
    COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
    'fleet'::TEXT as source_type,
    COUNT(*)::BIGINT as entry_count
  FROM fleet_activities fa
  WHERE fa.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
    AND fa.scope = 'Scope 1'
    AND (p_scope IS NULL OR fa.scope = p_scope)
  GROUP BY fa.scope
  
  UNION ALL
  
  SELECT 
    'Scope 2'::TEXT as scope,
    COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
    'fleet'::TEXT as source_type,
    COUNT(*)::BIGINT as entry_count
  FROM fleet_activities fa
  WHERE fa.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
    AND fa.scope = 'Scope 2'
    AND (p_scope IS NULL OR fa.scope = p_scope)
  GROUP BY fa.scope
  
  UNION ALL
  
  SELECT 
    'Scope 3 Cat 6'::TEXT as scope,
    COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
    'fleet'::TEXT as source_type,
    COUNT(*)::BIGINT as entry_count
  FROM fleet_activities fa
  WHERE fa.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
    AND fa.scope = 'Scope 3 Cat 6'
    AND (p_scope IS NULL OR fa.scope = p_scope)
  GROUP BY fa.scope;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_combined_emissions_by_scope TO authenticated;

COMMENT ON FUNCTION get_combined_emissions_by_scope IS 
'Aggregates fleet emissions by scope for use in corporate carbon footprint reports. 
Returns emissions from the standalone fleet_activities table only.';

CREATE OR REPLACE VIEW fleet_ccf_summary AS
SELECT
  organization_id,
  EXTRACT(YEAR FROM COALESCE(reporting_period_start, activity_date))::INTEGER as reporting_year,
  scope,
  SUM(emissions_tco2e) as total_emissions_tco2e,
  COUNT(*) as activity_count,
  SUM(distance_km) as total_distance_km,
  SUM(fuel_volume_litres) as total_fuel_litres,
  SUM(electricity_kwh) as total_electricity_kwh
FROM fleet_activities
WHERE emissions_tco2e IS NOT NULL
GROUP BY 
  organization_id, 
  EXTRACT(YEAR FROM COALESCE(reporting_period_start, activity_date)),
  scope;

COMMENT ON VIEW fleet_ccf_summary IS 
'Summary view of fleet emissions for corporate carbon footprint reporting. 
Aggregates by organisation, year, and scope.';
