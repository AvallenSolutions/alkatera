/*
  # Create Supplier Product Images Storage Bucket

  ## Overview
  Creates a storage bucket for supplier product images with appropriate
  security policies for multi-tenant access control.

  ## Storage Bucket
  1. Bucket: `supplier-product-images`
    - Public bucket for easy image display
    - 5MB file size limit per image
    - Restricted to image MIME types only
    - Organized by path: {organization_id}/{supplier_id}/{product_id}/image.ext

  ## Security Policies
  1. Upload: Authenticated users can upload to their organization's folders
  2. Update: Authenticated users can update their organization's images
  3. Delete: Authenticated users can delete their organization's images
  4. Read: Public read access for displaying product images

  ## Path Structure
  - Format: {organization_id}/{supplier_id}/{product_id}/{filename}
  - Enables multi-tenant isolation at storage level
  - Allows efficient cleanup when suppliers/products are deleted
*/

-- ============================================================================
-- STEP 1: Create the supplier-product-images storage bucket
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'supplier-product-images',
  'supplier-product-images',
  true, -- Public for easy image display
  5242880, -- 5MB limit per image
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: Create storage policies for authenticated users
-- ============================================================================

-- Allow authenticated users to upload product images to their organization folder
CREATE POLICY "Users can upload supplier product images to their organization folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update product images in their organization folder
CREATE POLICY "Users can update supplier product images in their organization folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'supplier-product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete product images in their organization folder
CREATE POLICY "Users can delete supplier product images in their organization folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- STEP 3: Allow public read access for image display
-- ============================================================================

-- Allow public read access to all supplier product images (for display purposes)
CREATE POLICY "Public read access to supplier product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'supplier-product-images');