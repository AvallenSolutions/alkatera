# Outbound Reply-Hook — Project Goal & Spec

_Resolved via goal-finding interview, 2026-06-28._

## The real goal
Grow paying customers by fixing the **top-of-funnel leak**. The channel is **outbound
sales**, and the weakest link is **getting a reply** to Tim's cold email. The platform's
job for the next ~90 days is to make outbound land and convert:

> Every prospect gets a **private, auto-generated report** estimating their brand's
> carbon footprint, which **morphs into a real alkatera trial org** on one click.

All in-flight depth work (reporting rework, GHG revisions, VSME, tier-gating, SEO) is
**parked** unless it directly serves this.

## Verified decisions
1. Scope = whole platform
2. Win condition = revenue / paying customers
3. Constraint = top of funnel (too few qualified producers land)
4. Channel = outbound sales
5. Weakest link = getting a reply
6. Park all depth WIP for ~90 days
7. Hook = personalised report added to Tim's existing personal emails
8. Privacy = private unguessable token link, **full report visible**, "claim this profile" → real org
9. MVP = A+B+C+D shipped as one unit
10. Cold-brand data = **auto-enrich on the fly** (the one un-parked dependency)

## MVP specs (small, independently verifiable; build top→bottom)
- [x] **A — Brand footprint estimator.** `lib/outreach/brand-footprint-estimate.ts`,
      `estimateBrandFootprint(input)`. Pure/deterministic, no network. Uses the BIER 2023
      **industry-benchmark** path (sourced per-litre + per-bottle carbon & water), NOT the
      per-material LCA engine (which needs material rows a cold prospect lacks). Resolves
      category via provided → product group → `inferCategoryFromText` → industry default,
      with a confidence rating. Never invents annual volume. Added `getGroupForCategory` +
      `isProductGroup` to `lib/industry-benchmarks.ts`.
      _Verified: 7 vitest cases pass (Avallen 700ml spirit → 2.1 kg/bottle), tsc clean._
      ⚠️ **Spec C wiring note:** `deepEnrichBrand` returns coarse lowercase categories
      (`spirits|wine|beer|non_alc|other`) that do NOT match the estimator's group names
      (`Spirits|Wine|...`). Don't pass them through raw — let inference run off brand+SKU
      names, or add a small mapping adapter in the generator. Estimator left strict on purpose.
- [x] **B — Private report page** `app/r/[token]/page.tsx` (server component) +
      `components/outreach/BrandReportView.tsx` (pure, inline-styled, branded) +
      `lib/outreach/brand-report.ts` (`getBrandReportByToken`, service-role, exact-token).
      New table `brand_reports` (migration `20260628130000_brand_reports.sql`): RLS on, NO
      anon policies — read only server-side by exact token (token is the capability; nothing
      to enumerate). Stores an `estimate` jsonb snapshot so the page is benchmark-stable.
      noindex via page metadata + `/r/` added to robots.ts DISALLOW.
      _Verified in browser (local Supabase, seeded Avallen row): page 200 + renders 2.1
      kg/bottle, robots meta = noindex,nofollow, bad token → 404, no page console errors.
      13 vitest cases pass, tsc clean._ ⚠️ **Migration pending local persist + prod apply.**
- [x] **C — Generate-report admin tool.** Admin page `app/admin/(panel)/outreach/page.tsx`
      + `components/admin/outreach/ReportGenerator.tsx` (sidebar: Outbound → Footprint reports).
      API `app/api/admin/outreach/reports/route.ts` (POST generate + GET list, `requireAlkateraAdmin`).
      Instant link from typed inputs (estimator + `generateReportToken`); background auto-enrich
      via Inngest `outreach/report.enrich` (`lib/inngest/functions/outreach.ts`) guarded by
      `INNGEST_EVENT_KEY`. Adapter `lib/outreach/enrichment-adapter.ts` resolves the coarse-category
      gotcha (feeds product NAMES as SKUs so the estimator infers the specific category, e.g.
      Whisky 3.8, not the broad Spirits group). Migration `20260628140000_brand_reports_enrichment.sql`.
      _Verified end-to-end in browser as a real admin: typed "Glenfiddich Example Single Malt" →
      generated link → opened it → Whisky 3.8 kg/L, 2.66 kg/bottle, Scotland. 22 vitest pass, tsc
      clean. Caught + fixed a 2nd em-dash in UI copy._
      ⚠️ **Migration pending prod apply.** ⚠️ **Inngest enrich path NOT live-verified** (needs
      INNGEST + GEMINI keys + Inngest dev server); function registered, adapter unit-tested.
