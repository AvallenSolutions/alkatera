-- Refactor: Make growing profiles vineyard-scoped instead of product-scoped
--
-- Growing practices (soil management, fertiliser, fuel, irrigation) are
-- vineyard-level data, not per-product. A vineyard's agronomic practices
-- don't change based on which wine the grapes go into.
--
-- This migration makes product_id optional and enforces one profile per
-- vineyard instead of one per product-vineyard pair.

-- 1. Drop the existing product+vineyard unique constraint
ALTER TABLE public.vineyard_growing_profiles
  DROP CONSTRAINT IF EXISTS vineyard_growing_profiles_product_id_vineyard_id_key;

-- 2. Make product_id nullable (existing rows keep their values)
ALTER TABLE public.vineyard_growing_profiles
  ALTER COLUMN product_id DROP NOT NULL;

-- 3. Add new unique constraint: one profile per vineyard
ALTER TABLE public.vineyard_growing_profiles
  ADD CONSTRAINT vineyard_growing_profiles_vineyard_id_key UNIQUE(vineyard_id);
