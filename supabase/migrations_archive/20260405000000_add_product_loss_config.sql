-- Add product loss config column for downstream lifecycle stage loss rates
-- Used to calculate upstream emission multipliers per ISO 14044
-- JSON shape: { distributionLossPercent: number, retailLossPercent: number, consumerWastePercent: number }

ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS product_loss_config jsonb;

COMMENT ON COLUMN product_carbon_footprints.product_loss_config IS
  'Product loss rates at downstream lifecycle stages (distribution, retail, consumer). Applied as upstream emission multiplier per ISO 14044.';
