-- Operational Change Events
--
-- Allows users to log significant operational changes that affect emissions
-- (e.g. "Switched to REGO-backed electricity", "Installed solar panels").
-- These events are cross-referenced with emission data to generate
-- AI-driven key findings explaining WHY emissions changed year-on-year.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Create table
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.operational_change_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  description text NOT NULL,
  event_date date NOT NULL,

  -- Which scope this change affects
  scope text NOT NULL CHECK (scope IN ('scope1', 'scope2', 'scope3')),

  -- Optional sub-category for cross-referencing with emission data
  -- Suggested values: electricity, natural_gas, diesel, lpg, kerosene,
  -- fleet, refrigerants, business_travel, employee_commuting,
  -- purchased_goods, packaging, waste, water, capital_goods, logistics
  category text,

  -- Whether the change increased, decreased, or was neutral to emissions
  impact_direction text NOT NULL CHECK (impact_direction IN ('increase', 'decrease', 'neutral')),

  -- Optional estimated annual impact
  estimated_impact_kgco2e double precision,

  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_operational_changes_org
  ON public.operational_change_events(organization_id);
CREATE INDEX idx_operational_changes_date
  ON public.operational_change_events(event_date);

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Row Level Security
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.operational_change_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view operational changes"
  ON public.operational_change_events FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can create operational changes"
  ON public.operational_change_events FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can update operational changes"
  ON public.operational_change_events FOR UPDATE TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can delete operational changes"
  ON public.operational_change_events FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role bypass for operational changes"
  ON public.operational_change_events FOR SELECT TO service_role
  USING (true);
