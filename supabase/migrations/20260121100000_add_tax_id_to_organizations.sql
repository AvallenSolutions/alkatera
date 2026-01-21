/*
  # Add Tax ID column to Organizations

  ## Overview
  This migration adds the `tax_id` column to the organizations table to store
  Tax/VAT identification numbers for billing and invoicing purposes.

  ## Changes
  - Add `tax_id` (text) column to organizations table

  ## Security
  - No RLS changes needed (inherits existing organization update policies)
*/

-- Add tax_id column to organizations table
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS tax_id TEXT DEFAULT NULL;

COMMENT ON COLUMN public.organizations.tax_id IS
  'Tax or VAT identification number for billing and invoicing purposes.';
