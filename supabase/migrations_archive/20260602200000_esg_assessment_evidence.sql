-- ESG Assessment Evidence
-- Allows suppliers to attach supporting documents to individual ESG questions.

-- ==========================================================================
-- 1. Table: supplier_esg_evidence
-- ==========================================================================
CREATE TABLE supplier_esg_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES supplier_esg_assessments(id) ON DELETE CASCADE,
  question_id text NOT NULL,

  document_name text NOT NULL,
  document_url text,
  storage_object_path text,
  file_size_bytes integer,
  mime_type text,

  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast lookup by assessment + question
CREATE INDEX idx_esg_evidence_assessment_question
  ON supplier_esg_evidence(assessment_id, question_id);

-- ==========================================================================
-- 2. RLS policies
-- ==========================================================================
ALTER TABLE supplier_esg_evidence ENABLE ROW LEVEL SECURITY;

-- Suppliers can view evidence on their own assessment
CREATE POLICY "Suppliers can view own ESG evidence"
  ON supplier_esg_evidence FOR SELECT
  USING (
    assessment_id IN (
      SELECT a.id FROM supplier_esg_assessments a
      JOIN suppliers s ON s.id = a.supplier_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Suppliers can insert evidence on their own assessment
CREATE POLICY "Suppliers can insert own ESG evidence"
  ON supplier_esg_evidence FOR INSERT
  WITH CHECK (
    assessment_id IN (
      SELECT a.id FROM supplier_esg_assessments a
      JOIN suppliers s ON s.id = a.supplier_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Suppliers can update their own evidence
CREATE POLICY "Suppliers can update own ESG evidence"
  ON supplier_esg_evidence FOR UPDATE
  USING (
    assessment_id IN (
      SELECT a.id FROM supplier_esg_assessments a
      JOIN suppliers s ON s.id = a.supplier_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Suppliers can delete their own evidence
CREATE POLICY "Suppliers can delete own ESG evidence"
  ON supplier_esg_evidence FOR DELETE
  USING (
    assessment_id IN (
      SELECT a.id FROM supplier_esg_assessments a
      JOIN suppliers s ON s.id = a.supplier_id
      WHERE s.user_id = auth.uid()
    )
  );

-- Org members can view evidence for suppliers in their org
CREATE POLICY "Org members can view supplier ESG evidence"
  ON supplier_esg_evidence FOR SELECT
  USING (
    assessment_id IN (
      SELECT a.id FROM supplier_esg_assessments a
      JOIN suppliers s ON s.id = a.supplier_id
      JOIN organization_members om ON om.organization_id = s.organization_id
      WHERE om.user_id = auth.uid()
    )
  );

-- Platform admins can view all evidence
CREATE POLICY "Admins can view all ESG evidence"
  ON supplier_esg_evidence FOR SELECT
  USING (is_alkatera_admin());

-- Platform admins can delete any evidence
CREATE POLICY "Admins can delete all ESG evidence"
  ON supplier_esg_evidence FOR DELETE
  USING (is_alkatera_admin());

-- ==========================================================================
-- 3. Storage bucket: esg-evidence
-- ==========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'esg-evidence',
  'esg-evidence',
  true,
  10485760, -- 10 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for esg-evidence bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload ESG evidence'
  ) THEN
    CREATE POLICY "Authenticated users can upload ESG evidence"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'esg-evidence');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can view ESG evidence'
  ) THEN
    CREATE POLICY "Anyone can view ESG evidence"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'esg-evidence');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own ESG evidence'
  ) THEN
    CREATE POLICY "Users can delete own ESG evidence"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'esg-evidence' AND (storage.foldername(name))[1] != '');
  END IF;
END$$;

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
