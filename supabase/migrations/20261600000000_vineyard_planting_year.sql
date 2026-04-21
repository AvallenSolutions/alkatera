-- Add vine_planting_year to vineyards table
--
-- Vineyards are perennial crops; tracking when vines were planted (distinct from
-- when land was converted) enables:
--   1. Age-graduated pruning dry matter for more accurate crop residue N2O
--   2. Above-ground woody biomass carbon accumulation rate calculation
--   3. Data quality scoring improvements
--
-- vine_planting_year may differ from land_conversion_year when land was left
-- fallow between conversion and planting, or when old vines were pulled and
-- replanted on existing vineyard land.

ALTER TABLE vineyards
  ADD COLUMN IF NOT EXISTS vine_planting_year integer
    CHECK (vine_planting_year >= 1800 AND vine_planting_year <= EXTRACT(YEAR FROM now())::integer);

COMMENT ON COLUMN vineyards.vine_planting_year IS
  'Year vines were planted. Used for above-ground biomass carbon accumulation and age-graduated pruning DM calculations. May differ from land_conversion_year when land was fallow before planting or vines were replanted.';
