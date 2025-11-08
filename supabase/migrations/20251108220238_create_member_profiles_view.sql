/*
  # Create Member Profiles View with RLS

  ## Overview
  This migration creates a database VIEW that pre-joins organization_members and profiles
  tables. This simplifies client-side queries and eliminates PGRST201 errors caused by
  relationship ambiguity in Supabase's PostgREST layer.

  ## Problem Being Solved
  When querying organization_members with a join to profiles:
    `supabase.from('organization_members').select('*, profiles(*)')`
  
  PostgREST can encounter PGRST201 errors due to:
  - Multiple possible relationship paths
  - Ambiguity in foreign key resolution
  - Complex RLS policy evaluation across joined tables

  ## Solution
  Create a VIEW that materializes the join, making it a single queryable entity:
    `supabase.from('member_profiles').select('*')`
  
  This is cleaner, faster, and eliminates relationship ambiguity.

  ## Migration Steps

  ### Part 1: Create the View
    - Name: public.member_profiles
    - Joins: organization_members ⋈ profiles ⋈ roles
    - Columns: organization_id, user_id, role_id, role, full_name, avatar_url, email, etc.

  ### Part 2: Apply Security
    - Set security_invoker = true to inherit RLS from base tables
    - The view automatically filters based on organization_members RLS policy
    - Users only see members from their organization

  ### Part 3: Benefits
    - Simpler client-side queries
    - No PGRST201 errors
    - Better performance (pre-joined)
    - Automatic security through RLS inheritance
    - Single source of truth for member data

  ## Security Guarantees
    - View uses security_invoker = true
    - Inherits RLS policies from organization_members table
    - organization_members policy: organization_id = get_current_organization_id()
    - Users can only see members from their organization
    - No data leaks across tenant boundaries

  ## Usage Example
    Before:
      const { data } = await supabase
        .from('organization_members')
        .select('*, profiles(*)')
    
    After:
      const { data } = await supabase
        .from('member_profiles')
        .select('*')
*/

-- =====================================================
-- PART 1: CREATE THE MEMBER_PROFILES VIEW
-- =====================================================

-- Drop the view if it exists (for idempotency)
DROP VIEW IF EXISTS public.member_profiles CASCADE;

-- Create the view that joins organization_members with profiles and roles
-- Using security_invoker = true makes it inherit RLS from base tables
CREATE VIEW public.member_profiles
WITH (security_invoker = true)
AS
SELECT 
  om.id as membership_id,
  om.organization_id,
  om.user_id,
  om.role_id,
  r.name as role,
  p.email,
  p.full_name,
  p.avatar_url,
  p.phone,
  p.created_at as profile_created_at,
  p.updated_at as profile_updated_at,
  om.joined_at,
  om.invited_by
FROM public.organization_members om
INNER JOIN public.profiles p ON om.user_id = p.id
LEFT JOIN public.roles r ON om.role_id = r.id;

-- Add comprehensive documentation
COMMENT ON VIEW public.member_profiles IS 
  'Pre-joined view of organization members with their profile information. Eliminates PGRST201 errors and simplifies client queries. Uses security_invoker=true to inherit RLS from organization_members table, ensuring multi-tenant isolation.';

-- =====================================================
-- PART 2: GRANT APPROPRIATE PERMISSIONS
-- =====================================================

-- Grant SELECT permission to authenticated users
GRANT SELECT ON public.member_profiles TO authenticated;

-- Add a comment explaining the security model
COMMENT ON VIEW public.member_profiles IS 
  'Secure view combining organization_members with profiles. Uses security_invoker=true to inherit RLS from base tables. Users automatically see only members from their organization via get_current_organization_id() check on organization_members table.';
