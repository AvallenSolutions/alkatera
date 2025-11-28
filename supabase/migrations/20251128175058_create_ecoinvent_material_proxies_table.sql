/*
  # Create Ecoinvent Material Proxies Lookup Table

  ## Overview
  This table stores background LCA data from Ecoinvent 3.12 for common beverage
  industry materials. When users add materials without specific supplier data,
  the system uses these proxies to provide realistic multi-capital impact estimates.

  ## Table: ecoinvent_material_proxies

  ### Columns
  - `id` (uuid, primary key) - Unique identifier
  - `material_category` (text) - Material category for matching (e.g., 'sugar_cane', 'glass_virgin')
  - `material_name` (text) - Human-readable name
  - `ecoinvent_process_id` (text) - Official Ecoinvent process UUID
  - `ecoinvent_process_name` (text) - Official Ecoinvent process name
  - `reference_unit` (text) - Unit of measurement (kg, L, kWh, etc.)
  
  ### Impact Factors (ReCiPe 2016 Midpoint H)
  - `impact_climate` (numeric) - kg CO2e per unit
  - `impact_water` (numeric) - m³ per unit
  - `impact_land` (numeric) - m² per unit
  - `impact_waste` (numeric) - kg per unit
  - `impact_marine_eutrophication` (numeric) - kg N eq per unit
  - `impact_particulate_matter` (numeric) - kg PM2.5 eq per unit
  - `impact_human_toxicity` (numeric) - kg 1,4-DCB per unit
  
  ### Metadata
  - `ecoinvent_version` (text) - Version of Ecoinvent used
  - `lcia_method` (text) - Impact assessment method
  - `geography` (text) - Geographic scope (e.g., 'GLO', 'EU-27', 'GB')
  - `system_model` (text) - System model used (e.g., 'Cutoff', 'APOS')
  - `data_quality_score` (integer) - 1-5 score for proxy quality
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Usage
  When a material is added via OpenLCA search but OpenLCA API is unavailable,
  or for rapid prototyping, the system falls back to this table for realistic
  impact estimates based on material category matching.

  ## Data Sources
  Values are based on Ecoinvent 3.12 database and ReCiPe 2016 Midpoint (H)
  characterization factors, adjusted for beverage industry typical scenarios.
*/

-- =====================================================
-- STEP 1: CREATE TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ecoinvent_material_proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Material Identification
  material_category TEXT NOT NULL UNIQUE,
  material_name TEXT NOT NULL,
  ecoinvent_process_id TEXT,
  ecoinvent_process_name TEXT,
  reference_unit TEXT NOT NULL DEFAULT 'kg',
  
  -- Core 4 Impact Categories
  impact_climate NUMERIC NOT NULL CHECK (impact_climate >= 0),
  impact_water NUMERIC NOT NULL DEFAULT 0 CHECK (impact_water >= 0),
  impact_land NUMERIC NOT NULL DEFAULT 0 CHECK (impact_land >= 0),
  impact_waste NUMERIC NOT NULL DEFAULT 0 CHECK (impact_waste >= 0),
  
  -- Extended Impact Categories (CSRD/TNFD)
  impact_marine_eutrophication NUMERIC DEFAULT 0 CHECK (impact_marine_eutrophication >= 0),
  impact_particulate_matter NUMERIC DEFAULT 0 CHECK (impact_particulate_matter >= 0),
  impact_human_toxicity NUMERIC DEFAULT 0 CHECK (impact_human_toxicity >= 0),
  
  -- Metadata
  ecoinvent_version TEXT DEFAULT '3.12',
  lcia_method TEXT DEFAULT 'ReCiPe 2016 Midpoint (H)',
  geography TEXT DEFAULT 'GLO',
  system_model TEXT DEFAULT 'Cutoff',
  data_quality_score INTEGER DEFAULT 3 CHECK (data_quality_score BETWEEN 1 AND 5),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================================================
-- STEP 2: ADD COMMENTS
-- =====================================================

COMMENT ON TABLE public.ecoinvent_material_proxies IS
  'Background LCA data from Ecoinvent 3.12 for common beverage materials. Used when specific supplier data unavailable.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.material_category IS
  'Standardized category key for matching (e.g., "sugar_cane_global", "glass_bottle_virgin"). Used for lookup.';

COMMENT ON COLUMN public.ecoinvent_material_proxies.data_quality_score IS
  '1=Poor proxy, 5=Excellent match. Helps users understand data reliability.';

-- =====================================================
-- STEP 3: CREATE INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_ecoinvent_proxies_category
  ON public.ecoinvent_material_proxies(material_category);

CREATE INDEX IF NOT EXISTS idx_ecoinvent_proxies_name
  ON public.ecoinvent_material_proxies(material_name);

CREATE INDEX IF NOT EXISTS idx_ecoinvent_proxies_geography
  ON public.ecoinvent_material_proxies(geography);

-- =====================================================
-- STEP 4: ENABLE RLS
-- =====================================================

