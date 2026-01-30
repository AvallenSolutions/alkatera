


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."allocation_basis_enum" AS ENUM (
    'physical_mass',
    'volume_proportion',
    'production_volume_ratio',
    'none'
);


ALTER TYPE "public"."allocation_basis_enum" OWNER TO "postgres";


CREATE TYPE "public"."approval_status_enum" AS ENUM (
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."approval_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."data_provenance_enum" AS ENUM (
    'primary_supplier_verified',
    'primary_measured_onsite',
    'secondary_modelled_industry_average',
    'secondary_calculated_allocation'
);


ALTER TYPE "public"."data_provenance_enum" OWNER TO "postgres";


CREATE TYPE "public"."data_quality_enum" AS ENUM (
    'actual',
    'estimated'
);


ALTER TYPE "public"."data_quality_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."data_quality_enum" IS 'Quality flag for utility data entries';



CREATE TYPE "public"."facility_activity_category_enum" AS ENUM (
    'utility_electricity',
    'utility_gas',
    'utility_fuel',
    'utility_other',
    'water_intake',
    'water_discharge',
    'water_recycled',
    'waste_general',
    'waste_hazardous',
    'waste_recycling'
);


ALTER TYPE "public"."facility_activity_category_enum" OWNER TO "postgres";


CREATE TYPE "public"."facility_data_source_type" AS ENUM (
    'Primary',
    'Secondary_Average'
);


ALTER TYPE "public"."facility_data_source_type" OWNER TO "postgres";


CREATE TYPE "public"."frequency_enum" AS ENUM (
    'monthly',
    'yearly'
);


ALTER TYPE "public"."frequency_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."frequency_enum" IS 'Reporting frequency for facility data contracts';



CREATE TYPE "public"."functional_unit_measure_enum" AS ENUM (
    'ml',
    'l'
);


ALTER TYPE "public"."functional_unit_measure_enum" OWNER TO "postgres";


CREATE TYPE "public"."functional_unit_type_enum" AS ENUM (
    'bottle',
    'can',
    'pack',
    'unit'
);


ALTER TYPE "public"."functional_unit_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."lca_report_status" AS ENUM (
    'draft',
    'published',
    'verified'
);


ALTER TYPE "public"."lca_report_status" OWNER TO "postgres";


CREATE TYPE "public"."material_category_type" AS ENUM (
    'SCOPE_1_2_ENERGY',
    'SCOPE_3_TRANSPORT',
    'SCOPE_3_COMMUTING',
    'MANUFACTURING_MATERIAL',
    'WASTE'
);


ALTER TYPE "public"."material_category_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."material_category_type" IS 'Categorizes materials for hybrid data resolution routing. Energy/transport/commuting use DEFRA GWP + Ecoinvent non-GWP. Manufacturing materials use full Ecoinvent or supplier data.';



CREATE TYPE "public"."operational_control_enum" AS ENUM (
    'owned',
    'third_party'
);


ALTER TYPE "public"."operational_control_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."operational_control_enum" IS 'Determines if facility data goes to Scope 1&2 or Scope 3';



CREATE TYPE "public"."organization_role" AS ENUM (
    'alkatera_admin',
    'company_admin',
    'company_user'
);


ALTER TYPE "public"."organization_role" OWNER TO "postgres";


CREATE TYPE "public"."production_volume_unit" AS ENUM (
    'Litres',
    'Hectolitres',
    'Units',
    'kg'
);


ALTER TYPE "public"."production_volume_unit" OWNER TO "postgres";


CREATE TYPE "public"."social_risk_level" AS ENUM (
    'low',
    'medium',
    'high',
    'critical'
);


ALTER TYPE "public"."social_risk_level" OWNER TO "postgres";


CREATE TYPE "public"."submission_attestation_level_enum" AS ENUM (
    'self_reported',
    'auditor_verified',
    'certified'
);


ALTER TYPE "public"."submission_attestation_level_enum" OWNER TO "postgres";


CREATE TYPE "public"."submission_verification_status_enum" AS ENUM (
    'pending',
    'accepted',
    'disputed',
    'rejected'
);


ALTER TYPE "public"."submission_verification_status_enum" OWNER TO "postgres";


CREATE TYPE "public"."supplier_engagement_status" AS ENUM (
    'invited',
    'active',
    'data_provided',
    'inactive'
);


ALTER TYPE "public"."supplier_engagement_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."supplier_engagement_status" IS 'Engagement status for suppliers: invited, active, data_provided, or inactive';



CREATE TYPE "public"."supplier_invitation_status" AS ENUM (
    'pending',
    'accepted',
    'expired',
    'cancelled'
);


ALTER TYPE "public"."supplier_invitation_status" OWNER TO "postgres";


COMMENT ON TYPE "public"."supplier_invitation_status" IS 'Status of supplier invitation: pending, accepted, expired, or cancelled';



CREATE TYPE "public"."system_boundary_enum" AS ENUM (
    'cradle_to_gate',
    'cradle_to_grave'
);


ALTER TYPE "public"."system_boundary_enum" OWNER TO "postgres";


CREATE TYPE "public"."utility_type_enum" AS ENUM (
    'electricity_grid',
    'heat_steam_purchased',
    'natural_gas',
    'lpg',
    'diesel_stationary',
    'heavy_fuel_oil',
    'biomass_solid',
    'refrigerant_leakage',
    'diesel_mobile',
    'petrol_mobile'
);


ALTER TYPE "public"."utility_type_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."utility_type_enum" IS 'Predefined utility types with automatic Scope 1/2 classification';



CREATE TYPE "public"."verification_status_enum" AS ENUM (
    'unverified',
    'verified',
    'rejected'
);


ALTER TYPE "public"."verification_status_enum" OWNER TO "postgres";


COMMENT ON TYPE "public"."verification_status_enum" IS 'Verification status for source documents in the data provenance trail. unverified = newly uploaded, verified = approved by authorised user, rejected = flagged as invalid or inappropriate.';



CREATE TYPE "public"."waste_category_enum" AS ENUM (
    'food_waste',
    'packaging_waste',
    'process_waste',
    'hazardous',
    'construction',
    'electronic',
    'other'
);


ALTER TYPE "public"."waste_category_enum" OWNER TO "postgres";


CREATE TYPE "public"."waste_treatment_method_enum" AS ENUM (
    'landfill',
    'recycling',
    'composting',
    'incineration_with_recovery',
    'incineration_without_recovery',
    'anaerobic_digestion',
    'reuse',
    'other'
);


ALTER TYPE "public"."waste_treatment_method_enum" OWNER TO "postgres";


CREATE TYPE "public"."wastewater_treatment_method_enum" AS ENUM (
    'primary_treatment',
    'secondary_treatment',
    'tertiary_treatment',
    'none',
    'unknown'
);


ALTER TYPE "public"."wastewater_treatment_method_enum" OWNER TO "postgres";


CREATE TYPE "public"."water_classification_enum" AS ENUM (
    'blue',
    'green',
    'grey'
);


ALTER TYPE "public"."water_classification_enum" OWNER TO "postgres";


CREATE TYPE "public"."water_source_type" AS ENUM (
    'municipal',
    'groundwater',
    'surface_water',
    'rainwater',
    'recycled',
    'seawater',
    'other'
);


ALTER TYPE "public"."water_source_type" OWNER TO "postgres";


COMMENT ON TYPE "public"."water_source_type" IS 'Types of water sources for facility consumption tracking';



CREATE TYPE "public"."water_source_type_enum" AS ENUM (
    'municipal',
    'groundwater',
    'surface_water',
    'recycled',
    'rainwater',
    'other'
);


ALTER TYPE "public"."water_source_type_enum" OWNER TO "postgres";


CREATE TYPE "public"."water_treatment_level" AS ENUM (
    'none',
    'primary',
    'secondary',
    'tertiary',
    'advanced'
);


ALTER TYPE "public"."water_treatment_level" OWNER TO "postgres";


COMMENT ON TYPE "public"."water_treatment_level" IS 'Discharge water treatment levels';



CREATE OR REPLACE FUNCTION "public"."add_user_to_platform_admin"("target_user_email" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_user_id uuid;
v_platform_org_id uuid;
v_profile_name text;
BEGIN
SELECT au.id, p.full_name
INTO v_user_id, v_profile_name
FROM auth.users au
LEFT JOIN profiles p ON p.id = au.id
WHERE au.email = target_user_email;

IF v_user_id IS NULL THEN
RAISE EXCEPTION 'User with email % not found', target_user_email;
END IF;

SELECT id INTO v_platform_org_id
FROM organizations
WHERE is_platform_admin = true
LIMIT 1;

IF v_platform_org_id IS NULL THEN
RAISE EXCEPTION 'No platform admin organization found';
END IF;

INSERT INTO organization_members (organization_id, user_id, role)
VALUES (v_platform_org_id, v_user_id, 'admin')
ON CONFLICT (organization_id, user_id) DO NOTHING;

RETURN json_build_object(
'success', true,
'user_id', v_user_id,
'user_email', target_user_email,
'user_name', v_profile_name,
'organization_id', v_platform_org_id,
'message', 'User added to platform admin organization'
);
END;
$$;


ALTER FUNCTION "public"."add_user_to_platform_admin"("target_user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
pending_record RECORD;
new_record_id UUID;
BEGIN
IF NOT can_approve_data() THEN
RAISE EXCEPTION 'Permission denied: User cannot approve data';
END IF;

SELECT * INTO pending_record
FROM public.pending_activity_data
WHERE id = p_pending_id
AND organization_id = get_current_organization_id()
AND approval_status = 'pending';

IF NOT FOUND THEN
RAISE EXCEPTION 'Pending record not found or already processed';
END IF;

INSERT INTO public.activity_data (
organization_id, user_id, name, category, quantity, unit, activity_date
) VALUES (
pending_record.organization_id,
pending_record.submitted_by,
pending_record.name,
pending_record.category,
pending_record.quantity,
pending_record.unit,
pending_record.activity_date
)
RETURNING id INTO new_record_id;

UPDATE public.pending_activity_data
SET approval_status = 'approved',
reviewed_by = auth.uid(),
reviewed_at = now(),
original_id = new_record_id
WHERE id = p_pending_id;

PERFORM create_notification(
pending_record.submitted_by,
pending_record.organization_id,
'approval',
'Data Approved',
'Your activity data submission "' || pending_record.name || '" has been approved.',
'activity_data',
new_record_id::text
);

PERFORM log_platform_activity('data_approved', 'approval_workflow');

RETURN new_record_id;
END;
$$;


ALTER FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") IS 'Approve pending activity data and copy to main table';



CREATE OR REPLACE FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
pending_record RECORD;
new_record_id UUID;
BEGIN
IF NOT can_approve_data() THEN
RAISE EXCEPTION 'Permission denied: User cannot approve data';
END IF;

SELECT * INTO pending_record
FROM public.pending_facilities
WHERE id = p_pending_id
AND organization_id = get_current_organization_id()
AND approval_status = 'pending';

IF NOT FOUND THEN
RAISE EXCEPTION 'Pending record not found or already processed';
END IF;

INSERT INTO public.facilities (
organization_id, name, location, facility_type, facility_type_id,
address, city, country, latitude, longitude, is_contract_manufacturer
) VALUES (
pending_record.organization_id,
pending_record.name,
pending_record.location,
pending_record.facility_type,
pending_record.facility_type_id,
pending_record.address,
pending_record.city,
pending_record.country,
pending_record.latitude,
pending_record.longitude,
pending_record.is_contract_manufacturer
)
RETURNING id INTO new_record_id;

UPDATE public.pending_facilities
SET approval_status = 'approved',
reviewed_by = auth.uid(),
reviewed_at = now(),
original_id = new_record_id
WHERE id = p_pending_id;

PERFORM create_notification(
pending_record.submitted_by,
pending_record.organization_id,
'approval',
'Facility Approved',
'Your facility submission "' || pending_record.name || '" has been approved.',
'facilities',
new_record_id::text
);

PERFORM log_platform_activity('facility_approved', 'approval_workflow');

RETURN new_record_id;
END;
$$;


ALTER FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") IS 'Approve pending facility and copy to main table';



CREATE OR REPLACE FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") RETURNS bigint
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
pending_record RECORD;
new_record_id BIGINT;
BEGIN
IF NOT can_approve_data() THEN
RAISE EXCEPTION 'Permission denied: User cannot approve data';
END IF;

SELECT * INTO pending_record
FROM public.pending_products
WHERE id = p_pending_id
AND organization_id = get_current_organization_id()
AND approval_status = 'pending';

IF NOT FOUND THEN
RAISE EXCEPTION 'Pending record not found or already processed';
END IF;

INSERT INTO public.products (
organization_id, name, product_description, product_image_url, sku,
functional_unit_type, functional_unit_volume, functional_unit_measure,
system_boundary, product_category, is_draft, created_by
) VALUES (
pending_record.organization_id,
pending_record.name,
pending_record.product_description,
pending_record.product_image_url,
pending_record.sku,
pending_record.functional_unit_type,
pending_record.functional_unit_volume,
pending_record.functional_unit_measure,
pending_record.system_boundary,
pending_record.product_category,
pending_record.is_draft,
pending_record.submitted_by
)
RETURNING id INTO new_record_id;

UPDATE public.pending_products
SET approval_status = 'approved',
reviewed_by = auth.uid(),
reviewed_at = now(),
original_id = new_record_id
WHERE id = p_pending_id;

PERFORM create_notification(
pending_record.submitted_by,
pending_record.organization_id,
'approval',
'Product Approved',
'Your product submission "' || pending_record.name || '" has been approved.',
'products',
new_record_id::text
);

PERFORM log_platform_activity('product_approved', 'approval_workflow');

RETURN new_record_id;
END;
$$;


ALTER FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") IS 'Approve pending product and copy to main table';



CREATE OR REPLACE FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
pending_record RECORD;
new_record_id UUID;
BEGIN
IF NOT can_approve_data() THEN
RAISE EXCEPTION 'Permission denied: User cannot approve data';
END IF;

SELECT * INTO pending_record
FROM public.pending_suppliers
WHERE id = p_pending_id
AND organization_id = get_current_organization_id()
AND approval_status = 'pending';

IF NOT FOUND THEN
RAISE EXCEPTION 'Pending record not found or already processed';
END IF;

INSERT INTO public.suppliers (
organization_id, name, contact_email, contact_name, phone,
website, address, city, country
) VALUES (
pending_record.organization_id,
pending_record.name,
pending_record.contact_email,
pending_record.contact_name,
pending_record.phone,
pending_record.website,
pending_record.address,
pending_record.city,
pending_record.country
)
RETURNING id INTO new_record_id;

UPDATE public.pending_suppliers
SET approval_status = 'approved',
reviewed_by = auth.uid(),
reviewed_at = now(),
original_id = new_record_id
WHERE id = p_pending_id;

PERFORM create_notification(
pending_record.submitted_by,
pending_record.organization_id,
'approval',
'Supplier Approved',
'Your supplier submission "' || pending_record.name || '" has been approved.',
'suppliers',
new_record_id::text
);

PERFORM log_platform_activity('supplier_approved', 'approval_workflow');

RETURN new_record_id;
END;
$$;


ALTER FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") IS 'Approve pending supplier and copy to main table';



CREATE OR REPLACE FUNCTION "public"."auto_calculate_fleet_activity_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_vehicle_scope TEXT;
v_fuel_type TEXT;
v_ownership_type TEXT;
BEGIN
IF NEW.vehicle_id IS NOT NULL THEN
SELECT calculated_scope INTO v_vehicle_scope
FROM vehicles WHERE id = NEW.vehicle_id;

IF v_vehicle_scope IS NOT NULL THEN
NEW.scope := v_vehicle_scope;
RETURN NEW;
END IF;
END IF;

v_fuel_type := COALESCE(NEW.manual_fuel_type, 'petrol');
v_ownership_type := COALESCE(NEW.manual_ownership_type, 'company_owned');

IF v_ownership_type IN ('company_owned', 'company_leased') THEN
IF v_fuel_type IN ('diesel', 'petrol', 'lpg', 'biodiesel', 'cng', 'hybrid_diesel', 'hybrid_petrol') THEN
NEW.scope := 'Scope 1';
ELSIF v_fuel_type = 'electric' THEN
NEW.scope := 'Scope 2';
ELSE
NEW.scope := 'Scope 1';
END IF;
ELSIF v_ownership_type IN ('employee_owned', 'rental') THEN
NEW.scope := 'Scope 3 Cat 6';
ELSE
NEW.scope := 'Scope 1';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_calculate_fleet_activity_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_calculate_vehicle_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.ownership_type IN ('company_owned', 'company_leased') THEN
IF NEW.propulsion_type IN ('ice', 'hybrid') AND 
NEW.fuel_type IN ('diesel', 'petrol', 'lpg', 'biodiesel', 'cng') THEN
NEW.calculated_scope := 'Scope 1';
ELSIF NEW.propulsion_type = 'bev' OR NEW.fuel_type = 'electric' THEN
NEW.calculated_scope := 'Scope 2';
ELSE
NEW.calculated_scope := 'Scope 1';
END IF;
ELSIF NEW.ownership_type IN ('employee_owned', 'rental') THEN
NEW.calculated_scope := 'Scope 3 Cat 6';
ELSE
NEW.calculated_scope := 'Scope 1';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_calculate_vehicle_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_tag_utility_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.calculated_scope := get_scope_for_utility_type(NEW.utility_type);
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_tag_utility_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."build_material_breakdown"("p_lca_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_materials jsonb;
BEGIN
SELECT jsonb_agg(
jsonb_build_object(
'name', COALESCE(material_name, name, 'Unknown Material'),
'category', COALESCE(material_type, 'ingredient'),
'quantity', COALESCE(quantity::float, 0),
'unit', COALESCE(unit, unit_name, 'kg'),
'emissions', COALESCE(impact_climate::float, 0),
'dataSource', COALESCE(data_source, 'secondary_modelled')
)
ORDER BY COALESCE(impact_climate::float, 0) DESC
)
INTO v_materials
FROM product_lca_materials
WHERE product_lca_id = p_lca_id
AND impact_climate IS NOT NULL
AND impact_climate::float > 0;

RETURN COALESCE(v_materials, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."build_material_breakdown"("p_lca_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
bulk_litres NUMERIC;
unit_litres NUMERIC;
BEGIN
bulk_litres := CASE 
WHEN LOWER(p_bulk_unit) = 'hectolitres' THEN p_bulk_volume * 100
WHEN LOWER(p_bulk_unit) = 'litres' THEN p_bulk_volume
WHEN LOWER(p_bulk_unit) = 'l' THEN p_bulk_volume
ELSE p_bulk_volume
END;

unit_litres := CASE
WHEN LOWER(p_unit_size_unit) = 'ml' THEN p_unit_size_value / 1000.0
WHEN LOWER(p_unit_size_unit) = 'l' THEN p_unit_size_value
WHEN LOWER(p_unit_size_unit) = 'litres' THEN p_unit_size_value
ELSE p_unit_size_value
END;

IF unit_litres > 0 THEN
RETURN bulk_litres / unit_litres;
ELSE
RETURN NULL;
END IF;
END;
$$;


ALTER FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") IS 'Convert bulk volume (hectolitres/litres) to number of consumer units (bottles/cans) based on product unit size';



CREATE OR REPLACE FUNCTION "public"."calculate_allocation_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.total_facility_production_volume > 0 THEN
NEW.attribution_ratio := NEW.client_production_volume / NEW.total_facility_production_volume;
ELSE
NEW.attribution_ratio := 0;
END IF;

NEW.allocated_emissions_kg_co2e := NEW.total_facility_co2e_kg * NEW.attribution_ratio;

IF NEW.scope1_emissions_kg_co2e IS NULL OR NEW.scope1_emissions_kg_co2e = 0 THEN
NEW.scope1_emissions_kg_co2e := NEW.allocated_emissions_kg_co2e * 0.35;
END IF;

IF NEW.scope2_emissions_kg_co2e IS NULL OR NEW.scope2_emissions_kg_co2e = 0 THEN
NEW.scope2_emissions_kg_co2e := NEW.allocated_emissions_kg_co2e * 0.65;
END IF;

IF NEW.scope3_emissions_kg_co2e IS NULL THEN
NEW.scope3_emissions_kg_co2e := 0;
END IF;

IF NEW.client_production_volume > 0 THEN
NEW.emission_intensity_kg_co2e_per_unit := NEW.allocated_emissions_kg_co2e / NEW.client_production_volume;
ELSE
NEW.emission_intensity_kg_co2e_per_unit := 0;
END IF;

IF NEW.is_energy_intensive_process = true AND NEW.status = 'draft' THEN
NEW.status := 'provisional';
END IF;

IF NEW.is_energy_intensive_process = false AND NEW.status = 'draft' AND NEW.locked_at IS NOT NULL THEN
NEW.status := 'verified';
END IF;

NEW.calculation_metadata := jsonb_build_object(
'calculation_timestamp', now(),
'formula', 'allocated_emissions = total_facility_co2e * (client_volume / total_volume)',
'inputs', jsonb_build_object(
'total_facility_co2e_kg', NEW.total_facility_co2e_kg,
'total_facility_production_volume', NEW.total_facility_production_volume,
'client_production_volume', NEW.client_production_volume,
'production_volume_unit', NEW.production_volume_unit
),
'outputs', jsonb_build_object(
'attribution_ratio', NEW.attribution_ratio,
'allocated_emissions_kg_co2e', NEW.allocated_emissions_kg_co2e,
'emission_intensity_kg_co2e_per_unit', NEW.emission_intensity_kg_co2e_per_unit,
'scope1_emissions_kg_co2e', NEW.scope1_emissions_kg_co2e,
'scope2_emissions_kg_co2e', NEW.scope2_emissions_kg_co2e,
'scope3_emissions_kg_co2e', NEW.scope3_emissions_kg_co2e
),
'emission_factor_metadata', jsonb_build_object(
'year', NEW.emission_factor_year,
'source', NEW.emission_factor_source,
'entry_method', NEW.co2e_entry_method
)
);

NEW.updated_at := now();

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_allocation_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS TABLE("co2e_kg" numeric, "emission_factor_used" numeric, "emission_factor_unit" "text", "emission_factor_year" integer, "emission_factor_source" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_factor RECORD;
BEGIN
SELECT * INTO v_factor
FROM get_defra_energy_factor(p_fuel_type, p_factor_year);

IF v_factor IS NULL THEN
RAISE EXCEPTION 'No emission factor found for fuel type: %', p_fuel_type;
END IF;

RETURN QUERY
SELECT 
p_consumption_value * v_factor.co2e_factor AS co2e_kg,
v_factor.co2e_factor AS emission_factor_used,
v_factor.factor_unit AS emission_factor_unit,
v_factor.factor_year AS emission_factor_year,
v_factor.source AS emission_factor_source;
END;
$$;


ALTER FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer) IS 'Calculates CO2e from energy consumption using DEFRA factors. Returns calculated CO2e and full factor metadata for audit trail.';



CREATE OR REPLACE FUNCTION "public"."calculate_facility_intensity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.data_source_type = 'Primary' AND NEW.total_production_volume IS NOT NULL AND NEW.total_production_volume > 0 THEN
NEW.calculated_intensity := NEW.total_co2e / NEW.total_production_volume;
END IF;

IF NEW.data_source_type = 'Secondary_Average' AND NEW.fallback_intensity_factor IS NOT NULL THEN
NEW.calculated_intensity := NEW.fallback_intensity_factor;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_facility_intensity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
v_year_start date;
v_year_end date;
v_scope1 numeric := 0;
v_scope2 numeric := 0;
v_scope3_products numeric := 0;
v_scope3_business_travel numeric := 0;
v_scope3_purchased_services numeric := 0;
v_scope3_employee_commuting numeric := 0;
v_scope3_capital_goods numeric := 0;
v_scope3_operational_waste numeric := 0;
v_scope3_downstream_logistics numeric := 0;
v_scope3_marketing_materials numeric := 0;
v_scope3_total numeric := 0;
v_total numeric := 0;
v_has_data boolean := false;
v_report_id uuid;
v_result jsonb;
rec RECORD;
BEGIN
v_year_start := make_date(p_year, 1, 1);
v_year_end := make_date(p_year, 12, 31);


FOR rec IN
SELECT 
fad.quantity,
ef.value::numeric as factor_value
FROM facility_activity_data fad
JOIN scope_1_2_emission_sources ses ON fad.emission_source_id = ses.id
JOIN emissions_factors ef ON ses.emission_factor_id = ef.factor_id
WHERE fad.organization_id = p_organization_id
AND ses.scope = 'Scope 1'
AND fad.reporting_period_start >= v_year_start
AND fad.reporting_period_end <= v_year_end
AND fad.quantity IS NOT NULL
AND ef.value IS NOT NULL
LOOP
v_scope1 := v_scope1 + (rec.quantity * rec.factor_value);
v_has_data := true;
END LOOP;

FOR rec IN
SELECT emissions_tco2e
FROM fleet_activities
WHERE organization_id = p_organization_id
AND scope = 'Scope 1'
AND reporting_period_start >= v_year_start
AND reporting_period_end <= v_year_end
LOOP
v_scope1 := v_scope1 + (COALESCE(rec.emissions_tco2e, 0) * 1000);
v_has_data := true;
END LOOP;


FOR rec IN
SELECT 
fad.quantity,
ef.value::numeric as factor_value
FROM facility_activity_data fad
JOIN scope_1_2_emission_sources ses ON fad.emission_source_id = ses.id
JOIN emissions_factors ef ON ses.emission_factor_id = ef.factor_id
WHERE fad.organization_id = p_organization_id
AND ses.scope = 'Scope 2'
AND fad.reporting_period_start >= v_year_start
AND fad.reporting_period_end <= v_year_end
AND fad.quantity IS NOT NULL
AND ef.value IS NOT NULL
LOOP
v_scope2 := v_scope2 + (rec.quantity * rec.factor_value);
v_has_data := true;
END LOOP;

FOR rec IN
SELECT emissions_tco2e
FROM fleet_activities
WHERE organization_id = p_organization_id
AND scope = 'Scope 2'
AND reporting_period_start >= v_year_start
AND reporting_period_end <= v_year_end
LOOP
v_scope2 := v_scope2 + (COALESCE(rec.emissions_tco2e, 0) * 1000);
v_has_data := true;
END LOOP;


FOR rec IN
WITH latest_lcas AS (
SELECT DISTINCT ON (product_id)
product_id,
(aggregated_impacts->'breakdown'->'by_scope'->>'scope3')::numeric as scope3_per_unit
FROM product_lcas
WHERE organization_id = p_organization_id
AND status = 'completed'
AND aggregated_impacts->'breakdown'->'by_scope'->>'scope3' IS NOT NULL
ORDER BY product_id, updated_at DESC
)
SELECT 
pl.units_produced,
ll.scope3_per_unit
FROM production_logs pl
JOIN latest_lcas ll ON ll.product_id = pl.product_id
WHERE pl.organization_id = p_organization_id
AND pl.date >= v_year_start
AND pl.date <= v_year_end
AND pl.units_produced > 0
LOOP
v_scope3_products := v_scope3_products + (COALESCE(rec.scope3_per_unit, 0) * rec.units_produced);
v_has_data := true;
END LOOP;


SELECT id INTO v_report_id
FROM corporate_reports
WHERE organization_id = p_organization_id
AND year = p_year
LIMIT 1;

IF v_report_id IS NOT NULL THEN
FOR rec IN
SELECT category, computed_co2e, material_type
FROM corporate_overheads
WHERE report_id = v_report_id
LOOP
v_has_data := true;

CASE rec.category
WHEN 'business_travel' THEN
v_scope3_business_travel := v_scope3_business_travel + COALESCE(rec.computed_co2e, 0);
WHEN 'employee_commuting' THEN
v_scope3_employee_commuting := v_scope3_employee_commuting + COALESCE(rec.computed_co2e, 0);
WHEN 'capital_goods' THEN
v_scope3_capital_goods := v_scope3_capital_goods + COALESCE(rec.computed_co2e, 0);
WHEN 'operational_waste' THEN
v_scope3_operational_waste := v_scope3_operational_waste + COALESCE(rec.computed_co2e, 0);
WHEN 'downstream_logistics' THEN
v_scope3_downstream_logistics := v_scope3_downstream_logistics + COALESCE(rec.computed_co2e, 0);
WHEN 'purchased_services' THEN
IF rec.material_type IS NOT NULL THEN
v_scope3_marketing_materials := v_scope3_marketing_materials + COALESCE(rec.computed_co2e, 0);
ELSE
v_scope3_purchased_services := v_scope3_purchased_services + COALESCE(rec.computed_co2e, 0);
END IF;
ELSE
v_scope3_purchased_services := v_scope3_purchased_services + COALESCE(rec.computed_co2e, 0);
END CASE;
END LOOP;
END IF;

FOR rec IN
SELECT emissions_tco2e
FROM fleet_activities
WHERE organization_id = p_organization_id
AND scope = 'Scope 3 Cat 6'
AND reporting_period_start >= v_year_start
AND reporting_period_end <= v_year_end
LOOP
v_scope3_business_travel := v_scope3_business_travel + (COALESCE(rec.emissions_tco2e, 0) * 1000);
v_has_data := true;
END LOOP;

v_scope3_total := v_scope3_products + v_scope3_business_travel + v_scope3_purchased_services +
v_scope3_employee_commuting + v_scope3_capital_goods + v_scope3_operational_waste +
v_scope3_downstream_logistics + v_scope3_marketing_materials;

v_total := v_scope1 + v_scope2 + v_scope3_total;

v_result := jsonb_build_object(
'year', p_year,
'breakdown', jsonb_build_object(
'scope1', ROUND(v_scope1, 2),
'scope2', ROUND(v_scope2, 2),
'scope3', jsonb_build_object(
'products', ROUND(v_scope3_products, 2),
'business_travel', ROUND(v_scope3_business_travel, 2),
'purchased_services', ROUND(v_scope3_purchased_services, 2),
'employee_commuting', ROUND(v_scope3_employee_commuting, 2),
'capital_goods', ROUND(v_scope3_capital_goods, 2),
'operational_waste', ROUND(v_scope3_operational_waste, 2),
'downstream_logistics', ROUND(v_scope3_downstream_logistics, 2),
'marketing_materials', ROUND(v_scope3_marketing_materials, 2),
'logistics', ROUND(v_scope3_downstream_logistics, 2),
'waste', ROUND(v_scope3_operational_waste, 2),
'marketing', ROUND(v_scope3_marketing_materials, 2),
'total', ROUND(v_scope3_total, 2)
),
'total', ROUND(v_total, 2)
),
'has_data', v_has_data,
'calculation_date', NOW(),
'methodology', 'GHG Protocol Corporate Standard',
'data_source', 'calculate_gaia_corporate_emissions'
);

RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) IS 'Authoritative corporate emissions calculation for Gaia AI assistant. 
Uses DISTINCT ON to get only the latest LCA per product, matching frontend behaviour.
Returns complete scope breakdown following GHG Protocol.';



CREATE OR REPLACE FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date" DEFAULT NULL::"date", "p_reporting_period_end" "date" DEFAULT NULL::"date") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
total_emissions NUMERIC;
total_units NUMERIC;
intensity NUMERIC;
BEGIN
SELECT 
COALESCE(SUM(fea.total_co2e), 0),
COALESCE(SUM(fea.units_produced), 0)
INTO total_emissions, total_units
FROM public.facility_emissions_aggregated fea
WHERE fea.facility_id = p_facility_id
AND (p_reporting_period_start IS NULL OR fea.reporting_period_start >= p_reporting_period_start)
AND (p_reporting_period_end IS NULL OR fea.reporting_period_end <= p_reporting_period_end);

IF total_units > 0 THEN
intensity := total_emissions / total_units;
ELSE
intensity := 0;
END IF;

RETURN intensity;
END;
$$;


ALTER FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date", "p_reporting_period_end" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date", "p_reporting_period_end" "date") IS 'Calculate emission intensity per consumer unit for a facility based on total emissions and units produced';



CREATE OR REPLACE FUNCTION "public"."calculate_production_site_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_volume NUMERIC;
  facility_calculated_intensity NUMERIC;
  facility_data_source TEXT;
BEGIN
  SELECT COALESCE(SUM(production_volume), 0) INTO total_volume
  FROM public.product_carbon_footprint_production_sites
  WHERE product_carbon_footprint_id = NEW.product_carbon_footprint_id;

  IF total_volume > 0 THEN
    NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
  ELSE
    NEW.share_of_production := 0;
  END IF;

  SELECT fea.calculated_intensity,
    CASE WHEN fea.data_source_type = 'Primary' THEN 'Verified' ELSE 'Industry_Average' END
  INTO facility_calculated_intensity, facility_data_source
  FROM public.facility_emissions_aggregated fea
  WHERE fea.facility_id = NEW.facility_id
  ORDER BY fea.reporting_year DESC, fea.reporting_period DESC
  LIMIT 1;

  NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
  NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');
  NEW.attributable_emissions_per_unit := NEW.facility_intensity;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_production_site_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_provenance_confidence_score"("provenance" "public"."data_provenance_enum") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE provenance
WHEN 'primary_supplier_verified' THEN 95
WHEN 'primary_measured_onsite' THEN 90
WHEN 'secondary_calculated_allocation' THEN 70
WHEN 'secondary_modelled_industry_average' THEN 50
ELSE 30
END;
END;
$$;


ALTER FUNCTION "public"."calculate_provenance_confidence_score"("provenance" "public"."data_provenance_enum") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_read_time"("content" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  word_count integer;
  minutes integer;
BEGIN
  word_count := array_length(regexp_split_to_array(content, '\s+'), 1);
  minutes := GREATEST(1, ROUND(word_count / 200.0));
  RETURN minutes || ' min read';
END;
$$;


ALTER FUNCTION "public"."calculate_read_time"("content" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_units_from_volume"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
product_unit_size NUMERIC;
product_unit TEXT;
BEGIN
IF NEW.units_produced IS NULL AND NEW.volume IS NOT NULL AND NEW.product_id IS NOT NULL THEN
SELECT unit_size_value, unit_size_unit
INTO product_unit_size, product_unit
FROM public.products
WHERE id = NEW.product_id;

IF product_unit_size IS NOT NULL THEN
NEW.units_produced := public.bulk_volume_to_units(
NEW.volume,
NEW.unit,
product_unit_size,
product_unit
);

IF NEW.volume > 0 THEN
NEW.conversion_factor := NEW.units_produced / NEW.volume;
END IF;
END IF;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_units_from_volume"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."calculate_units_from_volume"() IS 'Auto-calculate units_produced from bulk volume when production log is created/updated';



CREATE OR REPLACE FUNCTION "public"."can_approve_data"("org_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
RETURN has_permission('data.approve', org_id);
END;
$$;


ALTER FUNCTION "public"."can_approve_data"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_approve_data"("org_id" "uuid") IS 'Check if user can approve or reject pending data submissions';



CREATE OR REPLACE FUNCTION "public"."can_submit_directly"("org_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
RETURN has_permission('data.submit_direct', org_id);
END;
$$;


ALTER FUNCTION "public"."can_submit_directly"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."can_submit_directly"("org_id" "uuid") IS 'Check if user can submit data directly without approval (admins) or needs approval (members)';



CREATE OR REPLACE FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_status TEXT;
v_features JSONB;
v_has_access BOOLEAN;
BEGIN
SELECT subscription_tier, subscription_status
INTO v_tier, v_status
FROM public.organizations
WHERE id = p_organization_id;

IF v_tier IS NULL THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Organization not found',
'tier', null
);
END IF;

IF v_status NOT IN ('active', 'trial') THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Subscription is ' || v_status,
'tier', v_tier
);
END IF;

SELECT features_enabled INTO v_features
FROM public.subscription_tier_limits
WHERE tier_name = v_tier;

v_has_access := v_features ? p_feature_code;

RETURN jsonb_build_object(
'allowed', v_has_access,
'reason', CASE WHEN v_has_access THEN null ELSE 'Feature not available in ' || v_tier || ' tier' END,
'tier', v_tier,
'feature', p_feature_code
);
END;
$$;


ALTER FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_status TEXT;
v_current_count INTEGER;
v_max_count INTEGER;
v_can_create BOOLEAN;
BEGIN
SELECT subscription_tier, subscription_status, current_lca_count
INTO v_tier, v_status, v_current_count
FROM public.organizations
WHERE id = p_organization_id;

IF v_tier IS NULL THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Organization not found',
'current_count', 0,
'max_count', 0
);
END IF;

IF v_status NOT IN ('active', 'trial') THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Subscription is ' || v_status,
'current_count', v_current_count,
'max_count', 0
);
END IF;

SELECT max_lcas INTO v_max_count
FROM public.subscription_tier_limits
WHERE tier_name = v_tier;

v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

RETURN jsonb_build_object(
'allowed', v_can_create,
'reason', CASE 
WHEN v_can_create THEN null 
ELSE 'LCA limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more LCAs.'
END,
'current_count', v_current_count,
'max_count', v_max_count,
'tier', v_tier,
'is_unlimited', v_max_count IS NULL
);
END;
$$;


ALTER FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_status TEXT;
v_has_access BOOLEAN;
BEGIN
SELECT subscription_tier, subscription_status
INTO v_tier, v_status
FROM public.organizations
WHERE id = p_organization_id;

IF v_tier IS NULL THEN
RETURN false;
END IF;

IF v_status != 'active' AND v_status != 'trial' THEN
RETURN false;
END IF;

SELECT enabled INTO v_has_access
FROM public.subscription_tier_features
WHERE tier_name = v_tier
AND feature_code = p_methodology;

RETURN COALESCE(v_has_access, false);
END;
$$;


ALTER FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") IS 'Checks if an organization has access to a specific LCA methodology based on their subscription tier.';



CREATE OR REPLACE FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_status TEXT;
v_current_count INTEGER;
v_max_count INTEGER;
v_can_create BOOLEAN;
BEGIN
SELECT subscription_tier, subscription_status, current_product_count
INTO v_tier, v_status, v_current_count
FROM public.organizations
WHERE id = p_organization_id;

IF v_tier IS NULL THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Organization not found',
'current_count', 0,
'max_count', 0
);
END IF;

IF v_status NOT IN ('active', 'trial') THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Subscription is ' || v_status,
'current_count', v_current_count,
'max_count', 0
);
END IF;

SELECT max_products INTO v_max_count
FROM public.subscription_tier_limits
WHERE tier_name = v_tier;

v_can_create := v_max_count IS NULL OR v_current_count < v_max_count;

RETURN jsonb_build_object(
'allowed', v_can_create,
'reason', CASE 
WHEN v_can_create THEN null 
ELSE 'Product limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade to create more products.'
END,
'current_count', v_current_count,
'max_count', v_max_count,
'tier', v_tier,
'is_unlimited', v_max_count IS NULL
);
END;
$$;


ALTER FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_status TEXT;
v_current_count INTEGER;
v_max_count INTEGER;
v_reset_at TIMESTAMPTZ;
v_can_generate BOOLEAN;
BEGIN
SELECT subscription_tier, subscription_status, current_report_count_monthly, report_count_reset_at
INTO v_tier, v_status, v_current_count, v_reset_at
FROM public.organizations
WHERE id = p_organization_id;

IF v_tier IS NULL THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Organization not found',
'current_count', 0,
'max_count', 0
);
END IF;

IF v_reset_at IS NULL OR v_reset_at < date_trunc('month', now()) THEN
UPDATE public.organizations
SET current_report_count_monthly = 0,
report_count_reset_at = date_trunc('month', now())
WHERE id = p_organization_id;
v_current_count := 0;
END IF;

IF v_status NOT IN ('active', 'trial') THEN
RETURN jsonb_build_object(
'allowed', false,
'reason', 'Subscription is ' || v_status,
'current_count', v_current_count,
'max_count', 0
);
END IF;

SELECT max_reports_per_month INTO v_max_count
FROM public.subscription_tier_limits
WHERE tier_name = v_tier;

v_can_generate := v_max_count IS NULL OR v_current_count < v_max_count;

RETURN jsonb_build_object(
'allowed', v_can_generate,
'reason', CASE 
WHEN v_can_generate THEN null 
ELSE 'Monthly report limit reached (' || v_current_count || '/' || v_max_count || '). Upgrade for more reports.'
END,
'current_count', v_current_count,
'max_count', v_max_count,
'tier', v_tier,
'is_unlimited', v_max_count IS NULL,
'resets_at', date_trunc('month', now()) + interval '1 month'
);
END;
$$;


ALTER FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cleanup_openlca_cache"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
DELETE FROM public.openlca_process_cache
WHERE created_at < (now() - interval '24 hours');
END;
$$;


ALTER FUNCTION "public"."cleanup_openlca_cache"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text" DEFAULT NULL::"text", "p_error_details" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_job RECORD;
v_new_status TEXT;
BEGIN
SELECT * INTO v_job
FROM public.lca_recalculation_queue
WHERE id = p_queue_id;

IF v_job IS NULL THEN
RETURN;
END IF;

IF p_success THEN
v_new_status := 'completed';
ELSIF v_job.attempt_count >= v_job.max_attempts THEN
v_new_status := 'failed';
ELSE
v_new_status := 'pending';
END IF;

UPDATE public.lca_recalculation_queue
SET 
status = v_new_status,
processing_completed_at = CASE WHEN p_success OR v_new_status = 'failed' THEN now() ELSE NULL END,
last_error = p_error,
error_details = p_error_details,
next_retry_at = CASE 
WHEN v_new_status = 'pending' THEN now() + (v_job.attempt_count * INTERVAL '5 minutes')
ELSE NULL 
END,
updated_at = now()
WHERE id = p_queue_id;

UPDATE public.product_lcas
SET 
ef31_recalculation_status = v_new_status,
ef31_recalculation_error = p_error,
ef31_recalculation_attempts = v_job.attempt_count
WHERE id = v_job.product_lca_id;

IF v_job.batch_id IS NOT NULL THEN
UPDATE public.lca_recalculation_batches
SET 
completed_jobs = completed_jobs + CASE WHEN p_success THEN 1 ELSE 0 END,
failed_jobs = failed_jobs + CASE WHEN NOT p_success AND v_new_status = 'failed' THEN 1 ELSE 0 END,
error_summary = CASE 
WHEN NOT p_success THEN error_summary || jsonb_build_object('lca_id', v_job.product_lca_id, 'error', p_error)
ELSE error_summary 
END,
updated_at = now()
WHERE id = v_job.batch_id;

UPDATE public.lca_recalculation_batches
SET 
status = CASE 
WHEN completed_jobs + failed_jobs >= total_jobs THEN 
CASE WHEN failed_jobs > 0 THEN 'completed' ELSE 'completed' END
ELSE status 
END,
processing_completed_at = CASE 
WHEN completed_jobs + failed_jobs >= total_jobs THEN now()
ELSE NULL 
END
WHERE id = v_job.batch_id;
END IF;
END;
$$;


ALTER FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text", "p_error_details" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text", "p_error_details" "jsonb") IS 'Marks a recalculation job as completed or failed, with retry logic and batch updates.';



CREATE OR REPLACE FUNCTION "public"."create_facility"("p_name" "text", "p_facility_type" "text", "p_country" "text", "p_address" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_data_source_type" "text" DEFAULT 'internal'::"text", "p_supplier_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_organization_id uuid;
  v_facility_type_id uuid;
  v_new_facility_id uuid;
  v_result json;
BEGIN
  -- Get the organization_id for the current user
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;

  -- Validate input
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Facility name is required';
  END IF;

  IF p_country IS NULL OR trim(p_country) = '' THEN
    RAISE EXCEPTION 'Country is required';
  END IF;

  IF p_data_source_type NOT IN ('internal', 'supplier_managed') THEN
    RAISE EXCEPTION 'Invalid data source type';
  END IF;

  -- Get or create facility type
  IF p_facility_type IS NOT NULL AND trim(p_facility_type) != '' THEN
    SELECT id INTO v_facility_type_id
    FROM facility_types
    WHERE name = p_facility_type
      AND organization_id = v_organization_id;

    IF v_facility_type_id IS NULL THEN
      INSERT INTO facility_types (name, organization_id)
      VALUES (p_facility_type, v_organization_id)
      RETURNING id INTO v_facility_type_id;
    END IF;
  END IF;

  -- Insert new facility
  INSERT INTO facilities (
    name,
    address,
    city,
    country,
    facility_type_id,
    data_source_type,
    supplier_id,
    organization_id,
    created_at,
    updated_at
  )
  VALUES (
    trim(p_name),
    CASE WHEN p_address IS NOT NULL THEN trim(p_address) ELSE NULL END,
    CASE WHEN p_city IS NOT NULL THEN trim(p_city) ELSE NULL END,
    trim(p_country),
    v_facility_type_id,
    p_data_source_type,
    p_supplier_id,
    v_organization_id,
    now(),
    now()
  )
  RETURNING id INTO v_new_facility_id;

  -- Return the created facility details
  SELECT json_build_object(
    'id', v_new_facility_id,
    'name', p_name,
    'success', true
  )
  INTO v_result;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_facility"("p_name" "text", "p_facility_type" "text", "p_country" "text", "p_address" "text", "p_city" "text", "p_data_source_type" "text", "p_supplier_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_org_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text" DEFAULT NULL::"text", "p_entity_id" "text" DEFAULT NULL::"text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
notification_id UUID;
BEGIN
INSERT INTO public.user_notifications (
user_id, organization_id, notification_type, title, message,
entity_type, entity_id, metadata
) VALUES (
p_user_id, p_org_id, p_type, p_title, p_message,
p_entity_type, p_entity_id, p_metadata
)
RETURNING id INTO notification_id;

RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_org_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_lca_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
UPDATE public.organizations
SET current_lca_count = GREATEST(0, current_lca_count - 1)
WHERE id = OLD.organization_id;
RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_lca_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decrement_product_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
UPDATE public.organizations
SET current_product_count = GREATEST(0, current_product_count - 1)
WHERE id = OLD.organization_id;
RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."decrement_product_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."detect_material_category"("material_name" "text") RETURNS "public"."material_category_type"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
material_name := LOWER(TRIM(material_name));

IF material_name LIKE ANY (ARRAY[
'%electricity%', '%natural gas%', '%grid%', '%power%',
'%coal%', '%diesel%combustion%', '%petrol%combustion%',
'%heating oil%', '%lpg%', '%biomass%'
]) THEN
RETURN 'SCOPE_1_2_ENERGY'::material_category_type;
END IF;

IF material_name LIKE ANY (ARRAY[
'%freight%', '%hgv%', '%truck%', '%lorry%',
'%container ship%', '%cargo%', '%rail freight%',
'%air freight%', '%delivery%', '%logistics%',
'%tonne-km%', '%tkm%', '%van%delivery%'
]) THEN
RETURN 'SCOPE_3_TRANSPORT'::material_category_type;
END IF;

IF material_name LIKE ANY (ARRAY[
'%passenger car%', '%commuting%', '%employee travel%',
'%bus%passenger%', '%rail%passenger%', '%metro%',
'%taxi%', '%motorcycle%', '%bicycle%',
'%air travel%domestic%', '%air travel%international%'
]) THEN
RETURN 'SCOPE_3_COMMUTING'::material_category_type;
END IF;

IF material_name LIKE ANY (ARRAY[
'%waste%', '%recycling%', '%landfill%', '%incineration%',
'%composting%', '%anaerobic digestion%', '%wastewater%'
]) THEN
RETURN 'WASTE'::material_category_type;
END IF;

RETURN 'MANUFACTURING_MATERIAL'::material_category_type;
END;
$$;


ALTER FUNCTION "public"."detect_material_category"("material_name" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."detect_material_category"("material_name" "text") IS 'Auto-detects material category based on name for data source routing';



CREATE OR REPLACE FUNCTION "public"."disable_product_passport"("p_product_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_org_id UUID;
BEGIN
SELECT products.organization_id INTO v_org_id
FROM products
JOIN organization_members ON products.organization_id = organization_members.organization_id
WHERE products.id = p_product_id
AND organization_members.user_id = auth.uid();

IF v_org_id IS NULL THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Product not found or access denied'
);
END IF;

UPDATE products
SET passport_enabled = false
WHERE id = p_product_id;

RETURN jsonb_build_object(
'success', true
);
END;
$$;


ALTER FUNCTION "public"."disable_product_passport"("p_product_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."disable_product_passport"("p_product_id" bigint) IS 'Disables product passport. Token is retained for potential re-enabling.';



CREATE OR REPLACE FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid" DEFAULT NULL::"uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
v_total_score NUMERIC := 0;
v_category RECORD;
v_impact_value NUMERIC;
v_normalised_value NUMERIC;
v_weighted_value NUMERIC;
v_weighting_set UUID;
BEGIN
IF p_weighting_set_id IS NOT NULL THEN
v_weighting_set := p_weighting_set_id;
ELSE
SELECT id INTO v_weighting_set
FROM public.ef31_weighting_sets
WHERE is_default = true
LIMIT 1;
END IF;

FOR v_category IN
SELECT 
ic.code,
wf.weighting_factor,
nf.normalisation_value
FROM public.ef31_impact_categories ic
JOIN public.ef31_weighting_factors wf ON wf.impact_category_code = ic.code AND wf.weighting_set_id = v_weighting_set
JOIN public.ef31_normalisation_factors nf ON nf.impact_category_code = ic.code
LOOP
v_impact_value := (p_impacts->>v_category.code)::NUMERIC;

IF v_impact_value IS NOT NULL AND v_category.normalisation_value > 0 THEN
v_normalised_value := v_impact_value / v_category.normalisation_value;
v_weighted_value := v_normalised_value * v_category.weighting_factor;
v_total_score := v_total_score + v_weighted_value;
END IF;
END LOOP;

RETURN v_total_score;
END;
$$;


ALTER FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid") IS 'Calculates EF 3.1 single score from JSONB impacts using normalisation and weighting factors.';



CREATE OR REPLACE FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
v_normalisation_value NUMERIC;
BEGIN
SELECT normalisation_value INTO v_normalisation_value
FROM public.ef31_normalisation_factors
WHERE impact_category_code = p_impact_category_code
AND reference_region = 'EU27+1'
AND reference_year = 2010;

IF v_normalisation_value IS NULL OR v_normalisation_value = 0 THEN
RETURN NULL;
END IF;

RETURN p_impact_value / v_normalisation_value;
END;
$$;


ALTER FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) IS 'Normalises an EF 3.1 impact value to person-year equivalent using EU27 2010 reference.';



CREATE OR REPLACE FUNCTION "public"."enable_product_passport"("p_product_id" bigint) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_token TEXT;
v_org_id UUID;
BEGIN
SELECT products.organization_id INTO v_org_id
FROM products
JOIN organization_members ON products.organization_id = organization_members.organization_id
WHERE products.id = p_product_id
AND organization_members.user_id = auth.uid();

IF v_org_id IS NULL THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Product not found or access denied'
);
END IF;

SELECT passport_token INTO v_token
FROM products
WHERE id = p_product_id;

IF v_token IS NULL THEN
v_token := generate_passport_token();
END IF;

UPDATE products
SET 
passport_enabled = true,
passport_token = v_token
WHERE id = p_product_id;

RETURN jsonb_build_object(
'success', true,
'token', v_token
);
END;
$$;


ALTER FUNCTION "public"."enable_product_passport"("p_product_id" bigint) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."enable_product_passport"("p_product_id" bigint) IS 'Enables product passport and generates token. Only accessible by organization members.';



CREATE OR REPLACE FUNCTION "public"."escalate_old_tickets"() RETURNS TABLE("escalated_count" integer, "escalated_tickets" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_escalated_count INTEGER := 0;
  v_escalated_ids UUID[] := ARRAY[]::UUID[];
  v_ticket RECORD;
  v_days_old INTEGER;
  v_new_priority TEXT;
  v_old_priority TEXT;
BEGIN
  FOR v_ticket IN
    SELECT
      ft.id,
      ft.priority,
      ft.created_at,
      ft.status,
      ft.title,
      ft.organization_id,
      EXTRACT(DAY FROM (now() - ft.created_at))::INTEGER as days_old,
      ft.last_escalation_at
    FROM public.feedback_tickets ft
    WHERE ft.status NOT IN ('resolved', 'closed')
      AND ft.created_at < (now() - interval '7 days')
      AND (ft.last_escalation_at IS NULL OR ft.last_escalation_at < (now() - interval '1 day'))
  LOOP
    v_days_old := v_ticket.days_old;
    v_old_priority := v_ticket.priority;

    v_new_priority := CASE
      WHEN v_days_old >= 21 THEN 'critical'
      WHEN v_days_old >= 14 THEN 'high'
      WHEN v_days_old >= 7 THEN 'medium'
      ELSE v_old_priority
    END;

    IF v_new_priority != v_old_priority AND
       (
         (v_old_priority = 'low' AND v_new_priority IN ('medium', 'high', 'critical')) OR
         (v_old_priority = 'medium' AND v_new_priority IN ('high', 'critical')) OR
         (v_old_priority = 'high' AND v_new_priority = 'critical')
       ) THEN

      UPDATE public.feedback_tickets
      SET
        priority = v_new_priority,
        last_escalation_at = now(),
        escalation_count = escalation_count + 1,
        updated_at = now()
      WHERE id = v_ticket.id;

      INSERT INTO public.user_notifications (
        id, user_id, organization_id, notification_type,
        title, message, entity_type, entity_id, metadata, is_read, created_at
      )
      SELECT
        gen_random_uuid(),
        p.id,
        v_ticket.organization_id,
        'ticket_escalated',
        'Ticket Escalated: ' || v_ticket.title,
        'Ticket has been unresolved for ' || v_days_old || ' days. Priority escalated from ' || v_old_priority || ' to ' || v_new_priority || '.',
        'feedback_ticket',
        v_ticket.id::text,
        jsonb_build_object(
          'previous_priority', v_old_priority,
          'new_priority', v_new_priority,
          'days_unresolved', v_days_old,
          'ticket_id', v_ticket.id
        ),
        false,
        now()
      FROM public.profiles p
      WHERE p.is_alkatera_admin = true;

      v_escalated_count := v_escalated_count + 1;
      v_escalated_ids := array_append(v_escalated_ids, v_ticket.id);
    END IF;
  END LOOP;

  RETURN QUERY SELECT
    v_escalated_count,
    COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('id', id, 'title', title, 'priority', priority))
       FROM public.feedback_tickets WHERE id = ANY(v_escalated_ids)),
      '[]'::jsonb
    );
END;
$$;


ALTER FUNCTION "public"."escalate_old_tickets"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."expire_old_supplier_invitations"() RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_expired_count INTEGER;
BEGIN
UPDATE public.supplier_invitations
SET status = 'expired'
WHERE status = 'pending'
AND expires_at <= now();

GET DIAGNOSTICS v_expired_count = ROW_COUNT;

RETURN v_expired_count;
END;
$$;


ALTER FUNCTION "public"."expire_old_supplier_invitations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."expire_old_supplier_invitations"() IS 'Marks pending invitations as expired if past their expiry date. Returns count of expired invitations.';



CREATE OR REPLACE FUNCTION "public"."generate_passport_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
new_token TEXT;
token_exists BOOLEAN;
BEGIN
LOOP
new_token := encode(gen_random_bytes(24), 'base64');
new_token := replace(new_token, '/', '_');
new_token := replace(new_token, '+', '-');
new_token := replace(new_token, '=', '');

SELECT EXISTS(
SELECT 1 FROM products WHERE passport_token = new_token
) INTO token_exists;

EXIT WHEN NOT token_exists;
END LOOP;

RETURN new_token;
END;
$$;


ALTER FUNCTION "public"."generate_passport_token"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."generate_passport_token"() IS 'Generates a cryptographically secure random token for product passport URLs';



CREATE OR REPLACE FUNCTION "public"."generate_slug"("title" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  slug text;
BEGIN
  -- Convert to lowercase, replace spaces with hyphens, remove special chars
  slug := lower(trim(title));
  slug := regexp_replace(slug, '[^a-z0-9\s-]', '', 'g');
  slug := regexp_replace(slug, '\s+', '-', 'g');
  slug := regexp_replace(slug, '-+', '-', 'g');
  RETURN slug;
END;
$$;


ALTER FUNCTION "public"."generate_slug"("title" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_facilities_list"() RETURNS TABLE("id" "uuid", "name" "text", "city" "text", "country" "text", "facility_type_id" "uuid", "facility_type_name" "text", "data_source_type" "text", "supplier_id" "uuid", "is_archived" boolean, "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_organization_id uuid;
BEGIN
  -- Get the organization_id for the current user
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;

  -- Return facilities for the organization
  RETURN QUERY
  SELECT
    f.id,
    f.name,
    f.city,
    f.country,
    f.facility_type_id,
    ft.name AS facility_type_name,
    f.data_source_type,
    f.supplier_id,
    f.is_archived,
    f.created_at,
    f.updated_at
  FROM facilities f
  LEFT JOIN facility_types ft ON f.facility_type_id = ft.id
  WHERE f.organization_id = v_organization_id
    AND f.is_archived = false
  ORDER BY f.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."get_all_facilities_list"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_approval_statistics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
result JSONB;
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

SELECT jsonb_build_object(
'activity_data', jsonb_build_object(
'pending', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending'),
'approved', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'approved'),
'rejected', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'rejected')
),
'facilities', jsonb_build_object(
'pending', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending'),
'approved', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'approved'),
'rejected', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'rejected')
),
'products', jsonb_build_object(
'pending', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending'),
'approved', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'approved'),
'rejected', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'rejected')
),
'suppliers', jsonb_build_object(
'pending', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending'),
'approved', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'approved'),
'rejected', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'rejected')
),
'totals', jsonb_build_object(
'total_pending', (
(SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending') +
(SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending') +
(SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending') +
(SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending')
),
'total_approved', (
(SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'approved') +
(SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'approved') +
(SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'approved') +
(SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'approved')
),
'total_rejected', (
(SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'rejected') +
(SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'rejected') +
(SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'rejected') +
(SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'rejected')
)
)
) INTO result;

RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_approval_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_approval_statistics"() IS 'Get platform-wide approval workflow statistics';



CREATE OR REPLACE FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_tier TEXT;
v_result JSONB := '[]'::jsonb;
BEGIN
SELECT subscription_tier INTO v_tier
FROM public.organizations
WHERE id = p_organization_id;

SELECT jsonb_agg(jsonb_build_object(
'code', feature_code,
'name', feature_name,
'enabled', enabled,
'usage_limit', usage_limit
))
INTO v_result
FROM public.subscription_tier_features
WHERE tier_name = v_tier
AND feature_code IN ('recipe_2016', 'ef_31', 'ef_31_single_score');

RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") IS 'Returns list of available LCA methodologies for an organization based on their tier.';



CREATE OR REPLACE FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text" DEFAULT NULL::"text") RETURNS TABLE("scope" "text", "total_tco2e" numeric, "source_type" "text", "entry_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT 
'Scope 1'::TEXT as scope,
COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
'fleet'::TEXT as source_type,
COUNT(*)::BIGINT as entry_count
FROM fleet_activities fa
WHERE fa.organization_id = p_organization_id
AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
AND fa.scope = 'Scope 1'
AND (p_scope IS NULL OR fa.scope = p_scope)
GROUP BY fa.scope

UNION ALL

SELECT 
'Scope 2'::TEXT as scope,
COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
'fleet'::TEXT as source_type,
COUNT(*)::BIGINT as entry_count
FROM fleet_activities fa
WHERE fa.organization_id = p_organization_id
AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
AND fa.scope = 'Scope 2'
AND (p_scope IS NULL OR fa.scope = p_scope)
GROUP BY fa.scope

UNION ALL

SELECT 
'Scope 3 Cat 6'::TEXT as scope,
COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
'fleet'::TEXT as source_type,
COUNT(*)::BIGINT as entry_count
FROM fleet_activities fa
WHERE fa.organization_id = p_organization_id
AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
AND fa.scope = 'Scope 3 Cat 6'
AND (p_scope IS NULL OR fa.scope = p_scope)
GROUP BY fa.scope;
END;
$$;


ALTER FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") IS 'Aggregates fleet emissions by scope for use in corporate carbon footprint reports. 
Returns emissions from the standalone fleet_activities table only.';



CREATE OR REPLACE FUNCTION "public"."get_current_organization_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
begin
  return (select nullif(current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'current_organization_id', '')::uuid);
exception
  when others then
    return null;
end;
$$;


ALTER FUNCTION "public"."get_current_organization_id"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_current_organization_id"() IS 'Returns the organization_id for the currently authenticated user. This is the single source of truth for all multi-tenancy RLS checks. Uses SECURITY DEFINER to bypass RLS and prevent recursion. Returns NULL if user is not a member of any organization.';



CREATE OR REPLACE FUNCTION "public"."get_default_dashboard_layout"() RETURNS TABLE("widget_id" "text", "widget_enabled" boolean, "widget_order" integer, "widget_col_span" integer, "widget_row_span" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT 
dw.id,
true,
dw.sort_order,
CASE dw.default_size
WHEN 'compact' THEN 1
WHEN 'standard' THEN 2
WHEN 'expanded' THEN 4
ELSE 2
END,
1
FROM dashboard_widgets dw
WHERE dw.is_active = true
ORDER BY dw.sort_order;
END;
$$;


ALTER FUNCTION "public"."get_default_dashboard_layout"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer, "p_geographic_scope" "text" DEFAULT 'UK'::"text") RETURNS TABLE("fuel_type" "text", "fuel_type_display" "text", "co2e_factor" numeric, "factor_unit" "text", "scope" "text", "source" "text", "factor_year" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT 
def.fuel_type,
def.fuel_type_display,
def.co2e_factor,
def.factor_unit,
def.scope,
def.source,
def.factor_year
FROM public.defra_energy_emission_factors def
WHERE def.fuel_type = p_fuel_type
AND def.factor_year = p_factor_year
AND def.geographic_scope = p_geographic_scope
LIMIT 1;

IF NOT FOUND THEN
RETURN QUERY
SELECT 
def.fuel_type,
def.fuel_type_display,
def.co2e_factor,
def.factor_unit,
def.scope,
def.source,
def.factor_year
FROM public.defra_energy_emission_factors def
WHERE def.fuel_type = p_fuel_type
AND def.geographic_scope = p_geographic_scope
ORDER BY def.factor_year DESC
LIMIT 1;
END IF;
END;
$$;


ALTER FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer, "p_geographic_scope" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer, "p_geographic_scope" "text") IS 'Retrieves DEFRA emission factor for a given fuel type and year, with fallback to most recent year if exact match not found';



CREATE OR REPLACE FUNCTION "public"."get_eeio_emission_factor"("p_category" "text", "p_currency" "text" DEFAULT 'GBP'::"text") RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE
WHEN p_category = 'business_travel' THEN 0.25
WHEN p_category = 'purchased_services' THEN 0.15
WHEN p_category = 'employee_commuting' THEN 0.20
WHEN p_category = 'capital_goods' THEN 0.40
WHEN p_category = 'upstream_transportation' THEN 0.35
WHEN p_category = 'waste_disposal' THEN 0.10
WHEN p_category = 'downstream_logistics' THEN 0.30
WHEN p_category = 'operational_waste' THEN 0.10
ELSE 0.20
END;
END;
$$;


ALTER FUNCTION "public"."get_eeio_emission_factor"("p_category" "text", "p_currency" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("factor_id" "uuid", "factor_name" "text", "factor_value" numeric, "factor_unit" "text", "factor_source" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
id as factor_id,
name as factor_name,
co2_factor as factor_value,
reference_unit as factor_unit,
source as factor_source
FROM staging_emission_factors
WHERE
LOWER(name) = LOWER(p_name)
AND (organization_id = p_organization_id OR organization_id IS NULL)
ORDER BY
CASE WHEN organization_id = p_organization_id THEN 1 ELSE 2 END
LIMIT 1;

IF FOUND THEN
RETURN;
END IF;

RETURN QUERY
SELECT
id as factor_id,
name as factor_name,
value as factor_value,
unit as factor_unit,
source as factor_source
FROM emissions_factors
WHERE LOWER(name) LIKE '%' || LOWER(p_name) || '%'
LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid") IS 'Waterfall resolver: checks staging_emission_factors first (org-specific then global), falls back to emissions_factors table if not found.';



CREATE OR REPLACE FUNCTION "public"."get_employee_fte_count"("p_report_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_fte_count integer;
BEGIN
SELECT fte_count INTO v_fte_count
FROM corporate_overheads
WHERE report_id = p_report_id
AND category = 'employee_commuting'
ORDER BY created_at DESC
LIMIT 1;

RETURN COALESCE(v_fte_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_employee_fte_count"("p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") RETURNS numeric
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
v_country_code TEXT;
v_aware_factor NUMERIC;
BEGIN
SELECT COALESCE(location_country_code, address_country) INTO v_country_code
FROM public.facilities
WHERE id = p_facility_id;

SELECT aware_factor INTO v_aware_factor
FROM public.aware_factors
WHERE country_code = v_country_code
LIMIT 1;

RETURN COALESCE(v_aware_factor, 1);
END;
$$;


ALTER FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") IS 'Returns the AWARE water scarcity factor for a facility based on its location';



CREATE OR REPLACE FUNCTION "public"."get_facility_details"("p_facility_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_organization_id uuid;
  v_facility json;
BEGIN
  -- Get the organization_id for the current user
  SELECT organization_id INTO v_organization_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_organization_id IS NULL THEN
    RAISE EXCEPTION 'User does not belong to an organization';
  END IF;

  -- Get facility details
  SELECT json_build_object(
    'id', f.id,
    'name', f.name,
    'address', f.address,
    'city', f.city,
    'country', f.country,
    'facility_type_id', f.facility_type_id,
    'facility_type_name', ft.name,
    'data_source_type', f.data_source_type,
    'supplier_id', f.supplier_id,
    'is_archived', f.is_archived,
    'created_at', f.created_at,
    'updated_at', f.updated_at
  )
  INTO v_facility
  FROM facilities f
  LEFT JOIN facility_types ft ON f.facility_type_id = ft.id
  WHERE f.id = p_facility_id
    AND f.organization_id = v_organization_id;

  IF v_facility IS NULL THEN
    RAISE EXCEPTION 'Facility not found or access denied';
  END IF;

  RETURN v_facility;
END;
$$;


ALTER FUNCTION "public"."get_facility_details"("p_facility_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_facility_production_volume"("p_facility_id" "uuid", "p_start_date" "date", "p_end_date" "date") RETURNS TABLE("total_volume_litres" double precision, "product_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
SUM(
CASE
WHEN unit = 'Litre' THEN volume
WHEN unit = 'Hectolitre' THEN volume * 100
WHEN unit = 'Unit' THEN volume
ELSE volume
END
) AS total_volume_litres,
COUNT(DISTINCT product_id)::integer AS product_count
FROM production_logs
WHERE
facility_id = p_facility_id
AND date BETWEEN p_start_date AND p_end_date;
END;
$$;


ALTER FUNCTION "public"."get_facility_production_volume"("p_facility_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") RETURNS TABLE("facility_id" "uuid", "facility_name" "text", "total_emissions_kg_co2e" numeric, "allocated_emissions_kg_co2e" numeric, "unallocated_emissions_kg_co2e" numeric, "allocation_percentage" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  WITH facility_totals AS (
    -- Get total emissions per facility from the most recent aggregated data
    SELECT DISTINCT ON (fea.facility_id)
      fea.facility_id,
      f.name AS facility_name,
      COALESCE(fea.total_co2e, 0) AS total_emissions
    FROM facility_emissions_aggregated fea
    JOIN facilities f ON f.id = fea.facility_id
    WHERE fea.organization_id = p_organization_id
    ORDER BY fea.facility_id, fea.reporting_period_end DESC
  ),

  facility_allocated AS (
    -- Get total allocated emissions per facility from contract manufacturer allocations
    SELECT
      cma.facility_id,
      COALESCE(SUM(cma.allocated_emissions_kg_co2e), 0) AS cm_allocated
    FROM contract_manufacturer_allocations cma
    WHERE cma.organization_id = p_organization_id
      AND cma.status != 'draft'
    GROUP BY cma.facility_id
  ),

  facility_allocated_owned AS (
    -- FIXED: Use new table name after rename migration
    -- Get total allocated emissions per facility from owned production sites
    SELECT
      ps.facility_id,
      COALESCE(SUM(ps.allocated_emissions_kg_co2e), 0) AS owned_allocated
    FROM product_carbon_footprint_production_sites ps
    WHERE ps.organization_id = p_organization_id
      AND ps.status != 'draft'
    GROUP BY ps.facility_id
  )

  SELECT
    ft.facility_id,
    ft.facility_name,
    ft.total_emissions AS total_emissions_kg_co2e,
    COALESCE(fa.cm_allocated, 0) + COALESCE(fao.owned_allocated, 0) AS allocated_emissions_kg_co2e,
    GREATEST(0, ft.total_emissions - COALESCE(fa.cm_allocated, 0) - COALESCE(fao.owned_allocated, 0)) AS unallocated_emissions_kg_co2e,
    CASE
      WHEN ft.total_emissions > 0 THEN
        LEAST(100, ((COALESCE(fa.cm_allocated, 0) + COALESCE(fao.owned_allocated, 0)) / ft.total_emissions) * 100)
      ELSE 0
    END AS allocation_percentage
  FROM facility_totals ft
  LEFT JOIN facility_allocated fa ON fa.facility_id = ft.facility_id
  LEFT JOIN facility_allocated_owned fao ON fao.facility_id = ft.facility_id
  ORDER BY ft.facility_name;
END;
$$;


ALTER FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") IS 'Returns the unallocated emission capacity for each facility in an organization';



CREATE OR REPLACE FUNCTION "public"."get_feature_adoption"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
result JSONB;
total_orgs INTEGER;
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

SELECT COUNT(*) INTO total_orgs FROM public.organizations;

SELECT jsonb_build_object(
'products_module', jsonb_build_object(
'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.products),
'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.products) / GREATEST(total_orgs, 1) * 100, 1)
),
'facilities_module', jsonb_build_object(
'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.facilities),
'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.facilities) / GREATEST(total_orgs, 1) * 100, 1)
),
'suppliers_module', jsonb_build_object(
'organizations_using', (SELECT COUNT(DISTINCT organization_id) FROM public.suppliers),
'adoption_rate', ROUND((SELECT COUNT(DISTINCT organization_id)::numeric FROM public.suppliers) / GREATEST(total_orgs, 1) * 100, 1)
),
'lca_module', jsonb_build_object(
'organizations_using', (SELECT COUNT(DISTINCT p.organization_id) FROM public.product_lcas pl JOIN public.products p ON pl.product_id = p.id),
'adoption_rate', ROUND((SELECT COUNT(DISTINCT p.organization_id)::numeric FROM public.product_lcas pl JOIN public.products p ON pl.product_id = p.id) / GREATEST(total_orgs, 1) * 100, 1)
),
'total_organizations', total_orgs
) INTO result;

RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_feature_adoption"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_feature_adoption"() IS 'Get feature adoption rates across the platform';



CREATE OR REPLACE FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("scope" "text", "total_emissions_tco2e" double precision, "total_distance_km" double precision, "journey_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
fa.scope,
COALESCE(SUM(fa.emissions_tco2e), 0) as total_emissions_tco2e,
COALESCE(SUM(fa.distance_km), 0) as total_distance_km,
COUNT(*) as journey_count
FROM fleet_activities fa
WHERE fa.organization_id = p_organization_id
AND (p_start_date IS NULL OR fa.activity_date >= p_start_date)
AND (p_end_date IS NULL OR fa.activity_date <= p_end_date)
GROUP BY fa.scope
ORDER BY fa.scope;
END;
$$;


ALTER FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Returns aggregated fleet emissions split by Scope 1 (ICE vehicles) and Scope 2 (BEV vehicles) for a given organization and optional date range';



CREATE OR REPLACE FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text" DEFAULT NULL::"text") RETURNS TABLE("scope" "text", "total_tco2e" numeric, "entry_count" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT 
fa.scope,
COALESCE(SUM(fa.emissions_tco2e), 0)::NUMERIC as total_tco2e,
COUNT(*)::BIGINT as entry_count
FROM fleet_activities fa
WHERE fa.organization_id = p_organization_id
AND EXTRACT(YEAR FROM COALESCE(fa.reporting_period_start, fa.activity_date)) = p_reporting_year
AND (p_scope IS NULL OR fa.scope = p_scope)
GROUP BY fa.scope;
END;
$$;


ALTER FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") IS 'Returns aggregated fleet emissions by scope for corporate carbon footprint reporting';



CREATE OR REPLACE FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") RETURNS TABLE("total_decisions" bigint, "openlca_count" bigint, "supplier_count" bigint, "primary_count" bigint, "unique_users" bigint, "data_quality_score" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
RETURN QUERY
SELECT
COUNT(*)::BIGINT AS total_decisions,
COUNT(*) FILTER (WHERE data_source = 'openlca')::BIGINT AS openlca_count,
COUNT(*) FILTER (WHERE data_source = 'supplier')::BIGINT AS supplier_count,
COUNT(*) FILTER (WHERE data_source = 'primary')::BIGINT AS primary_count,
COUNT(DISTINCT user_id)::BIGINT AS unique_users,
CASE
WHEN COUNT(*) = 0 THEN 0
ELSE (
(COUNT(*) FILTER (WHERE data_source = 'primary') * 100.0) +
(COUNT(*) FILTER (WHERE data_source = 'supplier') * 75.0) +
(COUNT(*) FILTER (WHERE data_source = 'openlca') * 25.0)
) / COUNT(*)
END AS data_quality_score
FROM public.ingredient_selection_audit
WHERE product_lca_id = p_lca_id;
END;
$$;


ALTER FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") IS 'Calculates data quality metrics for an LCA based on ingredient selections';



CREATE OR REPLACE FUNCTION "public"."get_my_organization_role"("org_id" "uuid") RETURNS "public"."organization_role"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
role_name text;
org_role organization_role;
BEGIN
SELECT r.name INTO role_name
FROM organization_members om
JOIN roles r ON om.role_id = r.id
WHERE om.organization_id = org_id
AND om.user_id = auth.uid();

IF role_name IN ('owner', 'admin') THEN
org_role := 'company_admin';
ELSIF role_name IN ('member', 'viewer') THEN
org_role := 'company_user';
ELSE
org_role := NULL;
END IF;

RETURN org_role;
END;
$$;


ALTER FUNCTION "public"."get_my_organization_role"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
role_uuid uuid;
BEGIN
SELECT om.role_id INTO role_uuid
FROM organization_members om
WHERE om.organization_id = org_id
AND om.user_id = auth.uid();

RETURN role_uuid;
END;
$$;


ALTER FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_next_recalculation_job"() RETURNS TABLE("queue_id" "uuid", "product_lca_id" "uuid", "organization_id" "uuid", "batch_id" "uuid", "attempt_count" integer)
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_job RECORD;
BEGIN
SELECT 
q.id,
q.product_lca_id,
q.organization_id,
q.batch_id,
q.attempt_count
INTO v_job
FROM public.lca_recalculation_queue q
WHERE q.status = 'pending'
AND (q.next_retry_at IS NULL OR q.next_retry_at <= now())
ORDER BY q.priority DESC, q.created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;

IF v_job IS NULL THEN
RETURN;
END IF;

UPDATE public.lca_recalculation_queue
SET 
status = 'processing',
processing_started_at = now(),
attempt_count = attempt_count + 1,
updated_at = now()
WHERE id = v_job.id;

UPDATE public.product_lcas
SET ef31_recalculation_status = 'processing'
WHERE id = v_job.product_lca_id;

RETURN QUERY SELECT 
v_job.id,
v_job.product_lca_id,
v_job.organization_id,
v_job.batch_id,
v_job.attempt_count + 1;
END;
$$;


ALTER FUNCTION "public"."get_next_recalculation_job"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_next_recalculation_job"() IS 'Atomically claims and returns the next pending recalculation job from the queue.';



CREATE OR REPLACE FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_result jsonb;
v_latest_score organization_vitality_scores%ROWTYPE;
v_platform_benchmark vitality_benchmarks%ROWTYPE;
v_category_benchmark vitality_benchmarks%ROWTYPE;
v_org_category text;
BEGIN
IF NOT EXISTS (
SELECT 1 FROM organization_members
WHERE organization_id = p_organization_id
AND user_id = auth.uid()
) THEN
RAISE EXCEPTION 'Access denied';
END IF;

SELECT * INTO v_latest_score
FROM organization_vitality_scores
WHERE organization_id = p_organization_id
ORDER BY calculation_date DESC
LIMIT 1;

IF NOT FOUND THEN
RETURN jsonb_build_object(
'has_data', false,
'message', 'No vitality scores calculated yet'
);
END IF;

SELECT industry_sector INTO v_org_category
FROM organizations
WHERE id = p_organization_id;

SELECT * INTO v_platform_benchmark
FROM vitality_benchmarks
WHERE benchmark_type = 'platform';

IF v_org_category IS NOT NULL THEN
SELECT * INTO v_category_benchmark
FROM vitality_benchmarks
WHERE benchmark_type = 'category'
AND category_name = v_org_category;
END IF;

v_result := jsonb_build_object(
'has_data', true,
'current_scores', jsonb_build_object(
'overall', v_latest_score.overall_score,
'climate', v_latest_score.climate_score,
'water', v_latest_score.water_score,
'circularity', v_latest_score.circularity_score,
'nature', v_latest_score.nature_score,
'calculation_date', v_latest_score.calculation_date
),
'platform_benchmarks', jsonb_build_object(
'overall_average', v_platform_benchmark.overall_avg,
'climate_average', v_platform_benchmark.climate_avg,
'water_average', v_platform_benchmark.water_avg,
'circularity_average', v_platform_benchmark.circularity_avg,
'nature_average', v_platform_benchmark.nature_avg,
'overall_top', v_platform_benchmark.overall_top,
'climate_top', v_platform_benchmark.climate_top,
'water_top', v_platform_benchmark.water_top,
'circularity_top', v_platform_benchmark.circularity_top,
'nature_top', v_platform_benchmark.nature_top,
'organization_count', v_platform_benchmark.organization_count
)
);

IF v_category_benchmark IS NOT NULL THEN
v_result := v_result || jsonb_build_object(
'category_benchmarks', jsonb_build_object(
'category_name', v_org_category,
'overall_average', v_category_benchmark.overall_avg,
'climate_average', v_category_benchmark.climate_avg,
'water_average', v_category_benchmark.water_avg,
'circularity_average', v_category_benchmark.circularity_avg,
'nature_average', v_category_benchmark.nature_avg,
'overall_top', v_category_benchmark.overall_top,
'climate_top', v_category_benchmark.climate_top,
'water_top', v_category_benchmark.water_top,
'circularity_top', v_category_benchmark.circularity_top,
'nature_top', v_category_benchmark.nature_top,
'organization_count', v_category_benchmark.organization_count
)
);
END IF;

RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
  v_org_id UUID;
BEGIN
  SELECT id INTO v_org_id
  FROM public.organizations
  WHERE stripe_customer_id = p_stripe_customer_id;

  RETURN v_org_id;
END;
$$;


ALTER FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") IS 'Retrieves organization ID by Stripe customer ID for webhook processing';



CREATE OR REPLACE FUNCTION "public"."get_organization_growth"("p_days" integer DEFAULT 30) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
result JSONB;
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

SELECT jsonb_agg(
jsonb_build_object(
'date', d.date,
'new_organizations', COALESCE(o.count, 0),
'cumulative', SUM(COALESCE(o.count, 0)) OVER (ORDER BY d.date)
)
)
INTO result
FROM (
SELECT generate_series(
CURRENT_DATE - (p_days || ' days')::interval,
CURRENT_DATE,
'1 day'::interval
)::date as date
) d
LEFT JOIN (
SELECT created_at::date as date, COUNT(*) as count
FROM public.organizations
WHERE created_at >= CURRENT_DATE - (p_days || ' days')::interval
GROUP BY created_at::date
) o ON d.date = o.date
ORDER BY d.date;

RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_organization_growth"("p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_organization_growth"("p_days" integer) IS 'Get daily organisation growth trend for specified number of days';



CREATE OR REPLACE FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
v_org RECORD;
v_limits RECORD;
v_team_count INTEGER;
v_facility_count INTEGER;
v_supplier_count INTEGER;
BEGIN
SELECT * INTO v_org
FROM public.organizations
WHERE id = p_organization_id;

IF v_org IS NULL THEN
RETURN jsonb_build_object('error', 'Organization not found');
END IF;

SELECT * INTO v_limits
FROM public.subscription_tier_limits
WHERE tier_name = v_org.subscription_tier;

SELECT COUNT(*) INTO v_team_count
FROM public.organization_members
WHERE organization_id = p_organization_id;

SELECT COUNT(*) INTO v_facility_count
FROM public.facilities
WHERE organization_id = p_organization_id;

SELECT COUNT(*) INTO v_supplier_count
FROM public.suppliers
WHERE organization_id = p_organization_id;

RETURN jsonb_build_object(
'tier', jsonb_build_object(
'name', v_org.subscription_tier,
'level', v_limits.tier_level,
'display_name', v_limits.display_name,
'status', v_org.subscription_status
),
'usage', jsonb_build_object(
'products', jsonb_build_object(
'current', v_org.current_product_count,
'max', v_limits.max_products,
'is_unlimited', v_limits.max_products IS NULL
),
'reports_monthly', jsonb_build_object(
'current', v_org.current_report_count_monthly,
'max', v_limits.max_reports_per_month,
'is_unlimited', v_limits.max_reports_per_month IS NULL,
'resets_at', date_trunc('month', now()) + interval '1 month'
),
'lcas', jsonb_build_object(
'current', v_org.current_lca_count,
'max', v_limits.max_lcas,
'is_unlimited', v_limits.max_lcas IS NULL
),
'team_members', jsonb_build_object(
'current', v_team_count,
'max', v_limits.max_team_members,
'is_unlimited', v_limits.max_team_members IS NULL
),
'facilities', jsonb_build_object(
'current', v_facility_count,
'max', v_limits.max_facilities,
'is_unlimited', v_limits.max_facilities IS NULL
),
'suppliers', jsonb_build_object(
'current', v_supplier_count,
'max', v_limits.max_suppliers,
'is_unlimited', v_limits.max_suppliers IS NULL
)
),
'features', v_limits.features_enabled
);
END;
$$;


ALTER FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_overhead_totals_by_category"("p_report_id" "uuid") RETURNS TABLE("category" "text", "total_spend" double precision, "total_co2e" double precision, "entry_count" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
co.category,
SUM(co.spend_amount) AS total_spend,
SUM(co.computed_co2e) AS total_co2e,
COUNT(*)::integer AS entry_count
FROM corporate_overheads co
WHERE co.report_id = p_report_id
GROUP BY co.category
ORDER BY co.category;
END;
$$;


ALTER FUNCTION "public"."get_overhead_totals_by_category"("p_report_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_pending_approval_count"() RETURNS integer
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
total_count INTEGER := 0;
org_id UUID;
BEGIN
org_id := get_current_organization_id();

IF org_id IS NULL OR NOT can_approve_data() THEN
RETURN 0;
END IF;

SELECT 
(SELECT COUNT(*) FROM pending_activity_data WHERE organization_id = org_id AND approval_status = 'pending') +
(SELECT COUNT(*) FROM pending_facilities WHERE organization_id = org_id AND approval_status = 'pending') +
(SELECT COUNT(*) FROM pending_products WHERE organization_id = org_id AND approval_status = 'pending') +
(SELECT COUNT(*) FROM pending_suppliers WHERE organization_id = org_id AND approval_status = 'pending')
INTO total_count;

RETURN COALESCE(total_count, 0);
END;
$$;


ALTER FUNCTION "public"."get_pending_approval_count"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_pending_approval_count"() IS 'Get total count of pending approvals for current organisation (admin only)';



CREATE OR REPLACE FUNCTION "public"."get_platform_organizations"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

RETURN (
SELECT jsonb_agg(
jsonb_build_object(
'id', o.id,
'name', o.name,
'slug', o.slug,
'created_at', o.created_at,
'member_count', (SELECT COUNT(*) FROM organization_members WHERE organization_id = o.id),
'product_count', (SELECT COUNT(*) FROM products WHERE organization_id = o.id),
'facility_count', (SELECT COUNT(*) FROM facilities WHERE organization_id = o.id)
)
)
FROM public.organizations o
WHERE o.slug != 'alkatera'
ORDER BY o.created_at DESC
);
END;
$$;


ALTER FUNCTION "public"."get_platform_organizations"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_platform_organizations"() IS 'Get list of organisations for platform admin - no private materiality data exposed';



CREATE OR REPLACE FUNCTION "public"."get_platform_statistics"() RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
result JSONB;
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

SELECT jsonb_build_object(
'users', jsonb_build_object(
'total', (SELECT COUNT(*) FROM public.profiles),
'new_this_month', (SELECT COUNT(*) FROM public.profiles 
WHERE created_at >= date_trunc('month', CURRENT_DATE)),
'new_this_week', (SELECT COUNT(*) FROM public.profiles 
WHERE created_at >= date_trunc('week', CURRENT_DATE))
),
'organizations', jsonb_build_object(
'total', (SELECT COUNT(*) FROM public.organizations),
'new_this_month', (SELECT COUNT(*) FROM public.organizations 
WHERE created_at >= date_trunc('month', CURRENT_DATE)),
'with_products', (SELECT COUNT(DISTINCT organization_id) FROM public.products),
'with_facilities', (SELECT COUNT(DISTINCT organization_id) FROM public.facilities)
),
'content', jsonb_build_object(
'total_products', (SELECT COUNT(*) FROM public.products),
'total_facilities', (SELECT COUNT(*) FROM public.facilities),
'total_suppliers', (SELECT COUNT(*) FROM public.suppliers),
'total_lcas', (SELECT COUNT(*) FROM public.product_lcas)
),
'pending_approvals', jsonb_build_object(
'activity_data', (SELECT COUNT(*) FROM public.pending_activity_data WHERE approval_status = 'pending'),
'facilities', (SELECT COUNT(*) FROM public.pending_facilities WHERE approval_status = 'pending'),
'products', (SELECT COUNT(*) FROM public.pending_products WHERE approval_status = 'pending'),
'suppliers', (SELECT COUNT(*) FROM public.pending_suppliers WHERE approval_status = 'pending')
),
'verification', jsonb_build_object(
'unverified_supplier_products', (SELECT COUNT(*) FROM public.supplier_products WHERE is_verified = false AND is_active = true)
),
'generated_at', now()
) INTO result;

RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_platform_statistics"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_platform_statistics"() IS 'Get comprehensive platform statistics for Alkatera admin dashboard';



CREATE OR REPLACE FUNCTION "public"."get_role_id_by_name"("role_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
role_uuid uuid;
BEGIN
SELECT id INTO role_uuid
FROM roles
WHERE name = role_name;

RETURN role_uuid;
END;
$$;


ALTER FUNCTION "public"."get_role_id_by_name"("role_name" "text") OWNER TO "postgres";


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

ELSE 'Unknown'
END;
END;
$$;


ALTER FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") IS 'Maps utility type to Scope 1 or Scope 2 automatically';



CREATE OR REPLACE FUNCTION "public"."get_spend_emission_factor"("p_category" "text") RETURNS numeric
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE
WHEN p_category = 'business_travel' THEN 0.25
WHEN p_category = 'purchased_services' THEN 0.15
WHEN p_category = 'employee_commuting' THEN 0.20
WHEN p_category = 'capital_goods' THEN 0.40
WHEN p_category = 'downstream_logistics' THEN 0.30
WHEN p_category = 'operational_waste' THEN 0.10
WHEN p_category = 'marketing_materials' THEN 0.20
ELSE 0.20
END;
END;
$$;


ALTER FUNCTION "public"."get_spend_emission_factor"("p_category" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_tier_level"("p_tier_name" "text") RETURNS integer
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE p_tier_name
WHEN 'seed' THEN 1
WHEN 'blossom' THEN 2
WHEN 'canopy' THEN 3
ELSE 1
END;
END;
$$;


ALTER FUNCTION "public"."get_tier_level"("p_tier_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_total_production_weight"("p_organization_id" "uuid", "p_year" integer) RETURNS double precision
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_total_weight float;
BEGIN
SELECT COALESCE(SUM(
CASE 
WHEN pl.unit = 'Litre' THEN pl.volume * 1.0  -- Assume 1kg per litre for beverages
WHEN pl.unit = 'Hectolitre' THEN pl.volume * 100.0
WHEN pl.unit = 'Kilogram' THEN pl.volume
ELSE pl.volume
END
), 0) INTO v_total_weight
FROM production_logs pl
WHERE pl.organization_id = p_organization_id
AND EXTRACT(YEAR FROM pl.date) = p_year;

RETURN v_total_weight;
END;
$$;


ALTER FUNCTION "public"."get_total_production_weight"("p_organization_id" "uuid", "p_year" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_transport_emission_factor"("p_transport_mode" "text") RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE
WHEN p_transport_mode = 'road' THEN 0.062      -- HGV average
WHEN p_transport_mode = 'rail' THEN 0.028      -- Freight rail
WHEN p_transport_mode = 'sea' THEN 0.011       -- Container ship
WHEN p_transport_mode = 'air' THEN 0.602       -- Air freight
WHEN p_transport_mode = 'multimodal' THEN 0.045 -- Mixed average
ELSE 0.062 -- Default to road
END;
END;
$$;


ALTER FUNCTION "public"."get_transport_emission_factor"("p_transport_mode" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_activity_trend"("p_days" integer DEFAULT 14) RETURNS "jsonb"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
result JSONB;
BEGIN
IF NOT is_alkatera_admin() THEN
RETURN jsonb_build_object('error', 'Unauthorized');
END IF;

SELECT jsonb_agg(
jsonb_build_object(
'date', d.date,
'activities', COALESCE(a.count, 0)
)
)
INTO result
FROM (
SELECT generate_series(
CURRENT_DATE - (p_days || ' days')::interval,
CURRENT_DATE,
'1 day'::interval
)::date as date
) d
LEFT JOIN (
SELECT activity_timestamp::date as date, COUNT(*) as count
FROM public.platform_activity_log
WHERE activity_timestamp >= CURRENT_DATE - (p_days || ' days')::interval
GROUP BY activity_timestamp::date
) a ON d.date = a.date
ORDER BY d.date;

RETURN COALESCE(result, '[]'::jsonb);
END;
$$;


ALTER FUNCTION "public"."get_user_activity_trend"("p_days" integer) OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_activity_trend"("p_days" integer) IS 'Get daily platform activity trend for specified number of days';



CREATE OR REPLACE FUNCTION "public"."get_user_permissions"("org_id" "uuid" DEFAULT NULL::"uuid") RETURNS "text"[]
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
target_org_id uuid;
permission_list text[];
BEGIN
IF org_id IS NOT NULL THEN
target_org_id := org_id;
ELSE
target_org_id := get_current_organization_id();
END IF;

IF target_org_id IS NULL THEN
RETURN ARRAY[]::text[];
END IF;

SELECT ARRAY_AGG(p.name)
INTO permission_list
FROM organization_members om
JOIN role_permissions rp ON om.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE om.user_id = auth.uid()
AND om.organization_id = target_org_id;

RETURN COALESCE(permission_list, ARRAY[]::text[]);
END;
$$;


ALTER FUNCTION "public"."get_user_permissions"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_user_permissions"("org_id" "uuid") IS 'Get array of all permission names the current user has in the specified organisation';



CREATE OR REPLACE FUNCTION "public"."get_user_role"("user_id" "uuid", "org_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
role_name text;
BEGIN
SELECT r.name INTO role_name
FROM organization_members om
JOIN roles r ON om.role_id = r.id
WHERE om.user_id = get_user_role.user_id
AND om.organization_id = get_user_role.org_id;

RETURN role_name;
END;
$$;


ALTER FUNCTION "public"."get_user_role"("user_id" "uuid", "org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date" DEFAULT NULL::"date", "p_end_date" "date" DEFAULT NULL::"date") RETURNS TABLE("vehicle_id" "uuid", "registration_number" "text", "make_model" "text", "propulsion_type" "text", "total_distance_km" double precision, "total_emissions_tco2e" double precision, "journey_count" bigint, "average_distance_per_journey" double precision, "emissions_per_km" double precision)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
v.id as vehicle_id,
v.registration_number,
v.make_model,
v.propulsion_type,
COALESCE(SUM(fa.distance_km), 0) as total_distance_km,
COALESCE(SUM(fa.emissions_tco2e), 0) as total_emissions_tco2e,
COUNT(fa.id) as journey_count,
CASE 
WHEN COUNT(fa.id) > 0 THEN SUM(fa.distance_km) / COUNT(fa.id)
ELSE 0
END as average_distance_per_journey,
CASE 
WHEN SUM(fa.distance_km) > 0 THEN SUM(fa.emissions_tco2e) / SUM(fa.distance_km)
ELSE 0
END as emissions_per_km
FROM vehicles v
LEFT JOIN fleet_activities fa ON fa.vehicle_id = v.id
AND (p_start_date IS NULL OR fa.activity_date >= p_start_date)
AND (p_end_date IS NULL OR fa.activity_date <= p_end_date)
WHERE v.id = p_vehicle_id
GROUP BY v.id, v.registration_number, v.make_model, v.propulsion_type;
END;
$$;


ALTER FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date", "p_end_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date", "p_end_date" "date") IS 'Returns performance metrics for a specific vehicle including total distance, emissions, and efficiency indicators';



CREATE OR REPLACE FUNCTION "public"."get_waste_emission_factor"("p_disposal_method" "text", "p_material_type" "text" DEFAULT 'mixed'::"text") RETURNS double precision
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
BEGIN
RETURN CASE
WHEN p_disposal_method = 'landfill' THEN 0.5
WHEN p_disposal_method = 'recycling' THEN 0.02
WHEN p_disposal_method = 'composting' THEN 0.01
WHEN p_disposal_method = 'incineration' THEN 0.3
WHEN p_disposal_method = 'anaerobic_digestion' THEN 0.005
ELSE 0.5 -- Default to landfill
END;
END;
$$;


ALTER FUNCTION "public"."get_waste_emission_factor"("p_disposal_method" "text", "p_material_type" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_blog_post_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_blog_post_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
INSERT INTO public.profiles (id, email, full_name, avatar_url)
VALUES (
new.id,
new.email,
new.raw_user_meta_data->>'full_name',
new.raw_user_meta_data->>'avatar_url'
);
RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
target_org_id uuid;
BEGIN
IF org_id IS NOT NULL THEN
target_org_id := org_id;
ELSE
target_org_id := get_current_organization_id();
END IF;

IF target_org_id IS NULL THEN
RETURN false;
END IF;

RETURN EXISTS (
SELECT 1
FROM organization_members om
JOIN role_permissions rp ON om.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE om.user_id = auth.uid()
AND om.organization_id = target_org_id
AND p.name = permission_name
);
END;
$$;


ALTER FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid") IS 'Check if the current user has a specific permission in the given or current organisation';



CREATE OR REPLACE FUNCTION "public"."import_approved_spend_items"("p_batch_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_batch spend_import_batches%ROWTYPE;
v_item spend_import_items%ROWTYPE;
v_imported_count integer := 0;
v_error_count integer := 0;
v_category text;
v_ef numeric;
v_co2e numeric;
BEGIN
SELECT * INTO v_batch FROM spend_import_batches WHERE id = p_batch_id;

IF v_batch IS NULL THEN
RETURN jsonb_build_object('success', false, 'error', 'Batch not found');
END IF;

UPDATE spend_import_batches SET status = 'importing' WHERE id = p_batch_id;

FOR v_item IN 
SELECT * FROM spend_import_items 
WHERE batch_id = p_batch_id AND status = 'approved'
LOOP
BEGIN
v_category := COALESCE(v_item.user_category, v_item.suggested_category);
v_ef := get_spend_emission_factor(v_category);
v_co2e := v_item.raw_amount * v_ef;

INSERT INTO corporate_overheads (
report_id,
category,
description,
spend_amount,
currency,
entry_date,
emission_factor,
computed_co2e
) VALUES (
v_batch.report_id,
v_category,
v_item.raw_description,
v_item.raw_amount,
v_item.raw_currency,
COALESCE(v_item.raw_date, CURRENT_DATE),
v_ef,
v_co2e
);

UPDATE spend_import_items 
SET status = 'imported', computed_co2e = v_co2e, emission_factor = v_ef
WHERE id = v_item.id;

v_imported_count := v_imported_count + 1;
EXCEPTION WHEN OTHERS THEN
v_error_count := v_error_count + 1;
END;
END LOOP;

UPDATE spend_import_batches 
SET 
status = 'completed',
imported_rows = v_imported_count,
completed_at = now()
WHERE id = p_batch_id;

RETURN jsonb_build_object(
'success', true,
'imported_count', v_imported_count,
'error_count', v_error_count
);
END;
$$;


ALTER FUNCTION "public"."import_approved_spend_items"("p_batch_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_lca_count"("p_organization_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_check JSONB;
BEGIN
v_check := public.check_lca_limit(p_organization_id);

IF (v_check->>'allowed')::boolean THEN
UPDATE public.organizations
SET current_lca_count = current_lca_count + 1
WHERE id = p_organization_id;

INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed
) VALUES (
p_organization_id, p_user_id, 'create', 'lca',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer + 1,
true
);
ELSE
INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed, denial_reason
) VALUES (
p_organization_id, p_user_id, 'create_blocked', 'lca',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer,
false,
v_check->>'reason'
);
END IF;

RETURN v_check;
END;
$$;


ALTER FUNCTION "public"."increment_lca_count"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_product_count"("p_organization_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_check JSONB;
BEGIN
v_check := public.check_product_limit(p_organization_id);

IF (v_check->>'allowed')::boolean THEN
UPDATE public.organizations
SET current_product_count = current_product_count + 1
WHERE id = p_organization_id;

INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed
) VALUES (
p_organization_id, p_user_id, 'create', 'product',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer + 1,
true
);
ELSE
INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed, denial_reason
) VALUES (
p_organization_id, p_user_id, 'create_blocked', 'product',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer,
false,
v_check->>'reason'
);
END IF;

RETURN v_check;
END;
$$;


ALTER FUNCTION "public"."increment_product_count"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_report_count"("p_organization_id" "uuid", "p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_check JSONB;
BEGIN
v_check := public.check_report_limit(p_organization_id);

IF (v_check->>'allowed')::boolean THEN
UPDATE public.organizations
SET current_report_count_monthly = current_report_count_monthly + 1
WHERE id = p_organization_id;

INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed
) VALUES (
p_organization_id, p_user_id, 'generate', 'report',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer + 1,
true
);
ELSE
INSERT INTO public.organization_usage_log (
organization_id, user_id, event_type, resource_type,
limit_checked, current_usage, was_allowed, denial_reason
) VALUES (
p_organization_id, p_user_id, 'generate_blocked', 'report',
(v_check->>'max_count')::integer,
(v_check->>'current_count')::integer,
false,
v_check->>'reason'
);
END IF;

RETURN v_check;
END;
$$;


ALTER FUNCTION "public"."increment_report_count"("p_organization_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."initialize_dashboard_preferences"("p_user_id" "uuid", "p_organization_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
INSERT INTO user_dashboard_preferences (user_id, organization_id, widget_id, enabled, display_order, col_span, row_span)
SELECT 
p_user_id,
p_organization_id,
widget_id,
widget_enabled,
widget_order,
widget_col_span,
widget_row_span
FROM get_default_dashboard_layout()
ON CONFLICT (user_id, organization_id, widget_id) DO NOTHING;
END;
$$;


ALTER FUNCTION "public"."initialize_dashboard_preferences"("p_user_id" "uuid", "p_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_alkatera_admin"() RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.organization_members om
    JOIN public.organizations o ON o.id = om.organization_id
    JOIN public.roles r ON r.id = om.role_id
    WHERE om.user_id = auth.uid()
      AND o.slug = 'alkatera'
      AND o.is_platform_admin = true
      AND r.name IN ('owner', 'admin')
  );
END;
$$;


ALTER FUNCTION "public"."is_alkatera_admin"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_alkatera_admin"() IS 'Returns true if current user is an Alkatera platform administrator. Used to control supplier product verification access.';



CREATE OR REPLACE FUNCTION "public"."is_member_of"("_organization_id" "uuid") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE
      organization_members.organization_id = _organization_id AND
      organization_members.user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_member_of"("_organization_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_organization_admin"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
RETURN get_my_organization_role(org_id) = 'company_admin';
END;
$$;


ALTER FUNCTION "public"."is_organization_admin"("org_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
SELECT EXISTS (
SELECT 1
FROM organization_members om
JOIN organizations o ON o.id = om.organization_id
WHERE om.user_id = auth.uid()
AND o.is_platform_admin = true
);
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql"
    AS $$
DECLARE
total_share NUMERIC;
BEGIN
SELECT COALESCE(SUM(production_share), 0)
INTO total_share
FROM lca_production_mix
WHERE lca_id = lca_uuid;

RETURN (total_share >= 0.9999 AND total_share <= 1.0001);
END;
$$;


ALTER FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") IS 'Returns TRUE if production shares for an LCA sum to 100% (with 0.01% tolerance). Use before allowing calculation.';



CREATE OR REPLACE FUNCTION "public"."list_platform_admins"() RETURNS TABLE("result_user_id" "uuid", "email" "text", "full_name" "text", "role_name" "text", "joined_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    r.name as role_name,
    om.joined_at
  FROM profiles p
  JOIN organization_members om ON om.user_id = p.id
  JOIN organizations o ON o.id = om.organization_id
  JOIN roles r ON r.id = om.role_id
  WHERE o.slug = 'alkatera'
    AND o.is_platform_admin = true
  ORDER BY om.joined_at ASC;
$$;


ALTER FUNCTION "public"."list_platform_admins"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_activity_id uuid;
v_org_id uuid;
v_user_id uuid;
BEGIN
v_org_id := get_current_organization_id();
v_user_id := auth.uid();

INSERT INTO public.activity_log (
organization_id,
event_type,
actor_id,
details
) VALUES (
v_org_id,
p_event_type,
v_user_id,
p_details
)
RETURNING id INTO v_activity_id;

RETURN v_activity_id;
END;
$$;


ALTER FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb") IS 'Helper function to log custom activities. Automatically captures current organization and user.';



CREATE OR REPLACE FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_log_id UUID;
BEGIN
INSERT INTO public.lca_methodology_audit_log (
organization_id,
user_id,
product_lca_id,
methodology_requested,
access_granted,
denial_reason
) VALUES (
p_organization_id,
p_user_id,
p_product_lca_id,
p_methodology,
p_granted,
p_denial_reason
)
RETURNING id INTO v_log_id;

RETURN v_log_id;
END;
$$;


ALTER FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text") IS 'Logs a methodology access attempt for audit and compliance purposes.';



CREATE OR REPLACE FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
INSERT INTO public.platform_activity_log (
activity_type,
activity_category,
organization_id,
metadata
) VALUES (
p_activity_type,
p_activity_category,
get_current_organization_id(),
p_metadata
);
END;
$$;


ALTER FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb") IS 'Log platform activity for analytics without storing user-identifying information';



CREATE OR REPLACE FUNCTION "public"."log_verification_status_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
INSERT INTO data_provenance_verification_history (
provenance_id,
changed_by,
old_status,
new_status,
changed_at
) VALUES (
NEW.provenance_id,
auth.uid(),
OLD.verification_status,
NEW.verification_status,
now()
);
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_verification_status_change"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."log_verification_status_change"() IS 'Automatically logs all verification status changes to the audit history table. Provides complete traceability of verification workflow.';



CREATE OR REPLACE FUNCTION "public"."notify_feedback_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  ticket_record RECORD;
  sender_name TEXT;
BEGIN
  -- Get ticket info
  SELECT * INTO ticket_record
  FROM public.feedback_tickets
  WHERE id = NEW.ticket_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  IF NEW.is_admin_reply THEN
    -- Notify the ticket creator that admin replied
    INSERT INTO public.user_notifications (
      user_id,
      organization_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    ) VALUES (
      ticket_record.created_by,
      ticket_record.organization_id,
      'feedback_reply',
      'Reply to your ' || ticket_record.category || ' report',
      'Alkatera support responded to "' || ticket_record.title || '"',
      'feedback_ticket',
      ticket_record.id,
      jsonb_build_object('message_id', NEW.id)
    );
  ELSE
    -- Notify admins of new user message
    INSERT INTO public.user_notifications (
      user_id,
      organization_id,
      notification_type,
      title,
      message,
      entity_type,
      entity_id,
      metadata
    )
    SELECT
      p.id,
      ticket_record.organization_id,
      'feedback_message',
      'New message on ticket: ' || ticket_record.title,
      COALESCE(sender_name, 'User') || ' sent a message',
      'feedback_ticket',
      ticket_record.id,
      jsonb_build_object('message_id', NEW.id)
    FROM public.profiles p
    WHERE p.is_alkatera_admin = true;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_feedback_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_new_feedback_ticket"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  admin_ids UUID[];
  admin_id UUID;
  submitter_name TEXT;
BEGIN
  -- Get submitter name
  SELECT COALESCE(full_name, email) INTO submitter_name
  FROM public.profiles
  WHERE id = NEW.created_by;

  -- Get all Alkatera admins
  SELECT ARRAY_AGG(id) INTO admin_ids
  FROM public.profiles
  WHERE is_alkatera_admin = true;

  -- Create notification for each admin
  IF admin_ids IS NOT NULL THEN
    FOREACH admin_id IN ARRAY admin_ids
    LOOP
      INSERT INTO public.user_notifications (
        user_id,
        organization_id,
        notification_type,
        title,
        message,
        entity_type,
        entity_id,
        metadata
      ) VALUES (
        admin_id,
        NEW.organization_id,
        'feedback_ticket',
        'New ' || NEW.category || ' report: ' || NEW.title,
        COALESCE(submitter_name, 'A user') || ' submitted a new ' || NEW.category || ' report',
        'feedback_ticket',
        NEW.id,
        jsonb_build_object('category', NEW.category, 'priority', NEW.priority)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_new_feedback_ticket"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_calculation_log_deletes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RAISE EXCEPTION 'Calculation logs are immutable and cannot be deleted. Log ID: %', OLD.log_id;
RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."prevent_calculation_log_deletes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_calculation_log_deletes"() IS 'Defence-in-depth function that explicitly prevents any DELETE operations on calculation logs, even if attempted via database admin. Ensures permanent audit trail.';



CREATE OR REPLACE FUNCTION "public"."prevent_calculation_log_updates"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RAISE EXCEPTION 'Calculation logs are immutable and cannot be updated. Log ID: %', OLD.log_id;
RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."prevent_calculation_log_updates"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_calculation_log_updates"() IS 'Defence-in-depth function that explicitly prevents any UPDATE operations on calculation logs, even if attempted via database admin. Enforces immutability principle.';



CREATE OR REPLACE FUNCTION "public"."prevent_data_provenance_deletes"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
RAISE EXCEPTION 'Evidence records are permanent and cannot be deleted. Provenance ID: %. Use verification_status to mark evidence as rejected instead.', OLD.provenance_id;
RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."prevent_data_provenance_deletes"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."prevent_data_provenance_deletes"() IS 'Defence-in-depth function that explicitly prevents any DELETE operations on evidence records, even if attempted via database admin. Ensures permanent chain of custody.';



CREATE OR REPLACE FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid" DEFAULT NULL::"uuid", "p_batch_name" "text" DEFAULT NULL::"text", "p_triggered_by" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_batch_id UUID;
v_count INTEGER := 0;
v_lca RECORD;
BEGIN
INSERT INTO public.lca_recalculation_batches (
batch_name,
description,
triggered_by,
trigger_reason
) VALUES (
COALESCE(p_batch_name, 'EF 3.1 Recalculation - ' || to_char(now(), 'YYYY-MM-DD HH24:MI')),
CASE 
WHEN p_organization_id IS NOT NULL THEN 'Organization-specific recalculation'
ELSE 'Platform-wide EF 3.1 recalculation'
END,
p_triggered_by,
'Manual trigger or subscription upgrade'
)
RETURNING id INTO v_batch_id;

FOR v_lca IN
SELECT pl.id, pl.organization_id
FROM public.product_lcas pl
JOIN public.organizations o ON o.id = pl.organization_id
WHERE pl.status = 'completed'
AND (pl.ef31_impacts IS NULL OR pl.ef31_calculated_at IS NULL)
AND o.subscription_tier IN ('premium', 'enterprise')
AND o.subscription_status IN ('active', 'trial')
AND (p_organization_id IS NULL OR pl.organization_id = p_organization_id)
LOOP
INSERT INTO public.lca_recalculation_queue (
batch_id,
product_lca_id,
organization_id,
status
) VALUES (
v_batch_id,
v_lca.id,
v_lca.organization_id,
'pending'
)
ON CONFLICT (product_lca_id, batch_id) DO NOTHING;

UPDATE public.product_lcas
SET 
ef31_recalculation_status = 'pending',
ef31_recalculation_requested_at = now()
WHERE id = v_lca.id;

v_count := v_count + 1;
END LOOP;

UPDATE public.lca_recalculation_batches
SET total_jobs = v_count
WHERE id = v_batch_id;

RETURN v_batch_id;
END;
$$;


ALTER FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid", "p_batch_name" "text", "p_triggered_by" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid", "p_batch_name" "text", "p_triggered_by" "uuid") IS 'Queues all eligible completed LCAs for EF 3.1 recalculation. Only includes Premium/Enterprise orgs.';



CREATE OR REPLACE FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer DEFAULT 5, "p_batch_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_org_id UUID;
v_queue_id UUID;
v_has_access BOOLEAN;
BEGIN
SELECT organization_id INTO v_org_id
FROM public.product_lcas
WHERE id = p_product_lca_id;

IF v_org_id IS NULL THEN
RAISE EXCEPTION 'Product LCA not found';
END IF;

SELECT public.check_methodology_access(v_org_id, 'ef_31') INTO v_has_access;

IF NOT v_has_access THEN
RAISE EXCEPTION 'Organization does not have access to EF 3.1 methodology. Please upgrade to Premium or Enterprise tier.';
END IF;

INSERT INTO public.lca_recalculation_queue (
batch_id,
product_lca_id,
organization_id,
priority,
status
) VALUES (
p_batch_id,
p_product_lca_id,
v_org_id,
p_priority,
'pending'
)
ON CONFLICT (product_lca_id, batch_id) DO UPDATE SET
status = 'pending',
attempt_count = 0,
last_error = NULL,
updated_at = now()
RETURNING id INTO v_queue_id;

UPDATE public.product_lcas
SET 
ef31_recalculation_status = 'pending',
ef31_recalculation_requested_at = now(),
ef31_recalculation_error = NULL
WHERE id = p_product_lca_id;

RETURN v_queue_id;
END;
$$;


ALTER FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer, "p_batch_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer, "p_batch_id" "uuid") IS 'Queues a product LCA for EF 3.1 recalculation. Checks tier access first.';



CREATE OR REPLACE FUNCTION "public"."recalculate_allocation_from_energy_inputs"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
total_co2e NUMERIC;
BEGIN
SELECT COALESCE(SUM(calculated_co2e_kg), 0)
INTO total_co2e
FROM public.contract_manufacturer_energy_inputs
WHERE allocation_id = COALESCE(NEW.allocation_id, OLD.allocation_id);

UPDATE public.contract_manufacturer_allocations
SET 
total_facility_co2e_kg = total_co2e,
updated_at = now()
WHERE id = COALESCE(NEW.allocation_id, OLD.allocation_id)
AND co2e_entry_method = 'calculated_from_energy';

RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."recalculate_allocation_from_energy_inputs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text" DEFAULT NULL::"text", "p_referer" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_product_id BIGINT;
v_result JSONB;
BEGIN
SELECT id INTO v_product_id
FROM products
WHERE passport_token = p_token
AND passport_enabled = true;

IF v_product_id IS NULL THEN
RETURN jsonb_build_object(
'success', false,
'error', 'Invalid or disabled passport token'
);
END IF;

INSERT INTO passport_views (product_id, user_agent, referer)
VALUES (v_product_id, p_user_agent, p_referer);

UPDATE products
SET 
passport_views_count = COALESCE(passport_views_count, 0) + 1,
passport_last_viewed_at = now()
WHERE id = v_product_id;

RETURN jsonb_build_object(
'success', true,
'product_id', v_product_id
);
END;
$$;


ALTER FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text", "p_referer" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text", "p_referer" "text") IS 'Records a passport view event and updates product analytics. Called from public passport pages.';



CREATE OR REPLACE FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
pending_record RECORD;
submitter_id UUID;
org_id UUID;
item_name TEXT;
BEGIN
IF NOT can_approve_data() THEN
RAISE EXCEPTION 'Permission denied: User cannot approve/reject data';
END IF;

CASE p_table_name
WHEN 'pending_activity_data' THEN
SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
FROM public.pending_activity_data
WHERE id = p_pending_id AND approval_status = 'pending';

UPDATE public.pending_activity_data
SET approval_status = 'rejected',
reviewed_by = auth.uid(),
reviewed_at = now(),
rejection_reason = p_reason
WHERE id = p_pending_id;

WHEN 'pending_facilities' THEN
SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
FROM public.pending_facilities
WHERE id = p_pending_id AND approval_status = 'pending';

UPDATE public.pending_facilities
SET approval_status = 'rejected',
reviewed_by = auth.uid(),
reviewed_at = now(),
rejection_reason = p_reason
WHERE id = p_pending_id;

WHEN 'pending_products' THEN
SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
FROM public.pending_products
WHERE id = p_pending_id AND approval_status = 'pending';

UPDATE public.pending_products
SET approval_status = 'rejected',
reviewed_by = auth.uid(),
reviewed_at = now(),
rejection_reason = p_reason
WHERE id = p_pending_id;

WHEN 'pending_suppliers' THEN
SELECT submitted_by, organization_id, name INTO submitter_id, org_id, item_name
FROM public.pending_suppliers
WHERE id = p_pending_id AND approval_status = 'pending';

UPDATE public.pending_suppliers
SET approval_status = 'rejected',
reviewed_by = auth.uid(),
reviewed_at = now(),
rejection_reason = p_reason
WHERE id = p_pending_id;

ELSE
RAISE EXCEPTION 'Invalid table name: %', p_table_name;
END CASE;

IF submitter_id IS NULL THEN
RAISE EXCEPTION 'Pending record not found or already processed';
END IF;

PERFORM create_notification(
submitter_id,
org_id,
'rejection',
'Submission Rejected',
'Your submission "' || COALESCE(item_name, 'Unknown') || '" was rejected. Reason: ' || p_reason,
p_table_name,
p_pending_id::text,
jsonb_build_object('reason', p_reason)
);

PERFORM log_platform_activity('submission_rejected', 'approval_workflow');
END;
$$;


ALTER FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") IS 'Reject a pending submission with a reason';



CREATE OR REPLACE FUNCTION "public"."remove_platform_admin"("user_email" "text") RETURNS TABLE("success" boolean, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_user_id uuid;
  v_org_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = user_email;
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 'User not found';
    RETURN;
  END IF;

  SELECT id INTO v_org_id FROM organizations WHERE slug = 'alkatera' AND is_platform_admin = true;

  DELETE FROM organization_members om
  WHERE om.organization_id = v_org_id
    AND om.user_id = v_user_id;

  RETURN QUERY SELECT true, 'Successfully removed ' || user_email || ' as platform admin';
END;
$$;


ALTER FUNCTION "public"."remove_platform_admin"("user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric DEFAULT 1.0, "p_unit" "text" DEFAULT 'kg'::"text") RETURNS TABLE("gwp_climate_total" numeric, "gwp_climate_fossil" numeric, "gwp_climate_biogenic" numeric, "gwp_data_source" "text", "gwp_reference_id" "text", "non_gwp_water" numeric, "non_gwp_land" numeric, "non_gwp_waste" numeric, "non_gwp_acidification" numeric, "non_gwp_eutrophication_freshwater" numeric, "non_gwp_eutrophication_marine" numeric, "non_gwp_ecotoxicity_freshwater" numeric, "non_gwp_ozone_depletion" numeric, "non_gwp_data_source" "text", "non_gwp_reference_id" "text", "is_hybrid" boolean, "data_quality_grade" "text", "confidence_score" integer, "geographic_scope" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_staging_factor RECORD;
v_ecoinvent_proxy RECORD;
BEGIN
SELECT * INTO v_staging_factor
FROM public.staging_emission_factors
WHERE LOWER(name) = LOWER(p_material_name)
OR LOWER(name) LIKE '%' || LOWER(p_material_name) || '%'
ORDER BY 
CASE WHEN LOWER(name) = LOWER(p_material_name) THEN 1 ELSE 2 END
LIMIT 1;

IF v_staging_factor IS NOT NULL AND v_staging_factor.co2_factor IS NOT NULL THEN
RETURN QUERY SELECT
v_staging_factor.co2_factor * p_quantity AS gwp_climate_total,
v_staging_factor.co2_factor * p_quantity * 0.85 AS gwp_climate_fossil,
v_staging_factor.co2_factor * p_quantity * 0.15 AS gwp_climate_biogenic,
COALESCE(v_staging_factor.source, 'Staging Factors')::TEXT AS gwp_data_source,
v_staging_factor.name AS gwp_reference_id,

0::NUMERIC AS non_gwp_water,
0::NUMERIC AS non_gwp_land,
0::NUMERIC AS non_gwp_waste,
0::NUMERIC AS non_gwp_acidification,
0::NUMERIC AS non_gwp_eutrophication_freshwater,
0::NUMERIC AS non_gwp_eutrophication_marine,
0::NUMERIC AS non_gwp_ecotoxicity_freshwater,
0::NUMERIC AS non_gwp_ozone_depletion,
'Staging Factors'::TEXT AS non_gwp_data_source,
v_staging_factor.name AS non_gwp_reference_id,

false::BOOLEAN AS is_hybrid,
'MEDIUM'::TEXT AS data_quality_grade,
70::INTEGER AS confidence_score,
'GLO'::TEXT AS geographic_scope;
RETURN;
END IF;

SELECT * INTO v_ecoinvent_proxy
FROM public.ecoinvent_material_proxies
WHERE LOWER(material_name) LIKE '%' || LOWER(p_material_name) || '%'
ORDER BY data_quality_score DESC NULLS LAST
LIMIT 1;

IF v_ecoinvent_proxy IS NOT NULL AND v_ecoinvent_proxy.impact_climate IS NOT NULL THEN
RETURN QUERY SELECT
COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity AS gwp_climate_total,
COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity * 0.85 AS gwp_climate_fossil,
COALESCE(v_ecoinvent_proxy.impact_climate, 0) * p_quantity * 0.15 AS gwp_climate_biogenic,
'Ecoinvent 3.12'::TEXT AS gwp_data_source,
v_ecoinvent_proxy.material_category AS gwp_reference_id,

COALESCE(v_ecoinvent_proxy.impact_water, 0) * p_quantity AS non_gwp_water,
COALESCE(v_ecoinvent_proxy.impact_land_use, v_ecoinvent_proxy.impact_land, 0) * p_quantity AS non_gwp_land,
COALESCE(v_ecoinvent_proxy.impact_waste, 0) * p_quantity AS non_gwp_waste,
COALESCE(v_ecoinvent_proxy.impact_terrestrial_acidification, 0) * p_quantity AS non_gwp_acidification,
COALESCE(v_ecoinvent_proxy.impact_freshwater_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_freshwater,
COALESCE(v_ecoinvent_proxy.impact_marine_eutrophication, 0) * p_quantity AS non_gwp_eutrophication_marine,
COALESCE(v_ecoinvent_proxy.impact_freshwater_ecotoxicity, 0) * p_quantity AS non_gwp_ecotoxicity_freshwater,
COALESCE(v_ecoinvent_proxy.impact_ozone_depletion, 0) * p_quantity AS non_gwp_ozone_depletion,
'Ecoinvent 3.12'::TEXT AS non_gwp_data_source,
v_ecoinvent_proxy.material_category AS non_gwp_reference_id,

false::BOOLEAN AS is_hybrid,
'MEDIUM'::TEXT AS data_quality_grade,
COALESCE(v_ecoinvent_proxy.data_quality_score::INTEGER * 20, 50)::INTEGER AS confidence_score,
COALESCE(v_ecoinvent_proxy.geography, 'GLO')::TEXT AS geographic_scope;
RETURN;
END IF;

RETURN QUERY SELECT 
NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC,
NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC, NULL::TEXT, NULL::TEXT,
false::BOOLEAN, 'LOW'::TEXT, 0::INTEGER, 'UNKNOWN'::TEXT;
END;
$$;


ALTER FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric, "p_unit" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric, "p_unit" "text") IS 'FIXED: Now uses correct column names (name, co2_factor) from staging_emission_factors table';



CREATE OR REPLACE FUNCTION "public"."set_activity_entry_confidence_score"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.confidence_score IS NULL THEN
NEW.confidence_score := calculate_provenance_confidence_score(NEW.data_provenance);
END IF;
NEW.updated_at := now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_activity_entry_confidence_score"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_facility_activity_organization_id"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.organization_id IS NULL THEN
SELECT organization_id INTO NEW.organization_id
FROM facilities
WHERE id = NEW.facility_id;
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_facility_activity_organization_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_production_site_facility_intensity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
facility_calculated_intensity NUMERIC;
facility_data_source TEXT;
BEGIN
SELECT
fea.calculated_intensity,
CASE
WHEN fea.data_source_type = 'Primary' THEN 'Verified'
ELSE 'Industry_Average'
END
INTO facility_calculated_intensity, facility_data_source
FROM public.facility_emissions_aggregated fea
WHERE fea.facility_id = NEW.facility_id
AND fea.calculated_intensity IS NOT NULL
ORDER BY fea.reporting_period_start DESC
LIMIT 1;

NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');

NEW.attributable_emissions_per_unit := NEW.facility_intensity;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_production_site_facility_intensity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_production_site_metrics"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
facility_calculated_intensity NUMERIC;
facility_data_source TEXT;
total_volume NUMERIC;
BEGIN
SELECT
fea.calculated_intensity,
CASE
WHEN fea.data_source_type = 'Primary' THEN 'Verified'
ELSE 'Industry_Average'
END
INTO facility_calculated_intensity, facility_data_source
FROM public.facility_emissions_aggregated fea
WHERE fea.facility_id = NEW.facility_id
AND fea.calculated_intensity IS NOT NULL
ORDER BY fea.reporting_period_start DESC
LIMIT 1;

NEW.facility_intensity := COALESCE(facility_calculated_intensity, 0);
NEW.data_source := COALESCE(facility_data_source, 'Industry_Average');

SELECT COALESCE(SUM(production_volume), 0) + NEW.production_volume
INTO total_volume
FROM public.product_lca_production_sites
WHERE product_lca_id = NEW.product_lca_id
AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

IF total_volume > 0 THEN
NEW.share_of_production := (NEW.production_volume / total_volume) * 100;
ELSE
NEW.share_of_production := 100;  -- If this is the only record, it's 100%
END IF;

NEW.attributable_emissions_per_unit := NEW.facility_intensity * (NEW.share_of_production / 100);

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_production_site_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_resolve_hybrid_impacts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
IF NEW.gwp_data_source IS NULL OR NEW.gwp_data_source = '' THEN
PERFORM public.update_material_with_hybrid_impacts(NEW.id);

SELECT * INTO NEW
FROM public.product_lca_materials
WHERE id = NEW.id;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_resolve_hybrid_impacts"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."trigger_resolve_hybrid_impacts"() IS 'DISABLED: Trigger was overwriting correct values with NULLs due to column name mismatch';



CREATE OR REPLACE FUNCTION "public"."update_bulk_import_sessions_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_bulk_import_sessions_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_corporate_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_corporate_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_dashboard_preferences_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_dashboard_preferences_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_emissions_factors_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_emissions_factors_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_emissions_factors_updated_at"() IS 'Automatically updates the updated_at timestamp when an emissions factor record is modified via migration';



CREATE OR REPLACE FUNCTION "public"."update_facilities_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_facilities_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_facility_product_assignments_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_facility_product_assignments_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_facility_water_data_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_facility_water_data_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_gaia_conversation_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.gaia_conversations
  SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;

  IF NEW.role = 'user' THEN
    UPDATE public.gaia_conversations
    SET title = LEFT(NEW.content, 100)
    WHERE id = NEW.conversation_id AND title IS NULL;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_gaia_conversation_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_generated_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = NOW();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_generated_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_kb_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_kb_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lca_production_mix_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lca_production_mix_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_lca_reports_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_lca_reports_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_material RECORD;
v_impacts RECORD;
BEGIN
SELECT * INTO v_material
FROM public.product_lca_materials
WHERE id = p_material_id;

IF v_material IS NULL THEN
RETURN false;
END IF;

SELECT * INTO v_impacts
FROM public.resolve_hybrid_impacts(
v_material.material_name,
COALESCE(v_material.category_type, 'MANUFACTURING_MATERIAL'::material_category_type),
v_material.quantity,  -- FIXED: was quantity_value
v_material.unit       -- FIXED: was quantity_unit
);

UPDATE public.product_lca_materials
SET
impact_climate = v_impacts.gwp_climate_total,
impact_climate_fossil = v_impacts.gwp_climate_fossil,
impact_climate_biogenic = v_impacts.gwp_climate_biogenic,
gwp_data_source = v_impacts.gwp_data_source,
gwp_reference_id = v_impacts.gwp_reference_id,

impact_water = v_impacts.non_gwp_water,
impact_land = v_impacts.non_gwp_land,  -- Note: using impact_land (not impact_land_use)
impact_waste = v_impacts.non_gwp_waste,
impact_terrestrial_acidification = v_impacts.non_gwp_acidification,
impact_freshwater_eutrophication = v_impacts.non_gwp_eutrophication_freshwater,
impact_marine_eutrophication = v_impacts.non_gwp_eutrophication_marine,
impact_freshwater_ecotoxicity = v_impacts.non_gwp_ecotoxicity_freshwater,
impact_ozone_depletion = v_impacts.non_gwp_ozone_depletion,
non_gwp_data_source = v_impacts.non_gwp_data_source,
non_gwp_reference_id = v_impacts.non_gwp_reference_id,

is_hybrid_source = v_impacts.is_hybrid,
data_quality_grade = v_impacts.data_quality_grade,
confidence_score = v_impacts.confidence_score,
geographic_scope = v_impacts.geographic_scope,

updated_at = now()
WHERE id = p_material_id;

RETURN true;
END;
$$;


ALTER FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") IS 'Updates a material''s impact data using hybrid resolution logic. Uses correct column names: quantity and unit.';



CREATE OR REPLACE FUNCTION "public"."update_openlca_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_openlca_config_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_product_carbon_footprint_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_product_carbon_footprint_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_production_logs_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_production_logs_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_recalculation_batch_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_recalculation_batch_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_spend_batch_stats"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
UPDATE spend_import_batches
SET
processed_rows = (
SELECT COUNT(*) FROM spend_import_items
WHERE batch_id = NEW.batch_id
AND ai_processed_at IS NOT NULL
),
approved_rows = (
SELECT COUNT(*) FROM spend_import_items
WHERE batch_id = NEW.batch_id
AND status = 'approved'
),
rejected_rows = (
SELECT COUNT(*) FROM spend_import_items
WHERE batch_id = NEW.batch_id
AND status = 'rejected'
),
updated_at = now()
WHERE id = NEW.batch_id;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_spend_batch_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_tier TEXT;
  v_subscription_status TEXT;
BEGIN
  -- Map Stripe price IDs to tiers
  v_tier := CASE p_price_id
    -- Production Monthly prices
    WHEN 'price_1SjQkLS6ESxgnZl2F62rcpVd' THEN 'seed'
    WHEN 'price_1SjQlgS6ESxgnZl2c9QYw7QI' THEN 'blossom'
    WHEN 'price_1SjQmXS6ESxgnZl2SWd2nHga' THEN 'canopy'
    -- Production Annual prices
    WHEN 'price_1SmfD6S6ESxgnZl2D3ELCThW' THEN 'seed'
    WHEN 'price_1SmfE0S6ESxgnZl2rW18ZxV7' THEN 'blossom'
    WHEN 'price_1SmfEqS6ESxgnZl2FugLcZSr' THEN 'canopy'
    -- Test Monthly prices
    WHEN 'price_1SmfgF28UK4Vxpt37j13gfue' THEN 'seed'
    WHEN 'price_1SmfhK28UK4Vxpt3mAfxrggp' THEN 'blossom'
    WHEN 'price_1Smfhv28UK4Vxpt3SU2pZVrt' THEN 'canopy'
    -- Test Annual prices
    WHEN 'price_1SmfiY28UK4Vxpt3uLpyVX5H' THEN 'seed'
    WHEN 'price_1Smfj928UK4Vxpt393quRGXO' THEN 'blossom'
    WHEN 'price_1Smfjf28UK4Vxpt3gB2qvW1b' THEN 'canopy'
    ELSE 'seed' -- Default to seed if unknown
  END;

  -- Map Stripe status to our status
  v_subscription_status := CASE p_status
    WHEN 'active' THEN 'active'
    WHEN 'trialing' THEN 'trial'
    WHEN 'past_due' THEN 'suspended'
    WHEN 'canceled' THEN 'cancelled'
    WHEN 'unpaid' THEN 'suspended'
    ELSE 'suspended'
  END;

  -- Update organization
  UPDATE public.organizations
  SET
    stripe_customer_id = p_stripe_customer_id,
    stripe_subscription_id = p_stripe_subscription_id,
    subscription_tier = v_tier,
    subscription_status = v_subscription_status,
    subscription_started_at = CASE
      WHEN subscription_started_at IS NULL THEN now()
      ELSE subscription_started_at
    END,
    updated_at = now()
  WHERE id = p_organization_id;

  RAISE NOTICE 'Updated organization % to tier % with status %', p_organization_id, v_tier, v_subscription_status;
END;
$$;


ALTER FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") IS 'Updates organization subscription details from Stripe webhook data';



CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_updated_at_column"() IS 'Automatically updates the updated_at timestamp on row modification';



CREATE OR REPLACE FUNCTION "public"."update_utility_data_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_utility_data_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_vehicles_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_vehicles_updated_at"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."update_vehicles_updated_at"() IS 'Automatically updates the updated_at timestamp when a vehicle record is modified';



CREATE OR REPLACE FUNCTION "public"."upsert_organization_vitality_score"("p_organization_id" "uuid", "p_year" integer, "p_overall_score" integer, "p_climate_score" integer, "p_water_score" integer, "p_circularity_score" integer, "p_nature_score" integer, "p_metrics" "jsonb" DEFAULT NULL::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_score_id uuid;
BEGIN
INSERT INTO organization_vitality_scores (
organization_id,
year,
overall_score,
climate_score,
water_score,
circularity_score,
nature_score,
total_emissions_kg,
emissions_intensity,
water_consumption_m3,
water_risk_level,
waste_diversion_rate,
land_use_m2a,
biodiversity_risk,
products_assessed,
calculation_metadata
) VALUES (
p_organization_id,
p_year,
p_overall_score,
p_climate_score,
p_water_score,
p_circularity_score,
p_nature_score,
(p_metrics->>'total_emissions_kg')::numeric,
(p_metrics->>'emissions_intensity')::numeric,
(p_metrics->>'water_consumption_m3')::numeric,
p_metrics->>'water_risk_level',
(p_metrics->>'waste_diversion_rate')::numeric,
(p_metrics->>'land_use_m2a')::numeric,
p_metrics->>'biodiversity_risk',
(p_metrics->>'products_assessed')::int,
p_metrics
)
ON CONFLICT (organization_id, year, calculation_date)
DO UPDATE SET
overall_score = EXCLUDED.overall_score,
climate_score = EXCLUDED.climate_score,
water_score = EXCLUDED.water_score,
circularity_score = EXCLUDED.circularity_score,
nature_score = EXCLUDED.nature_score,
total_emissions_kg = EXCLUDED.total_emissions_kg,
emissions_intensity = EXCLUDED.emissions_intensity,
water_consumption_m3 = EXCLUDED.water_consumption_m3,
water_risk_level = EXCLUDED.water_risk_level,
waste_diversion_rate = EXCLUDED.waste_diversion_rate,
land_use_m2a = EXCLUDED.land_use_m2a,
biodiversity_risk = EXCLUDED.biodiversity_risk,
products_assessed = EXCLUDED.products_assessed,
calculation_metadata = EXCLUDED.calculation_metadata,
updated_at = now()
RETURNING id INTO v_score_id;

INSERT INTO vitality_score_snapshots (
organization_id,
snapshot_date,
overall_score,
climate_score,
water_score,
circularity_score,
nature_score
) VALUES (
p_organization_id,
CURRENT_DATE,
p_overall_score,
p_climate_score,
p_water_score,
p_circularity_score,
p_nature_score
)
ON CONFLICT (organization_id, snapshot_date)
DO UPDATE SET
overall_score = EXCLUDED.overall_score,
climate_score = EXCLUDED.climate_score,
water_score = EXCLUDED.water_score,
circularity_score = EXCLUDED.circularity_score,
nature_score = EXCLUDED.nature_score;

RETURN v_score_id;
END;
$$;


ALTER FUNCTION "public"."upsert_organization_vitality_score"("p_organization_id" "uuid", "p_year" integer, "p_overall_score" integer, "p_climate_score" integer, "p_water_score" integer, "p_circularity_score" integer, "p_nature_score" integer, "p_metrics" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_organization_access"("org_id" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
  -- Check regular membership
  IF EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  ) THEN
    RETURN TRUE;
  END IF;

  -- Check advisor access
  IF EXISTS (
    SELECT 1 FROM advisor_organization_access
    WHERE organization_id = org_id
      AND advisor_user_id = auth.uid()
      AND is_active = true
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;


ALTER FUNCTION "public"."user_has_organization_access"("org_id" "uuid") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."user_has_organization_access"("org_id" "uuid") IS 'Check if the current user has access to an organization (either as member or advisor)';



CREATE OR REPLACE FUNCTION "public"."user_has_permission"("user_id" "uuid", "org_id" "uuid", "permission_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN EXISTS (
SELECT 1
FROM organization_members om
JOIN role_permissions rp ON om.role_id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE om.user_id = user_has_permission.user_id
AND om.organization_id = user_has_permission.org_id
AND p.name = user_has_permission.permission_name
);
END;
$$;


ALTER FUNCTION "public"."user_has_permission"("user_id" "uuid", "org_id" "uuid", "permission_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_calculation_log_organization"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
IF NOT EXISTS (
SELECT 1 
FROM organization_members 
WHERE user_id = auth.uid() 
AND organization_id = NEW.organization_id
) THEN
RAISE EXCEPTION 'User is not a member of the specified organisation';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_calculation_log_organization"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_calculation_log_organization"() IS 'Security function that validates the user is actually a member of the organisation before allowing a calculation log insert. Provides additional security beyond RLS by cross-checking organization_members table.';



CREATE OR REPLACE FUNCTION "public"."validate_data_provenance_organization"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
IF NOT EXISTS (
SELECT 1 
FROM organization_members 
WHERE user_id = auth.uid() 
AND organization_id = NEW.organization_id
) THEN
RAISE EXCEPTION 'User is not a member of the specified organisation';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_data_provenance_organization"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_data_provenance_organization"() IS 'Security function that validates the user is actually a member of the organisation before allowing evidence submission. Provides additional security beyond RLS by cross-checking organization_members table.';



CREATE OR REPLACE FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
total_climate numeric;
carbon_sum numeric;
variance_pct numeric;
validation_result jsonb;
BEGIN
total_climate := (metrics->>'climate_change_gwp100')::numeric;

IF metrics->'ghg_breakdown'->'carbon_origin' IS NOT NULL THEN
carbon_sum := 
COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'fossil')::numeric, 0) +
COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'biogenic')::numeric, 0) +
COALESCE((metrics->'ghg_breakdown'->'carbon_origin'->>'land_use_change')::numeric, 0);

IF total_climate > 0 THEN
variance_pct := ABS((carbon_sum - total_climate) / total_climate * 100);
ELSE
variance_pct := 0;
END IF;

validation_result := jsonb_build_object(
'has_breakdown', true,
'total_climate', total_climate,
'carbon_sum', carbon_sum,
'variance_pct', variance_pct,
'is_valid', variance_pct <= 5,
'warning', CASE 
WHEN variance_pct > 5 THEN 'Carbon origin sum deviates >5% from total'
ELSE null
END
);
ELSE
validation_result := jsonb_build_object(
'has_breakdown', false,
'total_climate', total_climate,
'warning', 'GHG breakdown not available'
);
END IF;

RETURN validation_result;
END;
$$;


ALTER FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") IS 'Validates GHG breakdown integrity per ISO 14067. Checks that fossil + biogenic + LUC 
roughly equals total CO2e (within 5% tolerance). Returns validation result with warnings.';



CREATE OR REPLACE FUNCTION "public"."validate_no_overlapping_allocation_periods"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF EXISTS (
SELECT 1 FROM public.contract_manufacturer_allocations
WHERE product_id = NEW.product_id
AND facility_id = NEW.facility_id
AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
AND (
(NEW.reporting_period_start, NEW.reporting_period_end) OVERLAPS 
(reporting_period_start, reporting_period_end)
)
) THEN
RAISE EXCEPTION 'Overlapping allocation periods are not allowed for the same product-facility combination. Each reporting period must be a discrete snapshot.';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_no_overlapping_allocation_periods"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_physical_allocation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
IF NEW.allocation_basis != 'none' 
AND NEW.brand_volume_reported IS NOT NULL 
AND NEW.total_facility_volume_reported IS NOT NULL THEN
IF NEW.brand_volume_reported > NEW.total_facility_volume_reported THEN
RAISE EXCEPTION 'Brand volume cannot exceed total facility volume';
END IF;
NEW.allocation_percentage := (NEW.brand_volume_reported / NEW.total_facility_volume_reported) * 100;
END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_physical_allocation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_production_mix_totals"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
total_share NUMERIC;
BEGIN
SELECT COALESCE(SUM(production_share), 0)
INTO total_share
FROM lca_production_mix
WHERE lca_id = NEW.lca_id
AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);

total_share := total_share + NEW.production_share;

IF total_share > 1.0001 THEN
RAISE EXCEPTION 'Production mix allocation cannot exceed 100%%. Current total would be: %',
(total_share * 100)
USING HINT = 'The sum of production_share values for this LCA must equal 1.0 (100%)';
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_production_mix_totals"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_production_site_facility_type"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
v_operational_control TEXT;
BEGIN
SELECT operational_control INTO v_operational_control
FROM facilities
WHERE id = NEW.facility_id;

IF v_operational_control != 'owned' THEN
RAISE EXCEPTION 'Only owned facilities can be added to production sites. Third-party/contract manufacturer facilities must use contract_manufacturer_allocations table instead. Facility operational_control: %', v_operational_control;
END IF;

RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_production_site_facility_type"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_production_site_facility_type"() IS 'Validates that only owned facilities can be tracked in product_lca_production_sites. Third-party/contract manufacturer facilities must use contract_manufacturer_allocations table.';



CREATE OR REPLACE FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") RETURNS TABLE("invitation_id" "uuid", "organization_id" "uuid", "product_id" bigint, "material_id" "uuid", "material_name" "text", "material_type" "text", "supplier_email" "text", "supplier_name" "text", "invited_at" timestamp with time zone, "expires_at" timestamp with time zone, "is_valid" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
RETURN QUERY
SELECT
si.id,
si.organization_id,
si.product_id,
si.material_id,
si.material_name,
si.material_type,
si.supplier_email,
si.supplier_name,
si.invited_at,
si.expires_at,
(si.status = 'pending' AND si.expires_at > now()) as is_valid
FROM public.supplier_invitations si
WHERE si.invitation_token = p_token;
END;
$$;


ALTER FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") IS 'Validates an invitation token and returns invitation details if valid';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accredited_advisors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "company_name" "text",
    "advisor_bio" "text",
    "expertise_areas" "text"[] DEFAULT '{}'::"text"[],
    "certifications" "text"[] DEFAULT '{}'::"text"[],
    "website_url" "text",
    "linkedin_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "accredited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accredited_by" "uuid",
    "accreditation_expires_at" timestamp with time zone,
    "training_completed_at" timestamp with time zone,
    "last_compliance_check_at" timestamp with time zone,
    "compliance_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."accredited_advisors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "activity_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "facility_id" "uuid",
    "fuel_type" "text",
    "reporting_period_start" "date",
    "reporting_period_end" "date"
);


ALTER TABLE "public"."activity_data" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "actor_id" "uuid",
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."activity_log" IS 'General-purpose activity log for events that do not have a natural source table. Used for system events, notifications, and custom actions.';



COMMENT ON COLUMN "public"."activity_log"."event_type" IS 'Type of event (e.g., SYSTEM_NOTIFICATION, DATA_EXPORT, REPORT_GENERATED)';



COMMENT ON COLUMN "public"."activity_log"."details" IS 'Event-specific details in JSONB format. Structure varies by event_type.';



CREATE TABLE IF NOT EXISTS "public"."ghg_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" integer NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "emission_factor_unit" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ghg_categories_scope_check" CHECK (("scope" = ANY (ARRAY[1, 2, 3])))
);


ALTER TABLE "public"."ghg_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."ghg_categories" IS 'Reference table for GHG emission categories following the GHG Protocol Corporate Standard. Maps categories to Scope 1, 2, or 3.';



COMMENT ON COLUMN "public"."ghg_categories"."scope" IS 'GHG Protocol scope: 1 (Direct), 2 (Indirect Energy), 3 (Other Indirect)';



COMMENT ON COLUMN "public"."ghg_categories"."emission_factor_unit" IS 'Standard unit for emission factors (e.g., "kgCO2e/kWh", "kgCO2e/km")';



CREATE TABLE IF NOT EXISTS "public"."ghg_emissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "reporting_period" "text" NOT NULL,
    "activity_amount" numeric NOT NULL,
    "activity_unit" "text" NOT NULL,
    "emission_factor" numeric NOT NULL,
    "total_emissions" numeric NOT NULL,
    "recorded_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "positive_activity" CHECK (("activity_amount" >= (0)::numeric)),
    CONSTRAINT "positive_emission_factor" CHECK (("emission_factor" >= (0)::numeric)),
    CONSTRAINT "positive_total_emissions" CHECK (("total_emissions" >= (0)::numeric))
);


ALTER TABLE "public"."ghg_emissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."ghg_emissions" IS 'Stores greenhouse gas emissions data by category and reporting period. Follows GHG Protocol calculation methodology.';



COMMENT ON COLUMN "public"."ghg_emissions"."reporting_period" IS 'Period identifier (e.g., "2024-Q1", "2024-Q2", "2024"). Used to group emissions for reporting.';



COMMENT ON COLUMN "public"."ghg_emissions"."activity_amount" IS 'Quantity of activity that generated emissions (e.g., 1000 kWh, 500 km)';



COMMENT ON COLUMN "public"."ghg_emissions"."emission_factor" IS 'Conversion factor in kgCO₂e per activity unit. Used to calculate total emissions.';



COMMENT ON COLUMN "public"."ghg_emissions"."total_emissions" IS 'Calculated total emissions in tCO₂e (tonnes of CO₂ equivalent). Typically activity_amount * emission_factor / 1000.';



CREATE TABLE IF NOT EXISTS "public"."kpi_data_points" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "kpi_id" "uuid" NOT NULL,
    "value" numeric NOT NULL,
    "recorded_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."kpi_data_points" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpi_data_points" IS 'Stores historical data points for KPIs. Each row represents a measurement at a specific point in time.';



COMMENT ON COLUMN "public"."kpi_data_points"."recorded_date" IS 'The date this value was recorded or is effective for. Used to track historical trends.';



COMMENT ON COLUMN "public"."kpi_data_points"."created_by" IS 'User who created this data point. Optional tracking for audit purposes.';



CREATE TABLE IF NOT EXISTS "public"."kpis" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "target_value" numeric,
    "unit" "text" NOT NULL,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."kpis" OWNER TO "postgres";


COMMENT ON TABLE "public"."kpis" IS 'Stores Key Performance Indicator definitions for organizations. Each KPI tracks a specific metric with a target value.';



COMMENT ON COLUMN "public"."kpis"."organization_id" IS 'Foreign key to organizations table. Enables multi-tenant data isolation.';



COMMENT ON COLUMN "public"."kpis"."target_value" IS 'The goal or target value for this KPI. NULL if no target is set.';



COMMENT ON COLUMN "public"."kpis"."unit" IS 'Unit of measurement (e.g., "tCO₂e", "£", "%", "kWh")';



COMMENT ON COLUMN "public"."kpis"."category" IS 'Grouping category (e.g., "emissions", "financial", "operational", "energy")';



CREATE TABLE IF NOT EXISTS "public"."organization_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "invited_by" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"()
);

ALTER TABLE ONLY "public"."organization_members" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_alkatera_admin" boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY "public"."profiles" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."is_alkatera_admin" IS 'Flag indicating whether the user is an Alkatera platform administrator';



CREATE TABLE IF NOT EXISTS "public"."roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_engagements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "status" "public"."supplier_engagement_status" DEFAULT 'invited'::"public"."supplier_engagement_status" NOT NULL,
    "invited_date" "date",
    "accepted_date" "date",
    "data_submitted_date" "date",
    "last_contact_date" "date",
    "data_quality_score" numeric,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "logical_dates" CHECK (((("accepted_date" IS NULL) OR ("invited_date" IS NULL) OR ("accepted_date" >= "invited_date")) AND (("data_submitted_date" IS NULL) OR ("accepted_date" IS NULL) OR ("data_submitted_date" >= "accepted_date")))),
    CONSTRAINT "supplier_engagements_data_quality_score_check" CHECK ((("data_quality_score" >= (0)::numeric) AND ("data_quality_score" <= (100)::numeric)))
);


ALTER TABLE "public"."supplier_engagements" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_engagements" IS 'Tracks supplier engagement lifecycle from invitation to data submission. One engagement record per supplier.';



COMMENT ON COLUMN "public"."supplier_engagements"."status" IS 'Current engagement status: invited, active, data_provided, or inactive';



COMMENT ON COLUMN "public"."supplier_engagements"."last_contact_date" IS 'Most recent contact or interaction date. Used for follow-up tracking.';



COMMENT ON COLUMN "public"."supplier_engagements"."data_quality_score" IS 'Quality rating of submitted data from 0-100. NULL if no data submitted.';



CREATE TABLE IF NOT EXISTS "public"."suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "contact_email" "text",
    "contact_name" "text",
    "industry_sector" "text",
    "country" "text",
    "annual_spend" numeric,
    "spend_currency" "text" DEFAULT 'GBP'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "website" "text",
    CONSTRAINT "positive_spend" CHECK ((("annual_spend" >= (0)::numeric) OR ("annual_spend" IS NULL))),
    CONSTRAINT "valid_email" CHECK ((("contact_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text") OR ("contact_email" IS NULL))),
    CONSTRAINT "valid_website_url" CHECK ((("website" IS NULL) OR ("website" ~* '^https?://[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*)*(\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/.*)?$'::"text") OR ("website" ~* '^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*)*(\.[a-zA-Z]{2,})(:[0-9]{1,5})?(/.*)?$'::"text")))
);


ALTER TABLE "public"."suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."suppliers" IS 'Stores supplier information for organizations. Used to track supply chain and Scope 3 emissions.';



COMMENT ON COLUMN "public"."suppliers"."organization_id" IS 'Foreign key to organizations table. Enables multi-tenant data isolation.';



COMMENT ON COLUMN "public"."suppliers"."industry_sector" IS 'Supplier industry sector. Helps with emissions estimation and benchmarking.';



COMMENT ON COLUMN "public"."suppliers"."annual_spend" IS 'Estimated annual spend with this supplier. Used for emissions allocation.';



COMMENT ON COLUMN "public"."suppliers"."website" IS 'Supplier company website URL for contact and reference';



CREATE OR REPLACE VIEW "public"."activity_stream_view" WITH ("security_invoker"='true') AS
 SELECT "om"."id" AS "event_id",
    "om"."organization_id",
        CASE
            WHEN ("om"."joined_at" IS NOT NULL) THEN 'USER_JOINED'::"text"
            ELSE 'USER_INVITED'::"text"
        END AS "event_type",
    COALESCE("om"."joined_at", "om"."joined_at", "now"()) AS "event_timestamp",
    COALESCE("inviter"."full_name", "inviter"."email", 'System'::"text") AS "actor_name",
    "inviter"."email" AS "actor_email",
    "jsonb_build_object"('user_name', "member"."full_name", 'user_email', "member"."email", 'role', "r"."name", 'invited_by', "inviter"."full_name") AS "details"
   FROM ((("public"."organization_members" "om"
     JOIN "public"."profiles" "member" ON (("om"."user_id" = "member"."id")))
     LEFT JOIN "public"."profiles" "inviter" ON (("om"."invited_by" = "inviter"."id")))
     LEFT JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE ("om"."joined_at" IS NOT NULL)
UNION ALL
 SELECT "s"."id" AS "event_id",
    "s"."organization_id",
    'SUPPLIER_ADDED'::"text" AS "event_type",
    "s"."created_at" AS "event_timestamp",
    'System'::"text" AS "actor_name",
    NULL::"text" AS "actor_email",
    "jsonb_build_object"('supplier_name', "s"."name", 'contact_email', "s"."contact_email", 'industry_sector', "s"."industry_sector", 'country', "s"."country") AS "details"
   FROM "public"."suppliers" "s"
UNION ALL
 SELECT "se"."id" AS "event_id",
    "s"."organization_id",
        CASE "se"."status"
            WHEN 'invited'::"public"."supplier_engagement_status" THEN 'SUPPLIER_INVITED'::"text"
            WHEN 'active'::"public"."supplier_engagement_status" THEN 'SUPPLIER_ACTIVATED'::"text"
            WHEN 'data_provided'::"public"."supplier_engagement_status" THEN 'SUPPLIER_DATA_RECEIVED'::"text"
            WHEN 'inactive'::"public"."supplier_engagement_status" THEN 'SUPPLIER_DEACTIVATED'::"text"
            ELSE NULL::"text"
        END AS "event_type",
    COALESCE(("se"."data_submitted_date")::timestamp with time zone, ("se"."accepted_date")::timestamp with time zone, ("se"."invited_date")::timestamp with time zone, "se"."created_at") AS "event_timestamp",
    COALESCE("actor"."full_name", "actor"."email", 'System'::"text") AS "actor_name",
    "actor"."email" AS "actor_email",
    "jsonb_build_object"('supplier_name', "s"."name", 'status', "se"."status", 'data_quality_score', "se"."data_quality_score") AS "details"
   FROM (("public"."supplier_engagements" "se"
     JOIN "public"."suppliers" "s" ON (("se"."supplier_id" = "s"."id")))
     LEFT JOIN "public"."profiles" "actor" ON (("se"."created_by" = "actor"."id")))
  WHERE ("se"."status" IS NOT NULL)
UNION ALL
 SELECT "e"."id" AS "event_id",
    "e"."organization_id",
    'EMISSION_DATA_ADDED'::"text" AS "event_type",
    "e"."created_at" AS "event_timestamp",
    COALESCE("actor"."full_name", "actor"."email", 'System'::"text") AS "actor_name",
    "actor"."email" AS "actor_email",
    "jsonb_build_object"('category', "c"."name", 'scope', "c"."scope", 'total_emissions', "e"."total_emissions", 'unit', 'tCO₂e', 'reporting_period', "e"."reporting_period") AS "details"
   FROM (("public"."ghg_emissions" "e"
     JOIN "public"."ghg_categories" "c" ON (("e"."category_id" = "c"."id")))
     LEFT JOIN "public"."profiles" "actor" ON (("e"."created_by" = "actor"."id")))
UNION ALL
 SELECT "kdp"."id" AS "event_id",
    "k"."organization_id",
    'KPI_DATA_RECORDED'::"text" AS "event_type",
    "kdp"."created_at" AS "event_timestamp",
    COALESCE("actor"."full_name", "actor"."email", 'System'::"text") AS "actor_name",
    "actor"."email" AS "actor_email",
    "jsonb_build_object"('kpi_name', "k"."name", 'value', "kdp"."value", 'unit', "k"."unit", 'recorded_date', "kdp"."recorded_date") AS "details"
   FROM (("public"."kpi_data_points" "kdp"
     JOIN "public"."kpis" "k" ON (("kdp"."kpi_id" = "k"."id")))
     LEFT JOIN "public"."profiles" "actor" ON (("kdp"."created_by" = "actor"."id")))
UNION ALL
 SELECT "al"."id" AS "event_id",
    "al"."organization_id",
    "al"."event_type",
    "al"."created_at" AS "event_timestamp",
    COALESCE("actor"."full_name", "actor"."email", 'System'::"text") AS "actor_name",
    "actor"."email" AS "actor_email",
    "al"."details"
   FROM ("public"."activity_log" "al"
     LEFT JOIN "public"."profiles" "actor" ON (("al"."actor_id" = "actor"."id")))
  ORDER BY 4 DESC;


ALTER VIEW "public"."activity_stream_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."activity_stream_view" IS 'Unified activity stream combining events from multiple sources using UNION ALL. Shows chronological feed of all organization activities. Uses security_invoker=true to inherit RLS from source tables.';



CREATE TABLE IF NOT EXISTS "public"."advisor_organization_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "advisor_user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "invitation_id" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid" NOT NULL,
    "revoked_at" timestamp with time zone,
    "revoked_by" "uuid",
    "revocation_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."advisor_organization_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."aware_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country_code" "text" NOT NULL,
    "country_name" "text" NOT NULL,
    "region" "text",
    "sub_region" "text",
    "aware_factor" numeric NOT NULL,
    "baseline_water_stress" numeric,
    "risk_level" "text" GENERATED ALWAYS AS (
CASE
    WHEN ("aware_factor" >= (10)::numeric) THEN 'high'::"text"
    WHEN ("aware_factor" >= (1)::numeric) THEN 'medium'::"text"
    ELSE 'low'::"text"
END) STORED,
    "source" "text" DEFAULT 'AWARE v1.3'::"text",
    "year" integer DEFAULT 2023,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "aware_factors_aware_factor_check" CHECK (("aware_factor" > (0)::numeric))
);


ALTER TABLE "public"."aware_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."aware_factors" IS 'AWARE water scarcity characterisation factors by region';



COMMENT ON COLUMN "public"."aware_factors"."aware_factor" IS 'Available Water Remaining factor - higher values indicate greater scarcity';



CREATE TABLE IF NOT EXISTS "public"."blog_posts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "title" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "excerpt" "text",
    "content" "text" NOT NULL,
    "featured_image_url" "text",
    "author_id" "uuid",
    "author_name" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "content_type" "text" DEFAULT 'article'::"text",
    "status" "text" DEFAULT 'draft'::"text",
    "published_at" timestamp with time zone,
    "read_time" "text",
    "view_count" integer DEFAULT 0,
    "meta_title" "text",
    "meta_description" "text",
    "og_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "display_order" integer DEFAULT 0,
    CONSTRAINT "blog_posts_content_type_check" CHECK (("content_type" = ANY (ARRAY['article'::"text", 'video'::"text", 'quote'::"text", 'tutorial'::"text"]))),
    CONSTRAINT "blog_posts_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."blog_posts" OWNER TO "postgres";


COMMENT ON TABLE "public"."blog_posts" IS 'Blog posts for the AlkaTera knowledge hub';



COMMENT ON COLUMN "public"."blog_posts"."slug" IS 'URL-friendly slug generated from title';



COMMENT ON COLUMN "public"."blog_posts"."content" IS 'Full blog post content in markdown or HTML';



COMMENT ON COLUMN "public"."blog_posts"."content_type" IS 'Type of content: article, video, quote, or tutorial';



COMMENT ON COLUMN "public"."blog_posts"."status" IS 'Publication status: draft, published, or archived';



CREATE TABLE IF NOT EXISTS "public"."bom_extracted_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bom_import_id" "uuid" NOT NULL,
    "raw_name" "text" NOT NULL,
    "clean_name" "text",
    "quantity" numeric(12,6),
    "unit" "text",
    "item_type" "text" DEFAULT 'ingredient'::"text",
    "unit_cost" numeric(12,4),
    "total_cost" numeric(12,4),
    "matched_material_id" "uuid",
    "match_confidence" numeric(3,2),
    "is_reviewed" boolean DEFAULT false,
    "is_imported" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_item_type" CHECK (("item_type" = ANY (ARRAY['ingredient'::"text", 'packaging'::"text"])))
);


ALTER TABLE "public"."bom_extracted_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."bom_extracted_items" IS 'Individual items extracted from BOM files, pending review and import into product specifications.';



COMMENT ON COLUMN "public"."bom_extracted_items"."raw_name" IS 'Original component name as extracted from the BOM file.';



COMMENT ON COLUMN "public"."bom_extracted_items"."clean_name" IS 'Cleaned/normalized name after removing codes and formatting.';



COMMENT ON COLUMN "public"."bom_extracted_items"."match_confidence" IS 'Confidence score (0.00-1.00) for auto-matched material.';



CREATE TABLE IF NOT EXISTS "public"."bom_imports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint,
    "file_name" "text" NOT NULL,
    "file_type" "text" NOT NULL,
    "file_url" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "item_count" integer DEFAULT 0,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_file_type" CHECK (("file_type" = ANY (ARRAY['pdf'::"text", 'csv'::"text"]))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."bom_imports" OWNER TO "postgres";


COMMENT ON TABLE "public"."bom_imports" IS 'Tracks uploaded Bill of Materials files for parsing and import into product specifications.';



COMMENT ON COLUMN "public"."bom_imports"."status" IS 'Import status: pending (uploaded), processing (being parsed), completed (ready for review), failed (error occurred).';



CREATE TABLE IF NOT EXISTS "public"."bulk_import_sessions" (
    "id" "text" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "file_name" "text" NOT NULL,
    "parsed_data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bulk_import_sessions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'preview'::"text", 'confirmed'::"text", 'completed'::"text", 'completed_with_errors'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."bulk_import_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calculated_emissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "activity_data_id" "uuid" NOT NULL,
    "emissions_factor_id" "uuid" NOT NULL,
    "calculated_value_co2e" numeric NOT NULL,
    "calculation_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "impact_metrics" "jsonb"
);


ALTER TABLE "public"."calculated_emissions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."calculated_emissions"."impact_metrics" IS 'Multi-capital impacts for this specific emission source. Enables drill-down from aggregated facility totals.';



CREATE TABLE IF NOT EXISTS "public"."calculated_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "metric_type" "text" NOT NULL,
    "metric_value" numeric NOT NULL,
    "metric_unit" "text" NOT NULL,
    "activity_data_id" "uuid",
    "source_log_id" "uuid",
    "calculation_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reporting_period_start" "date",
    "reporting_period_end" "date",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."calculated_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."calculation_logs" (
    "log_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "input_data" "jsonb" NOT NULL,
    "output_value" numeric NOT NULL,
    "output_unit" "text" NOT NULL,
    "methodology_version" "text" NOT NULL,
    "factor_ids_used" "uuid"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calculation_id" "uuid",
    "multiplication_proof" "text",
    "input_uncertainty" "jsonb" DEFAULT '{}'::"jsonb",
    "output_uncertainty" numeric,
    "data_quality_tier" integer,
    "uncertainty_method" "text" DEFAULT 'root_sum_square'::"text",
    CONSTRAINT "chk_calculation_logs_factors_not_empty" CHECK (("array_length"("factor_ids_used", 1) > 0)),
    CONSTRAINT "chk_calculation_logs_input_not_empty" CHECK ((("jsonb_typeof"("input_data") = 'object'::"text") AND ("input_data" <> '{}'::"jsonb"))),
    CONSTRAINT "chk_calculation_logs_methodology_format" CHECK (("length"("methodology_version") >= 3)),
    CONSTRAINT "chk_calculation_logs_output_positive" CHECK (("output_value" >= (0)::numeric)),
    CONSTRAINT "chk_calculation_logs_unit_not_empty" CHECK (("length"(TRIM(BOTH FROM "output_unit")) > 0)),
    CONSTRAINT "chk_data_quality_tier_range" CHECK ((("data_quality_tier" IS NULL) OR (("data_quality_tier" >= 1) AND ("data_quality_tier" <= 3))))
);


ALTER TABLE "public"."calculation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."calculation_logs" IS 'Immutable audit ledger of all carbon calculations performed on the platform. Provides complete traceability with multi-tenant isolation. Once written, logs cannot be modified or deleted by the application layer.';



COMMENT ON COLUMN "public"."calculation_logs"."log_id" IS 'Unique identifier for each calculation log entry. Serves as the primary key for the audit trail.';



COMMENT ON COLUMN "public"."calculation_logs"."organization_id" IS 'Foreign key reference to the organisation that owns this calculation. Enables multi-tenant data isolation and ensures each calculation is attributed to the correct organisation.';



COMMENT ON COLUMN "public"."calculation_logs"."user_id" IS 'Foreign key reference to the authenticated user who performed the calculation. Provides user-level audit trail and accountability.';



COMMENT ON COLUMN "public"."calculation_logs"."input_data" IS 'Complete JSON snapshot of all user-provided input data for the calculation. Includes activity data, parameters, facility information, and any other inputs. Enables full reconstruction and verification of the calculation.';



COMMENT ON COLUMN "public"."calculation_logs"."output_value" IS 'The final calculated emissions value produced by the calculation engine. Stored as numeric for precision in compliance reporting.';



COMMENT ON COLUMN "public"."calculation_logs"."output_unit" IS 'Unit of measurement for the output value (e.g., "kgCO2e", "tCO2e", "MtCO2e"). Essential for correct interpretation and reporting of results.';



COMMENT ON COLUMN "public"."calculation_logs"."methodology_version" IS 'Version identifier of the calculation methodology used (e.g., "ghg_protocol_scope2_v2.1", "iso14064_v1.0"). Enables tracking of methodology changes over time and ensures reproducibility.';



COMMENT ON COLUMN "public"."calculation_logs"."factor_ids_used" IS 'Array of UUIDs referencing the emissions factors from public.emissions_factors that were used in this calculation. Provides complete traceability of factors and enables impact analysis when factors are updated.';



COMMENT ON COLUMN "public"."calculation_logs"."created_at" IS 'Immutable timestamp of when the calculation was performed and logged. Serves as the official record time for audit and compliance purposes.';



COMMENT ON COLUMN "public"."calculation_logs"."calculation_id" IS 'Foreign key reference to the calculated_emissions record that this log entry verifies. Provides direct linkage between audit logs and calculation results.';



COMMENT ON COLUMN "public"."calculation_logs"."multiplication_proof" IS 'Cryptographic proof string concatenating key calculation values for verification. Format: organization_id-activity_data_id-emissions_factor_id-calculated_value_co2e. Enables independent verification of calculation integrity.';



COMMENT ON COLUMN "public"."calculation_logs"."input_uncertainty" IS 'JSONB storing uncertainty data for each input parameter (percentage, tier, type)';



COMMENT ON COLUMN "public"."calculation_logs"."output_uncertainty" IS 'Combined uncertainty percentage for the calculated output (95% confidence level)';



COMMENT ON COLUMN "public"."calculation_logs"."data_quality_tier" IS 'GHG Protocol data quality tier: 1=Primary/Measured, 2=Site-specific, 3=Industry average';



COMMENT ON COLUMN "public"."calculation_logs"."uncertainty_method" IS 'Method used for uncertainty calculation (e.g., root_sum_square, monte_carlo)';



CREATE OR REPLACE VIEW "public"."calculation_statistics" AS
 SELECT "organization_id",
    "count"(*) AS "total_calculations",
    "sum"("output_value") AS "total_emissions",
    "avg"("output_value") AS "avg_emissions",
    "min"("created_at") AS "first_calculation",
    "max"("created_at") AS "last_calculation",
    "count"(DISTINCT "user_id") AS "unique_users",
    "count"(DISTINCT "methodology_version") AS "methodologies_used"
   FROM "public"."calculation_logs"
  GROUP BY "organization_id";


ALTER VIEW "public"."calculation_statistics" OWNER TO "postgres";


COMMENT ON VIEW "public"."calculation_statistics" IS 'Aggregated statistics for calculation logs by organisation. Automatically respects RLS policies, so users only see statistics for their own organisation.';



CREATE TABLE IF NOT EXISTS "public"."certification_audit_packages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "package_name" character varying(255) NOT NULL,
    "package_type" character varying(100),
    "description" "text",
    "created_date" "date" NOT NULL,
    "submission_deadline" "date",
    "submitted_date" "date",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "review_notes" "text",
    "included_requirements" "uuid"[],
    "included_evidence" "uuid"[],
    "executive_summary" "text",
    "methodology" "text",
    "generated_documents" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certification_audit_packages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certification_evidence_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "requirement_id" "uuid" NOT NULL,
    "source_module" character varying(100) NOT NULL,
    "source_table" character varying(100) NOT NULL,
    "source_record_id" "uuid" NOT NULL,
    "evidence_type" character varying(100),
    "evidence_description" "text",
    "evidence_date" "date",
    "relevance_notes" "text",
    "covers_requirement" boolean DEFAULT false,
    "verified_by" character varying(255),
    "verified_date" "date",
    "verification_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certification_evidence_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certification_framework_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "requirement_code" character varying(100) NOT NULL,
    "requirement_name" character varying(255) NOT NULL,
    "requirement_category" character varying(100),
    "parent_requirement_id" "uuid",
    "section" character varying(100),
    "subsection" character varying(100),
    "order_index" integer,
    "description" "text",
    "guidance" "text",
    "examples" "text",
    "max_points" numeric(5,2),
    "is_mandatory" boolean DEFAULT false,
    "is_conditional" boolean DEFAULT false,
    "conditional_logic" "text",
    "required_data_sources" "text"[],
    "evidence_requirements" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "requirement_code_alias" character varying(100),
    "requirement_name_alias" character varying(255),
    "points_available" numeric(5,2),
    "is_required" boolean DEFAULT false,
    "data_sources" "text"[]
);


ALTER TABLE "public"."certification_framework_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certification_frameworks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "framework_code" character varying(50) NOT NULL,
    "framework_name" character varying(255) NOT NULL,
    "framework_version" character varying(50),
    "description" "text",
    "governing_body" character varying(255),
    "website_url" "text",
    "is_active" boolean DEFAULT true,
    "effective_date" "date",
    "has_scoring" boolean DEFAULT true,
    "passing_score" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" character varying(255),
    "code" character varying(50),
    "version" character varying(50),
    "category" character varying(100) DEFAULT 'general'::character varying,
    "display_order" integer DEFAULT 0,
    "total_points" numeric(7,2) DEFAULT 0
);


ALTER TABLE "public"."certification_frameworks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certification_gap_analyses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "requirement_id" "uuid" NOT NULL,
    "analysis_date" "date" NOT NULL,
    "analyzed_by" character varying(255),
    "compliance_status" character varying(50) NOT NULL,
    "confidence_level" character varying(50),
    "current_score" numeric(5,2),
    "target_score" numeric(5,2),
    "gap_points" numeric(5,2),
    "current_state" "text",
    "required_state" "text",
    "gap_description" "text",
    "remediation_actions" "text",
    "estimated_effort" character varying(50),
    "priority" character varying(50),
    "target_completion_date" "date",
    "owner" character varying(255),
    "data_sources_checked" "text"[],
    "data_quality" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certification_gap_analyses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."certification_score_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "score_date" "date" NOT NULL,
    "overall_score" numeric(5,2),
    "category_scores" "jsonb",
    "requirements_met" integer,
    "requirements_partial" integer,
    "requirements_not_met" integer,
    "total_requirements" integer,
    "data_completeness" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."certification_score_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."product_carbon_footprint_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_carbon_footprint_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "material_type" "text",
    "quantity" numeric NOT NULL,
    "unit" "text",
    "country_of_origin" "text",
    "is_organic" boolean DEFAULT false,
    "is_regenerative" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "lca_sub_stage_id" bigint,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "material_name" "text",
    "unit_name" "text",
    "name" "text",
    "data_source" "text",
    "data_source_id" "text",
    "supplier_product_id" "uuid",
    "origin_country" "text",
    "is_organic_certified" boolean DEFAULT false,
    "packaging_category" "text",
    "label_printing_type" "text",
    "impact_climate" numeric,
    "impact_water" numeric,
    "impact_land" numeric,
    "impact_waste" numeric,
    "impact_source" "text",
    "impact_reference_id" "text",
    "impact_metadata" "jsonb",
    "data_priority" integer DEFAULT 3,
    "data_quality_tag" "text",
    "supplier_lca_id" "uuid",
    "confidence_score" integer,
    "methodology" "text",
    "source_reference" "text",
    "impact_climate_fossil" numeric DEFAULT 0,
    "impact_climate_biogenic" numeric DEFAULT 0,
    "impact_climate_dluc" numeric DEFAULT 0,
    "origin_address" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "origin_country_code" "text",
    "transport_mode" "text",
    "distance_km" numeric,
    "impact_transport" numeric DEFAULT 0,
    "impact_water_scarcity" numeric,
    "impact_terrestrial_ecotoxicity" numeric,
    "impact_freshwater_eutrophication" numeric,
    "impact_terrestrial_acidification" numeric,
    "impact_fossil_resource_scarcity" numeric,
    "category_type" "public"."material_category_type",
    "gwp_data_source" "text",
    "non_gwp_data_source" "text",
    "gwp_reference_id" "text",
    "non_gwp_reference_id" "text",
    "data_quality_grade" "text",
    "is_hybrid_source" boolean DEFAULT false,
    "geographic_scope" "text",
    "backfill_date" timestamp with time zone,
    "backfill_version" "text",
    "impact_ozone_depletion" numeric,
    "impact_photochemical_ozone_formation" numeric,
    "impact_ionising_radiation" numeric,
    "impact_particulate_matter" numeric,
    "impact_human_toxicity_carcinogenic" numeric,
    "impact_human_toxicity_non_carcinogenic" numeric,
    "impact_freshwater_ecotoxicity" numeric,
    "impact_marine_ecotoxicity" numeric,
    "impact_marine_eutrophication" numeric,
    "impact_mineral_resource_scarcity" numeric,
    "ef_climate_change_total" numeric,
    "ef_climate_change_fossil" numeric,
    "ef_climate_change_biogenic" numeric,
    "ef_climate_change_luluc" numeric,
    "ef_ozone_depletion" numeric,
    "ef_ionising_radiation" numeric,
    "ef_particulate_matter" numeric,
    "ef_photochemical_ozone_formation" numeric,
    "ef_human_toxicity_cancer" numeric,
    "ef_human_toxicity_non_cancer" numeric,
    "ef_acidification" numeric,
    "ef_eutrophication_freshwater" numeric,
    "ef_eutrophication_marine" numeric,
    "ef_eutrophication_terrestrial" numeric,
    "ef_ecotoxicity_freshwater" numeric,
    "ef_resource_use_fossils" numeric,
    "ef_resource_use_minerals_metals" numeric,
    "ef_water_use" numeric,
    "ef_land_use" numeric,
    "ef_single_score" numeric,
    "ef_normalised_impacts" "jsonb",
    "ef_weighted_impacts" "jsonb",
    "ef_calculated_at" timestamp with time zone,
    "ef_methodology_version" "text",
    "ch4_fossil_kg" numeric,
    "ch4_fossil_kg_co2e" numeric,
    "ch4_biogenic_kg" numeric,
    "ch4_biogenic_kg_co2e" numeric,
    "n2o_kg" numeric,
    "n2o_kg_co2e" numeric,
    "hfc_pfc_kg_co2e" numeric DEFAULT 0,
    "gwp_method" "text" DEFAULT 'IPCC AR6 GWP100'::"text",
    "gwp_ch4_fossil" numeric DEFAULT 29.8,
    "gwp_ch4_biogenic" numeric DEFAULT 27.2,
    "gwp_n2o" numeric DEFAULT 273,
    "ghg_data_quality" "text" DEFAULT 'secondary'::"text",
    "recyclability_score" numeric,
    "recycled_content_percentage" numeric DEFAULT 0,
    "is_reusable" boolean DEFAULT false,
    "is_compostable" boolean DEFAULT false,
    "end_of_life_pathway" "text",
    "ch4_kg" numeric DEFAULT 0,
    CONSTRAINT "check_impact_climate_non_negative" CHECK ((("impact_climate" IS NULL) OR ("impact_climate" >= (0)::numeric))),
    CONSTRAINT "check_impact_land_non_negative" CHECK ((("impact_land" IS NULL) OR ("impact_land" >= (0)::numeric))),
    CONSTRAINT "check_impact_waste_non_negative" CHECK ((("impact_waste" IS NULL) OR ("impact_waste" >= (0)::numeric))),
    CONSTRAINT "check_impact_water_non_negative" CHECK ((("impact_water" IS NULL) OR ("impact_water" >= (0)::numeric))),
    CONSTRAINT "check_valid_impact_source" CHECK ((("impact_source" IS NULL) OR ("impact_source" = ANY (ARRAY['primary_verified'::"text", 'secondary_modelled'::"text", 'hybrid_proxy'::"text"])))),
    CONSTRAINT "data_source_integrity" CHECK (((("data_source" = 'openlca'::"text") AND ("data_source_id" IS NOT NULL)) OR (("data_source" = 'supplier'::"text") AND ("supplier_product_id" IS NOT NULL)) OR ("data_source" IS NULL))),
    CONSTRAINT "label_printing_type_integrity" CHECK ((("label_printing_type" IS NULL) OR (("packaging_category" = 'label'::"text") AND ("label_printing_type" IS NOT NULL)))),
    CONSTRAINT "product_lca_materials_confidence_score_check" CHECK ((("confidence_score" >= 0) AND ("confidence_score" <= 100))),
    CONSTRAINT "product_lca_materials_data_priority_check" CHECK ((("data_priority" >= 1) AND ("data_priority" <= 3))),
    CONSTRAINT "product_lca_materials_data_quality_grade_check" CHECK (("data_quality_grade" = ANY (ARRAY['HIGH'::"text", 'MEDIUM'::"text", 'LOW'::"text"]))),
    CONSTRAINT "product_lca_materials_distance_km_check" CHECK ((("distance_km" IS NULL) OR ("distance_km" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_end_of_life_pathway_check" CHECK ((("end_of_life_pathway" IS NULL) OR ("end_of_life_pathway" = ANY (ARRAY['recycling'::"text", 'landfill'::"text", 'incineration'::"text", 'composting'::"text", 'anaerobic_digestion'::"text", 'reuse'::"text", 'mixed'::"text"])))),
    CONSTRAINT "product_lca_materials_impact_climate_biogenic_check" CHECK (("impact_climate_biogenic" >= (0)::numeric)),
    CONSTRAINT "product_lca_materials_impact_climate_dluc_check" CHECK (("impact_climate_dluc" >= (0)::numeric)),
    CONSTRAINT "product_lca_materials_impact_climate_fossil_check" CHECK (("impact_climate_fossil" >= (0)::numeric)),
    CONSTRAINT "product_lca_materials_impact_freshwater_ecotoxicity_check" CHECK ((("impact_freshwater_ecotoxicity" IS NULL) OR ("impact_freshwater_ecotoxicity" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_human_toxicity_carcinogenic_check" CHECK ((("impact_human_toxicity_carcinogenic" IS NULL) OR ("impact_human_toxicity_carcinogenic" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_human_toxicity_non_carcinoge_check" CHECK ((("impact_human_toxicity_non_carcinogenic" IS NULL) OR ("impact_human_toxicity_non_carcinogenic" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_ionising_radiation_check" CHECK ((("impact_ionising_radiation" IS NULL) OR ("impact_ionising_radiation" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_marine_ecotoxicity_check" CHECK ((("impact_marine_ecotoxicity" IS NULL) OR ("impact_marine_ecotoxicity" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_marine_eutrophication_check" CHECK ((("impact_marine_eutrophication" IS NULL) OR ("impact_marine_eutrophication" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_mineral_resource_scarcity_check" CHECK ((("impact_mineral_resource_scarcity" IS NULL) OR ("impact_mineral_resource_scarcity" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_ozone_depletion_check" CHECK ((("impact_ozone_depletion" IS NULL) OR ("impact_ozone_depletion" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_particulate_matter_check" CHECK ((("impact_particulate_matter" IS NULL) OR ("impact_particulate_matter" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_impact_photochemical_ozone_formatio_check" CHECK ((("impact_photochemical_ozone_formation" IS NULL) OR ("impact_photochemical_ozone_formation" >= (0)::numeric))),
    CONSTRAINT "product_lca_materials_material_or_name_required" CHECK ((("material_id" IS NOT NULL) OR ("name" IS NOT NULL))),
    CONSTRAINT "product_lca_materials_recyclability_score_check" CHECK ((("recyclability_score" IS NULL) OR (("recyclability_score" >= (0)::numeric) AND ("recyclability_score" <= (100)::numeric)))),
    CONSTRAINT "product_lca_materials_recycled_content_percentage_check" CHECK ((("recycled_content_percentage" IS NULL) OR (("recycled_content_percentage" >= (0)::numeric) AND ("recycled_content_percentage" <= (100)::numeric)))),
    CONSTRAINT "product_lca_materials_transport_mode_check" CHECK (("transport_mode" = ANY (ARRAY['truck'::"text", 'train'::"text", 'ship'::"text", 'air'::"text"]))),
    CONSTRAINT "valid_data_source" CHECK ((("data_source" IS NULL) OR ("data_source" = ANY (ARRAY['openlca'::"text", 'supplier'::"text"])))),
    CONSTRAINT "valid_origin_lat" CHECK ((("origin_lat" IS NULL) OR (("origin_lat" >= ('-90'::integer)::double precision) AND ("origin_lat" <= (90)::double precision)))),
    CONSTRAINT "valid_origin_lng" CHECK ((("origin_lng" IS NULL) OR (("origin_lng" >= ('-180'::integer)::double precision) AND ("origin_lng" <= (180)::double precision)))),
    CONSTRAINT "valid_packaging_category" CHECK ((("packaging_category" IS NULL) OR ("packaging_category" = ANY (ARRAY['container'::"text", 'label'::"text", 'closure'::"text", 'secondary'::"text"]))))
);


ALTER TABLE "public"."product_carbon_footprint_materials" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_carbon_footprint_materials" IS 'Materials (ingredients and packaging) associated with a Product Carbon Footprint.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."product_carbon_footprint_id" IS 'Foreign key linking to the parent Product Carbon Footprint.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."unit" IS 'Unit of measurement for the quantity (kg, L, g, ml, etc).';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."material_name" IS 'Cached display name of the material (denormalized for performance).';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."unit_name" IS 'Cached display name of the unit (denormalized for performance).';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."data_source" IS 'Data provenance flag indicating source: "openlca" for OpenLCA database, "supplier" for internal supplier network';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."data_source_id" IS 'External system identifier - stores OpenLCA process UUID or other external reference ID';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."supplier_product_id" IS 'Foreign key to supplier_products table when data_source is "supplier"';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."origin_country" IS 'Country or region of origin for the material, used for geographical correlation in LCA calculations';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."is_organic_certified" IS 'Indicates whether the material has organic certification, affecting carbon intensity calculations';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."packaging_category" IS 'Category for packaging materials: "container" (bottles, cans, packs), "label" (labels and printing), "closure" (caps, corks, seals), "secondary" (gift packs, delivery boxes). NULL for ingredient materials.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."label_printing_type" IS 'Printing method for label materials (e.g., digital, offset, flexographic, gravure, screen). Only applicable when packaging_category = "label".';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_climate" IS 'Climate change impact in kg CO2e per reference unit. Used for GHG Protocol and CSRD E1 reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_water" IS 'Water depletion impact per reference unit (m³ or L). Used for CSRD E3 water consumption reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_land" IS 'Land use impact in m² per reference unit. Used for CSRD E4 and TNFD biodiversity reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_waste" IS 'Waste generation in kg per reference unit. Used for circularity and CSRD E5 waste reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_source" IS 'Data provenance: "primary_verified" (user/supplier), "secondary_modelled" (Ecoinvent/OpenLCA), "hybrid_proxy" (mix of both)';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_reference_id" IS 'External reference: OpenLCA process UUID, Ecoinvent dataset ID, or staging_emission_factors.id';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_metadata" IS 'Additional provenance data: {lcia_method, ecoinvent_version, confidence_score, supplier_epd_url, verification_date}';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."data_priority" IS 'Data source priority: 1=Primary/Verified (Supplier EPD), 2=Regional/DEFRA (Government), 3=Secondary/Ecoinvent (Modelled)';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."data_quality_tag" IS 'Human-readable tag: Primary_Verified | Regional_Standard | Secondary_Modelled';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."supplier_lca_id" IS 'If data_priority=1, references the supplier product LCA that provided verified impact data';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."confidence_score" IS 'Data reliability score 0-100. Primary=95, Regional=85, Secondary=70, Proxy=50';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."methodology" IS 'Impact assessment method used: ISO 14067, ReCiPe 2016 Midpoint (H), GHG Protocol, etc.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."source_reference" IS 'Exact source citation for audit trail: "Supplier LCA abc-123", "DEFRA 2024 Natural Gas", "Ecoinvent 3.12 Sugar beet GLO"';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_climate_fossil" IS 'Fossil CO2e emissions (kg CO2e) - from fossil fuels, minerals. Per ISO 14067, reported in total but tracked separately.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_climate_biogenic" IS 'Biogenic CO2e emissions (kg CO2e) - from biomass, crops, forestry. Per ISO 14067, must be reported separately from fossil.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_climate_dluc" IS 'Direct Land Use Change CO2e (kg CO2e) - emissions from deforestation/land conversion. Per ISO 14067, reported separately.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."origin_address" IS 'Full formatted address from Google Places (e.g., "Munich, Bavaria, Germany"). Human-readable location for reports.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."origin_lat" IS 'Latitude coordinate for origin location (required for automated distance calculations). Range: -90 to 90.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."origin_lng" IS 'Longitude coordinate for origin location (required for automated distance calculations). Range: -180 to 180.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."origin_country_code" IS 'ISO country code (e.g., "GB", "DE", "FR") for filtering and compliance reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."transport_mode" IS 'Historical snapshot of transport mode used at LCA calculation time. Matches DEFRA freight categories.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."distance_km" IS 'Historical snapshot of distance in kilometres at LCA calculation time. Used for transport emissions calculation.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_transport" IS 'Transport emissions for this material in kg CO2e. Calculated as: (quantity_kg / 1000) × distance_km × DEFRA_emission_factor.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_water_scarcity" IS 'Water scarcity footprint in cubic metres world equivalent (m³ world eq.) - ReCiPe 2016 midpoint indicator';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_terrestrial_ecotoxicity" IS 'Terrestrial ecotoxicity potential in kg 1,4-dichlorobenzene equivalent (kg 1,4-DCB) - ReCiPe 2016 midpoint indicator';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_freshwater_eutrophication" IS 'Freshwater eutrophication potential in kg phosphorus equivalent (kg P eq.) - ReCiPe 2016 midpoint indicator';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_terrestrial_acidification" IS 'Terrestrial acidification potential in kg sulfur dioxide equivalent (kg SO₂ eq.) - ReCiPe 2016 midpoint indicator';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_fossil_resource_scarcity" IS 'Fossil resource scarcity in kg oil equivalent (kg oil eq.) - ReCiPe 2016 midpoint indicator';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."category_type" IS 'Snapshot of material category at calculation time';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."gwp_data_source" IS 'Source of GHG data: DEFRA, Ecoinvent, Supplier, OpenLCA, etc.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."non_gwp_data_source" IS 'Source of environmental impact data (non-GWP): Ecoinvent, Supplier, OpenLCA, etc.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."gwp_reference_id" IS 'Reference to specific DEFRA factor ID or Ecoinvent process UUID for GWP';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."non_gwp_reference_id" IS 'Reference to specific Ecoinvent process UUID for non-GWP impacts';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."data_quality_grade" IS 'Overall data quality assessment: HIGH (verified supplier), MEDIUM (DEFRA+Ecoinvent hybrid), LOW (distant proxies)';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."is_hybrid_source" IS 'True if GWP from one source (DEFRA) and non-GWP from another (Ecoinvent)';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."geographic_scope" IS 'Geographic representativeness: UK, EU, GLO (global), etc.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."backfill_date" IS 'Timestamp when record was backfilled with hybrid/enhanced data';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."backfill_version" IS 'Version identifier for backfill operation (e.g., "v1.0-hybrid-model")';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_ozone_depletion" IS 'Ozone depletion potential in kg CFC-11 equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_photochemical_ozone_formation" IS 'Photochemical ozone formation potential in kg NOx equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_ionising_radiation" IS 'Ionising radiation potential in kBq Cobalt-60 equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_particulate_matter" IS 'Particulate matter formation potential in kg PM2.5 equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_human_toxicity_carcinogenic" IS 'Human toxicity potential (carcinogenic) in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_human_toxicity_non_carcinogenic" IS 'Human toxicity potential (non-carcinogenic) in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_freshwater_ecotoxicity" IS 'Freshwater ecotoxicity potential in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_marine_ecotoxicity" IS 'Marine ecotoxicity potential in kg 1,4-dichlorobenzene equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_marine_eutrophication" IS 'Marine eutrophication potential in kg nitrogen equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."impact_mineral_resource_scarcity" IS 'Mineral resource scarcity in kg copper equivalent - ReCiPe 2016 midpoint';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_climate_change_total" IS 'EF 3.1 Climate Change - Total GWP in kg CO2 eq. Includes fossil, biogenic, and LULUC.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_climate_change_fossil" IS 'EF 3.1 Climate Change - Fossil-based emissions in kg CO2 eq.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_climate_change_biogenic" IS 'EF 3.1 Climate Change - Biogenic carbon emissions in kg CO2 eq per PEF methodology.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_climate_change_luluc" IS 'EF 3.1 Climate Change - Land Use and Land Use Change emissions in kg CO2 eq.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_ozone_depletion" IS 'EF 3.1 Ozone Depletion in kg CFC-11 eq. Measures stratospheric ozone layer destruction.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_ionising_radiation" IS 'EF 3.1 Ionising Radiation in kBq U235 eq. Human health effects from radioactive emissions.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_particulate_matter" IS 'EF 3.1 Particulate Matter in disease incidence. Respiratory effects from fine particles.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_photochemical_ozone_formation" IS 'EF 3.1 Photochemical Ozone Formation in kg NMVOC eq. Ground-level smog effects on human health.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_human_toxicity_cancer" IS 'EF 3.1 Human Toxicity (Cancer) in CTUh. Based on USEtox 2.12 consensus model.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_human_toxicity_non_cancer" IS 'EF 3.1 Human Toxicity (Non-Cancer) in CTUh. Based on USEtox 2.12 consensus model.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_acidification" IS 'EF 3.1 Acidification in mol H+ eq. Accumulated Exceedance method for terrestrial and aquatic acidification.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_eutrophication_freshwater" IS 'EF 3.1 Eutrophication (Freshwater) in kg P eq. Phosphorus enrichment of freshwater bodies.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_eutrophication_marine" IS 'EF 3.1 Eutrophication (Marine) in kg N eq. Nitrogen enrichment of marine ecosystems.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_eutrophication_terrestrial" IS 'EF 3.1 Eutrophication (Terrestrial) in mol N eq. Nitrogen deposition effects on land ecosystems.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_ecotoxicity_freshwater" IS 'EF 3.1 Ecotoxicity (Freshwater) in CTUe. Based on USEtox 2.12 ecosystem impact model.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_resource_use_fossils" IS 'EF 3.1 Resource Use (Fossils) in MJ. Abiotic depletion of fossil energy carriers.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_resource_use_minerals_metals" IS 'EF 3.1 Resource Use (Minerals and Metals) in kg Sb eq. Abiotic depletion using ultimate reserves.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_water_use" IS 'EF 3.1 Water Use in m3 world eq. AWARE method with user deprivation weighting.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_land_use" IS 'EF 3.1 Land Use in dimensionless pt. Soil Quality Index aggregating biotic production, erosion, filtration, groundwater.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_single_score" IS 'EF 3.1 Single Score (dimensionless). Normalised and weighted aggregation of all 16 impact categories.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_normalised_impacts" IS 'EF 3.1 Normalised impacts for all 16 categories (person-year equivalents based on EU27 2010 reference).';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_weighted_impacts" IS 'EF 3.1 Weighted impacts for all 16 categories (after applying EF weighting factors).';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_calculated_at" IS 'Timestamp when EF 3.1 impacts were calculated for this material.';



COMMENT ON COLUMN "public"."product_carbon_footprint_materials"."ef_methodology_version" IS 'EF methodology version used for calculation (e.g., "3.1", "3.0").';



COMMENT ON CONSTRAINT "data_source_integrity" ON "public"."product_carbon_footprint_materials" IS 'Ensures proper foreign references: openlca requires data_source_id, supplier requires supplier_product_id';



COMMENT ON CONSTRAINT "label_printing_type_integrity" ON "public"."product_carbon_footprint_materials" IS 'Ensures label_printing_type is only set when packaging_category is "label"';



COMMENT ON CONSTRAINT "product_lca_materials_material_or_name_required" ON "public"."product_carbon_footprint_materials" IS 'Ensures either material_id (reference) or name (direct entry) is provided';



COMMENT ON CONSTRAINT "valid_data_source" ON "public"."product_carbon_footprint_materials" IS 'Ensures data_source is either "openlca", "supplier", or NULL for backwards compatibility';



COMMENT ON CONSTRAINT "valid_packaging_category" ON "public"."product_carbon_footprint_materials" IS 'Ensures packaging_category is either "container", "label", "closure", "secondary", or NULL for ingredients';



CREATE TABLE IF NOT EXISTS "public"."product_carbon_footprints" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_name" "text" NOT NULL,
    "product_description" "text",
    "product_image_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "sourcing_methodology" "text",
    "functional_unit" "text" NOT NULL,
    "system_boundary" "text",
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "product_id" bigint,
    "lca_version" "text" DEFAULT '1.0'::"text",
    "lca_scope_type" "text" DEFAULT 'cradle-to-gate'::"text",
    "parent_lca_id" "uuid",
    "goal_and_scope_confirmed" boolean DEFAULT false,
    "goal_and_scope_confirmed_at" timestamp with time zone,
    "goal_and_scope_confirmed_by" "uuid",
    "draft_data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_draft" boolean DEFAULT true,
    "ingredients_complete" boolean DEFAULT false,
    "packaging_complete" boolean DEFAULT false,
    "production_complete" boolean DEFAULT false,
    "aggregated_impacts" "jsonb",
    "csrd_compliant" boolean DEFAULT false,
    "reference_year" integer NOT NULL,
    "data_quality_summary" "jsonb" DEFAULT '{}'::"jsonb",
    "lca_methodology" "text" DEFAULT 'recipe_2016'::"text",
    "ef31_impacts" "jsonb",
    "ef31_single_score" numeric,
    "ef31_calculated_at" timestamp with time zone,
    "weighting_set_id" "uuid",
    "ef31_recalculation_status" "text",
    "ef31_recalculation_requested_at" timestamp with time zone,
    "ef31_recalculation_error" "text",
    "ef31_recalculation_attempts" integer DEFAULT 0,
    "total_ghg_emissions" numeric DEFAULT 0,
    "total_ghg_emissions_fossil" numeric DEFAULT 0,
    "total_ghg_emissions_biogenic" numeric DEFAULT 0,
    "total_ghg_emissions_dluc" numeric DEFAULT 0,
    "total_ghg_raw_materials" numeric DEFAULT 0,
    "total_ghg_processing" numeric DEFAULT 0,
    "total_ghg_packaging" numeric DEFAULT 0,
    "total_ghg_transport" numeric DEFAULT 0,
    "total_ghg_use" numeric DEFAULT 0,
    "total_ghg_end_of_life" numeric DEFAULT 0,
    "per_unit_emissions_verified" boolean DEFAULT false,
    "bulk_volume_per_functional_unit" numeric,
    "volume_unit" "text",
    CONSTRAINT "chk_reference_year_range" CHECK ((("reference_year" >= 2000) AND ("reference_year" <= 2100))),
    CONSTRAINT "valid_status" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."product_carbon_footprints" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_carbon_footprints" IS 'Product Carbon Footprint (PCF) records - aligned with ISO 14067 and GHG Protocol Product Standard';



COMMENT ON COLUMN "public"."product_carbon_footprints"."functional_unit" IS 'The functional unit for the LCA assessment (e.g., "250 ml", "1 kg"). Derived from product unit size.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."system_boundary" IS 'System boundary description (cradle-to-gate, cradle-to-grave, etc.). Nullable to support draft creation.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."status" IS 'Current status of the LCA: draft (being edited), pending (calculating), completed (finished), or failed (error occurred).';



COMMENT ON COLUMN "public"."product_carbon_footprints"."product_id" IS 'Foreign key linking this LCA to the source product. NULL for standalone LCAs.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."lca_version" IS 'Version identifier for tracking LCA iterations (e.g., "1.0", "2.0")';



COMMENT ON COLUMN "public"."product_carbon_footprints"."lca_scope_type" IS 'System boundary scope: "cradle-to-gate" or "cradle-to-grave"';



COMMENT ON COLUMN "public"."product_carbon_footprints"."parent_lca_id" IS 'Links extended LCAs to their parent version (e.g., v2.0 references v1.0)';



COMMENT ON COLUMN "public"."product_carbon_footprints"."goal_and_scope_confirmed" IS 'ISO 14044 compliance: Has user confirmed goal and scope definition?';



COMMENT ON COLUMN "public"."product_carbon_footprints"."draft_data" IS 'JSONB storage for in-progress data entries before finalization';



COMMENT ON COLUMN "public"."product_carbon_footprints"."is_draft" IS 'TRUE if any section is incomplete; FALSE when all data finalized';



COMMENT ON COLUMN "public"."product_carbon_footprints"."aggregated_impacts" IS 'Sum of all material-level impact_metrics. Used for Company Vitality dashboard and CSRD reporting.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."csrd_compliant" IS 'True if entire product LCA used OpenLCA/Ecoinvent (no proxy data). CSRD audit requirement.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."reference_year" IS 'ISO 14067 Temporal Anchoring: Financial year for facility operational data (e.g., 2024). Ensures emissions and production volumes are from the same period.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."data_quality_summary" IS 'JSON summary: {score: 85, rating: "High", breakdown: {primary_share: "60%", regional_share: "10%", secondary_share: "30%"}}';



COMMENT ON COLUMN "public"."product_carbon_footprints"."lca_methodology" IS 'Primary LCA methodology: "recipe_2016" (ReCiPe 2016 Midpoint) or "ef_31" (Environmental Footprint 3.1).';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_impacts" IS 'EF 3.1 aggregated impacts with all 16 categories, normalised values, weighted values, and single score.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_single_score" IS 'EF 3.1 aggregated single score (dimensionless) for easy comparison.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_calculated_at" IS 'Timestamp when EF 3.1 calculation was last performed.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."weighting_set_id" IS 'Custom weighting set used for EF 3.1 single score calculation. NULL uses default EF weights.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_recalculation_status" IS 'EF 3.1 recalculation status: NULL (not requested), "pending", "processing", "completed", "failed".';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_recalculation_requested_at" IS 'When EF 3.1 recalculation was requested.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_recalculation_error" IS 'Error message if EF 3.1 recalculation failed.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."ef31_recalculation_attempts" IS 'Number of EF 3.1 recalculation attempts.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."total_ghg_emissions" IS 'Total GHG emissions per functional unit (kg CO2e per bottle/can). This is the emissions for ONE consumer unit.';



COMMENT ON COLUMN "public"."product_carbon_footprints"."total_ghg_emissions_fossil" IS 'Fossil-based GHG emissions in kg CO2e';



COMMENT ON COLUMN "public"."product_carbon_footprints"."total_ghg_emissions_biogenic" IS 'Biogenic GHG emissions in kg CO2e';



COMMENT ON COLUMN "public"."product_carbon_footprints"."total_ghg_emissions_dluc" IS 'Direct Land Use Change emissions in kg CO2e';



COMMENT ON COLUMN "public"."product_carbon_footprints"."per_unit_emissions_verified" IS 'TRUE if emissions have been verified to be per consumer unit, FALSE if legacy data may be per bulk volume';



COMMENT ON COLUMN "public"."product_carbon_footprints"."bulk_volume_per_functional_unit" IS 'Bulk volume represented by one functional unit (e.g., 0.7 L for a 700ml bottle, 0.33 L for 330ml can)';



COMMENT ON COLUMN "public"."product_carbon_footprints"."volume_unit" IS 'Unit of measurement for bulk_volume_per_functional_unit (typically L or ml)';



CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" bigint NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "unit_size_value" numeric,
    "unit_size_unit" "text",
    "image_url" "text",
    "certifications" "jsonb",
    "awards" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "product_description" "text",
    "product_image_url" "text",
    "functional_unit" "text",
    "components" "jsonb" DEFAULT '[]'::"jsonb",
    "upstream_ingredients_complete" boolean DEFAULT false,
    "upstream_packaging_complete" boolean DEFAULT false,
    "core_operations_complete" boolean DEFAULT false,
    "downstream_distribution_complete" boolean DEFAULT false,
    "use_end_of_life_complete" boolean DEFAULT false,
    "core_operations_data" "jsonb" DEFAULT '{}'::"jsonb",
    "core_operations_facility_id" "uuid",
    "core_operations_provenance" "text",
    "has_active_lca" boolean DEFAULT false,
    "latest_lca_id" "uuid",
    "is_draft" boolean DEFAULT false NOT NULL,
    "system_boundary" "public"."system_boundary_enum" DEFAULT 'cradle_to_gate'::"public"."system_boundary_enum" NOT NULL,
    "product_category" "text",
    "passport_enabled" boolean DEFAULT false,
    "passport_token" "text",
    "passport_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "passport_views_count" integer DEFAULT 0,
    "passport_last_viewed_at" timestamp with time zone,
    "packaging_circularity_score" numeric,
    "material_circularity_indicator" numeric,
    CONSTRAINT "products_material_circularity_indicator_check" CHECK ((("material_circularity_indicator" IS NULL) OR (("material_circularity_indicator" >= (0)::numeric) AND ("material_circularity_indicator" <= (1)::numeric)))),
    CONSTRAINT "products_packaging_circularity_score_check" CHECK ((("packaging_circularity_score" IS NULL) OR (("packaging_circularity_score" >= (0)::numeric) AND ("packaging_circularity_score" <= (100)::numeric))))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


COMMENT ON TABLE "public"."products" IS 'Master table for all products within an organization. A single product can have multiple LCAs.';



COMMENT ON COLUMN "public"."products"."organization_id" IS 'Foreign key to the user''s organization for multi-tenancy.';



COMMENT ON COLUMN "public"."products"."sku" IS 'Stock Keeping Unit - unique identifier for product inventory management';



COMMENT ON COLUMN "public"."products"."certifications" IS 'e.g., [{"name": "B Corp", "evidence_url": "...", "expiry_date": "..."}]';



COMMENT ON COLUMN "public"."products"."awards" IS 'e.g., [{"name": "Gold Medal 2024", "awarded_by": "..."}]';



COMMENT ON COLUMN "public"."products"."is_draft" IS 'Indicates if the product is a draft (incomplete) or finalized';



COMMENT ON COLUMN "public"."products"."system_boundary" IS 'Defines the scope of the LCA calculation: cradle_to_gate (raw materials to factory gate) or cradle_to_grave (complete lifecycle). Controls downstream data requirements and compliance scope.';



COMMENT ON COLUMN "public"."products"."product_category" IS 'Product category used to match with industry average emission factors when specific facility data is unavailable';



COMMENT ON COLUMN "public"."products"."passport_enabled" IS 'Controls whether this product has a public-facing passport page accessible without authentication';



COMMENT ON COLUMN "public"."products"."passport_token" IS 'Unique secure token used in public passport URLs. Generated automatically when passport is enabled.';



COMMENT ON COLUMN "public"."products"."passport_settings" IS 'JSON settings for passport display preferences (e.g., which metrics to show/hide, branding options)';



COMMENT ON COLUMN "public"."products"."passport_views_count" IS 'Total number of times this product passport has been viewed publicly';



COMMENT ON COLUMN "public"."products"."passport_last_viewed_at" IS 'Timestamp of the most recent public passport view';



CREATE OR REPLACE VIEW "public"."circularity_metrics_summary" AS
 SELECT "p"."organization_id",
    ("count"(DISTINCT "p"."id"))::integer AS "total_products",
    "avg"("p"."packaging_circularity_score") AS "avg_packaging_circularity",
    "avg"("p"."material_circularity_indicator") AS "avg_mci",
    "avg"("plm"."recycled_content_percentage") AS "avg_recycled_content",
    "avg"("plm"."recyclability_score") AS "avg_recyclability",
    ((("sum"(
        CASE
            WHEN "plm"."is_reusable" THEN 1
            ELSE 0
        END))::numeric / (NULLIF("count"("plm"."id"), 0))::numeric) * (100)::numeric) AS "reusable_materials_percentage",
    ((("sum"(
        CASE
            WHEN "plm"."is_compostable" THEN 1
            ELSE 0
        END))::numeric / (NULLIF("count"("plm"."id"), 0))::numeric) * (100)::numeric) AS "compostable_materials_percentage",
    ("count"(DISTINCT "plm"."id"))::integer AS "total_materials_assessed"
   FROM (("public"."products" "p"
     LEFT JOIN "public"."product_carbon_footprints" "pl" ON ((("pl"."product_id" = "p"."id") AND ("pl"."status" = 'completed'::"text"))))
     LEFT JOIN "public"."product_carbon_footprint_materials" "plm" ON (("plm"."product_carbon_footprint_id" = "pl"."id")))
  GROUP BY "p"."organization_id";


ALTER VIEW "public"."circularity_metrics_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."circularity_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "target_year" integer NOT NULL,
    "waste_diversion_target" numeric,
    "recycled_content_target" numeric,
    "circularity_score_target" numeric,
    "virgin_plastic_reduction_target" numeric,
    "packaging_recyclability_target" numeric,
    "zero_waste_to_landfill_target" boolean DEFAULT false,
    "baseline_year" integer,
    "baseline_waste_diversion" numeric,
    "baseline_recycled_content" numeric,
    "notes" "text",
    "approved_by" "uuid",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "circularity_targets_baseline_year_check" CHECK ((("baseline_year" IS NULL) OR (("baseline_year" >= 2010) AND ("baseline_year" <= 2100)))),
    CONSTRAINT "circularity_targets_circularity_score_target_check" CHECK ((("circularity_score_target" IS NULL) OR (("circularity_score_target" >= (0)::numeric) AND ("circularity_score_target" <= (100)::numeric)))),
    CONSTRAINT "circularity_targets_packaging_recyclability_target_check" CHECK ((("packaging_recyclability_target" IS NULL) OR (("packaging_recyclability_target" >= (0)::numeric) AND ("packaging_recyclability_target" <= (100)::numeric)))),
    CONSTRAINT "circularity_targets_recycled_content_target_check" CHECK ((("recycled_content_target" IS NULL) OR (("recycled_content_target" >= (0)::numeric) AND ("recycled_content_target" <= (100)::numeric)))),
    CONSTRAINT "circularity_targets_target_year_check" CHECK ((("target_year" >= 2020) AND ("target_year" <= 2100))),
    CONSTRAINT "circularity_targets_virgin_plastic_reduction_target_check" CHECK ((("virgin_plastic_reduction_target" IS NULL) OR (("virgin_plastic_reduction_target" >= (0)::numeric) AND ("virgin_plastic_reduction_target" <= (100)::numeric)))),
    CONSTRAINT "circularity_targets_waste_diversion_target_check" CHECK ((("waste_diversion_target" IS NULL) OR (("waste_diversion_target" >= (0)::numeric) AND ("waste_diversion_target" <= (100)::numeric))))
);


ALTER TABLE "public"."circularity_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "facility_type_id" "uuid",
    "functions" "text"[] DEFAULT '{}'::"text"[],
    "operational_control" "public"."operational_control_enum" DEFAULT 'owned'::"public"."operational_control_enum",
    "address_line1" "text",
    "address_city" "text",
    "address_country" "text",
    "address_postcode" "text",
    "address_lat" numeric(10,7),
    "address_lng" numeric(10,7),
    "location_country_code" "text",
    "location_city" "text",
    "location_address" "text",
    "latitude" double precision,
    "longitude" double precision
);


ALTER TABLE "public"."facilities" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facilities"."functions" IS 'Array of facility functions: Brewing, Bottling, Warehousing, etc.';



COMMENT ON COLUMN "public"."facilities"."operational_control" IS 'Determines scope classification: owned = Scope 1&2, third_party = Scope 3';



COMMENT ON COLUMN "public"."facilities"."address_line1" IS 'Street address for grid emission factor selection';



COMMENT ON COLUMN "public"."facilities"."address_country" IS 'Country code for regional emission factors';



COMMENT ON COLUMN "public"."facilities"."location_country_code" IS 'ISO 3166-1 alpha-2 country code for facility location. Used for spatially-explicit AWARE water scarcity factors (CSRD E3).';



CREATE TABLE IF NOT EXISTS "public"."facility_activity_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "activity_category" "public"."facility_activity_category_enum" NOT NULL,
    "activity_date" "date" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "data_provenance" "public"."data_provenance_enum" DEFAULT 'secondary_modelled_industry_average'::"public"."data_provenance_enum" NOT NULL,
    "confidence_score" integer,
    "allocation_basis" "public"."allocation_basis_enum" DEFAULT 'none'::"public"."allocation_basis_enum",
    "brand_volume_reported" numeric,
    "total_facility_volume_reported" numeric,
    "allocation_percentage" numeric,
    "original_facility_value" numeric,
    "water_source_type" "public"."water_source_type_enum",
    "water_classification" "public"."water_classification_enum",
    "wastewater_treatment_method" "public"."wastewater_treatment_method_enum",
    "water_recycling_rate_percent" numeric,
    "water_stress_area_flag" boolean DEFAULT false,
    "waste_category" "public"."waste_category_enum",
    "waste_treatment_method" "public"."waste_treatment_method_enum",
    "waste_recovery_percentage" numeric,
    "hazard_classification" "text",
    "disposal_facility_type" "text",
    "source_facility_id" "uuid",
    "source_attestation_url" "text",
    "supplier_submission_id" "uuid",
    "emission_factor_id" "uuid",
    "calculated_emissions_kg_co2e" numeric,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reporting_session_id" "uuid",
    CONSTRAINT "facility_activity_entries_allocation_percentage_check" CHECK ((("allocation_percentage" IS NULL) OR (("allocation_percentage" >= (0)::numeric) AND ("allocation_percentage" <= (100)::numeric)))),
    CONSTRAINT "facility_activity_entries_brand_volume_reported_check" CHECK ((("brand_volume_reported" IS NULL) OR ("brand_volume_reported" >= (0)::numeric))),
    CONSTRAINT "facility_activity_entries_calculated_emissions_kg_co2e_check" CHECK ((("calculated_emissions_kg_co2e" IS NULL) OR ("calculated_emissions_kg_co2e" >= (0)::numeric))),
    CONSTRAINT "facility_activity_entries_confidence_score_check" CHECK ((("confidence_score" >= 0) AND ("confidence_score" <= 100))),
    CONSTRAINT "facility_activity_entries_disposal_facility_type_check" CHECK ((("disposal_facility_type" IS NULL) OR ("disposal_facility_type" = ANY (ARRAY['in_house'::"text", 'third_party_licensed'::"text", 'unspecified'::"text"])))),
    CONSTRAINT "facility_activity_entries_hazard_classification_check" CHECK ((("hazard_classification" IS NULL) OR ("hazard_classification" = ANY (ARRAY['non_hazardous'::"text", 'hazardous'::"text", 'unknown'::"text"])))),
    CONSTRAINT "facility_activity_entries_original_facility_value_check" CHECK ((("original_facility_value" IS NULL) OR ("original_facility_value" >= (0)::numeric))),
    CONSTRAINT "facility_activity_entries_quantity_check" CHECK (("quantity" >= (0)::numeric)),
    CONSTRAINT "facility_activity_entries_total_facility_volume_reported_check" CHECK ((("total_facility_volume_reported" IS NULL) OR ("total_facility_volume_reported" > (0)::numeric))),
    CONSTRAINT "facility_activity_entries_waste_recovery_percentage_check" CHECK ((("waste_recovery_percentage" IS NULL) OR (("waste_recovery_percentage" >= (0)::numeric) AND ("waste_recovery_percentage" <= (100)::numeric)))),
    CONSTRAINT "facility_activity_entries_water_recycling_rate_percent_check" CHECK ((("water_recycling_rate_percent" IS NULL) OR (("water_recycling_rate_percent" >= (0)::numeric) AND ("water_recycling_rate_percent" <= (100)::numeric))))
);


ALTER TABLE "public"."facility_activity_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_activity_entries" IS 'Unified storage for facility activity data with Glass Box provenance tracking. Scope-neutral design.';



CREATE OR REPLACE VIEW "public"."facility_water_summary" AS
 WITH "water_data" AS (
         SELECT "fae"."facility_id",
            "fae"."organization_id",
            "fae"."reporting_period_start",
            "fae"."reporting_period_end",
                CASE
                    WHEN ("fae"."activity_category" = 'water_intake'::"public"."facility_activity_category_enum") THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "intake_m3",
                CASE
                    WHEN (("fae"."activity_category" = 'water_intake'::"public"."facility_activity_category_enum") AND ("fae"."water_source_type" = 'municipal'::"public"."water_source_type_enum")) THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "municipal_m3",
                CASE
                    WHEN (("fae"."activity_category" = 'water_intake'::"public"."facility_activity_category_enum") AND ("fae"."water_source_type" = 'groundwater'::"public"."water_source_type_enum")) THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "groundwater_m3",
                CASE
                    WHEN (("fae"."activity_category" = 'water_intake'::"public"."facility_activity_category_enum") AND ("fae"."water_source_type" = 'surface_water'::"public"."water_source_type_enum")) THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "surface_m3",
                CASE
                    WHEN (("fae"."activity_category" = 'water_intake'::"public"."facility_activity_category_enum") AND ("fae"."water_source_type" = 'rainwater'::"public"."water_source_type_enum")) THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "rainwater_m3",
                CASE
                    WHEN ("fae"."activity_category" = 'water_discharge'::"public"."facility_activity_category_enum") THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "discharge_m3",
                CASE
                    WHEN ("fae"."activity_category" = 'water_recycled'::"public"."facility_activity_category_enum") THEN "fae"."quantity"
                    ELSE (0)::numeric
                END AS "recycled_m3",
            "fae"."data_provenance"
           FROM "public"."facility_activity_entries" "fae"
          WHERE (("fae"."activity_category" = ANY (ARRAY['water_intake'::"public"."facility_activity_category_enum", 'water_discharge'::"public"."facility_activity_category_enum", 'water_recycled'::"public"."facility_activity_category_enum"])) AND ("fae"."reporting_period_start" >= (CURRENT_DATE - '1 year'::interval)))
        )
 SELECT "f"."id" AS "facility_id",
    "f"."organization_id",
    "f"."name" AS "facility_name",
    "f"."address_city" AS "city",
    "f"."address_country" AS "country",
    "f"."location_country_code" AS "country_code",
    "f"."address_lat" AS "latitude",
    "f"."address_lng" AS "longitude",
    COALESCE("sum"("wd"."intake_m3"), (0)::numeric) AS "total_consumption_m3",
    COALESCE("sum"("wd"."municipal_m3"), (0)::numeric) AS "municipal_consumption_m3",
    COALESCE("sum"("wd"."groundwater_m3"), (0)::numeric) AS "groundwater_consumption_m3",
    COALESCE("sum"("wd"."surface_m3"), (0)::numeric) AS "surface_water_consumption_m3",
    COALESCE("sum"("wd"."rainwater_m3"), (0)::numeric) AS "rainwater_consumption_m3",
    COALESCE("sum"("wd"."recycled_m3"), (0)::numeric) AS "recycled_consumption_m3",
    COALESCE("sum"("wd"."discharge_m3"), (0)::numeric) AS "total_discharge_m3",
    GREATEST((COALESCE("sum"("wd"."intake_m3"), (0)::numeric) - COALESCE("sum"("wd"."discharge_m3"), (0)::numeric)), (0)::numeric) AS "net_consumption_m3",
    COALESCE("af"."aware_factor", (1)::numeric) AS "aware_factor",
    (GREATEST((COALESCE("sum"("wd"."intake_m3"), (0)::numeric) - COALESCE("sum"("wd"."discharge_m3"), (0)::numeric)), (0)::numeric) * COALESCE("af"."aware_factor", (1)::numeric)) AS "scarcity_weighted_consumption_m3",
        CASE
            WHEN (COALESCE("af"."aware_factor", (1)::numeric) >= (10)::numeric) THEN 'high'::"text"
            WHEN (COALESCE("af"."aware_factor", (1)::numeric) >= (1)::numeric) THEN 'medium'::"text"
            ELSE 'low'::"text"
        END AS "risk_level",
        CASE
            WHEN (COALESCE("sum"("wd"."intake_m3"), (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("sum"("wd"."recycled_m3"), (0)::numeric) / "sum"("wd"."intake_m3")) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "recycling_rate_percent",
    NULL::numeric AS "avg_water_intensity_m3_per_unit",
    "count"(DISTINCT
        CASE
            WHEN (("wd"."intake_m3" > (0)::numeric) OR ("wd"."discharge_m3" > (0)::numeric) OR ("wd"."recycled_m3" > (0)::numeric)) THEN 1
            ELSE NULL::integer
        END) AS "data_points_count",
    "count"(DISTINCT
        CASE
            WHEN ("wd"."data_provenance" = ANY (ARRAY['primary_supplier_verified'::"public"."data_provenance_enum", 'primary_measured_onsite'::"public"."data_provenance_enum"])) THEN 1
            ELSE NULL::integer
        END) AS "measured_data_points",
    "min"("wd"."reporting_period_start") AS "earliest_data",
    "max"("wd"."reporting_period_end") AS "latest_data"
   FROM (("public"."facilities" "f"
     LEFT JOIN "water_data" "wd" ON (("f"."id" = "wd"."facility_id")))
     LEFT JOIN "public"."aware_factors" "af" ON (("f"."location_country_code" = "af"."country_code")))
  GROUP BY "f"."id", "f"."organization_id", "f"."name", "f"."address_city", "f"."address_country", "f"."location_country_code", "f"."address_lat", "f"."address_lng", "af"."aware_factor";


ALTER VIEW "public"."facility_water_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."production_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "volume" double precision NOT NULL,
    "unit" "text" DEFAULT 'Litre'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "units_produced" numeric,
    "product_sku" "text",
    "conversion_factor" numeric DEFAULT 1,
    CONSTRAINT "production_logs_unit_check" CHECK (("unit" = ANY (ARRAY['Litre'::"text", 'Hectolitre'::"text", 'Unit'::"text"]))),
    CONSTRAINT "production_logs_volume_check" CHECK (("volume" > (0)::double precision))
);


ALTER TABLE "public"."production_logs" OWNER TO "postgres";


COMMENT ON COLUMN "public"."production_logs"."volume" IS 'Bulk volume produced (litres, hectolitres). OPTIONAL - for backwards compatibility.';



COMMENT ON COLUMN "public"."production_logs"."units_produced" IS 'Number of consumer units produced (bottles, cans, packages). This is the PRIMARY production metric.';



COMMENT ON COLUMN "public"."production_logs"."conversion_factor" IS 'Conversion factor from bulk volume to units (e.g., 142.86 bottles per hectolitre for 700ml bottles)';



CREATE OR REPLACE VIEW "public"."company_water_overview" AS
 WITH "facility_totals" AS (
         SELECT "facility_water_summary"."organization_id",
            "sum"("facility_water_summary"."total_consumption_m3") AS "operational_intake_m3",
            "sum"("facility_water_summary"."total_discharge_m3") AS "operational_discharge_m3",
            "sum"("facility_water_summary"."net_consumption_m3") AS "operational_net_m3",
            "sum"("facility_water_summary"."scarcity_weighted_consumption_m3") AS "operational_scarcity_weighted_m3",
            "sum"("facility_water_summary"."municipal_consumption_m3") AS "municipal_m3",
            "sum"("facility_water_summary"."groundwater_consumption_m3") AS "groundwater_m3",
            "sum"("facility_water_summary"."surface_water_consumption_m3") AS "surface_m3",
            "sum"("facility_water_summary"."rainwater_consumption_m3") AS "rainwater_m3",
            "sum"("facility_water_summary"."recycled_consumption_m3") AS "recycled_m3",
            "avg"("facility_water_summary"."aware_factor") AS "avg_aware",
            "avg"("facility_water_summary"."recycling_rate_percent") AS "avg_recycling",
            "count"(
                CASE
                    WHEN ("facility_water_summary"."risk_level" = 'high'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "high_risk",
            "count"(
                CASE
                    WHEN ("facility_water_summary"."risk_level" = 'medium'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "medium_risk",
            "count"(
                CASE
                    WHEN ("facility_water_summary"."risk_level" = 'low'::"text") THEN 1
                    ELSE NULL::integer
                END) AS "low_risk",
            "count"(*) AS "total_facilities"
           FROM "public"."facility_water_summary"
          WHERE (("facility_water_summary"."total_consumption_m3" > (0)::numeric) OR ("facility_water_summary"."total_discharge_m3" > (0)::numeric))
          GROUP BY "facility_water_summary"."organization_id"
        ), "embedded_water" AS (
         SELECT "pcf"."organization_id",
            "sum"((COALESCE((("pcf"."aggregated_impacts" ->> 'water_consumption'::"text"))::numeric, (0)::numeric) * COALESCE("pl"."units_produced", (1)::numeric))) AS "embedded_m3",
            "sum"((COALESCE((("pcf"."aggregated_impacts" ->> 'water_scarcity_aware'::"text"))::numeric, (0)::numeric) * COALESCE("pl"."units_produced", (1)::numeric))) AS "embedded_scarcity_m3"
           FROM ("public"."product_carbon_footprints" "pcf"
             LEFT JOIN "public"."production_logs" "pl" ON (("pcf"."product_id" = "pl"."product_id")))
          WHERE (("pcf"."status" = 'completed'::"text") AND ("pcf"."aggregated_impacts" IS NOT NULL))
          GROUP BY "pcf"."organization_id"
        )
 SELECT COALESCE("ft"."organization_id", "ew"."organization_id") AS "organization_id",
    COALESCE("ft"."operational_intake_m3", (0)::numeric) AS "operational_intake_m3",
    COALESCE("ft"."operational_discharge_m3", (0)::numeric) AS "operational_discharge_m3",
    COALESCE("ft"."operational_net_m3", (0)::numeric) AS "operational_net_m3",
    COALESCE("ft"."operational_scarcity_weighted_m3", (0)::numeric) AS "operational_scarcity_weighted_m3",
    COALESCE("ew"."embedded_m3", (0)::numeric) AS "embedded_water_m3",
    COALESCE("ew"."embedded_scarcity_m3", (0)::numeric) AS "embedded_scarcity_weighted_m3",
    (COALESCE("ft"."operational_net_m3", (0)::numeric) + COALESCE("ew"."embedded_m3", (0)::numeric)) AS "total_water_footprint_m3",
    (COALESCE("ft"."operational_scarcity_weighted_m3", (0)::numeric) + COALESCE("ew"."embedded_scarcity_m3", (0)::numeric)) AS "total_scarcity_weighted_m3",
    COALESCE("ft"."operational_intake_m3", (0)::numeric) AS "total_consumption_m3",
    COALESCE("ft"."operational_net_m3", (0)::numeric) AS "net_consumption_m3",
    COALESCE("ft"."operational_scarcity_weighted_m3", (0)::numeric) AS "scarcity_weighted_consumption_m3",
    COALESCE("ft"."municipal_m3", (0)::numeric) AS "municipal_consumption_m3",
    COALESCE("ft"."groundwater_m3", (0)::numeric) AS "groundwater_consumption_m3",
    COALESCE("ft"."surface_m3", (0)::numeric) AS "surface_water_consumption_m3",
    COALESCE("ft"."rainwater_m3", (0)::numeric) AS "rainwater_consumption_m3",
    COALESCE("ft"."recycled_m3", (0)::numeric) AS "recycled_consumption_m3",
    COALESCE("ft"."operational_discharge_m3", (0)::numeric) AS "total_discharge_m3",
        CASE
            WHEN (COALESCE("ft"."operational_intake_m3", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("ft"."municipal_m3", (0)::numeric) / "ft"."operational_intake_m3") * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "municipal_percent",
        CASE
            WHEN (COALESCE("ft"."operational_intake_m3", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("ft"."groundwater_m3", (0)::numeric) / "ft"."operational_intake_m3") * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "groundwater_percent",
        CASE
            WHEN (COALESCE("ft"."operational_intake_m3", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("ft"."surface_m3", (0)::numeric) / "ft"."operational_intake_m3") * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "surface_water_percent",
        CASE
            WHEN (COALESCE("ft"."operational_intake_m3", (0)::numeric) > (0)::numeric) THEN "round"(((COALESCE("ft"."recycled_m3", (0)::numeric) / "ft"."operational_intake_m3") * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "recycled_percent",
    COALESCE("ft"."high_risk", (0)::bigint) AS "high_risk_facilities",
    COALESCE("ft"."medium_risk", (0)::bigint) AS "medium_risk_facilities",
    COALESCE("ft"."low_risk", (0)::bigint) AS "low_risk_facilities",
    COALESCE("ft"."total_facilities", (0)::bigint) AS "total_facilities",
    COALESCE("ft"."avg_aware", (1)::numeric) AS "avg_aware_factor",
    COALESCE("ft"."avg_recycling", (0)::numeric) AS "avg_recycling_rate"
   FROM ("facility_totals" "ft"
     FULL JOIN "embedded_water" "ew" ON (("ft"."organization_id" = "ew"."organization_id")));


ALTER VIEW "public"."company_water_overview" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contract_manufacturer_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "total_facility_production_volume" numeric NOT NULL,
    "production_volume_unit" "text" DEFAULT 'units'::"text" NOT NULL,
    "total_facility_co2e_kg" numeric NOT NULL,
    "co2e_entry_method" "text" DEFAULT 'direct'::"text" NOT NULL,
    "emission_factor_year" integer,
    "emission_factor_source" "text",
    "client_production_volume" numeric NOT NULL,
    "attribution_ratio" numeric,
    "allocated_emissions_kg_co2e" numeric,
    "emission_intensity_kg_co2e_per_unit" numeric,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "is_energy_intensive_process" boolean DEFAULT false NOT NULL,
    "energy_intensive_notes" "text",
    "data_source_tag" "text" DEFAULT 'Primary - Allocated'::"text" NOT NULL,
    "data_quality_score" integer,
    "created_by" "uuid",
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "verification_notes" "text",
    "calculation_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "supporting_evidence_urls" "text"[] DEFAULT '{}'::"text"[],
    "supplier_invoice_ref" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "locked_at" timestamp with time zone,
    "uses_proxy_data" boolean DEFAULT false,
    "proxy_mapping_id" "uuid",
    "calculation_method" "text",
    "data_quality_rating" "text",
    "confidence_score" "text",
    "data_source" "text",
    "safety_buffer_applied" numeric DEFAULT 0,
    "total_facility_water_litres" numeric DEFAULT 0,
    "total_facility_waste_kg" numeric DEFAULT 0,
    "allocated_water_litres" numeric,
    "allocated_waste_kg" numeric,
    "water_intensity_litres_per_unit" numeric,
    "waste_intensity_kg_per_unit" numeric,
    "scope1_emissions_kg_co2e" numeric DEFAULT 0,
    "scope2_emissions_kg_co2e" numeric DEFAULT 0,
    "scope3_emissions_kg_co2e" numeric DEFAULT 0,
    CONSTRAINT "contract_manufacturer_alloca_total_facility_production_vo_check" CHECK (("total_facility_production_volume" > (0)::numeric)),
    CONSTRAINT "contract_manufacturer_allocation_client_production_volume_check" CHECK (("client_production_volume" > (0)::numeric)),
    CONSTRAINT "contract_manufacturer_allocations_attribution_ratio_check" CHECK ((("attribution_ratio" >= (0)::numeric) AND ("attribution_ratio" <= (1)::numeric))),
    CONSTRAINT "contract_manufacturer_allocations_co2e_entry_method_check" CHECK (("co2e_entry_method" = ANY (ARRAY['direct'::"text", 'calculated_from_energy'::"text"]))),
    CONSTRAINT "contract_manufacturer_allocations_data_quality_score_check" CHECK ((("data_quality_score" >= 1) AND ("data_quality_score" <= 5))),
    CONSTRAINT "contract_manufacturer_allocations_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'provisional'::"text", 'verified'::"text", 'approved'::"text"]))),
    CONSTRAINT "contract_manufacturer_allocations_total_facility_co2e_kg_check" CHECK (("total_facility_co2e_kg" >= (0)::numeric)),
    CONSTRAINT "valid_client_volume" CHECK (("client_production_volume" <= "total_facility_production_volume")),
    CONSTRAINT "valid_reporting_period" CHECK (("reporting_period_end" > "reporting_period_start"))
);


ALTER TABLE "public"."contract_manufacturer_allocations" OWNER TO "postgres";


COMMENT ON TABLE "public"."contract_manufacturer_allocations" IS 'ISO 14067 compliant physical allocation records for contract manufacturers. Each record is a time-bound snapshot tied to specific reporting period.';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."reporting_period_start" IS 'Start date of allocation period - ensures temporal integrity for emission factor application';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."reporting_period_end" IS 'End date of allocation period - data is locked to this specific timeframe';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."total_facility_co2e_kg" IS 'Total facility CO2e - stored for performance, can be recalculated from energy inputs';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."co2e_entry_method" IS 'Indicates whether CO2e was entered directly or calculated from raw energy data';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."attribution_ratio" IS 'Physical allocation ratio: client_volume / total_volume (0-1)';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."status" IS 'Workflow status: draft, provisional (pending verification), verified, approved';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."is_energy_intensive_process" IS 'Flag indicating process required unusual energy - triggers provisional status';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."calculation_metadata" IS 'Complete calculation chain for Glass Box audit trail';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."uses_proxy_data" IS 'TRUE when allocation calculated using industry average proxies instead of specific facility data';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."safety_buffer_applied" IS 'Percentage safety buffer applied (typically 10%) to ensure conservative estimates';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."scope1_emissions_kg_co2e" IS 'Allocated Scope 1 emissions for this product';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."scope2_emissions_kg_co2e" IS 'Allocated Scope 2 emissions for this product';



COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."scope3_emissions_kg_co2e" IS 'Allocated Scope 3 emissions for this product';



CREATE OR REPLACE VIEW "public"."contract_manufacturer_allocation_summary" AS
 SELECT "cma"."id",
    "cma"."organization_id",
    "cma"."product_id",
    "p"."name" AS "product_name",
    "cma"."facility_id",
    "f"."name" AS "facility_name",
    "f"."address_city" AS "facility_city",
    "f"."address_country" AS "facility_country",
    "cma"."supplier_id",
    "s"."name" AS "supplier_name",
    "cma"."reporting_period_start",
    "cma"."reporting_period_end",
    "cma"."total_facility_production_volume",
    "cma"."production_volume_unit",
    "cma"."total_facility_co2e_kg",
    "cma"."co2e_entry_method",
    "cma"."client_production_volume",
    "cma"."attribution_ratio",
    "cma"."allocated_emissions_kg_co2e",
    "cma"."scope1_emissions_kg_co2e",
    "cma"."scope2_emissions_kg_co2e",
    "cma"."scope3_emissions_kg_co2e",
    "cma"."allocated_water_litres",
    "cma"."allocated_waste_kg",
    "cma"."emission_intensity_kg_co2e_per_unit",
    "cma"."status",
    "cma"."is_energy_intensive_process",
    "cma"."data_source_tag",
    "cma"."data_quality_score",
    "cma"."created_at",
    "cma"."updated_at",
    "cma"."locked_at",
    "cma"."verified_at",
    EXTRACT(day FROM ("now"() - "cma"."created_at")) AS "days_pending"
   FROM ((("public"."contract_manufacturer_allocations" "cma"
     LEFT JOIN "public"."products" "p" ON (("p"."id" = "cma"."product_id")))
     LEFT JOIN "public"."facilities" "f" ON (("f"."id" = "cma"."facility_id")))
     LEFT JOIN "public"."suppliers" "s" ON (("s"."id" = "cma"."supplier_id")));


ALTER VIEW "public"."contract_manufacturer_allocation_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."contract_manufacturer_allocation_summary" IS 'Summary view joining allocations with product, facility, and supplier details for dashboard display';



CREATE TABLE IF NOT EXISTS "public"."contract_manufacturer_energy_inputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "allocation_id" "uuid" NOT NULL,
    "fuel_type" "text" NOT NULL,
    "consumption_value" numeric NOT NULL,
    "consumption_unit" "text" NOT NULL,
    "emission_factor_used" numeric NOT NULL,
    "emission_factor_unit" "text" NOT NULL,
    "emission_factor_year" integer NOT NULL,
    "emission_factor_source" "text" DEFAULT 'DEFRA'::"text" NOT NULL,
    "calculated_co2e_kg" numeric NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "contract_manufacturer_energy_inputs_calculated_co2e_kg_check" CHECK (("calculated_co2e_kg" >= (0)::numeric)),
    CONSTRAINT "contract_manufacturer_energy_inputs_consumption_value_check" CHECK (("consumption_value" >= (0)::numeric)),
    CONSTRAINT "contract_manufacturer_energy_inputs_emission_factor_used_check" CHECK (("emission_factor_used" >= (0)::numeric))
);


ALTER TABLE "public"."contract_manufacturer_energy_inputs" OWNER TO "postgres";


COMMENT ON TABLE "public"."contract_manufacturer_energy_inputs" IS 'Raw energy consumption data by fuel type. Enables retrospective recalculation when emission factors are updated.';



COMMENT ON COLUMN "public"."contract_manufacturer_energy_inputs"."fuel_type" IS 'Type of energy source: grid_electricity, natural_gas, diesel, lpg, biomass, etc.';



COMMENT ON COLUMN "public"."contract_manufacturer_energy_inputs"."consumption_value" IS 'Original consumption value as reported - immutable source data';



COMMENT ON COLUMN "public"."contract_manufacturer_energy_inputs"."emission_factor_used" IS 'Emission factor applied at time of calculation - stored for audit';



COMMENT ON COLUMN "public"."contract_manufacturer_energy_inputs"."calculated_co2e_kg" IS 'CO2e calculated from this energy source';



CREATE TABLE IF NOT EXISTS "public"."corporate_overheads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "spend_amount" double precision NOT NULL,
    "currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "emission_factor" double precision,
    "computed_co2e" double precision,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "entry_date" "date" DEFAULT CURRENT_DATE,
    "fte_count" integer,
    "transport_mode" "text",
    "distance_km" double precision,
    "weight_kg" double precision,
    "material_type" "text",
    "disposal_method" "text",
    "asset_type" "text",
    "passenger_count" integer,
    "is_return_trip" boolean DEFAULT false,
    "origin_location" "text",
    "destination_location" "text",
    "origin_coordinates" "jsonb",
    "destination_coordinates" "jsonb",
    "calculated_distance_km" double precision,
    "distance_source" "text",
    "cabin_class" "text",
    "location_search_timestamp" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "corporate_overheads_asset_type_check" CHECK (("asset_type" = ANY (ARRAY['machinery'::"text", 'vehicles'::"text", 'it_hardware'::"text", 'equipment'::"text", 'other'::"text"]))),
    CONSTRAINT "corporate_overheads_cabin_class_check" CHECK (("cabin_class" = ANY (ARRAY['Economy'::"text", 'Premium Economy'::"text", 'Business'::"text", 'First'::"text"]))),
    CONSTRAINT "corporate_overheads_category_check" CHECK (("category" = ANY (ARRAY['business_travel'::"text", 'purchased_services'::"text", 'employee_commuting'::"text", 'capital_goods'::"text", 'upstream_transportation'::"text", 'waste_disposal'::"text", 'downstream_logistics'::"text", 'operational_waste'::"text", 'other'::"text"]))),
    CONSTRAINT "corporate_overheads_currency_check" CHECK (("currency" = ANY (ARRAY['GBP'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "corporate_overheads_disposal_method_check" CHECK (("disposal_method" = ANY (ARRAY['landfill'::"text", 'recycling'::"text", 'composting'::"text", 'incineration'::"text", 'anaerobic_digestion'::"text"]))),
    CONSTRAINT "corporate_overheads_distance_km_check" CHECK (("distance_km" >= (0)::double precision)),
    CONSTRAINT "corporate_overheads_distance_source_check" CHECK (("distance_source" = ANY (ARRAY['auto'::"text", 'manual'::"text"]))),
    CONSTRAINT "corporate_overheads_fte_count_check" CHECK (("fte_count" >= 0)),
    CONSTRAINT "corporate_overheads_passenger_count_check" CHECK (("passenger_count" > 0)),
    CONSTRAINT "corporate_overheads_spend_amount_check" CHECK (("spend_amount" >= (0)::double precision)),
    CONSTRAINT "corporate_overheads_transport_mode_flexible_check" CHECK ((("transport_mode" IS NULL) OR ("length"(TRIM(BOTH FROM "transport_mode")) > 0))),
    CONSTRAINT "corporate_overheads_weight_kg_check" CHECK (("weight_kg" >= (0)::double precision))
);


ALTER TABLE "public"."corporate_overheads" OWNER TO "postgres";


COMMENT ON COLUMN "public"."corporate_overheads"."description" IS 'User-friendly description of the overhead entry';



COMMENT ON COLUMN "public"."corporate_overheads"."entry_date" IS 'Date when the activity occurred';



COMMENT ON COLUMN "public"."corporate_overheads"."transport_mode" IS 'Transport mode for business travel and logistics. Accepts flexible values including flight types (Domestic, Short-haul, Long-haul), rail types (National, International), and other modes. Validation handled at application level.';



COMMENT ON COLUMN "public"."corporate_overheads"."passenger_count" IS 'Number of passengers for business travel calculations (activity-based)';



COMMENT ON COLUMN "public"."corporate_overheads"."is_return_trip" IS 'Flag to indicate if journey is return trip (multiplies distance by 2)';



COMMENT ON COLUMN "public"."corporate_overheads"."origin_location" IS 'Departure location name from geocoding service';



COMMENT ON COLUMN "public"."corporate_overheads"."destination_location" IS 'Arrival location name from geocoding service';



COMMENT ON COLUMN "public"."corporate_overheads"."origin_coordinates" IS 'Departure coordinates as {"lat": 51.5074, "lng": -0.1278}';



COMMENT ON COLUMN "public"."corporate_overheads"."destination_coordinates" IS 'Arrival coordinates as {"lat": 55.9533, "lng": -3.1883}';



COMMENT ON COLUMN "public"."corporate_overheads"."calculated_distance_km" IS 'Distance calculated using Haversine formula';



COMMENT ON COLUMN "public"."corporate_overheads"."distance_source" IS 'Whether distance was calculated automatically or entered manually';



COMMENT ON COLUMN "public"."corporate_overheads"."cabin_class" IS 'Flight cabin class for accurate emission factors';



CREATE TABLE IF NOT EXISTS "public"."corporate_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "year" integer NOT NULL,
    "status" "text" DEFAULT 'Draft'::"text" NOT NULL,
    "total_emissions" double precision DEFAULT 0,
    "breakdown_json" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "finalized_at" timestamp with time zone,
    CONSTRAINT "corporate_reports_status_check" CHECK (("status" = ANY (ARRAY['Draft'::"text", 'Finalized'::"text"]))),
    CONSTRAINT "corporate_reports_year_check" CHECK ((("year" >= 2000) AND ("year" <= 2100)))
);


ALTER TABLE "public"."corporate_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."dashboard_widgets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "default_size" "text" DEFAULT 'standard'::"text" NOT NULL,
    "min_col_span" integer DEFAULT 1 NOT NULL,
    "max_col_span" integer DEFAULT 4 NOT NULL,
    "icon" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "requires_data" "text"[] DEFAULT '{}'::"text"[],
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."dashboard_widgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."data_provenance_trail" (
    "provenance_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "source_description" "text" NOT NULL,
    "document_type" "text" NOT NULL,
    "storage_object_path" "text" NOT NULL,
    "verification_status" "public"."verification_status_enum" DEFAULT 'unverified'::"public"."verification_status_enum" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_data_provenance_description_not_empty" CHECK (("length"(TRIM(BOTH FROM "source_description")) > 0)),
    CONSTRAINT "chk_data_provenance_doctype_lowercase" CHECK (("document_type" = "lower"("document_type"))),
    CONSTRAINT "chk_data_provenance_doctype_not_empty" CHECK (("length"(TRIM(BOTH FROM "document_type")) > 0)),
    CONSTRAINT "chk_data_provenance_path_not_empty" CHECK (("length"(TRIM(BOTH FROM "storage_object_path")) > 0)),
    CONSTRAINT "chk_data_provenance_path_safe" CHECK (("storage_object_path" !~ '[<>"|?*]'::"text"))
);


ALTER TABLE "public"."data_provenance_trail" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_provenance_trail" IS 'Evidentiary chain of custody ledger for all source documents and data provided by users. Provides complete traceability from raw evidence to final calculations. Records are permanent and cannot be deleted by the application layer.';



COMMENT ON COLUMN "public"."data_provenance_trail"."provenance_id" IS 'Unique identifier for each provenance record. Serves as the primary key for linking evidence to calculations.';



COMMENT ON COLUMN "public"."data_provenance_trail"."organization_id" IS 'Foreign key reference to the organisation that owns this evidence. Enables multi-tenant data isolation and ensures evidence is attributed to the correct organisation.';



COMMENT ON COLUMN "public"."data_provenance_trail"."user_id" IS 'Foreign key reference to the authenticated user who submitted/uploaded the evidence. Provides user-level accountability in the chain of custody.';



COMMENT ON COLUMN "public"."data_provenance_trail"."source_description" IS 'User-provided description of the source document or data. Examples: "Q3 2024 Electricity Bill for London Office", "Monthly fuel receipts - Fleet vehicles", "Supplier emissions report - Acme Corp". Enables human-readable evidence identification.';



COMMENT ON COLUMN "public"."data_provenance_trail"."document_type" IS 'Category or type of the source document. Examples: "invoice", "meter_reading", "shipping_manifest", "utility_bill", "supplier_report", "receipt". Used for filtering and workflow management.';



COMMENT ON COLUMN "public"."data_provenance_trail"."storage_object_path" IS 'Unique path to the file in Supabase Storage (e.g., "org-uuid/evidence/2024/file.pdf"). Must be unique across the entire system. This path is used to retrieve the actual document for verification and audit purposes.';



COMMENT ON COLUMN "public"."data_provenance_trail"."verification_status" IS 'Current verification state of the evidence. "unverified" = newly uploaded and pending review, "verified" = reviewed and approved by authorised personnel, "rejected" = determined to be invalid or inappropriate. Status changes create an audit trail.';



COMMENT ON COLUMN "public"."data_provenance_trail"."created_at" IS 'Immutable timestamp when the evidence was first submitted to the system. Establishes the official record time for chain of custody purposes.';



CREATE TABLE IF NOT EXISTS "public"."data_provenance_verification_history" (
    "history_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provenance_id" "uuid" NOT NULL,
    "changed_by" "uuid" NOT NULL,
    "old_status" "public"."verification_status_enum",
    "new_status" "public"."verification_status_enum" NOT NULL,
    "change_reason" "text",
    "changed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."data_provenance_verification_history" OWNER TO "postgres";


COMMENT ON TABLE "public"."data_provenance_verification_history" IS 'Audit trail for all verification status changes on evidence records. Provides complete history of who changed status, when, and why. Supports compliance and dispute resolution.';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."history_id" IS 'Unique identifier for this history entry';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."provenance_id" IS 'Reference to the evidence record that was modified';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."changed_by" IS 'User who changed the verification status';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."old_status" IS 'Previous verification status (NULL for initial creation)';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."new_status" IS 'New verification status after change';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."change_reason" IS 'Optional explanation for the status change';



COMMENT ON COLUMN "public"."data_provenance_verification_history"."changed_at" IS 'Timestamp when the status was changed';



CREATE OR REPLACE VIEW "public"."data_quality_summary" AS
 SELECT "plca"."organization_id",
    "plca"."id" AS "product_lca_id",
    "plca"."product_id",
    "p"."name" AS "product_name",
    "count"("plm"."id") AS "total_materials",
    "count"(*) FILTER (WHERE ("plm"."data_quality_grade" = 'HIGH'::"text")) AS "high_quality_count",
    "count"(*) FILTER (WHERE ("plm"."data_quality_grade" = 'MEDIUM'::"text")) AS "medium_quality_count",
    "count"(*) FILTER (WHERE ("plm"."data_quality_grade" = 'LOW'::"text")) AS "low_quality_count",
    "count"(*) FILTER (WHERE ("plm"."is_hybrid_source" = true)) AS "hybrid_source_count",
    "count"(*) FILTER (WHERE ("plm"."gwp_data_source" = 'DEFRA'::"text")) AS "defra_gwp_count",
    "count"(*) FILTER (WHERE ("plm"."gwp_data_source" ~~ '%Supplier%'::"text")) AS "supplier_data_count",
    "round"("avg"(
        CASE
            WHEN ("plm"."data_quality_grade" = 'HIGH'::"text") THEN 95
            WHEN ("plm"."data_quality_grade" = 'MEDIUM'::"text") THEN 75
            WHEN ("plm"."data_quality_grade" = 'LOW'::"text") THEN 50
            ELSE 0
        END), 2) AS "average_quality_score",
    "plca"."created_at" AS "lca_created_at"
   FROM (("public"."product_carbon_footprints" "plca"
     JOIN "public"."products" "p" ON (("p"."id" = "plca"."product_id")))
     LEFT JOIN "public"."product_carbon_footprint_materials" "plm" ON (("plm"."product_carbon_footprint_id" = "plca"."id")))
  WHERE ("plca"."status" = 'COMPLETED'::"text")
  GROUP BY "plca"."id", "plca"."organization_id", "plca"."product_id", "p"."name", "plca"."created_at";


ALTER VIEW "public"."data_quality_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."data_quality_summary" IS 'Aggregate data quality metrics per product LCA for dashboard display';



CREATE TABLE IF NOT EXISTS "public"."defra_ecoinvent_impact_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "defra_factor_name" "text" NOT NULL,
    "defra_category" "text" NOT NULL,
    "defra_scope" "text",
    "ecoinvent_proxy_category" "text" NOT NULL,
    "ecoinvent_proxy_name" "text" NOT NULL,
    "ecoinvent_process_uuid" "text",
    "mapping_quality" "text" NOT NULL,
    "geographic_alignment" "text" NOT NULL,
    "confidence_score" integer,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "defra_ecoinvent_impact_mappings_confidence_score_check" CHECK ((("confidence_score" >= 0) AND ("confidence_score" <= 100))),
    CONSTRAINT "defra_ecoinvent_impact_mappings_defra_category_check" CHECK (("defra_category" = ANY (ARRAY['ENERGY'::"text", 'TRANSPORT'::"text", 'COMMUTING'::"text", 'WASTE'::"text"]))),
    CONSTRAINT "defra_ecoinvent_impact_mappings_defra_scope_check" CHECK (("defra_scope" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text", 'Scope 3'::"text"]))),
    CONSTRAINT "defra_ecoinvent_impact_mappings_geographic_alignment_check" CHECK (("geographic_alignment" = ANY (ARRAY['UK'::"text", 'EU'::"text", 'GLO'::"text"]))),
    CONSTRAINT "defra_ecoinvent_impact_mappings_mapping_quality_check" CHECK (("mapping_quality" = ANY (ARRAY['EXACT'::"text", 'CLOSE'::"text", 'GENERIC'::"text"])))
);


ALTER TABLE "public"."defra_ecoinvent_impact_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."defra_ecoinvent_impact_mappings" IS 'Maps DEFRA 2025 emission factors to Ecoinvent 3.12 processes for hybrid GWP+environmental impact calculations';



COMMENT ON COLUMN "public"."defra_ecoinvent_impact_mappings"."mapping_quality" IS 'exact: Direct match, close: Similar process with adjustments, generic: Broader category match, distant: Last resort proxy';



COMMENT ON COLUMN "public"."defra_ecoinvent_impact_mappings"."geographic_alignment" IS 'Geographic consistency between DEFRA (UK) and Ecoinvent process scope';



CREATE TABLE IF NOT EXISTS "public"."defra_energy_emission_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fuel_type" "text" NOT NULL,
    "fuel_type_display" "text" NOT NULL,
    "factor_year" integer NOT NULL,
    "co2e_factor" numeric NOT NULL,
    "factor_unit" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "category" "text",
    "subcategory" "text",
    "source" "text" DEFAULT 'DEFRA'::"text" NOT NULL,
    "source_url" "text",
    "geographic_scope" "text" DEFAULT 'UK'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "defra_energy_emission_factors_co2e_factor_check" CHECK (("co2e_factor" >= (0)::numeric)),
    CONSTRAINT "defra_energy_emission_factors_factor_year_check" CHECK ((("factor_year" >= 2000) AND ("factor_year" <= 2100))),
    CONSTRAINT "defra_energy_emission_factors_scope_check" CHECK (("scope" = ANY (ARRAY['1'::"text", '2'::"text", '3'::"text"])))
);


ALTER TABLE "public"."defra_energy_emission_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."defra_energy_emission_factors" IS 'DEFRA emission factors for energy-to-CO2e conversions. Read-only reference data managed via migrations.';



COMMENT ON COLUMN "public"."defra_energy_emission_factors"."fuel_type" IS 'Standardised fuel type identifier used in code';



COMMENT ON COLUMN "public"."defra_energy_emission_factors"."fuel_type_display" IS 'Human-readable name for UI display';



COMMENT ON COLUMN "public"."defra_energy_emission_factors"."co2e_factor" IS 'Emission factor value in kgCO2e per unit';



COMMENT ON COLUMN "public"."defra_energy_emission_factors"."factor_unit" IS 'Reference unit: kWh, litre, m3, kg, etc.';



COMMENT ON COLUMN "public"."defra_energy_emission_factors"."scope" IS 'GHG Protocol scope: 1 (direct), 2 (indirect energy), 3 (other indirect)';



CREATE TABLE IF NOT EXISTS "public"."ecoinvent_material_proxies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "material_category" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "ecoinvent_process_id" "text",
    "ecoinvent_process_name" "text",
    "reference_unit" "text" DEFAULT 'kg'::"text" NOT NULL,
    "impact_climate" numeric,
    "impact_water" numeric DEFAULT 0 NOT NULL,
    "impact_land" numeric DEFAULT 0 NOT NULL,
    "impact_waste" numeric DEFAULT 0 NOT NULL,
    "impact_marine_eutrophication" numeric DEFAULT 0,
    "impact_particulate_matter" numeric DEFAULT 0,
    "impact_human_toxicity" numeric DEFAULT 0,
    "ecoinvent_version" "text" DEFAULT '3.12'::"text",
    "lcia_method" "text" DEFAULT 'ReCiPe 2016 Midpoint (H)'::"text",
    "geography" "text" DEFAULT 'GLO'::"text",
    "system_model" "text" DEFAULT 'Cutoff'::"text",
    "data_quality_score" integer DEFAULT 3,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "impact_mineral_resource_scarcity" numeric(15,8),
    "impact_freshwater_ecotoxicity" numeric(15,8),
    "impact_marine_ecotoxicity" numeric(15,8),
    "impact_human_toxicity_carcinogenic" numeric(15,8),
    "impact_human_toxicity_non_carcinogenic" numeric(15,8),
    "impact_ozone_depletion" numeric(15,8),
    "impact_photochemical_ozone_formation" numeric(15,8),
    "impact_ionising_radiation" numeric(15,8),
    "impact_fossil_fuel_scarcity" numeric(15,8),
    "impact_terrestrial_acidification" numeric(15,8),
    "impact_freshwater_eutrophication" numeric(15,8),
    "impact_terrestrial_ecotoxicity" numeric(15,8),
    "impact_biodiversity" numeric(15,8),
    "impact_land_use" numeric(15,8),
    "impact_climate_fossil" numeric DEFAULT 0,
    "impact_climate_biogenic" numeric DEFAULT 0,
    "impact_climate_dluc" numeric DEFAULT 0,
    "ch4_factor" numeric DEFAULT 0,
    "ch4_fossil_factor" numeric DEFAULT 0,
    "ch4_biogenic_factor" numeric DEFAULT 0,
    "n2o_factor" numeric DEFAULT 0,
    CONSTRAINT "ecoinvent_material_proxies_data_quality_score_check" CHECK ((("data_quality_score" >= 1) AND ("data_quality_score" <= 5))),
    CONSTRAINT "ecoinvent_material_proxies_impact_climate_check" CHECK (("impact_climate" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_human_toxicity_check" CHECK (("impact_human_toxicity" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_land_check" CHECK (("impact_land" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_marine_eutrophication_check" CHECK (("impact_marine_eutrophication" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_particulate_matter_check" CHECK (("impact_particulate_matter" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_waste_check" CHECK (("impact_waste" >= (0)::numeric)),
    CONSTRAINT "ecoinvent_material_proxies_impact_water_check" CHECK (("impact_water" >= (0)::numeric))
);


ALTER TABLE "public"."ecoinvent_material_proxies" OWNER TO "postgres";


COMMENT ON TABLE "public"."ecoinvent_material_proxies" IS 'Background LCA data from Ecoinvent 3.12 for common beverage materials. Used when specific supplier data unavailable.';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."material_category" IS 'Standardized category key for matching (e.g., "sugar_cane_global", "glass_bottle_virgin"). Used for lookup.';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_climate" IS 'Climate change GWP100 (kg CO2 eq per functional unit). NULL for hybrid proxies where GWP comes from DEFRA.';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."data_quality_score" IS '1=Poor proxy, 5=Excellent match. Helps users understand data reliability.';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_mineral_resource_scarcity" IS 'Mineral resource scarcity (kg Cu eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_freshwater_ecotoxicity" IS 'Freshwater ecotoxicity (kg 1,4-DCB eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_marine_ecotoxicity" IS 'Marine ecotoxicity (kg 1,4-DCB eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_human_toxicity_carcinogenic" IS 'Human toxicity, carcinogenic (kg 1,4-DCB eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_human_toxicity_non_carcinogenic" IS 'Human toxicity, non-carcinogenic (kg 1,4-DCB eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_ozone_depletion" IS 'Stratospheric ozone depletion (kg CFC-11 eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_photochemical_ozone_formation" IS 'Photochemical ozone formation (kg NOx eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_ionising_radiation" IS 'Ionising radiation (kBq Co-60 eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_fossil_fuel_scarcity" IS 'Fossil fuel scarcity (MJ surplus per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_terrestrial_acidification" IS 'Terrestrial acidification (kg SO2 eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_freshwater_eutrophication" IS 'Freshwater eutrophication (kg P eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_terrestrial_ecotoxicity" IS 'Terrestrial ecotoxicity (kg 1,4-DCB eq per functional unit) - ReCiPe 2016';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_biodiversity" IS 'Biodiversity loss (species.year per functional unit) - experimental indicator';



COMMENT ON COLUMN "public"."ecoinvent_material_proxies"."impact_land_use" IS 'Land use (m² annual crop eq per functional unit) - ReCiPe 2016';



CREATE TABLE IF NOT EXISTS "public"."ef31_impact_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL,
    "short_name" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "unit_description" "text" NOT NULL,
    "characterisation_model" "text" NOT NULL,
    "model_version" "text",
    "default_weight" numeric(6,4) DEFAULT 0.0625 NOT NULL,
    "display_order" integer NOT NULL,
    "description" "text",
    "regulatory_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ef31_impact_categories" OWNER TO "postgres";


COMMENT ON TABLE "public"."ef31_impact_categories" IS 'Official EF 3.1 impact category definitions with characterisation model references and default weights.';



CREATE TABLE IF NOT EXISTS "public"."ef31_normalisation_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "impact_category_code" "text" NOT NULL,
    "reference_region" "text" DEFAULT 'EU27+1'::"text" NOT NULL,
    "reference_year" integer DEFAULT 2010 NOT NULL,
    "normalisation_value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "source_document" "text",
    "source_version" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ef31_normalisation_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."ef31_normalisation_factors" IS 'EU27 2010 normalisation reference values for EF 3.1. Values represent per-capita annual impacts.';



CREATE TABLE IF NOT EXISTS "public"."ef31_process_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ecoinvent_process_uuid" "text" NOT NULL,
    "ecoinvent_process_name" "text" NOT NULL,
    "ecoinvent_version" "text" DEFAULT '3.12'::"text",
    "staging_factor_id" "uuid",
    "ef_climate_change" numeric,
    "ef_ozone_depletion" numeric,
    "ef_ionising_radiation" numeric,
    "ef_photochemical_ozone_formation" numeric,
    "ef_particulate_matter" numeric,
    "ef_human_toxicity_cancer" numeric,
    "ef_human_toxicity_non_cancer" numeric,
    "ef_acidification" numeric,
    "ef_eutrophication_freshwater" numeric,
    "ef_eutrophication_marine" numeric,
    "ef_eutrophication_terrestrial" numeric,
    "ef_ecotoxicity_freshwater" numeric,
    "ef_land_use" numeric,
    "ef_water_use" numeric,
    "ef_resource_use_fossils" numeric,
    "ef_resource_use_minerals_metals" numeric,
    "data_quality_rating" "text" DEFAULT 'medium'::"text",
    "last_updated" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ef31_process_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."ef31_process_mappings" IS 'Maps EcoInvent process UUIDs to EF 3.1 impact values. Used for hybrid data resolution.';



CREATE TABLE IF NOT EXISTS "public"."lca_recalculation_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "total_jobs" integer DEFAULT 0 NOT NULL,
    "completed_jobs" integer DEFAULT 0 NOT NULL,
    "failed_jobs" integer DEFAULT 0 NOT NULL,
    "processing_started_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "estimated_completion_at" timestamp with time zone,
    "triggered_by" "uuid",
    "trigger_reason" "text",
    "error_summary" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_batch_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."lca_recalculation_batches" OWNER TO "postgres";


COMMENT ON TABLE "public"."lca_recalculation_batches" IS 'Groups EF 3.1 recalculation jobs into batches for monitoring and progress tracking.';



CREATE OR REPLACE VIEW "public"."ef31_recalculation_progress" AS
 SELECT "b"."id" AS "batch_id",
    "b"."batch_name",
    "b"."status" AS "batch_status",
    "b"."total_jobs",
    "b"."completed_jobs",
    "b"."failed_jobs",
    (("b"."total_jobs" - "b"."completed_jobs") - "b"."failed_jobs") AS "pending_jobs",
        CASE
            WHEN ("b"."total_jobs" > 0) THEN "round"(((("b"."completed_jobs")::numeric / ("b"."total_jobs")::numeric) * (100)::numeric), 1)
            ELSE (0)::numeric
        END AS "completion_percentage",
    "b"."processing_started_at",
    "b"."processing_completed_at",
    "b"."triggered_by",
    "p"."full_name" AS "triggered_by_name",
    "b"."created_at"
   FROM ("public"."lca_recalculation_batches" "b"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = "b"."triggered_by")))
  ORDER BY "b"."created_at" DESC;


ALTER VIEW "public"."ef31_recalculation_progress" OWNER TO "postgres";


COMMENT ON VIEW "public"."ef31_recalculation_progress" IS 'Shows progress of EF 3.1 recalculation batches with completion percentage.';



CREATE TABLE IF NOT EXISTS "public"."ef31_weighting_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "weighting_set_id" "uuid" NOT NULL,
    "impact_category_code" "text" NOT NULL,
    "weighting_factor" numeric(6,4) NOT NULL,
    "robustness_level" "text" DEFAULT 'recommended'::"text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ef31_weighting_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."ef31_weighting_factors" IS 'Individual weighting factors linking impact categories to weighting sets.';



CREATE TABLE IF NOT EXISTS "public"."ef31_weighting_sets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "is_default" boolean DEFAULT false,
    "organization_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ef31_weighting_sets" OWNER TO "postgres";


COMMENT ON TABLE "public"."ef31_weighting_sets" IS 'Weighting sets for EF 3.1 single score calculation. Default set uses official EF weights.';



CREATE TABLE IF NOT EXISTS "public"."emissions_calculation_context" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "operational_control_status_at_period" "text" NOT NULL,
    "context_established_at" timestamp with time zone DEFAULT "now"(),
    "context_established_by" "uuid",
    "context_notes" "text",
    "calculation_version" integer DEFAULT 1,
    "superseded_by" "uuid",
    "is_current" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "emissions_calculation_contex_operational_control_status_a_check" CHECK (("operational_control_status_at_period" = ANY (ARRAY['owned'::"text", 'third_party'::"text"])))
);


ALTER TABLE "public"."emissions_calculation_context" OWNER TO "postgres";


COMMENT ON TABLE "public"."emissions_calculation_context" IS 'Temporal lookup for scope assignment. Records operational_control status per reporting period.';



CREATE TABLE IF NOT EXISTS "public"."emissions_factors" (
    "factor_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "source" "text" NOT NULL,
    "source_documentation_link" "text" NOT NULL,
    "year_of_publication" integer NOT NULL,
    "geographic_scope" "text" NOT NULL,
    "system_model" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text",
    "year" integer,
    "region" "text",
    "tier" "text",
    "category" "text",
    "subcategory" "text",
    "vehicle_class" "text",
    "fuel_type" "text",
    "propulsion_type" "text",
    "material_type" "text",
    "travel_class" "text",
    "cabin_class" "text",
    "uncertainty_percentage" numeric DEFAULT 0,
    "uncertainty_lower_bound" numeric,
    "uncertainty_upper_bound" numeric,
    "category_type" "text",
    CONSTRAINT "chk_emissions_factors_category" CHECK ((("category" IS NULL) OR ("category" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text", 'Scope 3'::"text", 'Manufacturing_Proxy'::"text"])))),
    CONSTRAINT "chk_emissions_factors_propulsion_type" CHECK ((("propulsion_type" IS NULL) OR ("propulsion_type" = ANY (ARRAY['ICE'::"text", 'BEV'::"text", 'PHEV'::"text", 'HEV'::"text"])))),
    CONSTRAINT "chk_emissions_factors_url_format" CHECK (("source_documentation_link" ~* '^https?://'::"text")),
    CONSTRAINT "chk_emissions_factors_value_positive" CHECK (("value" >= (0)::numeric)),
    CONSTRAINT "chk_emissions_factors_year_valid" CHECK ((("year_of_publication" >= 1990) AND (("year_of_publication")::numeric <= (EXTRACT(year FROM CURRENT_DATE) + (1)::numeric)))),
    CONSTRAINT "chk_uncertainty_percentage_range" CHECK ((("uncertainty_percentage" >= (0)::numeric) AND ("uncertainty_percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."emissions_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."emissions_factors" IS 'Emission factors with ISO 14064-1:2018 compliant uncertainty data. Uncertainty values represent 95% confidence intervals.';



COMMENT ON COLUMN "public"."emissions_factors"."factor_id" IS 'Unique identifier for each emissions factor entry';



COMMENT ON COLUMN "public"."emissions_factors"."name" IS 'Descriptive name of the emissions factor (e.g., "Grid electricity - UK", "Natural gas combustion")';



COMMENT ON COLUMN "public"."emissions_factors"."value" IS 'The actual emissions factor value used in carbon calculations';



COMMENT ON COLUMN "public"."emissions_factors"."unit" IS 'Unit of measurement for the factor (e.g., "kgCO2e/kWh", "kgCO2e/kg", "kgCO2e/tonne")';



COMMENT ON COLUMN "public"."emissions_factors"."source" IS 'Source authority or database (e.g., "DEFRA 2023", "EPA 2024", "Ecoinvent 3.9", "IPCC AR6")';



COMMENT ON COLUMN "public"."emissions_factors"."source_documentation_link" IS 'Direct URL to the authoritative source documentation for audit and verification purposes';



COMMENT ON COLUMN "public"."emissions_factors"."year_of_publication" IS 'Publication year/vintage of the emissions factor for version control and currency tracking';



COMMENT ON COLUMN "public"."emissions_factors"."geographic_scope" IS 'Geographic region of applicability (e.g., "UK", "EU-27", "United States", "Global", "California")';



COMMENT ON COLUMN "public"."emissions_factors"."system_model" IS 'LCA system model methodology if applicable (e.g., "Cut-off", "APOS", "Consequential"). NULL for non-LCA factors.';



COMMENT ON COLUMN "public"."emissions_factors"."created_at" IS 'Timestamp when the emissions factor record was created in the system';



COMMENT ON COLUMN "public"."emissions_factors"."updated_at" IS 'Timestamp of the last update to the emissions factor record';



COMMENT ON COLUMN "public"."emissions_factors"."category" IS 'GHG Protocol scope classification: "Scope 1", "Scope 2", or "Scope 3"';



COMMENT ON COLUMN "public"."emissions_factors"."subcategory" IS 'Additional classification level for complex emission sources';



COMMENT ON COLUMN "public"."emissions_factors"."vehicle_class" IS 'Vehicle classification for fleet emissions (e.g., "Average Car", "Small Car", "Class II Van", "Class III Van")';



COMMENT ON COLUMN "public"."emissions_factors"."fuel_type" IS 'Fuel type for internal combustion engines (e.g., "Diesel", "Petrol", "LPG", "CNG", "Hybrid", "Unknown")';



COMMENT ON COLUMN "public"."emissions_factors"."propulsion_type" IS 'Vehicle propulsion method: "ICE" (Internal Combustion Engine), "BEV" (Battery Electric Vehicle), "PHEV" (Plug-in Hybrid), "HEV" (Hybrid Electric Vehicle)';



COMMENT ON COLUMN "public"."emissions_factors"."material_type" IS 'Material classification for Scope 3 materials (e.g., Glass, Paper, Textiles, Plastic)';



COMMENT ON COLUMN "public"."emissions_factors"."travel_class" IS 'Flight classification for business travel (e.g., Domestic, Short-haul, Long-haul)';



COMMENT ON COLUMN "public"."emissions_factors"."uncertainty_percentage" IS 'Default uncertainty percentage for this emission factor (0-100)';



COMMENT ON COLUMN "public"."emissions_factors"."uncertainty_lower_bound" IS 'Lower bound of 95% confidence interval for the factor value';



COMMENT ON COLUMN "public"."emissions_factors"."uncertainty_upper_bound" IS 'Upper bound of 95% confidence interval for the factor value';



COMMENT ON COLUMN "public"."emissions_factors"."category_type" IS 'Scope categorization: scope1, scope2, or scope3';



CREATE TABLE IF NOT EXISTS "public"."feedback_tickets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" NOT NULL,
    "category" "text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text",
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "assigned_to" "uuid",
    "resolved_at" timestamp with time zone,
    "resolution_notes" "text",
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "browser_info" "text",
    "page_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_escalation_at" timestamp with time zone,
    "escalation_count" integer DEFAULT 0,
    CONSTRAINT "feedback_tickets_category_check" CHECK (("category" = ANY (ARRAY['bug'::"text", 'feature'::"text", 'improvement'::"text", 'other'::"text"]))),
    CONSTRAINT "feedback_tickets_priority_check" CHECK (("priority" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"]))),
    CONSTRAINT "feedback_tickets_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text", 'closed'::"text"])))
);


ALTER TABLE "public"."feedback_tickets" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_tickets" IS 'User feedback tickets including bug reports and feature requests';



COMMENT ON COLUMN "public"."feedback_tickets"."category" IS 'Type: bug, feature, improvement, or other';



COMMENT ON COLUMN "public"."feedback_tickets"."priority" IS 'Urgency: low, medium, high, or critical';



COMMENT ON COLUMN "public"."feedback_tickets"."status" IS 'Current state: open, in_progress, resolved, or closed';



CREATE TABLE IF NOT EXISTS "public"."organizations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "logo_url" "text",
    "website" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "address" "text",
    "city" "text",
    "country" "text",
    "industry_sector" "text",
    "founding_year" integer,
    "company_size" "text",
    "subscription_tier" "text" DEFAULT 'seed'::"text",
    "subscription_status" "text" DEFAULT 'active'::"text",
    "subscription_started_at" timestamp with time zone DEFAULT "now"(),
    "subscription_expires_at" timestamp with time zone,
    "methodology_access" "jsonb" DEFAULT '["recipe_2016"]'::"jsonb",
    "feature_flags" "jsonb" DEFAULT '{}'::"jsonb",
    "billing_email" "text",
    "current_product_count" integer DEFAULT 0 NOT NULL,
    "current_report_count_monthly" integer DEFAULT 0 NOT NULL,
    "report_count_reset_at" timestamp with time zone DEFAULT "date_trunc"('month'::"text", "now"()),
    "current_lca_count" integer DEFAULT 0 NOT NULL,
    "address_lat" numeric,
    "address_lng" numeric,
    "is_platform_admin" boolean DEFAULT false,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    CONSTRAINT "founding_year_check" CHECK ((("founding_year" IS NULL) OR (("founding_year" >= 1800) AND (("founding_year")::numeric <= EXTRACT(year FROM CURRENT_DATE))))),
    CONSTRAINT "valid_subscription_status" CHECK (("subscription_status" = ANY (ARRAY['active'::"text", 'trial'::"text", 'suspended'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "valid_subscription_tier" CHECK ((("subscription_tier" IS NULL) OR ("subscription_tier" = ANY (ARRAY['seed'::"text", 'blossom'::"text", 'canopy'::"text"]))))
);

ALTER TABLE ONLY "public"."organizations" FORCE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" OWNER TO "postgres";


COMMENT ON COLUMN "public"."organizations"."subscription_tier" IS 'Subscription tier: "basic" (ReCiPe 2016), "premium" (+ EF 3.1), "enterprise" (+ custom weights, API).';



COMMENT ON COLUMN "public"."organizations"."subscription_status" IS 'Subscription status: "active", "trial", "suspended", "cancelled".';



COMMENT ON COLUMN "public"."organizations"."subscription_started_at" IS 'When the current subscription period started.';



COMMENT ON COLUMN "public"."organizations"."subscription_expires_at" IS 'When the current subscription period expires. NULL for non-expiring.';



COMMENT ON COLUMN "public"."organizations"."methodology_access" IS 'Array of accessible LCA methodologies based on subscription tier.';



COMMENT ON COLUMN "public"."organizations"."feature_flags" IS 'Granular feature flags for fine-grained access control.';



COMMENT ON COLUMN "public"."organizations"."billing_email" IS 'Email address for billing and subscription notifications.';



COMMENT ON COLUMN "public"."organizations"."current_product_count" IS 'Current count of products for this organization';



COMMENT ON COLUMN "public"."organizations"."current_report_count_monthly" IS 'Current count of reports generated this month';



COMMENT ON COLUMN "public"."organizations"."report_count_reset_at" IS 'Timestamp when report count was last reset (monthly)';



COMMENT ON COLUMN "public"."organizations"."current_lca_count" IS 'Current count of LCAs for this organization';



COMMENT ON COLUMN "public"."organizations"."address_lat" IS 'Organization headquarters latitude for distance calculations';



COMMENT ON COLUMN "public"."organizations"."address_lng" IS 'Organization headquarters longitude for distance calculations';



COMMENT ON COLUMN "public"."organizations"."is_platform_admin" IS 'Marks this organization as the platform admin organization, exempt from normal subscription rules';



COMMENT ON COLUMN "public"."organizations"."stripe_customer_id" IS 'Stripe customer ID for billing and subscription management';



COMMENT ON COLUMN "public"."organizations"."stripe_subscription_id" IS 'Stripe subscription ID for the current active subscription';



CREATE OR REPLACE VIEW "public"."escalated_feedback_tickets" AS
 SELECT "ft"."id",
    "ft"."title",
    "ft"."description",
    "ft"."category",
    "ft"."status",
    "ft"."priority",
    "ft"."created_at",
    "ft"."updated_at",
    "ft"."escalation_count",
    "ft"."last_escalation_at",
    (EXTRACT(day FROM ("now"() - "ft"."created_at")))::integer AS "days_open",
    "ft"."organization_id",
    "ft"."created_by",
    "p"."full_name" AS "creator_name",
    "p"."email" AS "creator_email",
    "o"."name" AS "organization_name"
   FROM (("public"."feedback_tickets" "ft"
     LEFT JOIN "public"."profiles" "p" ON (("ft"."created_by" = "p"."id")))
     LEFT JOIN "public"."organizations" "o" ON (("ft"."organization_id" = "o"."id")))
  WHERE (("ft"."status" <> ALL (ARRAY['resolved'::"text", 'closed'::"text"])) AND ("ft"."created_at" < ("now"() - '7 days'::interval)))
  ORDER BY "ft"."created_at";


ALTER VIEW "public"."escalated_feedback_tickets" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."evidence_by_document_type" AS
 SELECT "organization_id",
    "document_type",
    "count"(*) AS "record_count",
    "count"(*) FILTER (WHERE ("verification_status" = 'verified'::"public"."verification_status_enum")) AS "verified_count",
    "min"("created_at") AS "first_submission",
    "max"("created_at") AS "most_recent_submission"
   FROM "public"."data_provenance_trail"
  GROUP BY "organization_id", "document_type";


ALTER VIEW "public"."evidence_by_document_type" OWNER TO "postgres";


COMMENT ON VIEW "public"."evidence_by_document_type" IS 'Evidence record distribution by document type within each organisation. Useful for understanding what types of evidence are most commonly submitted. Respects RLS policies.';



CREATE OR REPLACE VIEW "public"."evidence_statistics" AS
 SELECT "organization_id",
    "count"(*) AS "total_evidence_records",
    "count"(*) FILTER (WHERE ("verification_status" = 'unverified'::"public"."verification_status_enum")) AS "unverified_count",
    "count"(*) FILTER (WHERE ("verification_status" = 'verified'::"public"."verification_status_enum")) AS "verified_count",
    "count"(*) FILTER (WHERE ("verification_status" = 'rejected'::"public"."verification_status_enum")) AS "rejected_count",
    "count"(DISTINCT "user_id") AS "unique_contributors",
    "count"(DISTINCT "document_type") AS "document_types_count",
    "min"("created_at") AS "first_submission",
    "max"("created_at") AS "last_submission"
   FROM "public"."data_provenance_trail"
  GROUP BY "organization_id";


ALTER VIEW "public"."evidence_statistics" OWNER TO "postgres";


COMMENT ON VIEW "public"."evidence_statistics" IS 'Aggregated statistics for evidence records by organisation. Provides counts by verification status, contributor metrics, and submission timeline. Automatically respects RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."facility_activity_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "emission_source_id" "uuid" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "reporting_period_start" "date" DEFAULT CURRENT_DATE,
    "reporting_period_end" "date" DEFAULT ((CURRENT_DATE + '1 year'::interval))::"date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "organization_id" "uuid",
    "migrated_to_fleet" boolean DEFAULT false
);


ALTER TABLE "public"."facility_activity_data" OWNER TO "postgres";


COMMENT ON COLUMN "public"."facility_activity_data"."migrated_to_fleet" IS 'Indicates whether this record has been migrated to the standalone fleet_activities table. 
When true, this record should be excluded from CCF aggregations to prevent double-counting.';



CREATE OR REPLACE VIEW "public"."facility_activity_with_scope" AS
 SELECT "fae"."id",
    "fae"."facility_id",
    "fae"."organization_id",
    "fae"."activity_category",
    "fae"."activity_date",
    "fae"."reporting_period_start",
    "fae"."reporting_period_end",
    "fae"."quantity",
    "fae"."unit",
    "fae"."data_provenance",
    "fae"."confidence_score",
    "fae"."allocation_basis",
    "fae"."brand_volume_reported",
    "fae"."total_facility_volume_reported",
    "fae"."allocation_percentage",
    "fae"."original_facility_value",
    "fae"."water_source_type",
    "fae"."water_classification",
    "fae"."wastewater_treatment_method",
    "fae"."water_recycling_rate_percent",
    "fae"."water_stress_area_flag",
    "fae"."waste_category",
    "fae"."waste_treatment_method",
    "fae"."waste_recovery_percentage",
    "fae"."hazard_classification",
    "fae"."disposal_facility_type",
    "fae"."source_facility_id",
    "fae"."source_attestation_url",
    "fae"."supplier_submission_id",
    "fae"."emission_factor_id",
    "fae"."calculated_emissions_kg_co2e",
    "fae"."notes",
    "fae"."created_by",
    "fae"."created_at",
    "fae"."updated_at",
    "fae"."reporting_session_id",
        CASE
            WHEN ("ecc"."operational_control_status_at_period" = 'owned'::"text") THEN
            CASE
                WHEN ("fae"."activity_category" = ANY (ARRAY['utility_electricity'::"public"."facility_activity_category_enum", 'utility_gas'::"public"."facility_activity_category_enum", 'utility_fuel'::"public"."facility_activity_category_enum", 'utility_other'::"public"."facility_activity_category_enum"])) THEN 'Scope 1/2'::"text"
                WHEN (("fae"."activity_category")::"text" ~~ 'waste_%'::"text") THEN 'Operational Waste'::"text"
                WHEN (("fae"."activity_category")::"text" ~~ 'water_%'::"text") THEN 'Operational Water'::"text"
                ELSE 'Operational'::"text"
            END
            WHEN ("ecc"."operational_control_status_at_period" = 'third_party'::"text") THEN
            CASE
                WHEN (("fae"."activity_category")::"text" ~~ 'waste_%'::"text") THEN 'Scope 3 - Upstream Waste'::"text"
                WHEN (("fae"."activity_category")::"text" ~~ 'water_%'::"text") THEN 'Scope 3 - Upstream Water'::"text"
                ELSE 'Scope 3 - Upstream Processes'::"text"
            END
            ELSE 'Unclassified'::"text"
        END AS "assigned_scope",
    "ecc"."operational_control_status_at_period",
    "ecc"."calculation_version"
   FROM ("public"."facility_activity_entries" "fae"
     LEFT JOIN "public"."emissions_calculation_context" "ecc" ON ((("fae"."facility_id" = "ecc"."facility_id") AND ("fae"."activity_date" >= "ecc"."reporting_period_start") AND ("fae"."activity_date" <= "ecc"."reporting_period_end") AND ("ecc"."is_current" = true))));


ALTER VIEW "public"."facility_activity_with_scope" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."utility_data_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "utility_type" "public"."utility_type_enum" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "data_quality" "public"."data_quality_enum" DEFAULT 'actual'::"public"."data_quality_enum",
    "calculated_scope" "text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reporting_session_id" "uuid",
    CONSTRAINT "utility_data_entries_quantity_check" CHECK (("quantity" >= (0)::numeric))
);


ALTER TABLE "public"."utility_data_entries" OWNER TO "postgres";


COMMENT ON TABLE "public"."utility_data_entries" IS 'Facility utility consumption data with automatic scope tagging';



COMMENT ON COLUMN "public"."utility_data_entries"."data_quality" IS 'Actual meter readings vs estimated consumption';



COMMENT ON COLUMN "public"."utility_data_entries"."calculated_scope" IS 'Auto-calculated based on utility_type: Scope 1 or Scope 2';



CREATE OR REPLACE VIEW "public"."facility_confidence_summary" AS
 WITH "combined_entries" AS (
         SELECT "facility_activity_entries"."facility_id",
            "facility_activity_entries"."id" AS "entry_id",
                CASE
                    WHEN ("facility_activity_entries"."data_provenance" = 'primary_supplier_verified'::"public"."data_provenance_enum") THEN 'primary_verified'::"text"
                    WHEN ("facility_activity_entries"."data_provenance" = 'primary_measured_onsite'::"public"."data_provenance_enum") THEN 'primary_measured'::"text"
                    WHEN ("facility_activity_entries"."data_provenance" = 'secondary_calculated_allocation'::"public"."data_provenance_enum") THEN 'secondary_allocated'::"text"
                    WHEN ("facility_activity_entries"."data_provenance" = 'secondary_modelled_industry_average'::"public"."data_provenance_enum") THEN 'secondary_modelled'::"text"
                    ELSE 'secondary_modelled'::"text"
                END AS "provenance_category"
           FROM "public"."facility_activity_entries"
          WHERE ("facility_activity_entries"."facility_id" IS NOT NULL)
        UNION ALL
         SELECT "utility_data_entries"."facility_id",
            "utility_data_entries"."id" AS "entry_id",
                CASE
                    WHEN ("utility_data_entries"."data_quality" = 'actual'::"public"."data_quality_enum") THEN 'primary_measured'::"text"
                    WHEN ("utility_data_entries"."data_quality" = 'estimated'::"public"."data_quality_enum") THEN 'secondary_modelled'::"text"
                    ELSE 'secondary_modelled'::"text"
                END AS "provenance_category"
           FROM "public"."utility_data_entries"
          WHERE ("utility_data_entries"."facility_id" IS NOT NULL)
        )
 SELECT "facility_id",
    "count"(*) AS "total_entries",
    "sum"(
        CASE
            WHEN ("provenance_category" = 'primary_verified'::"text") THEN 1
            ELSE 0
        END) AS "primary_verified_count",
    "sum"(
        CASE
            WHEN ("provenance_category" = 'primary_measured'::"text") THEN 1
            ELSE 0
        END) AS "primary_measured_count",
    "sum"(
        CASE
            WHEN ("provenance_category" = 'secondary_allocated'::"text") THEN 1
            ELSE 0
        END) AS "secondary_allocated_count",
    "sum"(
        CASE
            WHEN ("provenance_category" = 'secondary_modelled'::"text") THEN 1
            ELSE 0
        END) AS "secondary_modelled_count",
        CASE
            WHEN ("count"(*) > 0) THEN "round"(((("sum"(
            CASE
                WHEN ("provenance_category" = ANY (ARRAY['primary_verified'::"text", 'primary_measured'::"text"])) THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) * (100)::numeric), 2)
            ELSE (0)::numeric
        END AS "primary_data_percentage",
        CASE
            WHEN ("count"(*) > 0) THEN "round"((((("sum"(
            CASE
                WHEN ("provenance_category" = 'primary_verified'::"text") THEN 95.0
                ELSE (0)::numeric
            END) + "sum"(
            CASE
                WHEN ("provenance_category" = 'primary_measured'::"text") THEN 90.0
                ELSE (0)::numeric
            END)) + "sum"(
            CASE
                WHEN ("provenance_category" = 'secondary_allocated'::"text") THEN 70.0
                ELSE (0)::numeric
            END)) + "sum"(
            CASE
                WHEN ("provenance_category" = 'secondary_modelled'::"text") THEN 50.0
                ELSE (0)::numeric
            END)) / ("count"(*))::numeric), 2)
            ELSE (0)::numeric
        END AS "average_confidence_score",
        CASE
            WHEN ("count"(*) = 0) THEN 'no_data'::"text"
            WHEN ((("sum"(
            CASE
                WHEN ("provenance_category" = ANY (ARRAY['primary_verified'::"text", 'primary_measured'::"text"])) THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) >= 0.80) THEN 'high'::"text"
            WHEN ((("sum"(
            CASE
                WHEN ("provenance_category" = ANY (ARRAY['primary_verified'::"text", 'primary_measured'::"text"])) THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) >= 0.50) THEN 'medium'::"text"
            WHEN ((("sum"(
            CASE
                WHEN ("provenance_category" = ANY (ARRAY['primary_verified'::"text", 'primary_measured'::"text"])) THEN 1
                ELSE 0
            END))::numeric / ("count"(*))::numeric) >= 0.30) THEN 'low'::"text"
            ELSE 'very_low'::"text"
        END AS "confidence_rating"
   FROM "combined_entries"
  GROUP BY "facility_id";


ALTER VIEW "public"."facility_confidence_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facility_data_contracts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "utility_type" "public"."utility_type_enum" NOT NULL,
    "frequency" "public"."frequency_enum" NOT NULL,
    "data_quality" "public"."data_quality_enum" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."facility_data_contracts" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_data_contracts" IS 'Defines what utility data each facility commits to providing';



COMMENT ON COLUMN "public"."facility_data_contracts"."frequency" IS 'How often data will be reported: monthly or yearly';



CREATE TABLE IF NOT EXISTS "public"."facility_data_quality_snapshot" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "snapshot_month" integer NOT NULL,
    "snapshot_year" integer NOT NULL,
    "overall_confidence_percentage" numeric NOT NULL,
    "confidence_rating" "text" NOT NULL,
    "utility_confidence_percentage" numeric,
    "water_confidence_percentage" numeric,
    "waste_confidence_percentage" numeric,
    "primary_supplier_verified_count" integer DEFAULT 0,
    "primary_measured_onsite_count" integer DEFAULT 0,
    "secondary_modelled_count" integer DEFAULT 0,
    "secondary_allocated_count" integer DEFAULT 0,
    "total_entries_count" integer DEFAULT 0,
    "previous_month_confidence" numeric,
    "confidence_change_percentage" numeric,
    "trend_direction" "text",
    "recommended_actions" "jsonb" DEFAULT '[]'::"jsonb",
    "priority_suppliers_to_engage" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "facility_data_quality_snapsh_overall_confidence_percentag_check" CHECK ((("overall_confidence_percentage" >= (0)::numeric) AND ("overall_confidence_percentage" <= (100)::numeric))),
    CONSTRAINT "facility_data_quality_snapsh_utility_confidence_percentag_check" CHECK ((("utility_confidence_percentage" >= (0)::numeric) AND ("utility_confidence_percentage" <= (100)::numeric))),
    CONSTRAINT "facility_data_quality_snapsho_waste_confidence_percentage_check" CHECK ((("waste_confidence_percentage" >= (0)::numeric) AND ("waste_confidence_percentage" <= (100)::numeric))),
    CONSTRAINT "facility_data_quality_snapsho_water_confidence_percentage_check" CHECK ((("water_confidence_percentage" >= (0)::numeric) AND ("water_confidence_percentage" <= (100)::numeric))),
    CONSTRAINT "facility_data_quality_snapshot_confidence_rating_check" CHECK (("confidence_rating" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text", 'very_low'::"text"]))),
    CONSTRAINT "facility_data_quality_snapshot_snapshot_month_check" CHECK ((("snapshot_month" >= 1) AND ("snapshot_month" <= 12))),
    CONSTRAINT "facility_data_quality_snapshot_snapshot_year_check" CHECK ((("snapshot_year" >= 2000) AND ("snapshot_year" <= 2100))),
    CONSTRAINT "facility_data_quality_snapshot_trend_direction_check" CHECK ((("trend_direction" IS NULL) OR ("trend_direction" = ANY (ARRAY['improving'::"text", 'stable'::"text", 'declining'::"text"]))))
);


ALTER TABLE "public"."facility_data_quality_snapshot" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_data_quality_snapshot" IS 'Monthly confidence score tracking for supplier engagement metrics.';



CREATE TABLE IF NOT EXISTS "public"."facility_emissions_aggregated" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "total_co2e" numeric NOT NULL,
    "unit" "text" DEFAULT 'kg CO₂e'::"text" NOT NULL,
    "results_payload" "jsonb" NOT NULL,
    "calculation_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "calculated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "total_production_volume" numeric,
    "volume_unit" "public"."production_volume_unit",
    "data_source_type" "public"."facility_data_source_type" DEFAULT 'Primary'::"public"."facility_data_source_type",
    "calculated_intensity" numeric,
    "fallback_intensity_factor" numeric,
    "facility_activity_type" "text",
    "reporting_session_id" "uuid",
    "units_produced" numeric,
    "intensity_basis" "text" DEFAULT 'per_unit'::"text",
    CONSTRAINT "facility_emissions_aggregated_intensity_basis_check" CHECK (("intensity_basis" = ANY (ARRAY['per_unit'::"text", 'per_bulk_volume'::"text", 'legacy'::"text"])))
);


ALTER TABLE "public"."facility_emissions_aggregated" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_emissions_aggregated" IS 'Aggregated Scope 1 and Scope 2 emissions calculations for facilities by reporting period';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."total_co2e" IS 'Total CO₂ equivalent emissions for the facility in the reporting period';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."results_payload" IS 'Immutable calculation snapshot containing disaggregated_summary, activity_data_ids, and emission_factor_ids';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."total_production_volume" IS 'Total bulk production volume (litres, hectolitres). OPTIONAL - units_produced is the primary metric.';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."volume_unit" IS 'Unit of measurement for production volume';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."data_source_type" IS 'Primary = Verified utility bills, Secondary_Average = Industry average proxy';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."calculated_intensity" IS 'Emission intensity per consumer unit (kg CO2e per bottle/can/unit). If intensity_basis is legacy, may need conversion.';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."fallback_intensity_factor" IS 'Industry average emission intensity. Used when data_source_type = Secondary_Average';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."facility_activity_type" IS 'Type of manufacturing activity for industry average lookup (e.g., Soft Drinks Bottling, Brewing)';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."units_produced" IS 'Total number of consumer units produced at this facility during the reporting period';



COMMENT ON COLUMN "public"."facility_emissions_aggregated"."intensity_basis" IS 'Basis for calculated_intensity: per_unit (per bottle/can), per_bulk_volume (per hectolitre), or legacy (unknown, needs verification)';



CREATE TABLE IF NOT EXISTS "public"."facility_product_assignments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "assignment_status" "text" DEFAULT 'active'::"text" NOT NULL,
    "is_primary_facility" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    CONSTRAINT "facility_product_assignments_assignment_status_check" CHECK (("assignment_status" = ANY (ARRAY['active'::"text", 'paused'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."facility_product_assignments" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_product_assignments" IS 'Links facilities to products they are assigned to produce';



COMMENT ON COLUMN "public"."facility_product_assignments"."assignment_status" IS 'Current status of the assignment: active, paused, or archived';



COMMENT ON COLUMN "public"."facility_product_assignments"."is_primary_facility" IS 'Whether this is the primary production facility for the product';



CREATE TABLE IF NOT EXISTS "public"."product_carbon_footprint_production_sites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_carbon_footprint_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "production_volume" numeric NOT NULL,
    "share_of_production" numeric,
    "facility_intensity" numeric,
    "attributable_emissions_per_unit" numeric,
    "data_source" "text" DEFAULT 'Verified'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "allocated_emissions_kg_co2e" numeric DEFAULT 0,
    "allocated_water_litres" numeric DEFAULT 0,
    "allocated_waste_kg" numeric DEFAULT 0,
    "emission_intensity_kg_co2e_per_unit" numeric DEFAULT 0,
    "water_intensity_litres_per_unit" numeric DEFAULT 0,
    "waste_intensity_kg_per_unit" numeric DEFAULT 0,
    "reporting_period_start" "date",
    "reporting_period_end" "date",
    "status" "text" DEFAULT 'draft'::"text",
    "co2e_entry_method" "text",
    "data_source_tag" "text",
    "is_energy_intensive_process" boolean DEFAULT false,
    "uses_proxy_data" boolean DEFAULT false,
    "total_facility_production_volume" numeric,
    "production_volume_unit" "text" DEFAULT 'units'::"text",
    "attribution_ratio" numeric,
    "supplier_id" "uuid",
    "scope1_emissions_kg_co2e" numeric DEFAULT 0,
    "scope2_emissions_kg_co2e" numeric DEFAULT 0,
    "scope3_emissions_kg_co2e" numeric DEFAULT 0,
    CONSTRAINT "product_lca_production_sites_data_source_check" CHECK (("data_source" = ANY (ARRAY['Verified'::"text", 'Industry_Average'::"text"]))),
    CONSTRAINT "product_lca_production_sites_production_volume_check" CHECK (("production_volume" > (0)::numeric)),
    CONSTRAINT "product_lca_production_sites_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'provisional'::"text", 'verified'::"text"])))
);


ALTER TABLE "public"."product_carbon_footprint_production_sites" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_carbon_footprint_production_sites" IS 'Links Product Carbon Footprints to manufacturing facilities with production volumes';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."production_volume" IS 'Number of CONSUMER UNITS (bottles, cans) produced at this facility for this product during the reporting period';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."share_of_production" IS 'Percentage of total production volume (auto-calculated)';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."facility_intensity" IS 'Facility emission intensity per consumer unit (kg CO2e per bottle/can). Cached from facility_emissions_aggregated.';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."attributable_emissions_per_unit" IS 'Weighted emissions per consumer unit allocated from this facility to this product';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."data_source" IS 'Quality indicator: Verified (primary data) or Industry_Average (proxy factor)';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."allocated_emissions_kg_co2e" IS 'Total CO2e emissions allocated to this product from this facility';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."allocated_water_litres" IS 'Total water consumption allocated to this product from this facility';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."allocated_waste_kg" IS 'Total waste generated allocated to this product from this facility';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."emission_intensity_kg_co2e_per_unit" IS 'CO2e emissions per unit of product';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."water_intensity_litres_per_unit" IS 'Water consumption per unit of product';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."waste_intensity_kg_per_unit" IS 'Waste generated per unit of product';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."reporting_period_start" IS 'Start date of the reporting period for facility data';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."reporting_period_end" IS 'End date of the reporting period for facility data';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."status" IS 'Allocation status: draft, provisional, or verified';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."scope1_emissions_kg_co2e" IS 'Direct GHG emissions from owned or controlled sources (e.g., on-site fuel combustion)';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."scope2_emissions_kg_co2e" IS 'Indirect GHG emissions from purchased electricity, heat, or steam';



COMMENT ON COLUMN "public"."product_carbon_footprint_production_sites"."scope3_emissions_kg_co2e" IS 'Other indirect GHG emissions in the value chain (typically minimal for manufacturing)';



CREATE OR REPLACE VIEW "public"."facility_product_allocation_matrix" AS
 WITH "assignments" AS (
         SELECT "fpa"."id" AS "assignment_id",
            "fpa"."organization_id",
            "fpa"."facility_id",
            "fpa"."product_id",
            "fpa"."assignment_status",
            "fpa"."is_primary_facility"
           FROM "public"."facility_product_assignments" "fpa"
          WHERE ("fpa"."assignment_status" = 'active'::"text")
        ), "cm_allocations" AS (
         SELECT DISTINCT ON ("cma"."facility_id", "cma"."product_id") "cma"."organization_id",
            "cma"."facility_id",
            "cma"."product_id",
            "cma"."id" AS "allocation_id",
            "cma"."allocated_emissions_kg_co2e",
            "cma"."reporting_period_start",
            "cma"."reporting_period_end",
            "cma"."status",
            "cma"."attribution_ratio",
            'contract_manufacturer'::"text" AS "allocation_type"
           FROM "public"."contract_manufacturer_allocations" "cma"
          ORDER BY "cma"."facility_id", "cma"."product_id", "cma"."reporting_period_end" DESC
        ), "owned_allocations" AS (
         SELECT DISTINCT ON ("ps"."facility_id", "pcf"."product_id") "ps"."organization_id",
            "ps"."facility_id",
            "pcf"."product_id",
            "ps"."id" AS "allocation_id",
            "ps"."allocated_emissions_kg_co2e",
            "ps"."reporting_period_start",
            "ps"."reporting_period_end",
            "ps"."status",
            "ps"."attribution_ratio",
            'owned'::"text" AS "allocation_type"
           FROM ("public"."product_carbon_footprint_production_sites" "ps"
             JOIN "public"."product_carbon_footprints" "pcf" ON (("pcf"."id" = "ps"."product_carbon_footprint_id")))
          ORDER BY "ps"."facility_id", "pcf"."product_id", "ps"."reporting_period_end" DESC NULLS LAST
        ), "all_allocations" AS (
         SELECT "cm_allocations"."organization_id",
            "cm_allocations"."facility_id",
            "cm_allocations"."product_id",
            "cm_allocations"."allocation_id",
            "cm_allocations"."allocated_emissions_kg_co2e",
            "cm_allocations"."reporting_period_start",
            "cm_allocations"."reporting_period_end",
            "cm_allocations"."status",
            "cm_allocations"."attribution_ratio",
            "cm_allocations"."allocation_type"
           FROM "cm_allocations"
        UNION ALL
         SELECT "owned_allocations"."organization_id",
            "owned_allocations"."facility_id",
            "owned_allocations"."product_id",
            "owned_allocations"."allocation_id",
            "owned_allocations"."allocated_emissions_kg_co2e",
            "owned_allocations"."reporting_period_start",
            "owned_allocations"."reporting_period_end",
            "owned_allocations"."status",
            "owned_allocations"."attribution_ratio",
            "owned_allocations"."allocation_type"
           FROM "owned_allocations"
        ), "latest_allocations" AS (
         SELECT DISTINCT ON ("all_allocations"."facility_id", "all_allocations"."product_id") "all_allocations"."organization_id",
            "all_allocations"."facility_id",
            "all_allocations"."product_id",
            "all_allocations"."allocation_id",
            "all_allocations"."allocated_emissions_kg_co2e",
            "all_allocations"."reporting_period_start",
            "all_allocations"."reporting_period_end",
            "all_allocations"."status",
            "all_allocations"."attribution_ratio",
            "all_allocations"."allocation_type"
           FROM "all_allocations"
          ORDER BY "all_allocations"."facility_id", "all_allocations"."product_id", "all_allocations"."reporting_period_end" DESC NULLS LAST
        )
 SELECT "a"."assignment_id",
    COALESCE("a"."organization_id", "la"."organization_id") AS "organization_id",
    COALESCE("a"."facility_id", "la"."facility_id") AS "facility_id",
    COALESCE("a"."product_id", "la"."product_id") AS "product_id",
    "f"."name" AS "facility_name",
    "f"."address_city",
    "f"."address_country",
    "f"."operational_control",
    "p"."name" AS "product_name",
    "a"."assignment_status",
    "a"."is_primary_facility" AS "primary_facility",
    ("la"."allocation_id" IS NOT NULL) AS "has_allocations",
    "la"."allocation_type",
        CASE
            WHEN ("la"."allocation_id" IS NOT NULL) THEN "jsonb_build_object"('allocated_emissions', COALESCE("la"."allocated_emissions_kg_co2e", (0)::numeric), 'reporting_period_start', "la"."reporting_period_start", 'reporting_period_end', "la"."reporting_period_end", 'status', "la"."status", 'attribution_ratio', COALESCE("la"."attribution_ratio", (0)::numeric))
            ELSE NULL::"jsonb"
        END AS "latest_allocation"
   FROM ((("assignments" "a"
     FULL JOIN "latest_allocations" "la" ON ((("a"."facility_id" = "la"."facility_id") AND ("a"."product_id" = "la"."product_id"))))
     LEFT JOIN "public"."facilities" "f" ON (("f"."id" = COALESCE("a"."facility_id", "la"."facility_id"))))
     LEFT JOIN "public"."products" "p" ON (("p"."id" = COALESCE("a"."product_id", "la"."product_id"))))
  WHERE (COALESCE("a"."organization_id", "la"."organization_id") IS NOT NULL);


ALTER VIEW "public"."facility_product_allocation_matrix" OWNER TO "postgres";


COMMENT ON VIEW "public"."facility_product_allocation_matrix" IS 'Matrix view showing facility-product assignments and their allocation status for the Production Allocation Hub';



CREATE TABLE IF NOT EXISTS "public"."facility_reporting_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "total_production_volume" numeric NOT NULL,
    "volume_unit" "text" NOT NULL,
    "data_source_type" "text" NOT NULL,
    "facility_activity_type" "text",
    "fallback_intensity_factor" numeric,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "facility_reporting_sessions_data_source_type_check" CHECK (("data_source_type" = ANY (ARRAY['Primary'::"text", 'Secondary_Average'::"text"]))),
    CONSTRAINT "positive_volume" CHECK (("total_production_volume" > (0)::numeric)),
    CONSTRAINT "valid_period" CHECK (("reporting_period_end" > "reporting_period_start"))
);


ALTER TABLE "public"."facility_reporting_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facility_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."facility_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."facility_water_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "reporting_year" integer NOT NULL,
    "reporting_month" integer,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "total_consumption_m3" numeric DEFAULT 0 NOT NULL,
    "municipal_consumption_m3" numeric DEFAULT 0,
    "groundwater_consumption_m3" numeric DEFAULT 0,
    "surface_water_consumption_m3" numeric DEFAULT 0,
    "rainwater_consumption_m3" numeric DEFAULT 0,
    "recycled_consumption_m3" numeric DEFAULT 0,
    "total_discharge_m3" numeric DEFAULT 0,
    "discharge_to_municipal_m3" numeric DEFAULT 0,
    "discharge_to_surface_water_m3" numeric DEFAULT 0,
    "discharge_treatment_level" "public"."water_treatment_level" DEFAULT 'none'::"public"."water_treatment_level",
    "net_consumption_m3" numeric GENERATED ALWAYS AS (("total_consumption_m3" - COALESCE("total_discharge_m3", (0)::numeric))) STORED,
    "recycling_rate" numeric GENERATED ALWAYS AS (
CASE
    WHEN ("total_consumption_m3" > (0)::numeric) THEN "round"(((COALESCE("recycled_consumption_m3", (0)::numeric) / "total_consumption_m3") * (100)::numeric), 2)
    ELSE (0)::numeric
END) STORED,
    "production_volume" numeric,
    "production_unit" "text" DEFAULT 'units'::"text",
    "water_intensity_m3_per_unit" numeric GENERATED ALWAYS AS (
CASE
    WHEN (COALESCE("production_volume", (0)::numeric) > (0)::numeric) THEN "round"(("total_consumption_m3" / "production_volume"), 6)
    ELSE NULL::numeric
END) STORED,
    "data_quality" "text" DEFAULT 'estimated'::"text",
    "measurement_method" "text",
    "data_source" "text",
    "notes" "text",
    "aware_factor" numeric,
    "scarcity_weighted_consumption_m3" numeric GENERATED ALWAYS AS (("total_consumption_m3" * COALESCE("aware_factor", (1)::numeric))) STORED,
    "risk_level" "text" GENERATED ALWAYS AS (
CASE
    WHEN (COALESCE("aware_factor", (1)::numeric) >= (10)::numeric) THEN 'high'::"text"
    WHEN (COALESCE("aware_factor", (1)::numeric) >= (1)::numeric) THEN 'medium'::"text"
    ELSE 'low'::"text"
END) STORED,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "facility_water_data_data_quality_check" CHECK (("data_quality" = ANY (ARRAY['measured'::"text", 'metered'::"text", 'estimated'::"text", 'proxy'::"text"]))),
    CONSTRAINT "facility_water_data_groundwater_consumption_m3_check" CHECK (("groundwater_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_municipal_consumption_m3_check" CHECK (("municipal_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_rainwater_consumption_m3_check" CHECK (("rainwater_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_recycled_consumption_m3_check" CHECK (("recycled_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_reporting_month_check" CHECK ((("reporting_month" >= 1) AND ("reporting_month" <= 12))),
    CONSTRAINT "facility_water_data_surface_water_consumption_m3_check" CHECK (("surface_water_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_total_consumption_m3_check" CHECK (("total_consumption_m3" >= (0)::numeric)),
    CONSTRAINT "facility_water_data_total_discharge_m3_check" CHECK (("total_discharge_m3" >= (0)::numeric))
);


ALTER TABLE "public"."facility_water_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_water_data" IS 'Facility-level water consumption and discharge tracking with AWARE methodology';



COMMENT ON COLUMN "public"."facility_water_data"."aware_factor" IS 'AWARE water scarcity factor for facility location (higher = more water stress)';



COMMENT ON COLUMN "public"."facility_water_data"."scarcity_weighted_consumption_m3" IS 'Consumption weighted by AWARE factor (m³ world equivalent)';



CREATE TABLE IF NOT EXISTS "public"."facility_water_discharge_quality" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "facility_water_data_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "bod_mg_l" numeric,
    "cod_mg_l" numeric,
    "tss_mg_l" numeric,
    "ph" numeric,
    "temperature_c" numeric,
    "total_nitrogen_mg_l" numeric,
    "total_phosphorus_mg_l" numeric,
    "meets_local_standards" boolean DEFAULT true,
    "compliance_notes" "text",
    "sample_date" "date",
    "lab_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "facility_water_discharge_quality_bod_mg_l_check" CHECK (("bod_mg_l" >= (0)::numeric)),
    CONSTRAINT "facility_water_discharge_quality_cod_mg_l_check" CHECK (("cod_mg_l" >= (0)::numeric)),
    CONSTRAINT "facility_water_discharge_quality_ph_check" CHECK ((("ph" >= (0)::numeric) AND ("ph" <= (14)::numeric))),
    CONSTRAINT "facility_water_discharge_quality_total_nitrogen_mg_l_check" CHECK (("total_nitrogen_mg_l" >= (0)::numeric)),
    CONSTRAINT "facility_water_discharge_quality_total_phosphorus_mg_l_check" CHECK (("total_phosphorus_mg_l" >= (0)::numeric)),
    CONSTRAINT "facility_water_discharge_quality_tss_mg_l_check" CHECK (("tss_mg_l" >= (0)::numeric))
);


ALTER TABLE "public"."facility_water_discharge_quality" OWNER TO "postgres";


COMMENT ON TABLE "public"."facility_water_discharge_quality" IS 'Discharge water quality metrics for environmental compliance';



CREATE OR REPLACE VIEW "public"."factor_usage_statistics" AS
 SELECT "organization_id",
    "unnest"("factor_ids_used") AS "factor_id",
    "count"(*) AS "usage_count",
    "min"("created_at") AS "first_used",
    "max"("created_at") AS "last_used"
   FROM "public"."calculation_logs"
  GROUP BY "organization_id", ("unnest"("factor_ids_used"));


ALTER VIEW "public"."factor_usage_statistics" OWNER TO "postgres";


COMMENT ON VIEW "public"."factor_usage_statistics" IS 'Tracks which emissions factors are used in calculations and how frequently. Useful for identifying commonly used factors and assessing impact of factor updates. Respects RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."feedback_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ticket_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "message" "text" NOT NULL,
    "is_admin_reply" boolean DEFAULT false,
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "is_read" boolean DEFAULT false,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."feedback_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."feedback_messages" IS 'Conversation thread messages for feedback tickets';



COMMENT ON COLUMN "public"."feedback_messages"."is_admin_reply" IS 'True if message is from Alkatera admin';



CREATE OR REPLACE VIEW "public"."feedback_tickets_with_users" AS
 SELECT "ft"."id",
    "ft"."organization_id",
    "ft"."created_by",
    "ft"."title",
    "ft"."description",
    "ft"."category",
    "ft"."priority",
    "ft"."status",
    "ft"."assigned_to",
    "ft"."resolved_at",
    "ft"."resolution_notes",
    "ft"."attachments",
    "ft"."browser_info",
    "ft"."page_url",
    "ft"."metadata",
    "ft"."created_at",
    "ft"."updated_at",
    "p"."full_name" AS "creator_name",
    "p"."email" AS "creator_email",
    "o"."name" AS "organization_name",
    ( SELECT "count"(*) AS "count"
           FROM "public"."feedback_messages" "fm"
          WHERE (("fm"."ticket_id" = "ft"."id") AND ("fm"."is_read" = false) AND ("fm"."is_admin_reply" = false))) AS "unread_user_messages",
    ( SELECT "max"("fm"."created_at") AS "max"
           FROM "public"."feedback_messages" "fm"
          WHERE ("fm"."ticket_id" = "ft"."id")) AS "last_message_at"
   FROM (("public"."feedback_tickets" "ft"
     LEFT JOIN "public"."profiles" "p" ON (("ft"."created_by" = "p"."id")))
     LEFT JOIN "public"."organizations" "o" ON (("ft"."organization_id" = "o"."id")));


ALTER VIEW "public"."feedback_tickets_with_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."fleet_activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "vehicle_id" "uuid",
    "activity_date" "date" NOT NULL,
    "distance_km" double precision,
    "purpose" "text",
    "driver_name" "text",
    "emissions_tco2e" double precision,
    "scope" "text",
    "calculation_log_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "data_entry_method" "text" DEFAULT 'distance'::"text",
    "fuel_volume_litres" numeric,
    "spend_amount" numeric,
    "spend_currency" "text" DEFAULT 'GBP'::"text",
    "electricity_kwh" numeric,
    "grid_region" "text" DEFAULT 'UK'::"text",
    "data_quality" "text" DEFAULT 'Secondary'::"text",
    "data_source_notes" "text",
    "provenance_id" "uuid",
    "reporting_period_start" "date",
    "reporting_period_end" "date",
    "manual_vehicle_category" "text",
    "manual_fuel_type" "text",
    "manual_ownership_type" "text",
    "emission_factor_id" "uuid",
    CONSTRAINT "fleet_activities_activity_value_check" CHECK ((("distance_km" IS NOT NULL) OR ("fuel_volume_litres" IS NOT NULL) OR ("electricity_kwh" IS NOT NULL) OR ("spend_amount" IS NOT NULL))),
    CONSTRAINT "fleet_activities_data_entry_method_check" CHECK (("data_entry_method" = ANY (ARRAY['volume'::"text", 'distance'::"text", 'spend'::"text", 'consumption'::"text"]))),
    CONSTRAINT "fleet_activities_data_quality_check" CHECK (("data_quality" = ANY (ARRAY['Primary'::"text", 'Secondary'::"text", 'Tertiary'::"text"]))),
    CONSTRAINT "fleet_activities_distance_km_check" CHECK (("distance_km" > (0)::double precision)),
    CONSTRAINT "fleet_activities_emissions_tco2e_check" CHECK (("emissions_tco2e" >= (0)::double precision)),
    CONSTRAINT "fleet_activities_manual_ownership_type_check" CHECK (("manual_ownership_type" = ANY (ARRAY['company_owned'::"text", 'company_leased'::"text", 'employee_owned'::"text", 'rental'::"text"]))),
    CONSTRAINT "fleet_activities_scope_check" CHECK (("scope" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text", 'Scope 3 Cat 6'::"text"]))),
    CONSTRAINT "fleet_activities_spend_currency_check" CHECK (("spend_currency" = ANY (ARRAY['GBP'::"text", 'USD'::"text", 'EUR'::"text"]))),
    CONSTRAINT "fleet_activities_vehicle_identification_check" CHECK ((("vehicle_id" IS NOT NULL) OR (("manual_vehicle_category" IS NOT NULL) AND ("manual_fuel_type" IS NOT NULL) AND ("manual_ownership_type" IS NOT NULL))))
);


ALTER TABLE "public"."fleet_activities" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_activities" IS 'Journey logging table for fleet vehicles with automatic scope determination and emissions calculation';



COMMENT ON COLUMN "public"."fleet_activities"."activity_date" IS 'Date when the journey took place';



COMMENT ON COLUMN "public"."fleet_activities"."distance_km" IS 'Distance travelled in kilometres (must be positive)';



COMMENT ON COLUMN "public"."fleet_activities"."purpose" IS 'Optional journey purpose/description (e.g., "Client meeting in London", "Delivery to warehouse")';



COMMENT ON COLUMN "public"."fleet_activities"."driver_name" IS 'Optional driver name or identifier';



COMMENT ON COLUMN "public"."fleet_activities"."emissions_tco2e" IS 'Calculated emissions in tonnes CO2 equivalent (populated by calculate-fleet-emissions function)';



COMMENT ON COLUMN "public"."fleet_activities"."scope" IS 'GHG Protocol scope (Scope 1 for ICE vehicles, Scope 2 for BEV vehicles)';



COMMENT ON COLUMN "public"."fleet_activities"."calculation_log_id" IS 'Foreign key to calculation_logs for full audit trail and Glass Box compliance';



COMMENT ON COLUMN "public"."fleet_activities"."created_by" IS 'User who logged this journey for accountability tracking';



CREATE OR REPLACE VIEW "public"."fleet_annual_emissions" AS
 SELECT "organization_id",
    (EXTRACT(year FROM COALESCE("reporting_period_start", "activity_date")))::integer AS "reporting_year",
    "scope" AS "calculated_scope",
    "sum"("emissions_tco2e") AS "total_tco2e",
    "sum"("distance_km") AS "total_distance_km",
    "sum"("fuel_volume_litres") AS "total_fuel_litres",
    "count"(*) AS "activity_count"
   FROM "public"."fleet_activities"
  WHERE ("emissions_tco2e" IS NOT NULL)
  GROUP BY "organization_id", (EXTRACT(year FROM COALESCE("reporting_period_start", "activity_date"))), "scope";


ALTER VIEW "public"."fleet_annual_emissions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."fleet_ccf_summary" AS
 SELECT "organization_id",
    (EXTRACT(year FROM COALESCE("reporting_period_start", "activity_date")))::integer AS "reporting_year",
    "scope",
    "sum"("emissions_tco2e") AS "total_emissions_tco2e",
    "count"(*) AS "activity_count",
    "sum"("distance_km") AS "total_distance_km",
    "sum"("fuel_volume_litres") AS "total_fuel_litres",
    "sum"("electricity_kwh") AS "total_electricity_kwh"
   FROM "public"."fleet_activities"
  WHERE ("emissions_tco2e" IS NOT NULL)
  GROUP BY "organization_id", (EXTRACT(year FROM COALESCE("reporting_period_start", "activity_date"))), "scope";


ALTER VIEW "public"."fleet_ccf_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."fleet_ccf_summary" IS 'Summary view of fleet emissions for corporate carbon footprint reporting. 
Aggregates by organisation, year, and scope.';



CREATE TABLE IF NOT EXISTS "public"."fleet_emission_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_name" "text" NOT NULL,
    "fuel_type" "text" NOT NULL,
    "vehicle_category" "text" NOT NULL,
    "calculated_scope" "text" NOT NULL,
    "default_unit" "text" NOT NULL,
    "supports_volume" boolean DEFAULT false,
    "supports_distance" boolean DEFAULT false,
    "supports_spend" boolean DEFAULT false,
    "supports_consumption" boolean DEFAULT false,
    "emission_factor_volume_id" "uuid",
    "emission_factor_distance_id" "uuid",
    "emission_factor_spend_id" "uuid",
    "emission_factor_consumption_id" "uuid",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fleet_emission_sources_calculated_scope_check" CHECK (("calculated_scope" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text", 'Scope 3 Cat 6'::"text"]))),
    CONSTRAINT "fleet_emission_sources_fuel_type_check" CHECK (("fuel_type" = ANY (ARRAY['diesel'::"text", 'petrol'::"text", 'electric'::"text", 'lpg'::"text", 'hybrid_diesel'::"text", 'hybrid_petrol'::"text", 'biodiesel'::"text", 'cng'::"text", 'hydrogen'::"text"]))),
    CONSTRAINT "fleet_emission_sources_vehicle_category_check" CHECK (("vehicle_category" = ANY (ARRAY['car'::"text", 'van'::"text", 'hgv'::"text", 'motorcycle'::"text", 'bus'::"text", 'taxi'::"text"])))
);


ALTER TABLE "public"."fleet_emission_sources" OWNER TO "postgres";


COMMENT ON TABLE "public"."fleet_emission_sources" IS 'Reference table mapping vehicle fuel/category combinations to emission factors and supported data entry methods';



CREATE OR REPLACE VIEW "public"."fleet_emissions_by_scope" AS
 SELECT "organization_id",
    "scope" AS "calculated_scope",
    "data_entry_method",
    "count"(*) AS "entry_count",
    "sum"("emissions_tco2e") AS "total_tco2e",
    "min"(COALESCE("reporting_period_start", "activity_date")) AS "earliest_period",
    "max"(COALESCE("reporting_period_end", "activity_date")) AS "latest_period"
   FROM "public"."fleet_activities"
  WHERE ("emissions_tco2e" IS NOT NULL)
  GROUP BY "organization_id", "scope", "data_entry_method";


ALTER VIEW "public"."fleet_emissions_by_scope" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "facility_id" "uuid",
    "vehicle_class" "text" NOT NULL,
    "propulsion_type" "text" NOT NULL,
    "fuel_type" "text",
    "registration_number" "text",
    "make_model" "text",
    "year_of_manufacture" integer,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "ownership_type" "text" DEFAULT 'company_owned'::"text",
    "calculated_scope" "text",
    "driver_name" "text",
    "department" "text",
    "cost_center" "text",
    "date_acquired" "date" DEFAULT CURRENT_DATE,
    "date_disposed" "date",
    CONSTRAINT "vehicles_calculated_scope_check" CHECK (("calculated_scope" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text", 'Scope 3 Cat 6'::"text"]))),
    CONSTRAINT "vehicles_fuel_type_check" CHECK (("fuel_type" = ANY (ARRAY['Diesel'::"text", 'Petrol'::"text", 'LPG'::"text", 'CNG'::"text", 'Hybrid'::"text", 'Unknown'::"text"]))),
    CONSTRAINT "vehicles_ownership_type_check" CHECK (("ownership_type" = ANY (ARRAY['company_owned'::"text", 'company_leased'::"text", 'employee_owned'::"text", 'rental'::"text"]))),
    CONSTRAINT "vehicles_propulsion_type_check" CHECK (("propulsion_type" = ANY (ARRAY['ICE'::"text", 'BEV'::"text", 'PHEV'::"text", 'HEV'::"text"]))),
    CONSTRAINT "vehicles_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'decommissioned'::"text"]))),
    CONSTRAINT "vehicles_year_of_manufacture_check" CHECK ((("year_of_manufacture" >= 1900) AND (("year_of_manufacture")::numeric <= (EXTRACT(year FROM CURRENT_DATE) + (2)::numeric))))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


COMMENT ON TABLE "public"."vehicles" IS 'Fleet management table tracking organizational vehicles with propulsion types for Smart Scope routing (ICE → Scope 1, BEV → Scope 2)';



COMMENT ON COLUMN "public"."vehicles"."vehicle_class" IS 'DEFRA vehicle classification matching emissions_factors table (e.g., "Average Car", "Class III Van")';



COMMENT ON COLUMN "public"."vehicles"."propulsion_type" IS 'Propulsion method: ICE (Internal Combustion), BEV (Battery Electric), PHEV (Plug-in Hybrid), HEV (Hybrid)';



COMMENT ON COLUMN "public"."vehicles"."fuel_type" IS 'Fuel type for ICE vehicles: Diesel, Petrol, LPG, CNG, Hybrid, or Unknown';



COMMENT ON COLUMN "public"."vehicles"."registration_number" IS 'Vehicle registration plate number (must be unique across all organizations)';



COMMENT ON COLUMN "public"."vehicles"."make_model" IS 'Vehicle manufacturer and model (e.g., "Tesla Model 3", "Ford Transit Custom")';



COMMENT ON COLUMN "public"."vehicles"."status" IS 'Vehicle operational status: active (in use), inactive (temporarily off-road), decommissioned (permanently removed from fleet)';



CREATE OR REPLACE VIEW "public"."fleet_vehicle_summary" AS
 SELECT "organization_id",
    "calculated_scope",
    "fuel_type",
    "vehicle_class" AS "vehicle_category",
    "ownership_type",
    "count"(*) FILTER (WHERE ("status" = 'active'::"text")) AS "active_vehicles",
    "count"(*) FILTER (WHERE ("status" <> 'active'::"text")) AS "inactive_vehicles",
    "count"(*) AS "total_vehicles"
   FROM "public"."vehicles"
  GROUP BY "organization_id", "calculated_scope", "fuel_type", "vehicle_class", "ownership_type";


ALTER VIEW "public"."fleet_vehicle_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."framework_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "requirement_code" character varying(100) NOT NULL,
    "requirement_name" character varying(255) NOT NULL,
    "requirement_category" character varying(100),
    "parent_requirement_id" "uuid",
    "section" character varying(100),
    "subsection" character varying(100),
    "order_index" integer,
    "description" "text",
    "guidance" "text",
    "examples" "text",
    "max_points" numeric(5,2),
    "is_mandatory" boolean DEFAULT false,
    "is_conditional" boolean DEFAULT false,
    "conditional_logic" "text",
    "required_data_sources" "text"[],
    "evidence_requirements" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."framework_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gaia_analytics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "total_conversations" integer DEFAULT 0,
    "new_conversations" integer DEFAULT 0,
    "total_messages" integer DEFAULT 0,
    "user_messages" integer DEFAULT 0,
    "assistant_messages" integer DEFAULT 0,
    "positive_feedback" integer DEFAULT 0,
    "negative_feedback" integer DEFAULT 0,
    "avg_response_time_ms" numeric,
    "avg_tokens_per_response" numeric,
    "top_questions" "jsonb" DEFAULT '[]'::"jsonb",
    "questions_by_category" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."gaia_analytics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gaia_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text",
    "is_active" boolean DEFAULT true,
    "message_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone
);


ALTER TABLE "public"."gaia_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."gaia_conversations" IS 'Gaia AI conversation sessions per user';



CREATE TABLE IF NOT EXISTS "public"."gaia_feedback" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "message_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "rating" "text" NOT NULL,
    "feedback_text" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gaia_feedback_rating_check" CHECK (("rating" = ANY (ARRAY['positive'::"text", 'negative'::"text"])))
);


ALTER TABLE "public"."gaia_feedback" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gaia_knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "entry_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" NOT NULL,
    "example_question" "text",
    "example_answer" "text",
    "category" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "is_active" boolean DEFAULT true,
    "priority" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gaia_knowledge_base_entry_type_check" CHECK (("entry_type" = ANY (ARRAY['instruction'::"text", 'example_qa'::"text", 'definition'::"text", 'guideline'::"text"])))
);


ALTER TABLE "public"."gaia_knowledge_base" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."gaia_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "chart_data" "jsonb",
    "data_sources" "jsonb" DEFAULT '[]'::"jsonb",
    "tokens_used" integer,
    "processing_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "gaia_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text"])))
);


ALTER TABLE "public"."gaia_messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."gaia_messages" IS 'Individual messages in Gaia conversations';



CREATE TABLE IF NOT EXISTS "public"."generated_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "report_name" "text" NOT NULL,
    "report_year" integer NOT NULL,
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "config" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "audience" "text" NOT NULL,
    "output_format" "text" DEFAULT 'pptx'::"text" NOT NULL,
    "standards" "text"[] DEFAULT ARRAY['csrd'::"text", 'iso-14067'::"text"] NOT NULL,
    "sections" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "logo_url" "text",
    "primary_color" "text" DEFAULT '#2563eb'::"text",
    "secondary_color" "text" DEFAULT '#10b981'::"text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "skywork_query" "text",
    "document_url" "text",
    "error_message" "text",
    "data_snapshot" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "generated_at" timestamp with time zone,
    "downloaded_at" timestamp with time zone,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_multi_year" boolean DEFAULT false,
    "report_years" integer[] DEFAULT '{}'::integer[],
    "parent_report_id" "uuid",
    "version" integer DEFAULT 1,
    "is_latest" boolean DEFAULT true,
    "changelog" "text",
    CONSTRAINT "generated_reports_audience_check" CHECK (("audience" = ANY (ARRAY['investors'::"text", 'regulators'::"text", 'customers'::"text", 'internal'::"text", 'supply-chain'::"text", 'technical'::"text"]))),
    CONSTRAINT "generated_reports_output_format_check" CHECK (("output_format" = ANY (ARRAY['docx'::"text", 'xlsx'::"text", 'pptx'::"text"]))),
    CONSTRAINT "generated_reports_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'generating'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."generated_reports" OWNER TO "postgres";


COMMENT ON TABLE "public"."generated_reports" IS 'Stores configuration and metadata for AI-generated sustainability reports using Skywork API';



COMMENT ON COLUMN "public"."generated_reports"."skywork_query" IS 'Exact query sent to Skywork API for reproducibility and debugging';



COMMENT ON COLUMN "public"."generated_reports"."data_snapshot" IS 'Complete snapshot of data used in report generation for audit trail and CSRD compliance';



CREATE OR REPLACE VIEW "public"."ghg_hotspots_view" WITH ("security_invoker"='true') AS
 WITH "latest_period" AS (
         SELECT "ghg_emissions"."organization_id",
            "max"("ghg_emissions"."reporting_period") AS "latest_period"
           FROM "public"."ghg_emissions"
          GROUP BY "ghg_emissions"."organization_id"
        ), "org_totals" AS (
         SELECT "e_1"."organization_id",
            "e_1"."reporting_period",
            "sum"("e_1"."total_emissions") AS "org_total_emissions"
           FROM ("public"."ghg_emissions" "e_1"
             JOIN "latest_period" "lp_1" ON ((("e_1"."organization_id" = "lp_1"."organization_id") AND ("e_1"."reporting_period" = "lp_1"."latest_period"))))
          GROUP BY "e_1"."organization_id", "e_1"."reporting_period"
        )
 SELECT "e"."organization_id",
    "e"."reporting_period",
    "c"."scope",
    "c"."name" AS "category_name",
    "sum"("e"."total_emissions") AS "total_emissions",
    "round"((("sum"("e"."total_emissions") / NULLIF("ot"."org_total_emissions", (0)::numeric)) * (100)::numeric), 2) AS "percentage_of_total",
    "count"("e"."id") AS "emission_count"
   FROM ((("public"."ghg_emissions" "e"
     JOIN "latest_period" "lp" ON ((("e"."organization_id" = "lp"."organization_id") AND ("e"."reporting_period" = "lp"."latest_period"))))
     JOIN "public"."ghg_categories" "c" ON (("e"."category_id" = "c"."id")))
     JOIN "org_totals" "ot" ON ((("e"."organization_id" = "ot"."organization_id") AND ("e"."reporting_period" = "ot"."reporting_period"))))
  WHERE ("c"."is_active" = true)
  GROUP BY "e"."organization_id", "e"."reporting_period", "c"."scope", "c"."name", "ot"."org_total_emissions"
  ORDER BY ("sum"("e"."total_emissions")) DESC;


ALTER VIEW "public"."ghg_hotspots_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."ghg_hotspots_view" IS 'Aggregated view of GHG emissions by category for the latest reporting period. Shows emission hotspots with percentages. Uses security_invoker=true to inherit RLS from ghg_emissions table.';



CREATE TABLE IF NOT EXISTS "public"."governance_board_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "member_name" character varying(255) NOT NULL,
    "role" character varying(100) NOT NULL,
    "member_type" character varying(100) NOT NULL,
    "gender" character varying(50),
    "age_bracket" character varying(50),
    "ethnicity" character varying(100),
    "disability_status" character varying(50),
    "expertise_areas" "text"[],
    "industry_experience" "text",
    "appointment_date" "date",
    "term_end_date" "date",
    "is_current" boolean DEFAULT true,
    "committee_memberships" "text"[],
    "is_independent" boolean,
    "independence_assessment" "text",
    "meeting_attendance_rate" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_board_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_ethics_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "record_type" character varying(100) NOT NULL,
    "record_name" character varying(255) NOT NULL,
    "description" "text",
    "record_date" "date" NOT NULL,
    "resolution_date" "date",
    "participants" integer,
    "completion_rate" numeric(5,2),
    "severity" character varying(50),
    "status" character varying(50),
    "resolution_summary" "text",
    "corrective_actions" "text",
    "lessons_learned" "text",
    "is_confidential" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_ethics_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_lobbying" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "activity_type" character varying(100) NOT NULL,
    "activity_name" character varying(255) NOT NULL,
    "description" "text",
    "activity_date" "date",
    "reporting_period_start" "date",
    "reporting_period_end" "date",
    "amount" numeric(12,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "recipient_name" character varying(255),
    "recipient_type" character varying(100),
    "policy_topics" "text"[],
    "aligned_with_climate_commitments" boolean,
    "alignment_notes" "text",
    "is_public" boolean DEFAULT false,
    "disclosure_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_lobbying" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_mission" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "mission_statement" "text",
    "mission_last_updated" "date",
    "vision_statement" "text",
    "core_values" "jsonb",
    "purpose_statement" "text",
    "purpose_type" character varying(100),
    "legal_structure" character varying(100),
    "is_benefit_corporation" boolean DEFAULT false,
    "benefit_corp_registration_date" "date",
    "articles_include_stakeholder_consideration" boolean,
    "articles_last_amended" "date",
    "sdg_commitments" integer[],
    "climate_commitments" "text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_mission" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "policy_name" character varying(255) NOT NULL,
    "policy_code" character varying(50),
    "policy_type" character varying(100) NOT NULL,
    "description" "text",
    "scope" "text",
    "owner_name" character varying(255),
    "owner_department" character varying(255),
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "effective_date" "date",
    "review_date" "date",
    "last_reviewed_at" timestamp with time zone,
    "is_public" boolean DEFAULT false,
    "public_url" "text",
    "bcorp_requirement" character varying(255),
    "csrd_requirement" character varying(255),
    "attachments" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_policy_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "version_number" character varying(20) NOT NULL,
    "version_date" "date" NOT NULL,
    "content_summary" "text",
    "document_url" "text",
    "approved_by" character varying(255),
    "approval_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_policy_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "overall_score" numeric(5,2),
    "policy_score" numeric(5,2),
    "stakeholder_score" numeric(5,2),
    "board_score" numeric(5,2),
    "ethics_score" numeric(5,2),
    "transparency_score" numeric(5,2),
    "data_completeness" numeric(5,2),
    "calculated_at" timestamp with time zone DEFAULT "now"(),
    "calculation_period_start" "date",
    "calculation_period_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_stakeholder_engagements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stakeholder_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "engagement_date" "date" NOT NULL,
    "engagement_type" character varying(100) NOT NULL,
    "description" "text",
    "internal_participants" "text"[],
    "external_participants" integer,
    "key_topics" "text"[],
    "key_outcomes" "text",
    "follow_up_actions" "text",
    "evidence_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_stakeholder_engagements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."governance_stakeholders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "stakeholder_name" character varying(255) NOT NULL,
    "stakeholder_type" character varying(100) NOT NULL,
    "contact_name" character varying(255),
    "contact_email" character varying(255),
    "contact_role" character varying(255),
    "engagement_frequency" character varying(50),
    "engagement_method" character varying(100),
    "last_engagement_date" "date",
    "next_scheduled_engagement" "date",
    "relationship_quality" character varying(50),
    "key_interests" "text",
    "influence_level" character varying(50),
    "impact_level" character varying(50),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."governance_stakeholders" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."governance_summary" AS
 SELECT "p"."organization_id",
    "count"(DISTINCT "p"."id") FILTER (WHERE (("p"."status")::"text" = 'active'::"text")) AS "active_policies",
    "count"(DISTINCT "p"."id") FILTER (WHERE (("p"."status")::"text" = 'draft'::"text")) AS "draft_policies",
    "count"(DISTINCT "p"."id") FILTER (WHERE ("p"."review_date" <= (CURRENT_DATE + '30 days'::interval))) AS "policies_due_review",
    "count"(DISTINCT "s"."id") AS "total_stakeholders",
    "count"(DISTINCT "se"."id") FILTER (WHERE ("se"."engagement_date" >= (CURRENT_DATE - '90 days'::interval))) AS "recent_engagements",
    "count"(DISTINCT "b"."id") FILTER (WHERE ("b"."is_current" = true)) AS "current_board_members",
    "count"(DISTINCT "b"."id") FILTER (WHERE (("b"."is_current" = true) AND ("b"."is_independent" = true))) AS "independent_board_members",
    "count"(DISTINCT "e"."id") FILTER (WHERE ((("e"."record_type")::"text" = 'ethics_training'::"text") AND ("e"."record_date" >= (CURRENT_DATE - '1 year'::interval)))) AS "ethics_trainings_this_year",
    "count"(DISTINCT "e"."id") FILTER (WHERE ((("e"."record_type")::"text" = 'whistleblowing_case'::"text") AND (("e"."status")::"text" = 'open'::"text"))) AS "open_whistleblowing_cases"
   FROM (((("public"."governance_policies" "p"
     LEFT JOIN "public"."governance_stakeholders" "s" ON (("s"."organization_id" = "p"."organization_id")))
     LEFT JOIN "public"."governance_stakeholder_engagements" "se" ON (("se"."organization_id" = "p"."organization_id")))
     LEFT JOIN "public"."governance_board_members" "b" ON (("b"."organization_id" = "p"."organization_id")))
     LEFT JOIN "public"."governance_ethics_records" "e" ON (("e"."organization_id" = "p"."organization_id")))
  GROUP BY "p"."organization_id";


ALTER VIEW "public"."governance_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."greenwash_assessment_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "assessment_id" "uuid" NOT NULL,
    "claim_text" "text" NOT NULL,
    "claim_context" "text",
    "risk_level" "text" NOT NULL,
    "risk_score" integer,
    "issue_type" "text",
    "issue_description" "text" NOT NULL,
    "legislation_name" "text" NOT NULL,
    "legislation_article" "text",
    "legislation_jurisdiction" "text",
    "suggestion" "text" NOT NULL,
    "suggested_revision" "text",
    "display_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "greenwash_assessment_claims_legislation_jurisdiction_check" CHECK (("legislation_jurisdiction" = ANY (ARRAY['uk'::"text", 'eu'::"text", 'both'::"text"]))),
    CONSTRAINT "greenwash_assessment_claims_risk_level_check" CHECK (("risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "greenwash_assessment_claims_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);


ALTER TABLE "public"."greenwash_assessment_claims" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."greenwash_assessments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "input_type" "text" NOT NULL,
    "input_source" "text",
    "input_content" "text",
    "overall_risk_level" "text",
    "overall_risk_score" integer,
    "summary" "text",
    "recommendations" "jsonb" DEFAULT '[]'::"jsonb",
    "legislation_applied" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    CONSTRAINT "greenwash_assessments_input_type_check" CHECK (("input_type" = ANY (ARRAY['url'::"text", 'document'::"text", 'text'::"text", 'social_media'::"text"]))),
    CONSTRAINT "greenwash_assessments_overall_risk_level_check" CHECK (("overall_risk_level" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text"]))),
    CONSTRAINT "greenwash_assessments_overall_risk_score_check" CHECK ((("overall_risk_score" >= 0) AND ("overall_risk_score" <= 100))),
    CONSTRAINT "greenwash_assessments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."greenwash_assessments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ingredient_selection_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_lca_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "ingredient_name" "text" NOT NULL,
    "data_source" "text" NOT NULL,
    "source_identifier" "text",
    "source_name" "text",
    "alternatives_shown" "jsonb" DEFAULT '[]'::"jsonb",
    "confirmation_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "session_metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "non_empty_ingredient_name" CHECK (("length"(TRIM(BOTH FROM "ingredient_name")) > 0)),
    CONSTRAINT "valid_data_source" CHECK (("data_source" = ANY (ARRAY['openlca'::"text", 'supplier'::"text", 'primary'::"text"])))
);


ALTER TABLE "public"."ingredient_selection_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."ingredient_selection_audit" IS 'Immutable audit trail of ingredient data source selections. Provides glass box provenance for ISO 14044 compliance.';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."organization_id" IS 'Organization that owns this audit record - enables multi-tenant data isolation';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."product_lca_id" IS 'Foreign key to product LCA being built when this selection was made';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."user_id" IS 'User who consciously selected this data source - individual accountability';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."ingredient_name" IS 'Name of ingredient that was selected (denormalized for reporting)';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."data_source" IS 'Type of data source: "openlca" (generic), "supplier" (primary from supplier), or "primary" (self-entered)';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."source_identifier" IS 'External identifier - OpenLCA process UUID or supplier_product UUID';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."source_name" IS 'Human-readable source name - supplier name or "Generic Database"';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."alternatives_shown" IS 'Array of alternative options that were presented but not selected - proves informed choice';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."confirmation_timestamp" IS 'Precise timestamp when user clicked confirmation button - legal audit timestamp';



COMMENT ON COLUMN "public"."ingredient_selection_audit"."session_metadata" IS 'Additional context: user agent, search query, screen size, etc.';



CREATE TABLE IF NOT EXISTS "public"."ingredients" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "lca_sub_stage_id" bigint
);


ALTER TABLE "public"."ingredients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "icon" "text" DEFAULT 'BookOpen'::"text",
    "color" "text" DEFAULT 'blue'::"text",
    "sort_order" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_bank_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_bank_favorites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_item_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_bank_item_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "category_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "content_type" "text" NOT NULL,
    "file_url" "text",
    "file_name" "text",
    "file_size" bigint DEFAULT 0,
    "mime_type" "text",
    "thumbnail_url" "text",
    "status" "text" DEFAULT 'draft'::"text",
    "version" integer DEFAULT 1,
    "author_id" "uuid",
    "view_count" integer DEFAULT 0,
    "download_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    CONSTRAINT "knowledge_bank_items_content_type_check" CHECK (("content_type" = ANY (ARRAY['document'::"text", 'video'::"text", 'link'::"text", 'embedded'::"text"]))),
    CONSTRAINT "knowledge_bank_items_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'published'::"text", 'archived'::"text"])))
);


ALTER TABLE "public"."knowledge_bank_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_bank_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."knowledge_bank_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "item_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."knowledge_bank_views" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."kpi_summary_view" WITH ("security_invoker"='true') AS
 SELECT DISTINCT ON ("k"."id") "k"."id" AS "kpi_id",
    "k"."organization_id",
    "k"."name",
    "k"."description",
    "kdp"."value" AS "current_value",
    "k"."target_value",
    "k"."unit",
    "k"."category",
    "kdp"."recorded_date" AS "last_recorded_date",
    "k"."updated_at" AS "last_updated"
   FROM ("public"."kpis" "k"
     LEFT JOIN "public"."kpi_data_points" "kdp" ON (("k"."id" = "kdp"."kpi_id")))
  ORDER BY "k"."id", "kdp"."recorded_date" DESC NULLS LAST;


ALTER VIEW "public"."kpi_summary_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."kpi_summary_view" IS 'Optimized view showing each KPI with its most recent data point. Uses security_invoker=true to inherit RLS from kpis table. Provides ready-to-display summary for dashboards showing current value, target, and metadata.';



CREATE TABLE IF NOT EXISTS "public"."product_lca_calculation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_lca_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "request_payload" "jsonb",
    "response_data" "jsonb",
    "error_message" "text",
    "calculation_duration_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "environment" "text",
    "impact_metrics" "jsonb",
    "impact_assessment_method" "text",
    "csrd_compliant" boolean DEFAULT false,
    "location_country_code" "text",
    CONSTRAINT "valid_log_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'success'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."product_lca_calculation_logs" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_lca_calculation_logs" IS 'Audit log for all LCA calculation attempts, including request/response data for troubleshooting';



COMMENT ON COLUMN "public"."product_lca_calculation_logs"."environment" IS 'Execution environment where calculation was performed (e.g., local_dev, staging, production)';



COMMENT ON COLUMN "public"."product_lca_calculation_logs"."impact_metrics" IS 'Multi-capital impact results in JSONB format. Includes:
- climate_change_gwp100: Total GHG emissions (kg CO2e)
- water_consumption: Water depletion (L or m³)
- land_use: Land occupation (m²)
- waste_generation: Waste produced (kg)
- ghg_breakdown: Detailed GHG inventory per ISO 14067
- carbon_origin: Fossil/Biogenic/LUC split
- gas_inventory: CH4, N2O, F-gases by mass
- gwp_factors: Characterization factors used
- material_breakdown: Per-material contributions';



COMMENT ON COLUMN "public"."product_lca_calculation_logs"."impact_assessment_method" IS 'LCIA method used (e.g., "ReCiPe 2016 Midpoint (H)", "IPCC GWP100"). Required for regulatory compliance.';



COMMENT ON COLUMN "public"."product_lca_calculation_logs"."csrd_compliant" IS 'True if all materials used OpenLCA/Ecoinvent data (no fallback proxies). Required for CSRD audit.';



COMMENT ON COLUMN "public"."product_lca_calculation_logs"."location_country_code" IS 'ISO 3166-1 alpha-2 country code for AWARE water scarcity calculation (e.g., "ES", "GB"). Required for CSRD E3.';



CREATE OR REPLACE VIEW "public"."lca_ghg_breakdown_report" AS
 SELECT "plcl"."id" AS "calculation_log_id",
    "plcl"."product_lca_id",
    "pl"."product_name",
    "pl"."organization_id",
    "plcl"."created_at",
    (("plcl"."impact_metrics" ->> 'climate_change_gwp100'::"text"))::numeric AS "total_co2e",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'carbon_origin'::"text") ->> 'fossil'::"text"))::numeric AS "fossil_co2e",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'carbon_origin'::"text") ->> 'biogenic'::"text"))::numeric AS "biogenic_co2e",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'carbon_origin'::"text") ->> 'land_use_change'::"text"))::numeric AS "dluc_co2e",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gas_inventory'::"text") ->> 'co2_fossil'::"text"))::numeric AS "co2_fossil_kg",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gas_inventory'::"text") ->> 'co2_biogenic'::"text"))::numeric AS "co2_biogenic_kg",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gas_inventory'::"text") ->> 'methane'::"text"))::numeric AS "ch4_kg",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gas_inventory'::"text") ->> 'nitrous_oxide'::"text"))::numeric AS "n2o_kg",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gas_inventory'::"text") ->> 'hfc_pfc'::"text"))::numeric AS "fgas_co2e",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gwp_factors'::"text") ->> 'methane_gwp100'::"text"))::numeric AS "ch4_gwp",
    (((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gwp_factors'::"text") ->> 'n2o_gwp100'::"text"))::numeric AS "n2o_gwp",
    ((("plcl"."impact_metrics" -> 'ghg_breakdown'::"text") -> 'gwp_factors'::"text") ->> 'method'::"text") AS "gwp_method",
    "public"."validate_ghg_breakdown"("plcl"."impact_metrics") AS "validation",
    "plcl"."impact_assessment_method",
    "plcl"."csrd_compliant"
   FROM ("public"."product_lca_calculation_logs" "plcl"
     JOIN "public"."product_carbon_footprints" "pl" ON (("pl"."id" = "plcl"."product_lca_id")))
  WHERE (("plcl"."status" = 'success'::"text") AND ("plcl"."impact_metrics" IS NOT NULL))
  ORDER BY "plcl"."created_at" DESC;


ALTER VIEW "public"."lca_ghg_breakdown_report" OWNER TO "postgres";


COMMENT ON VIEW "public"."lca_ghg_breakdown_report" IS 'ISO 14067 compliant GHG breakdown report. RLS inherited from product_lca_calculation_logs. 
Users can only view GHG breakdowns for LCAs in their organization.';



CREATE TABLE IF NOT EXISTS "public"."lca_life_cycle_stages" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "display_order" integer NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."lca_life_cycle_stages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lca_life_cycle_stages"."display_order" IS 'Controls the display order in the UI. Lower numbers appear first.';



COMMENT ON COLUMN "public"."lca_life_cycle_stages"."description" IS 'Detailed explanation of the life cycle stage.';



CREATE SEQUENCE IF NOT EXISTS "public"."lca_life_cycle_stages_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."lca_life_cycle_stages_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."lca_life_cycle_stages_id_seq" OWNED BY "public"."lca_life_cycle_stages"."id";



CREATE TABLE IF NOT EXISTS "public"."lca_methodology_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "product_lca_id" "uuid",
    "methodology_requested" "text" NOT NULL,
    "access_granted" boolean NOT NULL,
    "denial_reason" "text",
    "request_context" "jsonb" DEFAULT '{}'::"jsonb",
    "ip_address" "text",
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."lca_methodology_audit_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."lca_methodology_audit_log" IS 'Audit log tracking all methodology access requests for compliance and billing.';



CREATE TABLE IF NOT EXISTS "public"."lca_production_mix" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lca_id" "uuid" NOT NULL,
    "facility_id" "uuid" NOT NULL,
    "production_share" numeric(5,4) NOT NULL,
    "facility_intensity" numeric,
    "facility_total_emissions" numeric,
    "facility_total_production" numeric,
    "data_source_type" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lca_production_mix_data_source_type_check" CHECK (("data_source_type" = ANY (ARRAY['Primary'::"text", 'Secondary_Average'::"text"]))),
    CONSTRAINT "lca_production_mix_production_share_check" CHECK ((("production_share" >= (0)::numeric) AND ("production_share" <= (1)::numeric)))
);


ALTER TABLE "public"."lca_production_mix" OWNER TO "postgres";


COMMENT ON TABLE "public"."lca_production_mix" IS 'ISO 14044 Physical Allocation: Production share percentages for multi-facility product LCAs. Shares must sum to exactly 1.0 (100%).';



COMMENT ON COLUMN "public"."lca_production_mix"."production_share" IS 'Decimal representation of production share (0.0 to 1.0). Example: 60% = 0.6000. All shares for an LCA must sum to 1.0.';



COMMENT ON COLUMN "public"."lca_production_mix"."facility_intensity" IS 'Emission intensity from facility_emissions_aggregated.calculated_intensity for the reference year (kg CO2e per unit).';



COMMENT ON COLUMN "public"."lca_production_mix"."data_source_type" IS 'Primary = Verified utility bills, Secondary_Average = Industry average proxy. Inherited from facility_emissions_aggregated.';



CREATE OR REPLACE VIEW "public"."lca_production_mix_summary" AS
 SELECT "pm"."lca_id",
    "pl"."product_name",
    "pl"."reference_year",
    "pl"."organization_id",
    "count"("pm"."id") AS "num_facilities",
    "sum"("pm"."production_share") AS "total_share_allocated",
    "public"."is_production_mix_complete"("pm"."lca_id") AS "is_complete",
    "sum"(("pm"."facility_intensity" * "pm"."production_share")) AS "weighted_avg_intensity",
    "array_agg"("json_build_object"('facility_id', "f"."id", 'facility_name', "f"."name", 'production_share', "pm"."production_share", 'production_share_percent', ("pm"."production_share" * (100)::numeric), 'facility_intensity', "pm"."facility_intensity", 'data_source_type', "pm"."data_source_type")) AS "facility_breakdown"
   FROM (("public"."lca_production_mix" "pm"
     JOIN "public"."product_carbon_footprints" "pl" ON (("pl"."id" = "pm"."lca_id")))
     JOIN "public"."facilities" "f" ON (("f"."id" = "pm"."facility_id")))
  GROUP BY "pm"."lca_id", "pl"."product_name", "pl"."reference_year", "pl"."organization_id";


ALTER VIEW "public"."lca_production_mix_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."lca_production_mix_summary" IS 'Summary view showing production mix allocation status, weighted average intensity, and per-facility breakdown for each LCA.';



CREATE TABLE IF NOT EXISTS "public"."lca_recalculation_queue" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid",
    "product_lca_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "priority" integer DEFAULT 5 NOT NULL,
    "attempt_count" integer DEFAULT 0 NOT NULL,
    "max_attempts" integer DEFAULT 3 NOT NULL,
    "last_error" "text",
    "error_details" "jsonb",
    "processing_started_at" timestamp with time zone,
    "processing_completed_at" timestamp with time zone,
    "next_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_priority" CHECK ((("priority" >= 1) AND ("priority" <= 10))),
    CONSTRAINT "valid_queue_status" CHECK (("status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."lca_recalculation_queue" OWNER TO "postgres";


COMMENT ON TABLE "public"."lca_recalculation_queue" IS 'Queue for pending EF 3.1 recalculation jobs with retry logic and batch grouping.';



CREATE TABLE IF NOT EXISTS "public"."lca_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint,
    "title" "text" NOT NULL,
    "version" "text" DEFAULT '1.0'::"text" NOT NULL,
    "status" "public"."lca_report_status" DEFAULT 'draft'::"public"."lca_report_status" NOT NULL,
    "dqi_score" double precision,
    "system_boundary" "text" DEFAULT 'Cradle-to-Gate'::"text",
    "functional_unit" "text" DEFAULT '1 unit'::"text",
    "assessment_period_start" "date",
    "assessment_period_end" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "published_at" timestamp with time zone,
    CONSTRAINT "valid_dqi_score" CHECK ((("dqi_score" IS NULL) OR (("dqi_score" >= (0)::double precision) AND ("dqi_score" <= (100)::double precision))))
);


ALTER TABLE "public"."lca_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lca_social_indicators" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "indicator_name" "text" NOT NULL,
    "category" "text",
    "score" double precision,
    "risk_level" "public"."social_risk_level",
    "evidence" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_score" CHECK ((("score" IS NULL) OR ("score" >= (0)::double precision)))
);


ALTER TABLE "public"."lca_social_indicators" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lca_stages" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."lca_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lca_sub_stages" (
    "id" bigint NOT NULL,
    "lca_stage_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "display_order" integer NOT NULL
);


ALTER TABLE "public"."lca_sub_stages" OWNER TO "postgres";


COMMENT ON COLUMN "public"."lca_sub_stages"."description" IS 'Detailed explanation of the sub-stage.';



COMMENT ON COLUMN "public"."lca_sub_stages"."display_order" IS 'Controls the display order within the parent stage. Lower numbers appear first.';



ALTER TABLE "public"."lca_sub_stages" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."lca_sub_stages_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."lca_workflow_audit" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_lca_id" "uuid" NOT NULL,
    "workflow_step" "text" NOT NULL,
    "action" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lca_workflow_audit" OWNER TO "postgres";


COMMENT ON TABLE "public"."lca_workflow_audit" IS 'Audit trail for LCA workflow actions, ensuring ISO 14044 compliance documentation';



CREATE OR REPLACE VIEW "public"."member_profiles" WITH ("security_invoker"='true') AS
 SELECT "om"."id" AS "membership_id",
    "om"."organization_id",
    "om"."user_id",
    "om"."role_id",
    "r"."name" AS "role",
    "p"."email",
    "p"."full_name",
    "p"."avatar_url",
    "p"."phone",
    "p"."created_at" AS "profile_created_at",
    "p"."updated_at" AS "profile_updated_at",
    "om"."joined_at",
    "om"."invited_by"
   FROM (("public"."organization_members" "om"
     JOIN "public"."profiles" "p" ON (("om"."user_id" = "p"."id")))
     LEFT JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")));


ALTER VIEW "public"."member_profiles" OWNER TO "postgres";


COMMENT ON VIEW "public"."member_profiles" IS 'Secure view combining organization_members with profiles. Uses security_invoker=true to inherit RLS from base tables. Users automatically see only members from their organization via get_current_organization_id() check on organization_members table.';



CREATE TABLE IF NOT EXISTS "public"."openlca_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "server_url" "text" DEFAULT 'http://localhost:8080'::"text" NOT NULL,
    "database_name" "text" DEFAULT 'ecoinvent_312_cutoff'::"text" NOT NULL,
    "enabled" boolean DEFAULT false NOT NULL,
    "preferred_system_model" "text" DEFAULT 'cutoff'::"text",
    "default_allocation_method" "text" DEFAULT 'economic'::"text",
    "prefer_unit_processes" boolean DEFAULT true,
    "with_regionalization" boolean DEFAULT true,
    "impact_methods" "jsonb" DEFAULT '[]'::"jsonb",
    "calculation_defaults" "jsonb" DEFAULT '{}'::"jsonb",
    "last_health_check" timestamp with time zone,
    "server_version" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_allocation" CHECK (("default_allocation_method" = ANY (ARRAY['economic'::"text", 'physical'::"text", 'causal'::"text", 'none'::"text"]))),
    CONSTRAINT "valid_system_model" CHECK (("preferred_system_model" = ANY (ARRAY['cutoff'::"text", 'apos'::"text", 'consequential'::"text"])))
);


ALTER TABLE "public"."openlca_configurations" OWNER TO "postgres";


COMMENT ON TABLE "public"."openlca_configurations" IS 'OpenLCA server configuration and calculation preferences per organization';



COMMENT ON COLUMN "public"."openlca_configurations"."impact_methods" IS 'Array of configured impact methods. Example: 
[
{
"name": "IPCC 2021",
"id": "uuid-of-ipcc-method",
"enabled": true,
"categories": ["Climate change - GWP100", "Climate change - GWP100 (fossil)", "Climate change - GWP100 (biogenic)"]
},
{
"name": "AWARE 1.2",
"id": "uuid-of-aware-method",
"enabled": true,
"categories": ["Water scarcity"]
},
{
"name": "EF 3.1",
"id": "uuid-of-ef31-method",
"enabled": true,
"categories": ["Land use"]
}
]';



COMMENT ON COLUMN "public"."openlca_configurations"."calculation_defaults" IS 'Default calculation settings. Example:
{
"cutoff": 0.001,
"monte_carlo_runs": 1000,
"provider_linking": "PREFER_DEFAULTS",
"timeout_seconds": 300
}';



CREATE TABLE IF NOT EXISTS "public"."openlca_process_cache" (
    "id" bigint NOT NULL,
    "search_term" "text" NOT NULL,
    "results" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."openlca_process_cache" OWNER TO "postgres";


ALTER TABLE "public"."openlca_process_cache" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."openlca_process_cache_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."organization_certifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "framework_id" "uuid" NOT NULL,
    "status" character varying(50) DEFAULT 'not_started'::character varying,
    "target_date" "date",
    "certification_number" character varying(255),
    "certified_date" "date",
    "expiry_date" "date",
    "score_achieved" numeric(5,2),
    "readiness_score" numeric(5,2),
    "data_completeness" numeric(5,2),
    "last_assessment_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_certifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_tier_features" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier_name" "text" NOT NULL,
    "feature_code" "text" NOT NULL,
    "feature_name" "text" NOT NULL,
    "feature_description" "text",
    "enabled" boolean DEFAULT false NOT NULL,
    "usage_limit" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_tier" CHECK (("tier_name" = ANY (ARRAY['seed'::"text", 'blossom'::"text", 'canopy'::"text"])))
);


ALTER TABLE "public"."subscription_tier_features" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_tier_features" IS 'Defines which features are available for each subscription tier.';



CREATE OR REPLACE VIEW "public"."organization_subscription_summary" AS
 SELECT "id" AS "organization_id",
    "name" AS "organization_name",
    "subscription_tier",
    "subscription_status",
    "subscription_started_at",
    "subscription_expires_at",
    "methodology_access",
    ( SELECT "count"(*) AS "count"
           FROM "public"."product_carbon_footprints" "pl"
          WHERE ("pl"."organization_id" = "o"."id")) AS "total_lcas",
    ( SELECT "count"(*) AS "count"
           FROM "public"."product_carbon_footprints" "pl"
          WHERE (("pl"."organization_id" = "o"."id") AND ("pl"."lca_methodology" = 'ef_31'::"text"))) AS "ef31_lcas",
    ( SELECT "jsonb_agg"("jsonb_build_object"('code', "f"."feature_code", 'enabled', "f"."enabled")) AS "jsonb_agg"
           FROM "public"."subscription_tier_features" "f"
          WHERE ("f"."tier_name" = "o"."subscription_tier")) AS "tier_features"
   FROM "public"."organizations" "o";


ALTER VIEW "public"."organization_subscription_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."organization_subscription_summary" IS 'Summary view of organization subscription status and methodology usage.';



CREATE TABLE IF NOT EXISTS "public"."organization_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "platform_supplier_id" "uuid" NOT NULL,
    "annual_spend" numeric,
    "spend_currency" "text" DEFAULT 'GBP'::"text",
    "relationship_type" "text",
    "engagement_status" "text" DEFAULT 'active'::"text",
    "notes" "text",
    "added_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "added_by" "uuid",
    CONSTRAINT "positive_spend" CHECK ((("annual_spend" >= (0)::numeric) OR ("annual_spend" IS NULL)))
);


ALTER TABLE "public"."organization_suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_suppliers" IS 'Junction table tracking which suppliers each organization uses. Private per organization.';



COMMENT ON COLUMN "public"."organization_suppliers"."relationship_type" IS 'Type of relationship: direct, indirect, contracted, etc.';



COMMENT ON COLUMN "public"."organization_suppliers"."engagement_status" IS 'Engagement status: active, invited, inactive, etc.';



CREATE TABLE IF NOT EXISTS "public"."platform_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "website" "text",
    "contact_email" "text",
    "contact_name" "text",
    "industry_sector" "text",
    "country" "text",
    "description" "text",
    "logo_url" "text",
    "is_verified" boolean DEFAULT false,
    "verification_date" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    CONSTRAINT "valid_email" CHECK ((("contact_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text") OR ("contact_email" IS NULL)))
);


ALTER TABLE "public"."platform_suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_suppliers" IS 'Master supplier directory managed by Alkatera admins. Visible to all organizations.';



COMMENT ON COLUMN "public"."platform_suppliers"."is_verified" IS 'Whether the supplier has been verified by Alkatera admins.';



COMMENT ON COLUMN "public"."platform_suppliers"."created_by" IS 'Platform admin who added this supplier.';



CREATE OR REPLACE VIEW "public"."organization_suppliers_view" AS
 SELECT "os"."id",
    "os"."organization_id",
    "os"."platform_supplier_id",
    "ps"."name" AS "supplier_name",
    "ps"."website",
    "ps"."contact_email",
    "ps"."contact_name",
    "ps"."industry_sector",
    "ps"."country",
    "ps"."description",
    "ps"."logo_url",
    "ps"."is_verified",
    "os"."annual_spend",
    "os"."spend_currency",
    "os"."relationship_type",
    "os"."engagement_status",
    "os"."notes",
    "os"."added_at",
    "os"."updated_at"
   FROM ("public"."organization_suppliers" "os"
     JOIN "public"."platform_suppliers" "ps" ON (("ps"."id" = "os"."platform_supplier_id")));


ALTER VIEW "public"."organization_suppliers_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."organization_suppliers_view" IS 'Combines organization supplier relationships with platform supplier details.';



CREATE TABLE IF NOT EXISTS "public"."organization_usage_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "event_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "limit_checked" integer,
    "current_usage" integer,
    "was_allowed" boolean DEFAULT true NOT NULL,
    "denial_reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."organization_usage_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."organization_usage_log" IS 'Audit log for all usage-related events and limit checks';



CREATE TABLE IF NOT EXISTS "public"."organization_vitality_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "calculation_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "year" integer NOT NULL,
    "overall_score" integer NOT NULL,
    "climate_score" integer NOT NULL,
    "water_score" integer NOT NULL,
    "circularity_score" integer NOT NULL,
    "nature_score" integer NOT NULL,
    "total_emissions_kg" numeric,
    "emissions_intensity" numeric,
    "water_consumption_m3" numeric,
    "water_risk_level" "text",
    "waste_diversion_rate" numeric,
    "land_use_m2a" numeric,
    "biodiversity_risk" "text",
    "products_assessed" integer DEFAULT 0,
    "data_quality_score" numeric,
    "calculation_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "organization_vitality_scores_circularity_score_check" CHECK ((("circularity_score" >= 0) AND ("circularity_score" <= 100))),
    CONSTRAINT "organization_vitality_scores_climate_score_check" CHECK ((("climate_score" >= 0) AND ("climate_score" <= 100))),
    CONSTRAINT "organization_vitality_scores_nature_score_check" CHECK ((("nature_score" >= 0) AND ("nature_score" <= 100))),
    CONSTRAINT "organization_vitality_scores_overall_score_check" CHECK ((("overall_score" >= 0) AND ("overall_score" <= 100))),
    CONSTRAINT "organization_vitality_scores_water_score_check" CHECK ((("water_score" >= 0) AND ("water_score" <= 100)))
);


ALTER TABLE "public"."organization_vitality_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packaging_circularity_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "material_type" "text" NOT NULL,
    "material_name" "text" NOT NULL,
    "recyclability_score" numeric DEFAULT 0 NOT NULL,
    "recycled_content_percentage" numeric DEFAULT 0 NOT NULL,
    "reusability_score" numeric DEFAULT 0,
    "is_compostable" boolean DEFAULT false,
    "is_biodegradable" boolean DEFAULT false,
    "regional_recycling_rate" numeric,
    "collection_rate" numeric,
    "end_of_life_pathway" "text" DEFAULT 'mixed'::"text",
    "virgin_material_density" numeric,
    "recycled_material_density" numeric,
    "notes" "text",
    "source_reference" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "packaging_circularity_profile_recycled_content_percentage_check" CHECK ((("recycled_content_percentage" >= (0)::numeric) AND ("recycled_content_percentage" <= (100)::numeric))),
    CONSTRAINT "packaging_circularity_profiles_collection_rate_check" CHECK ((("collection_rate" IS NULL) OR (("collection_rate" >= (0)::numeric) AND ("collection_rate" <= (100)::numeric)))),
    CONSTRAINT "packaging_circularity_profiles_end_of_life_pathway_check" CHECK (("end_of_life_pathway" = ANY (ARRAY['recycling'::"text", 'landfill'::"text", 'incineration'::"text", 'composting'::"text", 'anaerobic_digestion'::"text", 'reuse'::"text", 'mixed'::"text"]))),
    CONSTRAINT "packaging_circularity_profiles_material_type_check" CHECK (("material_type" = ANY (ARRAY['glass'::"text", 'plastic_pet'::"text", 'plastic_hdpe'::"text", 'plastic_ldpe'::"text", 'plastic_pp'::"text", 'plastic_ps'::"text", 'plastic_other'::"text", 'paper'::"text", 'cardboard'::"text", 'aluminium'::"text", 'steel'::"text", 'wood'::"text", 'composite'::"text", 'bioplastic'::"text", 'other'::"text"]))),
    CONSTRAINT "packaging_circularity_profiles_recyclability_score_check" CHECK ((("recyclability_score" >= (0)::numeric) AND ("recyclability_score" <= (100)::numeric))),
    CONSTRAINT "packaging_circularity_profiles_recycled_material_density_check" CHECK ((("recycled_material_density" IS NULL) OR ("recycled_material_density" > (0)::numeric))),
    CONSTRAINT "packaging_circularity_profiles_regional_recycling_rate_check" CHECK ((("regional_recycling_rate" IS NULL) OR (("regional_recycling_rate" >= (0)::numeric) AND ("regional_recycling_rate" <= (100)::numeric)))),
    CONSTRAINT "packaging_circularity_profiles_reusability_score_check" CHECK ((("reusability_score" IS NULL) OR (("reusability_score" >= (0)::numeric) AND ("reusability_score" <= (100)::numeric)))),
    CONSTRAINT "packaging_circularity_profiles_virgin_material_density_check" CHECK ((("virgin_material_density" IS NULL) OR ("virgin_material_density" > (0)::numeric)))
);


ALTER TABLE "public"."packaging_circularity_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."packaging_types" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "material" "text",
    "weight_g" numeric,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."packaging_types" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."passport_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" bigint NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_agent" "text",
    "referer" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."passport_views" OWNER TO "postgres";


COMMENT ON TABLE "public"."passport_views" IS 'Analytics tracking for product passport views. Minimal data collection for privacy.';



CREATE TABLE IF NOT EXISTS "public"."pending_activity_data" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "quantity" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "activity_date" "date" NOT NULL,
    "facility_id" "uuid",
    "notes" "text",
    "approval_status" "public"."approval_status_enum" DEFAULT 'pending'::"public"."approval_status_enum" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "original_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pending_activity_data" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_activity_data" IS 'Staging table for activity data awaiting admin approval';



CREATE TABLE IF NOT EXISTS "public"."pending_facilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "location" "text",
    "facility_type" "text",
    "facility_type_id" "uuid",
    "address" "text",
    "city" "text",
    "country" "text",
    "latitude" numeric,
    "longitude" numeric,
    "is_contract_manufacturer" boolean DEFAULT false,
    "notes" "text",
    "approval_status" "public"."approval_status_enum" DEFAULT 'pending'::"public"."approval_status_enum" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "original_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pending_facilities" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_facilities" IS 'Staging table for facilities awaiting admin approval';



CREATE TABLE IF NOT EXISTS "public"."pending_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "product_description" "text",
    "product_image_url" "text",
    "sku" "text",
    "functional_unit_type" "public"."functional_unit_type_enum",
    "functional_unit_volume" numeric,
    "functional_unit_measure" "public"."functional_unit_measure_enum",
    "system_boundary" "public"."system_boundary_enum" DEFAULT 'cradle_to_gate'::"public"."system_boundary_enum",
    "product_category" "text",
    "is_draft" boolean DEFAULT false,
    "notes" "text",
    "approval_status" "public"."approval_status_enum" DEFAULT 'pending'::"public"."approval_status_enum" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "original_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pending_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_products" IS 'Staging table for products awaiting admin approval';



CREATE TABLE IF NOT EXISTS "public"."pending_suppliers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "contact_email" "text",
    "contact_name" "text",
    "phone" "text",
    "website" "text",
    "address" "text",
    "city" "text",
    "country" "text",
    "category" "text",
    "notes" "text",
    "approval_status" "public"."approval_status_enum" DEFAULT 'pending'::"public"."approval_status_enum" NOT NULL,
    "submitted_by" "uuid" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "rejection_reason" "text",
    "original_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."pending_suppliers" OWNER TO "postgres";


COMMENT ON TABLE "public"."pending_suppliers" IS 'Staging table for suppliers awaiting admin approval';



CREATE OR REPLACE VIEW "public"."pending_approvals_summary" AS
 SELECT "pending_activity_data"."organization_id",
    'activity_data'::"text" AS "data_type",
    "count"(*) FILTER (WHERE ("pending_activity_data"."approval_status" = 'pending'::"public"."approval_status_enum")) AS "pending_count",
    "count"(*) FILTER (WHERE ("pending_activity_data"."approval_status" = 'approved'::"public"."approval_status_enum")) AS "approved_count",
    "count"(*) FILTER (WHERE ("pending_activity_data"."approval_status" = 'rejected'::"public"."approval_status_enum")) AS "rejected_count"
   FROM "public"."pending_activity_data"
  GROUP BY "pending_activity_data"."organization_id"
UNION ALL
 SELECT "pending_facilities"."organization_id",
    'facilities'::"text" AS "data_type",
    "count"(*) FILTER (WHERE ("pending_facilities"."approval_status" = 'pending'::"public"."approval_status_enum")) AS "pending_count",
    "count"(*) FILTER (WHERE ("pending_facilities"."approval_status" = 'approved'::"public"."approval_status_enum")) AS "approved_count",
    "count"(*) FILTER (WHERE ("pending_facilities"."approval_status" = 'rejected'::"public"."approval_status_enum")) AS "rejected_count"
   FROM "public"."pending_facilities"
  GROUP BY "pending_facilities"."organization_id"
UNION ALL
 SELECT "pending_products"."organization_id",
    'products'::"text" AS "data_type",
    "count"(*) FILTER (WHERE ("pending_products"."approval_status" = 'pending'::"public"."approval_status_enum")) AS "pending_count",
    "count"(*) FILTER (WHERE ("pending_products"."approval_status" = 'approved'::"public"."approval_status_enum")) AS "approved_count",
    "count"(*) FILTER (WHERE ("pending_products"."approval_status" = 'rejected'::"public"."approval_status_enum")) AS "rejected_count"
   FROM "public"."pending_products"
  GROUP BY "pending_products"."organization_id"
UNION ALL
 SELECT "pending_suppliers"."organization_id",
    'suppliers'::"text" AS "data_type",
    "count"(*) FILTER (WHERE ("pending_suppliers"."approval_status" = 'pending'::"public"."approval_status_enum")) AS "pending_count",
    "count"(*) FILTER (WHERE ("pending_suppliers"."approval_status" = 'approved'::"public"."approval_status_enum")) AS "approved_count",
    "count"(*) FILTER (WHERE ("pending_suppliers"."approval_status" = 'rejected'::"public"."approval_status_enum")) AS "rejected_count"
   FROM "public"."pending_suppliers"
  GROUP BY "pending_suppliers"."organization_id";


ALTER VIEW "public"."pending_approvals_summary" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "benefit_name" character varying(255) NOT NULL,
    "benefit_category" character varying(100),
    "benefit_description" "text",
    "eligibility_criteria" "text",
    "eligible_employee_count" integer,
    "enrolled_employee_count" integer,
    "uptake_rate" numeric(5,2),
    "cost_to_organization" numeric(12,2),
    "cost_to_employee" numeric(12,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "is_active" boolean DEFAULT true,
    "provider_name" character varying(255),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "benefit_type" character varying(100),
    "description" "text",
    "uptake_count" integer DEFAULT 0,
    "employer_contribution" numeric(12,2),
    "employee_contribution" numeric(12,2),
    "effective_from" "date",
    "effective_to" "date"
);


ALTER TABLE "public"."people_benefits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_culture_scores" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "calculation_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "overall_score" integer NOT NULL,
    "fair_work_score" integer,
    "diversity_score" integer,
    "wellbeing_score" integer,
    "training_score" integer,
    "living_wage_compliance" numeric(5,2),
    "gender_pay_gap_mean" numeric(5,2),
    "gender_pay_gap_median" numeric(5,2),
    "ceo_worker_pay_ratio" numeric(10,2),
    "training_hours_per_employee" numeric(6,2),
    "employee_engagement_score" numeric(3,1),
    "data_completeness" numeric(5,2),
    "calculation_metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "people_culture_scores_diversity_score_check" CHECK ((("diversity_score" >= 0) AND ("diversity_score" <= 100))),
    CONSTRAINT "people_culture_scores_fair_work_score_check" CHECK ((("fair_work_score" >= 0) AND ("fair_work_score" <= 100))),
    CONSTRAINT "people_culture_scores_overall_score_check" CHECK ((("overall_score" >= 0) AND ("overall_score" <= 100))),
    CONSTRAINT "people_culture_scores_training_score_check" CHECK ((("training_score" >= 0) AND ("training_score" <= 100))),
    CONSTRAINT "people_culture_scores_wellbeing_score_check" CHECK ((("wellbeing_score" >= 0) AND ("wellbeing_score" <= 100)))
);


ALTER TABLE "public"."people_culture_scores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_dei_actions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "action_title" character varying(500) NOT NULL,
    "action_description" "text",
    "action_type" character varying(100),
    "focus_dimension" character varying(100),
    "target_metric" character varying(255),
    "baseline_value" numeric(10,2),
    "target_value" numeric(10,2),
    "current_value" numeric(10,2),
    "metric_unit" character varying(50),
    "start_date" "date",
    "target_completion_date" "date",
    "actual_completion_date" "date",
    "status" character varying(50) DEFAULT 'planned'::character varying,
    "budget_allocated" numeric(12,2),
    "budget_spent" numeric(12,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "responsible_person" character varying(255),
    "responsible_department" character varying(255),
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "is_public" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "action_name" character varying(255),
    "action_category" character varying(100),
    "description" "text",
    "target_group" character varying(100),
    "priority" character varying(20) DEFAULT 'medium'::character varying,
    "target_date" "date",
    "completion_date" "date",
    "owner_name" character varying(255),
    "owner_department" character varying(255),
    "success_metrics" "text",
    "outcomes_achieved" "text",
    "evidence_links" "jsonb" DEFAULT '[]'::"jsonb",
    "bcorp_requirement_id" character varying(50)
);


ALTER TABLE "public"."people_dei_actions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_employee_compensation" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "employee_reference" character varying(255),
    "role_title" character varying(255),
    "role_level" character varying(100),
    "department" character varying(255),
    "employment_type" character varying(50) DEFAULT 'full_time'::character varying NOT NULL,
    "contract_type" character varying(50),
    "work_location" character varying(255),
    "work_country" character varying(100) DEFAULT 'United Kingdom'::character varying,
    "work_region" character varying(100),
    "is_remote" boolean DEFAULT false,
    "annual_salary" numeric(12,2),
    "hourly_rate" numeric(8,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "hours_per_week" numeric(4,1) DEFAULT 40,
    "bonus_amount" numeric(12,2) DEFAULT 0,
    "bonus_received" boolean DEFAULT false,
    "gender" character varying(50),
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "effective_date" "date" DEFAULT CURRENT_DATE,
    "data_source" character varying(100),
    "is_active" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."people_employee_compensation" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_employee_surveys" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "survey_title" character varying(500) NOT NULL,
    "survey_type" character varying(100),
    "survey_description" "text",
    "survey_date" "date",
    "survey_provider" character varying(255),
    "invited_count" integer,
    "responded_count" integer,
    "response_rate" numeric(5,2),
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "reporting_quarter" integer,
    "is_anonymous" boolean DEFAULT true,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "survey_name" character varying(255),
    "description" "text",
    "status" character varying(50) DEFAULT 'draft'::character varying,
    "launch_date" "date",
    "close_date" "date",
    "total_invited" integer DEFAULT 0,
    "total_responses" integer DEFAULT 0,
    "survey_questions" "jsonb" DEFAULT '[]'::"jsonb"
);


ALTER TABLE "public"."people_employee_surveys" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_living_wage_benchmarks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "country" character varying(100) NOT NULL,
    "region" character varying(100),
    "city" character varying(100),
    "hourly_rate" numeric(8,2) NOT NULL,
    "annual_rate" numeric(12,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "source" character varying(255) NOT NULL,
    "methodology" character varying(100),
    "effective_from" "date" NOT NULL,
    "effective_to" "date",
    "is_current" boolean DEFAULT true,
    "notes" "text",
    "source_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."people_living_wage_benchmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_survey_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "survey_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "question_category" character varying(100),
    "question_text" "text",
    "avg_score" numeric(4,2),
    "response_count" integer,
    "score_1_count" integer DEFAULT 0,
    "score_2_count" integer DEFAULT 0,
    "score_3_count" integer DEFAULT 0,
    "score_4_count" integer DEFAULT 0,
    "score_5_count" integer DEFAULT 0,
    "positive_sentiment_percentage" numeric(5,2),
    "neutral_sentiment_percentage" numeric(5,2),
    "negative_sentiment_percentage" numeric(5,2),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."people_survey_responses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_training_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "training_name" character varying(500) NOT NULL,
    "training_type" character varying(100),
    "training_provider" character varying(255),
    "delivery_method" character varying(100),
    "is_mandatory" boolean DEFAULT false,
    "total_hours" numeric(6,2),
    "participants_count" integer,
    "completion_rate" numeric(5,2),
    "cost_per_participant" numeric(10,2),
    "total_cost" numeric(12,2),
    "currency" character varying(3) DEFAULT 'GBP'::character varying,
    "training_date" "date",
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "satisfaction_score" numeric(3,2),
    "knowledge_improvement_score" numeric(5,2),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "description" "text",
    "provider_type" character varying(50),
    "provider_name" character varying(255),
    "hours_per_participant" numeric(6,2) DEFAULT 0,
    "participants" integer DEFAULT 0,
    "eligible_employees" integer,
    "start_date" "date",
    "completion_date" "date",
    "certification_awarded" boolean DEFAULT false,
    "certification_name" character varying(255)
);


ALTER TABLE "public"."people_training_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."people_workforce_demographics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "created_by" "uuid",
    "dimension" character varying(100),
    "category_value" character varying(100),
    "employee_count" integer DEFAULT 0,
    "percentage" numeric(5,2),
    "leadership_count" integer DEFAULT 0,
    "entry_level_count" integer DEFAULT 0,
    "mid_level_count" integer DEFAULT 0,
    "senior_level_count" integer DEFAULT 0,
    "exec_level_count" integer DEFAULT 0,
    "reporting_year" integer DEFAULT EXTRACT(year FROM CURRENT_DATE) NOT NULL,
    "reporting_quarter" integer,
    "snapshot_date" "date" DEFAULT CURRENT_DATE,
    "data_source" character varying(100),
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "reporting_period" "date",
    "total_fte" numeric(10,2),
    "gender_data" "jsonb" DEFAULT '{}'::"jsonb",
    "ethnicity_data" "jsonb" DEFAULT '{}'::"jsonb",
    "age_data" "jsonb" DEFAULT '{}'::"jsonb",
    "disability_data" "jsonb" DEFAULT '{}'::"jsonb",
    "management_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "employment_type_breakdown" "jsonb" DEFAULT '{}'::"jsonb",
    "new_hires" integer DEFAULT 0,
    "departures" integer DEFAULT 0,
    "voluntary_departures" integer DEFAULT 0,
    "response_rate" numeric(5,2),
    "data_collection_method" character varying(100),
    "total_employees" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."people_workforce_demographics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "resource" "text" NOT NULL,
    "action" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "activity_type" "text" NOT NULL,
    "activity_category" "text" NOT NULL,
    "organization_id" "uuid",
    "activity_timestamp" timestamp with time zone DEFAULT "now"() NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."platform_activity_log" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_activity_log" IS 'Anonymized activity log for platform analytics';



CREATE TABLE IF NOT EXISTS "public"."supplier_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "supplier_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "unit" "text" NOT NULL,
    "carbon_intensity" numeric(10,4),
    "product_code" "text",
    "is_active" boolean DEFAULT true,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "origin_address" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "origin_country_code" "text",
    "is_verified" boolean DEFAULT false NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "verification_notes" "text",
    "product_image_url" "text",
    "unit_measurement" numeric(12,4),
    "unit_measurement_type" "text",
    CONSTRAINT "non_empty_name" CHECK (("length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "non_empty_unit" CHECK (("length"(TRIM(BOTH FROM "unit")) > 0)),
    CONSTRAINT "positive_carbon_intensity" CHECK ((("carbon_intensity" IS NULL) OR ("carbon_intensity" >= (0)::numeric))),
    CONSTRAINT "supplier_products_unit_measurement_type_check" CHECK ((("unit_measurement_type" IS NULL) OR ("unit_measurement_type" = ANY (ARRAY['weight'::"text", 'volume'::"text", 'length'::"text", 'area'::"text", 'count'::"text"])))),
    CONSTRAINT "valid_supplier_origin_lat" CHECK ((("origin_lat" IS NULL) OR (("origin_lat" >= ('-90'::integer)::double precision) AND ("origin_lat" <= (90)::double precision)))),
    CONSTRAINT "valid_supplier_origin_lng" CHECK ((("origin_lng" IS NULL) OR (("origin_lng" >= ('-180'::integer)::double precision) AND ("origin_lng" <= (180)::double precision)))),
    CONSTRAINT "verified_at_required_when_verified" CHECK ((("is_verified" = false) OR (("is_verified" = true) AND ("verified_at" IS NOT NULL)))),
    CONSTRAINT "verified_by_required_when_verified" CHECK ((("is_verified" = false) OR (("is_verified" = true) AND ("verified_by" IS NOT NULL))))
);


ALTER TABLE "public"."supplier_products" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_products" IS 'Stores product catalog data from suppliers. Enables material selection with primary data provenance from supply chain.';



COMMENT ON COLUMN "public"."supplier_products"."supplier_id" IS 'Foreign key to suppliers table - which supplier provides this product';



COMMENT ON COLUMN "public"."supplier_products"."organization_id" IS 'Organization that owns this supplier relationship - enables multi-tenant isolation';



COMMENT ON COLUMN "public"."supplier_products"."carbon_intensity" IS 'Carbon footprint per unit (kg CO2e per unit). Primary data from supplier when available.';



COMMENT ON COLUMN "public"."supplier_products"."product_code" IS 'Supplier product code or SKU for reference and ordering';



COMMENT ON COLUMN "public"."supplier_products"."metadata" IS 'Flexible JSON storage for additional product attributes (certifications, specifications, etc.)';



COMMENT ON COLUMN "public"."supplier_products"."origin_address" IS 'Default origin address for this supplier product. Can be overridden at material level.';



COMMENT ON COLUMN "public"."supplier_products"."origin_lat" IS 'Default latitude for this supplier product origin.';



COMMENT ON COLUMN "public"."supplier_products"."origin_lng" IS 'Default longitude for this supplier product origin.';



COMMENT ON COLUMN "public"."supplier_products"."origin_country_code" IS 'Default ISO country code for this supplier product.';



COMMENT ON COLUMN "public"."supplier_products"."is_verified" IS 'Whether this product has been verified by Alkatera. Only verified products appear in material search.';



COMMENT ON COLUMN "public"."supplier_products"."verified_by" IS 'Alkatera admin who verified this product data. Required when is_verified is true.';



COMMENT ON COLUMN "public"."supplier_products"."verified_at" IS 'Timestamp when product was verified. Required when is_verified is true.';



COMMENT ON COLUMN "public"."supplier_products"."verification_notes" IS 'Admin notes about verification process, data quality checks performed, or issues found.';



COMMENT ON COLUMN "public"."supplier_products"."product_image_url" IS 'Storage path to product image in Supabase Storage (supplier-product-images bucket)';



COMMENT ON COLUMN "public"."supplier_products"."unit_measurement" IS 'The measurement value of a single unit (e.g., 570 for a 570g bottle)';



COMMENT ON COLUMN "public"."supplier_products"."unit_measurement_type" IS 'The type of measurement: weight (g/kg), volume (ml/L), length (cm/m), area (m²), count (units)';



COMMENT ON CONSTRAINT "verified_at_required_when_verified" ON "public"."supplier_products" IS 'Ensures verified_at timestamp is populated when product is marked as verified';



COMMENT ON CONSTRAINT "verified_by_required_when_verified" ON "public"."supplier_products" IS 'Ensures verified_by is populated when product is marked as verified';



CREATE OR REPLACE VIEW "public"."platform_dashboard_summary" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "public"."profiles") AS "total_users",
    ( SELECT "count"(*) AS "count"
           FROM "public"."organizations") AS "total_organizations",
    ( SELECT "count"(*) AS "count"
           FROM "public"."products") AS "total_products",
    ( SELECT "count"(*) AS "count"
           FROM "public"."facilities") AS "total_facilities",
    ( SELECT "count"(*) AS "count"
           FROM "public"."platform_activity_log"
          WHERE (("platform_activity_log"."activity_timestamp")::"date" = CURRENT_DATE)) AS "activities_today",
    (((( SELECT "count"(*) AS "count"
           FROM "public"."pending_activity_data"
          WHERE ("pending_activity_data"."approval_status" = 'pending'::"public"."approval_status_enum")) + ( SELECT "count"(*) AS "count"
           FROM "public"."pending_facilities"
          WHERE ("pending_facilities"."approval_status" = 'pending'::"public"."approval_status_enum"))) + ( SELECT "count"(*) AS "count"
           FROM "public"."pending_products"
          WHERE ("pending_products"."approval_status" = 'pending'::"public"."approval_status_enum"))) + ( SELECT "count"(*) AS "count"
           FROM "public"."pending_suppliers"
          WHERE ("pending_suppliers"."approval_status" = 'pending'::"public"."approval_status_enum"))) AS "total_pending_approvals",
    ( SELECT "count"(*) AS "count"
           FROM "public"."supplier_products"
          WHERE ("supplier_products"."is_verified" = false)) AS "unverified_supplier_products";


ALTER VIEW "public"."platform_dashboard_summary" OWNER TO "postgres";


COMMENT ON VIEW "public"."platform_dashboard_summary" IS 'Aggregated platform statistics for Alkatera admin dashboard - no private data exposed';



CREATE TABLE IF NOT EXISTS "public"."platform_feature_usage" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "usage_date" "date" NOT NULL,
    "feature_name" "text" NOT NULL,
    "feature_category" "text" NOT NULL,
    "total_uses" integer DEFAULT 0 NOT NULL,
    "unique_users" integer DEFAULT 0 NOT NULL,
    "unique_organizations" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_feature_usage" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_feature_usage" IS 'Feature adoption tracking across the platform';



CREATE TABLE IF NOT EXISTS "public"."platform_organization_stats" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "stat_date" "date" NOT NULL,
    "member_count" integer DEFAULT 0 NOT NULL,
    "product_count" integer DEFAULT 0 NOT NULL,
    "facility_count" integer DEFAULT 0 NOT NULL,
    "lca_count" integer DEFAULT 0 NOT NULL,
    "logins_count" integer DEFAULT 0 NOT NULL,
    "actions_count" integer DEFAULT 0 NOT NULL,
    "uses_scope1_tracking" boolean DEFAULT false,
    "uses_scope2_tracking" boolean DEFAULT false,
    "uses_scope3_tracking" boolean DEFAULT false,
    "uses_lca_module" boolean DEFAULT false,
    "uses_supplier_module" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_organization_stats" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_organization_stats" IS 'Organization activity statistics for platform analytics - counts only, no values';



CREATE TABLE IF NOT EXISTS "public"."platform_supplier_products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "platform_supplier_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "unit" "text" DEFAULT 'kg'::"text" NOT NULL,
    "carbon_intensity" numeric,
    "product_code" "text",
    "product_image_url" "text",
    "is_active" boolean DEFAULT true,
    "is_verified" boolean DEFAULT false NOT NULL,
    "verified_by" "uuid",
    "verified_at" timestamp with time zone,
    "verification_notes" "text",
    "origin_address" "text",
    "origin_lat" double precision,
    "origin_lng" double precision,
    "origin_country_code" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "unit_measurement" numeric(12,4),
    "unit_measurement_type" "text",
    CONSTRAINT "platform_supplier_products_unit_measurement_type_check" CHECK ((("unit_measurement_type" IS NULL) OR ("unit_measurement_type" = ANY (ARRAY['weight'::"text", 'volume'::"text", 'length'::"text", 'area'::"text", 'count'::"text"]))))
);


ALTER TABLE "public"."platform_supplier_products" OWNER TO "postgres";


COMMENT ON COLUMN "public"."platform_supplier_products"."unit_measurement" IS 'The measurement value of a single unit (e.g., 570 for a 570g bottle)';



COMMENT ON COLUMN "public"."platform_supplier_products"."unit_measurement_type" IS 'The type of measurement: weight (g/kg), volume (ml/L), length (cm/m), area (m²), count (units)';



CREATE TABLE IF NOT EXISTS "public"."platform_usage_metrics" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "metric_date" "date" NOT NULL,
    "total_users" integer DEFAULT 0 NOT NULL,
    "active_users_daily" integer DEFAULT 0 NOT NULL,
    "new_users" integer DEFAULT 0 NOT NULL,
    "total_organizations" integer DEFAULT 0 NOT NULL,
    "active_organizations_daily" integer DEFAULT 0 NOT NULL,
    "new_organizations" integer DEFAULT 0 NOT NULL,
    "lca_calculations_run" integer DEFAULT 0 NOT NULL,
    "products_created" integer DEFAULT 0 NOT NULL,
    "facilities_added" integer DEFAULT 0 NOT NULL,
    "reports_generated" integer DEFAULT 0 NOT NULL,
    "data_submissions" integer DEFAULT 0 NOT NULL,
    "approvals_processed" integer DEFAULT 0 NOT NULL,
    "api_requests" integer DEFAULT 0 NOT NULL,
    "edge_function_invocations" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_usage_metrics" OWNER TO "postgres";


COMMENT ON TABLE "public"."platform_usage_metrics" IS 'Daily aggregated platform usage metrics - no private organization data';



CREATE TABLE IF NOT EXISTS "public"."product_carbon_footprint_inputs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_carbon_footprint_id" "uuid" NOT NULL,
    "input_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."product_carbon_footprint_inputs" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_carbon_footprint_inputs" IS 'Input data for Product Carbon Footprint calculations';



CREATE TABLE IF NOT EXISTS "public"."product_carbon_footprint_results" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_carbon_footprint_id" "uuid" NOT NULL,
    "impact_category" "text" NOT NULL,
    "value" numeric NOT NULL,
    "unit" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "method" "text"
);


ALTER TABLE "public"."product_carbon_footprint_results" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_carbon_footprint_results" IS 'Calculated results for Product Carbon Footprints by impact category';



COMMENT ON COLUMN "public"."product_carbon_footprint_results"."method" IS 'LCIA method used for calculation (e.g., ReCiPe 2016, IPCC GWP100)';



CREATE TABLE IF NOT EXISTS "public"."product_category_proxy_mappings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_category" "text" NOT NULL,
    "product_subcategory" "text",
    "ecoinvent_process_uuid" "uuid",
    "ecoinvent_process_name" "text" NOT NULL,
    "ecoinvent_version" "text" DEFAULT '3.12'::"text",
    "co2e_per_kg" numeric NOT NULL,
    "water_use_per_kg" numeric DEFAULT 0,
    "land_use_per_kg" numeric DEFAULT 0,
    "ghg_biogenic_co2e_per_kg" numeric DEFAULT 0,
    "ghg_fossil_co2e_per_kg" numeric NOT NULL,
    "ghg_luluc_co2e_per_kg" numeric DEFAULT 0,
    "co2_per_kg" numeric DEFAULT 0,
    "ch4_per_kg" numeric DEFAULT 0,
    "n2o_per_kg" numeric DEFAULT 0,
    "data_quality_score" "text" DEFAULT 'Low'::"text",
    "geographical_scope" "text" DEFAULT 'Global'::"text",
    "temporal_scope" "text",
    "technology_scope" "text",
    "description" "text",
    "notes" "text",
    "confidence_level" "text" DEFAULT 'Estimated'::"text",
    "source_reference" "text",
    "recommended_buffer_percentage" numeric DEFAULT 10.0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."product_category_proxy_mappings" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_category_proxy_mappings" IS 'Maps product categories to Ecoinvent process proxies for conservative estimation when manufacturer-specific data is unavailable. All proxies include 10% safety buffer in calculations.';



CREATE TABLE IF NOT EXISTS "public"."product_end_of_life_scenarios" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" bigint NOT NULL,
    "material_id" "uuid",
    "organization_id" "uuid" NOT NULL,
    "scenario_name" "text" DEFAULT 'Default'::"text",
    "is_primary_scenario" boolean DEFAULT true,
    "recycling_percentage" numeric DEFAULT 0,
    "landfill_percentage" numeric DEFAULT 0,
    "incineration_percentage" numeric DEFAULT 0,
    "composting_percentage" numeric DEFAULT 0,
    "anaerobic_digestion_percentage" numeric DEFAULT 0,
    "reuse_percentage" numeric DEFAULT 0,
    "recycling_emissions_factor" numeric DEFAULT 0,
    "landfill_emissions_factor" numeric DEFAULT 0,
    "incineration_emissions_factor" numeric DEFAULT 0,
    "composting_emissions_factor" numeric DEFAULT 0,
    "total_emissions_kg_co2e" numeric DEFAULT 0,
    "avoided_emissions_kg_co2e" numeric DEFAULT 0,
    "material_mass_kg" numeric,
    "data_source" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "eol_percentages_sum" CHECK (((((((COALESCE("recycling_percentage", (0)::numeric) + COALESCE("landfill_percentage", (0)::numeric)) + COALESCE("incineration_percentage", (0)::numeric)) + COALESCE("composting_percentage", (0)::numeric)) + COALESCE("anaerobic_digestion_percentage", (0)::numeric)) + COALESCE("reuse_percentage", (0)::numeric)) <= 100.01)),
    CONSTRAINT "product_end_of_life_scenario_anaerobic_digestion_percenta_check" CHECK ((("anaerobic_digestion_percentage" >= (0)::numeric) AND ("anaerobic_digestion_percentage" <= (100)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_composting_percentage_check" CHECK ((("composting_percentage" >= (0)::numeric) AND ("composting_percentage" <= (100)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_incineration_percentage_check" CHECK ((("incineration_percentage" >= (0)::numeric) AND ("incineration_percentage" <= (100)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_landfill_percentage_check" CHECK ((("landfill_percentage" >= (0)::numeric) AND ("landfill_percentage" <= (100)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_material_mass_kg_check" CHECK ((("material_mass_kg" IS NULL) OR ("material_mass_kg" >= (0)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_recycling_percentage_check" CHECK ((("recycling_percentage" >= (0)::numeric) AND ("recycling_percentage" <= (100)::numeric))),
    CONSTRAINT "product_end_of_life_scenarios_reuse_percentage_check" CHECK ((("reuse_percentage" >= (0)::numeric) AND ("reuse_percentage" <= (100)::numeric)))
);


ALTER TABLE "public"."product_end_of_life_scenarios" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."product_lca_inputs" AS
 SELECT "id",
    "product_carbon_footprint_id" AS "product_lca_id",
    "input_data",
    "created_at"
   FROM "public"."product_carbon_footprint_inputs";


ALTER VIEW "public"."product_lca_inputs" OWNER TO "postgres";


COMMENT ON VIEW "public"."product_lca_inputs" IS 'DEPRECATED: Use product_carbon_footprint_inputs table';



CREATE OR REPLACE VIEW "public"."product_lca_materials" AS
 SELECT "id",
    "product_carbon_footprint_id" AS "product_lca_id",
    "material_id",
    "material_type",
    "quantity",
    "created_at",
    "updated_at"
   FROM "public"."product_carbon_footprint_materials";


ALTER VIEW "public"."product_lca_materials" OWNER TO "postgres";


COMMENT ON VIEW "public"."product_lca_materials" IS 'DEPRECATED: Use product_carbon_footprint_materials table';



CREATE OR REPLACE VIEW "public"."product_lca_production_sites" AS
 SELECT "id",
    "product_carbon_footprint_id" AS "product_lca_id",
    "facility_id",
    "organization_id",
    "production_volume",
    "share_of_production",
    "facility_intensity",
    "attributable_emissions_per_unit",
    "data_source",
    "created_at",
    "updated_at"
   FROM "public"."product_carbon_footprint_production_sites";


ALTER VIEW "public"."product_lca_production_sites" OWNER TO "postgres";


COMMENT ON VIEW "public"."product_lca_production_sites" IS 'DEPRECATED: Use product_carbon_footprint_production_sites table';



CREATE OR REPLACE VIEW "public"."product_lca_results" AS
 SELECT "id",
    "product_carbon_footprint_id" AS "product_lca_id",
    "impact_category",
    "value",
    "unit",
    "created_at"
   FROM "public"."product_carbon_footprint_results";


ALTER VIEW "public"."product_lca_results" OWNER TO "postgres";


COMMENT ON VIEW "public"."product_lca_results" IS 'DEPRECATED: Use product_carbon_footprint_results table';



CREATE OR REPLACE VIEW "public"."product_lcas" AS
 SELECT "id",
    "organization_id",
    "product_name",
    "functional_unit",
    "system_boundary",
    "status",
    "created_at",
    "updated_at"
   FROM "public"."product_carbon_footprints";


ALTER VIEW "public"."product_lcas" OWNER TO "postgres";


COMMENT ON VIEW "public"."product_lcas" IS 'DEPRECATED: Use product_carbon_footprints table';



CREATE TABLE IF NOT EXISTS "public"."product_materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "product_id" bigint NOT NULL,
    "material_name" "text" NOT NULL,
    "material_id" "uuid",
    "material_type" "text",
    "quantity" numeric(10,4) NOT NULL,
    "unit" "text",
    "lca_stage_id" bigint,
    "lca_sub_stage_id" bigint,
    "data_source" "text",
    "data_source_id" "text",
    "supplier_product_id" "uuid",
    "origin_country" "text",
    "is_organic_certified" boolean DEFAULT false,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "packaging_category" "text",
    "transport_mode" "text",
    "distance_km" numeric,
    "transport_emissions" numeric,
    "origin_lat" numeric,
    "origin_lng" numeric,
    "origin_address" "text",
    "origin_country_code" "text",
    "category_type" "public"."material_category_type",
    "epr_is_drinks_container" boolean DEFAULT false,
    "epr_is_household" boolean DEFAULT false,
    "has_component_breakdown" boolean DEFAULT false,
    "component_glass_weight" numeric DEFAULT 0,
    "component_aluminium_weight" numeric DEFAULT 0,
    "component_steel_weight" numeric DEFAULT 0,
    "component_paper_weight" numeric DEFAULT 0,
    "component_wood_weight" numeric DEFAULT 0,
    "component_other_weight" numeric DEFAULT 0,
    "epr_class" "text",
    "epr_subclass" "text",
    "epr_material_type" "text",
    "epr_recyclability" "text",
    "epr_producer_id" "text",
    "total_weight_kg" numeric,
    "recycled_content_percent" numeric DEFAULT 0,
    "net_weight_g" numeric,
    "printing_process" "text",
    "recycled_content_percentage" numeric,
    CONSTRAINT "check_packaging_category" CHECK ((("packaging_category" IS NULL) OR ("packaging_category" = ANY (ARRAY['container'::"text", 'label'::"text", 'closure'::"text", 'secondary'::"text"])))),
    CONSTRAINT "data_source_integrity" CHECK (((("data_source" = 'openlca'::"text") AND ("data_source_id" IS NOT NULL)) OR (("data_source" = 'supplier'::"text") AND ("supplier_product_id" IS NOT NULL)) OR ("data_source" IS NULL))),
    CONSTRAINT "origin_coordinates_completeness" CHECK (((("origin_lat" IS NULL) AND ("origin_lng" IS NULL)) OR (("origin_lat" IS NOT NULL) AND ("origin_lng" IS NOT NULL)))),
    CONSTRAINT "positive_quantity" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "product_materials_distance_km_check" CHECK ((("distance_km" IS NULL) OR ("distance_km" >= (0)::numeric))),
    CONSTRAINT "product_materials_origin_country_code_check" CHECK ((("origin_country_code" IS NULL) OR ("length"("origin_country_code") = 2))),
    CONSTRAINT "product_materials_origin_lat_check" CHECK ((("origin_lat" IS NULL) OR (("origin_lat" >= ('-90'::integer)::numeric) AND ("origin_lat" <= (90)::numeric)))),
    CONSTRAINT "product_materials_origin_lng_check" CHECK ((("origin_lng" IS NULL) OR (("origin_lng" >= ('-180'::integer)::numeric) AND ("origin_lng" <= (180)::numeric)))),
    CONSTRAINT "product_materials_transport_mode_check" CHECK (("transport_mode" = ANY (ARRAY['truck'::"text", 'train'::"text", 'ship'::"text", 'air'::"text"]))),
    CONSTRAINT "transport_data_completeness" CHECK (((("transport_mode" IS NULL) AND ("distance_km" IS NULL)) OR (("transport_mode" IS NOT NULL) AND ("distance_km" IS NOT NULL)))),
    CONSTRAINT "valid_data_source" CHECK ((("data_source" IS NULL) OR ("data_source" = ANY (ARRAY['openlca'::"text", 'supplier'::"text"])))),
    CONSTRAINT "valid_material_type" CHECK ((("material_type" IS NULL) OR ("material_type" = ANY (ARRAY['ingredient'::"text", 'packaging'::"text"]))))
);


ALTER TABLE "public"."product_materials" OWNER TO "postgres";


COMMENT ON TABLE "public"."product_materials" IS 'Master bill of materials template for products. Materials are copied from here to product_lca_materials when creating new LCA calculations.';



COMMENT ON COLUMN "public"."product_materials"."product_id" IS 'Foreign key linking to the parent product.';



COMMENT ON COLUMN "public"."product_materials"."material_name" IS 'Display name for the material (e.g., "Organic Wheat Flour", "Glass Bottle").';



COMMENT ON COLUMN "public"."product_materials"."material_id" IS 'UUID referencing either ingredients or packaging_types table (determined by material_type).';



COMMENT ON COLUMN "public"."product_materials"."material_type" IS 'Discriminator field: "ingredient" or "packaging" indicating which table material_id references.';



COMMENT ON COLUMN "public"."product_materials"."quantity" IS 'Default amount of material used in the product. Units specified in unit column.';



COMMENT ON COLUMN "public"."product_materials"."unit" IS 'Unit of measurement for quantity (kg, L, units, etc).';



COMMENT ON COLUMN "public"."product_materials"."lca_stage_id" IS 'Which LCA lifecycle stage this material belongs to (A1-A3, B1-B7, C1-C4, D).';



COMMENT ON COLUMN "public"."product_materials"."lca_sub_stage_id" IS 'Specific sub-stage within the LCA stage.';



COMMENT ON COLUMN "public"."product_materials"."data_source" IS 'Data provenance: "openlca" for OpenLCA database, "supplier" for internal supplier network.';



COMMENT ON COLUMN "public"."product_materials"."data_source_id" IS 'External system identifier - stores OpenLCA process UUID when data_source is "openlca".';



COMMENT ON COLUMN "public"."product_materials"."supplier_product_id" IS 'Foreign key to supplier_products table when data_source is "supplier".';



COMMENT ON COLUMN "public"."product_materials"."origin_country" IS 'Country or region of origin for the material.';



COMMENT ON COLUMN "public"."product_materials"."is_organic_certified" IS 'Indicates whether the material has organic certification.';



COMMENT ON COLUMN "public"."product_materials"."notes" IS 'User-entered notes about this material for documentation purposes.';



COMMENT ON COLUMN "public"."product_materials"."transport_mode" IS 'Mode of transport from origin to facility. Must match DEFRA freight categories: truck, train, ship, or air.';



COMMENT ON COLUMN "public"."product_materials"."distance_km" IS 'Distance in kilometres from material origin to production facility. Used to calculate transport emissions.';



COMMENT ON COLUMN "public"."product_materials"."transport_emissions" IS 'Calculated transport emissions in kg CO2e. Computed using: (weight_kg / 1000) × distance_km × emission_factor';



COMMENT ON COLUMN "public"."product_materials"."origin_lat" IS 'Latitude coordinate of material origin. Must be between -90 and 90 degrees.';



COMMENT ON COLUMN "public"."product_materials"."origin_lng" IS 'Longitude coordinate of material origin. Must be between -180 and 180 degrees.';



COMMENT ON COLUMN "public"."product_materials"."origin_address" IS 'Full address of material origin location for supply chain mapping.';



COMMENT ON COLUMN "public"."product_materials"."origin_country_code" IS 'ISO 3166-1 alpha-2 country code (2 letters) for material origin country.';



COMMENT ON COLUMN "public"."product_materials"."category_type" IS 'Auto-detected category based on material name and usage';



COMMENT ON CONSTRAINT "origin_coordinates_completeness" ON "public"."product_materials" IS 'Ensures origin_lat and origin_lng are either both NULL or both specified for valid geolocation data.';



COMMENT ON CONSTRAINT "transport_data_completeness" ON "public"."product_materials" IS 'Ensures transport_mode and distance_km are either both NULL or both specified for data consistency.';



ALTER TABLE "public"."products" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."products_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE OR REPLACE VIEW "public"."report_statistics" AS
 SELECT "organization_id",
    "count"(*) AS "total_reports",
    "count"(*) FILTER (WHERE ("status" = 'completed'::"text")) AS "completed_reports",
    "count"(*) FILTER (WHERE ("status" = 'failed'::"text")) AS "failed_reports",
    "count"(*) FILTER (WHERE ("status" = 'generating'::"text")) AS "generating_reports",
    "count"(*) FILTER (WHERE ("status" = 'pending'::"text")) AS "pending_reports",
    "count"(*) FILTER (WHERE ("output_format" = 'pptx'::"text")) AS "pptx_count",
    "count"(*) FILTER (WHERE ("output_format" = 'docx'::"text")) AS "docx_count",
    "count"(*) FILTER (WHERE ("output_format" = 'xlsx'::"text")) AS "xlsx_count",
    "max"("created_at") AS "last_report_created_at"
   FROM "public"."generated_reports"
  GROUP BY "organization_id";


ALTER VIEW "public"."report_statistics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "role_id" "uuid" NOT NULL,
    "permission_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scope_1_2_emission_sources" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "source_name" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "category" "text" NOT NULL,
    "default_unit" "text" NOT NULL,
    "emission_factor_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "scope_1_2_emission_sources_category_check" CHECK (("category" = ANY (ARRAY['Stationary Combustion'::"text", 'Mobile Combustion'::"text", 'Fugitive Emissions'::"text", 'Purchased Energy'::"text"]))),
    CONSTRAINT "scope_1_2_emission_sources_scope_check" CHECK (("scope" = ANY (ARRAY['Scope 1'::"text", 'Scope 2'::"text"])))
);


ALTER TABLE "public"."scope_1_2_emission_sources" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spend_category_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "pattern" "text" NOT NULL,
    "category" "text" NOT NULL,
    "match_count" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spend_category_patterns_category_check" CHECK (("category" = ANY (ARRAY['business_travel'::"text", 'purchased_services'::"text", 'employee_commuting'::"text", 'capital_goods'::"text", 'downstream_logistics'::"text", 'operational_waste'::"text", 'marketing_materials'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."spend_category_patterns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spend_import_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "report_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "total_rows" integer DEFAULT 0 NOT NULL,
    "processed_rows" integer DEFAULT 0 NOT NULL,
    "approved_rows" integer DEFAULT 0 NOT NULL,
    "imported_at" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'uploading'::"text" NOT NULL,
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "ai_processing_started_at" timestamp with time zone,
    "ai_processing_completed_at" timestamp with time zone,
    "rejected_rows" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "spend_import_batches_status_check" CHECK (("status" = ANY (ARRAY['uploading'::"text", 'pending_categorization'::"text", 'processing'::"text", 'partial'::"text", 'ready_for_review'::"text", 'approved'::"text", 'failed'::"text"])))
);


ALTER TABLE "public"."spend_import_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spend_import_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "batch_id" "uuid" NOT NULL,
    "row_number" integer NOT NULL,
    "raw_description" "text" NOT NULL,
    "raw_amount" numeric NOT NULL,
    "raw_currency" "text" DEFAULT 'GBP'::"text" NOT NULL,
    "raw_date" "date",
    "suggested_category" "text",
    "ai_confidence_score" numeric,
    "ai_reasoning" "text",
    "user_category" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "computed_co2e" numeric,
    "emission_factor" numeric,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "raw_vendor" "text",
    "raw_category" "text",
    "ai_processed_at" timestamp with time zone,
    CONSTRAINT "spend_import_items_ai_confidence_check" CHECK ((("ai_confidence_score" >= (0)::numeric) AND ("ai_confidence_score" <= (1)::numeric))),
    CONSTRAINT "spend_import_items_raw_amount_check" CHECK (("raw_amount" >= (0)::numeric)),
    CONSTRAINT "spend_import_items_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'imported'::"text"]))),
    CONSTRAINT "spend_import_items_suggested_category_check" CHECK (("suggested_category" = ANY (ARRAY['business_travel'::"text", 'purchased_services'::"text", 'employee_commuting'::"text", 'capital_goods'::"text", 'downstream_logistics'::"text", 'operational_waste'::"text", 'marketing_materials'::"text", 'other'::"text"]))),
    CONSTRAINT "spend_import_items_user_category_check" CHECK (("user_category" = ANY (ARRAY['business_travel'::"text", 'purchased_services'::"text", 'employee_commuting'::"text", 'capital_goods'::"text", 'downstream_logistics'::"text", 'operational_waste'::"text", 'marketing_materials'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."spend_import_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staging_emission_factors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text" NOT NULL,
    "co2_factor" numeric NOT NULL,
    "reference_unit" "text" NOT NULL,
    "source" "text" DEFAULT 'Internal Proxy'::"text",
    "uuid_ref" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "water_factor" numeric DEFAULT 0,
    "land_factor" numeric DEFAULT 0,
    "waste_factor" numeric DEFAULT 0,
    "category_type" "public"."material_category_type",
    "geographic_scope" "text" DEFAULT 'GLO'::"text",
    "co2_fossil_factor" numeric,
    "co2_biogenic_factor" numeric,
    "ch4_fossil_factor" numeric,
    "ch4_biogenic_factor" numeric,
    "n2o_factor" numeric,
    "hfc_pfc_factor" numeric DEFAULT 0,
    "gwp_methodology" "text" DEFAULT 'IPCC AR6 GWP100'::"text",
    "temporal_coverage" "text" DEFAULT '2020-2023'::"text",
    "ecoinvent_reference" "text",
    "uncertainty_percent" numeric,
    "terrestrial_ecotoxicity_factor" numeric,
    "freshwater_eutrophication_factor" numeric,
    "terrestrial_acidification_factor" numeric,
    "freshwater_ecotoxicity_factor" numeric,
    "marine_ecotoxicity_factor" numeric,
    "marine_eutrophication_factor" numeric,
    "co2_dluc_factor" numeric DEFAULT 0,
    "ch4_factor" numeric DEFAULT 0,
    CONSTRAINT "check_land_factor_non_negative" CHECK (("land_factor" >= (0)::numeric)),
    CONSTRAINT "check_waste_factor_non_negative" CHECK (("waste_factor" >= (0)::numeric)),
    CONSTRAINT "check_water_factor_non_negative" CHECK (("water_factor" >= (0)::numeric)),
    CONSTRAINT "staging_emission_factors_category_check" CHECK (("category" = ANY (ARRAY['Ingredient'::"text", 'Packaging'::"text", 'Energy'::"text", 'Transport'::"text", 'Waste'::"text"]))),
    CONSTRAINT "staging_emission_factors_co2_factor_check" CHECK (("co2_factor" >= (0)::numeric))
);


ALTER TABLE "public"."staging_emission_factors" OWNER TO "postgres";


COMMENT ON TABLE "public"."staging_emission_factors" IS 'Local staging library for realistic emission factors. Prioritised in waterfall lookup before external databases (OpenLCA/Ecoinvent).';



COMMENT ON COLUMN "public"."staging_emission_factors"."water_factor" IS 'Water consumption per reference unit (m³). For water ingredients with reference_unit=L,
use 0.0011 m³/L (1.1 litres per litre delivered, including ~10% treatment losses).
DO NOT use 1.0 m³/L as this incorrectly implies 1000:1 water consumption ratio.';



COMMENT ON COLUMN "public"."staging_emission_factors"."land_factor" IS 'Land use per reference unit (m² or m²·year depending on context)';



COMMENT ON COLUMN "public"."staging_emission_factors"."waste_factor" IS 'Waste generated per reference unit (kg/unit)';



COMMENT ON COLUMN "public"."staging_emission_factors"."category_type" IS 'Material category for data source routing logic';



COMMENT ON COLUMN "public"."staging_emission_factors"."geographic_scope" IS 'Geographic scope of factor: UK (DEFRA), EU-27 (European), GLO (Global). Used for data quality assessment.';



COMMENT ON COLUMN "public"."staging_emission_factors"."terrestrial_ecotoxicity_factor" IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';



COMMENT ON COLUMN "public"."staging_emission_factors"."freshwater_eutrophication_factor" IS 'ReCiPe 2016: kg phosphorus equivalents per reference unit';



COMMENT ON COLUMN "public"."staging_emission_factors"."terrestrial_acidification_factor" IS 'ReCiPe 2016: kg sulfur dioxide equivalents per reference unit';



COMMENT ON COLUMN "public"."staging_emission_factors"."freshwater_ecotoxicity_factor" IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';



COMMENT ON COLUMN "public"."staging_emission_factors"."marine_ecotoxicity_factor" IS 'ReCiPe 2016: kg 1,4-dichlorobenzene equivalents per reference unit';



COMMENT ON COLUMN "public"."staging_emission_factors"."marine_eutrophication_factor" IS 'ReCiPe 2016: kg nitrogen equivalents per reference unit';



CREATE TABLE IF NOT EXISTS "public"."subscription_tier_limits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier_name" "text" NOT NULL,
    "tier_level" integer NOT NULL,
    "display_name" "text" NOT NULL,
    "max_products" integer,
    "max_reports_per_month" integer,
    "max_team_members" integer,
    "max_facilities" integer,
    "max_suppliers" integer,
    "max_lcas" integer,
    "max_api_calls_per_month" integer,
    "max_storage_mb" integer,
    "features_enabled" "jsonb" DEFAULT '[]'::"jsonb",
    "monthly_price_gbp" numeric(10,2) DEFAULT NULL::numeric,
    "annual_price_gbp" numeric(10,2) DEFAULT NULL::numeric,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "valid_tier_level" CHECK ((("tier_level" >= 1) AND ("tier_level" <= 3))),
    CONSTRAINT "valid_tier_name" CHECK (("tier_name" = ANY (ARRAY['seed'::"text", 'blossom'::"text", 'canopy'::"text"])))
);


ALTER TABLE "public"."subscription_tier_limits" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscription_tier_limits" IS 'Defines resource and feature limits for each subscription tier. NULL values indicate unlimited.';



COMMENT ON COLUMN "public"."subscription_tier_limits"."tier_level" IS 'Internal tier level: 1=basic, 2=premium, 3=enterprise';



CREATE OR REPLACE VIEW "public"."subscription_tiers_comparison" AS
 SELECT "tier_name",
    "tier_level",
    "display_name",
    COALESCE(("max_products")::"text", 'Unlimited'::"text") AS "products_limit",
    COALESCE(("max_reports_per_month")::"text", 'Unlimited'::"text") AS "reports_per_month",
    COALESCE(("max_team_members")::"text", 'Unlimited'::"text") AS "team_members",
    COALESCE(("max_facilities")::"text", 'Unlimited'::"text") AS "facilities",
    COALESCE(("max_suppliers")::"text", 'Unlimited'::"text") AS "suppliers",
    COALESCE(("max_lcas")::"text", 'Unlimited'::"text") AS "lcas",
    "features_enabled",
    "description",
    "monthly_price_gbp",
    "annual_price_gbp"
   FROM "public"."subscription_tier_limits"
  WHERE ("is_active" = true)
  ORDER BY "tier_level";


ALTER VIEW "public"."subscription_tiers_comparison" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."supplier_data_submissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "supplier_id" "uuid",
    "facility_id" "uuid",
    "submission_date" timestamp with time zone DEFAULT "now"(),
    "reporting_period_start" "date" NOT NULL,
    "reporting_period_end" "date" NOT NULL,
    "data_format" "text" NOT NULL,
    "attestation_level" "public"."submission_attestation_level_enum" DEFAULT 'self_reported'::"public"."submission_attestation_level_enum" NOT NULL,
    "verification_status" "public"."submission_verification_status_enum" DEFAULT 'pending'::"public"."submission_verification_status_enum" NOT NULL,
    "attestation_document_url" "text",
    "attestation_document_name" "text",
    "total_water_entries" integer DEFAULT 0,
    "total_waste_entries" integer DEFAULT 0,
    "total_utility_entries" integer DEFAULT 0,
    "total_facility_production_volume" numeric,
    "production_volume_unit" "text",
    "brand_attributed_volume" numeric,
    "validation_errors" "jsonb" DEFAULT '[]'::"jsonb",
    "validation_warnings" "jsonb" DEFAULT '[]'::"jsonb",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "review_notes" "text",
    "submitter_name" "text",
    "submitter_email" "text",
    "submitter_role" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supplier_data_submissions_brand_attributed_volume_check" CHECK ((("brand_attributed_volume" IS NULL) OR ("brand_attributed_volume" >= (0)::numeric))),
    CONSTRAINT "supplier_data_submissions_data_format_check" CHECK (("data_format" = ANY (ARRAY['structured_entry'::"text", 'csv_upload'::"text", 'api_submission'::"text", 'manual_entry'::"text"]))),
    CONSTRAINT "supplier_data_submissions_total_facility_production_volum_check" CHECK ((("total_facility_production_volume" IS NULL) OR ("total_facility_production_volume" > (0)::numeric)))
);


ALTER TABLE "public"."supplier_data_submissions" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_data_submissions" IS 'Third-party data intake workflow with attestation and verification tracking.';



CREATE TABLE IF NOT EXISTS "public"."supplier_data_upgrade_recommendations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_lca_id" "uuid" NOT NULL,
    "material_id" "uuid" NOT NULL,
    "current_data_source" "text" NOT NULL,
    "current_data_quality_grade" "text" NOT NULL,
    "recommended_supplier_id" "uuid",
    "recommended_supplier_product_id" "uuid",
    "potential_data_quality_grade" "text" NOT NULL,
    "potential_improvement_score" numeric(5,2),
    "status" "text" DEFAULT 'PENDING'::"text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "review_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supplier_data_upgrade_recommendations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'DISMISSED'::"text"])))
);


ALTER TABLE "public"."supplier_data_upgrade_recommendations" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_data_upgrade_recommendations" IS 'Tracks opportunities to upgrade proxy/hybrid data with verified supplier EPD data';



CREATE OR REPLACE VIEW "public"."supplier_engagement_view" WITH ("security_invoker"='true') AS
 WITH "org_totals" AS (
         SELECT "s_1"."organization_id",
            "count"(DISTINCT "s_1"."id") AS "total_suppliers"
           FROM "public"."suppliers" "s_1"
          GROUP BY "s_1"."organization_id"
        )
 SELECT "s"."organization_id",
    COALESCE(("se"."status")::"text", 'no_engagement'::"text") AS "status",
    "count"(DISTINCT "s"."id") AS "supplier_count",
    "round"(((("count"(DISTINCT "s"."id"))::numeric / (NULLIF("ot"."total_suppliers", 0))::numeric) * (100)::numeric), 1) AS "percentage",
    "ot"."total_suppliers"
   FROM (("public"."suppliers" "s"
     LEFT JOIN "public"."supplier_engagements" "se" ON (("s"."id" = "se"."supplier_id")))
     JOIN "org_totals" "ot" ON (("s"."organization_id" = "ot"."organization_id")))
  GROUP BY "s"."organization_id", "se"."status", "ot"."total_suppliers"
  ORDER BY
        CASE COALESCE(("se"."status")::"text", 'no_engagement'::"text")
            WHEN 'data_provided'::"text" THEN 1
            WHEN 'active'::"text" THEN 2
            WHEN 'invited'::"text" THEN 3
            WHEN 'inactive'::"text" THEN 4
            ELSE 5
        END;


ALTER VIEW "public"."supplier_engagement_view" OWNER TO "postgres";


COMMENT ON VIEW "public"."supplier_engagement_view" IS 'Aggregated view of supplier engagement by status. Shows counts and percentages per organization. Uses security_invoker=true to inherit RLS from suppliers table.';



CREATE TABLE IF NOT EXISTS "public"."supplier_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "product_id" bigint NOT NULL,
    "material_id" "uuid" NOT NULL,
    "material_name" "text" NOT NULL,
    "material_type" "text" NOT NULL,
    "supplier_email" "text" NOT NULL,
    "supplier_name" "text",
    "invitation_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(32), 'hex'::"text") NOT NULL,
    "status" "public"."supplier_invitation_status" DEFAULT 'pending'::"public"."supplier_invitation_status" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "accepted_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "supplier_id" "uuid",
    "personal_message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "supplier_invitations_material_type_check" CHECK (("material_type" = ANY (ARRAY['ingredient'::"text", 'packaging'::"text"]))),
    CONSTRAINT "valid_email" CHECK (("supplier_email" ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::"text"))
);


ALTER TABLE "public"."supplier_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."supplier_invitations" IS 'Tracks supplier invitations sent from supply chain map to request verified product data';



COMMENT ON COLUMN "public"."supplier_invitations"."material_id" IS 'Reference to the specific material that prompted this invitation';



COMMENT ON COLUMN "public"."supplier_invitations"."invitation_token" IS 'Unique secure token used in invitation URL for supplier onboarding';



COMMENT ON COLUMN "public"."supplier_invitations"."expires_at" IS 'Invitation expiry date, defaults to 30 days from creation';



CREATE TABLE IF NOT EXISTS "public"."user_dashboard_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "widget_id" "text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "col_span" integer DEFAULT 2 NOT NULL,
    "row_span" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_dashboard_preferences" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."user_evidence_contributions" AS
 SELECT "organization_id",
    "user_id",
    "count"(*) AS "total_submissions",
    "count"(*) FILTER (WHERE ("verification_status" = 'verified'::"public"."verification_status_enum")) AS "verified_submissions",
    "count"(*) FILTER (WHERE ("verification_status" = 'rejected'::"public"."verification_status_enum")) AS "rejected_submissions",
    "min"("created_at") AS "first_submission",
    "max"("created_at") AS "last_submission",
    "count"(DISTINCT "document_type") AS "document_types_used"
   FROM "public"."data_provenance_trail"
  GROUP BY "organization_id", "user_id";


ALTER VIEW "public"."user_evidence_contributions" OWNER TO "postgres";


COMMENT ON VIEW "public"."user_evidence_contributions" IS 'Tracks evidence submission activity by user within each organisation. Useful for identifying active contributors and monitoring submission quality. Respects RLS policies.';



CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_id" "uuid",
    "notification_type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "text",
    "is_read" boolean DEFAULT false NOT NULL,
    "read_at" timestamp with time zone,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_notifications" IS 'Notification center for user alerts including approval/rejection notifications';



CREATE TABLE IF NOT EXISTS "public"."utility_fuel_type_mapping" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "utility_type" "text" NOT NULL,
    "utility_type_display" "text" NOT NULL,
    "fuel_type" "text" NOT NULL,
    "default_unit" "text" NOT NULL,
    "normalized_unit" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "utility_fuel_type_mapping_scope_check" CHECK (("scope" = ANY (ARRAY['1'::"text", '2'::"text"])))
);


ALTER TABLE "public"."utility_fuel_type_mapping" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vitality_benchmarks" AS
 WITH "latest_scores" AS (
         SELECT DISTINCT ON ("organization_vitality_scores"."organization_id") "organization_vitality_scores"."organization_id",
            "organization_vitality_scores"."overall_score",
            "organization_vitality_scores"."climate_score",
            "organization_vitality_scores"."water_score",
            "organization_vitality_scores"."circularity_score",
            "organization_vitality_scores"."nature_score",
            "organization_vitality_scores"."year",
            "organization_vitality_scores"."calculation_date"
           FROM "public"."organization_vitality_scores"
          ORDER BY "organization_vitality_scores"."organization_id", "organization_vitality_scores"."calculation_date" DESC
        ), "org_categories" AS (
         SELECT "organizations"."id" AS "organization_id",
            "organizations"."industry_sector" AS "category_name"
           FROM "public"."organizations"
          WHERE ("organizations"."industry_sector" IS NOT NULL)
        )
 SELECT 'platform'::"text" AS "benchmark_type",
    NULL::"text" AS "category_name",
    ("round"("avg"("ls"."overall_score")))::integer AS "overall_avg",
    ("round"("avg"("ls"."climate_score")))::integer AS "climate_avg",
    ("round"("avg"("ls"."water_score")))::integer AS "water_avg",
    ("round"("avg"("ls"."circularity_score")))::integer AS "circularity_avg",
    ("round"("avg"("ls"."nature_score")))::integer AS "nature_avg",
    "max"("ls"."overall_score") AS "overall_top",
    "max"("ls"."climate_score") AS "climate_top",
    "max"("ls"."water_score") AS "water_top",
    "max"("ls"."circularity_score") AS "circularity_top",
    "max"("ls"."nature_score") AS "nature_top",
    "count"(DISTINCT "ls"."organization_id") AS "organization_count",
    "now"() AS "calculated_at"
   FROM "latest_scores" "ls"
UNION ALL
 SELECT 'category'::"text" AS "benchmark_type",
    "oc"."category_name",
    ("round"("avg"("ls"."overall_score")))::integer AS "overall_avg",
    ("round"("avg"("ls"."climate_score")))::integer AS "climate_avg",
    ("round"("avg"("ls"."water_score")))::integer AS "water_avg",
    ("round"("avg"("ls"."circularity_score")))::integer AS "circularity_avg",
    ("round"("avg"("ls"."nature_score")))::integer AS "nature_avg",
    "max"("ls"."overall_score") AS "overall_top",
    "max"("ls"."climate_score") AS "climate_top",
    "max"("ls"."water_score") AS "water_top",
    "max"("ls"."circularity_score") AS "circularity_top",
    "max"("ls"."nature_score") AS "nature_top",
    "count"(DISTINCT "ls"."organization_id") AS "organization_count",
    "now"() AS "calculated_at"
   FROM ("latest_scores" "ls"
     JOIN "org_categories" "oc" ON (("ls"."organization_id" = "oc"."organization_id")))
  WHERE ("oc"."category_name" IS NOT NULL)
  GROUP BY "oc"."category_name";


ALTER VIEW "public"."vitality_benchmarks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vitality_score_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "organization_id" "uuid" NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "overall_score" integer NOT NULL,
    "climate_score" integer NOT NULL,
    "water_score" integer NOT NULL,
    "circularity_score" integer NOT NULL,
    "nature_score" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."vitality_score_snapshots" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."waste_stream_summary" AS
 SELECT "fae"."organization_id",
    "fae"."facility_id",
    "f"."name" AS "facility_name",
    (EXTRACT(year FROM "fae"."activity_date"))::integer AS "year",
    (EXTRACT(month FROM "fae"."activity_date"))::integer AS "month",
    "fae"."waste_category",
    "fae"."waste_treatment_method",
    "fae"."hazard_classification",
    ("count"(*))::integer AS "entry_count",
    "sum"("fae"."quantity") AS "total_quantity_kg",
    "avg"("fae"."waste_recovery_percentage") AS "avg_recovery_percentage",
    "sum"("fae"."calculated_emissions_kg_co2e") AS "total_emissions_kg_co2e",
    "max"(("fae"."data_provenance")::"text") AS "data_provenance",
    "avg"("fae"."confidence_score") AS "avg_confidence_score"
   FROM ("public"."facility_activity_entries" "fae"
     JOIN "public"."facilities" "f" ON (("f"."id" = "fae"."facility_id")))
  WHERE (("fae"."activity_category" = ANY (ARRAY['waste_general'::"public"."facility_activity_category_enum", 'waste_hazardous'::"public"."facility_activity_category_enum", 'waste_recycling'::"public"."facility_activity_category_enum"])) AND ("fae"."waste_category" IS NOT NULL))
  GROUP BY "fae"."organization_id", "fae"."facility_id", "f"."name", (EXTRACT(year FROM "fae"."activity_date")), (EXTRACT(month FROM "fae"."activity_date")), "fae"."waste_category", "fae"."waste_treatment_method", "fae"."hazard_classification";


ALTER VIEW "public"."waste_stream_summary" OWNER TO "postgres";


ALTER TABLE ONLY "public"."lca_life_cycle_stages" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."lca_life_cycle_stages_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accredited_advisors"
    ADD CONSTRAINT "accredited_advisors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_data"
    ADD CONSTRAINT "activity_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "advisor_organization_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."aware_factors"
    ADD CONSTRAINT "aware_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."bom_extracted_items"
    ADD CONSTRAINT "bom_extracted_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bom_imports"
    ADD CONSTRAINT "bom_imports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bulk_import_sessions"
    ADD CONSTRAINT "bulk_import_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calculated_emissions"
    ADD CONSTRAINT "calculated_emissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calculated_metrics"
    ADD CONSTRAINT "calculated_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."calculation_logs"
    ADD CONSTRAINT "calculation_logs_pkey" PRIMARY KEY ("log_id");



ALTER TABLE ONLY "public"."certification_audit_packages"
    ADD CONSTRAINT "certification_audit_packages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certification_evidence_links"
    ADD CONSTRAINT "certification_evidence_links_organization_id_requirement_id_key" UNIQUE ("organization_id", "requirement_id", "source_module", "source_table", "source_record_id");



ALTER TABLE ONLY "public"."certification_evidence_links"
    ADD CONSTRAINT "certification_evidence_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certification_frameworks"
    ADD CONSTRAINT "certification_frameworks_framework_code_key" UNIQUE ("framework_code");



ALTER TABLE ONLY "public"."certification_frameworks"
    ADD CONSTRAINT "certification_frameworks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certification_gap_analyses"
    ADD CONSTRAINT "certification_gap_analyses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certification_score_history"
    ADD CONSTRAINT "certification_score_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."circularity_targets"
    ADD CONSTRAINT "circularity_targets_organization_id_target_year_key" UNIQUE ("organization_id", "target_year");



ALTER TABLE ONLY "public"."circularity_targets"
    ADD CONSTRAINT "circularity_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contract_manufacturer_energy_inputs"
    ADD CONSTRAINT "contract_manufacturer_energy_inputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_overheads"
    ADD CONSTRAINT "corporate_overheads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."corporate_reports"
    ADD CONSTRAINT "corporate_reports_organization_id_year_key" UNIQUE ("organization_id", "year");



ALTER TABLE ONLY "public"."corporate_reports"
    ADD CONSTRAINT "corporate_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."dashboard_widgets"
    ADD CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."data_provenance_trail"
    ADD CONSTRAINT "data_provenance_trail_pkey" PRIMARY KEY ("provenance_id");



ALTER TABLE ONLY "public"."data_provenance_trail"
    ADD CONSTRAINT "data_provenance_trail_storage_object_path_key" UNIQUE ("storage_object_path");



ALTER TABLE ONLY "public"."data_provenance_verification_history"
    ADD CONSTRAINT "data_provenance_verification_history_pkey" PRIMARY KEY ("history_id");



ALTER TABLE ONLY "public"."defra_ecoinvent_impact_mappings"
    ADD CONSTRAINT "defra_ecoinvent_impact_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."defra_energy_emission_factors"
    ADD CONSTRAINT "defra_energy_emission_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ecoinvent_material_proxies"
    ADD CONSTRAINT "ecoinvent_material_proxies_material_category_key" UNIQUE ("material_category");



ALTER TABLE ONLY "public"."ecoinvent_material_proxies"
    ADD CONSTRAINT "ecoinvent_material_proxies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ef31_impact_categories"
    ADD CONSTRAINT "ef31_impact_categories_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."ef31_impact_categories"
    ADD CONSTRAINT "ef31_impact_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ef31_normalisation_factors"
    ADD CONSTRAINT "ef31_normalisation_factors_impact_category_code_reference_r_key" UNIQUE ("impact_category_code", "reference_region", "reference_year");



ALTER TABLE ONLY "public"."ef31_normalisation_factors"
    ADD CONSTRAINT "ef31_normalisation_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ef31_process_mappings"
    ADD CONSTRAINT "ef31_process_mappings_ecoinvent_process_uuid_ecoinvent_vers_key" UNIQUE ("ecoinvent_process_uuid", "ecoinvent_version");



ALTER TABLE ONLY "public"."ef31_process_mappings"
    ADD CONSTRAINT "ef31_process_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ef31_weighting_factors"
    ADD CONSTRAINT "ef31_weighting_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ef31_weighting_factors"
    ADD CONSTRAINT "ef31_weighting_factors_weighting_set_id_impact_category_cod_key" UNIQUE ("weighting_set_id", "impact_category_code");



ALTER TABLE ONLY "public"."ef31_weighting_sets"
    ADD CONSTRAINT "ef31_weighting_sets_name_organization_id_key" UNIQUE ("name", "organization_id");



ALTER TABLE ONLY "public"."ef31_weighting_sets"
    ADD CONSTRAINT "ef31_weighting_sets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emissions_calculation_context"
    ADD CONSTRAINT "emissions_calculation_context_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emissions_factors"
    ADD CONSTRAINT "emissions_factors_pkey" PRIMARY KEY ("factor_id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_activity_data"
    ADD CONSTRAINT "facility_activity_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_data_contracts"
    ADD CONSTRAINT "facility_data_contracts_facility_id_utility_type_key" UNIQUE ("facility_id", "utility_type");



ALTER TABLE ONLY "public"."facility_data_contracts"
    ADD CONSTRAINT "facility_data_contracts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_data_quality_snapshot"
    ADD CONSTRAINT "facility_data_quality_snapshot_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "facility_emissions_aggregated_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "facility_product_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_reporting_sessions"
    ADD CONSTRAINT "facility_reporting_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_types"
    ADD CONSTRAINT "facility_types_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."facility_types"
    ADD CONSTRAINT "facility_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_water_data"
    ADD CONSTRAINT "facility_water_data_facility_id_reporting_year_reporting_mo_key" UNIQUE ("facility_id", "reporting_year", "reporting_month");



ALTER TABLE ONLY "public"."facility_water_data"
    ADD CONSTRAINT "facility_water_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."facility_water_discharge_quality"
    ADD CONSTRAINT "facility_water_discharge_quality_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_messages"
    ADD CONSTRAINT "feedback_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_fuel_type_vehicle_category_calculate_key" UNIQUE ("fuel_type", "vehicle_category", "calculated_scope");



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."certification_framework_requirements"
    ADD CONSTRAINT "framework_requirements_framework_id_requirement_code_key" UNIQUE ("framework_id", "requirement_code");



ALTER TABLE ONLY "public"."framework_requirements"
    ADD CONSTRAINT "framework_requirements_framework_id_requirement_code_key1" UNIQUE ("framework_id", "requirement_code");



ALTER TABLE ONLY "public"."certification_framework_requirements"
    ADD CONSTRAINT "framework_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."framework_requirements"
    ADD CONSTRAINT "framework_requirements_pkey1" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gaia_analytics"
    ADD CONSTRAINT "gaia_analytics_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."gaia_analytics"
    ADD CONSTRAINT "gaia_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gaia_conversations"
    ADD CONSTRAINT "gaia_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gaia_feedback"
    ADD CONSTRAINT "gaia_feedback_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gaia_knowledge_base"
    ADD CONSTRAINT "gaia_knowledge_base_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."gaia_messages"
    ADD CONSTRAINT "gaia_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ghg_categories"
    ADD CONSTRAINT "ghg_categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."ghg_categories"
    ADD CONSTRAINT "ghg_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ghg_emissions"
    ADD CONSTRAINT "ghg_emissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_board_members"
    ADD CONSTRAINT "governance_board_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_ethics_records"
    ADD CONSTRAINT "governance_ethics_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_lobbying"
    ADD CONSTRAINT "governance_lobbying_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_mission"
    ADD CONSTRAINT "governance_mission_organization_id_key" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."governance_mission"
    ADD CONSTRAINT "governance_mission_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_policies"
    ADD CONSTRAINT "governance_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_policy_versions"
    ADD CONSTRAINT "governance_policy_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_scores"
    ADD CONSTRAINT "governance_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_stakeholder_engagements"
    ADD CONSTRAINT "governance_stakeholder_engagements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."governance_stakeholders"
    ADD CONSTRAINT "governance_stakeholders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."greenwash_assessment_claims"
    ADD CONSTRAINT "greenwash_assessment_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."greenwash_assessments"
    ADD CONSTRAINT "greenwash_assessments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredient_selection_audit"
    ADD CONSTRAINT "ingredient_selection_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_categories"
    ADD CONSTRAINT "knowledge_bank_categories_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."knowledge_bank_categories"
    ADD CONSTRAINT "knowledge_bank_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_favorites"
    ADD CONSTRAINT "knowledge_bank_favorites_item_id_user_id_key" UNIQUE ("item_id", "user_id");



ALTER TABLE ONLY "public"."knowledge_bank_favorites"
    ADD CONSTRAINT "knowledge_bank_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_item_tags"
    ADD CONSTRAINT "knowledge_bank_item_tags_item_id_tag_id_key" UNIQUE ("item_id", "tag_id");



ALTER TABLE ONLY "public"."knowledge_bank_item_tags"
    ADD CONSTRAINT "knowledge_bank_item_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_items"
    ADD CONSTRAINT "knowledge_bank_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_tags"
    ADD CONSTRAINT "knowledge_bank_tags_organization_id_name_key" UNIQUE ("organization_id", "name");



ALTER TABLE ONLY "public"."knowledge_bank_tags"
    ADD CONSTRAINT "knowledge_bank_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."knowledge_bank_views"
    ADD CONSTRAINT "knowledge_bank_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpi_data_points"
    ADD CONSTRAINT "kpi_data_points_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."kpis"
    ADD CONSTRAINT "kpis_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_life_cycle_stages"
    ADD CONSTRAINT "lca_life_cycle_stages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."lca_life_cycle_stages"
    ADD CONSTRAINT "lca_life_cycle_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_methodology_audit_log"
    ADD CONSTRAINT "lca_methodology_audit_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_production_mix"
    ADD CONSTRAINT "lca_production_mix_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_recalculation_batches"
    ADD CONSTRAINT "lca_recalculation_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_recalculation_queue"
    ADD CONSTRAINT "lca_recalculation_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_recalculation_queue"
    ADD CONSTRAINT "lca_recalculation_queue_product_lca_id_batch_id_key" UNIQUE ("product_lca_id", "batch_id");



ALTER TABLE ONLY "public"."lca_reports"
    ADD CONSTRAINT "lca_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_social_indicators"
    ADD CONSTRAINT "lca_social_indicators_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_stages"
    ADD CONSTRAINT "lca_stages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."lca_stages"
    ADD CONSTRAINT "lca_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_sub_stages"
    ADD CONSTRAINT "lca_sub_stages_lca_stage_id_name_key" UNIQUE ("lca_stage_id", "name");



ALTER TABLE ONLY "public"."lca_sub_stages"
    ADD CONSTRAINT "lca_sub_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lca_workflow_audit"
    ADD CONSTRAINT "lca_workflow_audit_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."openlca_configurations"
    ADD CONSTRAINT "openlca_configurations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."openlca_process_cache"
    ADD CONSTRAINT "openlca_process_cache_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_certifications"
    ADD CONSTRAINT "organization_certifications_organization_id_framework_id_key" UNIQUE ("organization_id", "framework_id");



ALTER TABLE ONLY "public"."organization_certifications"
    ADD CONSTRAINT "organization_certifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_user_id_key" UNIQUE ("organization_id", "user_id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_suppliers"
    ADD CONSTRAINT "organization_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_usage_log"
    ADD CONSTRAINT "organization_usage_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organization_vitality_scores"
    ADD CONSTRAINT "organization_vitality_scores_organization_id_year_calculati_key" UNIQUE ("organization_id", "year", "calculation_date");



ALTER TABLE ONLY "public"."organization_vitality_scores"
    ADD CONSTRAINT "organization_vitality_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."organizations"
    ADD CONSTRAINT "organizations_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."packaging_circularity_profiles"
    ADD CONSTRAINT "packaging_circularity_profile_organization_id_material_type_key" UNIQUE ("organization_id", "material_type", "material_name");



ALTER TABLE ONLY "public"."packaging_circularity_profiles"
    ADD CONSTRAINT "packaging_circularity_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."packaging_types"
    ADD CONSTRAINT "packaging_types_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."passport_views"
    ADD CONSTRAINT "passport_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_products"
    ADD CONSTRAINT "pending_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pending_suppliers"
    ADD CONSTRAINT "pending_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_benefits"
    ADD CONSTRAINT "people_benefits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_culture_scores"
    ADD CONSTRAINT "people_culture_scores_organization_id_reporting_year_calcul_key" UNIQUE ("organization_id", "reporting_year", "calculation_date");



ALTER TABLE ONLY "public"."people_culture_scores"
    ADD CONSTRAINT "people_culture_scores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_dei_actions"
    ADD CONSTRAINT "people_dei_actions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_employee_compensation"
    ADD CONSTRAINT "people_employee_compensation_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_employee_surveys"
    ADD CONSTRAINT "people_employee_surveys_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_living_wage_benchmarks"
    ADD CONSTRAINT "people_living_wage_benchmarks_country_region_city_source_ef_key" UNIQUE ("country", "region", "city", "source", "effective_from");



ALTER TABLE ONLY "public"."people_living_wage_benchmarks"
    ADD CONSTRAINT "people_living_wage_benchmarks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_survey_responses"
    ADD CONSTRAINT "people_survey_responses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_training_records"
    ADD CONSTRAINT "people_training_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."people_workforce_demographics"
    ADD CONSTRAINT "people_workforce_demographics_organization_id_dimension_cat_key" UNIQUE ("organization_id", "dimension", "category_value", "reporting_year", "reporting_quarter");



ALTER TABLE ONLY "public"."people_workforce_demographics"
    ADD CONSTRAINT "people_workforce_demographics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."permissions"
    ADD CONSTRAINT "permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_activity_log"
    ADD CONSTRAINT "platform_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_feature_usage"
    ADD CONSTRAINT "platform_feature_usage_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_feature_usage"
    ADD CONSTRAINT "platform_feature_usage_usage_date_feature_name_key" UNIQUE ("usage_date", "feature_name");



ALTER TABLE ONLY "public"."platform_organization_stats"
    ADD CONSTRAINT "platform_organization_stats_organization_id_stat_date_key" UNIQUE ("organization_id", "stat_date");



ALTER TABLE ONLY "public"."platform_organization_stats"
    ADD CONSTRAINT "platform_organization_stats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_supplier_products"
    ADD CONSTRAINT "platform_supplier_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_suppliers"
    ADD CONSTRAINT "platform_suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_usage_metrics"
    ADD CONSTRAINT "platform_usage_metrics_metric_date_key" UNIQUE ("metric_date");



ALTER TABLE ONLY "public"."platform_usage_metrics"
    ADD CONSTRAINT "platform_usage_metrics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_category_proxy_mappings"
    ADD CONSTRAINT "product_category_proxy_mappings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_end_of_life_scenarios"
    ADD CONSTRAINT "product_end_of_life_scenarios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_lca_calculation_logs"
    ADD CONSTRAINT "product_lca_calculation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_carbon_footprint_inputs"
    ADD CONSTRAINT "product_lca_inputs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_carbon_footprint_materials"
    ADD CONSTRAINT "product_lca_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "product_lca_production_sites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_carbon_footprint_results"
    ADD CONSTRAINT "product_lca_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_passport_token_key" UNIQUE ("passport_token");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_permission_id_key" UNIQUE ("role_id", "permission_id");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."roles"
    ADD CONSTRAINT "roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."scope_1_2_emission_sources"
    ADD CONSTRAINT "scope_1_2_emission_sources_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spend_category_patterns"
    ADD CONSTRAINT "spend_category_patterns_organization_id_pattern_key" UNIQUE ("organization_id", "pattern");



ALTER TABLE ONLY "public"."spend_category_patterns"
    ADD CONSTRAINT "spend_category_patterns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spend_import_batches"
    ADD CONSTRAINT "spend_import_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spend_import_items"
    ADD CONSTRAINT "spend_import_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staging_emission_factors"
    ADD CONSTRAINT "staging_emission_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tier_features"
    ADD CONSTRAINT "subscription_tier_features_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tier_features"
    ADD CONSTRAINT "subscription_tier_features_tier_name_feature_code_key" UNIQUE ("tier_name", "feature_code");



ALTER TABLE ONLY "public"."subscription_tier_limits"
    ADD CONSTRAINT "subscription_tier_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscription_tier_limits"
    ADD CONSTRAINT "subscription_tier_limits_tier_level_key" UNIQUE ("tier_level");



ALTER TABLE ONLY "public"."subscription_tier_limits"
    ADD CONSTRAINT "subscription_tier_limits_tier_name_key" UNIQUE ("tier_name");



ALTER TABLE ONLY "public"."supplier_data_submissions"
    ADD CONSTRAINT "supplier_data_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_engagements"
    ADD CONSTRAINT "supplier_engagements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_invitation_token_key" UNIQUE ("invitation_token");



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."supplier_products"
    ADD CONSTRAINT "supplier_products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "unique_active_advisor_access" UNIQUE ("advisor_user_id", "organization_id");



ALTER TABLE ONLY "public"."accredited_advisors"
    ADD CONSTRAINT "unique_advisor_user" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "unique_facility_period" UNIQUE ("facility_id", "reporting_period_start", "reporting_period_end");



COMMENT ON CONSTRAINT "unique_facility_period" ON "public"."facility_emissions_aggregated" IS 'Prevents duplicate calculations for the same facility and reporting period';



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "unique_facility_product_assignment" UNIQUE ("facility_id", "product_id");



ALTER TABLE ONLY "public"."defra_energy_emission_factors"
    ADD CONSTRAINT "unique_fuel_type_year" UNIQUE ("fuel_type", "factor_year", "geographic_scope");



ALTER TABLE ONLY "public"."openlca_configurations"
    ADD CONSTRAINT "unique_org_config" UNIQUE ("organization_id");



ALTER TABLE ONLY "public"."organization_suppliers"
    ADD CONSTRAINT "unique_org_supplier" UNIQUE ("organization_id", "platform_supplier_id");



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "unique_pcf_facility" UNIQUE ("product_carbon_footprint_id", "facility_id");



ALTER TABLE ONLY "public"."platform_suppliers"
    ADD CONSTRAINT "unique_supplier_name" UNIQUE ("name");



ALTER TABLE ONLY "public"."lca_production_mix"
    ADD CONSTRAINT "uq_production_mix_lca_facility" UNIQUE ("lca_id", "facility_id");



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_user_id_organization_id_widget_i_key" UNIQUE ("user_id", "organization_id", "widget_id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utility_data_entries"
    ADD CONSTRAINT "utility_data_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utility_fuel_type_mapping"
    ADD CONSTRAINT "utility_fuel_type_mapping_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."utility_fuel_type_mapping"
    ADD CONSTRAINT "utility_fuel_type_mapping_utility_type_key" UNIQUE ("utility_type");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_registration_number_key" UNIQUE ("registration_number");



ALTER TABLE ONLY "public"."vitality_score_snapshots"
    ADD CONSTRAINT "vitality_score_snapshots_organization_id_snapshot_date_key" UNIQUE ("organization_id", "snapshot_date");



ALTER TABLE ONLY "public"."vitality_score_snapshots"
    ADD CONSTRAINT "vitality_score_snapshots_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activity_data_activity_date" ON "public"."activity_data" USING "btree" ("activity_date");



CREATE INDEX "idx_activity_data_category" ON "public"."activity_data" USING "btree" ("category");



CREATE INDEX "idx_activity_data_facility_id" ON "public"."activity_data" USING "btree" ("facility_id");



CREATE INDEX "idx_activity_data_fuel_type" ON "public"."activity_data" USING "btree" ("fuel_type");



CREATE INDEX "idx_activity_data_organization_id" ON "public"."activity_data" USING "btree" ("organization_id");



CREATE INDEX "idx_activity_data_user_id" ON "public"."activity_data" USING "btree" ("user_id");



CREATE INDEX "idx_activity_log_created_at" ON "public"."activity_log" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_event_type" ON "public"."activity_log" USING "btree" ("event_type");



CREATE INDEX "idx_activity_log_org_timestamp" ON "public"."activity_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_organization_id" ON "public"."activity_log" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_packages_framework" ON "public"."certification_audit_packages" USING "btree" ("framework_id");



CREATE INDEX "idx_audit_packages_org" ON "public"."certification_audit_packages" USING "btree" ("organization_id");



CREATE INDEX "idx_audit_packages_status" ON "public"."certification_audit_packages" USING "btree" ("status");



CREATE INDEX "idx_aware_factors_country" ON "public"."aware_factors" USING "btree" ("country_code");



CREATE INDEX "idx_aware_factors_region" ON "public"."aware_factors" USING "btree" ("region");



CREATE INDEX "idx_benefits_active" ON "public"."people_benefits" USING "btree" ("is_active");



CREATE INDEX "idx_benefits_organization" ON "public"."people_benefits" USING "btree" ("organization_id");



CREATE INDEX "idx_blog_posts_author" ON "public"."blog_posts" USING "btree" ("author_id");



CREATE INDEX "idx_blog_posts_display_order" ON "public"."blog_posts" USING "btree" ("display_order" DESC, "created_at" DESC);



CREATE INDEX "idx_blog_posts_published_at" ON "public"."blog_posts" USING "btree" ("published_at" DESC);



CREATE INDEX "idx_blog_posts_slug" ON "public"."blog_posts" USING "btree" ("slug");



CREATE INDEX "idx_blog_posts_status" ON "public"."blog_posts" USING "btree" ("status");



CREATE INDEX "idx_blog_posts_tags" ON "public"."blog_posts" USING "gin" ("tags");



CREATE INDEX "idx_bom_extracted_items_bom_import_id" ON "public"."bom_extracted_items" USING "btree" ("bom_import_id");



CREATE INDEX "idx_bom_extracted_items_is_imported" ON "public"."bom_extracted_items" USING "btree" ("is_imported");



CREATE INDEX "idx_bom_extracted_items_item_type" ON "public"."bom_extracted_items" USING "btree" ("item_type");



CREATE INDEX "idx_bom_imports_organization_id" ON "public"."bom_imports" USING "btree" ("organization_id");



CREATE INDEX "idx_bom_imports_product_id" ON "public"."bom_imports" USING "btree" ("product_id");



CREATE INDEX "idx_bom_imports_status" ON "public"."bom_imports" USING "btree" ("status");



CREATE INDEX "idx_bulk_import_sessions_created_by" ON "public"."bulk_import_sessions" USING "btree" ("created_by");



CREATE INDEX "idx_bulk_import_sessions_org" ON "public"."bulk_import_sessions" USING "btree" ("organization_id");



CREATE INDEX "idx_bulk_import_sessions_status" ON "public"."bulk_import_sessions" USING "btree" ("status");



CREATE INDEX "idx_calculated_emissions_activity_data_id" ON "public"."calculated_emissions" USING "btree" ("activity_data_id");



CREATE INDEX "idx_calculated_emissions_calculation_timestamp" ON "public"."calculated_emissions" USING "btree" ("calculation_timestamp");



CREATE INDEX "idx_calculated_emissions_emissions_factor_id" ON "public"."calculated_emissions" USING "btree" ("emissions_factor_id");



CREATE INDEX "idx_calculated_emissions_impact_metrics" ON "public"."calculated_emissions" USING "gin" ("impact_metrics");



CREATE INDEX "idx_calculated_emissions_org_activity" ON "public"."calculated_emissions" USING "btree" ("organization_id", "activity_data_id");



CREATE INDEX "idx_calculated_emissions_organization_id" ON "public"."calculated_emissions" USING "btree" ("organization_id");



CREATE INDEX "idx_calculated_metrics_activity_data_id" ON "public"."calculated_metrics" USING "btree" ("activity_data_id");



CREATE INDEX "idx_calculated_metrics_metric_type" ON "public"."calculated_metrics" USING "btree" ("metric_type");



CREATE INDEX "idx_calculated_metrics_organization_id" ON "public"."calculated_metrics" USING "btree" ("organization_id");



CREATE INDEX "idx_calculated_metrics_source_log_id" ON "public"."calculated_metrics" USING "btree" ("source_log_id");



CREATE INDEX "idx_calculation_logs_calculation_id" ON "public"."calculation_logs" USING "btree" ("calculation_id");



CREATE INDEX "idx_calculation_logs_csrd_compliant" ON "public"."product_lca_calculation_logs" USING "btree" ("csrd_compliant") WHERE ("csrd_compliant" = true);



CREATE INDEX "idx_calculation_logs_data_quality_tier" ON "public"."calculation_logs" USING "btree" ("data_quality_tier");



CREATE INDEX "idx_calculation_logs_factor_ids" ON "public"."calculation_logs" USING "gin" ("factor_ids_used");



CREATE INDEX "idx_calculation_logs_impact_metrics" ON "public"."product_lca_calculation_logs" USING "gin" ("impact_metrics");



CREATE INDEX "idx_calculation_logs_input_data" ON "public"."calculation_logs" USING "gin" ("input_data");



CREATE INDEX "idx_calculation_logs_location" ON "public"."product_lca_calculation_logs" USING "btree" ("location_country_code") WHERE ("location_country_code" IS NOT NULL);



CREATE INDEX "idx_calculation_logs_methodology" ON "public"."calculation_logs" USING "btree" ("methodology_version");



CREATE INDEX "idx_calculation_logs_org_created" ON "public"."calculation_logs" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_calculation_logs_organization_id" ON "public"."calculation_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_calculation_logs_output_uncertainty" ON "public"."calculation_logs" USING "btree" ("output_uncertainty") WHERE ("output_uncertainty" IS NOT NULL);



CREATE INDEX "idx_calculation_logs_user_id" ON "public"."calculation_logs" USING "btree" ("user_id");



CREATE INDEX "idx_cert_framework_req_category" ON "public"."certification_framework_requirements" USING "btree" ("requirement_category");



CREATE INDEX "idx_cert_framework_req_framework" ON "public"."certification_framework_requirements" USING "btree" ("framework_id");



CREATE INDEX "idx_cert_framework_req_parent" ON "public"."certification_framework_requirements" USING "btree" ("parent_requirement_id");



CREATE INDEX "idx_cert_score_history_framework" ON "public"."certification_score_history" USING "btree" ("framework_id");



CREATE INDEX "idx_cert_score_history_org" ON "public"."certification_score_history" USING "btree" ("organization_id");



CREATE INDEX "idx_cm_allocations_proxy_data" ON "public"."contract_manufacturer_allocations" USING "btree" ("uses_proxy_data");



CREATE INDEX "idx_cma_facility_id" ON "public"."contract_manufacturer_allocations" USING "btree" ("facility_id");



CREATE INDEX "idx_cma_org_product_facility" ON "public"."contract_manufacturer_allocations" USING "btree" ("organization_id", "product_id", "facility_id");



CREATE INDEX "idx_cma_organization_id" ON "public"."contract_manufacturer_allocations" USING "btree" ("organization_id");



CREATE INDEX "idx_cma_product_id" ON "public"."contract_manufacturer_allocations" USING "btree" ("product_id");



CREATE INDEX "idx_cma_reporting_period" ON "public"."contract_manufacturer_allocations" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_cma_status" ON "public"."contract_manufacturer_allocations" USING "btree" ("status");



CREATE UNIQUE INDEX "idx_cma_unique_period_product_facility" ON "public"."contract_manufacturer_allocations" USING "btree" ("product_id", "facility_id", "reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_cmei_allocation_id" ON "public"."contract_manufacturer_energy_inputs" USING "btree" ("allocation_id");



CREATE INDEX "idx_compensation_active" ON "public"."people_employee_compensation" USING "btree" ("is_active");



CREATE INDEX "idx_compensation_organization" ON "public"."people_employee_compensation" USING "btree" ("organization_id");



CREATE INDEX "idx_compensation_year" ON "public"."people_employee_compensation" USING "btree" ("reporting_year");



CREATE INDEX "idx_corporate_overheads_asset_type" ON "public"."corporate_overheads" USING "btree" ("asset_type");



CREATE INDEX "idx_corporate_overheads_cabin_class" ON "public"."corporate_overheads" USING "btree" ("cabin_class");



CREATE INDEX "idx_corporate_overheads_category" ON "public"."corporate_overheads" USING "btree" ("category");



CREATE INDEX "idx_corporate_overheads_destination_location" ON "public"."corporate_overheads" USING "btree" ("destination_location");



CREATE INDEX "idx_corporate_overheads_disposal_method" ON "public"."corporate_overheads" USING "btree" ("disposal_method");



CREATE INDEX "idx_corporate_overheads_distance_source" ON "public"."corporate_overheads" USING "btree" ("distance_source");



CREATE INDEX "idx_corporate_overheads_entry_date" ON "public"."corporate_overheads" USING "btree" ("entry_date");



CREATE INDEX "idx_corporate_overheads_origin_location" ON "public"."corporate_overheads" USING "btree" ("origin_location");



CREATE INDEX "idx_corporate_overheads_passenger_count" ON "public"."corporate_overheads" USING "btree" ("passenger_count");



CREATE INDEX "idx_corporate_overheads_report_category" ON "public"."corporate_overheads" USING "btree" ("report_id", "category");



CREATE INDEX "idx_corporate_overheads_report_id" ON "public"."corporate_overheads" USING "btree" ("report_id");



CREATE INDEX "idx_corporate_overheads_transport_mode" ON "public"."corporate_overheads" USING "btree" ("transport_mode");



CREATE INDEX "idx_corporate_reports_organization_id" ON "public"."corporate_reports" USING "btree" ("organization_id");



CREATE INDEX "idx_corporate_reports_status" ON "public"."corporate_reports" USING "btree" ("status");



CREATE INDEX "idx_corporate_reports_year" ON "public"."corporate_reports" USING "btree" ("year");



CREATE INDEX "idx_ct_organization" ON "public"."circularity_targets" USING "btree" ("organization_id");



CREATE INDEX "idx_ct_year" ON "public"."circularity_targets" USING "btree" ("target_year");



CREATE INDEX "idx_data_contracts_facility_id" ON "public"."facility_data_contracts" USING "btree" ("facility_id");



CREATE INDEX "idx_data_provenance_created_at" ON "public"."data_provenance_trail" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_data_provenance_document_type" ON "public"."data_provenance_trail" USING "btree" ("document_type");



CREATE INDEX "idx_data_provenance_org_doctype" ON "public"."data_provenance_trail" USING "btree" ("organization_id", "document_type");



CREATE INDEX "idx_data_provenance_org_status" ON "public"."data_provenance_trail" USING "btree" ("organization_id", "verification_status");



CREATE INDEX "idx_data_provenance_organization_id" ON "public"."data_provenance_trail" USING "btree" ("organization_id");



CREATE INDEX "idx_data_provenance_storage_path" ON "public"."data_provenance_trail" USING "btree" ("storage_object_path");



CREATE INDEX "idx_data_provenance_user_id" ON "public"."data_provenance_trail" USING "btree" ("user_id");



CREATE INDEX "idx_defra_ecoinvent_mappings_cat_quality" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_category", "mapping_quality");



CREATE INDEX "idx_defra_ecoinvent_mappings_category" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_category");



CREATE INDEX "idx_defra_ecoinvent_mappings_confidence" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("confidence_score");



CREATE INDEX "idx_defra_ecoinvent_mappings_factor_name" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_factor_name");



CREATE INDEX "idx_defra_ecoinvent_mappings_scope" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_scope");



CREATE INDEX "idx_defra_ef_factor_year" ON "public"."defra_energy_emission_factors" USING "btree" ("factor_year");



CREATE INDEX "idx_defra_ef_fuel_type" ON "public"."defra_energy_emission_factors" USING "btree" ("fuel_type");



CREATE INDEX "idx_defra_ef_fuel_year" ON "public"."defra_energy_emission_factors" USING "btree" ("fuel_type", "factor_year");



CREATE INDEX "idx_defra_mappings_category" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_category");



CREATE INDEX "idx_defra_mappings_factor_name" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("defra_factor_name");



CREATE INDEX "idx_defra_mappings_quality" ON "public"."defra_ecoinvent_impact_mappings" USING "btree" ("mapping_quality");



CREATE INDEX "idx_dei_organization" ON "public"."people_dei_actions" USING "btree" ("organization_id");



CREATE INDEX "idx_dei_status" ON "public"."people_dei_actions" USING "btree" ("status");



CREATE INDEX "idx_dei_year" ON "public"."people_dei_actions" USING "btree" ("reporting_year");



CREATE INDEX "idx_demographics_dimension" ON "public"."people_workforce_demographics" USING "btree" ("dimension");



CREATE INDEX "idx_demographics_organization" ON "public"."people_workforce_demographics" USING "btree" ("organization_id");



CREATE INDEX "idx_demographics_year" ON "public"."people_workforce_demographics" USING "btree" ("reporting_year");



CREATE INDEX "idx_ecc_facility" ON "public"."emissions_calculation_context" USING "btree" ("facility_id", "is_current");



CREATE INDEX "idx_ecc_org" ON "public"."emissions_calculation_context" USING "btree" ("organization_id");



CREATE INDEX "idx_ecc_period" ON "public"."emissions_calculation_context" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_ecoinvent_proxies_category" ON "public"."ecoinvent_material_proxies" USING "btree" ("material_category");



CREATE INDEX "idx_ecoinvent_proxies_geography" ON "public"."ecoinvent_material_proxies" USING "btree" ("geography");



CREATE INDEX "idx_ecoinvent_proxies_name" ON "public"."ecoinvent_material_proxies" USING "btree" ("material_name");



CREATE INDEX "idx_ef31_process_mappings_staging_factor" ON "public"."ef31_process_mappings" USING "btree" ("staging_factor_id") WHERE ("staging_factor_id" IS NOT NULL);



CREATE INDEX "idx_ef31_process_mappings_uuid" ON "public"."ef31_process_mappings" USING "btree" ("ecoinvent_process_uuid");



CREATE INDEX "idx_emissions_factors_cabin_class" ON "public"."emissions_factors" USING "btree" ("cabin_class");



CREATE INDEX "idx_emissions_factors_category" ON "public"."emissions_factors" USING "btree" ("category");



CREATE INDEX "idx_emissions_factors_category_type" ON "public"."emissions_factors" USING "btree" ("category_type");



CREATE INDEX "idx_emissions_factors_category_type_name" ON "public"."emissions_factors" USING "btree" ("category", "type", "name");



CREATE INDEX "idx_emissions_factors_category_type_year" ON "public"."emissions_factors" USING "btree" ("category", "type", "year_of_publication" DESC);



CREATE INDEX "idx_emissions_factors_fleet" ON "public"."emissions_factors" USING "btree" ("vehicle_class", "propulsion_type", "fuel_type");



CREATE INDEX "idx_emissions_factors_geographic_scope" ON "public"."emissions_factors" USING "btree" ("geographic_scope");



CREATE INDEX "idx_emissions_factors_manufacturing_proxy" ON "public"."emissions_factors" USING "btree" ("category", "subcategory") WHERE ("category" = 'Manufacturing_Proxy'::"text");



CREATE INDEX "idx_emissions_factors_material_type" ON "public"."emissions_factors" USING "btree" ("material_type");



CREATE INDEX "idx_emissions_factors_name" ON "public"."emissions_factors" USING "btree" ("name");



CREATE INDEX "idx_emissions_factors_propulsion_type" ON "public"."emissions_factors" USING "btree" ("propulsion_type");



CREATE INDEX "idx_emissions_factors_region" ON "public"."emissions_factors" USING "btree" ("region");



CREATE INDEX "idx_emissions_factors_source" ON "public"."emissions_factors" USING "btree" ("source");



CREATE INDEX "idx_emissions_factors_travel_class" ON "public"."emissions_factors" USING "btree" ("travel_class");



CREATE INDEX "idx_emissions_factors_type" ON "public"."emissions_factors" USING "btree" ("type");



CREATE INDEX "idx_emissions_factors_uncertainty" ON "public"."emissions_factors" USING "btree" ("uncertainty_percentage") WHERE ("uncertainty_percentage" > (0)::numeric);



CREATE INDEX "idx_emissions_factors_vehicle_class" ON "public"."emissions_factors" USING "btree" ("vehicle_class");



CREATE INDEX "idx_emissions_factors_year" ON "public"."emissions_factors" USING "btree" ("year_of_publication");



CREATE INDEX "idx_evidence_links_org" ON "public"."certification_evidence_links" USING "btree" ("organization_id");



CREATE INDEX "idx_evidence_links_requirement" ON "public"."certification_evidence_links" USING "btree" ("requirement_id");



CREATE INDEX "idx_evidence_links_source" ON "public"."certification_evidence_links" USING "btree" ("source_module", "source_table");



CREATE INDEX "idx_facilities_coordinates" ON "public"."facilities" USING "btree" ("latitude", "longitude") WHERE (("latitude" IS NOT NULL) AND ("longitude" IS NOT NULL));



CREATE INDEX "idx_facilities_country_code" ON "public"."facilities" USING "btree" ("location_country_code") WHERE ("location_country_code" IS NOT NULL);



CREATE INDEX "idx_facilities_location" ON "public"."facilities" USING "btree" ("location_country_code") WHERE ("location_country_code" IS NOT NULL);



CREATE INDEX "idx_facilities_organization_id" ON "public"."facilities" USING "btree" ("organization_id");



CREATE INDEX "idx_facility_activity_data_emission_source_id" ON "public"."facility_activity_data" USING "btree" ("emission_source_id");



CREATE INDEX "idx_facility_activity_data_facility_id" ON "public"."facility_activity_data" USING "btree" ("facility_id");



CREATE INDEX "idx_facility_activity_data_migrated" ON "public"."facility_activity_data" USING "btree" ("migrated_to_fleet") WHERE ("migrated_to_fleet" = true);



CREATE INDEX "idx_facility_activity_data_org_id" ON "public"."facility_activity_data" USING "btree" ("organization_id");



CREATE INDEX "idx_facility_activity_data_reporting_period" ON "public"."facility_activity_data" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_facility_emissions_agg_calc_date" ON "public"."facility_emissions_aggregated" USING "btree" ("calculation_date" DESC);



CREATE INDEX "idx_facility_emissions_agg_facility_id" ON "public"."facility_emissions_aggregated" USING "btree" ("facility_id");



CREATE INDEX "idx_facility_emissions_agg_org_id" ON "public"."facility_emissions_aggregated" USING "btree" ("organization_id");



CREATE INDEX "idx_facility_emissions_agg_period" ON "public"."facility_emissions_aggregated" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_facility_emissions_agg_results_payload" ON "public"."facility_emissions_aggregated" USING "gin" ("results_payload");



CREATE INDEX "idx_facility_reporting_sessions_facility" ON "public"."facility_reporting_sessions" USING "btree" ("facility_id");



CREATE INDEX "idx_facility_reporting_sessions_organization" ON "public"."facility_reporting_sessions" USING "btree" ("organization_id");



CREATE INDEX "idx_facility_reporting_sessions_period" ON "public"."facility_reporting_sessions" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_facility_water_data_facility_id" ON "public"."facility_water_data" USING "btree" ("facility_id");



CREATE INDEX "idx_facility_water_data_org_id" ON "public"."facility_water_data" USING "btree" ("organization_id");



CREATE INDEX "idx_facility_water_data_period" ON "public"."facility_water_data" USING "btree" ("reporting_year", "reporting_month");



CREATE INDEX "idx_facility_water_data_risk" ON "public"."facility_water_data" USING "btree" ("risk_level");



CREATE INDEX "idx_fae_category" ON "public"."facility_activity_entries" USING "btree" ("activity_category");



CREATE INDEX "idx_fae_facility_date" ON "public"."facility_activity_entries" USING "btree" ("facility_id", "activity_date");



CREATE INDEX "idx_fae_org_period" ON "public"."facility_activity_entries" USING "btree" ("organization_id", "reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_fae_provenance" ON "public"."facility_activity_entries" USING "btree" ("data_provenance");



CREATE INDEX "idx_fdqs_date" ON "public"."facility_data_quality_snapshot" USING "btree" ("snapshot_year", "snapshot_month");



CREATE INDEX "idx_fdqs_facility" ON "public"."facility_data_quality_snapshot" USING "btree" ("facility_id");



CREATE INDEX "idx_fdqs_org" ON "public"."facility_data_quality_snapshot" USING "btree" ("organization_id");



CREATE INDEX "idx_fdqs_rating" ON "public"."facility_data_quality_snapshot" USING "btree" ("confidence_rating");



CREATE INDEX "idx_feedback_messages_created_at" ON "public"."feedback_messages" USING "btree" ("created_at");



CREATE INDEX "idx_feedback_messages_is_read" ON "public"."feedback_messages" USING "btree" ("is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_feedback_messages_sender_id" ON "public"."feedback_messages" USING "btree" ("sender_id");



CREATE INDEX "idx_feedback_messages_ticket_id" ON "public"."feedback_messages" USING "btree" ("ticket_id");



CREATE INDEX "idx_feedback_tickets_category" ON "public"."feedback_tickets" USING "btree" ("category");



CREATE INDEX "idx_feedback_tickets_created_at" ON "public"."feedback_tickets" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_feedback_tickets_created_by" ON "public"."feedback_tickets" USING "btree" ("created_by");



CREATE INDEX "idx_feedback_tickets_org_id" ON "public"."feedback_tickets" USING "btree" ("organization_id");



CREATE INDEX "idx_feedback_tickets_status" ON "public"."feedback_tickets" USING "btree" ("status");



CREATE INDEX "idx_feedback_tickets_unresolved" ON "public"."feedback_tickets" USING "btree" ("created_at") WHERE ("status" <> ALL (ARRAY['resolved'::"text", 'closed'::"text"]));



CREATE INDEX "idx_fleet_activities_activity_date" ON "public"."fleet_activities" USING "btree" ("activity_date");



CREATE INDEX "idx_fleet_activities_created_by" ON "public"."fleet_activities" USING "btree" ("created_by");



CREATE INDEX "idx_fleet_activities_facility_id" ON "public"."fleet_activities" USING "btree" ("facility_id");



CREATE INDEX "idx_fleet_activities_method" ON "public"."fleet_activities" USING "btree" ("organization_id", "data_entry_method");



CREATE INDEX "idx_fleet_activities_org_date" ON "public"."fleet_activities" USING "btree" ("organization_id", "activity_date" DESC);



CREATE INDEX "idx_fleet_activities_organization_id" ON "public"."fleet_activities" USING "btree" ("organization_id");



CREATE INDEX "idx_fleet_activities_period" ON "public"."fleet_activities" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_fleet_activities_scope" ON "public"."fleet_activities" USING "btree" ("scope");



CREATE INDEX "idx_fleet_activities_vehicle_id" ON "public"."fleet_activities" USING "btree" ("vehicle_id");



CREATE INDEX "idx_fleet_emission_sources_fuel_category" ON "public"."fleet_emission_sources" USING "btree" ("fuel_type", "vehicle_category");



CREATE INDEX "idx_fleet_emission_sources_scope" ON "public"."fleet_emission_sources" USING "btree" ("calculated_scope");



CREATE INDEX "idx_fpa_facility_id" ON "public"."facility_product_assignments" USING "btree" ("facility_id");



CREATE INDEX "idx_fpa_organization_id" ON "public"."facility_product_assignments" USING "btree" ("organization_id");



CREATE INDEX "idx_fpa_product_id" ON "public"."facility_product_assignments" USING "btree" ("product_id");



CREATE INDEX "idx_framework_requirements_category" ON "public"."framework_requirements" USING "btree" ("requirement_category");



CREATE INDEX "idx_framework_requirements_framework" ON "public"."framework_requirements" USING "btree" ("framework_id");



CREATE INDEX "idx_framework_requirements_parent" ON "public"."framework_requirements" USING "btree" ("parent_requirement_id");



CREATE INDEX "idx_gaia_analytics_date" ON "public"."gaia_analytics" USING "btree" ("date" DESC);



CREATE INDEX "idx_gaia_conversations_org_id" ON "public"."gaia_conversations" USING "btree" ("organization_id");



CREATE INDEX "idx_gaia_conversations_updated_at" ON "public"."gaia_conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_gaia_conversations_user_id" ON "public"."gaia_conversations" USING "btree" ("user_id");



CREATE INDEX "idx_gaia_feedback_message_id" ON "public"."gaia_feedback" USING "btree" ("message_id");



CREATE INDEX "idx_gaia_feedback_rating" ON "public"."gaia_feedback" USING "btree" ("rating");



CREATE INDEX "idx_gaia_feedback_reviewed" ON "public"."gaia_feedback" USING "btree" ("reviewed_at") WHERE ("reviewed_at" IS NULL);



CREATE INDEX "idx_gaia_knowledge_base_active" ON "public"."gaia_knowledge_base" USING "btree" ("is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_gaia_knowledge_base_category" ON "public"."gaia_knowledge_base" USING "btree" ("category");



CREATE INDEX "idx_gaia_knowledge_base_type" ON "public"."gaia_knowledge_base" USING "btree" ("entry_type");



CREATE INDEX "idx_gaia_messages_conversation_id" ON "public"."gaia_messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_gaia_messages_created_at" ON "public"."gaia_messages" USING "btree" ("created_at");



CREATE INDEX "idx_gap_analyses_framework" ON "public"."certification_gap_analyses" USING "btree" ("framework_id");



CREATE INDEX "idx_gap_analyses_org" ON "public"."certification_gap_analyses" USING "btree" ("organization_id");



CREATE INDEX "idx_gap_analyses_requirement" ON "public"."certification_gap_analyses" USING "btree" ("requirement_id");



CREATE INDEX "idx_gap_analyses_status" ON "public"."certification_gap_analyses" USING "btree" ("compliance_status");



CREATE INDEX "idx_generated_reports_created_at" ON "public"."generated_reports" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_generated_reports_created_by" ON "public"."generated_reports" USING "btree" ("created_by");



CREATE INDEX "idx_generated_reports_latest" ON "public"."generated_reports" USING "btree" ("is_latest") WHERE ("is_latest" = true);



CREATE INDEX "idx_generated_reports_org_id" ON "public"."generated_reports" USING "btree" ("organization_id");



CREATE INDEX "idx_generated_reports_org_year" ON "public"."generated_reports" USING "btree" ("organization_id", "report_year" DESC);



CREATE INDEX "idx_generated_reports_parent_version" ON "public"."generated_reports" USING "btree" ("parent_report_id", "version" DESC) WHERE ("parent_report_id" IS NOT NULL);



CREATE INDEX "idx_generated_reports_status" ON "public"."generated_reports" USING "btree" ("status") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_ghg_categories_scope" ON "public"."ghg_categories" USING "btree" ("scope");



CREATE INDEX "idx_ghg_emissions_category_id" ON "public"."ghg_emissions" USING "btree" ("category_id");



CREATE INDEX "idx_ghg_emissions_org_period" ON "public"."ghg_emissions" USING "btree" ("organization_id", "reporting_period");



CREATE INDEX "idx_ghg_emissions_organization_id" ON "public"."ghg_emissions" USING "btree" ("organization_id");



CREATE INDEX "idx_ghg_emissions_recorded_date" ON "public"."ghg_emissions" USING "btree" ("recorded_date" DESC);



CREATE INDEX "idx_ghg_emissions_reporting_period" ON "public"."ghg_emissions" USING "btree" ("reporting_period");



CREATE INDEX "idx_governance_board_current" ON "public"."governance_board_members" USING "btree" ("is_current");



CREATE INDEX "idx_governance_board_org" ON "public"."governance_board_members" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_engagements_date" ON "public"."governance_stakeholder_engagements" USING "btree" ("engagement_date");



CREATE INDEX "idx_governance_engagements_org" ON "public"."governance_stakeholder_engagements" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_engagements_stakeholder" ON "public"."governance_stakeholder_engagements" USING "btree" ("stakeholder_id");



CREATE INDEX "idx_governance_ethics_org" ON "public"."governance_ethics_records" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_ethics_type" ON "public"."governance_ethics_records" USING "btree" ("record_type");



CREATE INDEX "idx_governance_lobbying_org" ON "public"."governance_lobbying" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_lobbying_type" ON "public"."governance_lobbying" USING "btree" ("activity_type");



CREATE INDEX "idx_governance_mission_org" ON "public"."governance_mission" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_policies_org" ON "public"."governance_policies" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_policies_status" ON "public"."governance_policies" USING "btree" ("status");



CREATE INDEX "idx_governance_policies_type" ON "public"."governance_policies" USING "btree" ("policy_type");



CREATE INDEX "idx_governance_policy_versions_policy" ON "public"."governance_policy_versions" USING "btree" ("policy_id");



CREATE INDEX "idx_governance_scores_org" ON "public"."governance_scores" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_stakeholders_org" ON "public"."governance_stakeholders" USING "btree" ("organization_id");



CREATE INDEX "idx_governance_stakeholders_type" ON "public"."governance_stakeholders" USING "btree" ("stakeholder_type");



CREATE INDEX "idx_greenwash_assessments_created_at" ON "public"."greenwash_assessments" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_greenwash_assessments_created_by" ON "public"."greenwash_assessments" USING "btree" ("created_by");



CREATE INDEX "idx_greenwash_assessments_org_id" ON "public"."greenwash_assessments" USING "btree" ("organization_id");



CREATE INDEX "idx_greenwash_assessments_status" ON "public"."greenwash_assessments" USING "btree" ("status");



CREATE INDEX "idx_greenwash_claims_assessment_id" ON "public"."greenwash_assessment_claims" USING "btree" ("assessment_id");



CREATE INDEX "idx_greenwash_claims_risk_level" ON "public"."greenwash_assessment_claims" USING "btree" ("risk_level");



CREATE INDEX "idx_ingredient_audit_data_source" ON "public"."ingredient_selection_audit" USING "btree" ("data_source");



CREATE INDEX "idx_ingredient_audit_lca" ON "public"."ingredient_selection_audit" USING "btree" ("product_lca_id");



CREATE INDEX "idx_ingredient_audit_org_lca" ON "public"."ingredient_selection_audit" USING "btree" ("organization_id", "product_lca_id");



CREATE INDEX "idx_ingredient_audit_organization" ON "public"."ingredient_selection_audit" USING "btree" ("organization_id");



CREATE INDEX "idx_ingredient_audit_timestamp" ON "public"."ingredient_selection_audit" USING "btree" ("confirmation_timestamp" DESC);



CREATE INDEX "idx_ingredient_audit_user" ON "public"."ingredient_selection_audit" USING "btree" ("user_id");



CREATE INDEX "idx_ingredients_lca_sub_stage_id" ON "public"."ingredients" USING "btree" ("lca_sub_stage_id");



CREATE INDEX "idx_kb_categories_org" ON "public"."knowledge_bank_categories" USING "btree" ("organization_id");



CREATE INDEX "idx_kb_categories_sort" ON "public"."knowledge_bank_categories" USING "btree" ("organization_id", "sort_order");



CREATE INDEX "idx_kb_favorites_item" ON "public"."knowledge_bank_favorites" USING "btree" ("item_id");



CREATE INDEX "idx_kb_favorites_user" ON "public"."knowledge_bank_favorites" USING "btree" ("user_id");



CREATE INDEX "idx_kb_item_tags_item" ON "public"."knowledge_bank_item_tags" USING "btree" ("item_id");



CREATE INDEX "idx_kb_item_tags_tag" ON "public"."knowledge_bank_item_tags" USING "btree" ("tag_id");



CREATE INDEX "idx_kb_items_author" ON "public"."knowledge_bank_items" USING "btree" ("author_id");



CREATE INDEX "idx_kb_items_category" ON "public"."knowledge_bank_items" USING "btree" ("category_id");



CREATE INDEX "idx_kb_items_created" ON "public"."knowledge_bank_items" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_kb_items_org" ON "public"."knowledge_bank_items" USING "btree" ("organization_id");



CREATE INDEX "idx_kb_items_status" ON "public"."knowledge_bank_items" USING "btree" ("status");



CREATE INDEX "idx_kb_items_views" ON "public"."knowledge_bank_items" USING "btree" ("view_count" DESC);



CREATE INDEX "idx_kb_tags_org" ON "public"."knowledge_bank_tags" USING "btree" ("organization_id");



CREATE INDEX "idx_kb_views_date" ON "public"."knowledge_bank_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_kb_views_item" ON "public"."knowledge_bank_views" USING "btree" ("item_id");



CREATE INDEX "idx_kb_views_user" ON "public"."knowledge_bank_views" USING "btree" ("user_id");



CREATE INDEX "idx_kpi_data_points_kpi_date" ON "public"."kpi_data_points" USING "btree" ("kpi_id", "recorded_date" DESC);



CREATE INDEX "idx_kpi_data_points_kpi_id" ON "public"."kpi_data_points" USING "btree" ("kpi_id");



CREATE INDEX "idx_kpi_data_points_recorded_date" ON "public"."kpi_data_points" USING "btree" ("recorded_date" DESC);



CREATE INDEX "idx_kpis_organization_id" ON "public"."kpis" USING "btree" ("organization_id");



CREATE INDEX "idx_lca_calc_logs_created" ON "public"."product_lca_calculation_logs" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lca_calc_logs_environment" ON "public"."product_lca_calculation_logs" USING "btree" ("environment");



CREATE INDEX "idx_lca_calc_logs_lca_id" ON "public"."product_lca_calculation_logs" USING "btree" ("product_lca_id");



CREATE INDEX "idx_lca_calc_logs_status" ON "public"."product_lca_calculation_logs" USING "btree" ("status");



CREATE INDEX "idx_lca_production_mix_facility_id" ON "public"."lca_production_mix" USING "btree" ("facility_id");



CREATE INDEX "idx_lca_production_mix_lca_id" ON "public"."lca_production_mix" USING "btree" ("lca_id");



CREATE INDEX "idx_lca_reports_organization_id" ON "public"."lca_reports" USING "btree" ("organization_id");



CREATE INDEX "idx_lca_reports_product_id" ON "public"."lca_reports" USING "btree" ("product_id");



CREATE INDEX "idx_lca_reports_status" ON "public"."lca_reports" USING "btree" ("status");



CREATE INDEX "idx_lca_social_indicators_report_id" ON "public"."lca_social_indicators" USING "btree" ("report_id");



CREATE INDEX "idx_lca_social_indicators_risk_level" ON "public"."lca_social_indicators" USING "btree" ("risk_level");



CREATE INDEX "idx_lca_stages_display_order" ON "public"."lca_life_cycle_stages" USING "btree" ("display_order");



CREATE INDEX "idx_lca_sub_stages_display_order" ON "public"."lca_sub_stages" USING "btree" ("display_order");



CREATE INDEX "idx_lca_workflow_audit_created_at" ON "public"."lca_workflow_audit" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_lca_workflow_audit_lca_id" ON "public"."lca_workflow_audit" USING "btree" ("product_lca_id");



CREATE INDEX "idx_lca_workflow_audit_user_id" ON "public"."lca_workflow_audit" USING "btree" ("user_id");



CREATE INDEX "idx_living_wage_country" ON "public"."people_living_wage_benchmarks" USING "btree" ("country");



CREATE INDEX "idx_living_wage_current" ON "public"."people_living_wage_benchmarks" USING "btree" ("is_current") WHERE ("is_current" = true);



CREATE INDEX "idx_methodology_audit_org" ON "public"."lca_methodology_audit_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_methodology_audit_user" ON "public"."lca_methodology_audit_log" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_openlca_cache_created_at" ON "public"."openlca_process_cache" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "idx_openlca_cache_search_term" ON "public"."openlca_process_cache" USING "btree" ("search_term");



CREATE INDEX "idx_openlca_config_enabled" ON "public"."openlca_configurations" USING "btree" ("enabled") WHERE ("enabled" = true);



CREATE INDEX "idx_openlca_config_org_id" ON "public"."openlca_configurations" USING "btree" ("organization_id");



CREATE INDEX "idx_org_certifications_framework" ON "public"."organization_certifications" USING "btree" ("framework_id");



CREATE INDEX "idx_org_certifications_org" ON "public"."organization_certifications" USING "btree" ("organization_id");



CREATE INDEX "idx_org_certifications_status" ON "public"."organization_certifications" USING "btree" ("status");



CREATE INDEX "idx_org_suppliers_org" ON "public"."organization_suppliers" USING "btree" ("organization_id");



CREATE INDEX "idx_org_suppliers_supplier" ON "public"."organization_suppliers" USING "btree" ("platform_supplier_id");



CREATE INDEX "idx_organizations_stripe_customer_id" ON "public"."organizations" USING "btree" ("stripe_customer_id") WHERE ("stripe_customer_id" IS NOT NULL);



CREATE INDEX "idx_organizations_stripe_subscription_id" ON "public"."organizations" USING "btree" ("stripe_subscription_id") WHERE ("stripe_subscription_id" IS NOT NULL);



CREATE INDEX "idx_passport_views_product_id" ON "public"."passport_views" USING "btree" ("product_id");



CREATE INDEX "idx_passport_views_viewed_at" ON "public"."passport_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_pcp_material_type" ON "public"."packaging_circularity_profiles" USING "btree" ("material_type");



CREATE INDEX "idx_pcp_organization" ON "public"."packaging_circularity_profiles" USING "btree" ("organization_id");



CREATE INDEX "idx_pending_activity_data_org_id" ON "public"."pending_activity_data" USING "btree" ("organization_id");



CREATE INDEX "idx_pending_activity_data_status" ON "public"."pending_activity_data" USING "btree" ("approval_status");



CREATE INDEX "idx_pending_activity_data_submitted_by" ON "public"."pending_activity_data" USING "btree" ("submitted_by");



CREATE INDEX "idx_pending_facilities_org_id" ON "public"."pending_facilities" USING "btree" ("organization_id");



CREATE INDEX "idx_pending_facilities_status" ON "public"."pending_facilities" USING "btree" ("approval_status");



CREATE INDEX "idx_pending_facilities_submitted_by" ON "public"."pending_facilities" USING "btree" ("submitted_by");



CREATE INDEX "idx_pending_products_org_id" ON "public"."pending_products" USING "btree" ("organization_id");



CREATE INDEX "idx_pending_products_status" ON "public"."pending_products" USING "btree" ("approval_status");



CREATE INDEX "idx_pending_products_submitted_by" ON "public"."pending_products" USING "btree" ("submitted_by");



CREATE INDEX "idx_pending_suppliers_org_id" ON "public"."pending_suppliers" USING "btree" ("organization_id");



CREATE INDEX "idx_pending_suppliers_status" ON "public"."pending_suppliers" USING "btree" ("approval_status");



CREATE INDEX "idx_pending_suppliers_submitted_by" ON "public"."pending_suppliers" USING "btree" ("submitted_by");



CREATE INDEX "idx_peols_material" ON "public"."product_end_of_life_scenarios" USING "btree" ("material_id");



CREATE INDEX "idx_peols_organization" ON "public"."product_end_of_life_scenarios" USING "btree" ("organization_id");



CREATE INDEX "idx_peols_product" ON "public"."product_end_of_life_scenarios" USING "btree" ("product_id");



CREATE INDEX "idx_people_scores_org_year" ON "public"."people_culture_scores" USING "btree" ("organization_id", "reporting_year" DESC);



CREATE INDEX "idx_people_scores_overall" ON "public"."people_culture_scores" USING "btree" ("overall_score" DESC);



CREATE INDEX "idx_platform_activity_log_timestamp" ON "public"."platform_activity_log" USING "btree" ("activity_timestamp" DESC);



CREATE INDEX "idx_platform_activity_log_type" ON "public"."platform_activity_log" USING "btree" ("activity_type");



CREATE INDEX "idx_platform_feature_usage_date" ON "public"."platform_feature_usage" USING "btree" ("usage_date" DESC);



CREATE INDEX "idx_platform_feature_usage_feature" ON "public"."platform_feature_usage" USING "btree" ("feature_name");



CREATE INDEX "idx_platform_org_stats_date" ON "public"."platform_organization_stats" USING "btree" ("stat_date" DESC);



CREATE INDEX "idx_platform_org_stats_org" ON "public"."platform_organization_stats" USING "btree" ("organization_id");



CREATE INDEX "idx_platform_supplier_products_category" ON "public"."platform_supplier_products" USING "btree" ("category") WHERE ("category" IS NOT NULL);



CREATE INDEX "idx_platform_supplier_products_supplier_id" ON "public"."platform_supplier_products" USING "btree" ("platform_supplier_id");



CREATE INDEX "idx_platform_supplier_products_verified" ON "public"."platform_supplier_products" USING "btree" ("is_verified") WHERE ("is_verified" = true);



CREATE INDEX "idx_platform_usage_metrics_date" ON "public"."platform_usage_metrics" USING "btree" ("metric_date" DESC);



CREATE INDEX "idx_product_carbon_footprint_inputs_pcf_id" ON "public"."product_carbon_footprint_inputs" USING "btree" ("product_carbon_footprint_id");



CREATE INDEX "idx_product_carbon_footprint_materials_pcf_id" ON "public"."product_carbon_footprint_materials" USING "btree" ("product_carbon_footprint_id");



CREATE INDEX "idx_product_carbon_footprint_production_sites_facility_id" ON "public"."product_carbon_footprint_production_sites" USING "btree" ("facility_id");



CREATE INDEX "idx_product_carbon_footprint_production_sites_org_pcf" ON "public"."product_carbon_footprint_production_sites" USING "btree" ("organization_id", "product_carbon_footprint_id");



CREATE INDEX "idx_product_carbon_footprint_production_sites_pcf_id" ON "public"."product_carbon_footprint_production_sites" USING "btree" ("product_carbon_footprint_id");



CREATE INDEX "idx_product_carbon_footprint_results_category" ON "public"."product_carbon_footprint_results" USING "btree" ("impact_category");



CREATE INDEX "idx_product_carbon_footprint_results_pcf_id" ON "public"."product_carbon_footprint_results" USING "btree" ("product_carbon_footprint_id");



CREATE INDEX "idx_product_lca_materials_category_type" ON "public"."product_carbon_footprint_materials" USING "btree" ("category_type");



CREATE INDEX "idx_product_lca_materials_data_priority" ON "public"."product_carbon_footprint_materials" USING "btree" ("data_priority");



CREATE INDEX "idx_product_lca_materials_data_quality_grade" ON "public"."product_carbon_footprint_materials" USING "btree" ("data_quality_grade") WHERE ("data_quality_grade" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_data_source" ON "public"."product_carbon_footprint_materials" USING "btree" ("data_source") WHERE ("data_source" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_data_source_id" ON "public"."product_carbon_footprint_materials" USING "btree" ("data_source_id") WHERE ("data_source_id" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_ef_calculated_at" ON "public"."product_carbon_footprint_materials" USING "btree" ("ef_calculated_at") WHERE ("ef_calculated_at" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_ef_methodology" ON "public"."product_carbon_footprint_materials" USING "btree" ("ef_methodology_version") WHERE ("ef_methodology_version" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_ghg_quality" ON "public"."product_carbon_footprint_materials" USING "btree" ("ghg_data_quality") WHERE ("ghg_data_quality" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_impact_metadata" ON "public"."product_carbon_footprint_materials" USING "gin" ("impact_metadata") WHERE ("impact_metadata" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_impact_reference_id" ON "public"."product_carbon_footprint_materials" USING "btree" ("impact_reference_id") WHERE ("impact_reference_id" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_impact_source" ON "public"."product_carbon_footprint_materials" USING "btree" ("impact_source") WHERE ("impact_source" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_impact_transport" ON "public"."product_carbon_footprint_materials" USING "btree" ("impact_transport") WHERE (("impact_transport" IS NOT NULL) AND ("impact_transport" > (0)::numeric));



CREATE INDEX "idx_product_lca_materials_is_hybrid" ON "public"."product_carbon_footprint_materials" USING "btree" ("is_hybrid_source") WHERE ("is_hybrid_source" = true);



CREATE INDEX "idx_product_lca_materials_label_printing_type" ON "public"."product_carbon_footprint_materials" USING "btree" ("label_printing_type") WHERE ("label_printing_type" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_lca_sub_stage_id" ON "public"."product_carbon_footprint_materials" USING "btree" ("lca_sub_stage_id");



CREATE INDEX "idx_product_lca_materials_origin_country" ON "public"."product_carbon_footprint_materials" USING "btree" ("origin_country") WHERE ("origin_country" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_origin_country_code" ON "public"."product_carbon_footprint_materials" USING "btree" ("origin_country_code") WHERE ("origin_country_code" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_origin_location" ON "public"."product_carbon_footprint_materials" USING "btree" ("origin_lat", "origin_lng") WHERE (("origin_lat" IS NOT NULL) AND ("origin_lng" IS NOT NULL));



CREATE INDEX "idx_product_lca_materials_packaging_category" ON "public"."product_carbon_footprint_materials" USING "btree" ("packaging_category") WHERE ("packaging_category" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_packaging_composite" ON "public"."product_carbon_footprint_materials" USING "btree" ("product_carbon_footprint_id", "packaging_category") WHERE ("packaging_category" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_supplier_lca" ON "public"."product_carbon_footprint_materials" USING "btree" ("supplier_lca_id") WHERE ("supplier_lca_id" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_supplier_product_id" ON "public"."product_carbon_footprint_materials" USING "btree" ("supplier_product_id") WHERE ("supplier_product_id" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_transport_mode" ON "public"."product_carbon_footprint_materials" USING "btree" ("transport_mode") WHERE ("transport_mode" IS NOT NULL);



CREATE INDEX "idx_product_lca_materials_with_transport" ON "public"."product_carbon_footprint_materials" USING "btree" ("product_carbon_footprint_id", "transport_mode") WHERE (("transport_mode" IS NOT NULL) AND ("distance_km" IS NOT NULL));



CREATE INDEX "idx_product_lca_results_method" ON "public"."product_carbon_footprint_results" USING "btree" ("method");



CREATE INDEX "idx_product_lcas_aggregated_impacts" ON "public"."product_carbon_footprints" USING "gin" ("aggregated_impacts");



CREATE INDEX "idx_product_lcas_csrd_compliant" ON "public"."product_carbon_footprints" USING "btree" ("csrd_compliant") WHERE ("csrd_compliant" = true);



CREATE INDEX "idx_product_lcas_ef31_recalc_status" ON "public"."product_carbon_footprints" USING "btree" ("ef31_recalculation_status") WHERE ("ef31_recalculation_status" IS NOT NULL);



CREATE INDEX "idx_product_lcas_is_draft" ON "public"."product_carbon_footprints" USING "btree" ("is_draft");



CREATE INDEX "idx_product_lcas_lca_scope_type" ON "public"."product_carbon_footprints" USING "btree" ("lca_scope_type");



CREATE INDEX "idx_product_lcas_org_ghg" ON "public"."product_carbon_footprints" USING "btree" ("organization_id", "total_ghg_emissions");



CREATE INDEX "idx_product_lcas_parent_lca_id" ON "public"."product_carbon_footprints" USING "btree" ("parent_lca_id");



CREATE INDEX "idx_product_lcas_product_id" ON "public"."product_carbon_footprints" USING "btree" ("product_id");



CREATE INDEX "idx_product_lcas_reference_year" ON "public"."product_carbon_footprints" USING "btree" ("reference_year");



CREATE INDEX "idx_product_lcas_status_v2" ON "public"."product_carbon_footprints" USING "btree" ("status");



CREATE INDEX "idx_product_materials_data_source" ON "public"."product_materials" USING "btree" ("data_source") WHERE ("data_source" IS NOT NULL);



CREATE INDEX "idx_product_materials_lca_stage_id" ON "public"."product_materials" USING "btree" ("lca_stage_id") WHERE ("lca_stage_id" IS NOT NULL);



CREATE INDEX "idx_product_materials_material_type" ON "public"."product_materials" USING "btree" ("material_type") WHERE ("material_type" IS NOT NULL);



CREATE INDEX "idx_product_materials_origin_country" ON "public"."product_materials" USING "btree" ("origin_country_code") WHERE ("origin_country_code" IS NOT NULL);



CREATE INDEX "idx_product_materials_origin_location" ON "public"."product_materials" USING "btree" ("origin_lat", "origin_lng") WHERE (("origin_lat" IS NOT NULL) AND ("origin_lng" IS NOT NULL));



CREATE INDEX "idx_product_materials_packaging_category" ON "public"."product_materials" USING "btree" ("packaging_category") WHERE ("packaging_category" IS NOT NULL);



CREATE INDEX "idx_product_materials_product_id" ON "public"."product_materials" USING "btree" ("product_id");



CREATE INDEX "idx_product_materials_supplier_product_id" ON "public"."product_materials" USING "btree" ("supplier_product_id") WHERE ("supplier_product_id" IS NOT NULL);



CREATE INDEX "idx_product_materials_transport_mode" ON "public"."product_materials" USING "btree" ("transport_mode") WHERE ("transport_mode" IS NOT NULL);



CREATE INDEX "idx_product_materials_with_transport" ON "public"."product_materials" USING "btree" ("product_id", "transport_mode") WHERE (("transport_mode" IS NOT NULL) AND ("distance_km" IS NOT NULL));



CREATE INDEX "idx_production_logs_date" ON "public"."production_logs" USING "btree" ("date");



CREATE INDEX "idx_production_logs_facility_date" ON "public"."production_logs" USING "btree" ("facility_id", "date");



CREATE INDEX "idx_production_logs_facility_id" ON "public"."production_logs" USING "btree" ("facility_id");



CREATE INDEX "idx_production_logs_organization_id" ON "public"."production_logs" USING "btree" ("organization_id");



CREATE INDEX "idx_production_logs_product_date" ON "public"."production_logs" USING "btree" ("product_id", "date" DESC);



CREATE INDEX "idx_production_logs_product_id" ON "public"."production_logs" USING "btree" ("product_id");



CREATE INDEX "idx_products_category" ON "public"."products" USING "btree" ("product_category");



CREATE INDEX "idx_products_is_draft" ON "public"."products" USING "btree" ("is_draft");



CREATE INDEX "idx_products_passport_enabled" ON "public"."products" USING "btree" ("passport_enabled") WHERE ("passport_enabled" = true);



CREATE INDEX "idx_products_passport_token" ON "public"."products" USING "btree" ("passport_token") WHERE ("passport_token" IS NOT NULL);



CREATE INDEX "idx_products_sku" ON "public"."products" USING "btree" ("sku") WHERE ("sku" IS NOT NULL);



CREATE INDEX "idx_products_system_boundary" ON "public"."products" USING "btree" ("system_boundary");



CREATE INDEX "idx_proxy_mappings_product_category" ON "public"."product_category_proxy_mappings" USING "btree" ("product_category");



CREATE INDEX "idx_recalc_batches_status" ON "public"."lca_recalculation_batches" USING "btree" ("status", "priority" DESC);



CREATE INDEX "idx_recalc_queue_batch" ON "public"."lca_recalculation_queue" USING "btree" ("batch_id") WHERE ("batch_id" IS NOT NULL);



CREATE INDEX "idx_recalc_queue_org" ON "public"."lca_recalculation_queue" USING "btree" ("organization_id");



CREATE INDEX "idx_recalc_queue_pending" ON "public"."lca_recalculation_queue" USING "btree" ("status", "priority" DESC, "created_at") WHERE ("status" = 'pending'::"text");



CREATE INDEX "idx_scope_1_2_emission_sources_factor_id" ON "public"."scope_1_2_emission_sources" USING "btree" ("emission_factor_id");



CREATE INDEX "idx_scope_1_2_emission_sources_scope" ON "public"."scope_1_2_emission_sources" USING "btree" ("scope");



CREATE INDEX "idx_sds_org" ON "public"."supplier_data_submissions" USING "btree" ("organization_id");



CREATE INDEX "idx_sds_period" ON "public"."supplier_data_submissions" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_sds_status" ON "public"."supplier_data_submissions" USING "btree" ("verification_status");



CREATE INDEX "idx_sds_supplier" ON "public"."supplier_data_submissions" USING "btree" ("supplier_id");



CREATE INDEX "idx_spend_category_patterns_org" ON "public"."spend_category_patterns" USING "btree" ("organization_id");



CREATE INDEX "idx_spend_category_patterns_pattern" ON "public"."spend_category_patterns" USING "btree" ("pattern");



CREATE INDEX "idx_spend_import_batches_org" ON "public"."spend_import_batches" USING "btree" ("organization_id");



CREATE INDEX "idx_spend_import_batches_report" ON "public"."spend_import_batches" USING "btree" ("report_id");



CREATE INDEX "idx_spend_import_batches_status" ON "public"."spend_import_batches" USING "btree" ("status");



CREATE INDEX "idx_spend_import_items_ai_processed" ON "public"."spend_import_items" USING "btree" ("batch_id", "ai_processed_at");



CREATE INDEX "idx_spend_import_items_batch" ON "public"."spend_import_items" USING "btree" ("batch_id");



CREATE INDEX "idx_spend_import_items_category" ON "public"."spend_import_items" USING "btree" ("suggested_category");



CREATE INDEX "idx_spend_import_items_status" ON "public"."spend_import_items" USING "btree" ("status");



CREATE INDEX "idx_staging_ef_nature_impacts" ON "public"."staging_emission_factors" USING "btree" ("terrestrial_ecotoxicity_factor", "freshwater_eutrophication_factor", "terrestrial_acidification_factor") WHERE (("terrestrial_ecotoxicity_factor" IS NOT NULL) OR ("freshwater_eutrophication_factor" IS NOT NULL) OR ("terrestrial_acidification_factor" IS NOT NULL));



CREATE INDEX "idx_staging_factors_category" ON "public"."staging_emission_factors" USING "btree" ("category");



CREATE INDEX "idx_staging_factors_category_type" ON "public"."staging_emission_factors" USING "btree" ("category_type") WHERE ("category_type" IS NOT NULL);



CREATE INDEX "idx_staging_factors_gwp_method" ON "public"."staging_emission_factors" USING "btree" ("gwp_methodology") WHERE ("gwp_methodology" IS NOT NULL);



CREATE INDEX "idx_staging_factors_name" ON "public"."staging_emission_factors" USING "btree" ("name");



CREATE INDEX "idx_staging_factors_org" ON "public"."staging_emission_factors" USING "btree" ("organization_id");



CREATE INDEX "idx_supplier_engagements_invited_date" ON "public"."supplier_engagements" USING "btree" ("invited_date" DESC);



CREATE INDEX "idx_supplier_engagements_status" ON "public"."supplier_engagements" USING "btree" ("status");



CREATE INDEX "idx_supplier_engagements_supplier_id" ON "public"."supplier_engagements" USING "btree" ("supplier_id");



CREATE INDEX "idx_supplier_invitations_active" ON "public"."supplier_invitations" USING "btree" ("organization_id", "status") WHERE ("status" = 'pending'::"public"."supplier_invitation_status");



CREATE INDEX "idx_supplier_invitations_material_id" ON "public"."supplier_invitations" USING "btree" ("material_id");



CREATE INDEX "idx_supplier_invitations_organization_id" ON "public"."supplier_invitations" USING "btree" ("organization_id");



CREATE INDEX "idx_supplier_invitations_product_id" ON "public"."supplier_invitations" USING "btree" ("product_id");



CREATE INDEX "idx_supplier_invitations_status" ON "public"."supplier_invitations" USING "btree" ("status");



CREATE INDEX "idx_supplier_invitations_supplier_email" ON "public"."supplier_invitations" USING "btree" ("lower"("supplier_email"));



CREATE INDEX "idx_supplier_invitations_token" ON "public"."supplier_invitations" USING "btree" ("invitation_token");



CREATE INDEX "idx_supplier_products_metadata" ON "public"."supplier_products" USING "gin" ("metadata");



CREATE INDEX "idx_supplier_products_name_lower" ON "public"."supplier_products" USING "btree" ("lower"("name"));



CREATE INDEX "idx_supplier_products_org_active" ON "public"."supplier_products" USING "btree" ("organization_id", "is_active") WHERE ("is_active" = true);



CREATE INDEX "idx_supplier_products_org_active_verified" ON "public"."supplier_products" USING "btree" ("organization_id", "is_active", "is_verified") WHERE (("is_active" = true) AND ("is_verified" = true));



COMMENT ON INDEX "public"."idx_supplier_products_org_active_verified" IS 'Optimizes material search queries for verified active products by organization';



CREATE INDEX "idx_supplier_products_organization_id" ON "public"."supplier_products" USING "btree" ("organization_id");



CREATE INDEX "idx_supplier_products_origin_country_code" ON "public"."supplier_products" USING "btree" ("origin_country_code") WHERE ("origin_country_code" IS NOT NULL);



CREATE INDEX "idx_supplier_products_origin_location" ON "public"."supplier_products" USING "btree" ("origin_lat", "origin_lng") WHERE (("origin_lat" IS NOT NULL) AND ("origin_lng" IS NOT NULL));



CREATE INDEX "idx_supplier_products_supplier_id" ON "public"."supplier_products" USING "btree" ("supplier_id");



CREATE UNIQUE INDEX "idx_supplier_products_unique_code" ON "public"."supplier_products" USING "btree" ("supplier_id", "product_code") WHERE ("product_code" IS NOT NULL);



COMMENT ON INDEX "public"."idx_supplier_products_unique_code" IS 'Ensures product codes are unique per supplier - prevents duplicate entries';



CREATE INDEX "idx_supplier_products_unverified" ON "public"."supplier_products" USING "btree" ("created_at" DESC) WHERE ("is_verified" = false);



COMMENT ON INDEX "public"."idx_supplier_products_unverified" IS 'Optimizes admin dashboard queries for unverified products pending approval';



CREATE INDEX "idx_supplier_products_verified_by" ON "public"."supplier_products" USING "btree" ("verified_by") WHERE ("verified_by" IS NOT NULL);



COMMENT ON INDEX "public"."idx_supplier_products_verified_by" IS 'Optimizes queries for verification audit trails and admin activity tracking';



CREATE INDEX "idx_supplier_products_with_images" ON "public"."supplier_products" USING "btree" ("id") WHERE ("product_image_url" IS NOT NULL);



CREATE INDEX "idx_supplier_upgrade_recs_lca" ON "public"."supplier_data_upgrade_recommendations" USING "btree" ("product_lca_id");



CREATE INDEX "idx_supplier_upgrade_recs_org" ON "public"."supplier_data_upgrade_recommendations" USING "btree" ("organization_id");



CREATE INDEX "idx_supplier_upgrade_recs_status" ON "public"."supplier_data_upgrade_recommendations" USING "btree" ("status");



CREATE INDEX "idx_suppliers_contact_email" ON "public"."suppliers" USING "btree" ("contact_email") WHERE ("contact_email" IS NOT NULL);



CREATE INDEX "idx_suppliers_org_name" ON "public"."suppliers" USING "btree" ("organization_id", "name");



CREATE INDEX "idx_suppliers_organization_id" ON "public"."suppliers" USING "btree" ("organization_id");



CREATE INDEX "idx_suppliers_website" ON "public"."suppliers" USING "btree" ("website") WHERE ("website" IS NOT NULL);



CREATE INDEX "idx_survey_responses_organization" ON "public"."people_survey_responses" USING "btree" ("organization_id");



CREATE INDEX "idx_survey_responses_survey" ON "public"."people_survey_responses" USING "btree" ("survey_id");



CREATE INDEX "idx_surveys_organization" ON "public"."people_employee_surveys" USING "btree" ("organization_id");



CREATE INDEX "idx_surveys_year" ON "public"."people_employee_surveys" USING "btree" ("reporting_year");



CREATE INDEX "idx_training_organization" ON "public"."people_training_records" USING "btree" ("organization_id");



CREATE INDEX "idx_training_year" ON "public"."people_training_records" USING "btree" ("reporting_year");



CREATE INDEX "idx_usage_log_event_type" ON "public"."organization_usage_log" USING "btree" ("event_type");



CREATE INDEX "idx_usage_log_org_date" ON "public"."organization_usage_log" USING "btree" ("organization_id", "created_at" DESC);



CREATE INDEX "idx_user_notifications_unread" ON "public"."user_notifications" USING "btree" ("user_id", "is_read") WHERE ("is_read" = false);



CREATE INDEX "idx_user_notifications_user_id" ON "public"."user_notifications" USING "btree" ("user_id");



CREATE INDEX "idx_utility_data_facility_id" ON "public"."utility_data_entries" USING "btree" ("facility_id");



CREATE INDEX "idx_utility_data_period" ON "public"."utility_data_entries" USING "btree" ("reporting_period_start", "reporting_period_end");



CREATE INDEX "idx_utility_data_scope" ON "public"."utility_data_entries" USING "btree" ("calculated_scope");



CREATE INDEX "idx_utility_data_utility_type" ON "public"."utility_data_entries" USING "btree" ("utility_type");



CREATE INDEX "idx_vehicles_facility_id" ON "public"."vehicles" USING "btree" ("facility_id");



CREATE INDEX "idx_vehicles_organization_id" ON "public"."vehicles" USING "btree" ("organization_id");



CREATE INDEX "idx_vehicles_ownership" ON "public"."vehicles" USING "btree" ("organization_id", "ownership_type");



CREATE INDEX "idx_vehicles_propulsion_type" ON "public"."vehicles" USING "btree" ("propulsion_type");



CREATE INDEX "idx_vehicles_registration_number" ON "public"."vehicles" USING "btree" ("registration_number");



CREATE INDEX "idx_vehicles_scope" ON "public"."vehicles" USING "btree" ("organization_id", "calculated_scope");



CREATE INDEX "idx_vehicles_status" ON "public"."vehicles" USING "btree" ("status");



CREATE INDEX "idx_verification_history_changed_by" ON "public"."data_provenance_verification_history" USING "btree" ("changed_by");



CREATE INDEX "idx_verification_history_provenance" ON "public"."data_provenance_verification_history" USING "btree" ("provenance_id");



CREATE INDEX "idx_vitality_scores_calculation_date" ON "public"."organization_vitality_scores" USING "btree" ("calculation_date" DESC);



CREATE INDEX "idx_vitality_scores_org_year" ON "public"."organization_vitality_scores" USING "btree" ("organization_id", "year" DESC);



CREATE INDEX "idx_vitality_scores_overall" ON "public"."organization_vitality_scores" USING "btree" ("overall_score" DESC);



CREATE INDEX "idx_vitality_snapshots_org_date" ON "public"."vitality_score_snapshots" USING "btree" ("organization_id", "snapshot_date" DESC);



CREATE INDEX "idx_water_discharge_quality_facility" ON "public"."facility_water_discharge_quality" USING "btree" ("facility_id");



CREATE OR REPLACE TRIGGER "check_production_site_facility_type" BEFORE INSERT OR UPDATE ON "public"."product_carbon_footprint_production_sites" FOR EACH ROW EXECUTE FUNCTION "public"."validate_production_site_facility_type"();



CREATE OR REPLACE TRIGGER "facilities_updated_at" BEFORE UPDATE ON "public"."facilities" FOR EACH ROW EXECUTE FUNCTION "public"."update_facilities_updated_at"();



CREATE OR REPLACE TRIGGER "facility_water_data_updated_at" BEFORE UPDATE ON "public"."facility_water_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_facility_water_data_updated_at"();



CREATE OR REPLACE TRIGGER "on_feedback_message_created" AFTER INSERT ON "public"."feedback_messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_feedback_message"();



CREATE OR REPLACE TRIGGER "on_feedback_ticket_created" AFTER INSERT ON "public"."feedback_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."notify_new_feedback_ticket"();



CREATE OR REPLACE TRIGGER "on_gaia_message_created" AFTER INSERT ON "public"."gaia_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_gaia_conversation_stats"();



CREATE OR REPLACE TRIGGER "on_lca_delete_decrement" AFTER DELETE ON "public"."product_carbon_footprints" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_lca_count"();



CREATE OR REPLACE TRIGGER "on_product_delete_decrement" AFTER DELETE ON "public"."products" FOR EACH ROW EXECUTE FUNCTION "public"."decrement_product_count"();



CREATE OR REPLACE TRIGGER "product_carbon_footprints_updated_at" BEFORE UPDATE ON "public"."product_carbon_footprints" FOR EACH ROW EXECUTE FUNCTION "public"."update_product_carbon_footprint_updated_at"();



CREATE OR REPLACE TRIGGER "set_blog_post_updated_at" BEFORE UPDATE ON "public"."blog_posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_blog_post_updated_at"();



CREATE OR REPLACE TRIGGER "set_corporate_reports_updated_at" BEFORE UPDATE ON "public"."corporate_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_corporate_reports_updated_at"();



CREATE OR REPLACE TRIGGER "set_facility_activity_org_id" BEFORE INSERT ON "public"."facility_activity_data" FOR EACH ROW EXECUTE FUNCTION "public"."set_facility_activity_organization_id"();



CREATE OR REPLACE TRIGGER "set_production_logs_updated_at" BEFORE UPDATE ON "public"."production_logs" FOR EACH ROW EXECUTE FUNCTION "public"."update_production_logs_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_calculate_fleet_activity_scope" BEFORE INSERT OR UPDATE ON "public"."fleet_activities" FOR EACH ROW EXECUTE FUNCTION "public"."auto_calculate_fleet_activity_scope"();



CREATE OR REPLACE TRIGGER "trg_auto_calculate_vehicle_scope" BEFORE INSERT OR UPDATE OF "ownership_type", "propulsion_type", "fuel_type" ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."auto_calculate_vehicle_scope"();



CREATE OR REPLACE TRIGGER "trg_emissions_factors_updated_at" BEFORE UPDATE ON "public"."emissions_factors" FOR EACH ROW EXECUTE FUNCTION "public"."update_emissions_factors_updated_at"();



COMMENT ON TRIGGER "trg_emissions_factors_updated_at" ON "public"."emissions_factors" IS 'Ensures updated_at timestamp is automatically maintained for audit trail purposes';



CREATE OR REPLACE TRIGGER "trg_log_verification_status_change" AFTER UPDATE ON "public"."data_provenance_trail" FOR EACH ROW WHEN (("old"."verification_status" IS DISTINCT FROM "new"."verification_status")) EXECUTE FUNCTION "public"."log_verification_status_change"();



COMMENT ON TRIGGER "trg_log_verification_status_change" ON "public"."data_provenance_trail" IS 'Captures verification status changes and records them in the audit history for compliance purposes.';



CREATE OR REPLACE TRIGGER "trg_prevent_calculation_log_deletes" BEFORE DELETE ON "public"."calculation_logs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_calculation_log_deletes"();



COMMENT ON TRIGGER "trg_prevent_calculation_log_deletes" ON "public"."calculation_logs" IS 'Prevents any DELETE operations on calculation logs to maintain permanent audit trail. This provides protection even if RLS policies are accidentally modified.';



CREATE OR REPLACE TRIGGER "trg_prevent_calculation_log_updates" BEFORE UPDATE ON "public"."calculation_logs" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_calculation_log_updates"();



COMMENT ON TRIGGER "trg_prevent_calculation_log_updates" ON "public"."calculation_logs" IS 'Prevents any UPDATE operations on calculation logs to enforce immutability. This provides protection even if RLS policies are accidentally modified.';



CREATE OR REPLACE TRIGGER "trg_prevent_data_provenance_deletes" BEFORE DELETE ON "public"."data_provenance_trail" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_data_provenance_deletes"();



COMMENT ON TRIGGER "trg_prevent_data_provenance_deletes" ON "public"."data_provenance_trail" IS 'Prevents any DELETE operations to maintain permanent evidence trail. Use verification_status="rejected" to mark evidence as invalid instead of deleting.';



CREATE OR REPLACE TRIGGER "trg_validate_calculation_log_organization" BEFORE INSERT ON "public"."calculation_logs" FOR EACH ROW EXECUTE FUNCTION "public"."validate_calculation_log_organization"();



COMMENT ON TRIGGER "trg_validate_calculation_log_organization" ON "public"."calculation_logs" IS 'Validates organisation membership before insert to prevent privilege escalation. Works in conjunction with RLS policies to provide defence-in-depth security.';



CREATE OR REPLACE TRIGGER "trg_validate_data_provenance_organization" BEFORE INSERT ON "public"."data_provenance_trail" FOR EACH ROW EXECUTE FUNCTION "public"."validate_data_provenance_organization"();



COMMENT ON TRIGGER "trg_validate_data_provenance_organization" ON "public"."data_provenance_trail" IS 'Validates organisation membership before insert to prevent privilege escalation. Works in conjunction with RLS policies to provide defence-in-depth security.';



CREATE OR REPLACE TRIGGER "trg_vehicles_updated_at" BEFORE UPDATE ON "public"."vehicles" FOR EACH ROW EXECUTE FUNCTION "public"."update_vehicles_updated_at"();



COMMENT ON TRIGGER "trg_vehicles_updated_at" ON "public"."vehicles" IS 'Ensures updated_at timestamp is automatically maintained for audit trail purposes';



CREATE OR REPLACE TRIGGER "trigger_auto_tag_utility_scope" BEFORE INSERT OR UPDATE OF "utility_type" ON "public"."utility_data_entries" FOR EACH ROW EXECUTE FUNCTION "public"."auto_tag_utility_scope"();



COMMENT ON TRIGGER "trigger_auto_tag_utility_scope" ON "public"."utility_data_entries" IS 'Automatically sets calculated_scope based on utility_type on insert/update';



CREATE OR REPLACE TRIGGER "trigger_bulk_import_sessions_updated_at" BEFORE UPDATE ON "public"."bulk_import_sessions" FOR EACH ROW EXECUTE FUNCTION "public"."update_bulk_import_sessions_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_calculate_allocation_metrics" BEFORE INSERT OR UPDATE ON "public"."contract_manufacturer_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_allocation_metrics"();



CREATE OR REPLACE TRIGGER "trigger_calculate_facility_intensity" BEFORE INSERT OR UPDATE ON "public"."facility_emissions_aggregated" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_facility_intensity"();



CREATE OR REPLACE TRIGGER "trigger_calculate_pcf_production_site_metrics" BEFORE INSERT OR UPDATE ON "public"."product_carbon_footprint_production_sites" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_production_site_metrics"();



CREATE OR REPLACE TRIGGER "trigger_calculate_units_from_volume" BEFORE INSERT OR UPDATE ON "public"."production_logs" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_units_from_volume"();



CREATE OR REPLACE TRIGGER "trigger_recalculate_from_energy" AFTER INSERT OR DELETE OR UPDATE ON "public"."contract_manufacturer_energy_inputs" FOR EACH ROW EXECUTE FUNCTION "public"."recalculate_allocation_from_energy_inputs"();



CREATE OR REPLACE TRIGGER "trigger_set_activity_confidence" BEFORE INSERT OR UPDATE ON "public"."facility_activity_entries" FOR EACH ROW EXECUTE FUNCTION "public"."set_activity_entry_confidence_score"();



CREATE OR REPLACE TRIGGER "trigger_set_production_site_metrics" BEFORE INSERT OR UPDATE ON "public"."product_carbon_footprint_production_sites" FOR EACH ROW EXECUTE FUNCTION "public"."set_production_site_metrics"();



CREATE OR REPLACE TRIGGER "trigger_update_fpa_updated_at" BEFORE UPDATE ON "public"."facility_product_assignments" FOR EACH ROW EXECUTE FUNCTION "public"."update_facility_product_assignments_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_generated_reports_updated_at" BEFORE UPDATE ON "public"."generated_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_generated_reports_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_lca_production_mix_timestamp" BEFORE UPDATE ON "public"."lca_production_mix" FOR EACH ROW EXECUTE FUNCTION "public"."update_lca_production_mix_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_update_lca_reports_updated_at" BEFORE UPDATE ON "public"."lca_reports" FOR EACH ROW EXECUTE FUNCTION "public"."update_lca_reports_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_spend_batch_stats" AFTER INSERT OR UPDATE ON "public"."spend_import_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_spend_batch_stats"();



CREATE OR REPLACE TRIGGER "trigger_validate_allocation" BEFORE INSERT OR UPDATE ON "public"."facility_activity_entries" FOR EACH ROW EXECUTE FUNCTION "public"."validate_physical_allocation"();



CREATE OR REPLACE TRIGGER "trigger_validate_allocation_periods" BEFORE INSERT OR UPDATE ON "public"."contract_manufacturer_allocations" FOR EACH ROW EXECUTE FUNCTION "public"."validate_no_overlapping_allocation_periods"();



CREATE OR REPLACE TRIGGER "trigger_validate_production_mix" BEFORE INSERT OR UPDATE ON "public"."lca_production_mix" FOR EACH ROW EXECUTE FUNCTION "public"."validate_production_mix_totals"();



CREATE OR REPLACE TRIGGER "update_bom_extracted_items_updated_at" BEFORE UPDATE ON "public"."bom_extracted_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_bom_imports_updated_at" BEFORE UPDATE ON "public"."bom_imports" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_dashboard_preferences_timestamp" BEFORE UPDATE ON "public"."user_dashboard_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_dashboard_preferences_updated_at"();



CREATE OR REPLACE TRIGGER "update_defra_mappings_updated_at" BEFORE UPDATE ON "public"."defra_ecoinvent_impact_mappings" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_ecoinvent_proxies_updated_at" BEFORE UPDATE ON "public"."ecoinvent_material_proxies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_feedback_tickets_updated_at" BEFORE UPDATE ON "public"."feedback_tickets" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gaia_analytics_updated_at" BEFORE UPDATE ON "public"."gaia_analytics" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gaia_conversations_updated_at" BEFORE UPDATE ON "public"."gaia_conversations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_gaia_knowledge_base_updated_at" BEFORE UPDATE ON "public"."gaia_knowledge_base" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_greenwash_assessments_updated_at" BEFORE UPDATE ON "public"."greenwash_assessments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_kb_categories_updated_at" BEFORE UPDATE ON "public"."knowledge_bank_categories" FOR EACH ROW EXECUTE FUNCTION "public"."update_kb_updated_at"();



CREATE OR REPLACE TRIGGER "update_kb_items_updated_at" BEFORE UPDATE ON "public"."knowledge_bank_items" FOR EACH ROW EXECUTE FUNCTION "public"."update_kb_updated_at"();



CREATE OR REPLACE TRIGGER "update_openlca_config_timestamp" BEFORE UPDATE ON "public"."openlca_configurations" FOR EACH ROW EXECUTE FUNCTION "public"."update_openlca_config_updated_at"();



CREATE OR REPLACE TRIGGER "update_organizations_updated_at" BEFORE UPDATE ON "public"."organizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_activity_data_updated_at" BEFORE UPDATE ON "public"."pending_activity_data" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_facilities_updated_at" BEFORE UPDATE ON "public"."pending_facilities" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_products_updated_at" BEFORE UPDATE ON "public"."pending_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pending_suppliers_updated_at" BEFORE UPDATE ON "public"."pending_suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_platform_supplier_products_updated_at" BEFORE UPDATE ON "public"."platform_supplier_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_carbon_footprint_materials_updated_at" BEFORE UPDATE ON "public"."product_carbon_footprint_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_product_materials_updated_at" BEFORE UPDATE ON "public"."product_materials" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_recalc_batches_updated_at" BEFORE UPDATE ON "public"."lca_recalculation_batches" FOR EACH ROW EXECUTE FUNCTION "public"."update_recalculation_batch_timestamp"();



CREATE OR REPLACE TRIGGER "update_recalc_queue_updated_at" BEFORE UPDATE ON "public"."lca_recalculation_queue" FOR EACH ROW EXECUTE FUNCTION "public"."update_recalculation_batch_timestamp"();



CREATE OR REPLACE TRIGGER "update_roles_updated_at" BEFORE UPDATE ON "public"."roles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_engagements_updated_at" BEFORE UPDATE ON "public"."supplier_engagements" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_invitations_updated_at" BEFORE UPDATE ON "public"."supplier_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_supplier_products_updated_at" BEFORE UPDATE ON "public"."supplier_products" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_suppliers_updated_at" BEFORE UPDATE ON "public"."suppliers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "utility_data_updated_at" BEFORE UPDATE ON "public"."utility_data_entries" FOR EACH ROW EXECUTE FUNCTION "public"."update_utility_data_updated_at"();



ALTER TABLE ONLY "public"."accredited_advisors"
    ADD CONSTRAINT "accredited_advisors_accredited_by_fkey" FOREIGN KEY ("accredited_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."accredited_advisors"
    ADD CONSTRAINT "accredited_advisors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_data"
    ADD CONSTRAINT "activity_data_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_data"
    ADD CONSTRAINT "activity_data_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_data"
    ADD CONSTRAINT "activity_data_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."activity_log"
    ADD CONSTRAINT "activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "advisor_organization_access_advisor_user_id_fkey" FOREIGN KEY ("advisor_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "advisor_organization_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "advisor_organization_access_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."advisor_organization_access"
    ADD CONSTRAINT "advisor_organization_access_revoked_by_fkey" FOREIGN KEY ("revoked_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."blog_posts"
    ADD CONSTRAINT "blog_posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bom_extracted_items"
    ADD CONSTRAINT "bom_extracted_items_bom_import_id_fkey" FOREIGN KEY ("bom_import_id") REFERENCES "public"."bom_imports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bom_imports"
    ADD CONSTRAINT "bom_imports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bom_imports"
    ADD CONSTRAINT "bom_imports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bom_imports"
    ADD CONSTRAINT "bom_imports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bulk_import_sessions"
    ADD CONSTRAINT "bulk_import_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bulk_import_sessions"
    ADD CONSTRAINT "bulk_import_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculated_emissions"
    ADD CONSTRAINT "calculated_emissions_activity_data_id_fkey" FOREIGN KEY ("activity_data_id") REFERENCES "public"."activity_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculated_emissions"
    ADD CONSTRAINT "calculated_emissions_emissions_factor_id_fkey" FOREIGN KEY ("emissions_factor_id") REFERENCES "public"."emissions_factors"("factor_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculated_emissions"
    ADD CONSTRAINT "calculated_emissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculated_metrics"
    ADD CONSTRAINT "calculated_metrics_activity_data_id_fkey" FOREIGN KEY ("activity_data_id") REFERENCES "public"."activity_data"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."calculated_metrics"
    ADD CONSTRAINT "calculated_metrics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculated_metrics"
    ADD CONSTRAINT "calculated_metrics_source_log_id_fkey" FOREIGN KEY ("source_log_id") REFERENCES "public"."calculation_logs"("log_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculation_logs"
    ADD CONSTRAINT "calculation_logs_calculation_id_fkey" FOREIGN KEY ("calculation_id") REFERENCES "public"."calculated_emissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculation_logs"
    ADD CONSTRAINT "calculation_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."calculation_logs"
    ADD CONSTRAINT "calculation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_audit_packages"
    ADD CONSTRAINT "certification_audit_packages_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id");



ALTER TABLE ONLY "public"."certification_audit_packages"
    ADD CONSTRAINT "certification_audit_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_evidence_links"
    ADD CONSTRAINT "certification_evidence_links_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_evidence_links"
    ADD CONSTRAINT "certification_evidence_links_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."certification_framework_requirements"("id");



ALTER TABLE ONLY "public"."certification_gap_analyses"
    ADD CONSTRAINT "certification_gap_analyses_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id");



ALTER TABLE ONLY "public"."certification_gap_analyses"
    ADD CONSTRAINT "certification_gap_analyses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_gap_analyses"
    ADD CONSTRAINT "certification_gap_analyses_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "public"."framework_requirements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_score_history"
    ADD CONSTRAINT "certification_score_history_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id");



ALTER TABLE ONLY "public"."certification_score_history"
    ADD CONSTRAINT "certification_score_history_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."circularity_targets"
    ADD CONSTRAINT "circularity_targets_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."circularity_targets"
    ADD CONSTRAINT "circularity_targets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_proxy_mapping_id_fkey" FOREIGN KEY ("proxy_mapping_id") REFERENCES "public"."product_category_proxy_mappings"("id");



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contract_manufacturer_energy_inputs"
    ADD CONSTRAINT "contract_manufacturer_energy_inputs_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "public"."contract_manufacturer_allocations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corporate_overheads"
    ADD CONSTRAINT "corporate_overheads_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."corporate_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."corporate_reports"
    ADD CONSTRAINT "corporate_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_provenance_trail"
    ADD CONSTRAINT "data_provenance_trail_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_provenance_trail"
    ADD CONSTRAINT "data_provenance_trail_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."data_provenance_verification_history"
    ADD CONSTRAINT "data_provenance_verification_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."data_provenance_verification_history"
    ADD CONSTRAINT "data_provenance_verification_history_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "public"."data_provenance_trail"("provenance_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."defra_ecoinvent_impact_mappings"
    ADD CONSTRAINT "defra_ecoinvent_impact_mappings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ef31_normalisation_factors"
    ADD CONSTRAINT "ef31_normalisation_factors_impact_category_code_fkey" FOREIGN KEY ("impact_category_code") REFERENCES "public"."ef31_impact_categories"("code");



ALTER TABLE ONLY "public"."ef31_process_mappings"
    ADD CONSTRAINT "ef31_process_mappings_staging_factor_id_fkey" FOREIGN KEY ("staging_factor_id") REFERENCES "public"."staging_emission_factors"("id");



ALTER TABLE ONLY "public"."ef31_weighting_factors"
    ADD CONSTRAINT "ef31_weighting_factors_impact_category_code_fkey" FOREIGN KEY ("impact_category_code") REFERENCES "public"."ef31_impact_categories"("code");



ALTER TABLE ONLY "public"."ef31_weighting_factors"
    ADD CONSTRAINT "ef31_weighting_factors_weighting_set_id_fkey" FOREIGN KEY ("weighting_set_id") REFERENCES "public"."ef31_weighting_sets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ef31_weighting_sets"
    ADD CONSTRAINT "ef31_weighting_sets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emissions_calculation_context"
    ADD CONSTRAINT "emissions_calculation_context_context_established_by_fkey" FOREIGN KEY ("context_established_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."emissions_calculation_context"
    ADD CONSTRAINT "emissions_calculation_context_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emissions_calculation_context"
    ADD CONSTRAINT "emissions_calculation_context_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emissions_calculation_context"
    ADD CONSTRAINT "emissions_calculation_context_superseded_by_fkey" FOREIGN KEY ("superseded_by") REFERENCES "public"."emissions_calculation_context"("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_facility_type_id_fkey" FOREIGN KEY ("facility_type_id") REFERENCES "public"."facility_types"("id");



ALTER TABLE ONLY "public"."facilities"
    ADD CONSTRAINT "facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_activity_data"
    ADD CONSTRAINT "facility_activity_data_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facility_activity_data"
    ADD CONSTRAINT "facility_activity_data_emission_source_id_fkey" FOREIGN KEY ("emission_source_id") REFERENCES "public"."scope_1_2_emission_sources"("id");



ALTER TABLE ONLY "public"."facility_activity_data"
    ADD CONSTRAINT "facility_activity_data_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_activity_data"
    ADD CONSTRAINT "facility_activity_data_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_reporting_session_id_fkey" FOREIGN KEY ("reporting_session_id") REFERENCES "public"."facility_reporting_sessions"("id");



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "facility_activity_entries_source_facility_id_fkey" FOREIGN KEY ("source_facility_id") REFERENCES "public"."facilities"("id");



ALTER TABLE ONLY "public"."facility_data_contracts"
    ADD CONSTRAINT "facility_data_contracts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_data_quality_snapshot"
    ADD CONSTRAINT "facility_data_quality_snapshot_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_data_quality_snapshot"
    ADD CONSTRAINT "facility_data_quality_snapshot_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "facility_emissions_aggregated_calculated_by_fkey" FOREIGN KEY ("calculated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "facility_emissions_aggregated_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "facility_emissions_aggregated_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_emissions_aggregated"
    ADD CONSTRAINT "facility_emissions_aggregated_reporting_session_id_fkey" FOREIGN KEY ("reporting_session_id") REFERENCES "public"."facility_reporting_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "facility_product_assignments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "facility_product_assignments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "facility_product_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_product_assignments"
    ADD CONSTRAINT "facility_product_assignments_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_reporting_sessions"
    ADD CONSTRAINT "facility_reporting_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."facility_reporting_sessions"
    ADD CONSTRAINT "facility_reporting_sessions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_reporting_sessions"
    ADD CONSTRAINT "facility_reporting_sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_water_data"
    ADD CONSTRAINT "facility_water_data_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."facility_water_data"
    ADD CONSTRAINT "facility_water_data_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_water_data"
    ADD CONSTRAINT "facility_water_data_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_water_discharge_quality"
    ADD CONSTRAINT "facility_water_discharge_quality_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_water_discharge_quality"
    ADD CONSTRAINT "facility_water_discharge_quality_facility_water_data_id_fkey" FOREIGN KEY ("facility_water_data_id") REFERENCES "public"."facility_water_data"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_messages"
    ADD CONSTRAINT "feedback_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_messages"
    ADD CONSTRAINT "feedback_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "public"."feedback_tickets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."feedback_tickets"
    ADD CONSTRAINT "feedback_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."facility_activity_entries"
    ADD CONSTRAINT "fk_fae_supplier_submission" FOREIGN KEY ("supplier_submission_id") REFERENCES "public"."supplier_data_submissions"("id");



ALTER TABLE ONLY "public"."product_carbon_footprint_materials"
    ADD CONSTRAINT "fk_product_lca_materials_supplier_product" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE SET NULL;



COMMENT ON CONSTRAINT "fk_product_lca_materials_supplier_product" ON "public"."product_carbon_footprint_materials" IS 'Links materials to supplier products when data_source is "supplier". SET NULL on delete to preserve material records.';



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_calculation_log_id_fkey" FOREIGN KEY ("calculation_log_id") REFERENCES "public"."calculation_logs"("log_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_emission_factor_id_fkey" FOREIGN KEY ("emission_factor_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_provenance_id_fkey" FOREIGN KEY ("provenance_id") REFERENCES "public"."data_provenance_trail"("provenance_id");



ALTER TABLE ONLY "public"."fleet_activities"
    ADD CONSTRAINT "fleet_activities_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_emission_factor_consumption_id_fkey" FOREIGN KEY ("emission_factor_consumption_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_emission_factor_distance_id_fkey" FOREIGN KEY ("emission_factor_distance_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_emission_factor_spend_id_fkey" FOREIGN KEY ("emission_factor_spend_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."fleet_emission_sources"
    ADD CONSTRAINT "fleet_emission_sources_emission_factor_volume_id_fkey" FOREIGN KEY ("emission_factor_volume_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."certification_framework_requirements"
    ADD CONSTRAINT "framework_requirements_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."framework_requirements"
    ADD CONSTRAINT "framework_requirements_framework_id_fkey1" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."certification_framework_requirements"
    ADD CONSTRAINT "framework_requirements_parent_requirement_id_fkey" FOREIGN KEY ("parent_requirement_id") REFERENCES "public"."certification_framework_requirements"("id");



ALTER TABLE ONLY "public"."framework_requirements"
    ADD CONSTRAINT "framework_requirements_parent_requirement_id_fkey1" FOREIGN KEY ("parent_requirement_id") REFERENCES "public"."framework_requirements"("id");



ALTER TABLE ONLY "public"."gaia_conversations"
    ADD CONSTRAINT "gaia_conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gaia_conversations"
    ADD CONSTRAINT "gaia_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gaia_feedback"
    ADD CONSTRAINT "gaia_feedback_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."gaia_messages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gaia_feedback"
    ADD CONSTRAINT "gaia_feedback_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gaia_feedback"
    ADD CONSTRAINT "gaia_feedback_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gaia_feedback"
    ADD CONSTRAINT "gaia_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."gaia_knowledge_base"
    ADD CONSTRAINT "gaia_knowledge_base_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."gaia_messages"
    ADD CONSTRAINT "gaia_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."gaia_conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."generated_reports"
    ADD CONSTRAINT "generated_reports_parent_report_id_fkey" FOREIGN KEY ("parent_report_id") REFERENCES "public"."generated_reports"("id");



ALTER TABLE ONLY "public"."ghg_emissions"
    ADD CONSTRAINT "ghg_emissions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."ghg_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."ghg_emissions"
    ADD CONSTRAINT "ghg_emissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."ghg_emissions"
    ADD CONSTRAINT "ghg_emissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_board_members"
    ADD CONSTRAINT "governance_board_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_ethics_records"
    ADD CONSTRAINT "governance_ethics_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_lobbying"
    ADD CONSTRAINT "governance_lobbying_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_mission"
    ADD CONSTRAINT "governance_mission_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_policies"
    ADD CONSTRAINT "governance_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_policy_versions"
    ADD CONSTRAINT "governance_policy_versions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."governance_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_scores"
    ADD CONSTRAINT "governance_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_stakeholder_engagements"
    ADD CONSTRAINT "governance_stakeholder_engagements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_stakeholder_engagements"
    ADD CONSTRAINT "governance_stakeholder_engagements_stakeholder_id_fkey" FOREIGN KEY ("stakeholder_id") REFERENCES "public"."governance_stakeholders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."governance_stakeholders"
    ADD CONSTRAINT "governance_stakeholders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."greenwash_assessment_claims"
    ADD CONSTRAINT "greenwash_assessment_claims_assessment_id_fkey" FOREIGN KEY ("assessment_id") REFERENCES "public"."greenwash_assessments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."greenwash_assessments"
    ADD CONSTRAINT "greenwash_assessments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."greenwash_assessments"
    ADD CONSTRAINT "greenwash_assessments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_selection_audit"
    ADD CONSTRAINT "ingredient_selection_audit_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_selection_audit"
    ADD CONSTRAINT "ingredient_selection_audit_product_lca_id_fkey" FOREIGN KEY ("product_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ingredient_selection_audit"
    ADD CONSTRAINT "ingredient_selection_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."ingredients"
    ADD CONSTRAINT "ingredients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_categories"
    ADD CONSTRAINT "knowledge_bank_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_favorites"
    ADD CONSTRAINT "knowledge_bank_favorites_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_bank_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_favorites"
    ADD CONSTRAINT "knowledge_bank_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_item_tags"
    ADD CONSTRAINT "knowledge_bank_item_tags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_bank_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_item_tags"
    ADD CONSTRAINT "knowledge_bank_item_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."knowledge_bank_tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_items"
    ADD CONSTRAINT "knowledge_bank_items_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."knowledge_bank_items"
    ADD CONSTRAINT "knowledge_bank_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."knowledge_bank_categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_items"
    ADD CONSTRAINT "knowledge_bank_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_tags"
    ADD CONSTRAINT "knowledge_bank_tags_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_views"
    ADD CONSTRAINT "knowledge_bank_views_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "public"."knowledge_bank_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."knowledge_bank_views"
    ADD CONSTRAINT "knowledge_bank_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpi_data_points"
    ADD CONSTRAINT "kpi_data_points_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."kpi_data_points"
    ADD CONSTRAINT "kpi_data_points_kpi_id_fkey" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."kpis"
    ADD CONSTRAINT "kpis_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_methodology_audit_log"
    ADD CONSTRAINT "lca_methodology_audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_methodology_audit_log"
    ADD CONSTRAINT "lca_methodology_audit_log_product_lca_id_fkey" FOREIGN KEY ("product_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."lca_methodology_audit_log"
    ADD CONSTRAINT "lca_methodology_audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_production_mix"
    ADD CONSTRAINT "lca_production_mix_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_production_mix"
    ADD CONSTRAINT "lca_production_mix_lca_id_fkey" FOREIGN KEY ("lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_recalculation_batches"
    ADD CONSTRAINT "lca_recalculation_batches_triggered_by_fkey" FOREIGN KEY ("triggered_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."lca_recalculation_queue"
    ADD CONSTRAINT "lca_recalculation_queue_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."lca_recalculation_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_recalculation_queue"
    ADD CONSTRAINT "lca_recalculation_queue_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_recalculation_queue"
    ADD CONSTRAINT "lca_recalculation_queue_product_lca_id_fkey" FOREIGN KEY ("product_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_reports"
    ADD CONSTRAINT "lca_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_reports"
    ADD CONSTRAINT "lca_reports_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_social_indicators"
    ADD CONSTRAINT "lca_social_indicators_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."lca_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_sub_stages"
    ADD CONSTRAINT "lca_sub_stages_lca_stage_id_fkey" FOREIGN KEY ("lca_stage_id") REFERENCES "public"."lca_stages"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_workflow_audit"
    ADD CONSTRAINT "lca_workflow_audit_product_lca_id_fkey" FOREIGN KEY ("product_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."lca_workflow_audit"
    ADD CONSTRAINT "lca_workflow_audit_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."openlca_configurations"
    ADD CONSTRAINT "openlca_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_certifications"
    ADD CONSTRAINT "organization_certifications_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "public"."certification_frameworks"("id");



ALTER TABLE ONLY "public"."organization_certifications"
    ADD CONSTRAINT "organization_certifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."organization_members"
    ADD CONSTRAINT "organization_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_suppliers"
    ADD CONSTRAINT "organization_suppliers_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."organization_suppliers"
    ADD CONSTRAINT "organization_suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_suppliers"
    ADD CONSTRAINT "organization_suppliers_platform_supplier_id_fkey" FOREIGN KEY ("platform_supplier_id") REFERENCES "public"."platform_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_usage_log"
    ADD CONSTRAINT "organization_usage_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."organization_usage_log"
    ADD CONSTRAINT "organization_usage_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."organization_vitality_scores"
    ADD CONSTRAINT "organization_vitality_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packaging_circularity_profiles"
    ADD CONSTRAINT "packaging_circularity_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."packaging_types"
    ADD CONSTRAINT "packaging_types_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."passport_views"
    ADD CONSTRAINT "passport_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "public"."activity_data"("id");



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_activity_data"
    ADD CONSTRAINT "pending_activity_data_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_facility_type_id_fkey" FOREIGN KEY ("facility_type_id") REFERENCES "public"."facility_types"("id");



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "public"."facilities"("id");



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_facilities"
    ADD CONSTRAINT "pending_facilities_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_products"
    ADD CONSTRAINT "pending_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_products"
    ADD CONSTRAINT "pending_products_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "public"."products"("id");



ALTER TABLE ONLY "public"."pending_products"
    ADD CONSTRAINT "pending_products_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_products"
    ADD CONSTRAINT "pending_products_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_suppliers"
    ADD CONSTRAINT "pending_suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pending_suppliers"
    ADD CONSTRAINT "pending_suppliers_original_id_fkey" FOREIGN KEY ("original_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."pending_suppliers"
    ADD CONSTRAINT "pending_suppliers_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."pending_suppliers"
    ADD CONSTRAINT "pending_suppliers_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_benefits"
    ADD CONSTRAINT "people_benefits_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_benefits"
    ADD CONSTRAINT "people_benefits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_culture_scores"
    ADD CONSTRAINT "people_culture_scores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_dei_actions"
    ADD CONSTRAINT "people_dei_actions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_dei_actions"
    ADD CONSTRAINT "people_dei_actions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_employee_compensation"
    ADD CONSTRAINT "people_employee_compensation_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_employee_compensation"
    ADD CONSTRAINT "people_employee_compensation_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_employee_surveys"
    ADD CONSTRAINT "people_employee_surveys_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_employee_surveys"
    ADD CONSTRAINT "people_employee_surveys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_survey_responses"
    ADD CONSTRAINT "people_survey_responses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_survey_responses"
    ADD CONSTRAINT "people_survey_responses_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "public"."people_employee_surveys"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_training_records"
    ADD CONSTRAINT "people_training_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_training_records"
    ADD CONSTRAINT "people_training_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."people_workforce_demographics"
    ADD CONSTRAINT "people_workforce_demographics_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."people_workforce_demographics"
    ADD CONSTRAINT "people_workforce_demographics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_activity_log"
    ADD CONSTRAINT "platform_activity_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."platform_organization_stats"
    ADD CONSTRAINT "platform_organization_stats_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_supplier_products"
    ADD CONSTRAINT "platform_supplier_products_platform_supplier_id_fkey" FOREIGN KEY ("platform_supplier_id") REFERENCES "public"."platform_suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."platform_supplier_products"
    ADD CONSTRAINT "platform_supplier_products_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."platform_suppliers"
    ADD CONSTRAINT "platform_suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."product_end_of_life_scenarios"
    ADD CONSTRAINT "product_end_of_life_scenarios_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."product_carbon_footprint_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_end_of_life_scenarios"
    ADD CONSTRAINT "product_end_of_life_scenarios_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_end_of_life_scenarios"
    ADD CONSTRAINT "product_end_of_life_scenarios_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprint_materials"
    ADD CONSTRAINT "product_lca_materials_lca_id_fkey" FOREIGN KEY ("product_carbon_footprint_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprint_materials"
    ADD CONSTRAINT "product_lca_materials_supplier_lca_id_fkey" FOREIGN KEY ("supplier_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "product_lca_production_sites_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "product_lca_production_sites_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "product_lca_production_sites_product_lca_id_fkey" FOREIGN KEY ("product_carbon_footprint_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprint_production_sites"
    ADD CONSTRAINT "product_lca_production_sites_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_goal_and_scope_confirmed_by_fkey" FOREIGN KEY ("goal_and_scope_confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_parent_lca_id_fkey" FOREIGN KEY ("parent_lca_id") REFERENCES "public"."product_carbon_footprints"("id");



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."product_carbon_footprints"
    ADD CONSTRAINT "product_lcas_weighting_set_id_fkey" FOREIGN KEY ("weighting_set_id") REFERENCES "public"."ef31_weighting_sets"("id");



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_lca_stage_id_fkey" FOREIGN KEY ("lca_stage_id") REFERENCES "public"."lca_stages"("id");



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_lca_sub_stage_id_fkey" FOREIGN KEY ("lca_sub_stage_id") REFERENCES "public"."lca_sub_stages"("id");



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."product_materials"
    ADD CONSTRAINT "product_materials_supplier_product_id_fkey" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_products"("id");



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."production_logs"
    ADD CONSTRAINT "production_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_core_operations_facility_id_fkey" FOREIGN KEY ("core_operations_facility_id") REFERENCES "public"."facilities"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_latest_lca_id_fkey" FOREIGN KEY ("latest_lca_id") REFERENCES "public"."product_carbon_footprints"("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "public"."permissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scope_1_2_emission_sources"
    ADD CONSTRAINT "scope_1_2_emission_sources_emission_factor_id_fkey" FOREIGN KEY ("emission_factor_id") REFERENCES "public"."emissions_factors"("factor_id");



ALTER TABLE ONLY "public"."spend_category_patterns"
    ADD CONSTRAINT "spend_category_patterns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spend_import_batches"
    ADD CONSTRAINT "spend_import_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."spend_import_batches"
    ADD CONSTRAINT "spend_import_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spend_import_batches"
    ADD CONSTRAINT "spend_import_batches_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."corporate_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."spend_import_items"
    ADD CONSTRAINT "spend_import_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "public"."spend_import_batches"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staging_emission_factors"
    ADD CONSTRAINT "staging_emission_factors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_submissions"
    ADD CONSTRAINT "supplier_data_submissions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id");



ALTER TABLE ONLY "public"."supplier_data_submissions"
    ADD CONSTRAINT "supplier_data_submissions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_submissions"
    ADD CONSTRAINT "supplier_data_submissions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."supplier_data_submissions"
    ADD CONSTRAINT "supplier_data_submissions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id");



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recomme_recommended_supplier_product_fkey" FOREIGN KEY ("recommended_supplier_product_id") REFERENCES "public"."supplier_products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendati_recommended_supplier_id_fkey" FOREIGN KEY ("recommended_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."product_carbon_footprint_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendations_product_lca_id_fkey" FOREIGN KEY ("product_lca_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_data_upgrade_recommendations"
    ADD CONSTRAINT "supplier_data_upgrade_recommendations_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."supplier_engagements"
    ADD CONSTRAINT "supplier_engagements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."supplier_engagements"
    ADD CONSTRAINT "supplier_engagements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."product_materials"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_invitations"
    ADD CONSTRAINT "supplier_invitations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."supplier_products"
    ADD CONSTRAINT "supplier_products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_products"
    ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."supplier_products"
    ADD CONSTRAINT "supplier_products_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."suppliers"
    ADD CONSTRAINT "suppliers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_dashboard_preferences"
    ADD CONSTRAINT "user_dashboard_preferences_widget_id_fkey" FOREIGN KEY ("widget_id") REFERENCES "public"."dashboard_widgets"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utility_data_entries"
    ADD CONSTRAINT "utility_data_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."utility_data_entries"
    ADD CONSTRAINT "utility_data_entries_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."utility_data_entries"
    ADD CONSTRAINT "utility_data_entries_reporting_session_id_fkey" FOREIGN KEY ("reporting_session_id") REFERENCES "public"."facility_reporting_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "public"."facilities"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vitality_score_snapshots"
    ADD CONSTRAINT "vitality_score_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can add members to organization" ON "public"."organization_members" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can create categories" ON "public"."knowledge_bank_categories" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can create items" ON "public"."knowledge_bank_items" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text", 'member'::"text"]))))));



CREATE POLICY "Admins can create supplier products in their organization" ON "public"."supplier_products" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can create supplier products in their organization" ON "public"."supplier_products" IS 'Only organization administrators and Alkatera platform admins can create new supplier products';



CREATE POLICY "Admins can create suppliers in their organization" ON "public"."suppliers" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can create suppliers in their organization" ON "public"."suppliers" IS 'Only organization administrators and Alkatera platform admins can create new suppliers';



CREATE POLICY "Admins can delete allocations" ON "public"."contract_manufacturer_allocations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can delete categories" ON "public"."knowledge_bank_categories" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can delete items" ON "public"."knowledge_bank_items" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can delete supplier products from their organization" ON "public"."supplier_products" FOR DELETE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can delete supplier products from their organization" ON "public"."supplier_products" IS 'Only organization administrators and Alkatera platform admins can delete supplier products';



CREATE POLICY "Admins can delete suppliers from their organization" ON "public"."suppliers" FOR DELETE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can delete suppliers from their organization" ON "public"."suppliers" IS 'Only organization administrators and Alkatera platform admins can delete suppliers';



CREATE POLICY "Admins can manage organization weighting sets" ON "public"."ef31_weighting_sets" TO "authenticated" USING ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "ef31_weighting_sets"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))))) WITH CHECK ((("organization_id" IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "ef31_weighting_sets"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Admins can manage recalculation queue" ON "public"."lca_recalculation_queue" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "lca_recalculation_queue"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "lca_recalculation_queue"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can manage vehicles" ON "public"."vehicles" TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can remove members" ON "public"."organization_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can review pending activity data" ON "public"."pending_activity_data" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"())) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can review pending facilities" ON "public"."pending_facilities" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"())) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can review pending products" ON "public"."pending_products" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"())) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can review pending suppliers" ON "public"."pending_suppliers" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"())) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can update categories" ON "public"."knowledge_bank_categories" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can update member roles" ON "public"."organization_members" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organization_members"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Admins can update supplier products from their organization" ON "public"."supplier_products" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"()))) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can update supplier products from their organization" ON "public"."supplier_products" IS 'Only organization administrators and Alkatera platform admins can update supplier products. Note: Alkatera admins can also update verification fields via separate policy.';



CREATE POLICY "Admins can update suppliers from their organization" ON "public"."suppliers" FOR UPDATE TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"()))) WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("public"."is_organization_admin"("public"."get_current_organization_id"()) OR "public"."is_alkatera_admin"())));



COMMENT ON POLICY "Admins can update suppliers from their organization" ON "public"."suppliers" IS 'Only organization administrators and Alkatera platform admins can update suppliers';



CREATE POLICY "Admins can view all pending activity data in org" ON "public"."pending_activity_data" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can view all pending facilities in org" ON "public"."pending_facilities" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can view all pending products in org" ON "public"."pending_products" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can view all pending suppliers in org" ON "public"."pending_suppliers" FOR SELECT TO "authenticated" USING ((("organization_id" = "public"."get_current_organization_id"()) AND "public"."can_approve_data"()));



CREATE POLICY "Admins can view and manage recalculation batches" ON "public"."lca_recalculation_batches" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Alkatera admins can create messages" ON "public"."feedback_messages" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true)))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Alkatera admins can update all tickets" ON "public"."feedback_tickets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true)))));



CREATE POLICY "Alkatera admins can update messages" ON "public"."feedback_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true)))));



CREATE POLICY "Alkatera admins can verify supplier products" ON "public"."supplier_products" FOR UPDATE TO "authenticated" USING ("public"."is_alkatera_admin"()) WITH CHECK ("public"."is_alkatera_admin"());



COMMENT ON POLICY "Alkatera admins can verify supplier products" ON "public"."supplier_products" IS 'Allows Alkatera platform administrators to verify supplier products across all organizations';



CREATE POLICY "Alkatera admins can view all messages" ON "public"."feedback_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true)))));



CREATE POLICY "Alkatera admins can view all supplier products" ON "public"."supplier_products" FOR SELECT TO "authenticated" USING ("public"."is_alkatera_admin"());



COMMENT ON POLICY "Alkatera admins can view all supplier products" ON "public"."supplier_products" IS 'Allows Alkatera administrators to view supplier products from all organizations for verification purposes';



CREATE POLICY "Alkatera admins can view all tickets" ON "public"."feedback_tickets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "p"
  WHERE (("p"."id" = "auth"."uid"()) AND ("p"."is_alkatera_admin" = true)))));



CREATE POLICY "Alkatera admins have full access to blog posts" ON "public"."blog_posts" USING ("public"."is_alkatera_admin"()) WITH CHECK ("public"."is_alkatera_admin"());



CREATE POLICY "All authenticated users can read DEFRA-Ecoinvent mappings" ON "public"."defra_ecoinvent_impact_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "All authenticated users can view widgets" ON "public"."dashboard_widgets" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow all for accredited_advisors" ON "public"."accredited_advisors" USING (true) WITH CHECK (true);



CREATE POLICY "Allow all for advisor_organization_access" ON "public"."advisor_organization_access" USING (true) WITH CHECK (true);



CREATE POLICY "Allow anonymous view tracking" ON "public"."passport_views" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to create organizations" ON "public"."organizations" FOR INSERT WITH CHECK (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Allow authenticated users to view permissions" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to view roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow individual insert access based on organization" ON "public"."calculation_logs" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id")::"text" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'organization_id'::"text")));



COMMENT ON POLICY "Allow individual insert access based on organization" ON "public"."calculation_logs" IS 'Permits INSERT operations only when the new log''s organization_id matches the user''s organisation from JWT app_metadata. No UPDATE or DELETE policies exist to enforce immutability at the database level.';



CREATE POLICY "Allow individual insert access based on organization" ON "public"."data_provenance_trail" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id")::"text" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'organization_id'::"text")));



COMMENT ON POLICY "Allow individual insert access based on organization" ON "public"."data_provenance_trail" IS 'Permits INSERT operations only when the new evidence record''s organization_id matches the user''s organisation from JWT app_metadata. Ensures users cannot submit evidence on behalf of other organisations.';



CREATE POLICY "Allow individual read access based on organization" ON "public"."calculation_logs" FOR SELECT TO "authenticated" USING ((("organization_id")::"text" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'organization_id'::"text")));



COMMENT ON POLICY "Allow individual read access based on organization" ON "public"."calculation_logs" IS 'Permits SELECT operations only for logs belonging to the user''s organisation. Organisation ID is extracted from JWT app_metadata to ensure cryptographic isolation between tenants.';



CREATE POLICY "Allow individual read access based on organization" ON "public"."data_provenance_trail" FOR SELECT TO "authenticated" USING ((("organization_id")::"text" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'organization_id'::"text")));



COMMENT ON POLICY "Allow individual read access based on organization" ON "public"."data_provenance_trail" IS 'Permits SELECT operations only for evidence belonging to the user''s organisation. Organisation ID is extracted from JWT app_metadata to ensure cryptographic isolation between tenants.';



CREATE POLICY "Allow individual user to read their own membership" ON "public"."organization_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow members to access their own org's LCA materials" ON "public"."product_carbon_footprint_materials" USING (("auth"."uid"() IN ( SELECT "organization_members"."user_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."organization_id" IN ( SELECT "product_carbon_footprints"."organization_id"
           FROM "public"."product_carbon_footprints"
          WHERE ("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id"))))));



CREATE POLICY "Allow members to access their own org's ingredients" ON "public"."ingredients" USING (("auth"."uid"() IN ( SELECT "organization_members"."user_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."organization_id" = "ingredients"."organization_id"))));



CREATE POLICY "Allow members to access their own org's packaging" ON "public"."packaging_types" USING (("auth"."uid"() IN ( SELECT "organization_members"."user_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."organization_id" = "packaging_types"."organization_id"))));



CREATE POLICY "Allow members to manage products within their organization" ON "public"."products" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK ("public"."is_member_of"("organization_id"));



CREATE POLICY "Allow members to view their organizations" ON "public"."organizations" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "organizations"."id") AND ("organization_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."advisor_organization_access"
  WHERE (("advisor_organization_access"."organization_id" = "organizations"."id") AND ("advisor_organization_access"."advisor_user_id" = "auth"."uid"()) AND ("advisor_organization_access"."is_active" = true))))));



CREATE POLICY "Allow public to view organization info for passports" ON "public"."organizations" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."organization_id" = "organizations"."id") AND ("products"."passport_enabled" = true)))));



CREATE POLICY "Allow read access to verification history based on organization" ON "public"."data_provenance_verification_history" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."data_provenance_trail"
  WHERE (("data_provenance_trail"."provenance_id" = "data_provenance_verification_history"."provenance_id") AND (("data_provenance_trail"."organization_id")::"text" = (("auth"."jwt"() -> 'app_metadata'::"text") ->> 'organization_id'::"text"))))));



CREATE POLICY "Allow read-only access to authenticated users" ON "public"."emissions_factors" FOR SELECT TO "authenticated" USING (true);



COMMENT ON POLICY "Allow read-only access to authenticated users" ON "public"."emissions_factors" IS 'Permits SELECT operations only. No INSERT, UPDATE, or DELETE policies exist to enforce immutability at database level. All modifications must be performed via database migrations.';



CREATE POLICY "Allow user to update their own records" ON "public"."data_provenance_trail" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Allow user to update their own records" ON "public"."data_provenance_trail" IS 'Permits UPDATE operations only on records where the user_id matches the authenticated user. This allows users to update descriptions or verification status of their own uploads. No DELETE policy exists to ensure permanent retention of all evidence.';



CREATE POLICY "Allow users to view profiles of members in their own organizati" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("auth"."uid"() = "id") OR ("id" IN ( SELECT "organization_members"."user_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."organization_id" = "public"."get_current_organization_id"())))));



COMMENT ON POLICY "Allow users to view profiles of members in their own organizati" ON "public"."profiles" IS 'Users can view their own profile and profiles of all members in their organization. Uses get_current_organization_id() as single source of truth.';



CREATE POLICY "Anyone can read active knowledge base" ON "public"."gaia_knowledge_base" FOR SELECT TO "authenticated" USING (("is_active" = true));



CREATE POLICY "Anyone can view completed LCAs" ON "public"."product_carbon_footprints" FOR SELECT TO "anon" USING (("status" = 'completed'::"text"));



CREATE POLICY "Anyone can view fleet emission sources" ON "public"."fleet_emission_sources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view invitations by valid token" ON "public"."supplier_invitations" FOR SELECT TO "anon" USING ((("invitation_token" IS NOT NULL) AND ("status" = 'pending'::"public"."supplier_invitation_status") AND ("expires_at" > "now"())));



CREATE POLICY "Anyone can view materials for completed LCAs" ON "public"."product_carbon_footprint_materials" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("product_carbon_footprints"."status" = 'completed'::"text")))));



CREATE POLICY "Anyone can view platform suppliers" ON "public"."platform_suppliers" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Anyone can view tier limits" ON "public"."subscription_tier_limits" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read facility types" ON "public"."facility_types" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can read proxy mappings" ON "public"."product_category_proxy_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view DEFRA factors" ON "public"."defra_energy_emission_factors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view DEFRA-Ecoinvent mappings" ON "public"."defra_ecoinvent_impact_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view EF 3.1 impact categories" ON "public"."ef31_impact_categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view EF 3.1 process mappings" ON "public"."ef31_process_mappings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view Ecoinvent proxies" ON "public"."ecoinvent_material_proxies" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view emission sources" ON "public"."scope_1_2_emission_sources" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view normalisation factors" ON "public"."ef31_normalisation_factors" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view permissions" ON "public"."permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view roles" ON "public"."roles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view tier features" ON "public"."subscription_tier_features" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can view verified platform supplier product" ON "public"."platform_supplier_products" FOR SELECT TO "authenticated" USING (("is_verified" = true));



CREATE POLICY "Authors and admins can update items" ON "public"."knowledge_bank_items" FOR UPDATE TO "authenticated" USING ((("author_id" = "auth"."uid"()) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Only Alkatera admins can insert feature usage" ON "public"."platform_feature_usage" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can insert org stats" ON "public"."platform_organization_stats" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can insert platform usage metrics" ON "public"."platform_usage_metrics" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can view activity log" ON "public"."platform_activity_log" FOR SELECT TO "authenticated" USING ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can view feature usage" ON "public"."platform_feature_usage" FOR SELECT TO "authenticated" USING ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can view org stats" ON "public"."platform_organization_stats" FOR SELECT TO "authenticated" USING ("public"."is_alkatera_admin"());



CREATE POLICY "Only Alkatera admins can view platform usage metrics" ON "public"."platform_usage_metrics" FOR SELECT TO "authenticated" USING ("public"."is_alkatera_admin"());



CREATE POLICY "Organization admins can add suppliers" ON "public"."organization_suppliers" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("r"."id" = "om"."role_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Organization admins can create OpenLCA configuration" ON "public"."openlca_configurations" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_organization_admin"("organization_id"));



CREATE POLICY "Organization admins can create facilities" ON "public"."facilities" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins can delete OpenLCA configuration" ON "public"."openlca_configurations" FOR DELETE TO "authenticated" USING ("public"."is_organization_admin"("organization_id"));



CREATE POLICY "Organization admins can delete facilities" ON "public"."facilities" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins can delete import sessions" ON "public"."bulk_import_sessions" FOR DELETE TO "authenticated" USING (("public"."get_my_organization_role"("organization_id") = 'company_admin'::"public"."organization_role"));



CREATE POLICY "Organization admins can remove suppliers" ON "public"."organization_suppliers" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("r"."id" = "om"."role_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Organization admins can update OpenLCA configuration" ON "public"."openlca_configurations" FOR UPDATE TO "authenticated" USING ("public"."is_organization_admin"("organization_id")) WITH CHECK ("public"."is_organization_admin"("organization_id"));



CREATE POLICY "Organization admins can update facilities" ON "public"."facilities" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organization admins can update suppliers" ON "public"."organization_suppliers" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("r"."id" = "om"."role_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'owner'::"text"])))))) WITH CHECK (("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("r"."id" = "om"."role_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['admin'::"text", 'owner'::"text"]))))));



CREATE POLICY "Organization members can create LCA results" ON "public"."product_carbon_footprint_results" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("product_carbon_footprints"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organization members can create allocations" ON "public"."contract_manufacturer_allocations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can create import sessions" ON "public"."bulk_import_sessions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bulk_import_sessions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can delete LCA results" ON "public"."product_carbon_footprint_results" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("product_carbon_footprints"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organization members can delete activity data" ON "public"."activity_data" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Organization members can insert activity data" ON "public"."activity_data" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Organization members can select activity data" ON "public"."activity_data" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Organization members can select calculated emissions" ON "public"."calculated_emissions" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Organization members can update LCA results" ON "public"."product_carbon_footprint_results" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("product_carbon_footprints"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("product_carbon_footprints"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organization members can update activity data" ON "public"."activity_data" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Organization members can update allocations" ON "public"."contract_manufacturer_allocations" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND (("status" = ANY (ARRAY['draft'::"text", 'provisional'::"text"])) OR (EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can update their import sessions" ON "public"."bulk_import_sessions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bulk_import_sessions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bulk_import_sessions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can view LCA results" ON "public"."product_carbon_footprint_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."product_carbon_footprints"
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("product_carbon_footprints"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))));



CREATE POLICY "Organization members can view OpenLCA configuration" ON "public"."openlca_configurations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "openlca_configurations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can view allocations" ON "public"."contract_manufacturer_allocations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "contract_manufacturer_allocations"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can view calculated metrics" ON "public"."calculated_metrics" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organization members can view facilities" ON "public"."facilities" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organization members can view passport analytics" ON "public"."passport_views" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "passport_views"."product_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can view their import sessions" ON "public"."bulk_import_sessions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bulk_import_sessions"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Organization members can view their suppliers" ON "public"."organization_suppliers" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organization owners can delete their organization" ON "public"."organizations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = 'owner'::"text")))));



CREATE POLICY "Organization owners can update their organization" ON "public"."organizations" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organizations"."id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Organizations can insert own demographics" ON "public"."people_workforce_demographics" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can insert own people culture scores" ON "public"."people_culture_scores" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can update own demographics" ON "public"."people_workforce_demographics" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can update own people culture scores" ON "public"."people_culture_scores" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can view own people culture scores" ON "public"."people_culture_scores" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can view own snapshots" ON "public"."vitality_score_snapshots" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Organizations can view own vitality scores" ON "public"."organization_vitality_scores" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Platform admins can access analytics" ON "public"."gaia_analytics" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can create suppliers" ON "public"."platform_suppliers" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can delete suppliers" ON "public"."platform_suppliers" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can manage all platform supplier products" ON "public"."platform_supplier_products" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can manage knowledge base" ON "public"."gaia_knowledge_base" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can update feedback" ON "public"."gaia_feedback" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can update suppliers" ON "public"."platform_suppliers" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("o"."id" = "om"."organization_id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can view all conversations" ON "public"."gaia_conversations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can view all feedback" ON "public"."gaia_feedback" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Platform admins can view all messages" ON "public"."gaia_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."organizations" "o" ON (("om"."organization_id" = "o"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("o"."is_platform_admin" = true)))));



CREATE POLICY "Public access to enabled product passports" ON "public"."products" FOR SELECT TO "anon" USING (("passport_enabled" = true));



CREATE POLICY "Public can view LCAs for products with enabled passports" ON "public"."product_carbon_footprints" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM "public"."products"
  WHERE (("products"."id" = "product_carbon_footprints"."product_id") AND ("products"."passport_enabled" = true)))));



CREATE POLICY "Public can view materials for products with enabled passports" ON "public"."product_carbon_footprint_materials" FOR SELECT TO "anon" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."products" ON (("products"."id" = "product_carbon_footprints"."product_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("products"."passport_enabled" = true)))));



CREATE POLICY "Public can view published blog posts" ON "public"."blog_posts" FOR SELECT USING (("status" = 'published'::"text"));



CREATE POLICY "Service role bypass for corporate_overheads" ON "public"."corporate_overheads" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for facilities" ON "public"."facilities" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for facility_activity_entries" ON "public"."facility_activity_entries" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for facility_water_data" ON "public"."facility_water_data" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for fleet_activities" ON "public"."fleet_activities" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for gaia_knowledge_base" ON "public"."gaia_knowledge_base" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for organization_members" ON "public"."organization_members" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for organization_vitality_scores" ON "public"."organization_vitality_scores" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for organizations" ON "public"."organizations" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for product_lcas" ON "public"."product_carbon_footprints" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for products" ON "public"."products" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role bypass for suppliers" ON "public"."suppliers" FOR SELECT TO "service_role" USING (true);



CREATE POLICY "Service role can delete calculated metrics" ON "public"."calculated_metrics" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Service role can insert LCA results" ON "public"."product_carbon_footprint_results" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert calculated metrics" ON "public"."calculated_metrics" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Service role can insert calculation logs" ON "public"."product_lca_calculation_logs" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can insert facility emissions" ON "public"."facility_emissions_aggregated" FOR INSERT TO "service_role" WITH CHECK (true);



CREATE POLICY "Service role can manage DEFRA-Ecoinvent mappings" ON "public"."defra_ecoinvent_impact_mappings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage Ecoinvent proxies" ON "public"."ecoinvent_material_proxies" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage gaia_conversations" ON "public"."gaia_conversations" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage gaia_messages" ON "public"."gaia_messages" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage people culture scores" ON "public"."people_culture_scores" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage snapshots" ON "public"."vitality_score_snapshots" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can manage vitality scores" ON "public"."organization_vitality_scores" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can update calculated metrics" ON "public"."calculated_metrics" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Service role can update facility emissions" ON "public"."facility_emissions_aggregated" FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to batches" ON "public"."spend_import_batches" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role has full access to items" ON "public"."spend_import_items" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can create recommendations" ON "public"."supplier_data_upgrade_recommendations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "System can insert activity log" ON "public"."platform_activity_log" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "System can insert notifications" ON "public"."user_notifications" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Users can add vehicles to their organization" ON "public"."vehicles" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create KPIs in their organization" ON "public"."kpis" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can create LCAs for their organization" ON "public"."product_carbon_footprints" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create activity log for their organization" ON "public"."activity_log" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can create assessments in their organization" ON "public"."greenwash_assessments" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "greenwash_assessments"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create assignments for their organization" ON "public"."facility_product_assignments" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create claims for assessments in their organization" ON "public"."greenwash_assessment_claims" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."greenwash_assessments" "ga"
     JOIN "public"."organization_members" "om" ON (("ga"."organization_id" = "om"."organization_id")))
  WHERE (("ga"."id" = "greenwash_assessment_claims"."assessment_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create conversations" ON "public"."gaia_conversations" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "gaia_conversations"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can create data points for their organization" ON "public"."kpi_data_points" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."kpis"
  WHERE (("kpis"."id" = "kpi_data_points"."kpi_id") AND ("kpis"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can create emissions in their organization" ON "public"."ghg_emissions" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can create engagements for their organization" ON "public"."supplier_engagements" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."suppliers"
  WHERE (("suppliers"."id" = "supplier_engagements"."supplier_id") AND ("suppliers"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can create feedback" ON "public"."gaia_feedback" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can create import batches for own organization" ON "public"."spend_import_batches" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "spend_import_batches"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create import items for own organization" ON "public"."spend_import_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."spend_import_batches" "b"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "b"."organization_id")))
  WHERE (("b"."id" = "spend_import_items"."batch_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create invitations in their organization" ON "public"."supplier_invitations" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can create messages for their organization tickets" ON "public"."feedback_messages" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM ("public"."feedback_tickets" "ft"
     JOIN "public"."organization_members" "om" ON (("ft"."organization_id" = "om"."organization_id")))
  WHERE (("ft"."id" = "feedback_messages"."ticket_id") AND ("om"."user_id" = "auth"."uid"())))) AND ("sender_id" = "auth"."uid"())));



CREATE POLICY "Users can create messages in their conversations" ON "public"."gaia_messages" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."gaia_conversations" "gc"
  WHERE (("gc"."id" = "gaia_messages"."conversation_id") AND ("gc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can create reporting sessions for their organization" ON "public"."facility_reporting_sessions" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create reports for their organization" ON "public"."generated_reports" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can create tags" ON "public"."knowledge_bank_tags" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can create tickets for their organization" ON "public"."feedback_tickets" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "feedback_tickets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))) AND ("created_by" = "auth"."uid"())));



CREATE POLICY "Users can delete BOM imports for their organization" ON "public"."bom_imports" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bom_imports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete DEI actions for their organization" ON "public"."people_dei_actions" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete KPIs from their organization" ON "public"."kpis" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can delete LCAs for their organization" ON "public"."product_carbon_footprints" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete activity log from their organization" ON "public"."activity_log" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can delete assessments in their organization" ON "public"."greenwash_assessments" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "greenwash_assessments"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete assignments for their organization" ON "public"."facility_product_assignments" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete benefits for their organization" ON "public"."people_benefits" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete claims for assessments in their organization" ON "public"."greenwash_assessment_claims" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."greenwash_assessments" "ga"
     JOIN "public"."organization_members" "om" ON (("ga"."organization_id" = "om"."organization_id")))
  WHERE (("ga"."id" = "greenwash_assessment_claims"."assessment_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete compensation data for their organization" ON "public"."people_employee_compensation" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete corporate overheads for their reports" ON "public"."corporate_overheads" FOR DELETE TO "authenticated" USING (("report_id" IN ( SELECT "corporate_reports"."id"
   FROM "public"."corporate_reports"
  WHERE ("corporate_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete data points from their organization" ON "public"."kpi_data_points" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kpis"
  WHERE (("kpis"."id" = "kpi_data_points"."kpi_id") AND ("kpis"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can delete demographics for their organization" ON "public"."people_workforce_demographics" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete emissions from their organization" ON "public"."ghg_emissions" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can delete energy inputs for draft allocations" ON "public"."contract_manufacturer_energy_inputs" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contract_manufacturer_allocations" "cma"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cma"."organization_id")))
  WHERE (("cma"."id" = "contract_manufacturer_energy_inputs"."allocation_id") AND ("om"."user_id" = "auth"."uid"()) AND ("cma"."status" = ANY (ARRAY['draft'::"text", 'provisional'::"text"]))))));



CREATE POLICY "Users can delete engagements from their organization" ON "public"."supplier_engagements" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."suppliers"
  WHERE (("suppliers"."id" = "supplier_engagements"."supplier_id") AND ("suppliers"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can delete extracted items for their organization" ON "public"."bom_extracted_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bom_imports"
     JOIN "public"."organization_members" ON (("bom_imports"."organization_id" = "organization_members"."organization_id")))
  WHERE (("bom_imports"."id" = "bom_extracted_items"."bom_import_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete facility activity data in their organization" ON "public"."facility_activity_data" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_activity_data"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete facility water data for their organisation" ON "public"."facility_water_data" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete fleet activities in their organization" ON "public"."fleet_activities" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete invitations from their organization" ON "public"."supplier_invitations" FOR DELETE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can delete materials for their organization's PCFs" ON "public"."product_carbon_footprint_materials" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete materials for their organization's products" ON "public"."product_materials" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "product_materials"."product_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own dashboard preferences" ON "public"."user_dashboard_preferences" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own organization corporate reports" ON "public"."corporate_reports" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own organization production logs" ON "public"."production_logs" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own organization spend imports" ON "public"."spend_import_batches" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete own organization's import batches" ON "public"."spend_import_batches" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "spend_import_batches"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own organization's import items" ON "public"."spend_import_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."spend_import_batches" "b"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "b"."organization_id")))
  WHERE (("b"."id" = "spend_import_items"."batch_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete own pending activity data" ON "public"."pending_activity_data" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can delete own pending facilities" ON "public"."pending_facilities" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can delete own pending products" ON "public"."pending_products" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can delete own pending suppliers" ON "public"."pending_suppliers" FOR DELETE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can delete production mix for their organization" ON "public"."lca_production_mix" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints" "pl"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "pl"."organization_id")))
  WHERE (("pl"."id" = "lca_production_mix"."lca_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete reporting sessions for their organization" ON "public"."facility_reporting_sessions" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete social indicators for their organization's rep" ON "public"."lca_social_indicators" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."lca_reports"
     JOIN "public"."organization_members" ON (("organization_members"."organization_id" = "lca_reports"."organization_id")))
  WHERE (("lca_reports"."id" = "lca_social_indicators"."report_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete spend import items for their batches" ON "public"."spend_import_items" FOR DELETE TO "authenticated" USING (("batch_id" IN ( SELECT "spend_import_batches"."id"
   FROM "public"."spend_import_batches"
  WHERE ("spend_import_batches"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can delete survey responses for their organization" ON "public"."people_survey_responses" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete surveys for their organization" ON "public"."people_employee_surveys" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their organization's reports" ON "public"."generated_reports" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete their organization's reports" ON "public"."lca_reports" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "lca_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete their own conversations" ON "public"."gaia_conversations" FOR DELETE TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete training records for their organization" ON "public"."people_training_records" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can delete utility data for their organization facilities" ON "public"."utility_data_entries" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete vehicles in their organization" ON "public"."vehicles" FOR DELETE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert BOM imports for their organization" ON "public"."bom_imports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bom_imports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert DEI actions for their organization" ON "public"."people_dei_actions" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert audit logs for their organization" ON "public"."ingredient_selection_audit" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "ingredient_selection_audit"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert audit logs for their organization's LCAs" ON "public"."lca_workflow_audit" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "lca_workflow_audit"."product_lca_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert benefits for their organization" ON "public"."people_benefits" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert compensation data for their organization" ON "public"."people_employee_compensation" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert corporate overheads for their reports" ON "public"."corporate_overheads" FOR INSERT TO "authenticated" WITH CHECK (("report_id" IN ( SELECT "corporate_reports"."id"
   FROM "public"."corporate_reports"
  WHERE ("corporate_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert demographics for their organization" ON "public"."people_workforce_demographics" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert emissions for their organization's facilities" ON "public"."facility_emissions_aggregated" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "facility_emissions_aggregated"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert energy inputs for their allocations" ON "public"."contract_manufacturer_energy_inputs" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contract_manufacturer_allocations" "cma"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cma"."organization_id")))
  WHERE (("cma"."id" = "contract_manufacturer_energy_inputs"."allocation_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert extracted items for their organization" ON "public"."bom_extracted_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."bom_imports"
     JOIN "public"."organization_members" ON (("bom_imports"."organization_id" = "organization_members"."organization_id")))
  WHERE (("bom_imports"."id" = "bom_extracted_items"."bom_import_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert facility activity data in their organization" ON "public"."facility_activity_data" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_activity_data"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert facility water data for their organisation" ON "public"."facility_water_data" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert fleet activities for their organization" ON "public"."fleet_activities" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert materials for their organization's PCFs" ON "public"."product_carbon_footprint_materials" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert materials for their organization's products" ON "public"."product_materials" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "product_materials"."product_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own dashboard preferences" ON "public"."user_dashboard_preferences" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own organization category patterns" ON "public"."spend_category_patterns" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own organization corporate reports" ON "public"."corporate_reports" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own organization production logs" ON "public"."production_logs" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own organization spend imports" ON "public"."spend_import_batches" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert production mix for their organization" ON "public"."lca_production_mix" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints" "pl"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "pl"."organization_id")))
  WHERE (("pl"."id" = "lca_production_mix"."lca_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert reports for their organization" ON "public"."lca_reports" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "lca_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert social indicators for their organization's rep" ON "public"."lca_social_indicators" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."lca_reports"
     JOIN "public"."organization_members" ON (("organization_members"."organization_id" = "lca_reports"."organization_id")))
  WHERE (("lca_reports"."id" = "lca_social_indicators"."report_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert spend import items for their batches" ON "public"."spend_import_items" FOR INSERT TO "authenticated" WITH CHECK (("batch_id" IN ( SELECT "spend_import_batches"."id"
   FROM "public"."spend_import_batches"
  WHERE ("spend_import_batches"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can insert staging factors for their organisation" ON "public"."staging_emission_factors" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "staging_emission_factors"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert survey responses for their organization" ON "public"."people_survey_responses" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert surveys for their organization" ON "public"."people_employee_surveys" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert training records for their organization" ON "public"."people_training_records" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can insert utility data for their organization facilities" ON "public"."utility_data_entries" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can log fleet activities for their organization" ON "public"."fleet_activities" FOR INSERT TO "authenticated" WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage PCFs for their organization" ON "public"."product_carbon_footprints" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage data contracts for their organization faciliti" ON "public"."facility_data_contracts" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_data_contracts"."facility_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_data_contracts"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage discharge quality for their organisation" ON "public"."facility_water_discharge_quality" TO "authenticated" USING (("facility_id" IN ( SELECT "f"."id"
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE ("om"."user_id" = "auth"."uid"())))) WITH CHECK (("facility_id" IN ( SELECT "f"."id"
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can manage inputs for their organization's PCFs" ON "public"."product_carbon_footprint_inputs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_inputs"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_inputs"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage item tags" ON "public"."knowledge_bank_item_tags" TO "authenticated" USING (("item_id" IN ( SELECT "knowledge_bank_items"."id"
   FROM "public"."knowledge_bank_items"
  WHERE ("knowledge_bank_items"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can manage production sites for their organization" ON "public"."product_carbon_footprint_production_sites" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprint_production_sites"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprint_production_sites"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own favorites" ON "public"."knowledge_bank_favorites" TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can record views" ON "public"."knowledge_bank_views" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can submit pending activity data" ON "public"."pending_activity_data" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("submitted_by" = "auth"."uid"())));



CREATE POLICY "Users can submit pending facilities" ON "public"."pending_facilities" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("submitted_by" = "auth"."uid"())));



CREATE POLICY "Users can submit pending products" ON "public"."pending_products" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("submitted_by" = "auth"."uid"())));



CREATE POLICY "Users can submit pending suppliers" ON "public"."pending_suppliers" FOR INSERT TO "authenticated" WITH CHECK ((("organization_id" = "public"."get_current_organization_id"()) AND ("submitted_by" = "auth"."uid"())));



CREATE POLICY "Users can update BOM imports for their organization" ON "public"."bom_imports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bom_imports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bom_imports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update DEI actions for their organization" ON "public"."people_dei_actions" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update KPIs from their organization" ON "public"."kpis" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can update LCAs for their organization" ON "public"."product_carbon_footprints" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update activity log from their organization" ON "public"."activity_log" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can update assessments in their organization" ON "public"."greenwash_assessments" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "greenwash_assessments"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "greenwash_assessments"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update assignments for their organization" ON "public"."facility_product_assignments" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update benefits for their organization" ON "public"."people_benefits" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update compensation data for their organization" ON "public"."people_employee_compensation" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update corporate overheads for their reports" ON "public"."corporate_overheads" FOR UPDATE TO "authenticated" USING (("report_id" IN ( SELECT "corporate_reports"."id"
   FROM "public"."corporate_reports"
  WHERE ("corporate_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))) WITH CHECK (("report_id" IN ( SELECT "corporate_reports"."id"
   FROM "public"."corporate_reports"
  WHERE ("corporate_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update data points from their organization" ON "public"."kpi_data_points" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kpis"
  WHERE (("kpis"."id" = "kpi_data_points"."kpi_id") AND ("kpis"."organization_id" = "public"."get_current_organization_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."kpis"
  WHERE (("kpis"."id" = "kpi_data_points"."kpi_id") AND ("kpis"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can update demographics for their organization" ON "public"."people_workforce_demographics" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update emissions for their organization's facilities" ON "public"."facility_emissions_aggregated" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "facility_emissions_aggregated"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "facility_emissions_aggregated"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update emissions from their organization" ON "public"."ghg_emissions" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can update energy inputs for draft allocations" ON "public"."contract_manufacturer_energy_inputs" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contract_manufacturer_allocations" "cma"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cma"."organization_id")))
  WHERE (("cma"."id" = "contract_manufacturer_energy_inputs"."allocation_id") AND ("om"."user_id" = "auth"."uid"()) AND ("cma"."status" = ANY (ARRAY['draft'::"text", 'provisional'::"text"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."contract_manufacturer_allocations" "cma"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cma"."organization_id")))
  WHERE (("cma"."id" = "contract_manufacturer_energy_inputs"."allocation_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update engagements from their organization" ON "public"."supplier_engagements" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."suppliers"
  WHERE (("suppliers"."id" = "supplier_engagements"."supplier_id") AND ("suppliers"."organization_id" = "public"."get_current_organization_id"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."suppliers"
  WHERE (("suppliers"."id" = "supplier_engagements"."supplier_id") AND ("suppliers"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can update extracted items for their organization" ON "public"."bom_extracted_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bom_imports"
     JOIN "public"."organization_members" ON (("bom_imports"."organization_id" = "organization_members"."organization_id")))
  WHERE (("bom_imports"."id" = "bom_extracted_items"."bom_import_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."bom_imports"
     JOIN "public"."organization_members" ON (("bom_imports"."organization_id" = "organization_members"."organization_id")))
  WHERE (("bom_imports"."id" = "bom_extracted_items"."bom_import_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update facility activity data in their organization" ON "public"."facility_activity_data" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_activity_data"."facility_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_activity_data"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update facility water data for their organisation" ON "public"."facility_water_data" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update fleet activities in their organization" ON "public"."fleet_activities" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update invitations from their organization" ON "public"."supplier_invitations" FOR UPDATE TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"())) WITH CHECK (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can update materials for their organization's PCFs" ON "public"."product_carbon_footprint_materials" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update materials for their organization's products" ON "public"."product_materials" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "product_materials"."product_id") AND ("organization_members"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "product_materials"."product_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update messages for their tickets" ON "public"."feedback_messages" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."feedback_tickets" "ft"
  WHERE (("ft"."id" = "feedback_messages"."ticket_id") AND ("ft"."created_by" = "auth"."uid"())))));



CREATE POLICY "Users can update own dashboard preferences" ON "public"."user_dashboard_preferences" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notifications" ON "public"."user_notifications" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update own organization category patterns" ON "public"."spend_category_patterns" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own organization corporate reports" ON "public"."corporate_reports" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own organization production logs" ON "public"."production_logs" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own organization spend imports" ON "public"."spend_import_batches" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update own organization's import batches" ON "public"."spend_import_batches" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "spend_import_batches"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own organization's import items" ON "public"."spend_import_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."spend_import_batches" "b"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "b"."organization_id")))
  WHERE (("b"."id" = "spend_import_items"."batch_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update own pending activity data" ON "public"."pending_activity_data" FOR UPDATE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum"))) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can update own pending facilities" ON "public"."pending_facilities" FOR UPDATE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum"))) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can update own pending products" ON "public"."pending_products" FOR UPDATE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum"))) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can update own pending suppliers" ON "public"."pending_suppliers" FOR UPDATE TO "authenticated" USING ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum"))) WITH CHECK ((("submitted_by" = "auth"."uid"()) AND ("approval_status" = 'pending'::"public"."approval_status_enum")));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update production mix for their organization" ON "public"."lca_production_mix" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints" "pl"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "pl"."organization_id")))
  WHERE (("pl"."id" = "lca_production_mix"."lca_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints" "pl"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "pl"."organization_id")))
  WHERE (("pl"."id" = "lca_production_mix"."lca_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update recommendations for their organization" ON "public"."supplier_data_upgrade_recommendations" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update reporting sessions for their organization" ON "public"."facility_reporting_sessions" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update social indicators for their organization's rep" ON "public"."lca_social_indicators" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."lca_reports"
     JOIN "public"."organization_members" ON (("organization_members"."organization_id" = "lca_reports"."organization_id")))
  WHERE (("lca_reports"."id" = "lca_social_indicators"."report_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update spend import items for their batches" ON "public"."spend_import_items" FOR UPDATE TO "authenticated" USING (("batch_id" IN ( SELECT "spend_import_batches"."id"
   FROM "public"."spend_import_batches"
  WHERE ("spend_import_batches"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"())))))) WITH CHECK (("batch_id" IN ( SELECT "spend_import_batches"."id"
   FROM "public"."spend_import_batches"
  WHERE ("spend_import_batches"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can update survey responses for their organization" ON "public"."people_survey_responses" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update surveys for their organization" ON "public"."people_employee_surveys" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their organization's reports" ON "public"."generated_reports" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update their organization's reports" ON "public"."lca_reports" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "lca_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own conversations" ON "public"."gaia_conversations" FOR UPDATE TO "authenticated" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can update their own fleet activities" ON "public"."fleet_activities" FOR UPDATE TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR ("organization_id" IN ( SELECT "om"."organization_id"
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"])))))));



CREATE POLICY "Users can update their own tickets" ON "public"."feedback_tickets" FOR UPDATE TO "authenticated" USING (("created_by" = "auth"."uid"())) WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "Users can update training records for their organization" ON "public"."people_training_records" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can update utility data for their organization facilities" ON "public"."utility_data_entries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update vehicles in their organization" ON "public"."vehicles" FOR UPDATE TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"())))) WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view BOM imports for their organization" ON "public"."bom_imports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "bom_imports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view DEI actions for their organization" ON "public"."people_dei_actions" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view KPIs from their organization" ON "public"."kpis" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view LCAs for their organization" ON "public"."product_carbon_footprints" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "product_carbon_footprints"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view activity log from their organization" ON "public"."activity_log" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view assessments in their organization" ON "public"."greenwash_assessments" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "greenwash_assessments"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view assignments for their organization" ON "public"."facility_product_assignments" FOR SELECT TO "authenticated" USING ((("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))) OR ("organization_id" IN ( SELECT "advisor_organization_access"."organization_id"
   FROM "public"."advisor_organization_access"
  WHERE (("advisor_organization_access"."advisor_user_id" = "auth"."uid"()) AND ("advisor_organization_access"."is_active" = true))))));



CREATE POLICY "Users can view audit logs for their organization" ON "public"."ingredient_selection_audit" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "ingredient_selection_audit"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view audit logs for their organization's LCAs" ON "public"."lca_workflow_audit" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "lca_workflow_audit"."product_lca_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view benefits for their organization" ON "public"."people_benefits" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view claims for assessments in their organization" ON "public"."greenwash_assessment_claims" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."greenwash_assessments" "ga"
     JOIN "public"."organization_members" "om" ON (("ga"."organization_id" = "om"."organization_id")))
  WHERE (("ga"."id" = "greenwash_assessment_claims"."assessment_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view compensation data for their organization" ON "public"."people_employee_compensation" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view corporate overheads for their reports" ON "public"."corporate_overheads" FOR SELECT TO "authenticated" USING (("report_id" IN ( SELECT "corporate_reports"."id"
   FROM "public"."corporate_reports"
  WHERE ("corporate_reports"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view data contracts for their organization facilities" ON "public"."facility_data_contracts" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_data_contracts"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view data points from their organization" ON "public"."kpi_data_points" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."kpis"
  WHERE (("kpis"."id" = "kpi_data_points"."kpi_id") AND ("kpis"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can view demographics for their organization" ON "public"."people_workforce_demographics" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view discharge quality for their organisation" ON "public"."facility_water_discharge_quality" FOR SELECT TO "authenticated" USING (("facility_id" IN ( SELECT "f"."id"
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE ("om"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view emissions for their organization's facilities" ON "public"."facility_emissions_aggregated" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "facility_emissions_aggregated"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view emissions from their organization" ON "public"."ghg_emissions" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view energy inputs for their allocations" ON "public"."contract_manufacturer_energy_inputs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."contract_manufacturer_allocations" "cma"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "cma"."organization_id")))
  WHERE (("cma"."id" = "contract_manufacturer_energy_inputs"."allocation_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view engagements from their organization" ON "public"."supplier_engagements" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."suppliers"
  WHERE (("suppliers"."id" = "supplier_engagements"."supplier_id") AND ("suppliers"."organization_id" = "public"."get_current_organization_id"())))));



CREATE POLICY "Users can view extracted items for their organization" ON "public"."bom_extracted_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."bom_imports"
     JOIN "public"."organization_members" ON (("bom_imports"."organization_id" = "organization_members"."organization_id")))
  WHERE (("bom_imports"."id" = "bom_extracted_items"."bom_import_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view facility activity data in their organization" ON "public"."facility_activity_data" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "facility_activity_data"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view facility water data for their organisation" ON "public"."facility_water_data" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view fleet activities in their organization" ON "public"."fleet_activities" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view invitations from their organization" ON "public"."supplier_invitations" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view item tags" ON "public"."knowledge_bank_item_tags" FOR SELECT TO "authenticated" USING (("item_id" IN ( SELECT "knowledge_bank_items"."id"
   FROM "public"."knowledge_bank_items"
  WHERE ("knowledge_bank_items"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view materials for their organization's PCFs" ON "public"."product_carbon_footprint_materials" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_materials"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view materials for their organization's products" ON "public"."product_materials" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."products"
     JOIN "public"."organization_members" ON (("products"."organization_id" = "organization_members"."organization_id")))
  WHERE (("products"."id" = "product_materials"."product_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view messages for their organization tickets" ON "public"."feedback_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."feedback_tickets" "ft"
     JOIN "public"."organization_members" "om" ON (("ft"."organization_id" = "om"."organization_id")))
  WHERE (("ft"."id" = "feedback_messages"."ticket_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view messages in their conversations" ON "public"."gaia_messages" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."gaia_conversations" "gc"
  WHERE (("gc"."id" = "gaia_messages"."conversation_id") AND ("gc"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view organization reporting sessions" ON "public"."facility_reporting_sessions" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own dashboard preferences" ON "public"."user_dashboard_preferences" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own notifications" ON "public"."user_notifications" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own organization category patterns" ON "public"."spend_category_patterns" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own organization corporate reports" ON "public"."corporate_reports" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own organization production logs" ON "public"."production_logs" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own organization spend imports" ON "public"."spend_import_batches" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view own organization's import batches" ON "public"."spend_import_batches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "spend_import_batches"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own organization's import items" ON "public"."spend_import_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."spend_import_batches" "b"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "b"."organization_id")))
  WHERE (("b"."id" = "spend_import_items"."batch_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own pending activity data" ON "public"."pending_activity_data" FOR SELECT TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "Users can view own pending facilities" ON "public"."pending_facilities" FOR SELECT TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "Users can view own pending products" ON "public"."pending_products" FOR SELECT TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "Users can view own pending suppliers" ON "public"."pending_suppliers" FOR SELECT TO "authenticated" USING (("submitted_by" = "auth"."uid"()));



CREATE POLICY "Users can view production mix for their organization" ON "public"."lca_production_mix" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints" "pl"
     JOIN "public"."organization_members" "om" ON (("om"."organization_id" = "pl"."organization_id")))
  WHERE (("pl"."id" = "lca_production_mix"."lca_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view published items in their organization" ON "public"."knowledge_bank_items" FOR SELECT TO "authenticated" USING ((("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))) AND (("status" = 'published'::"text") OR ("author_id" = "auth"."uid"()))));



CREATE POLICY "Users can view published reports from any organization" ON "public"."lca_reports" FOR SELECT TO "authenticated" USING ((("status" = 'published'::"public"."lca_report_status") OR ("status" = 'verified'::"public"."lca_report_status")));



CREATE POLICY "Users can view recommendations for their organization" ON "public"."supplier_data_upgrade_recommendations" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view results for their organization's PCFs" ON "public"."product_carbon_footprint_results" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."product_carbon_footprints"
     JOIN "public"."organization_members" ON (("product_carbon_footprints"."organization_id" = "organization_members"."organization_id")))
  WHERE (("product_carbon_footprints"."id" = "product_carbon_footprint_results"."product_carbon_footprint_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view social indicators for accessible reports" ON "public"."lca_social_indicators" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM ("public"."lca_reports"
     JOIN "public"."organization_members" ON (("organization_members"."organization_id" = "lca_reports"."organization_id")))
  WHERE (("lca_reports"."id" = "lca_social_indicators"."report_id") AND ("organization_members"."user_id" = "auth"."uid"())))) OR (EXISTS ( SELECT 1
   FROM "public"."lca_reports"
  WHERE (("lca_reports"."id" = "lca_social_indicators"."report_id") AND (("lca_reports"."status" = 'published'::"public"."lca_report_status") OR ("lca_reports"."status" = 'verified'::"public"."lca_report_status")))))));



CREATE POLICY "Users can view spend import items for their batches" ON "public"."spend_import_items" FOR SELECT TO "authenticated" USING (("batch_id" IN ( SELECT "spend_import_batches"."id"
   FROM "public"."spend_import_batches"
  WHERE ("spend_import_batches"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view staging factors in their organisation" ON "public"."staging_emission_factors" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "staging_emission_factors"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view supplier products from their organization" ON "public"."supplier_products" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view suppliers from their organization" ON "public"."suppliers" FOR SELECT TO "authenticated" USING (("organization_id" = "public"."get_current_organization_id"()));



CREATE POLICY "Users can view survey responses for their organization" ON "public"."people_survey_responses" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view surveys for their organization" ON "public"."people_employee_surveys" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their organization audit logs" ON "public"."lca_methodology_audit_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "lca_methodology_audit_log"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can view their organization recalculation queue" ON "public"."lca_recalculation_queue" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "lca_recalculation_queue"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their organization tickets" ON "public"."feedback_tickets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "feedback_tickets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their organization usage logs" ON "public"."organization_usage_log" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."organization_members" "om"
     JOIN "public"."roles" "r" ON (("om"."role_id" = "r"."id")))
  WHERE (("om"."organization_id" = "organization_usage_log"."organization_id") AND ("om"."user_id" = "auth"."uid"()) AND ("r"."name" = ANY (ARRAY['owner'::"text", 'admin'::"text"]))))));



CREATE POLICY "Users can view their organization weighting sets and default" ON "public"."ef31_weighting_sets" FOR SELECT TO "authenticated" USING ((("organization_id" IS NULL) OR (EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "ef31_weighting_sets"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Users can view their organization's categories" ON "public"."knowledge_bank_categories" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their organization's reports" ON "public"."generated_reports" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their organization's reports" ON "public"."lca_reports" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members"
  WHERE (("organization_members"."organization_id" = "lca_reports"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their organization's tags" ON "public"."knowledge_bank_tags" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own conversations" ON "public"."gaia_conversations" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own favorites" ON "public"."knowledge_bank_favorites" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own feedback" ON "public"."gaia_feedback" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own memberships" ON "public"."organization_members" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "Users can view their own memberships" ON "public"."organization_members" IS 'Users can view all organization memberships where they are the member. This allows fetching all organizations a user belongs to without circular dependency.';



CREATE POLICY "Users can view their own view history" ON "public"."knowledge_bank_views" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view training records for their organization" ON "public"."people_training_records" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view utility data for their organization facilities" ON "public"."utility_data_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."facilities" "f"
     JOIN "public"."organization_members" "om" ON (("f"."organization_id" = "om"."organization_id")))
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view vehicles in their organization" ON "public"."vehicles" FOR SELECT TO "authenticated" USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view weighting factors" ON "public"."ef31_weighting_factors" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."ef31_weighting_sets" "ws"
  WHERE (("ws"."id" = "ef31_weighting_factors"."weighting_set_id") AND (("ws"."organization_id" IS NULL) OR (EXISTS ( SELECT 1
           FROM "public"."organization_members"
          WHERE (("organization_members"."organization_id" = "ws"."organization_id") AND ("organization_members"."user_id" = "auth"."uid"())))))))));



ALTER TABLE "public"."accredited_advisors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_data" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_data_delete" ON "public"."activity_data" FOR DELETE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "activity_data_insert" ON "public"."activity_data" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "activity_data_select" ON "public"."activity_data" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "activity_data_update" ON "public"."activity_data" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."advisor_organization_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_packages_delete" ON "public"."certification_audit_packages" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "audit_packages_insert" ON "public"."certification_audit_packages" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "audit_packages_select" ON "public"."certification_audit_packages" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "audit_packages_update" ON "public"."certification_audit_packages" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."blog_posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bom_extracted_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bom_imports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bulk_import_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calculated_emissions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "calculated_emissions_insert" ON "public"."calculated_emissions" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "calculated_emissions_select" ON "public"."calculated_emissions" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."calculated_metrics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."calculation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cert_requirements_public_read" ON "public"."certification_framework_requirements" FOR SELECT USING (true);



CREATE POLICY "cert_score_history_insert" ON "public"."certification_score_history" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "cert_score_history_select" ON "public"."certification_score_history" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."certification_audit_packages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certification_evidence_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certification_framework_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certification_frameworks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certification_gap_analyses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."certification_score_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."circularity_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_manufacturer_allocations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contract_manufacturer_energy_inputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corporate_overheads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."corporate_reports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ct_delete_policy" ON "public"."circularity_targets" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "circularity_targets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "ct_insert_policy" ON "public"."circularity_targets" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "circularity_targets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "ct_select_policy" ON "public"."circularity_targets" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "circularity_targets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "ct_update_policy" ON "public"."circularity_targets" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "circularity_targets"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "circularity_targets"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."dashboard_widgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_provenance_trail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."data_provenance_verification_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."defra_ecoinvent_impact_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."defra_energy_emission_factors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ecc_insert_policy" ON "public"."emissions_calculation_context" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "ecc_select_policy" ON "public"."emissions_calculation_context" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "ecc_update_policy" ON "public"."emissions_calculation_context" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."ecoinvent_material_proxies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ef31_impact_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ef31_normalisation_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ef31_process_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ef31_weighting_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ef31_weighting_sets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emissions_calculation_context" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emissions_factors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evidence_links_delete" ON "public"."certification_evidence_links" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "evidence_links_insert" ON "public"."certification_evidence_links" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "evidence_links_select" ON "public"."certification_evidence_links" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "evidence_links_update" ON "public"."certification_evidence_links" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."facilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "facilities_select" ON "public"."facilities" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."facility_activity_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_activity_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_data_contracts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_data_quality_snapshot" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_emissions_aggregated" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_product_assignments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_reporting_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_water_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."facility_water_discharge_quality" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "fae_delete_policy" ON "public"."facility_activity_entries" FOR DELETE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fae_insert_policy" ON "public"."facility_activity_entries" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fae_select_policy" ON "public"."facility_activity_entries" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fae_update_policy" ON "public"."facility_activity_entries" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fdqs_insert_policy" ON "public"."facility_data_quality_snapshot" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "facility_data_quality_snapshot"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "fdqs_select_policy" ON "public"."facility_data_quality_snapshot" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "facility_data_quality_snapshot"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "fea_insert_policy" ON "public"."facility_emissions_aggregated" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fea_select_policy" ON "public"."facility_emissions_aggregated" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "fea_update_policy" ON "public"."facility_emissions_aggregated" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."feedback_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feedback_tickets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."fleet_emission_sources" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."framework_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "frameworks_public_read" ON "public"."certification_frameworks" FOR SELECT USING (true);



ALTER TABLE "public"."gaia_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gaia_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gaia_feedback" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gaia_knowledge_base" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."gaia_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "gap_analyses_delete" ON "public"."certification_gap_analyses" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "gap_analyses_insert" ON "public"."certification_gap_analyses" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "gap_analyses_select" ON "public"."certification_gap_analyses" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "gap_analyses_update" ON "public"."certification_gap_analyses" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."generated_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ghg_emissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."governance_board_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_board_org_delete" ON "public"."governance_board_members" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_board_org_insert" ON "public"."governance_board_members" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_board_org_select" ON "public"."governance_board_members" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_board_org_update" ON "public"."governance_board_members" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_engagements_org_delete" ON "public"."governance_stakeholder_engagements" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_engagements_org_insert" ON "public"."governance_stakeholder_engagements" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_engagements_org_select" ON "public"."governance_stakeholder_engagements" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_engagements_org_update" ON "public"."governance_stakeholder_engagements" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_ethics_org_delete" ON "public"."governance_ethics_records" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_ethics_org_insert" ON "public"."governance_ethics_records" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_ethics_org_select" ON "public"."governance_ethics_records" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_ethics_org_update" ON "public"."governance_ethics_records" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."governance_ethics_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."governance_lobbying" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_lobbying_org_delete" ON "public"."governance_lobbying" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_lobbying_org_insert" ON "public"."governance_lobbying" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_lobbying_org_select" ON "public"."governance_lobbying" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_lobbying_org_update" ON "public"."governance_lobbying" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."governance_mission" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_mission_org_delete" ON "public"."governance_mission" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_mission_org_insert" ON "public"."governance_mission" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_mission_org_select" ON "public"."governance_mission" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_mission_org_update" ON "public"."governance_mission" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."governance_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_policies_org_delete" ON "public"."governance_policies" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_policies_org_insert" ON "public"."governance_policies" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_policies_org_select" ON "public"."governance_policies" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_policies_org_update" ON "public"."governance_policies" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."governance_policy_versions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_policy_versions_org_delete" ON "public"."governance_policy_versions" FOR DELETE USING (("policy_id" IN ( SELECT "governance_policies"."id"
   FROM "public"."governance_policies"
  WHERE ("governance_policies"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "governance_policy_versions_org_insert" ON "public"."governance_policy_versions" FOR INSERT WITH CHECK (("policy_id" IN ( SELECT "governance_policies"."id"
   FROM "public"."governance_policies"
  WHERE ("governance_policies"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "governance_policy_versions_org_select" ON "public"."governance_policy_versions" FOR SELECT USING (("policy_id" IN ( SELECT "governance_policies"."id"
   FROM "public"."governance_policies"
  WHERE ("governance_policies"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



CREATE POLICY "governance_policy_versions_org_update" ON "public"."governance_policy_versions" FOR UPDATE USING (("policy_id" IN ( SELECT "governance_policies"."id"
   FROM "public"."governance_policies"
  WHERE ("governance_policies"."organization_id" IN ( SELECT "organization_members"."organization_id"
           FROM "public"."organization_members"
          WHERE ("organization_members"."user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."governance_scores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_scores_org_delete" ON "public"."governance_scores" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_scores_org_insert" ON "public"."governance_scores" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_scores_org_select" ON "public"."governance_scores" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_scores_org_update" ON "public"."governance_scores" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."governance_stakeholder_engagements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."governance_stakeholders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "governance_stakeholders_org_delete" ON "public"."governance_stakeholders" FOR DELETE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_stakeholders_org_insert" ON "public"."governance_stakeholders" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_stakeholders_org_select" ON "public"."governance_stakeholders" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "governance_stakeholders_org_update" ON "public"."governance_stakeholders" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."greenwash_assessment_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."greenwash_assessments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredient_selection_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ingredients" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_favorites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_item_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."knowledge_bank_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpi_data_points" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."kpis" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_methodology_audit_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_production_mix" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_recalculation_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_recalculation_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_social_indicators" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."lca_workflow_audit" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."openlca_configurations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "org_certifications_insert" ON "public"."organization_certifications" FOR INSERT WITH CHECK (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_certifications_select" ON "public"."organization_certifications" FOR SELECT USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



CREATE POLICY "org_certifications_update" ON "public"."organization_certifications" FOR UPDATE USING (("organization_id" IN ( SELECT "organization_members"."organization_id"
   FROM "public"."organization_members"
  WHERE ("organization_members"."user_id" = "auth"."uid"()))));



ALTER TABLE "public"."organization_certifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_usage_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organization_vitality_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."organizations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packaging_circularity_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."packaging_types" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."passport_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pcp_delete_policy" ON "public"."packaging_circularity_profiles" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "packaging_circularity_profiles"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "pcp_insert_policy" ON "public"."packaging_circularity_profiles" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "packaging_circularity_profiles"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "pcp_select_policy" ON "public"."packaging_circularity_profiles" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "packaging_circularity_profiles"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "pcp_update_policy" ON "public"."packaging_circularity_profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "packaging_circularity_profiles"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "packaging_circularity_profiles"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."pending_activity_data" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_facilities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pending_suppliers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "peols_delete_policy" ON "public"."product_end_of_life_scenarios" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "product_end_of_life_scenarios"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "peols_insert_policy" ON "public"."product_end_of_life_scenarios" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "product_end_of_life_scenarios"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "peols_select_policy" ON "public"."product_end_of_life_scenarios" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "product_end_of_life_scenarios"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "peols_update_policy" ON "public"."product_end_of_life_scenarios" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "product_end_of_life_scenarios"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "product_end_of_life_scenarios"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."people_benefits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_culture_scores" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_dei_actions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_employee_compensation" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_employee_surveys" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_survey_responses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_training_records" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."people_workforce_demographics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_feature_usage" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_organization_stats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_supplier_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."platform_usage_metrics" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plps_delete" ON "public"."product_carbon_footprint_production_sites" FOR DELETE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "plps_insert" ON "public"."product_carbon_footprint_production_sites" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "plps_select" ON "public"."product_carbon_footprint_production_sites" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "plps_update" ON "public"."product_carbon_footprint_production_sites" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."product_carbon_footprint_inputs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_carbon_footprint_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_carbon_footprint_production_sites" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_carbon_footprint_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_carbon_footprints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_category_proxy_mappings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_end_of_life_scenarios" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."product_lca_calculation_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "product_lcas_insert" ON "public"."product_carbon_footprints" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "product_lcas_select" ON "public"."product_carbon_footprints" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "product_lcas_update" ON "public"."product_carbon_footprints" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."product_materials" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."production_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "products_insert" ON "public"."products" FOR INSERT TO "authenticated" WITH CHECK ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "products_select" ON "public"."products" FOR SELECT TO "authenticated" USING ("public"."user_has_organization_access"("organization_id"));



CREATE POLICY "products_update" ON "public"."products" FOR UPDATE TO "authenticated" USING ("public"."user_has_organization_access"("organization_id")) WITH CHECK ("public"."user_has_organization_access"("organization_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "requirements_public_read" ON "public"."framework_requirements" FOR SELECT USING (true);



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."scope_1_2_emission_sources" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sds_insert_policy" ON "public"."supplier_data_submissions" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "supplier_data_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "sds_select_policy" ON "public"."supplier_data_submissions" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "supplier_data_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



CREATE POLICY "sds_update_policy" ON "public"."supplier_data_submissions" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "supplier_data_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."organization_members" "om"
  WHERE (("om"."organization_id" = "supplier_data_submissions"."organization_id") AND ("om"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."spend_category_patterns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spend_import_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spend_import_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."staging_emission_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tier_features" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_tier_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_data_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_data_upgrade_recommendations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_engagements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."supplier_products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."suppliers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_dashboard_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."utility_data_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "utility_data_entries_delete" ON "public"."utility_data_entries" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND "public"."user_has_organization_access"("f"."organization_id")))));



CREATE POLICY "utility_data_entries_insert" ON "public"."utility_data_entries" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND "public"."user_has_organization_access"("f"."organization_id")))));



CREATE POLICY "utility_data_entries_select" ON "public"."utility_data_entries" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND "public"."user_has_organization_access"("f"."organization_id")))));



CREATE POLICY "utility_data_entries_update" ON "public"."utility_data_entries" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."facilities" "f"
  WHERE (("f"."id" = "utility_data_entries"."facility_id") AND "public"."user_has_organization_access"("f"."organization_id")))));



ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vitality_score_snapshots" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_user_to_platform_admin"("target_user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_user_to_platform_admin"("target_user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_user_to_platform_admin"("target_user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_pending_activity_data"("p_pending_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_pending_facility"("p_pending_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_pending_product"("p_pending_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."approve_pending_supplier"("p_pending_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_calculate_fleet_activity_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_calculate_fleet_activity_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_calculate_fleet_activity_scope"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_calculate_vehicle_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_calculate_vehicle_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_calculate_vehicle_scope"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_tag_utility_scope"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_tag_utility_scope"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_tag_utility_scope"() TO "service_role";



GRANT ALL ON FUNCTION "public"."build_material_breakdown"("p_lca_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."build_material_breakdown"("p_lca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."build_material_breakdown"("p_lca_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bulk_volume_to_units"("p_bulk_volume" numeric, "p_bulk_unit" "text", "p_unit_size_value" numeric, "p_unit_size_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_allocation_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_allocation_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_allocation_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_energy_co2e"("p_fuel_type" "text", "p_consumption_value" numeric, "p_factor_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_facility_intensity"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_facility_intensity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_facility_intensity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_gaia_corporate_emissions"("p_organization_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date", "p_reporting_period_end" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date", "p_reporting_period_end" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_per_unit_facility_intensity"("p_facility_id" "uuid", "p_reporting_period_start" "date", "p_reporting_period_end" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_production_site_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_production_site_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_production_site_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_provenance_confidence_score"("provenance" "public"."data_provenance_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_provenance_confidence_score"("provenance" "public"."data_provenance_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_provenance_confidence_score"("provenance" "public"."data_provenance_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_read_time"("content" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_read_time"("content" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_read_time"("content" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_units_from_volume"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_units_from_volume"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_units_from_volume"() TO "service_role";



GRANT ALL ON FUNCTION "public"."can_approve_data"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_approve_data"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_approve_data"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."can_submit_directly"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_submit_directly"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_submit_directly"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_feature_access"("p_organization_id" "uuid", "p_feature_code" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_lca_limit"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_methodology_access"("p_organization_id" "uuid", "p_methodology" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_product_limit"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_report_limit"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."cleanup_openlca_cache"() TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_openlca_cache"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_openlca_cache"() TO "service_role";



GRANT ALL ON FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text", "p_error_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text", "p_error_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."complete_recalculation_job"("p_queue_id" "uuid", "p_success" boolean, "p_error" "text", "p_error_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_facility"("p_name" "text", "p_facility_type" "text", "p_country" "text", "p_address" "text", "p_city" "text", "p_data_source_type" "text", "p_supplier_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_facility"("p_name" "text", "p_facility_type" "text", "p_country" "text", "p_address" "text", "p_city" "text", "p_data_source_type" "text", "p_supplier_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_facility"("p_name" "text", "p_facility_type" "text", "p_country" "text", "p_address" "text", "p_city" "text", "p_data_source_type" "text", "p_supplier_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_org_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_org_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_org_id" "uuid", "p_type" "text", "p_title" "text", "p_message" "text", "p_entity_type" "text", "p_entity_id" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_lca_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_lca_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_lca_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."decrement_product_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."decrement_product_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."decrement_product_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."detect_material_category"("material_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."detect_material_category"("material_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."detect_material_category"("material_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."disable_product_passport"("p_product_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."disable_product_passport"("p_product_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."disable_product_passport"("p_product_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ef31_calculate_single_score"("p_impacts" "jsonb", "p_weighting_set_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) TO "anon";
GRANT ALL ON FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ef31_normalise_impact"("p_impact_category_code" "text", "p_impact_value" numeric) TO "service_role";



GRANT ALL ON FUNCTION "public"."enable_product_passport"("p_product_id" bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."enable_product_passport"("p_product_id" bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enable_product_passport"("p_product_id" bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."escalate_old_tickets"() TO "anon";
GRANT ALL ON FUNCTION "public"."escalate_old_tickets"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."escalate_old_tickets"() TO "service_role";



GRANT ALL ON FUNCTION "public"."expire_old_supplier_invitations"() TO "anon";
GRANT ALL ON FUNCTION "public"."expire_old_supplier_invitations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."expire_old_supplier_invitations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_passport_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_passport_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_passport_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_slug"("title" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_facilities_list"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_facilities_list"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_facilities_list"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_approval_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_methodologies"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_combined_emissions_by_scope"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_current_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_current_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_current_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_default_dashboard_layout"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_default_dashboard_layout"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_default_dashboard_layout"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer, "p_geographic_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer, "p_geographic_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_defra_energy_factor"("p_fuel_type" "text", "p_factor_year" integer, "p_geographic_scope" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_eeio_emission_factor"("p_category" "text", "p_currency" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_eeio_emission_factor"("p_category" "text", "p_currency" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_eeio_emission_factor"("p_category" "text", "p_currency" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_emission_factor_with_fallback"("p_name" "text", "p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_employee_fte_count"("p_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_employee_fte_count"("p_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_employee_fte_count"("p_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_facility_aware_factor"("p_facility_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_facility_details"("p_facility_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_facility_details"("p_facility_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_facility_details"("p_facility_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_facility_production_volume"("p_facility_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_facility_production_volume"("p_facility_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_facility_production_volume"("p_facility_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_facility_unallocated_capacity"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_feature_adoption"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_feature_adoption"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_feature_adoption"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fleet_emissions_by_scope"("p_organization_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fleet_emissions_for_ccf"("p_organization_id" "uuid", "p_reporting_year" integer, "p_scope" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_ingredient_audit_summary"("p_lca_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_organization_role"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_organization_role"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_organization_role"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_organization_role_id"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_next_recalculation_job"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_next_recalculation_job"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_next_recalculation_job"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_by_stripe_customer"("p_stripe_customer_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_growth"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_growth"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_growth"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_organization_usage"("p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_overhead_totals_by_category"("p_report_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_overhead_totals_by_category"("p_report_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_overhead_totals_by_category"("p_report_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_pending_approval_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_pending_approval_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_pending_approval_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_organizations"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_organizations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_organizations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_platform_statistics"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_platform_statistics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_platform_statistics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_role_id_by_name"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_role_id_by_name"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_role_id_by_name"("role_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") TO "anon";
GRANT ALL ON FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_scope_for_utility_type"("p_utility_type" "public"."utility_type_enum") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_spend_emission_factor"("p_category" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_spend_emission_factor"("p_category" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_spend_emission_factor"("p_category" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_tier_level"("p_tier_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_tier_level"("p_tier_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_tier_level"("p_tier_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_total_production_weight"("p_organization_id" "uuid", "p_year" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_total_production_weight"("p_organization_id" "uuid", "p_year" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_total_production_weight"("p_organization_id" "uuid", "p_year" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_transport_emission_factor"("p_transport_mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_transport_emission_factor"("p_transport_mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_transport_emission_factor"("p_transport_mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_activity_trend"("p_days" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_activity_trend"("p_days" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_activity_trend"("p_days" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_permissions"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_permissions"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_role"("user_id" "uuid", "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vehicle_performance_summary"("p_vehicle_id" "uuid", "p_start_date" "date", "p_end_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_waste_emission_factor"("p_disposal_method" "text", "p_material_type" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_waste_emission_factor"("p_disposal_method" "text", "p_material_type" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_waste_emission_factor"("p_disposal_method" "text", "p_material_type" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_blog_post_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_blog_post_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_blog_post_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_permission"("permission_name" "text", "org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."import_approved_spend_items"("p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."import_approved_spend_items"("p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."import_approved_spend_items"("p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_lca_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_lca_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_lca_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_product_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_product_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_product_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_report_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_report_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_report_count"("p_organization_id" "uuid", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."initialize_dashboard_preferences"("p_user_id" "uuid", "p_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."initialize_dashboard_preferences"("p_user_id" "uuid", "p_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."initialize_dashboard_preferences"("p_user_id" "uuid", "p_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_alkatera_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_alkatera_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_alkatera_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_member_of"("_organization_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_member_of"("_organization_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_member_of"("_organization_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_organization_admin"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_production_mix_complete"("lca_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."list_platform_admins"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_platform_admins"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_platform_admins"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_activity"("p_event_type" "text", "p_details" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_methodology_access"("p_organization_id" "uuid", "p_user_id" "uuid", "p_product_lca_id" "uuid", "p_methodology" "text", "p_granted" boolean, "p_denial_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_platform_activity"("p_activity_type" "text", "p_activity_category" "text", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_verification_status_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_verification_status_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_verification_status_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_feedback_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_feedback_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_feedback_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_new_feedback_ticket"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_new_feedback_ticket"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_new_feedback_ticket"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_calculation_log_deletes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_calculation_log_deletes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_calculation_log_deletes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_calculation_log_updates"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_calculation_log_updates"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_calculation_log_updates"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_data_provenance_deletes"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_data_provenance_deletes"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_data_provenance_deletes"() TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid", "p_batch_name" "text", "p_triggered_by" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid", "p_batch_name" "text", "p_triggered_by" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_all_lcas_for_ef31_recalculation"("p_organization_id" "uuid", "p_batch_name" "text", "p_triggered_by" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer, "p_batch_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer, "p_batch_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."queue_lca_for_ef31_recalculation"("p_product_lca_id" "uuid", "p_priority" integer, "p_batch_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_allocation_from_energy_inputs"() TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_allocation_from_energy_inputs"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_allocation_from_energy_inputs"() TO "service_role";



GRANT ALL ON FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text", "p_referer" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text", "p_referer" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_passport_view"("p_token" "text", "p_user_agent" "text", "p_referer" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_pending_submission"("p_table_name" "text", "p_pending_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."remove_platform_admin"("user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."remove_platform_admin"("user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."remove_platform_admin"("user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric, "p_unit" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric, "p_unit" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_hybrid_impacts"("p_material_name" "text", "p_category_type" "public"."material_category_type", "p_quantity" numeric, "p_unit" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_activity_entry_confidence_score"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_activity_entry_confidence_score"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_activity_entry_confidence_score"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_facility_activity_organization_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_facility_activity_organization_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_facility_activity_organization_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_production_site_facility_intensity"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_production_site_facility_intensity"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_production_site_facility_intensity"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_production_site_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_production_site_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_production_site_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_resolve_hybrid_impacts"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_resolve_hybrid_impacts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_resolve_hybrid_impacts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bulk_import_sessions_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_bulk_import_sessions_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bulk_import_sessions_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_corporate_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_corporate_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_corporate_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_dashboard_preferences_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_emissions_factors_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_emissions_factors_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_emissions_factors_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_facilities_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_facilities_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_facilities_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_facility_product_assignments_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_facility_product_assignments_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_facility_product_assignments_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_facility_water_data_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_facility_water_data_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_facility_water_data_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_gaia_conversation_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_gaia_conversation_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_gaia_conversation_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_generated_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_generated_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_generated_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_kb_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_kb_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_kb_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lca_production_mix_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lca_production_mix_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lca_production_mix_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_lca_reports_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_lca_reports_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_lca_reports_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_material_with_hybrid_impacts"("p_material_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_openlca_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_openlca_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_openlca_config_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_product_carbon_footprint_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_product_carbon_footprint_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_product_carbon_footprint_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_production_logs_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_production_logs_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_production_logs_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_recalculation_batch_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_recalculation_batch_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_recalculation_batch_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_spend_batch_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_spend_batch_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_spend_batch_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_subscription_from_stripe"("p_organization_id" "uuid", "p_stripe_customer_id" "text", "p_stripe_subscription_id" "text", "p_price_id" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_utility_data_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_utility_data_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_utility_data_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_vehicles_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_vehicles_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_vehicles_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."upsert_organization_vitality_score"("p_organization_id" "uuid", "p_year" integer, "p_overall_score" integer, "p_climate_score" integer, "p_water_score" integer, "p_circularity_score" integer, "p_nature_score" integer, "p_metrics" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."upsert_organization_vitality_score"("p_organization_id" "uuid", "p_year" integer, "p_overall_score" integer, "p_climate_score" integer, "p_water_score" integer, "p_circularity_score" integer, "p_nature_score" integer, "p_metrics" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."upsert_organization_vitality_score"("p_organization_id" "uuid", "p_year" integer, "p_overall_score" integer, "p_climate_score" integer, "p_water_score" integer, "p_circularity_score" integer, "p_nature_score" integer, "p_metrics" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_organization_access"("org_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_organization_access"("org_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_organization_access"("org_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "org_id" "uuid", "permission_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "org_id" "uuid", "permission_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_permission"("user_id" "uuid", "org_id" "uuid", "permission_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_calculation_log_organization"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_calculation_log_organization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_calculation_log_organization"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_data_provenance_organization"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_data_provenance_organization"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_data_provenance_organization"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_ghg_breakdown"("metrics" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_no_overlapping_allocation_periods"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_no_overlapping_allocation_periods"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_no_overlapping_allocation_periods"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_physical_allocation"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_physical_allocation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_physical_allocation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_production_mix_totals"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_production_mix_totals"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_production_mix_totals"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_production_site_facility_type"() TO "anon";
GRANT ALL ON FUNCTION "public"."validate_production_site_facility_type"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_production_site_facility_type"() TO "service_role";



GRANT ALL ON FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_supplier_invitation_token"("p_token" "text") TO "service_role";


















GRANT ALL ON TABLE "public"."accredited_advisors" TO "anon";
GRANT ALL ON TABLE "public"."accredited_advisors" TO "authenticated";
GRANT ALL ON TABLE "public"."accredited_advisors" TO "service_role";



GRANT ALL ON TABLE "public"."activity_data" TO "anon";
GRANT ALL ON TABLE "public"."activity_data" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_data" TO "service_role";



GRANT ALL ON TABLE "public"."activity_log" TO "anon";
GRANT ALL ON TABLE "public"."activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."ghg_categories" TO "anon";
GRANT ALL ON TABLE "public"."ghg_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."ghg_categories" TO "service_role";



GRANT ALL ON TABLE "public"."ghg_emissions" TO "anon";
GRANT ALL ON TABLE "public"."ghg_emissions" TO "authenticated";
GRANT ALL ON TABLE "public"."ghg_emissions" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_data_points" TO "anon";
GRANT ALL ON TABLE "public"."kpi_data_points" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_data_points" TO "service_role";



GRANT ALL ON TABLE "public"."kpis" TO "anon";
GRANT ALL ON TABLE "public"."kpis" TO "authenticated";
GRANT ALL ON TABLE "public"."kpis" TO "service_role";



GRANT ALL ON TABLE "public"."organization_members" TO "anon";
GRANT ALL ON TABLE "public"."organization_members" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_members" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."roles" TO "anon";
GRANT ALL ON TABLE "public"."roles" TO "authenticated";
GRANT ALL ON TABLE "public"."roles" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_engagements" TO "anon";
GRANT ALL ON TABLE "public"."supplier_engagements" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_engagements" TO "service_role";



GRANT ALL ON TABLE "public"."suppliers" TO "anon";
GRANT ALL ON TABLE "public"."suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."activity_stream_view" TO "anon";
GRANT ALL ON TABLE "public"."activity_stream_view" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_stream_view" TO "service_role";



GRANT ALL ON TABLE "public"."advisor_organization_access" TO "anon";
GRANT ALL ON TABLE "public"."advisor_organization_access" TO "authenticated";
GRANT ALL ON TABLE "public"."advisor_organization_access" TO "service_role";



GRANT ALL ON TABLE "public"."aware_factors" TO "anon";
GRANT ALL ON TABLE "public"."aware_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."aware_factors" TO "service_role";



GRANT ALL ON TABLE "public"."blog_posts" TO "anon";
GRANT ALL ON TABLE "public"."blog_posts" TO "authenticated";
GRANT ALL ON TABLE "public"."blog_posts" TO "service_role";



GRANT ALL ON TABLE "public"."bom_extracted_items" TO "anon";
GRANT ALL ON TABLE "public"."bom_extracted_items" TO "authenticated";
GRANT ALL ON TABLE "public"."bom_extracted_items" TO "service_role";



GRANT ALL ON TABLE "public"."bom_imports" TO "anon";
GRANT ALL ON TABLE "public"."bom_imports" TO "authenticated";
GRANT ALL ON TABLE "public"."bom_imports" TO "service_role";



GRANT ALL ON TABLE "public"."bulk_import_sessions" TO "anon";
GRANT ALL ON TABLE "public"."bulk_import_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."bulk_import_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."calculated_emissions" TO "anon";
GRANT ALL ON TABLE "public"."calculated_emissions" TO "authenticated";
GRANT ALL ON TABLE "public"."calculated_emissions" TO "service_role";



GRANT ALL ON TABLE "public"."calculated_metrics" TO "anon";
GRANT ALL ON TABLE "public"."calculated_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."calculated_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."calculation_logs" TO "anon";
GRANT ALL ON TABLE "public"."calculation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."calculation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."calculation_statistics" TO "anon";
GRANT ALL ON TABLE "public"."calculation_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."calculation_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."certification_audit_packages" TO "anon";
GRANT ALL ON TABLE "public"."certification_audit_packages" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_audit_packages" TO "service_role";



GRANT ALL ON TABLE "public"."certification_evidence_links" TO "anon";
GRANT ALL ON TABLE "public"."certification_evidence_links" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_evidence_links" TO "service_role";



GRANT ALL ON TABLE "public"."certification_framework_requirements" TO "anon";
GRANT ALL ON TABLE "public"."certification_framework_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_framework_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."certification_frameworks" TO "anon";
GRANT ALL ON TABLE "public"."certification_frameworks" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_frameworks" TO "service_role";



GRANT ALL ON TABLE "public"."certification_gap_analyses" TO "anon";
GRANT ALL ON TABLE "public"."certification_gap_analyses" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_gap_analyses" TO "service_role";



GRANT ALL ON TABLE "public"."certification_score_history" TO "anon";
GRANT ALL ON TABLE "public"."certification_score_history" TO "authenticated";
GRANT ALL ON TABLE "public"."certification_score_history" TO "service_role";



GRANT ALL ON TABLE "public"."product_carbon_footprint_materials" TO "anon";
GRANT ALL ON TABLE "public"."product_carbon_footprint_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."product_carbon_footprint_materials" TO "service_role";



GRANT ALL ON TABLE "public"."product_carbon_footprints" TO "anon";
GRANT ALL ON TABLE "public"."product_carbon_footprints" TO "authenticated";
GRANT ALL ON TABLE "public"."product_carbon_footprints" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."circularity_metrics_summary" TO "anon";
GRANT ALL ON TABLE "public"."circularity_metrics_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."circularity_metrics_summary" TO "service_role";



GRANT ALL ON TABLE "public"."circularity_targets" TO "anon";
GRANT ALL ON TABLE "public"."circularity_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."circularity_targets" TO "service_role";



GRANT ALL ON TABLE "public"."facilities" TO "anon";
GRANT ALL ON TABLE "public"."facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."facilities" TO "service_role";



GRANT ALL ON TABLE "public"."facility_activity_entries" TO "anon";
GRANT ALL ON TABLE "public"."facility_activity_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_activity_entries" TO "service_role";



GRANT ALL ON TABLE "public"."facility_water_summary" TO "anon";
GRANT ALL ON TABLE "public"."facility_water_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_water_summary" TO "service_role";



GRANT ALL ON TABLE "public"."production_logs" TO "anon";
GRANT ALL ON TABLE "public"."production_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."production_logs" TO "service_role";



GRANT ALL ON TABLE "public"."company_water_overview" TO "anon";
GRANT ALL ON TABLE "public"."company_water_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."company_water_overview" TO "service_role";



GRANT ALL ON TABLE "public"."contract_manufacturer_allocations" TO "anon";
GRANT ALL ON TABLE "public"."contract_manufacturer_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_manufacturer_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."contract_manufacturer_allocation_summary" TO "anon";
GRANT ALL ON TABLE "public"."contract_manufacturer_allocation_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_manufacturer_allocation_summary" TO "service_role";



GRANT ALL ON TABLE "public"."contract_manufacturer_energy_inputs" TO "anon";
GRANT ALL ON TABLE "public"."contract_manufacturer_energy_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."contract_manufacturer_energy_inputs" TO "service_role";



GRANT ALL ON TABLE "public"."corporate_overheads" TO "anon";
GRANT ALL ON TABLE "public"."corporate_overheads" TO "authenticated";
GRANT ALL ON TABLE "public"."corporate_overheads" TO "service_role";



GRANT ALL ON TABLE "public"."corporate_reports" TO "anon";
GRANT ALL ON TABLE "public"."corporate_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."corporate_reports" TO "service_role";



GRANT ALL ON TABLE "public"."dashboard_widgets" TO "anon";
GRANT ALL ON TABLE "public"."dashboard_widgets" TO "authenticated";
GRANT ALL ON TABLE "public"."dashboard_widgets" TO "service_role";



GRANT ALL ON TABLE "public"."data_provenance_trail" TO "anon";
GRANT ALL ON TABLE "public"."data_provenance_trail" TO "authenticated";
GRANT ALL ON TABLE "public"."data_provenance_trail" TO "service_role";



GRANT ALL ON TABLE "public"."data_provenance_verification_history" TO "anon";
GRANT ALL ON TABLE "public"."data_provenance_verification_history" TO "authenticated";
GRANT ALL ON TABLE "public"."data_provenance_verification_history" TO "service_role";



GRANT ALL ON TABLE "public"."data_quality_summary" TO "anon";
GRANT ALL ON TABLE "public"."data_quality_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."data_quality_summary" TO "service_role";



GRANT ALL ON TABLE "public"."defra_ecoinvent_impact_mappings" TO "anon";
GRANT ALL ON TABLE "public"."defra_ecoinvent_impact_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."defra_ecoinvent_impact_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."defra_energy_emission_factors" TO "anon";
GRANT ALL ON TABLE "public"."defra_energy_emission_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."defra_energy_emission_factors" TO "service_role";



GRANT ALL ON TABLE "public"."ecoinvent_material_proxies" TO "anon";
GRANT ALL ON TABLE "public"."ecoinvent_material_proxies" TO "authenticated";
GRANT ALL ON TABLE "public"."ecoinvent_material_proxies" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_impact_categories" TO "anon";
GRANT ALL ON TABLE "public"."ef31_impact_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_impact_categories" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_normalisation_factors" TO "anon";
GRANT ALL ON TABLE "public"."ef31_normalisation_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_normalisation_factors" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_process_mappings" TO "anon";
GRANT ALL ON TABLE "public"."ef31_process_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_process_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."lca_recalculation_batches" TO "anon";
GRANT ALL ON TABLE "public"."lca_recalculation_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_recalculation_batches" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_recalculation_progress" TO "anon";
GRANT ALL ON TABLE "public"."ef31_recalculation_progress" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_recalculation_progress" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_weighting_factors" TO "anon";
GRANT ALL ON TABLE "public"."ef31_weighting_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_weighting_factors" TO "service_role";



GRANT ALL ON TABLE "public"."ef31_weighting_sets" TO "anon";
GRANT ALL ON TABLE "public"."ef31_weighting_sets" TO "authenticated";
GRANT ALL ON TABLE "public"."ef31_weighting_sets" TO "service_role";



GRANT ALL ON TABLE "public"."emissions_calculation_context" TO "anon";
GRANT ALL ON TABLE "public"."emissions_calculation_context" TO "authenticated";
GRANT ALL ON TABLE "public"."emissions_calculation_context" TO "service_role";



GRANT ALL ON TABLE "public"."emissions_factors" TO "anon";
GRANT ALL ON TABLE "public"."emissions_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."emissions_factors" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_tickets" TO "anon";
GRANT ALL ON TABLE "public"."feedback_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."organizations" TO "anon";
GRANT ALL ON TABLE "public"."organizations" TO "authenticated";
GRANT ALL ON TABLE "public"."organizations" TO "service_role";



GRANT ALL ON TABLE "public"."escalated_feedback_tickets" TO "anon";
GRANT ALL ON TABLE "public"."escalated_feedback_tickets" TO "authenticated";
GRANT ALL ON TABLE "public"."escalated_feedback_tickets" TO "service_role";



GRANT ALL ON TABLE "public"."evidence_by_document_type" TO "anon";
GRANT ALL ON TABLE "public"."evidence_by_document_type" TO "authenticated";
GRANT ALL ON TABLE "public"."evidence_by_document_type" TO "service_role";



GRANT ALL ON TABLE "public"."evidence_statistics" TO "anon";
GRANT ALL ON TABLE "public"."evidence_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."evidence_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."facility_activity_data" TO "anon";
GRANT ALL ON TABLE "public"."facility_activity_data" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_activity_data" TO "service_role";



GRANT ALL ON TABLE "public"."facility_activity_with_scope" TO "anon";
GRANT ALL ON TABLE "public"."facility_activity_with_scope" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_activity_with_scope" TO "service_role";



GRANT ALL ON TABLE "public"."utility_data_entries" TO "anon";
GRANT ALL ON TABLE "public"."utility_data_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."utility_data_entries" TO "service_role";



GRANT ALL ON TABLE "public"."facility_confidence_summary" TO "anon";
GRANT ALL ON TABLE "public"."facility_confidence_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_confidence_summary" TO "service_role";



GRANT ALL ON TABLE "public"."facility_data_contracts" TO "anon";
GRANT ALL ON TABLE "public"."facility_data_contracts" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_data_contracts" TO "service_role";



GRANT ALL ON TABLE "public"."facility_data_quality_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."facility_data_quality_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_data_quality_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."facility_emissions_aggregated" TO "anon";
GRANT ALL ON TABLE "public"."facility_emissions_aggregated" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_emissions_aggregated" TO "service_role";



GRANT ALL ON TABLE "public"."facility_product_assignments" TO "anon";
GRANT ALL ON TABLE "public"."facility_product_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_product_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."product_carbon_footprint_production_sites" TO "anon";
GRANT ALL ON TABLE "public"."product_carbon_footprint_production_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."product_carbon_footprint_production_sites" TO "service_role";



GRANT ALL ON TABLE "public"."facility_product_allocation_matrix" TO "anon";
GRANT ALL ON TABLE "public"."facility_product_allocation_matrix" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_product_allocation_matrix" TO "service_role";



GRANT ALL ON TABLE "public"."facility_reporting_sessions" TO "anon";
GRANT ALL ON TABLE "public"."facility_reporting_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_reporting_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."facility_types" TO "anon";
GRANT ALL ON TABLE "public"."facility_types" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_types" TO "service_role";



GRANT ALL ON TABLE "public"."facility_water_data" TO "anon";
GRANT ALL ON TABLE "public"."facility_water_data" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_water_data" TO "service_role";



GRANT ALL ON TABLE "public"."facility_water_discharge_quality" TO "anon";
GRANT ALL ON TABLE "public"."facility_water_discharge_quality" TO "authenticated";
GRANT ALL ON TABLE "public"."facility_water_discharge_quality" TO "service_role";



GRANT ALL ON TABLE "public"."factor_usage_statistics" TO "anon";
GRANT ALL ON TABLE "public"."factor_usage_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."factor_usage_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_messages" TO "anon";
GRANT ALL ON TABLE "public"."feedback_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_messages" TO "service_role";



GRANT ALL ON TABLE "public"."feedback_tickets_with_users" TO "anon";
GRANT ALL ON TABLE "public"."feedback_tickets_with_users" TO "authenticated";
GRANT ALL ON TABLE "public"."feedback_tickets_with_users" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_activities" TO "anon";
GRANT ALL ON TABLE "public"."fleet_activities" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_activities" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_annual_emissions" TO "anon";
GRANT ALL ON TABLE "public"."fleet_annual_emissions" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_annual_emissions" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_ccf_summary" TO "anon";
GRANT ALL ON TABLE "public"."fleet_ccf_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_ccf_summary" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_emission_sources" TO "anon";
GRANT ALL ON TABLE "public"."fleet_emission_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_emission_sources" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_emissions_by_scope" TO "anon";
GRANT ALL ON TABLE "public"."fleet_emissions_by_scope" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_emissions_by_scope" TO "service_role";



GRANT ALL ON TABLE "public"."vehicles" TO "anon";
GRANT ALL ON TABLE "public"."vehicles" TO "authenticated";
GRANT ALL ON TABLE "public"."vehicles" TO "service_role";



GRANT ALL ON TABLE "public"."fleet_vehicle_summary" TO "anon";
GRANT ALL ON TABLE "public"."fleet_vehicle_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."fleet_vehicle_summary" TO "service_role";



GRANT ALL ON TABLE "public"."framework_requirements" TO "anon";
GRANT ALL ON TABLE "public"."framework_requirements" TO "authenticated";
GRANT ALL ON TABLE "public"."framework_requirements" TO "service_role";



GRANT ALL ON TABLE "public"."gaia_analytics" TO "anon";
GRANT ALL ON TABLE "public"."gaia_analytics" TO "authenticated";
GRANT ALL ON TABLE "public"."gaia_analytics" TO "service_role";



GRANT ALL ON TABLE "public"."gaia_conversations" TO "anon";
GRANT ALL ON TABLE "public"."gaia_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."gaia_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."gaia_feedback" TO "anon";
GRANT ALL ON TABLE "public"."gaia_feedback" TO "authenticated";
GRANT ALL ON TABLE "public"."gaia_feedback" TO "service_role";



GRANT ALL ON TABLE "public"."gaia_knowledge_base" TO "anon";
GRANT ALL ON TABLE "public"."gaia_knowledge_base" TO "authenticated";
GRANT ALL ON TABLE "public"."gaia_knowledge_base" TO "service_role";



GRANT ALL ON TABLE "public"."gaia_messages" TO "anon";
GRANT ALL ON TABLE "public"."gaia_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."gaia_messages" TO "service_role";



GRANT ALL ON TABLE "public"."generated_reports" TO "anon";
GRANT ALL ON TABLE "public"."generated_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."generated_reports" TO "service_role";



GRANT ALL ON TABLE "public"."ghg_hotspots_view" TO "anon";
GRANT ALL ON TABLE "public"."ghg_hotspots_view" TO "authenticated";
GRANT ALL ON TABLE "public"."ghg_hotspots_view" TO "service_role";



GRANT ALL ON TABLE "public"."governance_board_members" TO "anon";
GRANT ALL ON TABLE "public"."governance_board_members" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_board_members" TO "service_role";



GRANT ALL ON TABLE "public"."governance_ethics_records" TO "anon";
GRANT ALL ON TABLE "public"."governance_ethics_records" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_ethics_records" TO "service_role";



GRANT ALL ON TABLE "public"."governance_lobbying" TO "anon";
GRANT ALL ON TABLE "public"."governance_lobbying" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_lobbying" TO "service_role";



GRANT ALL ON TABLE "public"."governance_mission" TO "anon";
GRANT ALL ON TABLE "public"."governance_mission" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_mission" TO "service_role";



GRANT ALL ON TABLE "public"."governance_policies" TO "anon";
GRANT ALL ON TABLE "public"."governance_policies" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_policies" TO "service_role";



GRANT ALL ON TABLE "public"."governance_policy_versions" TO "anon";
GRANT ALL ON TABLE "public"."governance_policy_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_policy_versions" TO "service_role";



GRANT ALL ON TABLE "public"."governance_scores" TO "anon";
GRANT ALL ON TABLE "public"."governance_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_scores" TO "service_role";



GRANT ALL ON TABLE "public"."governance_stakeholder_engagements" TO "anon";
GRANT ALL ON TABLE "public"."governance_stakeholder_engagements" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_stakeholder_engagements" TO "service_role";



GRANT ALL ON TABLE "public"."governance_stakeholders" TO "anon";
GRANT ALL ON TABLE "public"."governance_stakeholders" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_stakeholders" TO "service_role";



GRANT ALL ON TABLE "public"."governance_summary" TO "anon";
GRANT ALL ON TABLE "public"."governance_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."governance_summary" TO "service_role";



GRANT ALL ON TABLE "public"."greenwash_assessment_claims" TO "anon";
GRANT ALL ON TABLE "public"."greenwash_assessment_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."greenwash_assessment_claims" TO "service_role";



GRANT ALL ON TABLE "public"."greenwash_assessments" TO "anon";
GRANT ALL ON TABLE "public"."greenwash_assessments" TO "authenticated";
GRANT ALL ON TABLE "public"."greenwash_assessments" TO "service_role";



GRANT ALL ON TABLE "public"."ingredient_selection_audit" TO "anon";
GRANT ALL ON TABLE "public"."ingredient_selection_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredient_selection_audit" TO "service_role";



GRANT ALL ON TABLE "public"."ingredients" TO "anon";
GRANT ALL ON TABLE "public"."ingredients" TO "authenticated";
GRANT ALL ON TABLE "public"."ingredients" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_categories" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_categories" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_categories" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_favorites" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_item_tags" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_item_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_item_tags" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_items" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_items" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_items" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_tags" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_tags" TO "service_role";



GRANT ALL ON TABLE "public"."knowledge_bank_views" TO "anon";
GRANT ALL ON TABLE "public"."knowledge_bank_views" TO "authenticated";
GRANT ALL ON TABLE "public"."knowledge_bank_views" TO "service_role";



GRANT ALL ON TABLE "public"."kpi_summary_view" TO "anon";
GRANT ALL ON TABLE "public"."kpi_summary_view" TO "authenticated";
GRANT ALL ON TABLE "public"."kpi_summary_view" TO "service_role";



GRANT ALL ON TABLE "public"."product_lca_calculation_logs" TO "anon";
GRANT ALL ON TABLE "public"."product_lca_calculation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lca_calculation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."lca_ghg_breakdown_report" TO "anon";
GRANT ALL ON TABLE "public"."lca_ghg_breakdown_report" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_ghg_breakdown_report" TO "service_role";



GRANT ALL ON TABLE "public"."lca_life_cycle_stages" TO "anon";
GRANT ALL ON TABLE "public"."lca_life_cycle_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_life_cycle_stages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lca_life_cycle_stages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lca_life_cycle_stages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lca_life_cycle_stages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lca_methodology_audit_log" TO "anon";
GRANT ALL ON TABLE "public"."lca_methodology_audit_log" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_methodology_audit_log" TO "service_role";



GRANT ALL ON TABLE "public"."lca_production_mix" TO "anon";
GRANT ALL ON TABLE "public"."lca_production_mix" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_production_mix" TO "service_role";



GRANT ALL ON TABLE "public"."lca_production_mix_summary" TO "anon";
GRANT ALL ON TABLE "public"."lca_production_mix_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_production_mix_summary" TO "service_role";



GRANT ALL ON TABLE "public"."lca_recalculation_queue" TO "anon";
GRANT ALL ON TABLE "public"."lca_recalculation_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_recalculation_queue" TO "service_role";



GRANT ALL ON TABLE "public"."lca_reports" TO "anon";
GRANT ALL ON TABLE "public"."lca_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_reports" TO "service_role";



GRANT ALL ON TABLE "public"."lca_social_indicators" TO "anon";
GRANT ALL ON TABLE "public"."lca_social_indicators" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_social_indicators" TO "service_role";



GRANT ALL ON TABLE "public"."lca_stages" TO "anon";
GRANT ALL ON TABLE "public"."lca_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_stages" TO "service_role";



GRANT ALL ON TABLE "public"."lca_sub_stages" TO "anon";
GRANT ALL ON TABLE "public"."lca_sub_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_sub_stages" TO "service_role";



GRANT ALL ON SEQUENCE "public"."lca_sub_stages_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."lca_sub_stages_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."lca_sub_stages_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."lca_workflow_audit" TO "anon";
GRANT ALL ON TABLE "public"."lca_workflow_audit" TO "authenticated";
GRANT ALL ON TABLE "public"."lca_workflow_audit" TO "service_role";



GRANT ALL ON TABLE "public"."member_profiles" TO "anon";
GRANT ALL ON TABLE "public"."member_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."member_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."openlca_configurations" TO "anon";
GRANT ALL ON TABLE "public"."openlca_configurations" TO "authenticated";
GRANT ALL ON TABLE "public"."openlca_configurations" TO "service_role";



GRANT ALL ON TABLE "public"."openlca_process_cache" TO "anon";
GRANT ALL ON TABLE "public"."openlca_process_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."openlca_process_cache" TO "service_role";



GRANT ALL ON SEQUENCE "public"."openlca_process_cache_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."openlca_process_cache_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."openlca_process_cache_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."organization_certifications" TO "anon";
GRANT ALL ON TABLE "public"."organization_certifications" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_certifications" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tier_features" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tier_features" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tier_features" TO "service_role";



GRANT ALL ON TABLE "public"."organization_subscription_summary" TO "anon";
GRANT ALL ON TABLE "public"."organization_subscription_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_subscription_summary" TO "service_role";



GRANT ALL ON TABLE "public"."organization_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."organization_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."platform_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."platform_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."organization_suppliers_view" TO "anon";
GRANT ALL ON TABLE "public"."organization_suppliers_view" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_suppliers_view" TO "service_role";



GRANT ALL ON TABLE "public"."organization_usage_log" TO "anon";
GRANT ALL ON TABLE "public"."organization_usage_log" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_usage_log" TO "service_role";



GRANT ALL ON TABLE "public"."organization_vitality_scores" TO "anon";
GRANT ALL ON TABLE "public"."organization_vitality_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."organization_vitality_scores" TO "service_role";



GRANT ALL ON TABLE "public"."packaging_circularity_profiles" TO "anon";
GRANT ALL ON TABLE "public"."packaging_circularity_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."packaging_circularity_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."packaging_types" TO "anon";
GRANT ALL ON TABLE "public"."packaging_types" TO "authenticated";
GRANT ALL ON TABLE "public"."packaging_types" TO "service_role";



GRANT ALL ON TABLE "public"."passport_views" TO "anon";
GRANT ALL ON TABLE "public"."passport_views" TO "authenticated";
GRANT ALL ON TABLE "public"."passport_views" TO "service_role";



GRANT ALL ON TABLE "public"."pending_activity_data" TO "anon";
GRANT ALL ON TABLE "public"."pending_activity_data" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_activity_data" TO "service_role";



GRANT ALL ON TABLE "public"."pending_facilities" TO "anon";
GRANT ALL ON TABLE "public"."pending_facilities" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_facilities" TO "service_role";



GRANT ALL ON TABLE "public"."pending_products" TO "anon";
GRANT ALL ON TABLE "public"."pending_products" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_products" TO "service_role";



GRANT ALL ON TABLE "public"."pending_suppliers" TO "anon";
GRANT ALL ON TABLE "public"."pending_suppliers" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_suppliers" TO "service_role";



GRANT ALL ON TABLE "public"."pending_approvals_summary" TO "anon";
GRANT ALL ON TABLE "public"."pending_approvals_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."pending_approvals_summary" TO "service_role";



GRANT ALL ON TABLE "public"."people_benefits" TO "anon";
GRANT ALL ON TABLE "public"."people_benefits" TO "authenticated";
GRANT ALL ON TABLE "public"."people_benefits" TO "service_role";



GRANT ALL ON TABLE "public"."people_culture_scores" TO "anon";
GRANT ALL ON TABLE "public"."people_culture_scores" TO "authenticated";
GRANT ALL ON TABLE "public"."people_culture_scores" TO "service_role";



GRANT ALL ON TABLE "public"."people_dei_actions" TO "anon";
GRANT ALL ON TABLE "public"."people_dei_actions" TO "authenticated";
GRANT ALL ON TABLE "public"."people_dei_actions" TO "service_role";



GRANT ALL ON TABLE "public"."people_employee_compensation" TO "anon";
GRANT ALL ON TABLE "public"."people_employee_compensation" TO "authenticated";
GRANT ALL ON TABLE "public"."people_employee_compensation" TO "service_role";



GRANT ALL ON TABLE "public"."people_employee_surveys" TO "anon";
GRANT ALL ON TABLE "public"."people_employee_surveys" TO "authenticated";
GRANT ALL ON TABLE "public"."people_employee_surveys" TO "service_role";



GRANT ALL ON TABLE "public"."people_living_wage_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."people_living_wage_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."people_living_wage_benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."people_survey_responses" TO "anon";
GRANT ALL ON TABLE "public"."people_survey_responses" TO "authenticated";
GRANT ALL ON TABLE "public"."people_survey_responses" TO "service_role";



GRANT ALL ON TABLE "public"."people_training_records" TO "anon";
GRANT ALL ON TABLE "public"."people_training_records" TO "authenticated";
GRANT ALL ON TABLE "public"."people_training_records" TO "service_role";



GRANT ALL ON TABLE "public"."people_workforce_demographics" TO "anon";
GRANT ALL ON TABLE "public"."people_workforce_demographics" TO "authenticated";
GRANT ALL ON TABLE "public"."people_workforce_demographics" TO "service_role";



GRANT ALL ON TABLE "public"."permissions" TO "anon";
GRANT ALL ON TABLE "public"."permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."permissions" TO "service_role";



GRANT ALL ON TABLE "public"."platform_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."platform_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_products" TO "anon";
GRANT ALL ON TABLE "public"."supplier_products" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_products" TO "service_role";



GRANT ALL ON TABLE "public"."platform_dashboard_summary" TO "anon";
GRANT ALL ON TABLE "public"."platform_dashboard_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_dashboard_summary" TO "service_role";



GRANT ALL ON TABLE "public"."platform_feature_usage" TO "anon";
GRANT ALL ON TABLE "public"."platform_feature_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_feature_usage" TO "service_role";



GRANT ALL ON TABLE "public"."platform_organization_stats" TO "anon";
GRANT ALL ON TABLE "public"."platform_organization_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_organization_stats" TO "service_role";



GRANT ALL ON TABLE "public"."platform_supplier_products" TO "anon";
GRANT ALL ON TABLE "public"."platform_supplier_products" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_supplier_products" TO "service_role";



GRANT ALL ON TABLE "public"."platform_usage_metrics" TO "anon";
GRANT ALL ON TABLE "public"."platform_usage_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_usage_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."product_carbon_footprint_inputs" TO "anon";
GRANT ALL ON TABLE "public"."product_carbon_footprint_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_carbon_footprint_inputs" TO "service_role";



GRANT ALL ON TABLE "public"."product_carbon_footprint_results" TO "anon";
GRANT ALL ON TABLE "public"."product_carbon_footprint_results" TO "authenticated";
GRANT ALL ON TABLE "public"."product_carbon_footprint_results" TO "service_role";



GRANT ALL ON TABLE "public"."product_category_proxy_mappings" TO "anon";
GRANT ALL ON TABLE "public"."product_category_proxy_mappings" TO "authenticated";
GRANT ALL ON TABLE "public"."product_category_proxy_mappings" TO "service_role";



GRANT ALL ON TABLE "public"."product_end_of_life_scenarios" TO "anon";
GRANT ALL ON TABLE "public"."product_end_of_life_scenarios" TO "authenticated";
GRANT ALL ON TABLE "public"."product_end_of_life_scenarios" TO "service_role";



GRANT ALL ON TABLE "public"."product_lca_inputs" TO "anon";
GRANT ALL ON TABLE "public"."product_lca_inputs" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lca_inputs" TO "service_role";



GRANT ALL ON TABLE "public"."product_lca_materials" TO "anon";
GRANT ALL ON TABLE "public"."product_lca_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lca_materials" TO "service_role";



GRANT ALL ON TABLE "public"."product_lca_production_sites" TO "anon";
GRANT ALL ON TABLE "public"."product_lca_production_sites" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lca_production_sites" TO "service_role";



GRANT ALL ON TABLE "public"."product_lca_results" TO "anon";
GRANT ALL ON TABLE "public"."product_lca_results" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lca_results" TO "service_role";



GRANT ALL ON TABLE "public"."product_lcas" TO "anon";
GRANT ALL ON TABLE "public"."product_lcas" TO "authenticated";
GRANT ALL ON TABLE "public"."product_lcas" TO "service_role";



GRANT ALL ON TABLE "public"."product_materials" TO "anon";
GRANT ALL ON TABLE "public"."product_materials" TO "authenticated";
GRANT ALL ON TABLE "public"."product_materials" TO "service_role";



GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."products_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."report_statistics" TO "anon";
GRANT ALL ON TABLE "public"."report_statistics" TO "authenticated";
GRANT ALL ON TABLE "public"."report_statistics" TO "service_role";



GRANT ALL ON TABLE "public"."role_permissions" TO "anon";
GRANT ALL ON TABLE "public"."role_permissions" TO "authenticated";
GRANT ALL ON TABLE "public"."role_permissions" TO "service_role";



GRANT ALL ON TABLE "public"."scope_1_2_emission_sources" TO "anon";
GRANT ALL ON TABLE "public"."scope_1_2_emission_sources" TO "authenticated";
GRANT ALL ON TABLE "public"."scope_1_2_emission_sources" TO "service_role";



GRANT ALL ON TABLE "public"."spend_category_patterns" TO "anon";
GRANT ALL ON TABLE "public"."spend_category_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."spend_category_patterns" TO "service_role";



GRANT ALL ON TABLE "public"."spend_import_batches" TO "anon";
GRANT ALL ON TABLE "public"."spend_import_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."spend_import_batches" TO "service_role";



GRANT ALL ON TABLE "public"."spend_import_items" TO "anon";
GRANT ALL ON TABLE "public"."spend_import_items" TO "authenticated";
GRANT ALL ON TABLE "public"."spend_import_items" TO "service_role";



GRANT ALL ON TABLE "public"."staging_emission_factors" TO "anon";
GRANT ALL ON TABLE "public"."staging_emission_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."staging_emission_factors" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tier_limits" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tier_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tier_limits" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_tiers_comparison" TO "anon";
GRANT ALL ON TABLE "public"."subscription_tiers_comparison" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_tiers_comparison" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_data_submissions" TO "anon";
GRANT ALL ON TABLE "public"."supplier_data_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_data_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_data_upgrade_recommendations" TO "anon";
GRANT ALL ON TABLE "public"."supplier_data_upgrade_recommendations" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_data_upgrade_recommendations" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_engagement_view" TO "anon";
GRANT ALL ON TABLE "public"."supplier_engagement_view" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_engagement_view" TO "service_role";



GRANT ALL ON TABLE "public"."supplier_invitations" TO "anon";
GRANT ALL ON TABLE "public"."supplier_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."supplier_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "anon";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."user_dashboard_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."user_evidence_contributions" TO "anon";
GRANT ALL ON TABLE "public"."user_evidence_contributions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_evidence_contributions" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."utility_fuel_type_mapping" TO "anon";
GRANT ALL ON TABLE "public"."utility_fuel_type_mapping" TO "authenticated";
GRANT ALL ON TABLE "public"."utility_fuel_type_mapping" TO "service_role";



GRANT ALL ON TABLE "public"."vitality_benchmarks" TO "anon";
GRANT ALL ON TABLE "public"."vitality_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."vitality_benchmarks" TO "service_role";



GRANT ALL ON TABLE "public"."vitality_score_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."vitality_score_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."vitality_score_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."waste_stream_summary" TO "anon";
GRANT ALL ON TABLE "public"."waste_stream_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."waste_stream_summary" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































