-- Fix supplier-product-images bucket: make it public so getPublicUrl() works
-- The bucket was set to private in 20260219130000_supplier_security_fixes.sql
-- but the code uses getPublicUrl() which requires a public bucket.

-- 1. Make the bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'supplier-product-images';

-- 2. Drop the restrictive authenticated-only SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view supplier product images" ON storage.objects;

-- 3. Create a public SELECT policy (anyone can view product images)
DROP POLICY IF EXISTS "Anyone can view supplier product images" ON storage.objects;
CREATE POLICY "Anyone can view supplier product images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'supplier-product-images');

-- 4. Keep the upload policy restrictive: only suppliers can upload to their own path
DROP POLICY IF EXISTS "Suppliers can upload own product images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload supplier product images" ON storage.objects;

CREATE POLICY "Suppliers can upload own product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
  )
);

-- 5. Keep delete policy for authenticated users
DROP POLICY IF EXISTS "Users can delete own supplier product images" ON storage.objects;
CREATE POLICY "Users can delete own supplier product images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'supplier-product-images'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM public.suppliers WHERE user_id = auth.uid()
  )
);

NOTIFY pgrst, 'reload schema';
