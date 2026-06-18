-- Growing Profile Draft Support
--
-- Adds is_draft column so users can save partial data and return later.
-- Relaxes grape_yield_tonnes constraint to allow 0 for drafts (app validates on finalise).

-- ══════════════════════════════════════════════════════════════════════════
-- 1. Add is_draft column (default true for new rows)
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.vineyard_growing_profiles
  ADD COLUMN IF NOT EXISTS is_draft boolean NOT NULL DEFAULT true;

-- Mark all existing profiles as finalised (they were saved via the full flow)
UPDATE public.vineyard_growing_profiles SET is_draft = false WHERE is_draft = true;

-- ══════════════════════════════════════════════════════════════════════════
-- 2. Relax grape_yield_tonnes constraint to allow 0 (for drafts)
--    App layer validates > 0 on finalise.
-- ══════════════════════════════════════════════════════════════════════════

-- Drop the inline CHECK constraint (Postgres auto-names these)
ALTER TABLE public.vineyard_growing_profiles
  DROP CONSTRAINT IF EXISTS vineyard_growing_profiles_grape_yield_tonnes_check;

ALTER TABLE public.vineyard_growing_profiles
  ADD CONSTRAINT vineyard_growing_profiles_grape_yield_tonnes_check
  CHECK (grape_yield_tonnes >= 0);
