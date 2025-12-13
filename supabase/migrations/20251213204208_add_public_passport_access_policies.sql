/*
  # Add public access for product passport data
  
  1. Changes
    - Add policy to allow anonymous users to view product_lcas for products with passports enabled
    - Add policy to allow anonymous users to view product_lca_materials for products with passports enabled
  
  2. Security
    - Only allows reading LCA data for products that have passport_enabled = true
    - Does not expose any data for products without public passports
*/

-- Allow anonymous users to view LCAs for products with enabled passports
CREATE POLICY "Public can view LCAs for products with enabled passports"
  ON product_lcas FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_lcas.product_id
        AND products.passport_enabled = true
    )
  );

-- Allow anonymous users to view materials for LCAs of products with enabled passports
CREATE POLICY "Public can view materials for products with enabled passports"
  ON product_lca_materials FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas
      JOIN products ON products.id = product_lcas.product_id
      WHERE product_lcas.id = product_lca_materials.product_lca_id
        AND products.passport_enabled = true
    )
  );
