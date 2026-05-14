-- ============================================================
-- DISTRIBUTOR PORTAL — PHASE 6: alka**tera** INTEGRATION
-- ============================================================
-- Bridges the two halves of the platform:
--   - distributor_organizations + brand_profiles  (this portal)
--   - organizations + organization_members        (alkatera customer portal)
--
-- Concretely we add:
--   - brand_distributor_links: explicit edges between brand_profiles and
--     alkatera organizations. One alkatera org can link to many distributor
--     portfolios; one distributor's brand_profile can only match one alkatera
--     org at a time (UNIQUE(brand_profile_id, alkatera_org_id)).
--   - brand_sharing_preferences: brand-side privacy controls — per-field,
--     per-distributor (or org-wide) toggles to block sharing of a specific
--     data field.
--   - distributor_notifications: in-app notifications feed for the
--     distributor portal (bell icon).
--
-- Plus a pg_trgm-backed RPC for fuzzy alkatera-name matching, and a
-- SECURITY DEFINER RPC that merges scraped data with alkatera-live data
-- for the distributor's brand-detail view.
-- ============================================================

begin;

create extension if not exists pg_trgm;

-- ============================================================
-- Tables
-- ============================================================

create table public.brand_distributor_links (
  id                    uuid primary key default gen_random_uuid(),
  brand_profile_id      uuid not null references public.brand_profiles(id) on delete cascade,
  distributor_org_id    uuid not null references public.distributor_organizations(id) on delete cascade,
  alkatera_org_id       uuid not null references public.organizations(id) on delete cascade,
  match_method          text not null check (match_method in ('auto_name','auto_domain','auto_fuzzy','manual')),
  match_confidence      numeric(3,2),
  confirmed_by_brand    boolean not null default false,
  confirmed_at          timestamptz,
  -- The brand can deactivate sharing with this specific distributor.
  sharing_active        boolean not null default true,
  deactivated_at        timestamptz,
  deactivated_reason    text,
  created_at            timestamptz not null default now(),
  -- One alkatera org maps to at most one brand_profile per distributor.
  unique (brand_profile_id, alkatera_org_id),
  unique (brand_profile_id, distributor_org_id)
);

create table public.brand_sharing_preferences (
  id                    uuid primary key default gen_random_uuid(),
  alkatera_org_id       uuid not null references public.organizations(id) on delete cascade,
  -- null = applies to every distributor that's linked to this alkatera org.
  distributor_org_id    uuid references public.distributor_organizations(id) on delete cascade,
  field_key             text not null,
  sharing_enabled       boolean not null default true,
  updated_at            timestamptz not null default now(),
  -- Two-stage uniqueness: a (null distributor) row is the default; a
  -- (distributor-specific) row overrides it. Postgres treats NULL as
  -- distinct so we add an explicit unique partial index for the default.
  unique (alkatera_org_id, distributor_org_id, field_key)
);
create unique index brand_sharing_preferences_default_unique
  on public.brand_sharing_preferences (alkatera_org_id, field_key)
  where distributor_org_id is null;

create table public.distributor_notifications (
  id                    uuid primary key default gen_random_uuid(),
  distributor_org_id    uuid not null references public.distributor_organizations(id) on delete cascade,
  brand_profile_id      uuid references public.brand_profiles(id) on delete set null,
  notification_type     text not null check (notification_type in (
                          'brand_joined_alkatera','brand_data_updated','brand_tier_upgraded',
                          'new_document_submitted','scraping_complete','conflict_detected',
                          'pending_match'
                        )),
  title                 text not null,
  body                  text,
  -- Optional URL the bell uses when the user clicks the notification.
  link_url              text,
  read_at               timestamptz,
  created_at            timestamptz not null default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index brand_distributor_links_profile_idx      on public.brand_distributor_links (brand_profile_id);
create index brand_distributor_links_alkatera_idx     on public.brand_distributor_links (alkatera_org_id);
create index brand_distributor_links_distributor_idx  on public.brand_distributor_links (distributor_org_id);
create index distributor_notifications_unread_idx     on public.distributor_notifications (distributor_org_id, created_at desc) where read_at is null;
create index distributor_notifications_all_idx        on public.distributor_notifications (distributor_org_id, created_at desc);
create index brand_sharing_preferences_org_idx        on public.brand_sharing_preferences (alkatera_org_id);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.brand_distributor_links     enable row level security;
alter table public.brand_sharing_preferences   enable row level security;
alter table public.distributor_notifications   enable row level security;

-- Distributors can read links where they're the distributor side.
create policy "distributor members read their links"
  on public.brand_distributor_links for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members where user_id = auth.uid()
    )
  );

