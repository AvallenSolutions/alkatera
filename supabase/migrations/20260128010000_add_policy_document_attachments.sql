/*
  # Add Document Attachments to Governance Policies

  ## Changes
  1. Add attachments field to governance_policies table
  2. Create storage bucket for policy documents
  3. Add RLS policies for organization-level access to policy documents

  ## Security
  - Documents are private by default
  - Only organization members can upload and view their org's policy documents
  - Storage uses organization_id for folder structure
*/

-- ============================================================================
-- STEP 1: Add attachments field to governance_policies
-- ============================================================================

ALTER TABLE public.governance_policies
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.governance_policies.attachments IS
  'Array of policy document attachments (PDF, DOCX, etc.) with metadata: [{path, name, size, type, url, uploaded_at}]';

-- ============================================================================
-- STEP 2: Create storage bucket for policy documents
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'policy-documents',
  'policy-documents',
  false, -- Private bucket
  52428800, -- 50MB limit
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 3: Storage RLS policies for policy documents
-- ============================================================================

-- Allow organization members to upload policy documents to their org folder
CREATE POLICY "Users can upload policy documents for their organization"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'policy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Allow organization members to view policy documents from their org
CREATE POLICY "Users can view policy documents from their organization"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'policy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Allow organization members to delete policy documents from their org
CREATE POLICY "Users can delete policy documents from their organization"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'policy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- Allow organization members to update policy documents from their org
CREATE POLICY "Users can update policy documents from their organization"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'policy-documents' AND
  (storage.foldername(name))[1] IN (
    SELECT om.organization_id::text
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);
