-- Track emission factor selections for per-user favourites and global popularity ranking.
-- A single table serves both features:
--   Per-user favourites: filter by user_id
--   Global popularity:   aggregate across all users

CREATE TABLE IF NOT EXISTS ef_selection_log (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id   uuid REFERENCES organizations(id) ON DELETE SET NULL,
  search_query      text NOT NULL,          -- normalised: lowercase, trimmed
  material_type     text,                   -- 'ingredient' | 'packaging'
  packaging_category text,                  -- 'container' | 'closure' | 'label' | etc. NULL for ingredients
  selected_ef_id    text NOT NULL,          -- the result id (uuid or openlca process id)
  selected_ef_name  text NOT NULL,          -- the result display name
  ef_source_type    text NOT NULL,          -- 'primary' | 'staging' | 'global_library' | 'ecoinvent_proxy' | etc.
  selection_count   integer NOT NULL DEFAULT 1,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for upsert: one row per user + query + context + EF pairing
CREATE UNIQUE INDEX idx_efsl_upsert
  ON ef_selection_log (user_id, search_query, material_type, COALESCE(packaging_category, ''), selected_ef_id);

-- Per-user favourites lookup
CREATE INDEX idx_efsl_user_query
  ON ef_selection_log (user_id, search_query, material_type);

-- Global popularity aggregation
CREATE INDEX idx_efsl_global_query
  ON ef_selection_log (search_query, material_type, packaging_category);

-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_ef_selection_log_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_efsl_updated_at
  BEFORE UPDATE ON ef_selection_log
  FOR EACH ROW
  EXECUTE FUNCTION update_ef_selection_log_updated_at();

-- RLS
ALTER TABLE ef_selection_log ENABLE ROW LEVEL SECURITY;

-- Users can insert their own selections
CREATE POLICY "Users can insert own selections"
  ON ef_selection_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own rows (for upsert increment)
CREATE POLICY "Users can update own selections"
  ON ef_selection_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- All authenticated users can read (needed for global popularity)
CREATE POLICY "Authenticated users can read all selections"
  ON ef_selection_log FOR SELECT TO authenticated
  USING (true);

-- Service role has full access
CREATE POLICY "Service role full access"
  ON ef_selection_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- RPC: log_ef_selection (fire-and-forget, SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION log_ef_selection(
  p_search_query text,
  p_material_type text DEFAULT NULL,
  p_packaging_category text DEFAULT NULL,
  p_selected_ef_id text DEFAULT NULL,
  p_selected_ef_name text DEFAULT NULL,
  p_ef_source_type text DEFAULT 'unknown',
  p_organization_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_query text := LOWER(TRIM(p_search_query));
BEGIN
  IF v_user_id IS NULL OR v_query = '' OR p_selected_ef_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO ef_selection_log (
    user_id, organization_id, search_query, material_type,
    packaging_category, selected_ef_id, selected_ef_name,
    ef_source_type, selection_count
  ) VALUES (
    v_user_id, p_organization_id, v_query, p_material_type,
    p_packaging_category, p_selected_ef_id, p_selected_ef_name,
    p_ef_source_type, 1
  )
  ON CONFLICT (user_id, search_query, material_type, COALESCE(packaging_category, ''), selected_ef_id)
  DO UPDATE SET
    selection_count = ef_selection_log.selection_count + 1,
    updated_at = now(),
    -- Update name/source in case they changed
    selected_ef_name = EXCLUDED.selected_ef_name,
    ef_source_type = EXCLUDED.ef_source_type;
END;
$$;

-- ============================================================
-- RPC: get_ef_search_boosts (read-only, returns boost data)
-- ============================================================
CREATE OR REPLACE FUNCTION get_ef_search_boosts(
  p_user_id uuid,
  p_search_query text,
  p_material_type text DEFAULT NULL,
  p_packaging_category text DEFAULT NULL
)
RETURNS TABLE (
  selected_ef_id text,
  is_user_favourite boolean,
  user_selection_count integer,
  global_selection_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_query text := LOWER(TRIM(p_search_query));
BEGIN
  RETURN QUERY
  SELECT
    esl.selected_ef_id,
    bool_or(esl.user_id = p_user_id) AS is_user_favourite,
    COALESCE(MAX(esl.selection_count) FILTER (WHERE esl.user_id = p_user_id), 0)::integer AS user_selection_count,
    SUM(esl.selection_count)::bigint AS global_selection_count
  FROM ef_selection_log esl
  WHERE esl.search_query = v_query
    AND esl.material_type IS NOT DISTINCT FROM p_material_type
    AND (p_packaging_category IS NULL OR esl.packaging_category IS NOT DISTINCT FROM p_packaging_category)
  GROUP BY esl.selected_ef_id
  ORDER BY bool_or(esl.user_id = p_user_id) DESC, SUM(esl.selection_count) DESC
  LIMIT 20;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION log_ef_selection TO authenticated;
GRANT EXECUTE ON FUNCTION get_ef_search_boosts TO authenticated;
GRANT EXECUTE ON FUNCTION log_ef_selection TO service_role;
GRANT EXECUTE ON FUNCTION get_ef_search_boosts TO service_role;
