-- Migration: Crop Residue N2O Enhancements
-- Adds pruning residue management type and measured dry matter override
-- to both vineyard and orchard growing profiles.

-- ============================================================================
-- vineyard_growing_profiles
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'pruning_residue_management_type'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN pruning_residue_management_type text DEFAULT 'in_field'
        CHECK (pruning_residue_management_type IN ('in_field', 'removed_for_biomass', 'chipped_and_spread'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'pruning_residue_measured_kg_per_ha'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN pruning_residue_measured_kg_per_ha numeric
        CHECK (pruning_residue_measured_kg_per_ha > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.pruning_residue_management_type IS
  'How vine prunings are managed. in_field = left to decompose (default IPCC N2O applies). removed_for_biomass = N leaves system, zero N2O. chipped_and_spread = adjusted decomposition factor.';
COMMENT ON COLUMN public.vineyard_growing_profiles.pruning_residue_measured_kg_per_ha IS
  'Measured dry matter from prunings in kg/ha/yr. If provided, overrides the VINE_PRUNING_DM_PER_HA default constant. Raises data quality to primary.';

-- ============================================================================
-- orchard_growing_profiles
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'pruning_residue_management_type'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN pruning_residue_management_type text DEFAULT 'in_field'
        CHECK (pruning_residue_management_type IN ('in_field', 'removed_for_biomass', 'chipped_and_spread'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'pruning_residue_measured_kg_per_ha'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN pruning_residue_measured_kg_per_ha numeric
        CHECK (pruning_residue_measured_kg_per_ha > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.orchard_growing_profiles.pruning_residue_management_type IS
  'How tree prunings are managed. in_field = left to decompose (default IPCC N2O applies). removed_for_biomass = N leaves system, zero N2O. chipped_and_spread = adjusted decomposition factor.';
COMMENT ON COLUMN public.orchard_growing_profiles.pruning_residue_measured_kg_per_ha IS
  'Measured dry matter from prunings in kg/ha/yr. If provided, overrides the per-crop-type pruning_dm_per_ha default constant. Raises data quality to primary.';
