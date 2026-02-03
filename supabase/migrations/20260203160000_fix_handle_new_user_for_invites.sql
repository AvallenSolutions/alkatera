-- Update handle_new_user to also add invited users to their organization
CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_organization_id UUID;
  v_role_id UUID;
BEGIN
  -- Create the profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  -- Check if this user was invited to an organization
  v_organization_id := (NEW.raw_user_meta_data->>'organization_id')::UUID;
  v_role_id := (NEW.raw_user_meta_data->>'role_id')::UUID;

  -- If invitation metadata exists, add them to the organization
  IF v_organization_id IS NOT NULL AND v_role_id IS NOT NULL THEN
    INSERT INTO public.organization_members (
      organization_id,
      user_id,
      role_id,
      joined_at
    )
    VALUES (
      v_organization_id,
      NEW.id,
      v_role_id,
      NOW()
    )
    ON CONFLICT (organization_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