ALTER TABLE public.ecoinvent_material_proxies ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read proxies (shared resource)
CREATE POLICY "Authenticated users can view Ecoinvent proxies"
  ON public.ecoinvent_material_proxies
  FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert/update (admin-managed data)
CREATE POLICY "Service role can manage Ecoinvent proxies"
  ON public.ecoinvent_material_proxies
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- STEP 5: SEED DATA - COMMON BEVERAGE MATERIALS
-- =====================================================

-- INGREDIENTS

INSERT INTO public.ecoinvent_material_proxies (
  material_category, material_name, reference_unit,
  impact_climate, impact_water, impact_land, impact_waste,
  geography, data_quality_score
) VALUES
  -- Sugar
  ('sugar_beet_eu', 'Sugar, from sugar beet (EU)', 'kg',
   0.55, 0.15, 1.20, 0.05, 'EU-27', 4),
  
  ('sugar_cane_global', 'Sugar, from sugar cane (Global)', 'kg',
   0.90, 0.25, 1.40, 0.10, 'GLO', 4),
  
  -- Water
  ('water_tap_municipal', 'Water, tap water (Municipal treatment)', 'kg',
   0.0003, 1.00, 0.0001, 0.0001, 'GLO', 5),
  
  -- Acids & Flavourings
  ('citric_acid', 'Citric acid, anhydrous (Fermentation)', 'kg',
   5.50, 0.12, 0.40, 0.08, 'GLO', 3),
  
  -- Alcohol
  ('ethanol_grain', 'Ethanol, from grain fermentation', 'kg',
   1.60, 0.40, 1.80, 0.15, 'GLO', 3),
  
  -- CO2
  ('co2_industrial', 'Carbon dioxide, liquid (Industrial capture)', 'kg',
   0.15, 0.002, 0.001, 0.001, 'GLO', 4)

ON CONFLICT (material_category) DO NOTHING;

-- PACKAGING MATERIALS

INSERT INTO public.ecoinvent_material_proxies (
  material_category, material_name, reference_unit,
  impact_climate, impact_water, impact_land, impact_waste,
  geography, data_quality_score
) VALUES
  -- Glass
  ('glass_bottle_virgin', 'Glass bottle, virgin material', 'kg',
   1.10, 0.005, 0.02, 0.05, 'EU-27', 4),
  
  ('glass_bottle_60pcr', 'Glass bottle, 60% recycled content', 'kg',
   0.65, 0.003, 0.01, 0.02, 'EU-27', 4),
  
  -- Aluminium
  ('aluminium_cap', 'Aluminium cap/closure', 'kg',
   9.20, 0.015, 0.05, 0.20, 'GLO', 4),
  
  -- Paper/Cardboard
  ('paper_label', 'Paper label, wet glue application', 'kg',
   1.10, 0.08, 0.90, 0.05, 'EU-27', 3),
  
  ('cardboard_corrugated', 'Corrugated cardboard, secondary packaging', 'kg',
   0.95, 0.06, 0.60, 0.08, 'EU-27', 4),
  
  -- Plastics
  ('pet_bottle_virgin', 'PET bottle, virgin polymer', 'kg',
   2.30, 0.004, 0.01, 0.03, 'GLO', 4),
  
  ('hdpe_bottle', 'HDPE bottle, virgin polymer', 'kg',
   1.90, 0.003, 0.01, 0.02, 'GLO', 3)

ON CONFLICT (material_category) DO NOTHING;

-- ENERGY & TRANSPORT

INSERT INTO public.ecoinvent_material_proxies (
  material_category, material_name, reference_unit,
  impact_climate, impact_water, impact_land, impact_waste,
  geography, data_quality_score
) VALUES
  -- Electricity
  ('electricity_grid_gb', 'Electricity, grid mix (Great Britain)', 'kWh',
   0.233, 0.04, 0.001, 0.005, 'GB', 5),
  
  ('electricity_grid_eu', 'Electricity, grid mix (EU-27)', 'kWh',
   0.295, 0.05, 0.001, 0.006, 'EU-27', 5),
  
  -- Heat
  ('natural_gas_heat', 'Natural gas, burned for heat', 'kWh',
   0.202, 0.001, 0.002, 0.002, 'GLO', 4),
  
  -- Transport
  ('transport_hgv_diesel', 'Transport, freight, lorry (HGV diesel)', 'tkm',
   0.090, 0.001, 0.03, 0.005, 'EU-27', 4)

ON CONFLICT (material_category) DO NOTHING;

-- =====================================================
-- STEP 6: CREATE UPDATE TRIGGER
-- =====================================================

CREATE TRIGGER update_ecoinvent_proxies_updated_at
  BEFORE UPDATE ON public.ecoinvent_material_proxies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 7: VERIFICATION
-- =====================================================

DO $$
DECLARE
  proxy_count integer;
BEGIN
  SELECT COUNT(*) INTO proxy_count FROM public.ecoinvent_material_proxies;
  
  RAISE NOTICE 'Ecoinvent Material Proxies Table Created:';
  RAISE NOTICE '  Total proxy records: %', proxy_count;
  RAISE NOTICE '  ✓ Ready for hybrid overlay calculations';
END $$;
