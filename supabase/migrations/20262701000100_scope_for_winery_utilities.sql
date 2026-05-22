-- Map the new winery utility types to Scope 1 in get_scope_for_utility_type.
--
-- MUST be run as a SEPARATE execution AFTER 20262701000000 has committed -
-- the CASE below references enum labels added in that migration, which is only
-- legal once the ADD VALUE transaction has committed.
--
-- CREATE OR REPLACE is idempotent; the body is identical to the original
-- (initial_schema.sql) plus three new WHEN clauses.

CREATE OR REPLACE FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE p_utility_type
WHEN 'electricity_grid' THEN 'Scope 2'
WHEN 'heat_steam_purchased' THEN 'Scope 2'

WHEN 'natural_gas' THEN 'Scope 1'
WHEN 'lpg' THEN 'Scope 1'
WHEN 'diesel_stationary' THEN 'Scope 1'
WHEN 'heavy_fuel_oil' THEN 'Scope 1'
WHEN 'biomass_solid' THEN 'Scope 1'
WHEN 'refrigerant_leakage' THEN 'Scope 1'
WHEN 'diesel_mobile' THEN 'Scope 1'
WHEN 'petrol_mobile' THEN 'Scope 1'

WHEN 'co2_winemaking' THEN 'Scope 1'
WHEN 'diesel_agricultural' THEN 'Scope 1'
WHEN 'aviation_fuel' THEN 'Scope 1'

ELSE 'Unknown'
END;
END;
$$;

COMMENT ON FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") IS 'Maps utility type to Scope 1 or Scope 2 automatically';
