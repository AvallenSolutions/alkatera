# Advisor READ access to client-org dashboards

## Goal
An external advisor (row in `advisor_organization_access`, no `organization_members` row)
switched into a client org should see the dashboard the same as a member, respecting their
`read_only` / `read_write` level. Today many dashboard/read API routes 403 advisors because
their org-resolution only accepts membership.

## Mechanism (matches the codebase's already-migrated routes)
- Resolve org with `resolveAccessibleOrg(client, user, requestedOrgId?)` (member OR active advisor)
  instead of `resolveUserOrganization` / a local first-membership query.
- On WRITE handlers that mutate org data, add `denyReadOnlyAdvisor(client, user, organizationId)`
  immediately after resolving the org, so read_only advisors stay blocked from writes.
- `resolveAccessibleOrg` reads `current_organization_id` from app_metadata/user_metadata, which
  org-switching sets for advisors too — so the advisor's *selected* client org is used.

## Scope: dashboard surface (agreed) + pre-existing security gaps (agreed)

### Core / security-sensitive (do myself) — DONE
- [x] rosa/priority-tiles (GET) — local resolveContext → resolveAccessibleOrg
- [ ] rosa/progress-tracker (GET/POST/DELETE) — convert; POST/DELETE write rosa_memory (user pref, no guard)
- [ ] rosa/memory (GET/POST/DELETE) — convert; rosa_memory (user/org pref, no guard)
- [ ] rosa/briefing, rosa/mood, rosa/conversations/recent, rosa/exports (GET) — convert
- [ ] rosa/telemetry (POST) — append-only, no guard
- [ ] rosa/uploads (POST), uploads/extract (POST) — convert (no org-data write)
- [ ] rosa/uploads/import (POST) — convert + GUARD (writes facility_activity_entries)
- [ ] rosa/chat (POST) + rosa/actions/[id]/confirm|cancel — inspect; read_only can't execute org-data actions
- [ ] vitality/composite (GET) — convert
- [ ] vitality/weights (GET/POST) — convert; POST writes organizations.vitality_weights → GUARD
- [ ] PRE-EXISTING: key-findings POST — add denyReadOnlyAdvisor
- [ ] PRE-EXISTING: impact-valuation/calculate POST + narratives POST — add denyReadOnlyAdvisor
- [ ] PRE-EXISTING: certifications/flag-resolve GET — add resolveAccessibleOrg access check

### Mechanical module conversions (delegate to parallel subagents)
- [ ] certifications/** reads (+ guard writes: audit-package PATCH, audit-package/export, auto-evidence/accept, risk-tool POST); evidence GET access check; leave benchmark (public) + already-migrated (flag-targets, audit-packages, gap-analysis, score)
- [ ] hospitality/** — fix shared `auth()` in lib/hospitality/recipe-route-handlers.ts + per-route resolveUserOrganization; guard writes
- [ ] byproducts/** + nature-actions/** + nature-dependencies — convert; guard writes
- [ ] pulse/** reads (inline param membership check) + emissions/** + facility-production-volumes + advisor-messages + agents/exceptions + greenwash/assessments + supplier-responsibility — convert; guard writes

## Verify
- [ ] typecheck passes
- [ ] relevant vitest suites pass
- [ ] review full git diff for consistency + no missed write guards
- [ ] (manual) sign in as advisor, confirm dashboard populates

## Review

Done. 102 API route/lib files converted so an active advisor for the org is granted
READ access; read-only advisors stay blocked from writes via `denyReadOnlyAdvisor`.

Pattern used everywhere: `resolveAccessibleOrg(client, user, requestedOrgId?)` for org
resolution (member OR active advisor, honours the org switched into via metadata), plus
`denyReadOnlyAdvisor` on org-data mutations. This mirrors the ~48 routes already on this
pattern.

Notable specifics:
- Rosa hub: all read endpoints + chat converted. Action *execution* is the single
  org-data write choke point — guarded inside `lib/rosa/actions.ts` `executeAction`
  (covers the confirm route and any caller). Rosa memory/tracker/telemetry/upload-staging
  are user-pref/append/staging, not org data, so unguarded; `uploads/import` (commits
  facility data) IS guarded.
- vitality/weights: write stays owner/admin-only (advisors carry no membership role), read opened.
- Pre-existing gaps fixed (Tim approved): `key-findings` POST, `impact-valuation/calculate`
  + `narratives` POST now guard read-only advisors; `certifications/flag-resolve` GET now
  verifies org access (was a trusted-param read-IDOR).
- Pulse: only routes with an explicit membership check were converted; pure RLS-cookie
  routes already grant advisors via RLS and were left.

Left deliberately member-only (writes, out of dashboard-read scope): advisor-messages POST,
facility-production-volumes POST/DELETE, greenwash/assessments POST/DELETE,
certifications/score POST (pre-existing advisor-accessible, unchanged).

Verification: `tsc --noEmit` clean (0 errors); all 5 previously-403 routes now return 401
unauth (load cleanly, no 500). Final advisor-session smoke test (sign in as an advisor,
switch into a client org, load /rosa) left for manual confirmation.

Follow-up flagged: `certifications/frameworks` GET reads an `organization_id` query param
with no access check (same class as the flag-resolve fix) — spun off as a task.
