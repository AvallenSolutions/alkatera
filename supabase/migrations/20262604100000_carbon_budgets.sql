-- Pulse F5 — Internal carbon budgets.
--
-- Lets orgs set monthly / quarterly / annual carbon budgets (in tonnes CO2e)
-- per scope and optionally per facility. The variance check cron runs monthly
-- and emails nominated owners when actuals exceed budget by > 10%.
--
-- The table is intentionally simple. Reporting logic lives in
-- /api/pulse/carbon-budgets and /api/cron/check-budget-variance.

CREATE TABLE IF NOT EXISTS public.carbon_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Scope of the budget. 'all' = org-wide total; other values = subset scope.
  scope text NOT NULL CHECK (scope IN ('all', 'scope_1', 'scope_2', 'scope_3')),
  -- Optional facility pin. NULL = org-wide.
  facility_id uuid REFERENCES public.facilities(id) ON DELETE CASCADE,
  -- Cadence of the budget. Actuals are compared against budget_tco2e for every
  -- matching period.
  period text NOT NULL CHECK (period IN ('monthly', 'quarterly', 'annual')),
  -- The budget itself in tonnes CO2e.
  budget_tco2e numeric NOT NULL CHECK (budget_tco2e >= 0),
  -- First calendar period this budget applies from (inclusive). Usually the
  -- first day of a month / quarter / year.
  effective_from date NOT NULL,
  -- User nominated to receive variance alerts (usually CFO or sustainability lead).
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS carbon_budgets_org_idx
  ON public.carbon_budgets (organization_id, effective_from DESC);

CREATE INDEX IF NOT EXISTS carbon_budgets_org_scope_idx
  ON public.carbon_budgets (organization_id, scope, period);

-- Keep updated_at in sync.
CREATE OR REPLACE FUNCTION public.carbon_budgets_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS carbon_budgets_touch_trigger ON public.carbon_budgets;
CREATE TRIGGER carbon_budgets_touch_trigger
BEFORE UPDATE ON public.carbon_budgets
FOR EACH ROW
EXECUTE FUNCTION public.carbon_budgets_touch_updated_at();

-- Row-level security. Members of the org can read; admins can write.
ALTER TABLE public.carbon_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS carbon_budgets_member_read ON public.carbon_budgets;
CREATE POLICY carbon_budgets_member_read ON public.carbon_budgets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = carbon_budgets.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS carbon_budgets_admin_write ON public.carbon_budgets;
CREATE POLICY carbon_budgets_admin_write ON public.carbon_budgets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.organization_id = carbon_budgets.organization_id
        AND om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      JOIN public.roles r ON r.id = om.role_id
      WHERE om.organization_id = carbon_budgets.organization_id
        AND om.user_id = auth.uid()
        AND r.name IN ('owner', 'admin')
    )
  );
