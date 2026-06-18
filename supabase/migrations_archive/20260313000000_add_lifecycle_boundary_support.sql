-- Add use-phase and end-of-life configuration columns to PCF records
-- These store the user's chosen parameters for use-phase and EoL calculations
ALTER TABLE product_carbon_footprints
  ADD COLUMN IF NOT EXISTS use_phase_config jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS eol_config jsonb DEFAULT NULL;

COMMENT ON COLUMN product_carbon_footprints.use_phase_config IS 'Use-phase configuration: refrigeration, carbonation settings for Cradle-to-Consumer/Grave boundaries';
COMMENT ON COLUMN product_carbon_footprints.eol_config IS 'End-of-life configuration: region, pathway percentages per material for Cradle-to-Grave boundary';

-- Extend system_boundary_enum to support all 4 lifecycle tiers
-- The enum currently only has cradle_to_gate and cradle_to_grave
ALTER TYPE system_boundary_enum ADD VALUE IF NOT EXISTS 'cradle_to_shelf';
ALTER TYPE system_boundary_enum ADD VALUE IF NOT EXISTS 'cradle_to_consumer';
