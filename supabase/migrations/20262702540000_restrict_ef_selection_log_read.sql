-- Restrict ef_selection_log reads to the owning user (LOW-1, security review 2026-05-29)
--
-- The SELECT policy was `USING (true)`, letting any authenticated user read
-- every user's emission-factor selection log (search queries + org ids) across
-- all tenants. The "global popularity" feature does NOT need this: it is served
-- by the SECURITY DEFINER RPC get_ef_search_boosts(), which aggregates with RLS
-- bypassed. Per-user favourites only ever read the caller's own rows. So scope
-- direct SELECT to own rows.

DROP POLICY IF EXISTS "Authenticated users can read all selections" ON ef_selection_log;

CREATE POLICY "Users can read own selections"
  ON ef_selection_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());
