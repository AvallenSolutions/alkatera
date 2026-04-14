-- Create the openlca_impact_cache table
-- This table caches OpenLCA calculation results to avoid repeated 20-40s
-- API calls to the gdt-server. Results are cached per organization/process/database
-- with a 30-day TTL.

CREATE TABLE IF NOT EXISTS public.openlca_impact_cache (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  process_id text NOT NULL,
  source_database text NOT NULL DEFAULT 'ecoinvent',
  process_name text,
  geography text DEFAULT 'GLO',
  quantity numeric DEFAULT 1,
  unit text DEFAULT 'kg',

  -- Midpoint impact values (per 1 kg)
  impact_climate numeric DEFAULT 0,
  impact_climate_fossil numeric DEFAULT 0,
  impact_climate_biogenic numeric DEFAULT 0,
  impact_climate_dluc numeric DEFAULT 0,
  impact_water numeric DEFAULT 0,
  impact_land numeric DEFAULT 0,
  impact_waste numeric DEFAULT 0,
  impact_ozone_depletion numeric DEFAULT 0,
  impact_terrestrial_ecotoxicity numeric DEFAULT 0,
  impact_freshwater_ecotoxicity numeric DEFAULT 0,
  impact_marine_ecotoxicity numeric DEFAULT 0,
  impact_freshwater_eutrophication numeric DEFAULT 0,
  impact_marine_eutrophication numeric DEFAULT 0,
  impact_terrestrial_acidification numeric DEFAULT 0,
  impact_mineral_resource_scarcity numeric DEFAULT 0,
  impact_fossil_resource_scarcity numeric DEFAULT 0,
  impact_particulate_matter numeric DEFAULT 0,
  impact_ionising_radiation numeric DEFAULT 0,
  impact_photochemical_ozone_formation numeric DEFAULT 0,

  -- Endpoint impact values (per 1 kg)
  impact_ecosystem_damage numeric DEFAULT 0,
  impact_land_biodiversity numeric DEFAULT 0,
  impact_terrestrial_ecotoxicity_endpoint numeric DEFAULT 0,
  impact_freshwater_ecotoxicity_endpoint numeric DEFAULT 0,
  impact_marine_ecotoxicity_endpoint numeric DEFAULT 0,

  -- Metadata
  impact_method text,
  ecoinvent_version text,
  system_model text,
  calculated_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint for upsert
  CONSTRAINT openlca_impact_cache_unique UNIQUE (organization_id, process_id, source_database)
);

-- Index for cache lookups
CREATE INDEX IF NOT EXISTS idx_openlca_impact_cache_lookup
  ON public.openlca_impact_cache (organization_id, process_id, source_database);

-- Index for cache expiry cleanup
CREATE INDEX IF NOT EXISTS idx_openlca_impact_cache_expires
  ON public.openlca_impact_cache (expires_at);

-- RLS policies
ALTER TABLE public.openlca_impact_cache ENABLE ROW LEVEL SECURITY;

-- Users can read cache entries for their organizations
CREATE POLICY "Users can read their organization's cache"
  ON public.openlca_impact_cache
  FOR SELECT
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Users can insert/update cache entries for their organizations
CREATE POLICY "Users can write their organization's cache"
  ON public.openlca_impact_cache
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their organization's cache"
  ON public.openlca_impact_cache
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT om.organization_id
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_openlca_impact_cache_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_openlca_impact_cache_updated_at
  BEFORE UPDATE ON public.openlca_impact_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_openlca_impact_cache_updated_at();
