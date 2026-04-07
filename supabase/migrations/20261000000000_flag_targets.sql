-- Migration: FLAG Targets
-- Stores SBTi FLAG science-based targets for organisations whose
-- FLAG emissions exceed the 20% threshold (SBTi FLAG Guidance v1.2).

CREATE TABLE IF NOT EXISTS public.flag_targets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),

  -- Target definition
  target_type text NOT NULL CHECK (target_type IN ('absolute', 'intensity')),
  scope text NOT NULL DEFAULT 'flag' CHECK (scope IN ('flag', 'non_flag', 'combined')),

  -- Time horizon
  base_year integer NOT NULL CHECK (base_year >= 2015 AND base_year <= 2030),
  base_year_emissions_co2e numeric,
  target_year integer NOT NULL CHECK (target_year >= 2025 AND target_year <= 2050),

  -- Reduction target
  reduction_percentage numeric NOT NULL CHECK (reduction_percentage > 0 AND reduction_percentage <= 100),

  -- SBTi compliance
  meets_sbti_minimum boolean NOT NULL DEFAULT false,
  sbti_pathway text CHECK (sbti_pathway IN ('flag_1_5c', 'flag_well_below_2c')),
  commodity_coverage text[], -- e.g. {'grapes', 'fruit', 'cork'}

  -- Notes and methodology
  methodology_notes text,

  -- Lifecycle
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'validated', 'expired')),
  submitted_at timestamptz,
  validated_at timestamptz,

  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.flag_targets IS
  'SBTi FLAG science-based targets. Required when FLAG emissions >= 20% of total Scope 1+2+3 (SBTi FLAG Guidance v1.2).';
COMMENT ON COLUMN public.flag_targets.meets_sbti_minimum IS
  'Whether the target meets SBTi FLAG v1.2 minimum stringency: near-term (by 2030) >= 30% absolute; long-term (by 2050) >= 72% absolute.';

-- RLS
ALTER TABLE public.flag_targets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'flag_targets' AND policyname = 'Users can view own org flag targets'
  ) THEN
    CREATE POLICY "Users can view own org flag targets" ON public.flag_targets
      FOR SELECT USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'flag_targets' AND policyname = 'Users can manage own org flag targets'
  ) THEN
    CREATE POLICY "Users can manage own org flag targets" ON public.flag_targets
      FOR ALL USING (organization_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
