-- Add 'burned' to pruning_residue_management_type and a burned-mass column,
-- for both vineyard and orchard growing profiles (symmetry with 20260700300000).
--
-- The original migration created the constraint inline via ADD COLUMN ... CHECK,
-- so Postgres auto-named it <table>_<column>_check. A CHECK constraint cannot be
-- altered in place; drop (IF EXISTS, safe if the name differs) then re-create.

-- ===========================================================================
-- vineyard_growing_profiles
-- ===========================================================================

ALTER TABLE public.vineyard_growing_profiles
  DROP CONSTRAINT IF EXISTS vineyard_growing_profiles_pruning_residue_management_type_check;
ALTER TABLE public.vineyard_growing_profiles
  ADD CONSTRAINT vineyard_growing_profiles_pruning_residue_management_type_check
  CHECK (pruning_residue_management_type IN
    ('in_field', 'removed_for_biomass', 'chipped_and_spread', 'burned'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'pruning_residue_burned_kg_per_ha'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN pruning_residue_burned_kg_per_ha numeric
        CHECK (pruning_residue_burned_kg_per_ha > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.pruning_residue_burned_kg_per_ha IS
  'Dry matter of prunings burned in-field (kg/ha/yr). If NULL when management type = burned, the age-graduated VINE_PRUNING_DM_BY_AGE default is used. Drives IPCC 2006 Vol 4 Ch 2.4 field-burning CH4/N2O (biogenic CO2 excluded).';

-- ===========================================================================
-- orchard_growing_profiles (same change for symmetry)
-- ===========================================================================

ALTER TABLE public.orchard_growing_profiles
  DROP CONSTRAINT IF EXISTS orchard_growing_profiles_pruning_residue_management_type_check;
ALTER TABLE public.orchard_growing_profiles
  ADD CONSTRAINT orchard_growing_profiles_pruning_residue_management_type_check
  CHECK (pruning_residue_management_type IN
    ('in_field', 'removed_for_biomass', 'chipped_and_spread', 'burned'));

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'pruning_residue_burned_kg_per_ha'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN pruning_residue_burned_kg_per_ha numeric
        CHECK (pruning_residue_burned_kg_per_ha > 0);
  END IF;
END $$;

COMMENT ON COLUMN public.orchard_growing_profiles.pruning_residue_burned_kg_per_ha IS
  'Dry matter of prunings burned in-field (kg/ha/yr). If NULL when management type = burned, the per-crop-type pruning DM default is used. Drives IPCC 2006 Vol 4 Ch 2.4 field-burning CH4/N2O (biogenic CO2 excluded).';
