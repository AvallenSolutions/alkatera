/*
  # Create Blog Videos Storage Bucket

  ## Overview
  Creates a storage bucket for blog video uploads with appropriate access policies.

  ## Security
  - Public read access for published videos
  - Only Alkatera admins can upload/delete videos
*/

-- Create the storage bucket for blog videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'blog-videos',
  'blog-videos',
  true, -- Public bucket
  524288000, -- 500 MB max file size
  ARRAY['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access
CREATE POLICY "Public can view blog videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'blog-videos');

-- Only Alkatera admins can upload videos
CREATE POLICY "Alkatera admins can upload blog videos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'blog-videos'
  AND is_alkatera_admin()
);

-- Only Alkatera admins can update videos
CREATE POLICY "Alkatera admins can update blog videos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'blog-videos'
  AND is_alkatera_admin()
);

-- Only Alkatera admins can delete videos
CREATE POLICY "Alkatera admins can delete blog videos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'blog-videos'
  AND is_alkatera_admin()
);
