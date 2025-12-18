/*
  # Add geographic coordinates to organizations table

  1. Changes
    - Add address_lat and address_lng columns to organizations table
    - These enable distance calculations from organization HQ to facilities
    - Used for automatic transport distance calculations in LCA

  2. Purpose
    - Enable system to calculate distances for shipping/logistics
    - Support automatic ingredient transport distance calculations
    - Provide fallback location when calculating from organization origin
*/

-- Add latitude and longitude columns to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS address_lat NUMERIC,
ADD COLUMN IF NOT EXISTS address_lng NUMERIC;

-- Add comment to explain the purpose
COMMENT ON COLUMN organizations.address_lat IS 'Organization headquarters latitude for distance calculations';
COMMENT ON COLUMN organizations.address_lng IS 'Organization headquarters longitude for distance calculations';
