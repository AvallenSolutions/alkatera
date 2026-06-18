-- Evidence library
--
-- The "upload once, cite everywhere" store. A PDF uploaded here can be
-- referenced from N different framework requirements via the existing
-- certification_evidence_links table (source_module='evidence_library').
--
-- Also stores Claude's per-document suggestions so we don't re-hit the API
-- every time the detail page renders.

CREATE TABLE IF NOT EXISTS public.evidence_documents (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  tags text[] NOT NULL DEFAULT '{}'::text[],
  document_name text NOT NULL,
  storage_object_path text NOT NULL,
  mime_type text,
  file_size_bytes integer,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_documents_org
  ON public.evidence_documents(organization_id, created_at DESC);
ALTER TABLE public.evidence_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view evidence documents"
  ON public.evidence_documents FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));
CREATE POLICY "Org members can manage evidence documents"
  ON public.evidence_documents FOR ALL TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE TABLE IF NOT EXISTS public.evidence_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  evidence_document_id uuid NOT NULL REFERENCES public.evidence_documents(id) ON DELETE CASCADE,
  requirement_id uuid NOT NULL REFERENCES public.framework_requirements(id) ON DELETE CASCADE,
  confidence numeric(4,3) NOT NULL,
  reasoning text,
  status text NOT NULL CHECK (status IN ('pending','accepted','rejected')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_document_id, requirement_id)
);
CREATE INDEX IF NOT EXISTS idx_evidence_suggestions_doc
  ON public.evidence_suggestions(evidence_document_id, status);
ALTER TABLE public.evidence_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view evidence suggestions"
  ON public.evidence_suggestions FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));
CREATE POLICY "Org members can manage evidence suggestions"
  ON public.evidence_suggestions FOR ALL TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-library',
  'evidence-library',
  false,
  20971520,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can upload evidence-library' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can upload evidence-library"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'evidence-library');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read evidence-library' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can read evidence-library"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'evidence-library');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can delete evidence-library' AND tablename = 'objects' AND schemaname = 'storage') THEN
    CREATE POLICY "Authenticated users can delete evidence-library"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'evidence-library');
  END IF;
END $$;
