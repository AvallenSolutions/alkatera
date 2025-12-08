/*
  # Add Product Image URL to Supplier Products Table

  ## Overview
  Adds a product_image_url field to the supplier_products table to store
  product images uploaded by suppliers or administrators.

  ## Changes
  1. New Column
    - `product_image_url` (text, nullable) - Storage path/URL to product image
    - Stores full path to image in Supabase Storage

  2. Metadata Enhancement
    - Use existing metadata JSONB field to store image dimensions and file info

  ## Security
  - No RLS changes needed - inherits existing supplier_products table policies
  - Image field is optional and can be null
  - Actual image access controlled by storage bucket policies

  ## Data Migration
  - Existing products will have null product_image_url (acceptable)
  - Backward compatible with existing data
*/

-- ============================================================================
-- STEP 1: Add product_image_url column to supplier_products table
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'product_image_url'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN product_image_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.product_image_url IS 
  'Storage path to product image in Supabase Storage (supplier-product-images bucket)';

-- ============================================================================
-- STEP 2: Create index for products with images
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_products_with_images
  ON public.supplier_products(id)
  WHERE product_image_url IS NOT NULL;