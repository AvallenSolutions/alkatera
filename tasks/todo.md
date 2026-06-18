# Advisor access levels: read-only vs read-write

Goal: an org owner/admin chooses, per advisor, whether they get **read-only** or
**read & write** access. Settable at invite and changeable later. Read-only blocks
data changes (products, LCAs, facilities, activity data, vineyards, calc outputs)
but still allows generating reports and messaging. Enforced in one pass at BOTH the
RLS layer (direct client writes) and the server layer (service-role API/edge writes
that bypass RLS).

## Design (defence in depth)

`access_level` enum `('read_only','read_write')` stored on both `advisor_invitations`
and `advisor_organization_access`, default `read_write` so existing advisors are
unaffected. One DB predicate `is_readonly_advisor(org_id)` and one server predicate
`isReadOnlyAdvisor(client,user,org)` are the single sources of truth.

## Phase 1 — Data model + helpers (migration)
- [ ] `CREATE TYPE advisor_access_level` enum
- [ ] Add `access_level` to `advisor_invitations` (default read_write)
- [ ] Add `access_level` to `advisor_organization_access` (default read_write)
- [ ] `is_readonly_advisor(org_id)` — true only for an active read_only advisor who is NOT also a member

## Phase 2 — RLS restrictive policies (covers direct/client writes)
Add `AS RESTRICTIVE FOR INSERT/UPDATE/DELETE ... (NOT is_readonly_advisor(organization_id))`
to the 17 data tables (generated_reports intentionally excluded — reports stay allowed):
- [ ] activity_data, agent_exceptions, calculated_emissions, emissions_calculation_context
- [ ] facilities, facility_activity_entries, facility_emissions_aggregated
- [ ] historical_imports, integration_requests, operational_change_events
- [ ] product_carbon_footprint_production_sites, product_carbon_footprints, products
- [ ] vineyard_growing_profiles, vineyard_soil_carbon_evidence, vineyards, xero_sync_logs

## Phase 3 — RPCs
- [ ] `accept_advisor_invitation` — copy invitation.access_level onto the access row (incl. ON CONFLICT)
- [ ] `get_organization_advisors` — return `access_level`
- [ ] `get_advisor_invitation_by_token` — return `access_level`
- [ ] NEW `set_advisor_access_level(advisor_user_id, org_id, level)` — owner/admin only ("change later")

## Phase 4 — invite-advisor edge function
- [ ] Accept + validate `accessLevel`, store on invitation
- [ ] Email copy adapts: read-only = "view (read-only) access"; read-write = full-access wording

## Phase 5 — Server-side guard (service-role writes that bypass RLS)
- [ ] `lib/auth/advisor-access.ts`: `isReadOnlyAdvisor()` + `assertOrgWriteAccess()` (throws 403)
- [ ] Add guard to advisor-reachable service-role mutation entry points (subset of the 42 sites;
      user-scoped/RLS-client sites are already covered by Phase 2). API routes + the user-invoked
      edge functions (manage-facility, add-facility-activity-entry, ingest-activity-data, ingest-water-data).
- [ ] Skip system/admin/cron pipelines not reachable by an advisor identity (seed, calc invoke-*, email webhook)

## Phase 6 — UI
- [ ] Invite dialog: access-level choice (Read & write / Read only) + helper text
- [ ] Advisors table: "Access" badge + admin control to switch level (set_advisor_access_level)
- [ ] Pending-invitations table: show chosen level
- [ ] Accept page: reflect granted level in the "what you can do" box
- [ ] Types updated (Advisor / AdvisorInvitation)

## Phase 7 — Verify
- [ ] tsc clean
- [ ] Seed read-only advisor locally: write denied, read allowed; read-write advisor: write allowed
- [ ] Post full migration SQL in chat (Tim's DB rule)
- [ ] Note edge-function redeploy required (invite-advisor + any guarded functions)

## Review

**Shipped (local, verified):**
- Migration `20260618130000_advisor_access_levels.sql`: `advisor_access_level` enum;
  `access_level` column on `advisor_invitations` + `advisor_organization_access`
  (default `read_write`, so existing advisors are unchanged); `is_readonly_advisor(org)`
  predicate; 51 restrictive write policies (17 tables × insert/update/delete);
  `accept_advisor_invitation` / `get_organization_advisors` / `get_advisor_invitation_by_token`
  now carry `access_level`; new `set_advisor_access_level()` (owner/admin only).
- Edge fn `invite-advisor`: accepts + validates `accessLevel`, stores it, email copy adapts.
- 4 advisor-admitting edge fns (manage-facility, add-facility-activity-entry,
  ingest-activity-data, ingest-water-data) now 403 read-only advisors.
- Server guard `lib/auth/advisor-access.ts` (`isReadOnlyAdvisor` / `denyReadOnlyAdvisor`)
  for any future advisor-admitting service-role route. (The existing API routes that touch
  the 17 tables are already member-gated, so advisors can't reach them — guard not needed there.)
- UI: invite dialog level picker; advisors table Access column with admin change-control
  (optimistic, backed by `set_advisor_access_level`); pending-invites Access badge;
  accept page reflects the granted level.

**Verified:**
- RLS functional test: read-only advisor — reads OK, INSERT blocked by `advisor_ro_no_insert`;
  read-write advisor — INSERT allowed; predicate true/false respectively. Members unaffected.
- RPC smoke test: `get_organization_advisors` returns `access_level`; `set_advisor_access_level`
  flips read_write→read_only and the change reads back.
- Migration applies cleanly; `tsc --noEmit` clean across all app code.

**Outstanding (Tim):**
- Run the migration SQL in the Supabase SQL editor (prod) — posted in chat.
- Redeploy edge functions: `invite-advisor`, `manage-facility`, `add-facility-activity-entry`,
  `ingest-activity-data`, `ingest-water-data`.
- Commit (not yet committed).
