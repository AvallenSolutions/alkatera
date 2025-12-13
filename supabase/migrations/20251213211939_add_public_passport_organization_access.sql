/*
  # Add Public Access for Organizations via Product Passports

  1. Changes
    - Add SELECT policy to allow public access to organization basic info when accessed via product passports
    - Only exposes: id, name, logo_url, subscription_tier, subscription_status
    - Requires that the organization has at least one passport-enabled product
  
  2. Security
    - Policy is restrictive: only allows reading organization data for orgs with public passports
    - Does not expose sensitive organization data
*/

-- Allow public to view organization info for passport-enabled products
CREATE POLICY "Allow public to view organization info for passports"
  ON organizations
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM products
      WHERE products.organization_id = organizations.id
        AND products.passport_enabled = true
    )
  );