- [x] **D — Claim → real org.** `app/r/[token]/claim/page.tsx` (server) +
      `components/outreach/ClaimFlow.tsx` (client) + `app/api/outreach/claim/route.ts`.
      Signed-out prospect → auth gate → `/login?returnUrl=/r/[token]/claim` (login+signup tabs,
      internal-redirect validated). Signed-in → auto-claim: creates org (status `trial`, tier
      `seed`, **card-free** per decision) + owner membership + draft product carrying the brand
      (product_category = specific cat, org product_type = mapped GROUP) + marks report claimed +
      switches active org via app_metadata. Idempotent for the owner, 409 for others. No new
      migration (reuses brand_reports.claimed_org_id/status/claimed_at).
      _Verified end-to-end in browser: claimed Glenfiddich as a real user → trial org "Glenfiddich
      Example Single Malt" (Spirits/Scotland) + draft product (Whisky) + owner membership + report
      claimed → landed in the app. Re-claim → same org (no dup). Bad token 404. Logged-out gate
      renders + Continue → /login?returnUrl. 22 vitest pass, tsc clean, no claim-page console errors._

**MVP A+B+C+D COMPLETE.** Remaining: live-verify the Inngest auto-enrich path (Spec C, needs
keys) and ship Spec E (telemetry).

## Fast-follow (not MVP)
- [x] **E — Outbound telemetry** (open / claim events) so the funnel fix is measurable.
      NO migration (reuses brand_reports.first_viewed_at + claimed_at). View beacon
      `components/outreach/ReportViewBeacon.tsx` on /r/[token] → POST `app/api/outreach/view`
      stamps first_viewed_at + status 'viewed', but ONLY for logged-OUT viewers (skips admin
      previews + claimer revisits → honest open rate). Funnel stats added to GET
      `/api/admin/outreach/reports` (counts across ALL reports) → summary card in ReportGenerator
      (Generated / Opened + open-rate / Claimed + claim-rate).
      _Verified in browser: logged-out open stamps view; admin view counted:false (not stamped);
      stats compute (gen 2 / viewed 0 / claimed 1) and render. 22 vitest pass, tsc clean._
      ⚠️ Not yet committed/deployed.

## Main risk
Auto-enrich quality gates report quality. Cold brands with thin web presence → weak
estimate → weak hook. **Fallback:** if enrichment is thin, drop to Tim-enters-a-few-fields
rather than send a bad number.

---

# Self-Learning Smart Upload (2026-07-03, SHIPPED locally 2026-07-04)

_Full plan: `~/.claude/plans/dazzling-crafting-cookie.md`. Feedback capture (Layer 1) +
per-org supplier/document memory injected into the classifier prompt (Layer 2)._

- [x] 1. Migration `20260703180000_smart_upload_learning.sql` (ingest_feedback +
      ingest_document_profiles) — applied + verified on local Supabase
- [x] 2. Pure helpers + vitest: `lib/ingest/feedback-diff.ts`, `supplier-key.ts`,
      `feedback-hints.ts`
- [x] 3. `lib/ingest/org-context.ts` (fetcher + pure formatter) + vitest
- [x] 4. `classify-document.ts`: `orgContext` param + `logClaudeUsage`
- [x] 5. Call-site wiring: inline route + Netlify background fn
- [x] 6. `POST /api/ingest/feedback` route (diff, feedback insert, profile upsert)
- [x] 7. UniversalDropzone: lift jobId, `recordFeedback`, thread into 9 editing panels
- [x] 8. Admin page `/admin/ingest-learning` + API + sidebar link
- [x] 9. Verification: 37 vitest pass, tsc clean, `@/`-import grep clean, manual E2E

## Review
- E2E verified on local (real Opus classification): upload 1 → `[ingest-context] chars=324
  profiles=0`, feedback with an edited period_start → diff `edited: 1`, profile learned
  (british gas → utility_bill, hints: kWh / Bristol Distillery / electricity_grid).
  Upload 2 → `[ingest-context] chars=521 profiles=1` (hints injected), confirm →
  times_seen=2. Idempotent retry → `repeat: true`, no double-bump. Cross-org user → 404.
  `[ai-usage] op=ingest_classify` telemetry live. Admin page renders all three tables.
- Local env fixes made along the way: backfilled 14 unrecorded migrations into local
  `schema_migrations` (history had drifted; schema itself was already current), created
  the `ingest-staging` bucket locally from the archived migration.
- ⚠️ Migration pending PROD apply (SQL posted in chat).
- Deferred (Layer 3+): embedding-based exemplar retrieval, cross-org anonymised learning,
  content-hash dedup of re-uploads, feedback on handoff types (bom/spray/evidence).
