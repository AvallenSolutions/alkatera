/*
  # Create Knowledge Bank Storage Bucket

  1. Storage
    - Create `knowledge-bank-files` bucket for storing documents, videos, and other learning materials
    - Enable private access with RLS policies
    - Set file size limits and allowed MIME types

  2. Security
    - Add RLS policies for authenticated users
    - Users can only access files from their organization
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'knowledge-bank-files',
  'knowledge-bank-files',
  false,
  524288000,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint',
    'application/msword',
    'text/csv',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm'
  ]
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload knowledge bank files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'knowledge-bank-files'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Users can view their organization's knowledge bank files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'knowledge-bank-files'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Users can update their organization's knowledge bank files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'knowledge-bank-files'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);

CREATE POLICY "Admins can delete knowledge bank files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'knowledge-bank-files'
  AND (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM organization_members om
    JOIN roles r ON om.role_id = r.id
    WHERE om.user_id = auth.uid()
    AND r.name IN ('owner', 'admin')
  )
);