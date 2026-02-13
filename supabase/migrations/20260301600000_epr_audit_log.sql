-- =============================================================================
-- EPR: Immutable audit log
-- =============================================================================
-- Append-only audit trail for all EPR data changes.
-- No UPDATE or DELETE policies — enforces immutability for 7-year retention.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.epr_audit_log (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),

  -- What changed
  entity_type text NOT NULL,              -- 'product_material', 'submission', 'submission_line', 'settings', 'prn_obligation'
  entity_id text NOT NULL,                -- UUID or ID of the changed entity
  action text NOT NULL
    CHECK (action IN ('create', 'update', 'delete', 'generate_csv', 'submit', 'approve', 'amend', 'estimate_nations')),

  -- Change data
  field_changes jsonb,                    -- { "field_name": { "old": "...", "new": "..." } }
  snapshot jsonb,                         -- Full entity state at time of change

  -- Who / when / context
  performed_by uuid REFERENCES auth.users(id),
  performed_at timestamptz DEFAULT now() NOT NULL,
  ip_address text,
  user_agent text,
  notes text
);

-- RLS: append-only (SELECT + INSERT, no UPDATE or DELETE)
ALTER TABLE public.epr_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view audit log"
  ON public.epr_audit_log FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_audit_log.organization_id
      AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Org members can insert audit entries"
  ON public.epr_audit_log FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = epr_audit_log.organization_id
      AND organization_members.user_id = auth.uid()
  ));

-- NO UPDATE or DELETE policies — audit log is immutable

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_epr_audit_org ON public.epr_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_epr_audit_entity ON public.epr_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_epr_audit_time ON public.epr_audit_log(performed_at);
CREATE INDEX IF NOT EXISTS idx_epr_audit_action ON public.epr_audit_log(action);

-- Comments
COMMENT ON TABLE public.epr_audit_log IS
  'Immutable, append-only audit trail for all EPR compliance data changes. Required for 7-year data retention under EPR regulations.';
COMMENT ON COLUMN public.epr_audit_log.field_changes IS
  'Granular diff of changed fields: { "field_name": { "old": <previous_value>, "new": <new_value> } }';
COMMENT ON COLUMN public.epr_audit_log.snapshot IS
  'Complete entity state at the time of the change. Used for point-in-time reconstruction during audits.';
