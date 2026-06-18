-- Materiality Assessments
-- Stores double-materiality assessments per organisation per year.
-- Each assessment contains a set of MaterialityTopic objects (JSONB) and an
-- ordered priority list used to structure sustainability reports.

CREATE TABLE IF NOT EXISTS materiality_assessments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_year   INTEGER NOT NULL,
  -- Array of MaterialityTopic objects. Shape documented below.
  topics            JSONB NOT NULL DEFAULT '[]',
  -- Ordered list of topic IDs from highest combined materiality downward.
  -- Typically 5-8 items. Populated on Step 3 completion.
  priority_topics   TEXT[] NOT NULL DEFAULT '{}',
  completed_at      TIMESTAMP WITH TIME ZONE,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(organization_id, assessment_year)
);

-- MaterialityTopic shape (stored in topics JSONB array):
-- {
--   id:              string   — unique slug, e.g. "climate-mitigation"
--   name:            string   — display name
--   category:        'environmental' | 'social' | 'governance'
--   status:          'material' | 'monitoring' | 'not_material'
--   impactScore:     1-5      — how significantly the business impacts this topic
--   financialScore:  1-5      — how significantly this topic affects business finances
--   rationale:       string   — user-written explanation
--   esrsReference?:  string
--   griReference?:   string
--   sasbReference?:  string
-- }

-- RLS: organisations can only see and edit their own assessments
ALTER TABLE materiality_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_can_view_materiality"
  ON materiality_assessments FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_insert_materiality"
  ON materiality_assessments FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_update_materiality"
  ON materiality_assessments FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_members_can_delete_materiality"
  ON materiality_assessments FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION update_materiality_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_materiality_assessments_updated_at
  BEFORE UPDATE ON materiality_assessments
  FOR EACH ROW EXECUTE FUNCTION update_materiality_assessments_updated_at();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
