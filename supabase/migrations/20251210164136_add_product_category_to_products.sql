/*
  # Add Product Category to Products Table

  1. Changes
    - Add product_category column to products table
    - Used for matching with proxy emission factors when facility data is unavailable
    - Essential for the "Missing Facility Data" fallback system

  2. Notes
    - Categories must match those in product_category_proxy_mappings table
    - Required for industry average calculations
*/

-- Add product_category column
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS product_category text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_category
  ON products(product_category);

-- Add helpful comment
COMMENT ON COLUMN products.product_category IS
  'Product category used to match with industry average emission factors when specific facility data is unavailable';
