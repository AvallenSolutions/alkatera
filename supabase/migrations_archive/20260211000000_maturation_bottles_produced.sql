-- ============================================================================
-- Add bottles_produced to maturation_profiles
-- ============================================================================
-- Purpose: Allow users to specify the exact number of bottles produced from
-- a maturation batch (single-cask bottlings). When NULL, per-bottle
-- allocation is derived from output_volume ÷ product bottle size.
-- ============================================================================

ALTER TABLE public.maturation_profiles
ADD COLUMN IF NOT EXISTS bottles_produced integer DEFAULT NULL;

COMMENT ON COLUMN public.maturation_profiles.bottles_produced IS
  'Optional override: exact number of bottles produced from this maturation batch. When NULL, per-bottle allocation is derived from output_volume / product bottle size. Use for single-cask bottlings where exact yield is known.';
