-- Security Hardening Migration
-- Addresses CRITICAL and HIGH severity findings from security audit 2026-04-03

-- ============================================================================
-- C2: Fix overly permissive RLS on advisor_organization_access
-- Previously: USING (true) WITH CHECK (true) - any authenticated user could
-- grant themselves advisor access to any organisation
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for advisor_organization_access" ON "public"."advisor_organization_access";

-- Advisors can view their own access records
CREATE POLICY "Advisors can view their own access"
  ON "public"."advisor_organization_access"
  FOR SELECT
  TO "authenticated"
  USING (advisor_user_id = auth.uid());

-- Organisation members can view advisor access for their org
CREATE POLICY "Org members can view advisor access"
  ON "public"."advisor_organization_access"
  FOR SELECT
  TO "authenticated"
  USING ("public"."user_has_organization_access"("organization_id"));

-- Only org admins/owners can manage advisor access
CREATE POLICY "Org admins can manage advisor access"
  ON "public"."advisor_organization_access"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can update advisor access"
  ON "public"."advisor_organization_access"
  FOR UPDATE
  TO "authenticated"
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

CREATE POLICY "Org admins can delete advisor access"
  ON "public"."advisor_organization_access"
  FOR DELETE
  TO "authenticated"
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om
      JOIN roles r ON r.id = om.role_id
      WHERE om.user_id = auth.uid()
      AND r.name IN ('owner', 'admin')
    )
  );

-- ============================================================================
-- C3: Fix overly permissive RLS on accredited_advisors
-- Previously: USING (true) WITH CHECK (true) - any user could create fake
-- advisor accreditation records
-- ============================================================================

DROP POLICY IF EXISTS "Allow all for accredited_advisors" ON "public"."accredited_advisors";

-- Anyone authenticated can view active accredited advisors (for advisor marketplace)
CREATE POLICY "Anyone can view active advisors"
  ON "public"."accredited_advisors"
  FOR SELECT
  TO "authenticated"
  USING (is_active = true);

-- Advisors can view their own record (even if inactive)
CREATE POLICY "Advisors can view their own record"
  ON "public"."accredited_advisors"
  FOR SELECT
  TO "authenticated"
  USING (user_id = auth.uid());

-- Only platform admins can manage advisor accreditation
CREATE POLICY "Platform admins manage accreditation"
  ON "public"."accredited_advisors"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (public.is_alkatera_admin());

CREATE POLICY "Platform admins update accreditation"
  ON "public"."accredited_advisors"
  FOR UPDATE
  TO "authenticated"
  USING (public.is_alkatera_admin())
  WITH CHECK (public.is_alkatera_admin());

CREATE POLICY "Platform admins delete accreditation"
  ON "public"."accredited_advisors"
  FOR DELETE
  TO "authenticated"
  USING (public.is_alkatera_admin());

-- ============================================================================
-- C4: Enforce product limits at the database level
-- Previously: increment_product_count() logged violations but didn't prevent
-- inserts, allowing subscription tier limits to be bypassed
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_product_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_check JSONB;
BEGIN
  v_check := public.check_product_limit(NEW.organization_id);

  IF NOT (v_check->>'allowed')::boolean THEN
    RAISE EXCEPTION 'Product limit reached for this subscription tier: %', v_check->>'reason';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop if exists to make migration idempotent
DROP TRIGGER IF EXISTS check_product_limit_before_insert ON public.products;

CREATE TRIGGER check_product_limit_before_insert
  BEFORE INSERT ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_product_limit();

-- ============================================================================
-- H5: Fix advisor invitation token enumeration
-- Previously: "Anyone can view invitation by token" with USING (true) allowed
-- any authenticated user to list ALL pending invitations (emails, org IDs)
-- The "Org admins can view advisor invitations" policy already exists from
-- 20260203150000_advisor_rpc_functions.sql, so we only need to:
--   1. Drop the overly permissive policy
--   2. Add an email-based policy so advisors can see their own invitations
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view invitation by token" ON "public"."advisor_invitations";

-- Advisors can view invitations sent to their email
CREATE POLICY "Advisors can view their own invitations"
  ON "public"."advisor_invitations"
  FOR SELECT
  TO "authenticated"
  USING (
    advisor_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );
