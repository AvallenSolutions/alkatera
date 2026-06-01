# alka**tera** Security & Privacy Review

**Date:** 2026-05-29
**Reviewer:** Claude (Opus 4.8), defensive code review commissioned by Tim Etherington-Judge
**Scope:** Main application (Next.js 14 App Router + Supabase, ~370 API routes, ~297 migrations, ~732 components), the distributor portal (in `main`), and the Foodbuy procurement portal (worktree `nice-herschel-44a430`).
**Method:** Static code review across six domains plus a focused portal pass. Live verification of the headline finding is pending safe test credentials (see Appendix B). Severity reflects realistic risk to a young multi-tenant B2B SaaS.

---

## 1. Executive summary

The honest headline: **alka**tera** has notably strong security fundamentals for a company this size, undermined by one critical, systemic multi-tenancy weakness that needs urgent attention.**

The things that are usually weak in startups are strong here: no secrets in the repo, every webhook and cron route verifies signatures with timing-safe comparisons, OAuth tokens are properly encrypted at rest with PKCE and CSRF protection, AI data egress is org-scoped with a database-enforced safe-SQL backstop, security headers are applied site-wide, and the password-reset flow is textbook. The newer migrations show a clear, improving security discipline.

The problem is concentrated and serious: **tenant isolation rests on a value the user can edit themselves.** The function every Row Level Security (RLS) policy trusts for "which organisation am I?" reads from client-writable JWT metadata, and roughly eight core operational tables (emissions, KPIs, activity data, suppliers) are protected *only* by that value. The public anon key is, by design, in every browser. Chained together, a logged-in user can read and write another organisation's data directly from browser dev tools. For a B2B platform, cross-tenant access is the most damaging class of bug, so despite the strong surrounding work this lands the overall posture at **"solid foundations, one urgent fix away from trustworthy."**

### Posture scorecard

| Domain | Rating | Note |
|---|---|---|
| Secrets management | Strong | No committed secrets; runtime Maps key; tokens encrypted |
| Webhooks / cron auth | Strong | Stripe + Unleashed signatures, timing-safe `CRON_SECRET` |
| OAuth / integrations | Strong | AES-256-GCM, PKCE, CSRF state |
| AI / data egress | Strong | Org-scoped, SELECT-only DB backstop |
| HTTP headers / config | Good | Site-wide headers; CSP too permissive |
| Input validation | Weak | `zod` present but ~unused on API routes |
| **Tenant isolation (RLS)** | **Critical gap** | **Client-writable org context on core tables** |
| API authorization (IDOR) | Mixed | Mostly correct; a few service-role routes miss org checks |
| Privacy / GDPR | Developing | Policy maturity outruns implementation |

---

## 1a. Remediation status (updated 2026-05-29)

The P0 (cross-tenant) items were fixed in code on the review date. **Two database migrations must be applied in the Supabase SQL editor, and the app redeployed, for the fixes to take full effect.** The SQL was provided to Tim in-session.

| Item | Fix | Status |
|---|---|---|
| CRIT-1 | `get_current_organization_id()` now returns the claimed org only if the caller is a verified member/advisor (root-cause fix; closes the bypass across every policy at once). Migration `20262702500000_harden_get_current_organization_id.sql`. | Code complete, **migration pending apply** |
| CRIT-2 | Defence-in-depth: explicit app-level org checks added to the routes in HIGH-1. Fuller mitigation (token-bound client for user routes / move org id to server-only `app_metadata`) tracked in P1. | Partially addressed |
| HIGH-1 | Org-ownership / admin checks added to `suppliers/linked-products`, `admin/suppliers`, all five `community-impact/*` routes (including an unscoped `volunteering` DELETE), and the three `lca/[id]/review` write routes. New helper `lib/supabase/verify-org-access.ts`. | Code complete |
| HIGH-3 | Public `USING (true)` read policy dropped and existing lead emails >24h deleted (migration `20262702510000`), plus an ongoing purge cron (`/api/cron/purge-public-greenwash-scans`, daily 04:00 UTC). | Code complete, **migration pending apply** |

### P1 + expanded IDOR remediation (same session)

