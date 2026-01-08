/*
  # Add service role bypass for spend import tables

  1. Changes
    - Add policies to allow service_role to bypass RLS on spend_import_batches
    - Add policies to allow service_role to bypass RLS on spend_import_items
    - This enables edge functions using service_role key to update AI categorization results

  2. Security
    - Service role has full access (used only by trusted edge functions)
    - Existing authenticated user policies remain unchanged
*/

-- Allow service_role full access to spend_import_batches
CREATE POLICY "Service role has full access to batches"
  ON spend_import_batches
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service_role full access to spend_import_items  
CREATE POLICY "Service role has full access to items"
  ON spend_import_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
