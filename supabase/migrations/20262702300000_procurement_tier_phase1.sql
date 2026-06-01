-- ============================================================
-- PROCUREMENT TIER - PHASE 1 SCHEMA
-- ============================================================
-- Adds a procurement tier above distributor_organizations so a single
-- procurement client (e.g. Foodbuy serving Levy / Compass Group) can
-- aggregate sustainability data across the SKUs they buy via multiple
-- distributors (Hallgarten + Enotria in the first trial).
--
-- Design summary:
--   * procurement_organizations is a new tenant root, mirroring the
--     shape of distributor_organizations plus a full branding block so
--     the whitelabel layer can drive CSS variables, email templates and
--     PDF reports from one row.
--   * procurement_distributor_links is a many-to-many between a
--     procurement org and the distributor tenants that supply it. The
--     channel_label column is what the procurement CSV channel column
--     maps onto.
--   * procurement_sku_lists is the upload audit log for a procurement
--     SKU CSV. procurement_skus is a projection (not a duplication) of
--     the per-distributor brand_skus rows that an upload produced, with
--     procurement-specific economics (volume, list price).
--   * Sustainability data continues to live on brand_directory and
--     brand_directory-keyed tables (scraped_brand_data,
--     brand_completeness_snapshots, etc.). Procurement read access is
--     OR'd onto those tables via a security-definer helper
--     procurement_has_access_to_brand(...).
--   * Same branding columns are added to distributor_organizations so a
--     future co-branded distributor portal Just Works without a second
--     migration.
--   * brand_directory.procurement_visibility_threshold gates the
--     confidence floor a finding must clear before a procurement
--     dashboard surfaces it. Distributor view remains unfiltered.
--   * brand_profiles.procurement_origin_org_id is added now (Phase 7
--     wires it) so the upload-token brand form can co-brand without
--     a follow-up breaking migration.
--
-- Consumer code lands in later phases; this migration is schema only.
-- ============================================================

begin;

-- ============================================================
-- Tables: procurement tier
-- ============================================================

create table public.procurement_organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  display_name        text,
  parent_company      text,
  website             text,
  primary_market      text,
  subscription_tier   text not null default 'trial'
                       check (subscription_tier in ('trial','starter','pro','enterprise')),
  trial_started_at    timestamptz,
  trial_ends_at       timestamptz,
  -- Branding block: CSS variables, email template, PDF report all read
  -- from these fields. Null means "use the alka**tera** defaults".
  logo_url            text,
  primary_color       text,
  accent_color        text,
  email_logo_url      text,
  email_sender_name   text,
  email_sender_email  text,
  email_footer_text   text,
  pdf_footer_text     text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.procurement_members (
  id                       uuid primary key default gen_random_uuid(),
  procurement_org_id       uuid not null references public.procurement_organizations(id) on delete cascade,
  user_id                  uuid not null references auth.users(id) on delete cascade,
  role                     text not null default 'viewer'
                            check (role in ('owner','viewer')),
  invited_by               uuid references auth.users(id),
  joined_at                timestamptz not null default now(),
  unique (procurement_org_id, user_id)
);

create table public.procurement_invitations (
  id                       uuid primary key default gen_random_uuid(),
  procurement_org_id       uuid not null references public.procurement_organizations(id) on delete cascade,
  email                    text not null,
  role                     text not null default 'viewer'
                            check (role in ('owner','viewer')),
  token                    text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by               uuid not null references auth.users(id),
  expires_at               timestamptz not null default (now() + interval '7 days'),
  accepted_at              timestamptz,
  created_at               timestamptz not null default now()
);

-- Many-to-many: which distributor tenants supply which procurement org.
-- channel_label is the value the procurement CSV "distributor_channel"
-- column maps onto when an upload routes rows into the correct
-- distributor tenant. status='active' is the only one that participates
-- in read aggregation and outreach co-branding.
create table public.procurement_distributor_links (
  id                       uuid primary key default gen_random_uuid(),
  procurement_org_id       uuid not null references public.procurement_organizations(id) on delete cascade,
  distributor_org_id       uuid not null references public.distributor_organizations(id) on delete cascade,
  channel_label            text not null,
  status                   text not null default 'active'
                            check (status in ('active','invited','suspended')),
  reply_to_user_id         uuid references auth.users(id),
  email_subject_template   text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (procurement_org_id, distributor_org_id),
  unique (procurement_org_id, channel_label)
);

