-- Universal Dropzone staging bucket
--
-- Temporary holding area for files uploaded via the header dropzone that need
-- to be handed off to a target page (spray diary → vineyard/orchard/field
-- growing profile; soil-carbon evidence → asset growing profile).
--
-- The dropzone uploads the file here and hands the id via URL params; the
-- target page pulls it down via a signed URL and feeds it to the same handler
-- it already has for direct uploads. Files are cleaned up by the target page
-- after successful pickup; any orphans are cleared by a scheduled job later.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ingest-staging',
  'ingest-staging',
  false,
  20971520,  -- 20 MB to match the dropzone's client-side cap
  NULL       -- any mime type (PDF / image / XLSX / CSV)
) ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can upload ingest-staging'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload ingest-staging"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'ingest-staging');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can read ingest-staging'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can read ingest-staging"
      ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'ingest-staging');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Authenticated users can delete ingest-staging'
    AND tablename = 'objects' AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete ingest-staging"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'ingest-staging');
  END IF;
END $$;
