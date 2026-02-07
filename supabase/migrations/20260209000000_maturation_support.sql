-- ============================================================================
-- Maturation / Aging Support for Spirits and Wine
-- ============================================================================
-- Purpose: Add maturation profile tracking for products that undergo barrel
-- aging (spirits, wine). Supports oak cask parameters, angel's share
-- calculation, and warehouse energy attribution.
--
-- Design: Maturation is modeled as a SEPARATE profile table rather than a
-- new material_type, because aging is a time-based process (not a BOM item).
-- At LCA calculation time, the maturation calculator produces synthetic
-- product_carbon_footprint_materials rows that the aggregator picks up.
--
-- Methodology:
--   - Cut-off allocation for barrel reuse (ISO 14044)
--   - Angel's share classified as NMVOC (photochemical ozone formation)
--   - Warehouse energy via DEFRA grid factors
-- ============================================================================

-- ============================================================================
-- 1. MATURATION PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.maturation_profiles (
  id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  product_id bigint NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),

  -- Barrel specification
  barrel_type text NOT NULL DEFAULT 'american_oak_200',
  barrel_volume_litres numeric(8,2) NOT NULL DEFAULT 200,
  barrel_use_number integer NOT NULL DEFAULT 1,
  barrel_co2e_new numeric(8,4),

  -- Maturation parameters
  aging_duration_months integer NOT NULL DEFAULT 12,
  angel_share_percent_per_year numeric(5,2) NOT NULL DEFAULT 2.0,
  climate_zone text NOT NULL DEFAULT 'temperate',
  fill_volume_litres numeric(8,2) NOT NULL,
  number_of_barrels integer NOT NULL DEFAULT 1,

  -- Warehouse energy
  warehouse_energy_kwh_per_barrel_year numeric(8,4) DEFAULT 15.0,
  warehouse_energy_source text DEFAULT 'grid_electricity',

  -- Allocation method
  allocation_method text NOT NULL DEFAULT 'cut_off',

  -- Metadata
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Constraints
  CONSTRAINT mp_barrel_type_check CHECK (barrel_type IN (
    'american_oak_200', 'french_oak_225', 'american_oak_500', 'custom'
  )),
  CONSTRAINT mp_climate_zone_check CHECK (climate_zone IN (
    'temperate', 'continental', 'tropical'
  )),
  CONSTRAINT mp_angel_share_range CHECK (
    angel_share_percent_per_year >= 0 AND angel_share_percent_per_year <= 25
  ),
  CONSTRAINT mp_aging_duration_positive CHECK (aging_duration_months > 0),
  CONSTRAINT mp_barrel_use_positive CHECK (barrel_use_number > 0),
  CONSTRAINT mp_fill_volume_positive CHECK (fill_volume_litres > 0),
  CONSTRAINT mp_number_of_barrels_positive CHECK (number_of_barrels > 0),
  CONSTRAINT mp_allocation_method_check CHECK (allocation_method IN (
    'cut_off', 'avoided_burden'
  )),
  CONSTRAINT mp_warehouse_energy_source_check CHECK (warehouse_energy_source IN (
    'grid_electricity', 'natural_gas', 'renewable', 'mixed'
  ))
);

-- Index for fast lookup by product
CREATE INDEX IF NOT EXISTS idx_maturation_profiles_product ON public.maturation_profiles(product_id);

-- Unique constraint: one maturation profile per product
CREATE UNIQUE INDEX IF NOT EXISTS idx_maturation_profiles_product_unique ON public.maturation_profiles(product_id);

-- RLS
ALTER TABLE public.maturation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view maturation profiles for their org products"
  ON public.maturation_profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products
    JOIN public.organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = maturation_profiles.product_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert maturation profiles for their org products"
  ON public.maturation_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products
    JOIN public.organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = maturation_profiles.product_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can update maturation profiles for their org products"
  ON public.maturation_profiles FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products
    JOIN public.organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = maturation_profiles.product_id
    AND organization_members.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.products
    JOIN public.organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = maturation_profiles.product_id
    AND organization_members.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete maturation profiles for their org products"
  ON public.maturation_profiles FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.products
    JOIN public.organization_members ON products.organization_id = organization_members.organization_id
    WHERE products.id = maturation_profiles.product_id
    AND organization_members.user_id = auth.uid()
  ));


