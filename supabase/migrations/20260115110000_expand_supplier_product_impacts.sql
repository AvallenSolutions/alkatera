/*
  # Expand Supplier Product Impact Data

  ## Overview
  This migration expands the supplier_products and platform_supplier_products tables
  to support all 4 environmental impact categories (GHG, Water, Waste, Land/Biodiversity)
  with full ISO 14067/14046 compliance, data quality tracking, and evidence linkage.

  ## Changes

  ### Part 1: Multi-Category Impact Fields
  - `impact_climate` - Replaces carbon_intensity, kg CO2e per unit
  - `impact_water` - m³ water per unit (AWARE-weighted)
  - `impact_waste` - kg waste generated per unit
  - `impact_land` - m²a crop eq per unit (ReCiPe 2016)

  ### Part 2: GHG Breakdown (ISO 14067)
  - `ghg_fossil` - kg CO2e from fossil sources
  - `ghg_biogenic` - kg CO2e from biogenic sources
  - `ghg_land_use_change` - kg CO2e from direct land use change
  - `ghg_breakdown` - JSONB for full gas inventory

  ### Part 3: Water Breakdown (ISO 14046)
  - `water_blue` - m³ blue water (surface/groundwater)
  - `water_green` - m³ green water (rainwater)
  - `water_grey` - m³ grey water (dilution)
  - `water_scarcity_factor` - AWARE factor if known

  ### Part 4: Waste & Circularity Data
  - `recycled_content_pct` - % recycled input material
  - `recyclability_pct` - % recyclable at end-of-life
  - `end_of_life_pathway` - Default disposal scenario
  - `circularity_score` - 0-100 circularity index

  ### Part 5: Nature/Biodiversity Data (ReCiPe 2016)
  - `terrestrial_ecotoxicity` - kg 1,4-DCB eq
  - `freshwater_eutrophication` - kg P eq
  - `terrestrial_acidification` - kg SO₂ eq

  ### Part 6: Data Quality & Methodology
  - `data_quality_score` - 1-5 DQI per ISO 14044
  - `data_confidence_pct` - 0-100 confidence level
  - `data_source_type` - primary_verified, secondary_modelled, hybrid_proxy
  - `methodology_standard` - ISO_14067, PEF, GHG_Protocol, etc.
  - `functional_unit` - Declared functional unit
  - `system_boundary` - cradle_to_gate, cradle_to_grave, etc.

  ### Part 7: Validity & Temporal Data
  - `valid_from` - Impact data validity start
  - `valid_until` - Impact data validity end
  - `reference_year` - Year of underlying LCA study
  - `geographic_scope` - Geographic representativeness

  ### Part 8: Uncertainty Tracking
  - `uncertainty_type` - range, std_dev, pedigree
  - `uncertainty_value` - ± value or %
  - `uncertainty_metadata` - Detailed uncertainty data

  ### Part 9: External Verification
  - `external_verifier_name` - Name of verification body
  - `external_verification_date` - When externally verified
  - `external_verification_expiry` - Verification validity end
  - `external_verification_standard` - ISO 14064-3, etc.
  - `external_verification_url` - Link to verification statement

  ## Security
  - Inherits existing RLS policies from supplier_products table
  - New fields accessible based on organization membership

  ## Performance
  - Indexes on impact fields for efficient queries
  - Composite indexes for common filter patterns
*/

-- ============================================================================
-- PART 1: Create ENUM types for data quality
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'impact_data_source_type') THEN
    CREATE TYPE impact_data_source_type AS ENUM (
      'primary_verified',
      'secondary_modelled',
      'hybrid_proxy'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'system_boundary_type') THEN
    CREATE TYPE system_boundary_type AS ENUM (
      'cradle_to_gate',
      'cradle_to_grave',
      'gate_to_gate',
      'cradle_to_cradle'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'uncertainty_type') THEN
    CREATE TYPE uncertainty_type AS ENUM (
      'range',
      'std_dev',
      'coefficient_of_variation',
      'pedigree_matrix'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'end_of_life_pathway_type') THEN
    CREATE TYPE end_of_life_pathway_type AS ENUM (
      'landfill',
      'recycling',
      'composting',
      'incineration',
      'incineration_with_recovery',
      'anaerobic_digestion',
      'reuse',
      'other'
    );
  END IF;
