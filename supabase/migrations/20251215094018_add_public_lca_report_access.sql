/*
  # Add Public Access for LCA Reports

  1. Changes
    - Add public read policy for completed product LCAs
    - Add public read policy for product LCA materials
    - This allows the public LCA report page to work without authentication

  2. Security
    - Only completed (published) LCAs are accessible
    - No write access granted
    - Users must still be authenticated to create/edit LCAs
*/

-- Allow anonymous users to read completed LCAs
CREATE POLICY "Anyone can view completed LCAs"
  ON product_lcas
  FOR SELECT
  TO anon
  USING (status = 'completed');

-- Allow anonymous users to read materials for completed LCAs
CREATE POLICY "Anyone can view materials for completed LCAs"
  ON product_lca_materials
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_materials.product_lca_id
      AND product_lcas.status = 'completed'
    )
  );