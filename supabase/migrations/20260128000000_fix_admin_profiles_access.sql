/*
  # Fix Admin Access to User Profiles and Organizations in Feedback System

  ## Problem
  The feedback_tickets_with_users view joins with both the profiles and
  organizations tables to get creator and organization information. However:

  1. The profiles table RLS policy only allows users to view their own profile
  2. The organizations table RLS policy only allows members to view their org

  This prevents Alkatera admins from viewing feedback tickets created by users
  in organizations they don't belong to, causing "Ticket not found" errors.

  ## Solution
  Add RLS policies that allow Alkatera admins to view all profiles and organizations.
*/

-- Allow Alkatera admins to view all profiles
CREATE POLICY "Alkatera admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_alkatera_admin = true
    )
  );

-- Allow Alkatera admins to view all organizations
CREATE POLICY "Alkatera admins can view all organizations"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.is_alkatera_admin = true
    )
  );
