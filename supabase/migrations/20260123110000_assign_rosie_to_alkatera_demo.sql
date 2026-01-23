/*
  # Assign rosie@impactfocus.co to alkatera Demo organization

  Updates the organization membership for rosie@impactfocus.co to be part of
  the alkatera Demo organization instead of their current organization.
*/

DO $$
DECLARE
  v_user_id uuid;
  v_demo_org_id uuid;
  v_owner_role_id uuid;
BEGIN
  -- Find the user by email (profiles table stores auth user data)
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rosie@impactfocus.co';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User rosie@impactfocus.co not found';
    RETURN;
  END IF;

  -- Find the alkatera Demo organization
  SELECT id INTO v_demo_org_id
  FROM organizations
  WHERE LOWER(name) LIKE '%alkatera%demo%' OR LOWER(name) LIKE '%demo%alkatera%'
  LIMIT 1;

  IF v_demo_org_id IS NULL THEN
    RAISE NOTICE 'alkatera Demo organization not found';
    RETURN;
  END IF;

  -- Get the owner role ID
  SELECT id INTO v_owner_role_id
  FROM roles
  WHERE name = 'owner';

  -- Delete existing organization memberships for this user
  DELETE FROM organization_members
  WHERE user_id = v_user_id;

  -- Add user to alkatera Demo organization as owner
  INSERT INTO organization_members (organization_id, user_id, role_id)
  VALUES (v_demo_org_id, v_user_id, v_owner_role_id)
  ON CONFLICT (organization_id, user_id) DO UPDATE
  SET role_id = v_owner_role_id;

  RAISE NOTICE 'Successfully assigned rosie@impactfocus.co to alkatera Demo organization';
END $$;
