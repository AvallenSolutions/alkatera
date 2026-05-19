-- Add winery-specific Scope 1 utility types to utility_type_enum.
--
-- STANDALONE migration: a value added via ALTER TYPE ... ADD VALUE cannot be
-- referenced (e.g. in get_scope_for_utility_type's CASE) until the adding
-- transaction has committed. The scope-mapping function update therefore lives
-- in the follow-up migration 20262701000100, which must be run separately.
--
-- co2_winemaking      - purchased CO2 used in winemaking (blanketing, sparging,
--                        purging, carbonation). Direct Scope 1 process emission.
--                        Biogenic fermentation CO2 is excluded (GHG Protocol).
-- diesel_agricultural - red diesel / gas oil for off-road farm machinery.
-- aviation_fuel       - jet kerosene for company-owned aircraft (Scope 1).

ALTER TYPE "public"."utility_type_enum" ADD VALUE IF NOT EXISTS 'co2_winemaking';
ALTER TYPE "public"."utility_type_enum" ADD VALUE IF NOT EXISTS 'diesel_agricultural';
ALTER TYPE "public"."utility_type_enum" ADD VALUE IF NOT EXISTS 'aviation_fuel';
