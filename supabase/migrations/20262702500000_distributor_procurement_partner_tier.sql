-- ============================================================
-- DISTRIBUTOR - PROCUREMENT PARTNER TIER
-- ============================================================
-- Introduces a "procurement partner" flag on distributor_organizations:
-- the free tier we grant to a distributor when a procurement client
-- (Foodbuy in the trial) lists them as a supplying channel. Partners
-- can do everything their procurement client needs them to do (send
-- outreach, manage brand profiles for procurement-routed brands,
-- receive submissions) but cannot upload their own SKU lists, browse
-- the directory's Discover feature, or export portfolio reports until
-- they sign up as a full alka**tera** customer.
--
-- The gate is enforced at the application layer (API routes + UI),
-- not at RLS, because the capability check needs to differentiate
-- "Hallgarten reading the Foodbuy-routed brand profiles they DO have"
-- from "Hallgarten trying to upload a NEW SKU list of their own". RLS
-- already locks tenancy correctly; this is a commercial gate on top.
-- ============================================================

begin;

alter table public.distributor_organizations
  add column if not exists is_procurement_partner boolean not null default false,
  add column if not exists procurement_partner_since timestamptz;

create index if not exists distributor_organizations_procurement_partner_idx
  on public.distributor_organizations (is_procurement_partner)
  where is_procurement_partner = true;

comment on column public.distributor_organizations.is_procurement_partner is
  'Free-tier distributor granted access because a procurement client links them as a channel. Gated on: upload own SKU lists, Discover, export portfolio reports. Flip to false when they convert to a paying customer.';

comment on column public.distributor_organizations.procurement_partner_since is
  'When this distributor became a procurement partner. Null for direct paying customers.';

commit;
