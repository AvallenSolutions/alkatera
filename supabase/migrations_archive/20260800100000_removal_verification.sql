-- Migration: Removal Verification & Claim Registry
-- Replaces the simplistic is_verified boolean with proper verification
-- tracking for SBTi FLAG submission and GHG Protocol LSR v1.0 compliance.

-- ============================================================================
-- vineyard_growing_profiles — verification columns
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'removal_verification_status'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN removal_verification_status text NOT NULL DEFAULT 'unverified'
        CHECK (removal_verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'removal_verifier_body'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN removal_verifier_body text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'removal_verifier_standard'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN removal_verifier_standard text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'removal_verification_date'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN removal_verification_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'vineyard_growing_profiles'
      AND column_name = 'removal_verification_expiry'
  ) THEN
    ALTER TABLE public.vineyard_growing_profiles
      ADD COLUMN removal_verification_expiry date;
  END IF;
END $$;

COMMENT ON COLUMN public.vineyard_growing_profiles.removal_verification_status IS 'Third-party verification status for soil carbon removal claims';
COMMENT ON COLUMN public.vineyard_growing_profiles.removal_verifier_body IS 'Name of the third-party verification body (e.g. SCS Global Services, Verra)';
COMMENT ON COLUMN public.vineyard_growing_profiles.removal_verifier_standard IS 'Verification standard used (e.g. ISO 14064-3, Verra VCS, Gold Standard)';
COMMENT ON COLUMN public.vineyard_growing_profiles.removal_verification_date IS 'Date verification was completed';
COMMENT ON COLUMN public.vineyard_growing_profiles.removal_verification_expiry IS 'Date verification expires and re-verification is required';

-- ============================================================================
-- orchard_growing_profiles — verification columns
-- ============================================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'removal_verification_status'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN removal_verification_status text NOT NULL DEFAULT 'unverified'
        CHECK (removal_verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'expired'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'removal_verifier_body'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN removal_verifier_body text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'removal_verifier_standard'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN removal_verifier_standard text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'removal_verification_date'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN removal_verification_date date;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'orchard_growing_profiles'
      AND column_name = 'removal_verification_expiry'
  ) THEN
    ALTER TABLE public.orchard_growing_profiles
      ADD COLUMN removal_verification_expiry date;
  END IF;
END $$;

COMMENT ON COLUMN public.orchard_growing_profiles.removal_verification_status IS 'Third-party verification status for soil carbon removal claims';
COMMENT ON COLUMN public.orchard_growing_profiles.removal_verifier_body IS 'Name of the third-party verification body (e.g. SCS Global Services, Verra)';
COMMENT ON COLUMN public.orchard_growing_profiles.removal_verifier_standard IS 'Verification standard used (e.g. ISO 14064-3, Verra VCS, Gold Standard)';
COMMENT ON COLUMN public.orchard_growing_profiles.removal_verification_date IS 'Date verification was completed';
COMMENT ON COLUMN public.orchard_growing_profiles.removal_verification_expiry IS 'Date verification expires and re-verification is required';

-- ============================================================================
-- removal_claims — polymorphic claim registry
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.removal_claims (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  growing_profile_id uuid NOT NULL,
  growing_profile_type text NOT NULL CHECK (growing_profile_type IN ('vineyard', 'orchard')),
  vintage_year int NOT NULL,
  claimed_co2e numeric(12,4) NOT NULL,
  claim_status text NOT NULL DEFAULT 'pending'
    CHECK (claim_status IN ('pending', 'claimed', 'retired', 'disputed')),
  claimed_by_org_id uuid NOT NULL REFERENCES public.organizations(id),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  retired_at timestamptz,
  retirement_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_removal_claims_profile
  ON public.removal_claims (growing_profile_id, growing_profile_type, vintage_year);

-- RLS
ALTER TABLE public.removal_claims ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'removal_claims' AND policyname = 'Users can view own org removal claims'
  ) THEN
    CREATE POLICY "Users can view own org removal claims" ON public.removal_claims
      FOR SELECT USING (claimed_by_org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'removal_claims' AND policyname = 'Users can manage own org removal claims'
  ) THEN
    CREATE POLICY "Users can manage own org removal claims" ON public.removal_claims
      FOR ALL USING (claimed_by_org_id IN (
        SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

COMMENT ON TABLE public.removal_claims IS 'Registry of soil carbon removal claims for SBTi FLAG and GHG Protocol LSR v1.0 compliance';

-- Reload PostgREST schema cache so new columns/tables are immediately available
NOTIFY pgrst, 'reload schema';
