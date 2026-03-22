-- =============================================================================
-- Multi-Vintage Growing Profiles
-- =============================================================================
-- Enables one growing profile per vineyard per vintage year, supporting
-- year-on-year tracking and multi-vintage averaging (OIV/AWRI best practice).
--
-- Also adds Phase 1 calculator columns (crop residue, pesticide types).

-- ---------------------------------------------------------------------------
-- 1. Rename reference_year to vintage_year (semantic clarity)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vineyard_growing_profiles
  RENAME COLUMN reference_year TO vintage_year;

-- ---------------------------------------------------------------------------
-- 2. Change unique constraint from (vineyard_id) to (vineyard_id, vintage_year)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vineyard_growing_profiles
  DROP CONSTRAINT IF EXISTS vineyard_growing_profiles_vineyard_id_key;

ALTER TABLE public.vineyard_growing_profiles
  ADD CONSTRAINT vineyard_growing_profiles_vineyard_vintage_key
  UNIQUE(vineyard_id, vintage_year);

-- ---------------------------------------------------------------------------
-- 3. Index on vintage_year for efficient year filtering
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_vineyard_growing_profiles_vintage_year
  ON public.vineyard_growing_profiles(vintage_year);

-- ---------------------------------------------------------------------------
-- 4. Add Phase 1 calculator columns
-- ---------------------------------------------------------------------------
-- Crop residue: whether vine prunings are returned to soil (IPCC Ch 11)
ALTER TABLE public.vineyard_growing_profiles
  ADD COLUMN IF NOT EXISTS pruning_residue_returned boolean DEFAULT true;

-- Pesticide type specificity (USEtox ecotoxicity profiles)
ALTER TABLE public.vineyard_growing_profiles
  ADD COLUMN IF NOT EXISTS pesticide_type text DEFAULT 'generic';

ALTER TABLE public.vineyard_growing_profiles
  ADD COLUMN IF NOT EXISTS herbicide_type text DEFAULT 'generic';