create table public.procurement_sku_lists (
  id                       uuid primary key default gen_random_uuid(),
  procurement_org_id       uuid not null references public.procurement_organizations(id) on delete cascade,
  uploaded_by              uuid not null references auth.users(id),
  file_name                text not null,
  file_path                text not null,
  file_type                text not null check (file_type in ('csv','xlsx','pdf')),
  row_count                integer,
  brand_count              integer,
  channel_summary          jsonb,
  status                   text not null default 'pending'
                            check (status in ('pending','mapping','processing','complete','error')),
  error_message            text,
  column_mapping           jsonb,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Projection of the per-distributor brand_skus rows that a procurement
-- CSV upload produced. Sustainability data continues to live on
-- brand_directory + brand_directory-keyed tables; this table holds the
-- procurement-specific economics (volume, list price) and the FKs that
-- let the dashboard aggregate across both distributor channels.
--
-- The same brand sourced via the same channel for the same procurement
-- collapses to one row via the unique constraint; the same brand
-- sourced via both Hallgarten and Enotria yields two rows (this is
-- expected dual-channel sourcing).
create table public.procurement_skus (
  id                          uuid primary key default gen_random_uuid(),
  procurement_org_id          uuid not null references public.procurement_organizations(id) on delete cascade,
  procurement_sku_list_id     uuid references public.procurement_sku_lists(id) on delete set null,
  brand_directory_id          uuid not null references public.brand_directory(id) on delete restrict,
  source_distributor_org_id   uuid not null references public.distributor_organizations(id) on delete restrict,
  -- Nullable so CSV ingest can insert a procurement_sku row before the
  -- corresponding distributor-side brand_skus row exists transactionally;
  -- the processor backfills this FK in a second pass.
  source_brand_sku_id         uuid references public.brand_skus(id) on delete set null,
  channel_label               text not null,
  product_name                text not null,
  sku_code                    text,
  category                    text,
  country_of_origin           text,
  vintage                     integer,
  volume_per_year_liters      numeric(12,2),
  list_price_gbp              numeric(10,2),
  listing_status              text not null default 'active'
                                check (listing_status in ('active','delisted')),
  procurement_notes           text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (procurement_org_id, source_distributor_org_id, brand_directory_id, sku_code, vintage)
);

-- ============================================================
-- Extensions to existing tables
-- ============================================================

-- Branding parity with procurement_organizations: a future co-branded
-- distributor (e.g. when Hallgarten wants its own theme) is a row update
-- away from being themed, not another migration away.
alter table public.distributor_organizations
  add column if not exists primary_color       text,
  add column if not exists accent_color        text,
  add column if not exists email_logo_url      text,
  add column if not exists email_sender_name   text,
  add column if not exists email_sender_email  text,
  add column if not exists email_footer_text   text,
  add column if not exists pdf_footer_text     text;

-- Confidence floor for scraped/derived findings to be surfaced on a
-- procurement dashboard. The distributor portal reads scraped_brand_data
-- unfiltered; the procurement dashboard filters via this threshold so
-- low-confidence findings (wrong brand matched, hallucinated certs)
-- don't reach Foodbuy's view of Levy's portfolio. Per-brand override
-- so the alka**tera** admin curation pass can raise the bar on a
-- particular brand.
alter table public.brand_directory
  add column if not exists procurement_visibility_threshold numeric(3,2) not null default 0.60;

-- Set on outreach dispatch when the distributor's brand_profile was
-- linked to a procurement org. The /brand-upload/[token] page reads
-- this to choose between the alka**tera**-only header and the
-- alka**tera** + procurement co-branded header.
alter table public.brand_profiles
  add column if not exists procurement_origin_org_id uuid references public.procurement_organizations(id) on delete set null;

-- ============================================================
-- Indexes
-- ============================================================
create index procurement_members_user_idx              on public.procurement_members (user_id);
create index procurement_members_org_idx               on public.procurement_members (procurement_org_id);
create index procurement_invitations_org_idx           on public.procurement_invitations (procurement_org_id);
create index procurement_invitations_token_idx         on public.procurement_invitations (token);
create index procurement_distributor_links_proc_idx    on public.procurement_distributor_links (procurement_org_id) where status = 'active';
create index procurement_distributor_links_dist_idx    on public.procurement_distributor_links (distributor_org_id) where status = 'active';
create index procurement_sku_lists_org_idx             on public.procurement_sku_lists (procurement_org_id, created_at desc);
create index procurement_skus_proc_idx                 on public.procurement_skus (procurement_org_id);
create index procurement_skus_directory_idx            on public.procurement_skus (brand_directory_id);
create index procurement_skus_source_idx               on public.procurement_skus (source_brand_sku_id);
create index procurement_skus_source_distributor_idx   on public.procurement_skus (source_distributor_org_id);
create index brand_profiles_procurement_origin_idx     on public.brand_profiles (procurement_origin_org_id) where procurement_origin_org_id is not null;

-- ============================================================
-- Security-definer helpers
-- ============================================================
-- Mirrors current_distributor_org_ids() from migration
-- 20262606300000_fix_distributor_members_rls.sql. The same self-recursion
-- bug applies to procurement_members - any SELECT policy that queries
-- procurement_members from within procurement_members's own policy
-- returns zero rows, breaking the login flow. Use this helper from RLS
-- policies on the other procurement tables.
create or replace function public.current_procurement_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select procurement_org_id
  from public.procurement_members
  where user_id = auth.uid();
$$;

revoke all on function public.current_procurement_org_ids() from public;
grant execute on function public.current_procurement_org_ids() to authenticated;

-- Does this procurement org have read access to data on this brand?
-- True when at least one active procurement_distributor_links row joins
-- the procurement org to a distributor that has an active brand_profiles
-- row pointing at the brand_directory entry. Brand opt-outs against a
-- specific distributor are honoured downstream by routing reads through
-- get_brand_data_for_distributor(...) once per linked distributor; this
-- function decides only the coarse "is this brand even in scope".
create or replace function public.procurement_has_access_to_brand(
  p_procurement_org_id uuid,
  p_brand_directory_id uuid
) returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.procurement_distributor_links pdl
    join public.brand_profiles bp
      on bp.distributor_org_id = pdl.distributor_org_id
    where pdl.procurement_org_id = p_procurement_org_id
      and pdl.status = 'active'
      and bp.brand_directory_id = p_brand_directory_id
  )