| Item | Fix | Status |
|---|---|---|
| HIGH-2 (SSRF) | `safeFetch` (host + resolved-IP checks, manual per-hop redirect re-validation) in the URL-import background fetcher. | Code complete |
| HIGH-4 (consent) | Cookie-consent banner; GA + PostHog now load only on opt-in. | Code complete |
| MED-1 (SlideSpeak) | Timing-safe secret compare; stopped logging/returning the secret-bearing URL. | Code complete |
| MED-5 / LOW-2 (rate limit) | Durable `rateLimit` (Upstash REST + in-memory fallback) on Rosa chat, 7 other AI endpoints, password-reset, contact. Set `UPSTASH_REDIS_REST_URL` + `_TOKEN` to make it cross-instance. | Code complete |
| MED-6 (error leak) | `serverErrorResponse` helper; removed the `error.stack` leak in openlca/calculate. Broad `error.message` sweep remains P2. | Partial |
| LOW-4 (diagnostic) | Removed `/api/people-culture/compensation/test`. | Code complete |
| **CRIT-2 (expanded)** | The metadata-trust IDOR was **far wider than the original sample: 34 service-role routes** (people-culture, governance, certifications, orchards/vineyards/arable, impact-valuation, etc.) read client-writable org metadata without verifying membership. All 34 now use `resolveAccessibleOrg` (membership/advisor verified). | Code complete |
| CRIT-2 (depth) | Org context moved to server-only `app_metadata` (read app→user coalesce, still validated; backfill; `/api/organizations/switch` route + client `refreshSession`; user+app dual-write for deploy safety). Migration `20262702530000`. | Code complete, **migration pending apply** |
| **Residual IDOR (new)** | The sweep surfaced more in the same files: GET handlers scoping by an unverified query org (or returning all tenants when omitted), PUT/DELETE-by-id with no org scope, and farm child-rows not checking parent ownership. All fixed across governance / certifications / farm routes. | Code complete |

**Verification:** full project typecheck passes (0 errors) after every batch. The affected routes have no unit tests (a coverage gap, see MED-2); changes were reviewed and the migration logic validated against `user_has_organization_access()`. **Org switching could not be live-tested** (prod-only env), so it should be smoke-tested after deploy; the design dual-writes user + app metadata so it works both before and after the migrations are applied. Live exploit verification was not run (see Appendix B).

P2 items (full `error.message` sweep, zod input validation, CSP nonces, DSR tooling, sub-processor disclosure, retention) remain open per Section 4.

---

## 2. What we do well (strengths)

These are confirmed in code and worth protecting as the codebase grows:

