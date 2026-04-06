-- Migration: TNFD Location Sensitivity Fields
-- Adds ecosystem type, biodiversity-sensitive area, and water stress fields
-- to growing profiles and facilities for TNFD LEAP "Locate" phase disclosure.

-- ============================================================================
-- vineyard_growing_profiles
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'ecosystem_type'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN ecosystem_type text
        CHECK (ecosystem_type IN (
          'temperate_forest', 'mediterranean', 'grassland', 'wetland',
          'shrubland', 'tropical_forest', 'boreal_forest', 'semi_arid',
          'other'
        ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'in_biodiversity_sensitive_area'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN in_biodiversity_sensitive_area boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'sensitive_area_details'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN sensitive_area_details text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'water_stress_index'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN water_stress_index text
        CHECK (water_stress_index IN ('low', 'medium', 'high', 'very_high'));
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.ecosystem_type IS
  'TNFD LEAP Locate phase: ecosystem type at the production location per IPBES categories.';
COMMENT ON COLUMN public.vineyard_growing_profiles.in_biodiversity_sensitive_area IS
  'Whether the site is within or adjacent to a Key Biodiversity Area, UNESCO World Heritage Site, Ramsar wetland, or protected area.';
COMMENT ON COLUMN public.vineyard_growing_profiles.sensitive_area_details IS
  'Name and designation of the biodiversity-sensitive area (if applicable).';
COMMENT ON COLUMN public.vineyard_growing_profiles.water_stress_index IS
  'WRI Aqueduct or equivalent water stress classification for the location. Used for TNFD water dependency disclosure.';

-- ============================================================================
-- orchard_growing_profiles (identical columns)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'ecosystem_type'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN ecosystem_type text
        CHECK (ecosystem_type IN (
          'temperate_forest', 'mediterranean', 'grassland', 'wetland',
          'shrubland', 'tropical_forest', 'boreal_forest', 'semi_arid',
          'other'
        ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'in_biodiversity_sensitive_area'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN in_biodiversity_sensitive_area boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'sensitive_area_details'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN sensitive_area_details text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'water_stress_index'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN water_stress_index text
        CHECK (water_stress_index IN ('low', 'medium', 'high', 'very_high'));
  END IF;
END $$;

COMMENT ON COLUMN public.orchard_growing_profiles.ecosystem_type IS
  'TNFD LEAP Locate phase: ecosystem type at the production location per IPBES categories.';
COMMENT ON COLUMN public.orchard_growing_profiles.in_biodiversity_sensitive_area IS
  'Whether the site is within or adjacent to a Key Biodiversity Area, UNESCO World Heritage Site, Ramsar wetland, or protected area.';
COMMENT ON COLUMN public.orchard_growing_profiles.sensitive_area_details IS
  'Name and designation of the biodiversity-sensitive area (if applicable).';
COMMENT ON COLUMN public.orchard_growing_profiles.water_stress_index IS
  'WRI Aqueduct or equivalent water stress classification for the location.';

-- ============================================================================
-- facilities (same four columns for facility-level TNFD Locate disclosure)
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facilities'
      AND column_name = 'ecosystem_type'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN ecosystem_type text
        CHECK (ecosystem_type IN (
          'temperate_forest', 'mediterranean', 'grassland', 'wetland',
          'shrubland', 'tropical_forest', 'boreal_forest', 'semi_arid',
          'other'
        ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facilities'
      AND column_name = 'in_biodiversity_sensitive_area'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN in_biodiversity_sensitive_area boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facilities'
      AND column_name = 'sensitive_area_details'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN sensitive_area_details text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'facilities'
      AND column_name = 'water_stress_index'
  ) THEN
    ALTER TABLE public.facilities
      ADD COLUMN water_stress_index text
        CHECK (water_stress_index IN ('low', 'medium', 'high', 'very_high'));
  END IF;
END $$;

COMMENT ON COLUMN public.facilities.ecosystem_type IS
  'TNFD LEAP Locate phase: ecosystem type at the facility location per IPBES categories.';
COMMENT ON COLUMN public.facilities.in_biodiversity_sensitive_area IS
  'Whether the facility is within or adjacent to a Key Biodiversity Area, UNESCO World Heritage Site, Ramsar wetland, or protected area.';
COMMENT ON COLUMN public.facilities.sensitive_area_details IS
  'Name and designation of the biodiversity-sensitive area (if applicable).';
COMMENT ON COLUMN public.facilities.water_stress_index IS
  'WRI Aqueduct or equivalent water stress classification for the facility location.';

-- Reload PostgREST schema cache so new columns are immediately available
NOTIFY pgrst, 'reload schema';
