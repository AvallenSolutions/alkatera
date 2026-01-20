/*
  # Fix Advisor User Setup

  IMPORTANT: Create the user first via Supabase Dashboard:
  1. Go to Authentication → Users → Add User
  2. Email: rosie@impactfocus.co
  3. Password: @rosie123
  4. Click "Create User"
  5. Then run this migration OR it will auto-setup when user signs up

  This migration sets up the advisor profile and organization access
  for an existing user with email rosie@impactfocus.co
*/

-- Clean up any broken records from previous migration attempt
DELETE FROM public.advisor_organization_access
WHERE advisor_user_id IN (
  SELECT id FROM auth.users WHERE email = 'rosie@impactfocus.co'
);

DELETE FROM public.accredited_advisors
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email = 'rosie@impactfocus.co'
);

-- Setup advisor profile for existing user (if they exist)
DO $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_org_owner_id UUID;
BEGIN
  -- Find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'rosie@impactfocus.co';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User rosie@impactfocus.co not found. Please create via Supabase Dashboard first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user: %', v_user_id;

  -- Create/update profile
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (v_user_id, 'rosie@impactfocus.co', 'Rosie - Impact Focus', now(), now())
  ON CONFLICT (id) DO UPDATE SET
    full_name = 'Rosie - Impact Focus',
    updated_at = now();

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
    'Impact Focus',
    'Sustainability consultant specializing in carbon accounting and LCA for food & beverage companies.',
    ARRAY['Carbon Accounting', 'Life Cycle Assessment', 'Supply Chain Sustainability', 'DEFRA Reporting'],
    ARRAY['GHG Protocol Certified', 'ISO 14064 Lead Verifier'],
    true,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    company_name = 'Impact Focus',
    is_active = true,
    updated_at = now();

  RAISE NOTICE 'Created advisor profile';

  -- Find Calculation Verification organization
  SELECT id INTO v_org_id
  FROM organizations
  WHERE lower(name) LIKE '%calculation%verification%'
     OR lower(name) LIKE '%calculation verification%'
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE NOTICE 'Calculation Verification organization not found';
    RETURN;
  END IF;

  -- Get org owner for granted_by
  SELECT user_id INTO v_org_owner_id
  FROM organization_members om
  JOIN roles r ON om.role_id = r.id
  WHERE om.organization_id = v_org_id AND r.name = 'owner'
  LIMIT 1;

  v_org_owner_id := COALESCE(v_org_owner_id, v_user_id);

  -- Grant advisor access
  INSERT INTO public.advisor_organization_access (
    advisor_user_id,
    organization_id,
    is_active,
    granted_at,
    granted_by
  )
  VALUES (v_user_id, v_org_id, true, now(), v_org_owner_id)
  ON CONFLICT (advisor_user_id, organization_id)
  DO UPDATE SET
    is_active = true,
    granted_at = now(),
    revoked_at = NULL,
    updated_at = now();

  RAISE NOTICE 'Granted advisor access to organization %', v_org_id;
END $$;

-- Create a trigger to auto-setup advisor when user signs up
CREATE OR REPLACE FUNCTION setup_advisor_on_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_org_owner_id UUID;
BEGIN
  -- Only process rosie@impactfocus.co
  IF NEW.email != 'rosie@impactfocus.co' THEN
    RETURN NEW;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, email, full_name, created_at, updated_at)
  VALUES (NEW.id, NEW.email, 'Rosie - Impact Focus', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Register as advisor
  INSERT INTO public.accredited_advisors (
    user_id, company_name, advisor_bio, expertise_areas, certifications,
    is_active, accredited_at, training_completed_at
  )
  VALUES (
    NEW.id, 'Impact Focus',
    'Sustainability consultant specializing in carbon accounting and LCA.',
    ARRAY['Carbon Accounting', 'LCA', 'DEFRA Reporting'],
    ARRAY['GHG Protocol Certified'],
    true, now(), now()
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Find and grant access to Calculation Verification org
  SELECT id INTO v_org_id FROM organizations
  WHERE lower(name) LIKE '%calculation%verification%' LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    SELECT user_id INTO v_org_owner_id
    FROM organization_members om JOIN roles r ON om.role_id = r.id
    WHERE om.organization_id = v_org_id AND r.name = 'owner' LIMIT 1;

    INSERT INTO public.advisor_organization_access (
      advisor_user_id, organization_id, is_active, granted_at, granted_by
    )
    VALUES (NEW.id, v_org_id, true, now(), COALESCE(v_org_owner_id, NEW.id))
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_advisor_signup ON auth.users;
CREATE TRIGGER on_advisor_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION setup_advisor_on_signup();
