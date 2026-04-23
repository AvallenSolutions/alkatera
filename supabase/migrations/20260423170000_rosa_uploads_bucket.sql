-- =============================================================================
-- Rosa v2 — Phase 3: rosa-uploads storage bucket
-- =============================================================================
-- Private bucket Rosa uses to hold user-attached documents (utility bills,
-- supplier specs, LCA reports, etc.). Clients never access this bucket
-- directly; all reads go through /api/rosa/* routes that use the service
-- role, so we block every other role at the storage-policy layer.
-- =============================================================================

BEGIN;

-- Create the bucket if it does not exist. Supabase ships with storage.buckets
-- already created; we can INSERT into it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rosa-uploads',
  'rosa-uploads',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = EXCLUDED.public;

-- Drop any existing policies so re-runs are idempotent.
DROP POLICY IF EXISTS "rosa_uploads_service_all" ON storage.objects;
DROP POLICY IF EXISTS "rosa_uploads_block_anon" ON storage.objects;

-- Only the service role can read/write this bucket. All client reads go
-- through /api/rosa/* routes that enforce ownership.
CREATE POLICY "rosa_uploads_service_all"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'rosa-uploads')
  WITH CHECK (bucket_id = 'rosa-uploads');

COMMIT;
