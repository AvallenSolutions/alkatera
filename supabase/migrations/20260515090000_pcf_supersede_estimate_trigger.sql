-- When a real, completed LCA lands for a product, automatically supersede
-- any sibling 'estimate' rows so consumers don't double-count the same
-- product. Without this, the Vitality hero / LCA coverage / hotspot rollup
-- would see both the estimate and the completed LCA for the same product
-- once a user finishes a real LCA on top of their starter estimate.
--
-- 'superseded' isn't in the existing status check — extend the constraint
-- to include it, then add the trigger.

alter table public.product_carbon_footprints
  drop constraint if exists product_carbon_footprints_status_check;

alter table public.product_carbon_footprints
  add constraint product_carbon_footprints_status_check
  check (status in ('draft', 'pending', 'estimate', 'completed', 'superseded', 'failed'));

create or replace function public.supersede_estimate_pcf()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only run when this row is the freshly-completed LCA. We don't react to
  -- updates of an existing completed row, since the estimate would already
  -- have been demoted on the first transition.
  if NEW.status = 'completed'
     and (TG_OP = 'INSERT' or coalesce(OLD.status, '') <> 'completed')
     and NEW.product_id is not null
  then
    update public.product_carbon_footprints
    set status = 'superseded', updated_at = now()
    where organization_id = NEW.organization_id
      and product_id = NEW.product_id
      and status = 'estimate'
      and id <> NEW.id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_supersede_estimate_pcf on public.product_carbon_footprints;

create trigger trg_supersede_estimate_pcf
after insert or update of status on public.product_carbon_footprints
for each row
execute function public.supersede_estimate_pcf();
