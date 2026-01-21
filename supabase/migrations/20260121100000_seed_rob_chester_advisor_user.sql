/*
  # Seed Rob Chester Advisor User

  Creates a new AlkaTera-accredited advisor user:
  - Email: rob.chester@scinsites.com
  - Organization access: Calculation Verification

  Note: This migration creates the advisor profile and organization access
  following the same pattern as rosie@impactfocus.co
*/

-- ============================================================================
-- Create the advisor user using DO block to handle existence check
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_org_owner_id UUID;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rob.chester@scinsites.com';

  -- Create user if not exists
  IF v_user_id IS NULL THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      is_super_admin,
      role,
      aud,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'rob.chester@scinsites.com',
      crypt('scinsites123', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{"full_name": "Rob Chester"}',
      false,
      'authenticated',
      'authenticated',
      '',
      '',
      '',
      ''
    )
    RETURNING id INTO v_user_id;

    RAISE NOTICE 'Created user with id %', v_user_id;
  ELSE
    RAISE NOTICE 'User already exists with id %', v_user_id;
  END IF;

  -- Create profile if user exists
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (
      id,
      email,
      full_name,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      'rob.chester@scinsites.com',
      'Rob Chester',
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = 'Rob Chester',
      updated_at = now();

    RAISE NOTICE 'Created/updated profile for user %', v_user_id;

    -- Register as accredited advisor
    INSERT INTO public.accredited_advisors (
      user_id,
      company_name,
      advisor_bio,
      expertise_areas,
      certifications,
      is_active,
      accredited_at,
      training_completed_at
    )
    VALUES (
      v_user_id,
      'ScInSites',
      'Sustainability consultant specializing in carbon accounting and LCA for food & beverage companies.',
      ARRAY['Carbon Accounting', 'Life Cycle Assessment', 'Supply Chain Sustainability', 'DEFRA Reporting'],
      ARRAY['GHG Protocol Certified', 'ISO 14064 Lead Verifier'],
      true,
      now(),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      company_name = 'ScInSites',
      is_active = true,
      updated_at = now();

    RAISE NOTICE 'Created/updated accredited advisor record for user %', v_user_id;

    -- Create identities entry for proper auth
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    )
    VALUES (
      gen_random_uuid(),
      v_user_id,
      'rob.chester@scinsites.com',
      jsonb_build_object('sub', v_user_id::text, 'email', 'rob.chester@scinsites.com', 'email_verified', true),
      'email',
      now(),
      now(),
      now()
    )
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created identity entry for user %', v_user_id;
  END IF;

  -- Find the Calculation Verification organization
  SELECT id INTO v_org_id
  FROM organizations
  WHERE lower(name) LIKE '%calculation%verification%'
     OR lower(name) LIKE '%calculation verification%'
  LIMIT 1;

  -- If organization found, grant access
  IF v_org_id IS NOT NULL AND v_user_id IS NOT NULL THEN
    -- Get the organization owner for granted_by field
    SELECT user_id INTO v_org_owner_id
    FROM organization_members om
    JOIN roles r ON om.role_id = r.id
    WHERE om.organization_id = v_org_id
      AND r.name = 'owner'
    LIMIT 1;

    -- If no owner found, use the advisor themselves
    v_org_owner_id := COALESCE(v_org_owner_id, v_user_id);

    -- Create the advisor organization access
    INSERT INTO public.advisor_organization_access (
      advisor_user_id,
      organization_id,
      is_active,
      granted_at,
      granted_by
    )
    VALUES (
      v_user_id,
      v_org_id,
      true,
      now(),
      v_org_owner_id
    )
    ON CONFLICT (advisor_user_id, organization_id)
    DO UPDATE SET
      is_active = true,
      granted_at = now(),
      revoked_at = NULL,
      revoked_by = NULL,
      revocation_reason = NULL,
      updated_at = now();

    RAISE NOTICE 'Granted advisor access to organization %', v_org_id;
  ELSE
    IF v_org_id IS NULL THEN
      RAISE NOTICE 'Organization "Calculation Verification" not found';
    END IF;
    IF v_user_id IS NULL THEN
      RAISE NOTICE 'User was not created';
    END IF;
  END IF;
END $$;
