/*
  # Add RLS Policies for product_lca_results

  1. Security
    - Add SELECT policy: Organization members can view LCA results for their organization's products
    - Add INSERT policy: Organization members can create LCA results for their organization's products
    - Add UPDATE policy: Organization members can update LCA results for their organization's products
    - Add DELETE policy: Organization members can delete LCA results for their organization's products

  2. Notes
    - All policies check organization membership through the product_lcas table
    - Policies ensure users can only access results for products in their organization
*/

-- SELECT policy: View LCA results for organization's products
CREATE POLICY "Organization members can view LCA results"
  ON product_lca_results
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_results.product_lca_id
      AND product_lcas.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- INSERT policy: Create LCA results for organization's products
CREATE POLICY "Organization members can create LCA results"
  ON product_lca_results
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_results.product_lca_id
      AND product_lcas.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- UPDATE policy: Update LCA results for organization's products
CREATE POLICY "Organization members can update LCA results"
  ON product_lca_results
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_results.product_lca_id
      AND product_lcas.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_results.product_lca_id
      AND product_lcas.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );

-- DELETE policy: Delete LCA results for organization's products
CREATE POLICY "Organization members can delete LCA results"
  ON product_lca_results
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM product_lcas
      WHERE product_lcas.id = product_lca_results.product_lca_id
      AND product_lcas.organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()
      )
    )
  );
