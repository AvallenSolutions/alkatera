-- ============================================================
-- DISTRIBUTOR - READ LINKED PROCUREMENT ORG BRANDING
-- ============================================================
-- For procurement-partner tier distributors (Hallgarten / Enotria
-- linked to Foodbuy), the distributor portal needs to know who's
-- paying for them so it can wear that procurement org's branding.
-- This policy lets a distributor member read the procurement_org
-- row(s) for any active link involving their distributor org. It is
-- the mirror of the policy granted in the opposite direction by
-- 20262702400000.
--
-- Distributors still cannot see procurement_members, procurement_skus,
-- procurement_sku_lists, etc. The exposure is strictly the public
-- branding identity of the procurement client they're partnered with.
-- ============================================================

begin;

create policy "distributor members read linked procurement orgs"
  on public.procurement_organizations for select
  using (
    id in (
      select pdl.procurement_org_id
      from public.procurement_distributor_links pdl
      where pdl.status = 'active'
        and pdl.distributor_org_id in (select public.current_distributor_org_ids())
    )
  );

commit;
