-- vineyard_spray_chemicals
-- Stores detailed per-chemical spray application records linked to a growing profile.
-- Replaces the simplified fertiliser_type / uses_pesticides fields in vineyard_growing_profiles
-- for data entry purposes; the simplified fields are still auto-derived for the calculator.

CREATE TABLE public.vineyard_spray_chemicals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  growing_profile_id UUID NOT NULL REFERENCES public.vineyard_growing_profiles(id) ON DELETE CASCADE,
  vineyard_id UUID NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  chemical_name TEXT NOT NULL,
  chemical_type TEXT NOT NULL CHECK (chemical_type IN ('fertiliser', 'fungicide', 'herbicide', 'insecticide', 'other')),
  unit TEXT NOT NULL DEFAULT 'L',
  rate_per_ha NUMERIC NOT NULL DEFAULT 0,
  water_rate_l_per_ha NUMERIC,
  total_ha_sprayed NUMERIC NOT NULL DEFAULT 0,
  total_amount_used NUMERIC NOT NULL DEFAULT 0,
  applications_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vineyard_spray_chemicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage spray chemicals for their org"
  ON public.vineyard_spray_chemicals
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
    )
  );

CREATE INDEX idx_spray_chemicals_profile ON public.vineyard_spray_chemicals(growing_profile_id);
CREATE INDEX idx_spray_chemicals_vineyard ON public.vineyard_spray_chemicals(vineyard_id);
