-- Security fix: organization_suppliers_view executed with the postgres owner's
-- privileges (no security_invoker), which bypassed RLS on organization_suppliers.
-- Any authenticated user could read every organisation's supplier relationships
-- (annual spend, notes, engagement status) simply by selecting from the view
-- with an organization_id filter.
--
-- Fix in two parts:
-- 1. Flip the view to security_invoker so the caller's RLS applies.
-- 2. Widen the base-table SELECT policy so the legitimate readers keep working:
--    - org members (previous behaviour),
--    - advisors with active advisor_organization_access (previously relied on
--      the view's RLS bypass),
--    - alkatera platform admins (mirrors the write-policy bypass added in
--      20260716100000_organization_suppliers_alkatera_admin_bypass.sql).
--    user_has_organization_access() already covers members + active advisors
--    and is SECURITY DEFINER, so it is safe inside RLS.
--
-- The view's join to platform_suppliers still returns rows because
-- platform_suppliers has an open SELECT policy for authenticated users
-- (the supplier directory listing depends on it).

alter view public.organization_suppliers_view set (security_invoker = true);

drop policy if exists "Organization members can view their suppliers" on public.organization_suppliers;
create policy "Organization members can view their suppliers"
  on public.organization_suppliers
  for select to authenticated
  using (
    public.user_has_organization_access(organization_id)
    or public.is_alkatera_admin()
  );
