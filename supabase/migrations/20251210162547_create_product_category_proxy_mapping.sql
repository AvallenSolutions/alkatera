/*
  # Create Product Category to Ecoinvent Proxy Mapping Table

  1. New Tables
    - `product_category_proxy_mappings`
      - Maps product categories to Ecoinvent process UUIDs for industry average proxies
      - Used when specific facility data is unavailable
      - Includes emission intensity factors for quick calculation

  2. Purpose
    - Enable conservative estimation when manufacturer energy data unavailable
    - Provide audit trail for proxy-based calculations
    - Support ISO 14044-compliant data quality tracking

  3. Data Quality
    - All proxies are tagged as "Secondary Data (Estimate)"
    - 10% safety buffer applied automatically in calculations
    - Clear distinction from primary data sources
*/

-- Create the proxy mapping table
CREATE TABLE IF NOT EXISTS product_category_proxy_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Product category this proxy applies to
  product_category text NOT NULL,
  product_subcategory text,

  -- Ecoinvent reference
  ecoinvent_process_uuid uuid,
  ecoinvent_process_name text NOT NULL,
  ecoinvent_version text DEFAULT '3.12',

  -- Emission factors (per kg of product)
  co2e_per_kg numeric NOT NULL,
  water_use_per_kg numeric DEFAULT 0,
  land_use_per_kg numeric DEFAULT 0,

  -- Multi-capital impact vectors (per kg)
  ghg_biogenic_co2e_per_kg numeric DEFAULT 0,
  ghg_fossil_co2e_per_kg numeric NOT NULL,
  ghg_luluc_co2e_per_kg numeric DEFAULT 0,

  -- GHG breakdown (per kg)
  co2_per_kg numeric DEFAULT 0,
  ch4_per_kg numeric DEFAULT 0,
  n2o_per_kg numeric DEFAULT 0,

  -- Data quality indicators
  data_quality_score text DEFAULT 'Low',
  geographical_scope text DEFAULT 'Global',
  temporal_scope text,
  technology_scope text,

  -- Metadata
  description text,
  notes text,
  confidence_level text DEFAULT 'Estimated',
  source_reference text,

  -- Safety buffer recommendation
  recommended_buffer_percentage numeric DEFAULT 10.0,

  -- Audit
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_proxy_mappings_product_category
  ON product_category_proxy_mappings(product_category);

-- Enable RLS
ALTER TABLE product_category_proxy_mappings ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read proxy mappings (reference data)
CREATE POLICY "Authenticated users can read proxy mappings"
  ON product_category_proxy_mappings
  FOR SELECT
  TO authenticated
  USING (true);

-- Add columns to contract_manufacturer_allocations for proxy tracking
ALTER TABLE contract_manufacturer_allocations
  ADD COLUMN IF NOT EXISTS uses_proxy_data boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS proxy_mapping_id uuid REFERENCES product_category_proxy_mappings(id),
  ADD COLUMN IF NOT EXISTS calculation_method text,
  ADD COLUMN IF NOT EXISTS data_quality_rating text,
  ADD COLUMN IF NOT EXISTS confidence_score text,
  ADD COLUMN IF NOT EXISTS data_source text,
  ADD COLUMN IF NOT EXISTS safety_buffer_applied numeric DEFAULT 0;

-- Create index for proxy-based allocations
CREATE INDEX IF NOT EXISTS idx_cm_allocations_proxy_data
  ON contract_manufacturer_allocations(uses_proxy_data);

-- Add helpful comment
COMMENT ON TABLE product_category_proxy_mappings IS
  'Maps product categories to Ecoinvent process proxies for conservative estimation when manufacturer-specific data is unavailable. All proxies include 10% safety buffer in calculations.';

COMMENT ON COLUMN contract_manufacturer_allocations.uses_proxy_data IS
  'TRUE when allocation calculated using industry average proxies instead of specific facility data';

COMMENT ON COLUMN contract_manufacturer_allocations.safety_buffer_applied IS
  'Percentage safety buffer applied (typically 10%) to ensure conservative estimates';