-- ============================================================================
-- 2. LCA SUB-STAGE FOR MATURATION
-- ============================================================================

-- Shift 'On-site Waste Management' from display_order 6 to 7 to make room
UPDATE public.lca_sub_stages SET display_order = 7 WHERE id = 6 AND display_order = 6;

-- Insert maturation sub-stage under Core Operations (stage_id = 2)
-- Positioned after 'Beverage Production & Bottling' (display_order 5)
INSERT INTO public.lca_sub_stages (id, lca_stage_id, name, description, display_order)
VALUES (
  13, 2, 'Maturation / Aging',
  'Spirit or wine aging in barrels or storage vessels, including barrel allocation, angel''s share losses, and warehouse energy',
  6
) ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- 3. MATURATION EMISSION FACTORS
-- ============================================================================

-- Oak Barrel (American, 200L, new) — standard bourbon/whisky barrel
-- Source: Estimated from cooperage industry data, SWA LCA (2006),
--         Pettersson (2016) Swedish whisky LCA
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Oak Barrel (American, 200L, new)', 'Ingredient', 0.20, 'L',
  'Estimated from cooperage data; Scotch Whisky Association LCA (2006); Pettersson (2016) Swedish whisky LCA',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Estimated barrel manufacturing emissions per litre capacity",
      "authors": "Compiled from SWA (2006), Pettersson (2016), cooperage industry reports",
      "year": 2024
    },
    "corroborating_sources": [
      {"title": "Life Cycle Assessment of Scotch Whisky", "authors": "Scotch Whisky Association", "year": 2006, "value": "Warehousing ~10% of total footprint"},
      {"title": "Life cycle assessment of Swedish single malt whisky", "authors": "Pettersson K.", "year": 2016, "journal": "J Cleaner Production", "value": "2.26 kg CO2eq/L pure alcohol total"}
    ],
    "system_boundary": "Cradle-to-gate: forestry, sawmill, cooperage, charring. Cut-off allocation for first fill.",
    "value_range_low": 0.15,
    "value_range_high": 0.30,
    "notes": "New 200L American white oak barrel: ~40 kg CO2e total manufacturing. Amortized per litre: 40/200 = 0.20 kg CO2e/L. Under cut-off allocation, first fill bears full manufacturing burden.",
    "drinks_relevance": "Bourbon, whisky, rum, tequila — standard spirits maturation vessel",
    "review_date": "2026-02-09"
  }'::jsonb,
  0.50, 2.00, 0.05, 'US', 0.18, 0.01,
  0, 0.0003, 0.00005, 0,
  'IPCC AR6 GWP100', '2016-2024', 40,
  0, 0
);

-- Oak Barrel (French, 225L, new) — standard wine/premium spirits barrique
-- Source: Estimated from French cooperage data, Bosco et al. (2011) wine LCA
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Oak Barrel (French, 225L, new)', 'Ingredient', 0.24, 'L',
  'Estimated from French cooperage data; Bosco et al. (2011) wine barrel LCA',
  '{
    "data_quality_grade": "LOW",
    "literature_source": {
      "title": "Estimated barrel manufacturing emissions for French oak barrique",
      "authors": "Compiled from Bosco et al. (2011), French cooperage industry reports",
      "year": 2024
    },
    "corroborating_sources": [
      {"title": "Economic-environmental impact of wine ageing in reused barrels", "authors": "Various", "year": 2019, "journal": "J Cleaner Production", "value": "0.008-0.015 kg CO2eq/L for reused barrel aging"}
    ],
    "system_boundary": "Cradle-to-gate: forestry, stave seasoning (2-3 years air-drying), cooperage, toasting. Cut-off allocation for first fill.",
    "value_range_low": 0.18,
    "value_range_high": 0.35,
    "notes": "New 225L French oak barrique: ~55 kg CO2e total manufacturing (higher due to 2-3yr stave air-drying). Amortized per litre: 55/225 = 0.24 kg CO2e/L.",
    "drinks_relevance": "Wine aging, premium whisky, brandy, cognac — traditional maturation vessel",
    "review_date": "2026-02-09"
  }'::jsonb,
  0.60, 3.00, 0.05, 'FR', 0.22, 0.01,
  0, 0.0003, 0.00005, 0,
  'IPCC AR6 GWP100', '2016-2024', 40,
  0, 0
);

