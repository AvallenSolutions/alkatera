-- Add product_type column to organizations table.
-- This captures the primary product category for the organisation,
-- used to select the correct industry benchmark for sustainability scoring.

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS product_type text;

-- Optional: add a comment for documentation
COMMENT ON COLUMN organizations.product_type IS 'Primary product category group (e.g. Spirits, Wine, Beer & Cider) used for industry benchmark selection';
