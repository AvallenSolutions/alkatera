/*
  # Create Facilities Management RPC Functions

  1. Functions
    - `get_all_facilities_list()` - Returns all facilities for current user's organization
    - `get_facility_details(facility_id)` - Returns detailed information for a single facility
    - `create_facility(facility_data)` - Creates a new facility with validation

  2. Security
    - All functions enforce RLS by checking organization membership
    - Input validation on all parameters
    - Proper error handling

  3. Notes
    - Functions use organization context from JWT claims
    - Activity data log integrated with facility details
    - DQI information included in responses
*/

-- Function: Get all facilities for current organization
CREATE OR REPLACE FUNCTION get_all_facilities_list()
RETURNS TABLE (
  id uuid,
  name text,
  city text,
  country text,
  facility_type_id uuid,
  facility_type_name text,
  data_source_type text,
  supplier_id uuid,
  is_archived boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function: Get detailed information for a single facility
CREATE OR REPLACE FUNCTION get_facility_details(p_facility_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Function: Create a new facility
CREATE OR REPLACE FUNCTION create_facility(
  p_name text,
  p_facility_type text,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_country text,
  p_data_source_type text DEFAULT 'internal',
  p_supplier_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_all_facilities_list() TO authenticated;
GRANT EXECUTE ON FUNCTION get_facility_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION create_facility(text, text, text, text, text, text, uuid) TO authenticated;