$$;

revoke all on function public.procurement_has_access_to_brand(uuid, uuid) from public;
grant execute on function public.procurement_has_access_to_brand(uuid, uuid) to authenticated;

-- ============================================================
-- Row Level Security: procurement tables
-- ============================================================
alter table public.procurement_organizations       enable row level security;
alter table public.procurement_members             enable row level security;
alter table public.procurement_invitations         enable row level security;
alter table public.procurement_distributor_links   enable row level security;
alter table public.procurement_sku_lists           enable row level security;
alter table public.procurement_skus                enable row level security;

-- ------------------------------------------------------------
-- procurement_organizations
-- ------------------------------------------------------------
create policy "procurement members read their org"
  on public.procurement_organizations for select
  using (id in (select public.current_procurement_org_ids()));

create policy "procurement owners update their org"
  on public.procurement_organizations for update
  using (
    id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Inserts: service role only (signup / seed API), no policy here.

-- ------------------------------------------------------------
-- procurement_members
-- ------------------------------------------------------------
create policy "procurement members read own row"
  on public.procurement_members for select
  using (user_id = auth.uid());

create policy "procurement members read peers in same org"
  on public.procurement_members for select
  using (procurement_org_id in (select public.current_procurement_org_ids()));

create policy "procurement owners add members"
  on public.procurement_members for insert
  with check (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "procurement owners remove members"
  on public.procurement_members for delete
  using (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "procurement owners update members"
  on public.procurement_members for update
  using (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- procurement_invitations
-- ------------------------------------------------------------
create policy "procurement members read invites in their org"
  on public.procurement_invitations for select
  using (procurement_org_id in (select public.current_procurement_org_ids()));

create policy "procurement owners create invites"
  on public.procurement_invitations for insert
  with check (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "procurement owners delete invites"
  on public.procurement_invitations for delete
  using (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- procurement_distributor_links
-- ------------------------------------------------------------
-- Procurement members see their links; distributor members also see
-- links involving their distributor org so the distributor portal can
-- show a "supplied to procurement X" badge in later phases.
create policy "procurement members read links"
  on public.procurement_distributor_links for select
  using (procurement_org_id in (select public.current_procurement_org_ids()));

create policy "distributor members read links involving their org"
  on public.procurement_distributor_links for select
  using (distributor_org_id in (select public.current_distributor_org_ids()));

-- Mutations: service role only (admin tooling), no insert/update/delete
-- policies for authenticated.

-- ------------------------------------------------------------
-- procurement_sku_lists
-- ------------------------------------------------------------
create policy "procurement members read sku lists"
  on public.procurement_sku_lists for select
  using (procurement_org_id in (select public.current_procurement_org_ids()));

create policy "procurement owners write sku lists"
  on public.procurement_sku_lists for all
  using (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  )
  with check (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- procurement_skus
-- ------------------------------------------------------------
create policy "procurement members read skus"
  on public.procurement_skus for select
  using (procurement_org_id in (select public.current_procurement_org_ids()));

create policy "procurement owners write skus"
  on public.procurement_skus for all
  using (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  )
  with check (
    procurement_org_id in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ============================================================
-- Row Level Security: procurement reads on shared brand tables
-- ============================================================
-- These policies ADD procurement read access alongside the existing
-- distributor read policies. The distributor policies remain in place
-- unchanged; PostgreSQL OR's policies of the same command on the same
-- table, so a row that satisfies either side is visible.

-- brand_directory already has "anyone authenticated can read" - no
-- additional policy needed for procurement read of the directory rows
-- themselves. Score / completeness mirrors there are already public to
-- any authenticated user. The fine-grained gating happens on the
-- *findings* tables below.

create policy "procurement members read scraped data"
  on public.scraped_brand_data for select
  using (
    exists (
      select 1 from public.procurement_members pm
      where pm.user_id = auth.uid()
        and public.procurement_has_access_to_brand(pm.procurement_org_id, scraped_brand_data.brand_directory_id)
    )
  );

create policy "procurement members read completeness"
  on public.brand_completeness_snapshots for select
  using (
    exists (
      select 1 from public.procurement_members pm
      where pm.user_id = auth.uid()
        and public.procurement_has_access_to_brand(pm.procurement_org_id, brand_completeness_snapshots.brand_directory_id)
    )
  );

create policy "procurement members read brand documents"
  on public.brand_document_submissions for select
  using (
    exists (
      select 1 from public.procurement_members pm
      where pm.user_id = auth.uid()
        and public.procurement_has_access_to_brand(pm.procurement_org_id, brand_document_submissions.brand_directory_id)
    )
  );

-- Procurement read on the listings (brand_profiles) of the linked
-- distributors. This is what makes the procurement dashboard query
-- "give me everything Hallgarten and Enotria list for Foodbuy" work
-- without exposing other distributors' listings.
create policy "procurement members read linked brand profiles"
  on public.brand_profiles for select
  using (
    distributor_org_id in (
      select pdl.distributor_org_id
      from public.procurement_distributor_links pdl
      join public.procurement_members pm on pm.procurement_org_id = pdl.procurement_org_id
      where pm.user_id = auth.uid() and pdl.status = 'active'
    )
  );

create policy "procurement members read linked brand skus"
  on public.brand_skus for select
  using (
    distributor_org_id in (
      select pdl.distributor_org_id
      from public.procurement_distributor_links pdl
      join public.procurement_members pm on pm.procurement_org_id = pdl.procurement_org_id
      where pm.user_id = auth.uid() and pdl.status = 'active'
    )
  );

-- ============================================================
-- Storage: procurement-sku-lists bucket
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'procurement-sku-lists',
  'procurement-sku-lists',
  false,
  26214400,
  array[
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

drop policy if exists "procurement_sku_lists_read"  on storage.objects;
drop policy if exists "procurement_sku_lists_write" on storage.objects;

create policy "procurement_sku_lists_read"
  on storage.objects for select
  using (
    bucket_id = 'procurement-sku-lists'
    and (storage.foldername(name))[1]::uuid in (select public.current_procurement_org_ids())
  );

create policy "procurement_sku_lists_write"
  on storage.objects for all
  using (
    bucket_id = 'procurement-sku-lists'
    and (storage.foldername(name))[1]::uuid in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  )
  with check (
    bucket_id = 'procurement-sku-lists'
    and (storage.foldername(name))[1]::uuid in (
      select procurement_org_id from public.procurement_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

commit;
