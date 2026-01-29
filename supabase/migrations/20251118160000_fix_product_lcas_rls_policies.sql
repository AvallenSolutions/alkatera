/*
  # Fix Product LCAs RLS Policies

  1. Changes
    - Drop the existing "FOR ALL" policy on product_lcas
    - Create separate policies for SELECT, INSERT, UPDATE, and DELETE
    - INSERT policy checks that user is member of the organization they're inserting into
    - SELECT/UPDATE/DELETE policies check that user is member of the LCA's organization

  2. Security
    - Maintains organization-based access control
    - Allows users to create LCAs for their organization
    - Allows users to manage LCAs within their organization
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage LCAs for their organization" ON public.product_lcas;
DROP POLICY IF EXISTS "Users can view LCAs for their organization" ON public.product_lcas;
DROP POLICY IF EXISTS "Users can create LCAs for their organization" ON public.product_lcas;
DROP POLICY IF EXISTS "Users can update LCAs for their organization" ON public.product_lcas;
DROP POLICY IF EXISTS "Users can delete LCAs for their organization" ON public.product_lcas;

-- Policy for SELECT: Users can view LCAs from their organization
CREATE POLICY "Users can view LCAs for their organization"
ON public.product_lcas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy for INSERT: Users can create LCAs for their organization
CREATE POLICY "Users can create LCAs for their organization"
ON public.product_lcas
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy for UPDATE: Users can update LCAs in their organization
CREATE POLICY "Users can update LCAs for their organization"
ON public.product_lcas
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
);

-- Policy for DELETE: Users can delete LCAs from their organization
CREATE POLICY "Users can delete LCAs for their organization"
ON public.product_lcas
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = product_lcas.organization_id
    AND organization_members.user_id = auth.uid()
  )
);
