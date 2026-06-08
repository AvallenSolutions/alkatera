-- ============================================================
-- FIX: enqueue_alkatera_sustainability_change() — invalid row->jsonb cast
-- ============================================================
-- The realtime-sync trigger function (20262607300000_alkatera_realtime_sync)
-- resolved the org id with `NEW::jsonb` / `OLD::jsonb`. Postgres cannot cast a
-- composite/row type directly to jsonb with `::`, so the trigger threw at
-- runtime on EVERY insert/update/delete to its target tables:
--
--   ERROR: cannot cast type product_carbon_footprints to jsonb
--
-- This surfaced as "Failed to create LCA: cannot cast type
-- product_carbon_footprints to jsonb" because creating an LCA inserts into
-- public.product_carbon_footprints, firing the AFTER INSERT trigger. The same
-- breakage applied to ghg_emissions, organization_certifications,
-- packaging_circularity_profiles, transition_plans, flag_targets and
-- facility_water_data.
--
-- Fix: use to_jsonb(NEW) / to_jsonb(OLD), which is the correct way to turn a
-- row into jsonb (and is what the rest of this same function already used).
-- plpgsql function bodies aren't cast-checked at CREATE time, which is why the
-- original migration applied cleanly but failed only when a row was written.
--
-- CREATE OR REPLACE keeps the existing triggers intact — they reference this
-- function by name, so no trigger changes are needed.
-- ============================================================

begin;

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
      when to_jsonb(OLD) ? 'organization_id' then (to_jsonb(OLD) ->> 'organization_id')::uuid
      else null
    end);
    v_payload := jsonb_build_object('op', 'DELETE', 'old', to_jsonb(OLD));
  else
    v_org_id := (case
      when to_jsonb(NEW) ? 'organization_id' then (to_jsonb(NEW) ->> 'organization_id')::uuid
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

commit;
