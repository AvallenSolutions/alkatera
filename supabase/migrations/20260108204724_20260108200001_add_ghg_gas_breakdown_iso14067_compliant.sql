/*
  # Add GHG Gas Breakdown Fields - ISO 14067 & GHG Protocol Compliant

  ## Standards Compliance
  This migration implements data structures required for:
  - ISO 14067:2018 Section 7.3(e): "list of GHGs taken into account"
  - ISO 14067:2018 Section 7.3(f): "selected characterization factors"
  - GHG Protocol Product Standard Chapter 8: Report emissions by gas type
  - CSRD ESRS E1-6: Disaggregation by greenhouse gas type
  - IPCC AR6 (2021): Latest GWP characterization factors

  ## Key Design Decisions
  1. Separate fossil vs biogenic methane (different GWP per IPCC AR6)
  2. Store both physical mass (kg) AND CO2eq (kg) for audit trail
  3. Document GWP factors used for each calculation
  4. Support full Kyoto Protocol gas coverage (CO2, CH4, N2O, HFCs)

  ## New Columns Added

  ### product_lca_materials
  - `ch4_fossil_kg` - Physical mass of fossil methane (kg CH4)
  - `ch4_biogenic_kg` - Physical mass of biogenic methane (kg CH4)
  - `n2o_kg` - Physical mass of nitrous oxide (kg N2O)
  - `ch4_fossil_kg_co2e` - Fossil methane climate impact (kg CO2e)
  - `ch4_biogenic_kg_co2e` - Biogenic methane climate impact (kg CO2e)
  - `n2o_kg_co2e` - Nitrous oxide climate impact (kg CO2e)
  - `hfc_pfc_kg_co2e` - Fluorinated gases (kg CO2e)
  - `gwp_method` - Characterization method documentation
  - `gwp_ch4_fossil` - GWP factor for fossil CH4
  - `gwp_ch4_biogenic` - GWP factor for biogenic CH4
  - `gwp_n2o` - GWP factor for N2O

  ### staging_emission_factors
  - GHG breakdown factors per reference unit
  - Methodology and temporal documentation

  ## Security
  - No new tables, extends existing RLS-protected tables
  - All columns nullable to support gradual data population
*/

-- ============================================================================
-- PART 1: Add GHG Gas Breakdown to product_lca_materials
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ch4_fossil_kg'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN ch4_fossil_kg numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ch4_fossil_kg_co2e'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN ch4_fossil_kg_co2e numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ch4_biogenic_kg'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN ch4_biogenic_kg numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ch4_biogenic_kg_co2e'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN ch4_biogenic_kg_co2e numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'n2o_kg'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN n2o_kg numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'n2o_kg_co2e'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN n2o_kg_co2e numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'hfc_pfc_kg_co2e'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN hfc_pfc_kg_co2e numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'gwp_method'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN gwp_method text DEFAULT 'IPCC AR6 GWP100';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'gwp_ch4_fossil'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN gwp_ch4_fossil numeric DEFAULT 29.8;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'gwp_ch4_biogenic'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN gwp_ch4_biogenic numeric DEFAULT 27.2;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'gwp_n2o'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN gwp_n2o numeric DEFAULT 273;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'product_lca_materials'
    AND column_name = 'ghg_data_quality'
  ) THEN
    ALTER TABLE public.product_lca_materials
    ADD COLUMN ghg_data_quality text DEFAULT 'secondary';
  END IF;

END $$;

-- ============================================================================
-- PART 2: Add GHG Gas Breakdown to staging_emission_factors
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'co2_fossil_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN co2_fossil_factor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'co2_biogenic_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN co2_biogenic_factor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'ch4_fossil_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN ch4_fossil_factor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'ch4_biogenic_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN ch4_biogenic_factor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'n2o_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN n2o_factor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'hfc_pfc_factor'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN hfc_pfc_factor numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'gwp_methodology'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN gwp_methodology text DEFAULT 'IPCC AR6 GWP100';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'temporal_coverage'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN temporal_coverage text DEFAULT '2020-2023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'ecoinvent_reference'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN ecoinvent_reference text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'staging_emission_factors'
    AND column_name = 'uncertainty_percent'
  ) THEN
    ALTER TABLE public.staging_emission_factors
    ADD COLUMN uncertainty_percent numeric;
  END IF;

END $$;

-- ============================================================================
-- PART 3: Create indexes for reporting queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_lca_materials_ghg_quality
ON public.product_lca_materials(ghg_data_quality)
WHERE ghg_data_quality IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_staging_factors_gwp_method
ON public.staging_emission_factors(gwp_methodology)
WHERE gwp_methodology IS NOT NULL;
