/*
  # Blog Images Storage Bucket

  ## Overview
  Creates a Supabase Storage bucket for blog post images with appropriate RLS policies.

  ## Bucket Created
  - `blog-images` - Storage for blog post featured images and inline images

  ## Security
  - Public read access for all images
  - Only Alkatera admins can upload/update/delete images
*/

-- =====================================================
-- CREATE STORAGE BUCKET
-- =====================================================

-- Create the blog-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-images',
  'blog-images',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- RLS POLICIES FOR STORAGE
-- =====================================================

-- Allow public read access to all blog images
CREATE POLICY "Public can view blog images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'blog-images');

-- Allow Alkatera admins to upload images
CREATE POLICY "Alkatera admins can upload blog images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'blog-images'
    AND is_alkatera_admin()
  );

-- Allow Alkatera admins to update images
CREATE POLICY "Alkatera admins can update blog images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'blog-images'
    AND is_alkatera_admin()
  )
  WITH CHECK (
    bucket_id = 'blog-images'
    AND is_alkatera_admin()
  );

-- Allow Alkatera admins to delete images
CREATE POLICY "Alkatera admins can delete blog images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'blog-images'
    AND is_alkatera_admin()
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Public can view blog images" ON storage.objects IS
  'Allows public read access to all blog images for displaying on the website';

COMMENT ON POLICY "Alkatera admins can upload blog images" ON storage.objects IS
  'Allows Alkatera administrators to upload new blog images';
