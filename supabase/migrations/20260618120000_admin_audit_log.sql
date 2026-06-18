-- Admin audit trail: accountability log for alkatera platform-admin actions.
--
-- Distinct from public.platform_activity_log (which is intentionally anonymised, no actor).
-- This table captures WHO (the staff member) did WHAT to WHICH org, for governance.
-- Append-only: writes happen only via the SECURITY DEFINER log_admin_action() RPC, which
-- derives the actor from auth.uid(); there is no UPDATE/DELETE path for any normal role.

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email  text,
  action       text NOT NULL,
  target_type  text,
  target_id    uuid,
  target_label text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_actor      ON public.admin_audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target     ON public.admin_audit_log (target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action     ON public.admin_audit_log (action);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only alkatera admins may read. No write policy: inserts go through the definer RPC only.
DROP POLICY IF EXISTS "Alkatera admins can read audit log" ON public.admin_audit_log;
CREATE POLICY "Alkatera admins can read audit log"
  ON public.admin_audit_log
  FOR SELECT
  TO authenticated
  USING (public.is_alkatera_admin());

-- ---------------------------------------------------------------------------
-- log_admin_action: record an admin action. Actor is derived server-side from
-- auth.uid() so it cannot be forged by the caller. Admin-gated.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action       text,
  p_target_type  text DEFAULT NULL,
  p_target_id    uuid DEFAULT NULL,
  p_target_label text DEFAULT NULL,
  p_metadata     jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_email text;
  v_id    uuid;
BEGIN
  IF NOT public.is_alkatera_admin() THEN
    RAISE EXCEPTION 'forbidden: not an alkatera admin';
  END IF;

  SELECT email INTO v_email FROM public.profiles WHERE id = v_uid;

  INSERT INTO public.admin_audit_log
    (actor_id, actor_email, action, target_type, target_id, target_label, metadata)
  VALUES
    (v_uid, v_email, p_action, p_target_type, p_target_id, p_target_label, coalesce(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, uuid, text, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- get_admin_audit_log: admin-gated, filtered, paginated read. Returns
-- { total: bigint, entries: [...] } ordered newest-first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_audit_log(
  p_limit   int  DEFAULT 50,
  p_offset  int  DEFAULT 0,
  p_action  text DEFAULT NULL,
  p_actor   uuid DEFAULT NULL,
  p_target  uuid DEFAULT NULL
) RETURNS jsonb
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_entries jsonb;
  v_total   bigint;
BEGIN
  IF NOT public.is_alkatera_admin() THEN
    RAISE EXCEPTION 'forbidden: not an alkatera admin';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.admin_audit_log a
  WHERE (p_action IS NULL OR a.action = p_action)
    AND (p_actor  IS NULL OR a.actor_id = p_actor)
    AND (p_target IS NULL OR a.target_id = p_target);

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_entries
  FROM (
    SELECT a.id, a.actor_id, a.actor_email, a.action,
           a.target_type, a.target_id, a.target_label, a.metadata, a.created_at
    FROM public.admin_audit_log a
    WHERE (p_action IS NULL OR a.action = p_action)
      AND (p_actor  IS NULL OR a.actor_id = p_actor)
      AND (p_target IS NULL OR a.target_id = p_target)
    ORDER BY a.created_at DESC
    LIMIT  greatest(1, least(coalesce(p_limit, 50), 200))
    OFFSET greatest(0, coalesce(p_offset, 0))
  ) t;

  RETURN jsonb_build_object('total', v_total, 'entries', v_entries);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_audit_log(int, int, text, uuid, uuid) TO authenticated;
