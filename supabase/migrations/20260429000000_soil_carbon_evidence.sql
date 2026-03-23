-- Soil Carbon Evidence
--
-- Adds support for measured soil carbon data with evidence upload.
-- Extends vineyard_growing_profiles with lab metadata columns and
-- creates an evidence table for storing uploaded lab reports.

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Extend vineyard_growing_profiles with additional soil carbon metadata
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vineyard_growing_profiles
  ADD COLUMN IF NOT EXISTS soil_carbon_lab_name text,
  ADD COLUMN IF NOT EXISTS soil_carbon_sampling_points integer;

-- Also add biochar_compost and regenerative_integrated to soil_management
-- constraint (original migration only had the first 5 values)
ALTER TABLE public.vineyard_growing_profiles
  DROP CONSTRAINT IF EXISTS vineyard_growing_profiles_soil_management_check;

ALTER TABLE public.vineyard_growing_profiles
  ADD CONSTRAINT vineyard_growing_profiles_soil_management_check
  CHECK (soil_management IN (
    'conventional_tillage', 'minimum_tillage', 'no_till',
    'cover_cropping', 'composting', 'biochar_compost', 'regenerative_integrated'
  ));

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Evidence table for soil carbon lab reports
-- ══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.vineyard_soil_carbon_evidence (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  growing_profile_id uuid NOT NULL REFERENCES public.vineyard_growing_profiles(id) ON DELETE CASCADE,
  vineyard_id uuid NOT NULL REFERENCES public.vineyards(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  document_name text NOT NULL,
  storage_object_path text NOT NULL,
  file_size_bytes integer,
  mime_type text DEFAULT 'application/pdf',

  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_soil_carbon_evidence_profile
  ON public.vineyard_soil_carbon_evidence(growing_profile_id);
CREATE INDEX idx_soil_carbon_evidence_org
  ON public.vineyard_soil_carbon_evidence(organization_id);

-- RLS (mirrors vineyard_growing_profiles pattern)
ALTER TABLE public.vineyard_soil_carbon_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Organization members can view soil carbon evidence"
  ON public.vineyard_soil_carbon_evidence FOR SELECT TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can create soil carbon evidence"
  ON public.vineyard_soil_carbon_evidence FOR INSERT TO authenticated
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can update soil carbon evidence"
  ON public.vineyard_soil_carbon_evidence FOR UPDATE TO authenticated
  USING (public.user_has_organization_access(organization_id))
  WITH CHECK (public.user_has_organization_access(organization_id));

CREATE POLICY "Organization members can delete soil carbon evidence"
  ON public.vineyard_soil_carbon_evidence FOR DELETE TO authenticated
  USING (public.user_has_organization_access(organization_id));

CREATE POLICY "Service role bypass for soil carbon evidence"
  ON public.vineyard_soil_carbon_evidence FOR SELECT TO service_role
  USING (true);

-- ══════════════════════════════════════════════════════════════════════════
-- 3. Storage bucket for soil carbon evidence PDFs
-- ══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vineyard-soil-carbon-evidence',
  'vineyard-soil-carbon-evidence',
  false,
  20971520,  -- 20 MB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload soil carbon evidence'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload soil carbon evidence"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'vineyard-soil-carbon-evidence');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can read soil carbon evidence'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can read soil carbon evidence"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'vineyard-soil-carbon-evidence');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete soil carbon evidence'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete soil carbon evidence"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'vineyard-soil-carbon-evidence');
  END IF;
END $$;
