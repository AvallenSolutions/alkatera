-- ============================================================
-- HOTFIX: recursive RLS on distributor_members
-- ============================================================
-- The Phase 1 select policy on distributor_members had the form
--   distributor_org_id IN (
--     SELECT distributor_org_id FROM distributor_members WHERE user_id = auth.uid()
--   )
-- which is self-recursive: to read your own membership row, the inner
-- subquery must read the same table, which re-applies the same policy,
-- which… returns zero rows. End result: users could not see their own
-- distributor_members row when querying with the anon-key browser client,
-- which broke the /distributor/login flow.
--
-- Fix:
--   1. Add a SECURITY DEFINER helper that returns the caller's
--      distributor_org_ids by bypassing RLS internally.
--   2. Replace the recursive SELECT policy on distributor_members with
--      two non-recursive policies:
--        a. "read own row" — direct user_id = auth.uid()
--        b. "read peers in same org" — uses the helper function
--   3. Leave RLS on the other distributor / brand tables unchanged —
--      those policies query distributor_members from a different
--      policy context and start working again as soon as the underlying
--      table is readable.
-- ============================================================

begin;

create or replace function public.current_distributor_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distributor_org_id
  from public.distributor_members
  where user_id = auth.uid();
$$;

revoke all on function public.current_distributor_org_ids() from public;
grant execute on function public.current_distributor_org_ids() to authenticated;

drop policy if exists "distributor members can read their org's members"
  on public.distributor_members;
drop policy if exists "distributor members read their org's members"
  on public.distributor_members;

create policy "distributor members read own row"
  on public.distributor_members for select
  using (user_id = auth.uid());

create policy "distributor members read peers in same org"
  on public.distributor_members for select
  using (distributor_org_id in (select public.current_distributor_org_ids()));

commit;
