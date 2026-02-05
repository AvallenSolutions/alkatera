-- Migration: OpenLCA Impact Cache
-- Description: Cache OpenLCA calculation results for performance
-- This table stores calculated impact values from OpenLCA to avoid
-- repeated calculations for the same process.

-- Create the cache table
CREATE TABLE IF NOT EXISTS openlca_impact_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id text NOT NULL,
  process_name text,
  geography text DEFAULT 'GLO',
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'kg',

  -- Core 4 impacts (per unit)
  impact_climate numeric DEFAULT 0,
  impact_climate_fossil numeric DEFAULT 0,
  impact_climate_biogenic numeric DEFAULT 0,
  impact_climate_dluc numeric DEFAULT 0,
  impact_water numeric DEFAULT 0,
  impact_water_scarcity numeric DEFAULT 0,
  impact_land numeric DEFAULT 0,
  impact_waste numeric DEFAULT 0,

  -- GHG breakdown (kg per unit)
  ch4_kg numeric DEFAULT 0,
  n2o_kg numeric DEFAULT 0,

  -- Extended ReCiPe 2016 impacts
  impact_ozone_depletion numeric DEFAULT 0,
  impact_terrestrial_ecotoxicity numeric DEFAULT 0,
  impact_freshwater_ecotoxicity numeric DEFAULT 0,
  impact_marine_ecotoxicity numeric DEFAULT 0,
  impact_freshwater_eutrophication numeric DEFAULT 0,
  impact_marine_eutrophication numeric DEFAULT 0,
  impact_terrestrial_acidification numeric DEFAULT 0,
  impact_mineral_resource_scarcity numeric DEFAULT 0,
  impact_fossil_resource_scarcity numeric DEFAULT 0,

  -- Metadata
  impact_method text DEFAULT 'ReCiPe 2016 Midpoint (H)',
  ecoinvent_version text DEFAULT '3.12',
  system_model text DEFAULT 'cutoff',
  calculated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),

  -- Unique constraint to prevent duplicate entries
  UNIQUE(organization_id, process_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_openlca_impact_cache_lookup
  ON openlca_impact_cache(organization_id, process_id);

-- Index for cache expiration cleanup
CREATE INDEX IF NOT EXISTS idx_openlca_impact_cache_expires
  ON openlca_impact_cache(expires_at);

-- Enable RLS
ALTER TABLE openlca_impact_cache ENABLE ROW LEVEL SECURITY;

-- RLS policy: Users can only access cache entries for their organizations
CREATE POLICY "Users can view own org cache" ON openlca_impact_cache
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own org cache" ON openlca_impact_cache
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own org cache" ON openlca_impact_cache
  FOR UPDATE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own org cache" ON openlca_impact_cache
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_openlca_impact_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM openlca_impact_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment for documentation
COMMENT ON TABLE openlca_impact_cache IS
  'Cache for OpenLCA calculation results. Stores impact values per kg for processes, avoiding repeated calculations. Entries expire after 7 days by default.';
