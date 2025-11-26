/*
  # Create Product Images Storage Bucket

  1. Storage Bucket
    - Creates `product-images` bucket for storing product images
    - Public bucket for easy image display
    - Configured for image files only

  2. Security
    - Authenticated users can upload images to their organization's folder
    - All users can view images (public access for product display)
    - Images organized by organization_id for multi-tenancy
*/

-- Create the product-images storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images to their organization folder
CREATE POLICY "Users can upload product images to their organization folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update images in their organization folder
CREATE POLICY "Users can update product images in their organization folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete images in their organization folder
CREATE POLICY "Users can delete product images in their organization folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images' AND
  (storage.foldername(name))[1] IN (
    SELECT organization_id::text
    FROM organization_members
    WHERE user_id = auth.uid()
  )
);

-- Allow public read access to all product images (for display purposes)
CREATE POLICY "Public read access to product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');