1. **No hardcoded secrets.** Repo-wide scans for `sk_live`, `whsec_`, `AIza`, private keys, etc. found nothing in tracked source. `.env` and `.env.local` are git-ignored; `.env.example` holds only placeholders.
2. **Stripe webhooks verified.** `stripe.webhooks.constructEvent` validates the signature against the raw body before any handler runs, with idempotency to prevent replay ([app/api/stripe/webhooks/route.ts:88](app/api/stripe/webhooks/route.ts:88)).
3. **Cron auth is timing-safe.** All 17 `app/api/cron/*` routes use a constant-time `safeCompare` against `CRON_SECRET` ([lib/utils/safe-compare.ts](lib/utils/safe-compare.ts)).
4. **OAuth tokens encrypted at rest.** Xero and Breww tokens use AES-256-GCM with random IV and auth tag, PKCE S256, and CSRF `state` in an encrypted httpOnly cookie; tokens are never returned to the client ([lib/xero/token-store.ts](lib/xero/token-store.ts)).
5. **AI egress is contained.** Rosa/agents send only the caller's org data; the LLM-exposed SQL tool is SELECT-only with a keyword blocklist, table whitelist, a mandatory `organization_id` filter, and a `SECURITY DEFINER` read-only RPC backstop ([lib/rosa/safe-sql.ts](lib/rosa/safe-sql.ts)). This is a strong defence against prompt-injection-driven data theft.
6. **RLS helper functions are correct.** `is_organization_admin`, `is_alkatera_admin`, `can_approve_data`, `user_has_organization_access` all verify real membership by joining `organization_members` on `auth.uid()`, are `SECURITY DEFINER`, and were `search_path`-hardened ([supabase/migrations/20260309000000_fix_security_definer_search_paths.sql](supabase/migrations/20260309000000_fix_security_definer_search_paths.sql)). RLS is enabled on effectively all tenant tables.
7. **Security headers site-wide.** HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` apply to all routes; `poweredByHeader` is off; no production source maps ([netlify.toml:14](netlify.toml:14)).
8. **Password reset is exemplary.** Rate-limited with a constant response that does not reveal whether an account exists ([app/api/auth/password-reset/route.ts](app/api/auth/password-reset/route.ts)).
9. **Defended XSS, uploads, redirects.** The one user-controlled HTML sink (blog) uses `sanitize-html` with an allowlist; uploads validate size/MIME/filename and block path traversal; auth redirects pass through `sanitizeRedirectPath`.
10. **The procurement portal was built right.** `requireProcurement()` verifies `procurement_members` membership (not the URL slug) on all five routes, and its RLS is keyed off `auth.uid()`, so the platform-wide isolation weakness does not reach it.

---

## 3. Findings

Status legend: **confirmed (code)** = proven by reading the code; **needs-testing** = strong indication, exact exploitability to be confirmed; **pending live** = scheduled for read-only live verification (Appendix B).

| ID | Severity | Title | Status |
|----|----------|-------|--------|
| CRIT-1 | Critical | Cross-tenant read/write on core tables via public anon key + forged `user_metadata` | confirmed (code), pending live |
| CRIT-2 | Critical | Service-role client returned to any authenticated user; RLS not a backstop on the API | confirmed (code) |
| HIGH-1 | High | IDOR on service-role API routes missing org/admin checks | confirmed (code) |
| HIGH-2 | High | SSRF in the URL-import background fetcher (redirect bypass) | confirmed (code), exploit needs-testing |
| HIGH-3 | High | World-readable lead emails in `public_greenwash_scans` + indefinite retention | confirmed (code) |
| HIGH-4 | High | Analytics (GA + PostHog) fire with no cookie-consent gate | confirmed (code) |
| HIGH-5 | High | No data-subject-rights tooling despite the privacy policy promising it | confirmed (code) |
| MED-1 | Medium | SlideSpeak webhook: secret in URL query, non-timing-safe compare, secret logged | confirmed (code) |
| MED-2 | Medium | Pervasive lack of input validation (`zod` unused on API routes) | confirmed (code) |
| MED-3 | Medium | PostgREST `.or()`/`.filter()` interpolate raw user input | confirmed (code) |
| MED-4 | Medium | CSP allows `unsafe-inline` and `unsafe-eval` | confirmed (code) |
| MED-5 | Medium | No rate limiting on authenticated AI endpoints (cost abuse) | confirmed (code) |
| MED-6 | Medium | Raw error messages / stack traces returned to clients | confirmed (code) |
| MED-7 | Medium | Privacy policy lists no sub-processors and omits AI processing | confirmed (code) |
| MED-8 | Medium | Retention effectively indefinite (no PII purge jobs) | confirmed (code) |
| LOW-1 | Low | `ef_selection_log` readable across tenants (`USING (true)`) | confirmed (code) |
| LOW-2 | Low | Rate limiting is in-memory only (per-instance, bypassable) | confirmed (code) |
| LOW-3 | Low | CSP missing `frame-ancestors` (mitigated by X-Frame-Options) | confirmed (code) |
| LOW-4 | Low | Leftover diagnostic endpoint leaks RLS error internals | confirmed (code) |
| LOW-5 | Low | App pages not gated server-side (rely on client `AppLayout`) | confirmed (code) |
| LOW-6 | Low | `INTEGRATION_CONFIG_KEY` padded if short (entropy) | confirmed (code) |
| LOW-7 | Low | Procurement slug existence oracle + shared directory headline fields | confirmed (code), by design |

### Critical findings

**CRIT-1 - Cross-tenant read/write via the public anon key and forged org metadata.**
`get_current_organization_id()` returns `request.jwt.claims -> user_metadata ->> current_organization_id` ([supabase/migrations/20251108000000_initial_schema.sql:2505](supabase/migrations/20251108000000_initial_schema.sql:2505)). `user_metadata` is editable by the user via `supabase.auth.updateUser`. Around eight core tables are protected by RLS policies scoped **solely** by that function, with no membership check: `activity_data`, `calculated_emissions`, `ghg_emissions`, `kpis`, `activity_log`, `suppliers`, `supplier_products`, `supplier_invitations` (roughly 40+ SELECT/INSERT/UPDATE/DELETE policies, e.g. [:18800](supabase/migrations/20251108000000_initial_schema.sql:18800), [:18792](supabase/migrations/20251108000000_initial_schema.sql:18792), [:20540](supabase/migrations/20251108000000_initial_schema.sql:20540)). Because the anon key ships to every browser, a logged-in user can, from dev tools: set their `current_organization_id` to a victim org's UUID, then `select`/`insert`/`update`/`delete` that org's emissions, KPIs, activity data and supplier records. **Impact:** full cross-tenant confidentiality and integrity loss on the platform's core operational data. **Fix:** re-scope these policies to verify membership (`user_has_organization_access(organization_id)`), not just the metadata value. The helper already exists and newer tables already use this pattern.

**CRIT-2 - Service-role client handed to any authenticated user.**
`getSupabaseAPIClient()` returns a service-role client (full RLS bypass) whenever a user is authenticated ([lib/supabase/api-client.ts:93](lib/supabase/api-client.ts:93), [:120](lib/supabase/api-client.ts:120)). The code comment is explicit that "all routes MUST enforce organisation scoping at the application level." This is a deliberate workaround for PostgREST schema-cache issues, but it means **RLS provides no backstop on the API surface**: every one of ~370 routes is solely responsible for its own org check, with no central authorization middleware. Most routes do this correctly, but it makes any single omission a full cross-tenant exposure (see HIGH-1) and removes defence-in-depth platform-wide. **Fix (strategic):** prefer the token-bound anon client for user-facing routes so RLS applies, reserving the service-role client for admin/cron paths; failing that, introduce a shared `requireOrgAccess(resourceOrgId)` guard that every data route must call.

### High findings

**HIGH-1 - IDOR on service-role routes missing org/admin checks (confirmed).** Concrete instances of CRIT-2:
- [app/api/suppliers/linked-products/route.ts:36](app/api/suppliers/linked-products/route.ts:36): takes `organization_id` from the body, queries with service-role, no membership check. Any user reads any org's suppliers.
- [app/api/admin/suppliers/route.ts:31](app/api/admin/suppliers/route.ts:31): authenticates but never checks `is_alkatera_admin`. Any logged-in user reads any platform supplier by id. (The other 27 admin routes correctly use `requireAlkateraAdmin()`.)
- [app/api/community-impact/donations/route.ts:6](app/api/community-impact/donations/route.ts:6): org id from query, service-role, no check. Siblings (`local-impact`, `score`, `stories`, `volunteering`) share the pattern (needs-testing).
- LCA review writes with no org check: [approve](app/api/lca/[id]/review/approve/route.ts:20), [comment](app/api/lca/[id]/review/comment/route.ts:26), [statement](app/api/lca/[id]/review/statement/route.ts:27). One tenant can approve/alter another tenant's LCA review. (The matching GET and DELETE already do the check, so the pattern was simply omitted on these writes.)

**Fix:** apply the existing pattern from [app/api/lca/[id]/review/route.ts:32](app/api/lca/[id]/review/route.ts:32) (`resolveUserOrganization()` then reject on org mismatch) to each route; add the admin gate to `admin/suppliers`.

**HIGH-2 - SSRF in the URL-import background fetcher.** The submit route blocks localhost/private ranges, but only enqueues a job; the actual server-side fetches happen in [netlify/functions/import-from-url-background.ts:313](netlify/functions/import-from-url-background.ts:313) (and :470, :217) with `redirect: 'follow'` and no host re-validation. A clean public URL can 302-redirect to cloud metadata (`169.254.169.254`) or internal services; DNS rebinding is also possible. **Fix:** port the `isBlockedHost` check into the fetcher, use `redirect: 'manual'`, re-validate every hop, and pin the resolved IP.

**HIGH-3 - World-readable lead emails + indefinite retention.** `public_greenwash_scans` stores marketing-lead `email` + `url` with a SELECT policy `USING (true)` ([supabase/migrations/20260327100522_public_greenwash_scans.sql:30](supabase/migrations/20260327100522_public_greenwash_scans.sql:30)), so any anonymous caller can read every lead email. The "delete after 24h" line is a comment only; no purge exists, so emails are retained indefinitely. **Fix:** restrict the SELECT policy to admins (or none), and implement the purge via `pg_cron` or a cron route.

**HIGH-4 - Analytics with no consent gate.** Google Analytics and PostHog initialise unconditionally in the root layout ([app/layout.tsx:157](app/layout.tsx:157)), with no cookie-consent banner anywhere. Under UK PECR/GDPR, non-essential analytics cookies require prior opt-in. This is the most likely ICO-visible issue. **Fix:** add a consent banner and gate both scripts behind opt-in.

**HIGH-5 - No data-subject-rights tooling.** The privacy policy promises access, erasure and portability ([marketing/components/PrivacyPageClient.tsx:113](marketing/components/PrivacyPageClient.tsx:113)), but there is no `auth.admin.deleteUser` call, no delete-account or data-export UI, and no admin erasure tooling. Serviceable manually at low volume, but it is a gap against the policy's own promises. **Fix:** build a minimal export + account/org deletion path, or document the manual DSR process and timelines.

### Medium findings (summary)

- **MED-1** SlideSpeak webhook authenticates via `?secret=` with `!==`, and the secret is logged to stdout ([app/api/webhooks/slidespeak/route.ts:28](app/api/webhooks/slidespeak/route.ts:28), [app/api/admin/slidespeak-webhook/route.ts:75](app/api/admin/slidespeak-webhook/route.ts:75)). Move to a header, use `safeCompare`, stop logging the URL.
- **MED-2** `zod` is imported in 0 route files; ~10 of 370 routes validate input; 221 consume `request.json()` directly. Add schemas to admin/auth/payment/import writes first.
- **MED-3** Raw user input interpolated into PostgREST `.or()`/`.filter()` ([app/api/xero/export-csv/route.ts:68](app/api/xero/export-csv/route.ts:68), [app/api/ingredients/search/route.ts:566](app/api/ingredients/search/route.ts:566), [lib/rosa/tools.ts:1272](lib/rosa/tools.ts:1272)). Bounded by RLS, but escape or reject `,()` in search terms.
- **MED-4** CSP includes `unsafe-inline` and `unsafe-eval` in `script-src` ([netlify.toml:23](netlify.toml:23)), defeating most of CSP's XSS value. Move to nonces; drop `unsafe-eval`.
- **MED-5** No rate limiting on authenticated AI endpoints (Rosa chat, imports). Unbounded LLM spend from one account. Add durable throttling.
- **MED-6** `error.stack` returned to clients at [app/api/openlca/calculate/route.ts:521](app/api/openlca/calculate/route.ts:521); ~178 routes return `error.message`, leaking schema/RLS internals. Centralise into a generic-error helper.
- **MED-7** Privacy policy names no sub-processors and never discloses third-party AI processing. Add a named sub-processor list (Supabase, Stripe, Google, Anthropic, SlideSpeak, Resend, PostHog).
- **MED-8** No retention/purge for old invitations, audit-log IPs, or lead emails. Define periods and add purge jobs.

### Low findings (summary)

- **LOW-1** `ef_selection_log` SELECT `USING (true)` ([supabase/migrations/20260504100000_ef_selection_log.sql:63](supabase/migrations/20260504100000_ef_selection_log.sql:63)).
- **LOW-2** In-memory rate limiters reset on cold start and are per-instance (e.g. [app/api/contact/route.ts:5](app/api/contact/route.ts:5)); move to Redis/Upstash.
- **LOW-3** No `frame-ancestors` in CSP (mitigated by `X-Frame-Options: DENY`).
- **LOW-4** Leftover diagnostic endpoint returns DB error internals ([app/api/people-culture/compensation/test/route.ts](app/api/people-culture/compensation/test/route.ts)); remove or env-gate.
- **LOW-5** App pages gate via client-side `AppLayout` only ([components/layouts/AppLayout.tsx:73](components/layouts/AppLayout.tsx:73)); data-safety depends on RLS holding.
- **LOW-6** `INTEGRATION_CONFIG_KEY` padded with `'0'` if under 32 bytes ([lib/crypto/config-encryption.ts:26](lib/crypto/config-encryption.ts:26)); validate length instead.
- **LOW-7** Procurement layout lets an authenticated user distinguish valid org slugs; `brand_directory` headline fields readable by any authenticated user (documented shared-directory design, not a regression).

---

## 4. Remediation plan

### P0 - This week (cross-tenant data exposure)

1. **Re-scope the 8 legacy tables' RLS policies** (fixes CRIT-1). Replace sole `get_current_organization_id()` scoping with `user_has_organization_access(organization_id)` on `activity_data`, `calculated_emissions`, `ghg_emissions`, `kpis`, `activity_log`, `suppliers`, `supplier_products`, `supplier_invitations`. Effort: **M** (one migration; I will post the full SQL for the Supabase editor when we implement).
2. **Patch the IDOR routes** (fixes HIGH-1). Add the existing org-ownership check to `suppliers/linked-products`, `community-impact/*`, and the three LCA review writes; add `is_alkatera_admin` to `admin/suppliers`. Effort: **S**.
3. **Lock down `public_greenwash_scans`** (fixes HIGH-3). Restrict the SELECT policy and add the 24h purge. Effort: **S**.

### P1 - This sprint

4. **SSRF guard in the background fetcher** (HIGH-2): `isBlockedHost` + `redirect: 'manual'` + per-hop revalidation. Effort: **S/M**.
5. **Cookie-consent banner** gating GA + PostHog (HIGH-4). Effort: **M**.
6. **Centralised error handler** so routes never return `error.message`/`stack` (MED-6); remove diagnostic endpoints (LOW-4). Effort: **M**.
7. **SlideSpeak webhook**: secret to header, `safeCompare`, stop logging (MED-1). Effort: **S**.
8. **Durable rate limiting** (Upstash) on AI endpoints + auth flows (MED-5, LOW-2). Effort: **M**.
9. **Defence-in-depth for CRIT-2/C2**: move `current_organization_id` into `app_metadata` (server-set, not user-writable) and prefer the token-bound anon client on user-facing routes. Effort: **M/L** (touches the org-switch flow).

### P2 - Backlog (hardening + compliance)

10. `zod` schemas on write routes, starting admin/auth/payments/import (MED-2).
11. Escape/reject delimiters in `.or()`/`.filter()` search inputs (MED-3).
12. Tighten CSP: nonces, drop `unsafe-eval`, add `frame-ancestors 'none'` (MED-4, LOW-3).
13. Data-subject-rights tooling: export + erasure, or a documented manual process (HIGH-5).
14. Privacy policy: sub-processor list + AI-processing disclosure (MED-7).
15. Retention policy + purge jobs for PII, audit IPs, stale invites (MED-8).
16. `ef_selection_log` scope (LOW-1); `INTEGRATION_CONFIG_KEY` length validation (LOW-6).

---

## Appendix A - Coverage and method

Six general-purpose review agents ran in parallel over the main repo (RLS/isolation; API authorization/IDOR; secrets/webhooks/OAuth/AI egress; injection/XSS/validation/SSRF; privacy/GDPR; infrastructure/headers/rate-limiting), plus one focused agent on the procurement portal worktree. The distributor portal lives in `main` and was covered by the API authorization pass (found safe: `requireDistributor()` + `distributor_org_id` scoping).

This was a risk-prioritised review, not an exhaustive line-by-line audit of all 370 routes. The IDOR pass fully inspected all admin, cron, webhook and Stripe routes plus a heuristic-ranked sample of the 91 dynamic-segment routes; the RLS pass enumerated policies across all 297 migrations. Findings marked **needs-testing** are credible but not yet proven exploitable. No production data was accessed during this static review.

## Appendix B - Live verification

CRIT-1 live verification was **not run**. The agreed method (read-only against production using the provided test accounts) required (a) a write to a test account's `current_organization_id` metadata to forge tenant context and (b) reading another organisation's rows on the production database. Claude Code's safety classifier blocked this as exceeding a strict "read-only with test accounts" boundary (real co-founder / company accounts, production data), and it was not overridden.

CRIT-1 therefore remains **confirmed at code level** (high confidence): `get_current_organization_id()` reads `user_metadata.current_organization_id` ([initial_schema.sql:2505](supabase/migrations/20251108000000_initial_schema.sql:2505)); the application itself writes that field via `auth.updateUser` during org switching ([lib/organizationContext.tsx](lib/organizationContext.tsx)), proving it is user-writable; and the affected policies trust it alone. A safe future verification can be run on a **local Supabase** (apply migrations + seed two dummy orgs), fully isolated from production, ideally as a regression test asserting the hardened `get_current_organization_id()` returns NULL for a forged org.
