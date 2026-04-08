-- Migration: Land Lease and Ownership Boundary
-- GHG Protocol Land Sector & Removals Standard v1.0 requires companies
-- to define their operational boundary for land.

-- ============================================================================
-- vineyard_growing_profiles
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'land_ownership_type'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN land_ownership_type text
        CHECK (land_ownership_type IN ('owned', 'leased', 'rental', 'contract_growing'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'lease_expiry_date'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN lease_expiry_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'is_boundary_controlled'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN is_boundary_controlled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.land_ownership_type IS 'GHG Protocol LSR v1.0 operational boundary definition';
COMMENT ON COLUMN public.vineyard_growing_profiles.lease_expiry_date IS 'Required if land_ownership_type is leased or rental';
COMMENT ON COLUMN public.vineyard_growing_profiles.is_boundary_controlled IS 'Whether the organisation controls land management decisions on this land';

-- ============================================================================
-- orchard_growing_profiles
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'land_ownership_type'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN land_ownership_type text
        CHECK (land_ownership_type IN ('owned', 'leased', 'rental', 'contract_growing'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'lease_expiry_date'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN lease_expiry_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'is_boundary_controlled'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN is_boundary_controlled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

COMMENT ON COLUMN public.orchard_growing_profiles.land_ownership_type IS 'GHG Protocol LSR v1.0 operational boundary definition';
COMMENT ON COLUMN public.orchard_growing_profiles.lease_expiry_date IS 'Required if land_ownership_type is leased or rental';
COMMENT ON COLUMN public.orchard_growing_profiles.is_boundary_controlled IS 'Whether the organisation controls land management decisions on this land';
