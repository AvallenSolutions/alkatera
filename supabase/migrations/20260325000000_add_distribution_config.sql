-- Add distribution configuration column to PCF records
-- Stores outbound distribution leg parameters (mode, distance) per product LCA
ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS distribution_config jsonb DEFAULT NULL;

COMMENT ON COLUMN product_carbon_footprints.distribution_config IS 'Outbound distribution configuration: transport legs (mode, distance) for Cradle-to-Shelf/Consumer/Grave boundaries';
