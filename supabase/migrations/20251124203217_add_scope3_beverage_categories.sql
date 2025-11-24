/*
  # Add Beverage-Specific Scope 3 Categories

  1. Changes
    - Add new category options to corporate_overheads: capital_goods, downstream_logistics, operational_waste
    - Add new fields for logistics calculations: transport_mode, distance_km, weight_kg
    - Add new fields for waste tracking: material_type, disposal_method, weight_kg
    - Add emission factors for new categories

  2. Purpose
    - Support comprehensive Scope 3 accounting for beverage sector
    - Enable logistics and distribution tracking
    - Track operational waste by disposal method
    - Calculate capital goods embodied carbon
*/

-- Drop existing check constraint and recreate with new categories
ALTER TABLE corporate_overheads DROP CONSTRAINT IF EXISTS corporate_overheads_category_check;

ALTER TABLE corporate_overheads ADD CONSTRAINT corporate_overheads_category_check 
CHECK (category IN (
  'business_travel',
  'purchased_services',
  'employee_commuting',
  'capital_goods',
  'upstream_transportation',
  'waste_disposal',
  'downstream_logistics',
  'operational_waste',
  'other'
));

-- Add new fields for logistics calculations
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'transport_mode'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN transport_mode text 
      CHECK (transport_mode IN ('road', 'rail', 'sea', 'air', 'multimodal'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'distance_km'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN distance_km float CHECK (distance_km >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'weight_kg'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN weight_kg float CHECK (weight_kg >= 0);
  END IF;
END $$;

-- Add new fields for waste tracking
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'material_type'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN material_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'disposal_method'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN disposal_method text 
      CHECK (disposal_method IN ('landfill', 'recycling', 'composting', 'incineration', 'anaerobic_digestion'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'corporate_overheads' AND column_name = 'asset_type'
  ) THEN
    ALTER TABLE corporate_overheads ADD COLUMN asset_type text 
      CHECK (asset_type IN ('machinery', 'vehicles', 'it_hardware', 'equipment', 'other'));
  END IF;
END $$;

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_transport_mode ON corporate_overheads(transport_mode);
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_disposal_method ON corporate_overheads(disposal_method);
CREATE INDEX IF NOT EXISTS idx_corporate_overheads_asset_type ON corporate_overheads(asset_type);

-- Update emission factor helper function to include new categories
CREATE OR REPLACE FUNCTION get_eeio_emission_factor(
  p_category text,
  p_currency text DEFAULT 'GBP'
)
RETURNS float AS $$
BEGIN
  -- Default EEIO factors (kgCO2e per currency unit or per unit of activity)
  RETURN CASE
    WHEN p_category = 'business_travel' THEN 0.25
    WHEN p_category = 'purchased_services' THEN 0.15
    WHEN p_category = 'employee_commuting' THEN 0.20
    WHEN p_category = 'capital_goods' THEN 0.40
    WHEN p_category = 'upstream_transportation' THEN 0.35
    WHEN p_category = 'waste_disposal' THEN 0.10
    WHEN p_category = 'downstream_logistics' THEN 0.30
    WHEN p_category = 'operational_waste' THEN 0.10
    ELSE 0.20
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to get transport emission factor (kgCO2e per tonne-km)
CREATE OR REPLACE FUNCTION get_transport_emission_factor(
  p_transport_mode text
)
RETURNS float AS $$
BEGIN
  -- Emission factors in kgCO2e per tonne-km
  RETURN CASE
    WHEN p_transport_mode = 'road' THEN 0.062      -- HGV average
    WHEN p_transport_mode = 'rail' THEN 0.028      -- Freight rail
    WHEN p_transport_mode = 'sea' THEN 0.011       -- Container ship
    WHEN p_transport_mode = 'air' THEN 0.602       -- Air freight
    WHEN p_transport_mode = 'multimodal' THEN 0.045 -- Mixed average
    ELSE 0.062 -- Default to road
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to get waste disposal emission factor (kgCO2e per kg)
CREATE OR REPLACE FUNCTION get_waste_emission_factor(
  p_disposal_method text,
  p_material_type text DEFAULT 'mixed'
)
RETURNS float AS $$
BEGIN
  -- Emission factors in kgCO2e per kg of waste
  RETURN CASE
    WHEN p_disposal_method = 'landfill' THEN 0.5
    WHEN p_disposal_method = 'recycling' THEN 0.02
    WHEN p_disposal_method = 'composting' THEN 0.01
    WHEN p_disposal_method = 'incineration' THEN 0.3
    WHEN p_disposal_method = 'anaerobic_digestion' THEN 0.005
    ELSE 0.5 -- Default to landfill
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to calculate total production weight for a year
CREATE OR REPLACE FUNCTION get_total_production_weight(
  p_organization_id uuid,
  p_year integer
)
RETURNS float AS $$
DECLARE
  v_total_weight float;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN pl.unit = 'Litre' THEN pl.volume * 1.0  -- Assume 1kg per litre for beverages
      WHEN pl.unit = 'Hectolitre' THEN pl.volume * 100.0
      WHEN pl.unit = 'Kilogram' THEN pl.volume
      ELSE pl.volume
    END
  ), 0) INTO v_total_weight
  FROM production_logs pl
  WHERE pl.organization_id = p_organization_id
    AND EXTRACT(YEAR FROM pl.date) = p_year;
  
  RETURN v_total_weight;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
