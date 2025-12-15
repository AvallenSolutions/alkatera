/*
  # Fix RLS Policies for Facility Emissions

  1. Changes
    - Add INSERT policy for authenticated users to facility_emissions_aggregated
    - Add UPDATE policy for authenticated users to facility_emissions_aggregated
    - Users can only insert/update records for their own organization

  2. Security
    - Authenticated users must be members of the organization
    - Service role policies remain for backend operations
*/

-- Allow authenticated users to insert facility emissions for their organization
CREATE POLICY "Users can insert emissions for their organization's facilities"
ON public.facility_emissions_aggregated
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = facility_emissions_aggregated.organization_id
        AND organization_members.user_id = auth.uid()
    )
);

-- Allow authenticated users to update facility emissions for their organization
CREATE POLICY "Users can update emissions for their organization's facilities"
ON public.facility_emissions_aggregated
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = facility_emissions_aggregated.organization_id
        AND organization_members.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.organization_members
        WHERE organization_members.organization_id = facility_emissions_aggregated.organization_id
        AND organization_members.user_id = auth.uid()
    )
);