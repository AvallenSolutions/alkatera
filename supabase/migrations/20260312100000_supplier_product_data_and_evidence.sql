-- ==========================================================================
-- Supplier Product 4-Pillar Data + Evidence Table Migration
-- Adds environmental impact columns to supplier_products and creates
-- the supplier_product_evidence table for document uploads.
-- ==========================================================================

-- 1a. Add 4-pillar impact columns to supplier_products
-- ==========================================================================

-- Climate
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='impact_climate') THEN
    ALTER TABLE public.supplier_products ADD COLUMN impact_climate numeric(12,6);
  END IF;
END$$;

-- Water
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='impact_water') THEN
    ALTER TABLE public.supplier_products ADD COLUMN impact_water numeric(12,6);
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='water_blue') THEN
    ALTER TABLE public.supplier_products ADD COLUMN water_blue numeric(12,6);
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='water_green') THEN
    ALTER TABLE public.supplier_products ADD COLUMN water_green numeric(12,6);
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='water_grey') THEN
    ALTER TABLE public.supplier_products ADD COLUMN water_grey numeric(12,6);
  END IF;
END$$;

-- Circularity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='impact_waste') THEN
    ALTER TABLE public.supplier_products ADD COLUMN impact_waste numeric(12,6);
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='recycled_content_pct') THEN
    ALTER TABLE public.supplier_products ADD COLUMN recycled_content_pct numeric(5,2) CHECK (recycled_content_pct IS NULL OR (recycled_content_pct >= 0 AND recycled_content_pct <= 100));
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='recyclability_pct') THEN
    ALTER TABLE public.supplier_products ADD COLUMN recyclability_pct numeric(5,2) CHECK (recyclability_pct IS NULL OR (recyclability_pct >= 0 AND recyclability_pct <= 100));
  END IF;
END$$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='end_of_life_pathway') THEN
    ALTER TABLE public.supplier_products ADD COLUMN end_of_life_pathway text CHECK (end_of_life_pathway IS NULL OR end_of_life_pathway IN ('landfill','recycling','composting','incineration','incineration_with_recovery','anaerobic_digestion','reuse','other'));
  END IF;
END$$;

-- Nature
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='impact_land') THEN
    ALTER TABLE public.supplier_products ADD COLUMN impact_land numeric(12,6);
  END IF;
END$$;

-- Certifications
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='supplier_products' AND column_name='certifications') THEN
    ALTER TABLE public.supplier_products ADD COLUMN certifications text[] DEFAULT '{}';
  END IF;
END$$;

