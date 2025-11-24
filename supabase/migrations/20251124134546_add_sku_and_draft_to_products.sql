/*
  # Add SKU and Draft Status to Products

  1. Changes
    - Add `sku` column to products table for Stock Keeping Unit tracking
    - Add `is_draft` column to products table to support draft products

  2. Details
    - `sku` is optional and allows for product identification codes
    - `is_draft` defaults to false (completed products)
    - Draft products allow users to save incomplete products
*/

-- Add sku column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'sku'
  ) THEN
    ALTER TABLE public.products ADD COLUMN sku TEXT;
  END IF;
END $$;

-- Add is_draft column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'products'
    AND column_name = 'is_draft'
  ) THEN
    ALTER TABLE public.products ADD COLUMN is_draft BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create index for SKU lookups
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku) WHERE sku IS NOT NULL;

-- Create index for filtering drafts
CREATE INDEX IF NOT EXISTS idx_products_is_draft ON public.products(is_draft);

-- Add comments
COMMENT ON COLUMN public.products.sku IS 'Stock Keeping Unit - unique identifier for product inventory management';
COMMENT ON COLUMN public.products.is_draft IS 'Indicates if the product is a draft (incomplete) or finalized';