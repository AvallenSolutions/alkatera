/*
  # Add Water and Waste Tracking to Production Sites

  1. Changes to `product_lca_production_sites`
    - Add `allocated_emissions_kg_co2e` (rename from attributable_emissions_per_unit for clarity)
    - Add `allocated_water_litres` (total water allocated from facility)
    - Add `allocated_waste_kg` (total waste allocated from facility)
    - Add `emission_intensity_kg_co2e_per_unit` (per-unit intensity)
    - Add `water_intensity_litres_per_unit` (per-unit water intensity)
    - Add `waste_intensity_kg_per_unit` (per-unit waste intensity)
    - Add `reporting_period_start` and `reporting_period_end` for traceability
    - Add `status` field ('draft', 'provisional', 'verified')
    - Add allocation metadata fields

  2. Notes
    - Supports comprehensive environmental impact allocation
    - Tracks all three key metrics: CO2e, water, waste
    - Maintains per-unit intensities for easy calculation
*/

-- Add new columns for comprehensive impact tracking
ALTER TABLE public.product_lca_production_sites 
ADD COLUMN IF NOT EXISTS allocated_emissions_kg_co2e NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_water_litres NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS allocated_waste_kg NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS emission_intensity_kg_co2e_per_unit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS water_intensity_litres_per_unit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS waste_intensity_kg_per_unit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS reporting_period_start DATE,
ADD COLUMN IF NOT EXISTS reporting_period_end DATE,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'provisional', 'verified')),
ADD COLUMN IF NOT EXISTS co2e_entry_method TEXT,
ADD COLUMN IF NOT EXISTS data_source_tag TEXT,
ADD COLUMN IF NOT EXISTS is_energy_intensive_process BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS uses_proxy_data BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_facility_production_volume NUMERIC,
ADD COLUMN IF NOT EXISTS production_volume_unit TEXT DEFAULT 'units',
ADD COLUMN IF NOT EXISTS attribution_ratio NUMERIC,
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;

-- Add comments
COMMENT ON COLUMN public.product_lca_production_sites.allocated_emissions_kg_co2e IS 'Total CO2e emissions allocated to this product from this facility';
COMMENT ON COLUMN public.product_lca_production_sites.allocated_water_litres IS 'Total water consumption allocated to this product from this facility';
COMMENT ON COLUMN public.product_lca_production_sites.allocated_waste_kg IS 'Total waste generated allocated to this product from this facility';
COMMENT ON COLUMN public.product_lca_production_sites.emission_intensity_kg_co2e_per_unit IS 'CO2e emissions per unit of product';
COMMENT ON COLUMN public.product_lca_production_sites.water_intensity_litres_per_unit IS 'Water consumption per unit of product';
COMMENT ON COLUMN public.product_lca_production_sites.waste_intensity_kg_per_unit IS 'Waste generated per unit of product';
COMMENT ON COLUMN public.product_lca_production_sites.status IS 'Allocation status: draft, provisional, or verified';
COMMENT ON COLUMN public.product_lca_production_sites.reporting_period_start IS 'Start date of the reporting period for facility data';
COMMENT ON COLUMN public.product_lca_production_sites.reporting_period_end IS 'End date of the reporting period for facility data';

-- Migrate existing data if attributable_emissions_per_unit exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'product_lca_production_sites' 
    AND column_name = 'attributable_emissions_per_unit'
  ) THEN
    UPDATE public.product_lca_production_sites
    SET emission_intensity_kg_co2e_per_unit = attributable_emissions_per_unit
    WHERE attributable_emissions_per_unit IS NOT NULL;
  END IF;
END $$;