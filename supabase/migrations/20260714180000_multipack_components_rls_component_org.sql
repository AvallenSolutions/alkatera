-- multipack_components RLS: also require access to the COMPONENT product's
-- organisation. The previous policies only checked the multipack parent's
-- org, so a row could reference another organisation's product by id
-- (sequential integers), and any service-role path walking components would
-- fold the foreign product's name and footprint into the caller's output.

drop policy if exists multipack_components_select on public.multipack_components;
drop policy if exists multipack_components_insert on public.multipack_components;
drop policy if exists multipack_components_update on public.multipack_components;
drop policy if exists multipack_components_delete on public.multipack_components;

create policy multipack_components_select on public.multipack_components
  for select to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = multipack_components.multipack_product_id
        and public.user_has_organization_access(p.organization_id)
    )
  );

create policy multipack_components_insert on public.multipack_components
  for insert to authenticated
  with check (
    exists (
      select 1 from public.products p
      where p.id = multipack_components.multipack_product_id
        and public.user_has_organization_access(p.organization_id)
    )
    and exists (
      select 1 from public.products cp
      where cp.id = multipack_components.component_product_id
        and public.user_has_organization_access(cp.organization_id)
    )
  );

create policy multipack_components_update on public.multipack_components
  for update to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = multipack_components.multipack_product_id
        and public.user_has_organization_access(p.organization_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = multipack_components.multipack_product_id
        and public.user_has_organization_access(p.organization_id)
    )
    and exists (
      select 1 from public.products cp
      where cp.id = multipack_components.component_product_id
        and public.user_has_organization_access(cp.organization_id)
    )
  );

create policy multipack_components_delete on public.multipack_components
  for delete to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = multipack_components.multipack_product_id
        and public.user_has_organization_access(p.organization_id)
    )
  );