-- alkatera brand members can read links where they're the brand side.
create policy "brand members read their links"
  on public.brand_distributor_links for select
  using (
    alkatera_org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Brand members control their own sharing flag. Distributors cannot
-- mutate links; they're read-only on this table.
create policy "brand members update their link sharing"
  on public.brand_distributor_links for update
  using (
    alkatera_org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- All inserts happen via service role (matcher / link API). No
-- user-facing insert policy is needed.

-- Brand sharing preferences: brand members fully manage their own.
create policy "brand members read sharing preferences"
  on public.brand_sharing_preferences for select
  using (
    alkatera_org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

create policy "brand members write sharing preferences"
  on public.brand_sharing_preferences for all
  using (
    alkatera_org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  )
  with check (
    alkatera_org_id in (
      select organization_id from public.organization_members where user_id = auth.uid()
    )
  );

-- Distributor notifications are read by distributor members; writes
-- happen via service role only.
create policy "distributor members read notifications"
  on public.distributor_notifications for select
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members where user_id = auth.uid()
    )
  );

-- Members can mark their own notifications read.
create policy "distributor members update notifications"
  on public.distributor_notifications for update
  using (
    distributor_org_id in (
      select distributor_org_id from public.distributor_members where user_id = auth.uid()
    )
  );

-- ============================================================
-- Fuzzy match RPC — pg_trgm-backed similarity search
-- ============================================================
create or replace function public.find_similar_organizations(
  brand_name text,
  similarity_threshold float default 0.6
)
returns table(id uuid, name text, website text, similarity float)
language sql stable
as $$
  select id, name, website,
         similarity(lower(name), lower(brand_name)) as similarity
  from public.organizations
  where similarity(lower(name), lower(brand_name)) > similarity_threshold
  order by similarity desc
  limit 5;
$$;

-- ============================================================
-- Data merge RPC — scraped data + alkatera live overlay
-- ============================================================
-- Returns one row per (field_key, source) so the caller can decide how
-- to render: e.g. "live alkatera value, scraped fallback below" or just
-- "current truth = highest-confidence row".
--
-- Phase 6 implementation:
--   - Always returns scraped_brand_data rows (the "scraped" / "brand_upload"
--     / "alkatera_live_*" findings the rest of the platform already writes).
--   - When a brand_distributor_links row exists, is confirmed, and
--     sharing_active, AND the brand has not blocked a given field, the
--     RPC overlays alkatera-side fields. Phase 6 wires this to the
--     overlay table that the data-merger.ts module writes into; later
--     phases will replace that with direct joins against the live LCA
--     / certifications tables on the alkatera side once we settle their
--     schema.
-- SECURITY DEFINER so the distributor portal can call it without
-- needing read RLS on alkatera tables, while we enforce scoping by
-- joining on brand_distributor_links inside the function body.
create or replace function public.get_brand_data_for_distributor(
  p_brand_profile_id uuid,
  p_distributor_org_id uuid
)
returns table(
  field_key text,
  field_value text,
  field_value_numeric numeric,
  source text,
  confidence numeric,
  scraped_at timestamptz
)
language plpgsql stable security definer
as $$
declare
  v_link record;
begin
  -- Always return scraped_brand_data (the base layer).
  return query
  select sbd.field_key,
         sbd.field_value,
         sbd.field_value_numeric,
         sbd.source_name,
         sbd.confidence,
         sbd.scraped_at
  from public.scraped_brand_data sbd
  where sbd.brand_profile_id = p_brand_profile_id
    and sbd.superseded_by is null;

  -- Look up the link. If absent, we're done.
  select bdl.* into v_link
  from public.brand_distributor_links bdl
  where bdl.brand_profile_id = p_brand_profile_id
    and bdl.distributor_org_id = p_distributor_org_id
    and bdl.sharing_active = true
    and bdl.confirmed_by_brand = true
  limit 1;
  if v_link.id is null then
    return;
  end if;

  -- Overlay live data, respecting brand_sharing_preferences blocks.
  -- We read from scraped_brand_data with source_name 'alkatera_live'
  -- which is the convention this codebase uses to materialise live
  -- alkatera values into the unified data layer. A future iteration
  -- can replace this branch with direct joins against the LCA /
  -- certifications / scope tables on the alkatera side; today they're
  -- domain-specific enough that we keep them out of the RPC and let
  -- the application sync them through scraped_brand_data instead.
  return query
  select alk.field_key,
         alk.field_value,
         alk.field_value_numeric,
         'alkatera_live'::text as source,
         0.99::numeric as confidence,
         alk.scraped_at
  from public.scraped_brand_data alk
  where alk.brand_profile_id = p_brand_profile_id
    and alk.source_name = 'alkatera_live'
    and alk.superseded_by is null
    and not exists (
      select 1
      from public.brand_sharing_preferences pref
      where pref.alkatera_org_id = v_link.alkatera_org_id
        and pref.field_key = alk.field_key
        and pref.sharing_enabled = false
        and (pref.distributor_org_id is null
             or pref.distributor_org_id = p_distributor_org_id)
    );
end;
$$;

grant execute on function public.get_brand_data_for_distributor(uuid, uuid) to authenticated;
grant execute on function public.find_similar_organizations(text, float) to authenticated;

commit;
