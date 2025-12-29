/*
  # Fix Fleet Activities Nullable Fields

  1. Changes
    - Make `vehicle_id` nullable to support manual entry without registered vehicles
    - Make `distance_km` nullable to support alternative data entry methods (volume, consumption)
  
  2. Reason
    - Users can log fleet activities manually without selecting a registered vehicle
    - Users can enter data via fuel volume or electricity consumption instead of distance
    - Current NOT NULL constraints cause insertion failures for valid use cases
*/

-- Make vehicle_id nullable (manual entries don't require a registered vehicle)
ALTER TABLE fleet_activities 
ALTER COLUMN vehicle_id DROP NOT NULL;

-- Make distance_km nullable (volume/consumption methods don't require distance)
ALTER TABLE fleet_activities 
ALTER COLUMN distance_km DROP NOT NULL;

-- Add a check constraint to ensure at least one activity value is provided
ALTER TABLE fleet_activities
DROP CONSTRAINT IF EXISTS fleet_activities_activity_value_check;

ALTER TABLE fleet_activities
ADD CONSTRAINT fleet_activities_activity_value_check
CHECK (
  distance_km IS NOT NULL OR 
  fuel_volume_litres IS NOT NULL OR 
  electricity_kwh IS NOT NULL OR 
  spend_amount IS NOT NULL
);

-- Add a check constraint to ensure vehicle identification is provided
ALTER TABLE fleet_activities
DROP CONSTRAINT IF EXISTS fleet_activities_vehicle_identification_check;

ALTER TABLE fleet_activities
ADD CONSTRAINT fleet_activities_vehicle_identification_check
CHECK (
  vehicle_id IS NOT NULL OR 
  (manual_vehicle_category IS NOT NULL AND 
   manual_fuel_type IS NOT NULL AND 
   manual_ownership_type IS NOT NULL)
);
