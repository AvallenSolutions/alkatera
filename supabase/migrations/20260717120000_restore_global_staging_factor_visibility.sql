-- 20260717120000_restore_global_staging_factor_visibility.sql
--
-- Why: 20260624120000_advisor_rls_comprehensive.sql looped over org-scoped
-- tables, dropped every permissive policy whose qual mentioned
-- organization_members, and recreated a bare
-- user_has_organization_access(organization_id) SELECT policy. On
-- staging_emission_factors that dropped policy was
-- "Users can view staging factors in their organisation", whose qual was
--   (organization_id IS NULL) OR (member of that organisation)
-- so the replacement lost the organization_id IS NULL branch.
-- user_has_organization_access(NULL) is never true, so every authenticated
-- non-service-role query now sees ZERO global factor-library rows: /admin/factors,
-- /api/admin/emission-factors, ingredient/packaging searches that fall back to
-- the global library, and the packaging gap-filler factors pinned by fixed UUID
-- in 20260717100000_packaging_factor_endpoints.sql.
--
-- Fix: additive permissive SELECT policy for global rows. Permissive policies
-- OR together, so org-scoped visibility via staging_emission_factors_select is
-- unchanged, and read-write/read-only advisor semantics are untouched (the
-- advisor_ro_no_* restrictive policies only cover INSERT/UPDATE/DELETE).
-- Writes to global rows remain service-role only: the INSERT/UPDATE/DELETE
-- policies still require user_has_organization_access(organization_id), which
-- can never pass for a NULL organization_id.
--
-- staging_emission_factors is the only table that both appears in the advisor
-- migration's table list and had an organization_id IS NULL branch in its
-- baseline SELECT policy, so no other table needs this repair.

drop policy if exists staging_emission_factors_select_global
  on public.staging_emission_factors;

create policy staging_emission_factors_select_global
  on public.staging_emission_factors
  for select to authenticated
  using (organization_id is null);
