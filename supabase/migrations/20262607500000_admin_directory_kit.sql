-- ============================================================
-- ADMIN DIRECTORY KIT — bulk seeding + telemetry
-- ============================================================
-- alka**tera** staff (admins identified by `is_alkatera_admin()` RPC)
-- need to proactively seed the canonical brand_directory and
-- product_directory with brands that haven't joined alka**tera** and
-- that no distributor has yet uploaded. This migration adds:
--
--   1. `admin_directory_uploads`  — audit table for every admin CSV upload
--   2. `directory_brand_views`    — telemetry: distributor opens a brand
--                                   detail in /discover/
--   3. `directory_searches`       — telemetry: free-text + filter searches
--   4. `directory_contacts`       — log of every "Contact brand" send
--                                   (replaces the silent Resend send and
--                                   powers per-(distributor, brand)
--                                   7-day rate-limiting)
--
-- Plus a storage bucket for admin CSVs and RLS policies for everything.
--
-- Admin authentication reuses the existing `public.is_alkatera_admin()`
-- RPC (defined in 20260211170000_fix_security_definer_search_path.sql).
-- The fallback the RPC checks is `profiles.is_alkatera_admin = true`,
-- which is the column we set for a new admin user.
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. profiles.is_alkatera_admin — defensive (already present in prod).
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists is_alkatera_admin boolean not null default false;

-- ------------------------------------------------------------
-- 2. admin_directory_uploads — bulk upload audit
-- ------------------------------------------------------------
create table public.admin_directory_uploads (
  id                  uuid primary key default gen_random_uuid(),
  uploaded_by         uuid references auth.users(id) on delete set null,
  kind                text not null check (kind in ('brands','products')),
  file_name           text not null,
  file_path           text not null,
  file_type           text not null check (file_type in ('csv','xlsx')),
  row_count           integer,
  brands_created      integer not null default 0,
  brands_linked       integer not null default 0,
  products_created    integer not null default 0,
  products_linked     integer not null default 0,
  status              text not null default 'pending'
                        check (status in ('pending','mapping','processing','complete','error')),
  error_message       text,
  column_mapping      jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index admin_directory_uploads_created_idx
  on public.admin_directory_uploads (created_at desc);
create index admin_directory_uploads_status_idx
  on public.admin_directory_uploads (status, created_at desc);

-- ------------------------------------------------------------
-- 3. Telemetry — directory_brand_views
-- ------------------------------------------------------------
create table public.directory_brand_views (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid references public.distributor_organizations(id) on delete set null,
  user_id             uuid references auth.users(id) on delete set null,
  brand_directory_id  uuid not null references public.brand_directory(id) on delete cascade,
  viewed_at           timestamptz not null default now()
);
create index directory_brand_views_brand_time_idx
  on public.directory_brand_views (brand_directory_id, viewed_at desc);
create index directory_brand_views_org_time_idx
  on public.directory_brand_views (distributor_org_id, viewed_at desc);
create index directory_brand_views_time_idx
  on public.directory_brand_views (viewed_at desc);

-- ------------------------------------------------------------
-- 4. Telemetry — directory_searches
-- ------------------------------------------------------------
create table public.directory_searches (
  id                  uuid primary key default gen_random_uuid(),
  distributor_org_id  uuid references public.distributor_organizations(id) on delete set null,
  user_id             uuid references auth.users(id) on delete set null,
  query               text,
  filters             jsonb,
  result_count        integer,
  searched_at         timestamptz not null default now()
);
create index directory_searches_time_idx
  on public.directory_searches (searched_at desc);
create index directory_searches_org_time_idx
  on public.directory_searches (distributor_org_id, searched_at desc);

-- ------------------------------------------------------------
-- 5. Telemetry — directory_contacts (audit + rate-limit source)
-- ------------------------------------------------------------
create table public.directory_contacts (
  id                       uuid primary key default gen_random_uuid(),
  distributor_org_id       uuid not null references public.distributor_organizations(id) on delete cascade,
  sender_user_id           uuid references auth.users(id) on delete set null,
  brand_directory_id       uuid not null references public.brand_directory(id) on delete cascade,
  recipient_email_redacted text,
  subject                  text,
  message_preview          text,
  resend_message_id        text,
  status                   text not null default 'sent'
                              check (status in ('sent','failed','blocked')),
  error_message            text,
  sent_at                  timestamptz not null default now()
);
create index directory_contacts_brand_time_idx
  on public.directory_contacts (brand_directory_id, sent_at desc);
create index directory_contacts_org_time_idx
  on public.directory_contacts (distributor_org_id, sent_at desc);
create index directory_contacts_pair_recent_idx
  on public.directory_contacts (distributor_org_id, brand_directory_id, sent_at desc);

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
alter table public.admin_directory_uploads enable row level security;
alter table public.directory_brand_views   enable row level security;
alter table public.directory_searches       enable row level security;
alter table public.directory_contacts       enable row level security;

-- Admins do everything.
create policy "admins manage uploads"
  on public.admin_directory_uploads for all
  using (public.is_alkatera_admin()) with check (public.is_alkatera_admin());

create policy "admins read all brand views"
  on public.directory_brand_views for select
  using (public.is_alkatera_admin());
create policy "admins read all searches"
  on public.directory_searches for select
  using (public.is_alkatera_admin());
create policy "admins read all contacts"
  on public.directory_contacts for select
  using (public.is_alkatera_admin());

-- Telemetry rows are written via the service role (server-side
-- fire-and-forget) so no INSERT policy is needed for distributor users.

-- Distributor users can read their own org's telemetry — useful for
-- transparency (e.g. their team can see who has contacted whom).
create policy "distributor members read their brand views"
  on public.directory_brand_views for select
  using (distributor_org_id in (
    select distributor_org_id from public.distributor_members where user_id = auth.uid()
  ));
create policy "distributor members read their searches"
  on public.directory_searches for select
  using (distributor_org_id in (
    select distributor_org_id from public.distributor_members where user_id = auth.uid()
  ));
create policy "distributor members read their contacts"
  on public.directory_contacts for select
  using (distributor_org_id in (
    select distributor_org_id from public.distributor_members where user_id = auth.uid()
  ));

-- ------------------------------------------------------------
-- 7. updated_at touch for admin_directory_uploads
-- ------------------------------------------------------------
create or replace function public.touch_admin_directory_uploads_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger trg_admin_directory_uploads_touch
  before update on public.admin_directory_uploads
  for each row execute function public.touch_admin_directory_uploads_updated_at();

-- ------------------------------------------------------------
-- 8. Storage bucket for admin CSV files
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('admin-directory-uploads', 'admin-directory-uploads', false)
  on conflict (id) do nothing;

-- Storage RLS lives on storage.objects. Admin-only read + write.
create policy "admins read admin uploads"
  on storage.objects for select
  using (bucket_id = 'admin-directory-uploads' and public.is_alkatera_admin());
create policy "admins write admin uploads"
  on storage.objects for insert
  with check (bucket_id = 'admin-directory-uploads' and public.is_alkatera_admin());
create policy "admins delete admin uploads"
  on storage.objects for delete
  using (bucket_id = 'admin-directory-uploads' and public.is_alkatera_admin());

commit;

-- ============================================================
-- POST-APPLY (run separately in Supabase SQL editor):
-- ============================================================
-- Promote tim@alkatera.com to admin:
--
--   update public.profiles
--     set is_alkatera_admin = true
--     where id = (select id from auth.users where email = 'tim@alkatera.com');
--
-- Verify:
--   select id, email, is_alkatera_admin from public.profiles
--     where email = 'tim@alkatera.com';
-- ============================================================
