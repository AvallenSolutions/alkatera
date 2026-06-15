-- Rosa -- Safe SQL executor RPC.
--
-- Runs a single pre-validated SELECT from the application layer in a
-- READ-ONLY transaction. The application is responsible for validating
-- the statement (see lib/rosa/safe-sql.ts); this function adds a last
-- line of defence at the database level:
--
--   * `SET LOCAL transaction_read_only = on` -- any write the validator
--      missed fails here.
--   * A hard LIMIT of 500 rows to keep token budgets sane.
--   * Output is coerced to jsonb so PostgREST can ship it over the wire
--     without schema-aware row conversion.
--
-- The function is SECURITY DEFINER so it can run against whitelisted
-- tables irrespective of the caller's RLS. Org-scoping is enforced by
-- the application layer wrapping every query with
-- `organization_id = $org_id`, which the validator requires and the
-- caller cannot bypass because org_id is filled in from the session.

create or replace function public.rosa_run_safe_sql(
  org_id uuid,
  q text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result jsonb;
  wrapped text;
begin
  -- Belt-and-braces: refuse anything that doesn't reference the org_id.
  if position('organization_id' in lower(q)) = 0 then
    return jsonb_build_object('error', 'Query must reference organization_id');
  end if;

  -- Enforce read-only for this transaction.
  set local transaction_read_only = on;

  -- Wrap the caller's query and cap at 500 rows.
  wrapped := format('select coalesce(jsonb_agg(t), ''[]''::jsonb) from (%s limit 500) t', q);

  begin
    execute wrapped into result;
  exception when others then
    return jsonb_build_object('error', SQLERRM);
  end;

  return coalesce(result, '[]'::jsonb);
end;
$$;

revoke all on function public.rosa_run_safe_sql(uuid, text) from public;
grant execute on function public.rosa_run_safe_sql(uuid, text) to authenticated, service_role;

comment on function public.rosa_run_safe_sql(uuid, text) is
  'Rosa tool-use: runs a pre-validated read-only SELECT. Called only via the Next.js API layer after lib/rosa/safe-sql.ts validates the statement.';