-- ==========================================================================
-- 1b. Create supplier_product_evidence table
-- ==========================================================================
CREATE TABLE IF NOT EXISTS public.supplier_product_evidence (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  supplier_product_id uuid REFERENCES public.supplier_products(id) ON DELETE CASCADE,
  platform_supplier_product_id uuid,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Evidence details
  evidence_type text NOT NULL CHECK (evidence_type IN (
    'epd','lca_report','carbon_certificate','water_certificate',
    'third_party_verification','supplier_declaration','test_report',
    'certification','invoice','specification_sheet','other'
  )),
  document_name text NOT NULL,
  document_description text,
  document_url text,
  storage_object_path text,
  file_size_bytes bigint,
  mime_type text,

  -- Impact category coverage
  covers_climate boolean NOT NULL DEFAULT false,
  covers_water boolean NOT NULL DEFAULT false,
  covers_waste boolean NOT NULL DEFAULT false,
  covers_land boolean NOT NULL DEFAULT false,

  -- Document validity
  document_date date,
  document_expiry date,
  document_reference_number text,

  -- Third-party verifier
  verifier_body_id uuid,
  verifier_name text,
  verifier_accreditation text,
  verification_standard text,
  verification_date date,
  verification_expiry date,

  -- Internal verification
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected','expired')),
  internal_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  internal_verified_at timestamptz,
  internal_verification_notes text,
  rejection_reason text,

  -- Audit trail
  uploaded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.supplier_product_evidence ENABLE ROW LEVEL SECURITY;

-- Indices
CREATE INDEX IF NOT EXISTS idx_spe_supplier_product_id ON public.supplier_product_evidence (supplier_product_id);
CREATE INDEX IF NOT EXISTS idx_spe_organization_id ON public.supplier_product_evidence (organization_id);
CREATE INDEX IF NOT EXISTS idx_spe_uploaded_by ON public.supplier_product_evidence (uploaded_by);

-- ==========================================================================
-- 1c. RLS policies for supplier_product_evidence
-- ==========================================================================

-- Suppliers can view evidence for their own products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_product_evidence'
      AND policyname = 'Suppliers can view own product evidence'
  ) THEN
    CREATE POLICY "Suppliers can view own product evidence"
    ON public.supplier_product_evidence FOR SELECT TO authenticated
    USING (
      supplier_product_id IN (
        SELECT sp.id FROM public.supplier_products sp
        JOIN public.suppliers s ON s.id = sp.supplier_id
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Suppliers can upload evidence for their own products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_product_evidence'
      AND policyname = 'Suppliers can insert own product evidence'
  ) THEN
    CREATE POLICY "Suppliers can insert own product evidence"
    ON public.supplier_product_evidence FOR INSERT TO authenticated
    WITH CHECK (
      uploaded_by = auth.uid()
      AND supplier_product_id IN (
        SELECT sp.id FROM public.supplier_products sp
        JOIN public.suppliers s ON s.id = sp.supplier_id
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Suppliers can delete their own non-verified evidence
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_product_evidence'
      AND policyname = 'Suppliers can delete own unverified evidence'
  ) THEN
    CREATE POLICY "Suppliers can delete own unverified evidence"
    ON public.supplier_product_evidence FOR DELETE TO authenticated
    USING (
      uploaded_by = auth.uid()
      AND verification_status != 'verified'
      AND supplier_product_id IN (
        SELECT sp.id FROM public.supplier_products sp
        JOIN public.suppliers s ON s.id = sp.supplier_id
        WHERE s.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- Org members can view evidence for products in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'supplier_product_evidence'
      AND policyname = 'Org members can view product evidence'
  ) THEN
    CREATE POLICY "Org members can view product evidence"
    ON public.supplier_product_evidence FOR SELECT TO authenticated
    USING (
      organization_id IN (
        SELECT om.organization_id FROM public.organization_members om
        WHERE om.user_id = auth.uid()
      )
    );
  END IF;
END$$;

-- ==========================================================================
-- 1d. Storage bucket for supplier product evidence
-- Note: Supabase storage buckets are managed via the storage schema.
-- This creates the bucket if it doesn't exist.
-- ==========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-product-evidence',
  'supplier-product-evidence',
  true,
  20971520, -- 20 MB
  ARRAY['application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for supplier-product-evidence bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload supplier evidence'
  ) THEN
    CREATE POLICY "Authenticated users can upload supplier evidence"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'supplier-product-evidence');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can view supplier evidence'
  ) THEN
    CREATE POLICY "Anyone can view supplier evidence"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'supplier-product-evidence');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own supplier evidence'
  ) THEN
    CREATE POLICY "Users can delete own supplier evidence"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'supplier-product-evidence' AND (storage.foldername(name))[1] != '');
  END IF;
END$$;

-- ==========================================================================
-- 1e. Storage bucket for supplier product images
-- ==========================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-product-images',
  'supplier-product-images',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can upload supplier product images'
  ) THEN
    CREATE POLICY "Authenticated users can upload supplier product images"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'supplier-product-images');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Anyone can view supplier product images'
  ) THEN
    CREATE POLICY "Anyone can view supplier product images"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'supplier-product-images');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Users can delete own supplier product images'
  ) THEN
    CREATE POLICY "Users can delete own supplier product images"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'supplier-product-images' AND (storage.foldername(name))[1] != '');
  END IF;
END$$;

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
