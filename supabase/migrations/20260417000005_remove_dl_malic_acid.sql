-- ============================================================================
-- Remove 'Malic Acid (DL-malic acid)' — superseded by 'Malic Acid'
-- ============================================================================
-- The entry added in 20260207100000_drinks_factor_library_expansion.sql used
-- a verbose name that will not match typical ingredient labels. The cleaner
-- 'Malic Acid' entry (20260417000003) supersedes it with identical values.
-- ============================================================================

DELETE FROM public.staging_emission_factors
WHERE organization_id IS NULL
AND LOWER(name) = 'malic acid (dl-malic acid)';
