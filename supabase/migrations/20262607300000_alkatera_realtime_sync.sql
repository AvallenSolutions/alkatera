-- ============================================================
-- ALKATERA REAL-TIME SUSTAINABILITY SYNC
-- ============================================================
-- Before this migration, alka**tera** customer sustainability data
-- reached the canonical directory only via:
--   - `trg_sync_org_to_directory` on organizations (basic profile only)
--   - the daily run-brand-matching cron
--   - the manual "Refresh alka**tera** data" button on the brand Overview.
--
-- That means a brand updating Scope 1 emissions on alka**tera** at 09:00
-- is invisible to distributors that list them until tomorrow's cron run.
-- This migration closes that gap by enqueuing a sync job every time a
-- relevant sustainability row changes on the customer side, then a cron
-- drains the queue every minute and calls the existing
-- syncAlkateraDataForBrand library.
--
-- The triggers are intentionally cheap: they only insert a row into
-- alkatera_sync_queue. All resolution + finding-writing work happens
-- in the worker so the trigger doesn't slow down brand-side writes.
-- ============================================================

begin;

-- ============================================================
-- Queue table
-- ============================================================
create table public.alkatera_sync_queue (
  id                  uuid primary key default gen_random_uuid(),
  alkatera_org_id     uuid not null,
  -- Resolved on dequeue. The trigger doesn't know which brand_directory
  -- entry (if any) the org maps to, so the worker does the lookup.
  brand_directory_id  uuid references public.brand_directory(id) on delete set null,
  trigger_source      text not null,    -- table that fired the trigger
  trigger_op          text not null check (trigger_op in ('INSERT','UPDATE','DELETE')),
  payload             jsonb,            -- row diff for observability + debugging
  status              text not null default 'pending'
                          check (status in ('pending','running','done','failed')),
  attempts            integer not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);

-- Drain order: oldest pending first.
create index alkatera_sync_queue_pending_idx
  on public.alkatera_sync_queue (status, created_at)
  where status in ('pending', 'running');

-- Useful for "what changed for this brand recently?" diagnostics.
create index alkatera_sync_queue_org_created_idx
  on public.alkatera_sync_queue (alkatera_org_id, created_at desc);

alter table public.alkatera_sync_queue enable row level security;

-- Queue is service-role-only. No distributor or brand user needs to
-- see it directly; the worker reads it with the service role.
create policy "service role manages sync queue"
  on public.alkatera_sync_queue for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

-- ============================================================
-- Trigger function
-- ============================================================
-- A single function reusable across every sustainability table. It
-- enqueues a job using NEW.organization_id (or OLD on DELETE). Each
-- trigger passes the table name via TG_TABLE_NAME so the worker can
-- log which source fired.
create or replace function public.enqueue_alkatera_sustainability_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_payload jsonb;
begin
  -- Resolve the org id depending on the operation.
  if TG_OP = 'DELETE' then
    v_org_id := (case
      when (OLD::jsonb) ? 'organization_id' then (OLD::jsonb ->> 'organization_id')::uuid
      else null
    end);
    v_payload := jsonb_build_object('op', 'DELETE', 'old', to_jsonb(OLD));
  else
    v_org_id := (case
      when (NEW::jsonb) ? 'organization_id' then (NEW::jsonb ->> 'organization_id')::uuid
      else null
    end);
    v_payload := jsonb_build_object(
      'op', TG_OP,
      'new', to_jsonb(NEW),
      'old', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    );
  end if;

  -- No org id, nothing to enqueue. Defensive — every target table is
  -- expected to have organization_id, but if a future schema change
  -- adds a non-org-scoped row we silently skip rather than fail.
  if v_org_id is null then
    return coalesce(NEW, OLD);
  end if;

  insert into public.alkatera_sync_queue (
    alkatera_org_id, trigger_source, trigger_op, payload
  ) values (
    v_org_id, TG_TABLE_NAME, TG_OP, v_payload
  );

  return coalesce(NEW, OLD);
end;
$$;

-- ============================================================
-- Install triggers on every sustainability table the alkatera-sync
-- library currently reads (plus facility_water_data, which is added
-- as a new coverage source in this round).
-- ============================================================
-- Each trigger is wrapped in a defensive DO block so the migration
-- doesn't fail if a table is missing in environments where it was
-- never created (e.g. a hosted dev that's only set up some of the
-- brand-side schema). Production has all seven.
do $$
declare
  v_tables text[] := array[
    'ghg_emissions',
    'product_carbon_footprints',
    'organization_certifications',
    'packaging_circularity_profiles',
    'transition_plans',
    'flag_targets',
    'facility_water_data'
  ];
  v_table text;
begin
  foreach v_table in array v_tables loop
    if exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = v_table
    ) then
      execute format(
        'drop trigger if exists trg_enqueue_alkatera_sync_%I on public.%I',
        v_table, v_table
      );
      execute format(
        'create trigger trg_enqueue_alkatera_sync_%I
           after insert or update or delete on public.%I
           for each row execute function public.enqueue_alkatera_sustainability_change()',
        v_table, v_table
      );
    else
      raise notice 'alkatera_realtime_sync: skipping trigger on missing table public.%', v_table;
    end if;
  end loop;
end $$;

-- ============================================================
-- last_synced_at on brand_directory + product_directory
-- ============================================================
-- The worker stamps these after a successful sync so the brand
-- Overview can render "Synced N minutes ago" without a separate
-- query against alkatera_sync_queue.
alter table public.brand_directory
  add column if not exists last_synced_at timestamptz;

-- product_directory.last_synced_at was created in the product_directory
-- phase 1 migration already, so we don't add it here. Defensive guard
-- in case migrations are run out of order:
alter table public.product_directory
  add column if not exists last_synced_at timestamptz;

commit;
