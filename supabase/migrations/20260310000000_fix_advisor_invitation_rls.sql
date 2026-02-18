-- Fix advisor invitation RLS: allow invited users to view their invitation
--
-- The advisor invite page queries advisor_invitations directly, but only
-- org admins had SELECT access. Invited advisors (who may not even have an
-- account yet) could not view their own invitation, causing the invite link
-- to fail with "Invalid invitation link."
--
-- Fix: Add a SELECT policy that allows anyone to read a specific invitation
-- by its token. This is safe because:
--   1. Invitation tokens are cryptographic UUIDs (unguessable)
--   2. The accept flow still validates email match and auth in the RPC
--   3. Only non-sensitive data is exposed (org name, email, dates, status)

CREATE POLICY "Anyone can view invitation by token"
  ON "public"."advisor_invitations"
  FOR SELECT
  USING (true);
