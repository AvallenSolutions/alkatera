/*
  # Create Supplier Evidence Storage Bucket

  1. Storage
    - Create `supplier-evidence` bucket for storing supplier LCA documents
    - Enable public access for authenticated users
    - Set file size limits and allowed MIME types

  2. Security
    - Add RLS policies for authenticated users
    - Users can only access files from their organization
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-evidence',
  'supplier-evidence',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload supplier evidence"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-evidence'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Users can view their organization's supplier evidence"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-evidence'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Users can delete their organization's supplier evidence"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-evidence'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);
