/*
  # Add packaging_category column to product_materials

  1. Changes
    - Add `packaging_category` column to `product_materials` table
    - This column stores the type of packaging: container, label, closure, or secondary
    - Used to categorize and summarize packaging materials by type
  
  2. Notes
    - Column is nullable to support existing ingredient records
    - Only relevant for records where material_type = 'packaging'
*/

-- Add packaging_category column
ALTER TABLE product_materials
ADD COLUMN IF NOT EXISTS packaging_category text;

-- Add a check constraint to ensure valid categories
ALTER TABLE product_materials
ADD CONSTRAINT check_packaging_category 
CHECK (
  packaging_category IS NULL 
  OR packaging_category IN ('container', 'label', 'closure', 'secondary')
);

-- Create an index for faster filtering by packaging category
CREATE INDEX IF NOT EXISTS idx_product_materials_packaging_category 
ON product_materials(packaging_category) 
WHERE packaging_category IS NOT NULL;
