-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 1 SCHEMA
-- ============================================================
-- Foundation tables for the alka**tera** distributor portal. This phase
-- lets a distributor sign up, upload a product list (CSV/XLSX/PDF), see
-- its rows grouped into deduplicated brand profiles, and view a portfolio
-- dashboard shell. Later phases (3, 5, 6, 8, 12, 14) add brand outreach,
-- tokenised brand uploads, completeness scoring, public directory, and
-- the vintage UI. Schema for those features is included now where
-- holding off would force a later breaking migration (vintages, scoring
-- fields, outreach state, directory opt-in, upload token).
-- ============================================================

begin;

-- ============================================================
-- Tables
-- ============================================================

-- Distributor organisations: a separate tenant root from public.organizations
-- (which is for brand/supplier customers). Distributors have their own
-- subscription tiers, their own member set, and their own auth flow.
create table public.distributor_organizations (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  slug                text unique not null,
  logo_url            text,
  website             text,
  primary_market      text,
  subscription_tier   text not null default 'starter'
                       check (subscription_tier in ('starter','pro','enterprise')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Distributor members: auth.users linked to a distributor_organizations row.
-- brand_scope / category_scope let viewer-role users be restricted to a
-- subset of brands or categories (enforced in application layer; RLS
-- still gates the org boundary).
create table public.distributor_members (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  role                text not null default 'viewer'
                       check (role in ('owner','data_manager','viewer')),
  brand_scope         uuid[],
  category_scope      text[],
  invited_by          uuid references auth.users(id),
  joined_at           timestamptz not null default now(),
  unique (distributor_org_id, user_id)
);

-- Pending invitations for additional distributor members. Owner /
-- data_manager generates a token; recipient accepts via /distributor/
-- accept-invite/[token] (Phase 6 UI).
create table public.distributor_invitations (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  email               text not null,
  role                text not null default 'viewer'
                       check (role in ('owner','data_manager','viewer')),
  token               text unique not null default encode(gen_random_bytes(32), 'hex'),
  invited_by          uuid not null references auth.users(id),
  expires_at          timestamptz not null default (now() + interval '7 days'),
  accepted_at         timestamptz,
  created_at          timestamptz not null default now()
);

-- One row per uploaded product-list file. Tracks the file location in
-- Storage, the parser-detected status, and the final column mapping the
-- user confirmed. The same physical file can produce many brand profiles
-- and SKUs; this table is the import audit log.
create table public.distributor_sku_lists (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  uploaded_by         uuid not null references auth.users(id),
  file_name           text not null,
  file_path           text not null,
  file_type           text not null check (file_type in ('csv','xlsx','pdf')),
  row_count           integer,
  brand_count         integer,
  status              text not null default 'pending'
                       check (status in ('pending','mapping','processing','complete','error')),
  error_message       text,
  column_mapping      jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Brand profiles: one row per unique brand a distributor sells, across
-- all SKU lists. The normalized_name + distributor_org_id unique
-- constraint is what makes uploading two files that both contain
-- "Château Margaux SAS" and "chateau margaux" produce a single row.
--
-- Many columns here are placeholders for later phases — they are nullable
-- so Phase 1 can populate just (name, normalized_name, alkatera_tier).
create table public.brand_profiles (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  -- Phase 6: populated when a brand becomes an alka**tera** customer.
  alkatera_org_id     uuid references public.organizations(id) on delete set null,
  name                text not null,
  normalized_name     text not null,
  website             text,
  country_of_origin   text,
  category            text,
  alkatera_tier       integer not null default 1 check (alkatera_tier in (1,2,3,4)),
  -- Phase 3: outreach state
  outreach_email      text,
  outreach_sent_at    timestamptz,
  outreach_last_reminder_at timestamptz,
  outreach_reminder_count integer not null default 0,
  upload_token        text unique default encode(gen_random_bytes(32), 'hex'),
  upload_token_expires_at timestamptz default (now() + interval '90 days'),
  first_submission_at timestamptz,
  last_submission_at  timestamptz,
  -- Phase 5/8: completeness + scoring
  completeness_score  numeric(5,2),
  sustainability_score numeric(5,2),
  score_tier          text check (score_tier in ('leader','progressing','developing','insufficient')),
  score_updated_at    timestamptz,
  -- Phase 12: public directory opt-in
  directory_opt_in    boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (distributor_org_id, normalized_name)
);

-- Individual products under a brand profile.
create table public.brand_skus (
  id                  uuid primary key default gen_random_uuid(),
  brand_profile_id    uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id  uuid not null references public.distributor_organizations(id) on delete cascade,
  sku_list_id         uuid references public.distributor_sku_lists(id) on delete set null,
  sku_code            text,
  product_name        text not null,
  category            text,
  country_of_origin   text,
  listing_status      text not null default 'active' check (listing_status in ('active','delisted')),
  -- Vintage dimension: see brand_sku_vintages. When no vintage row exists,
  -- data fields at the SKU level act as the fallback.
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Vintage / batch records under a SKU. Schema only in Phase 1 — UI lands
-- in Phase 14. Built now so we don't have to restructure SKU-level data
-- once vintages are introduced.
create table public.brand_sku_vintages (
  id                  uuid primary key default gen_random_uuid(),
  brand_sku_id        uuid not null references public.brand_skus(id) on delete cascade,
  vintage_year        integer,
  batch_reference     text,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (brand_sku_id, vintage_year, batch_reference)
);

-- ============================================================
-- Indexes
-- ============================================================
create index distributor_members_user_idx           on public.distributor_members (user_id);
create index distributor_members_org_idx            on public.distributor_members (distributor_org_id);
create index distributor_invitations_org_idx        on public.distributor_invitations (distributor_org_id);
create index distributor_invitations_token_idx      on public.distributor_invitations (token);
create index distributor_sku_lists_org_idx          on public.distributor_sku_lists (distributor_org_id, created_at desc);
create index brand_profiles_distributor_idx         on public.brand_profiles (distributor_org_id);
create index brand_profiles_token_idx               on public.brand_profiles (upload_token);
create index brand_skus_profile_idx                 on public.brand_skus (brand_profile_id);
create index brand_skus_distributor_idx             on public.brand_skus (distributor_org_id);
create index brand_skus_sku_list_idx                on public.brand_skus (sku_list_id);
create index brand_sku_vintages_sku_idx             on public.brand_sku_vintages (brand_sku_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.distributor_organizations enable row level security;
alter table public.distributor_members       enable row level security;
alter table public.distributor_invitations   enable row level security;
alter table public.distributor_sku_lists     enable row level security;
alter table public.brand_profiles            enable row level security;
alter table public.brand_skus                enable row level security;
alter table public.brand_sku_vintages        enable row level security;

-- ------------------------------------------------------------
-- distributor_organizations
-- ------------------------------------------------------------
create policy "distributor members read their org"
  on public.distributor_organizations for select
  using (
    id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "distributor owners update their org"
  on public.distributor_organizations for update
  using (
    id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- Inserts happen via service role only (signup API route), so no insert
-- policy here — the anon/authenticated role cannot create distributor
-- organisations directly.

-- ------------------------------------------------------------
-- distributor_members
-- ------------------------------------------------------------
create policy "distributor members read their org's members"
  on public.distributor_members for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers add members"
  on public.distributor_members for insert
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

create policy "owners remove members"
  on public.distributor_members for delete
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

create policy "owners update members"
  on public.distributor_members for update
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- ------------------------------------------------------------
-- distributor_invitations
-- ------------------------------------------------------------
create policy "distributor members read invites in their org"
  on public.distributor_invitations for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers create invites"
  on public.distributor_invitations for insert
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

create policy "owners and data_managers delete invites"
  on public.distributor_invitations for delete
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- ------------------------------------------------------------
-- distributor_sku_lists
-- ------------------------------------------------------------
create policy "distributor members read sku lists"
  on public.distributor_sku_lists for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers write sku lists"
  on public.distributor_sku_lists for all
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  )
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- ------------------------------------------------------------
-- brand_profiles
-- ------------------------------------------------------------
create policy "distributor members read brand profiles"
  on public.brand_profiles for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers write brand profiles"
  on public.brand_profiles for all
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  )
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- ------------------------------------------------------------
-- brand_skus
-- ------------------------------------------------------------
create policy "distributor members read brand skus"
  on public.brand_skus for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "owners and data_managers write brand skus"
  on public.brand_skus for all
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  )
  with check (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- ------------------------------------------------------------
-- brand_sku_vintages — gated through brand_skus visibility
-- ------------------------------------------------------------
create policy "distributor members read vintages"
  on public.brand_sku_vintages for select
  using (
    brand_sku_id in (
      select id from public.brand_skus where distributor_org_id in (
        select distributor_org_id from public.distributor_members where user_id = auth.uid()
      )
    )
  );

create policy "owners and data_managers write vintages"
  on public.brand_sku_vintages for all
  using (
    brand_sku_id in (
      select id from public.brand_skus where distributor_org_id in (
        select distributor_org_id from public.distributor_members
        where user_id = auth.uid() and role in ('owner','data_manager')
      )
    )
  )
  with check (
    brand_sku_id in (
      select id from public.brand_skus where distributor_org_id in (
        select distributor_org_id from public.distributor_members
        where user_id = auth.uid() and role in ('owner','data_manager')
      )
    )
  );

-- ============================================================
-- Storage Buckets
-- ============================================================
-- distributor-sku-lists: uploaded CSV/XLSX/PDF product lists. Path
-- pattern is {distributor_org_id}/{timestamp}_{filename}. Distributor
-- members read; only owners/data_managers write. 25 MB ceiling covers
-- realistic supplier-list sizes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'distributor-sku-lists',
  'distributor-sku-lists',
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

-- brand-documents: documents brands upload via the tokenised /brand-upload/
-- portal in Phase 3. All writes happen via service-role from the brand-
-- upload API route (the uploader is unauthenticated). Distributor members
-- of the owning org can read.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-documents',
  'brand-documents',
  false,
  26214400,
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- ------------------------------------------------------------
-- Storage policies
-- ------------------------------------------------------------
-- distributor-sku-lists: members of the org that owns the first folder
-- segment can read; owners/data_managers can write/update/delete.
drop policy if exists "distributor_sku_lists_read"   on storage.objects;
drop policy if exists "distributor_sku_lists_write"  on storage.objects;
drop policy if exists "brand_documents_service_all"  on storage.objects;
drop policy if exists "brand_documents_read"         on storage.objects;

create policy "distributor_sku_lists_read"
  on storage.objects for select
  using (
    bucket_id = 'distributor-sku-lists'
    and (storage.foldername(name))[1]::uuid in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

create policy "distributor_sku_lists_write"
  on storage.objects for all
  using (
    bucket_id = 'distributor-sku-lists'
    and (storage.foldername(name))[1]::uuid in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  )
  with check (
    bucket_id = 'distributor-sku-lists'
    and (storage.foldername(name))[1]::uuid in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid() and role in ('owner','data_manager')
    )
  );

-- brand-documents: service role does all writes (from /api/brand-upload/*
-- in Phase 3). Distributor members of the owning org can read.
create policy "brand_documents_service_all"
  on storage.objects for all
  to service_role
  using (bucket_id = 'brand-documents')
  with check (bucket_id = 'brand-documents');

create policy "brand_documents_read"
  on storage.objects for select
  using (
    bucket_id = 'brand-documents'
    and (storage.foldername(name))[1]::uuid in (
      select distributor_org_id from public.distributor_members
      where user_id = auth.uid()
    )
  );

commit;
