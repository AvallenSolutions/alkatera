-- report-assets storage bucket
--
-- Root cause of "logo upload failed" in the arrival onboarding flow: the
-- baseline schema squash (00000000000000_baseline_prod_schema.sql) is
-- schema-only, but storage.buckets rows are data, not schema, so the
-- 'report-assets' bucket never made it into any migration. It has only ever
-- existed in production because someone created it by hand in the Supabase
-- dashboard (see the "report-assets bucket not found. Please create it in
-- Supabase dashboard." warning already in components/report-builder/
-- BrandingPanel.tsx). Every environment that runs `supabase db reset` --
-- local dev, CI, a fresh preview -- starts with no bucket at all, so any
-- upload to it 400s.
--
-- Used by: organisation settings logo upload, the arrival onboarding
-- company-logo upload, the report-builder branding panel, and generated
-- sustainability report PDFs (lib/reports/generate-sustainability-pdf.ts).
-- Public because every consumer reads the file back via getPublicUrl().

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'report-assets',
  'report-assets',
  true,
  26214400, -- 25 MB: covers 10 MB logo uploads and generated report PDFs
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/gif',
    'application/pdf'
  ];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload report assets'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload report assets"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'report-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can update report assets'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can update report assets"
      ON storage.objects FOR UPDATE TO authenticated
      USING (bucket_id = 'report-assets');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete report assets'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete report assets"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'report-assets');
  END IF;

  -- Public read: logos and report PDFs are served straight from
  -- getPublicUrl() on public pages (QR menus, passports, shared reports).
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Anyone can view report assets'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Anyone can view report assets"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'report-assets');
  END IF;
END $$;
