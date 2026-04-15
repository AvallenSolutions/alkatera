-- Migration: Orchard spray chemicals table
-- Mirrors arable_spray_chemicals pattern

CREATE TABLE IF NOT EXISTS public.orchard_spray_chemicals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  growing_profile_id UUID NOT NULL REFERENCES public.orchard_growing_profiles(id) ON DELETE CASCADE,
  orchard_id         UUID NOT NULL REFERENCES public.orchards(id) ON DELETE CASCADE,
  organization_id    UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  chemical_name       TEXT NOT NULL,
  chemical_type       TEXT NOT NULL DEFAULT 'other'
    CHECK (chemical_type IN ('fertiliser','fungicide','herbicide','insecticide','growth_regulator','seed_treatment','other')),
  unit                TEXT NOT NULL DEFAULT 'L',
  rate_per_ha         NUMERIC NOT NULL DEFAULT 0,
  water_rate_l_per_ha NUMERIC,
  total_ha_sprayed    NUMERIC NOT NULL DEFAULT 0,
  total_amount_used   NUMERIC NOT NULL DEFAULT 0,
  applications_count  INTEGER NOT NULL DEFAULT 1,

  n_content_percent   NUMERIC NOT NULL DEFAULT 0,
  fertiliser_subtype  TEXT CHECK (fertiliser_subtype IN ('synthetic_n','organic_manure','organic_compost','mixed') OR fertiliser_subtype IS NULL),
  library_matched     BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_orchard_spray_chemicals_profile ON public.orchard_spray_chemicals(growing_profile_id);
CREATE INDEX idx_orchard_spray_chemicals_orchard ON public.orchard_spray_chemicals(orchard_id);
CREATE INDEX idx_orchard_spray_chemicals_org     ON public.orchard_spray_chemicals(organization_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_orchard_spray_chemicals
  BEFORE UPDATE ON public.orchard_spray_chemicals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.orchard_spray_chemicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their org orchard spray chemicals"
  ON public.orchard_spray_chemicals FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert orchard spray chemicals for their org"
  ON public.orchard_spray_chemicals FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their org orchard spray chemicals"
  ON public.orchard_spray_chemicals FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their org orchard spray chemicals"
  ON public.orchard_spray_chemicals FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );
