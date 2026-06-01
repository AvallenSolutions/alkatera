-- ============================================================
-- PROCUREMENT TIER - DISTRIBUTOR VISIBILITY
-- ============================================================
-- Foodbuy needs to display the names of its linked distributors
-- ("Hallgarten", "Enotria") on the dashboard, brand drilldown, outreach
-- view, and PDF report. The Phase 1 migration locked
-- distributor_organizations to its own members only, which means the
-- procurement portal's cookie-session reads currently return zero
-- distributor rows.
--
-- This migration adds a narrow, one-way read policy: procurement
-- members can read the org row for any distributor they have an
-- ACTIVE link to. They cannot read other distributors, cannot read
-- distributor_members, cannot read distributor_sku_lists for that
-- distributor, cannot read outreach_emails, cannot read any other
-- distributor-internal data. They get the name + slug + logo only.
--
-- The reverse direction (distributor → procurement) is unchanged:
-- distributors cannot read procurement_organizations, period.
-- ============================================================

begin;

create policy "procurement members read linked distributor orgs"
  on public.distributor_organizations for select
  using (
    id in (
      select pdl.distributor_org_id
      from public.procurement_distributor_links pdl
      join public.procurement_members pm on pm.procurement_org_id = pdl.procurement_org_id
      where pm.user_id = auth.uid() and pdl.status = 'active'
    )
  );

commit;
