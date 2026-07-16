-- organization_suppliers: allow alkatera platform admins to manage supplier links.
--
-- The UI permission hook (useSupplierPermissions) grants write access when
-- is_alkatera_admin() is true, and the sibling tables (suppliers,
-- supplier_products) already include an is_alkatera_admin() bypass in their
-- write policies. organization_suppliers was the odd one out: its policies
-- only allowed admin/owner members, so a platform admin (or an advisor who is
-- also a platform admin) saw an enabled "Add to My Suppliers" button whose
-- insert was then rejected by RLS ("Failed to add supplier").

drop policy if exists "Organization admins can add suppliers" on public.organization_suppliers;
create policy "Organization admins can add suppliers"
  on public.organization_suppliers
  for insert to authenticated
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('admin', 'owner')
    )
    or public.is_alkatera_admin()
  );

drop policy if exists "Organization admins can update suppliers" on public.organization_suppliers;
create policy "Organization admins can update suppliers"
  on public.organization_suppliers
  for update to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('admin', 'owner')
    )
    or public.is_alkatera_admin()
  )
  with check (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('admin', 'owner')
    )
    or public.is_alkatera_admin()
  );

drop policy if exists "Organization admins can remove suppliers" on public.organization_suppliers;
create policy "Organization admins can remove suppliers"
  on public.organization_suppliers
  for delete to authenticated
  using (
    organization_id in (
      select om.organization_id
      from public.organization_members om
      join public.roles r on r.id = om.role_id
      where om.user_id = auth.uid()
        and r.name in ('admin', 'owner')
    )
    or public.is_alkatera_admin()
  );