-- Oak Barrel (reused, 2nd+ fill) — ex-bourbon, ex-sherry, etc.
-- Under cut-off allocation, reused barrels carry zero manufacturing burden
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Oak Barrel (reused, 2nd+ fill)', 'Ingredient', 0.01, 'L',
  'Cut-off allocation per ISO 14044: reused barrels carry zero manufacturing burden, only maintenance/transport',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Cut-off allocation for reused barrels per ISO 14044 methodology",
      "authors": "Standard LCA methodology",
      "year": 2024
    },
    "system_boundary": "Gate-to-gate: barrel inspection, cleaning, reconditioning only",
    "value_range_low": 0.005,
    "value_range_high": 0.015,
    "notes": "Under cut-off allocation, reused barrels carry zero manufacturing burden from previous life. Only barrel inspection, cleaning (~0.5 kWh per barrel), and local transport included. 0.01 kg CO2e/L is conservative estimate for cleaning and handling.",
    "drinks_relevance": "Scotch whisky (ex-bourbon), rum (ex-bourbon/sherry), wine reused barrels, tequila reposado",
    "review_date": "2026-02-09"
  }'::jsonb,
  0.05, 0.00, 0.01, 'GLO', 0.008, 0.001,
  0, 0.00001, 0.000002, 0,
  'IPCC AR6 GWP100', '2020-2024', 30,
  0, 0
);

-- Maturation Warehouse Energy (per barrel per year, temperate climate baseline)
-- Source: SWA (2006) warehouse energy; DEFRA 2025 UK grid factor
INSERT INTO public.staging_emission_factors (
  organization_id, name, category, co2_factor, reference_unit, source,
  metadata, water_factor, land_factor, waste_factor,
  geographic_scope, co2_fossil_factor, co2_biogenic_factor,
  ch4_fossil_factor, ch4_biogenic_factor, n2o_factor, hfc_pfc_factor,
  gwp_methodology, temporal_coverage, uncertainty_percent,
  co2_dluc_factor, ch4_factor
) VALUES (
  NULL, 'Maturation Warehouse Energy (per barrel-year)', 'Energy', 3.10, 'barrel-year',
  'Scotch Whisky Association LCA (2006) warehouse energy estimate; DEFRA 2025 UK grid factor 0.207 kg CO2e/kWh',
  '{
    "data_quality_grade": "MEDIUM",
    "literature_source": {
      "title": "Warehouse energy estimate for maturation warehouses",
      "authors": "SWA (2006), DEFRA 2025 conversion factors",
      "year": 2024
    },
    "corroborating_sources": [
      {"title": "Life Cycle Assessment of Scotch Whisky", "authors": "Scotch Whisky Association", "year": 2006, "value": "Warehousing ~10% of total Scotch whisky footprint"}
    ],
    "system_boundary": "Gate-to-gate: warehouse lighting, minimal climate control, monitoring systems",
    "value_range_low": 1.50,
    "value_range_high": 8.00,
    "notes": "Temperate dunnage warehouse: ~15 kWh/barrel/year baseline. Climate-controlled or tropical warehouses can be 3-5x higher. Based on SWA data that warehousing accounts for ~10% of total spirits footprint. Calculation: 15 kWh × 0.207 kg CO2e/kWh = 3.10 kg CO2e/barrel/year.",
    "drinks_relevance": "All matured spirits (whisky, brandy, rum, tequila) and barrel-aged wines",
    "review_date": "2026-02-09"
  }'::jsonb,
  0.10, 0.50, 0.00, 'GB', 2.80, 0.10,
  0, 0.00005, 0.00001, 0,
  'IPCC AR6 GWP100', '2020-2024', 35,
  0, 0
);
