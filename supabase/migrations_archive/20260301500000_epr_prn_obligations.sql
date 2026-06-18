-- =============================================================================
-- EPR: PRN (Packaging Recovery Note) obligations and tracking
-- =============================================================================
-- Large producers must purchase PRNs/PERNs to meet recycling targets.
-- This table tracks obligations per material per year and records purchases.
-- =============================================================================

-- PRN recycling targets reference table
CREATE TABLE IF NOT EXISTS public.epr_prn_targets (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  obligation_year integer NOT NULL,       -- 2025, 2026
  material_code text NOT NULL,            -- AL, GL, PC, PL, ST, WD (no FC — composites split by material)
  material_name text NOT NULL,
  recycling_target_pct numeric NOT NULL
    CHECK (recycling_target_pct > 0 AND recycling_target_pct <= 100),

  created_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_prn_target UNIQUE (obligation_year, material_code)
);

-- RLS: all authenticated users can read targets
ALTER TABLE public.epr_prn_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can view PRN targets"
  ON public.epr_prn_targets FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Platform admins can manage PRN targets"
  ON public.epr_prn_targets FOR ALL TO authenticated
  USING (public.is_platform_admin());

-- Seed PRN recycling targets
INSERT INTO public.epr_prn_targets (obligation_year, material_code, material_name, recycling_target_pct) VALUES
  -- 2025 targets
  (2025, 'PC', 'Paper',     75),
  (2025, 'GL', 'Glass',     74),
  (2025, 'AL', 'Aluminium', 61),
  (2025, 'ST', 'Steel',     80),
  (2025, 'PL', 'Plastic',   55),
  (2025, 'WD', 'Wood',      45),
  -- 2026 targets
  (2026, 'PC', 'Paper',     77),
  (2026, 'GL', 'Glass',     76),
  (2026, 'AL', 'Aluminium', 62),
  (2026, 'ST', 'Steel',     81),
  (2026, 'PL', 'Plastic',   57),
  (2026, 'WD', 'Wood',      46);

-- Per-organisation PRN obligation tracking
CREATE TABLE IF NOT EXISTS public.epr_prn_obligations (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  obligation_year integer NOT NULL,
  material_code text NOT NULL,
  material_name text NOT NULL,

  -- Obligation calculation
  total_tonnage_placed numeric DEFAULT 0 NOT NULL,   -- Total packaging tonnage for this material
  recycling_target_pct numeric NOT NULL,              -- Copied from targets for this year
  obligation_tonnage numeric DEFAULT 0 NOT NULL,      -- total_tonnage × target_pct / 100

  -- PRN purchases
  prns_purchased_tonnage numeric DEFAULT 0 NOT NULL,
  prn_cost_per_tonne_gbp numeric DEFAULT 0,
  total_prn_cost_gbp numeric DEFAULT 0 NOT NULL,

  -- Status
  status text DEFAULT 'not_started' NOT NULL
    CHECK (status IN ('not_started', 'partial', 'fulfilled', 'exceeded')),

  -- Timestamps
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT unique_prn_obligation UNIQUE (organization_id, obligation_year, material_code)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_epr_prn_obligations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epr_prn_obligations_updated_at
  BEFORE UPDATE ON public.epr_prn_obligations
  FOR EACH ROW
  EXECUTE FUNCTION update_epr_prn_obligations_updated_at();

-- RLS
ALTER TABLE public.epr_prn_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view PRN obligations"
  ON public.epr_prn_obligations FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_prn_obligations.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can manage PRN obligations"
  ON public.epr_prn_obligations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_prn_obligations.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can update PRN obligations"
  ON public.epr_prn_obligations FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_prn_obligations.organization_id
      AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_prn_obligations.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_epr_prn_obligations_org ON public.epr_prn_obligations(organization_id);
CREATE INDEX IF NOT EXISTS idx_epr_prn_obligations_year ON public.epr_prn_obligations(obligation_year);

-- Comments
COMMENT ON TABLE public.epr_prn_targets IS
  'PRN recycling targets published annually by government. Used to calculate per-material obligation tonnage.';
COMMENT ON TABLE public.epr_prn_obligations IS
  'Per-organisation PRN obligation tracking. Large producers must purchase PRNs/PERNs for each material to meet recycling targets.';
COMMENT ON COLUMN public.epr_prn_obligations.obligation_tonnage IS
  'Calculated as total_tonnage_placed × recycling_target_pct / 100. This is the tonnage of PRNs/PERNs that must be acquired.';