END $$;

-- ============================================================================
-- PART 2: Add multi-category impact fields to supplier_products
-- ============================================================================

-- Impact Climate (replaces carbon_intensity for consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'impact_climate'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN impact_climate NUMERIC(12, 6);

    -- Migrate existing carbon_intensity data
    UPDATE public.supplier_products
    SET impact_climate = carbon_intensity
    WHERE carbon_intensity IS NOT NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.impact_climate IS
  'Climate impact in kg CO2e per functional unit. Primary GHG metric per ISO 14067.';

-- Impact Water
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'impact_water'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN impact_water NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.impact_water IS
  'Water consumption in m³ per functional unit. AWARE-weighted when scarcity factor available.';

-- Impact Waste
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'impact_waste'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN impact_waste NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.impact_waste IS
  'Waste generation in kg per functional unit during production.';

-- Impact Land
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'impact_land'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN impact_land NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.impact_land IS
  'Land use in m²a crop equivalent per functional unit. ReCiPe 2016 midpoint methodology.';

-- ============================================================================
-- PART 3: Add GHG breakdown fields (ISO 14067)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'ghg_fossil'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN ghg_fossil NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.ghg_fossil IS
  'Fossil carbon emissions in kg CO2e. Required for ISO 14067 compliance.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'ghg_biogenic'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN ghg_biogenic NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.ghg_biogenic IS
  'Biogenic carbon emissions in kg CO2e. From biological sources per ISO 14067.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'ghg_land_use_change'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN ghg_land_use_change NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.ghg_land_use_change IS
  'Direct land use change emissions in kg CO2e (dLUC). Per ISO 14067 requirements.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'ghg_breakdown'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN ghg_breakdown JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.ghg_breakdown IS
  'Full GHG gas inventory breakdown (CO2, CH4, N2O, HFCs, etc.) with GWP factors. JSONB for flexibility.';

-- ============================================================================
-- PART 4: Add water breakdown fields (ISO 14046)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'water_blue'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN water_blue NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.water_blue IS
  'Blue water consumption in m³ (surface and groundwater). Per ISO 14046.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'water_green'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN water_green NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.water_green IS
  'Green water consumption in m³ (rainwater stored in soil). Per ISO 14046.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'water_grey'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN water_grey NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.water_grey IS
  'Grey water footprint in m³ (freshwater required to dilute pollutants). Per ISO 14046.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'water_scarcity_factor'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN water_scarcity_factor NUMERIC(8, 4);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.water_scarcity_factor IS
  'AWARE water scarcity factor for production location. 1.0 = world average, >10 = high stress.';

-- ============================================================================
-- PART 5: Add waste & circularity fields
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'recycled_content_pct'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN recycled_content_pct NUMERIC(5, 2)
      CHECK (recycled_content_pct IS NULL OR (recycled_content_pct >= 0 AND recycled_content_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.recycled_content_pct IS
  'Percentage of recycled input material (0-100). Key circularity metric.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'recyclability_pct'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN recyclability_pct NUMERIC(5, 2)
      CHECK (recyclability_pct IS NULL OR (recyclability_pct >= 0 AND recyclability_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.recyclability_pct IS
  'Percentage of product recyclable at end-of-life (0-100). Design for circularity metric.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'end_of_life_pathway'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN end_of_life_pathway TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.end_of_life_pathway IS
  'Default end-of-life disposal scenario: landfill, recycling, composting, incineration, etc.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'circularity_score'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN circularity_score NUMERIC(5, 2)
      CHECK (circularity_score IS NULL OR (circularity_score >= 0 AND circularity_score <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.circularity_score IS
  'Material Circularity Indicator (0-100). Based on Ellen MacArthur Foundation methodology.';

-- ============================================================================
-- PART 6: Add nature/biodiversity fields (ReCiPe 2016)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'terrestrial_ecotoxicity'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN terrestrial_ecotoxicity NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.terrestrial_ecotoxicity IS
  'Terrestrial ecotoxicity potential in kg 1,4-DCB eq. ReCiPe 2016 midpoint.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'freshwater_eutrophication'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN freshwater_eutrophication NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.freshwater_eutrophication IS
  'Freshwater eutrophication potential in kg P eq. ReCiPe 2016 midpoint.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'terrestrial_acidification'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN terrestrial_acidification NUMERIC(12, 6);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.terrestrial_acidification IS
  'Terrestrial acidification potential in kg SO₂ eq. ReCiPe 2016 midpoint.';

-- ============================================================================
-- PART 7: Add data quality & methodology fields
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'data_quality_score'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN data_quality_score INTEGER
      CHECK (data_quality_score IS NULL OR (data_quality_score >= 1 AND data_quality_score <= 5));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.data_quality_score IS
  'Data Quality Indicator (1-5) per ISO 14044. 1 = highest quality, 5 = lowest.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'data_confidence_pct'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN data_confidence_pct NUMERIC(5, 2)
      CHECK (data_confidence_pct IS NULL OR (data_confidence_pct >= 0 AND data_confidence_pct <= 100));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.data_confidence_pct IS
  'Confidence level (0-100%) in reported impact values. Used in uncertainty propagation.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'data_source_type'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN data_source_type TEXT
      CHECK (data_source_type IS NULL OR data_source_type IN ('primary_verified', 'secondary_modelled', 'hybrid_proxy'));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.data_source_type IS
  'Classification of data provenance: primary_verified (EPD/LCA), secondary_modelled (database), hybrid_proxy (mixed).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'methodology_standard'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN methodology_standard TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.methodology_standard IS
  'LCA methodology standard used: ISO_14067, ISO_14044, PEF, GHG_Protocol, IPCC, etc.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'functional_unit'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN functional_unit TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.functional_unit IS
  'Declared functional unit for impact values (e.g., "1 kg of product at factory gate").';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'system_boundary'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN system_boundary TEXT
      CHECK (system_boundary IS NULL OR system_boundary IN ('cradle_to_gate', 'cradle_to_grave', 'gate_to_gate', 'cradle_to_cradle'));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.system_boundary IS
  'LCA system boundary: cradle_to_gate, cradle_to_grave, gate_to_gate, or cradle_to_cradle.';

-- ============================================================================
-- PART 8: Add validity & temporal fields
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'valid_from'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN valid_from DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.valid_from IS
  'Start date for impact data validity. Data should not be used before this date.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'valid_until'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN valid_until DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.valid_until IS
  'End date for impact data validity. Data should be re-assessed after this date.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'reference_year'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN reference_year INTEGER
      CHECK (reference_year IS NULL OR (reference_year >= 1990 AND reference_year <= 2100));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.reference_year IS
  'Reference year for the underlying LCA study or data collection.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'geographic_scope'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN geographic_scope TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.geographic_scope IS
  'Geographic representativeness of impact data (e.g., "EU-27", "Global", "UK", specific country code).';

-- ============================================================================
-- PART 9: Add uncertainty tracking fields
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'uncertainty_type'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN uncertainty_type TEXT
      CHECK (uncertainty_type IS NULL OR uncertainty_type IN ('range', 'std_dev', 'coefficient_of_variation', 'pedigree_matrix'));
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.uncertainty_type IS
  'Type of uncertainty quantification: range (min-max), std_dev, coefficient_of_variation (%), or pedigree_matrix.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'uncertainty_value'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN uncertainty_value NUMERIC(10, 4);
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.uncertainty_value IS
  'Uncertainty value: ± absolute value for range/std_dev, or % for coefficient_of_variation.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'uncertainty_metadata'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN uncertainty_metadata JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.uncertainty_metadata IS
  'Detailed uncertainty data including pedigree matrix scores, Monte Carlo parameters, etc.';

-- ============================================================================
-- PART 10: Add external verification fields
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'external_verifier_name'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN external_verifier_name TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.external_verifier_name IS
  'Name of third-party verification body (e.g., "SGS", "Bureau Veritas", "DNV").';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'external_verification_date'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN external_verification_date DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.external_verification_date IS
  'Date when impact data was verified by external verification body.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'external_verification_expiry'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN external_verification_expiry DATE;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.external_verification_expiry IS
  'Expiry date of external verification. Data should be re-verified before this date.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'external_verification_standard'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN external_verification_standard TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.external_verification_standard IS
  'Verification standard used: ISO_14064_3, ISO_14025, EN_15804, PAS_2050, etc.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'supplier_products' AND column_name = 'external_verification_url'
  ) THEN
    ALTER TABLE public.supplier_products
      ADD COLUMN external_verification_url TEXT;
  END IF;
END $$;

COMMENT ON COLUMN public.supplier_products.external_verification_url IS
  'URL to verification statement or EPD program registry entry.';

-- ============================================================================
-- PART 11: Create platform_supplier_products table (mirrors supplier_products)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_supplier_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_supplier_id UUID NOT NULL REFERENCES public.platform_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT NOT NULL,
  product_code TEXT,
  product_image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Verification (internal)
  is_verified BOOLEAN DEFAULT false NOT NULL,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at TIMESTAMPTZ,
  verification_notes TEXT,

  -- Origin location
  origin_address TEXT,
  origin_lat NUMERIC CHECK (origin_lat IS NULL OR (origin_lat >= -90 AND origin_lat <= 90)),
  origin_lng NUMERIC CHECK (origin_lng IS NULL OR (origin_lng >= -180 AND origin_lng <= 180)),
  origin_country_code TEXT CHECK (origin_country_code IS NULL OR LENGTH(origin_country_code) = 2),

  -- Multi-category impacts
  impact_climate NUMERIC(12, 6),
  impact_water NUMERIC(12, 6),
  impact_waste NUMERIC(12, 6),
  impact_land NUMERIC(12, 6),

  -- GHG breakdown (ISO 14067)
  ghg_fossil NUMERIC(12, 6),
  ghg_biogenic NUMERIC(12, 6),
  ghg_land_use_change NUMERIC(12, 6),
  ghg_breakdown JSONB DEFAULT '{}'::jsonb,

  -- Water breakdown (ISO 14046)
  water_blue NUMERIC(12, 6),
  water_green NUMERIC(12, 6),
  water_grey NUMERIC(12, 6),
  water_scarcity_factor NUMERIC(8, 4),

  -- Waste & circularity
  recycled_content_pct NUMERIC(5, 2) CHECK (recycled_content_pct IS NULL OR (recycled_content_pct >= 0 AND recycled_content_pct <= 100)),
  recyclability_pct NUMERIC(5, 2) CHECK (recyclability_pct IS NULL OR (recyclability_pct >= 0 AND recyclability_pct <= 100)),
  end_of_life_pathway TEXT,
  circularity_score NUMERIC(5, 2) CHECK (circularity_score IS NULL OR (circularity_score >= 0 AND circularity_score <= 100)),

  -- Nature/biodiversity (ReCiPe 2016)
  terrestrial_ecotoxicity NUMERIC(12, 6),
  freshwater_eutrophication NUMERIC(12, 6),
  terrestrial_acidification NUMERIC(12, 6),

  -- Data quality & methodology
  data_quality_score INTEGER CHECK (data_quality_score IS NULL OR (data_quality_score >= 1 AND data_quality_score <= 5)),
  data_confidence_pct NUMERIC(5, 2) CHECK (data_confidence_pct IS NULL OR (data_confidence_pct >= 0 AND data_confidence_pct <= 100)),
  data_source_type TEXT CHECK (data_source_type IS NULL OR data_source_type IN ('primary_verified', 'secondary_modelled', 'hybrid_proxy')),
  methodology_standard TEXT,
  functional_unit TEXT,
  system_boundary TEXT CHECK (system_boundary IS NULL OR system_boundary IN ('cradle_to_gate', 'cradle_to_grave', 'gate_to_gate', 'cradle_to_cradle')),

  -- Validity & temporal
  valid_from DATE,
  valid_until DATE,
  reference_year INTEGER CHECK (reference_year IS NULL OR (reference_year >= 1990 AND reference_year <= 2100)),
  geographic_scope TEXT,

  -- Uncertainty
  uncertainty_type TEXT CHECK (uncertainty_type IS NULL OR uncertainty_type IN ('range', 'std_dev', 'coefficient_of_variation', 'pedigree_matrix')),
  uncertainty_value NUMERIC(10, 4),
  uncertainty_metadata JSONB DEFAULT '{}'::jsonb,

  -- External verification
  external_verifier_name TEXT,
  external_verification_date DATE,
  external_verification_expiry DATE,
  external_verification_standard TEXT,
  external_verification_url TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Constraints
  CONSTRAINT non_empty_platform_product_name CHECK (length(trim(name)) > 0),
  CONSTRAINT non_empty_platform_product_unit CHECK (length(trim(unit)) > 0),
  CONSTRAINT platform_product_verified_by_required CHECK (
    (is_verified = false) OR (is_verified = true AND verified_by IS NOT NULL)
  ),
  CONSTRAINT platform_product_verified_at_required CHECK (
    (is_verified = false) OR (is_verified = true AND verified_at IS NOT NULL)
  ),
  CONSTRAINT platform_product_origin_coords_complete CHECK (
    (origin_lat IS NULL AND origin_lng IS NULL) OR
    (origin_lat IS NOT NULL AND origin_lng IS NOT NULL)
  )
);

COMMENT ON TABLE public.platform_supplier_products IS
  'Product catalog for platform-wide suppliers. Managed by Alkatera admins, visible to all organizations.';

-- Create unique index on supplier + product code
CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_supplier_products_unique_code
  ON public.platform_supplier_products(platform_supplier_id, product_code)
  WHERE product_code IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_supplier_id
  ON public.platform_supplier_products(platform_supplier_id);

CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_name_lower
  ON public.platform_supplier_products(LOWER(name));

CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_active_verified
  ON public.platform_supplier_products(is_active, is_verified)
  WHERE is_active = true AND is_verified = true;

CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_category
  ON public.platform_supplier_products(category)
  WHERE category IS NOT NULL;

-- Impact indexes for filtering
CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_has_climate
  ON public.platform_supplier_products(impact_climate)
  WHERE impact_climate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_supplier_products_has_water
  ON public.platform_supplier_products(impact_water)
  WHERE impact_water IS NOT NULL;

-- Enable RLS
ALTER TABLE public.platform_supplier_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for platform_supplier_products

-- All authenticated users can view platform supplier products
CREATE POLICY "Anyone can view platform supplier products"
  ON public.platform_supplier_products
  FOR SELECT
  TO authenticated
  USING (true);

-- Only platform admins can create platform supplier products
CREATE POLICY "Platform admins can create platform supplier products"
  ON public.platform_supplier_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Only platform admins can update platform supplier products
CREATE POLICY "Platform admins can update platform supplier products"
  ON public.platform_supplier_products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Only platform admins can delete platform supplier products
CREATE POLICY "Platform admins can delete platform supplier products"
  ON public.platform_supplier_products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      JOIN public.organizations o ON o.id = om.organization_id
      WHERE om.user_id = auth.uid()
      AND o.is_platform_admin = true
    )
  );

-- Create updated_at trigger
DROP TRIGGER IF EXISTS update_platform_supplier_products_updated_at ON public.platform_supplier_products;

CREATE TRIGGER update_platform_supplier_products_updated_at
  BEFORE UPDATE ON public.platform_supplier_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- PART 12: Create indexes for supplier_products impact fields
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_supplier_products_has_climate_impact
  ON public.supplier_products(impact_climate)
  WHERE impact_climate IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_has_water_impact
  ON public.supplier_products(impact_water)
  WHERE impact_water IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_has_all_impacts
  ON public.supplier_products(organization_id, is_active)
  WHERE is_active = true
    AND impact_climate IS NOT NULL
    AND impact_water IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_data_quality
  ON public.supplier_products(data_quality_score, data_source_type)
  WHERE data_quality_score IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_products_validity
  ON public.supplier_products(valid_until)
  WHERE valid_until IS NOT NULL;

-- ============================================================================
-- PART 13: Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_supplier_products TO authenticated;
