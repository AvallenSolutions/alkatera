-- Historical imports
--
-- Stores headline metrics extracted from a prospect's prior sustainability
-- reports and LCA studies so they don't have to start from scratch. The
-- source PDF is preserved in the 'historical-imports' storage bucket for
-- provenance. These records live SEPARATE from operational emissions / PCF
-- tables — a PDF summary never meets the methodology bar of a measured or
-- calculated entry. Promoting a record to an operational PCF is a future
-- follow-up action.

CREATE TABLE IF NOT EXISTS public.historical_imports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('sustainability_report','lca_report')),
  reporting_year integer,
  source_document_name text,
  storage_object_path text,
  extracted_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historical_imports_org_year
  ON public.historical_imports(organization_id, kind, reporting_year DESC);

ALTER TABLE public.historical_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view historical imports"
  ON public.historical_imports FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can create historical imports"
  ON public.historical_imports FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Org members can delete historical imports"
  ON public.historical_imports FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

-- Preserve the source PDF so auditors can trace an imported number back to
-- the document it came from.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'historical-imports',
  'historical-imports',
  false,
  20971520,
  ARRAY['application/pdf']
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload historical-imports'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload historical-imports"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'historical-imports');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can read historical-imports'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can read historical-imports"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'historical-imports');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete historical-imports'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete historical-imports"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'historical-imports');
  END IF;
END $$;
