/*
  # Update Product Images Storage Bucket Size Limits

  Increases the file size limit from 5MB to 10MB to match the
  client-side validation and user expectations.

  Changes:
    - product-images: Updates file_size_limit from 5242880 (5MB) to 10485760 (10MB)
    - supplier-product-images: Same update for consistency
*/

-- Update the product-images bucket file size limit to 10MB
UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB
WHERE id = 'product-images';

-- Update the supplier-product-images bucket file size limit to 10MB for consistency
UPDATE storage.buckets
SET file_size_limit = 10485760  -- 10MB
WHERE id = 'supplier-product-images';
