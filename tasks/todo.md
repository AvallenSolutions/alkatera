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

# Parametric packaging factor model (2026-07-16)

Plan approved by Tim; full plan at ~/.claude/plans/validated-drifting-feather.md.

- [x] Migration A: packaging_factor_endpoints table + 13 provisional EU-27 endpoint rows + 3 gap-filler staging factors + RLS + active view
- [x] Migration B: pin columns (endpoint id, library version, factor_derivation, eol_allocation_method) + data_source 'parametric' CHECK arms on both material tables
- [x] Migration C: PCF dedupe (supersede duplicates + partial unique index per product+reference_year)
- [x] lib/constants/packaging-material-classes.ts (controlled vocabulary, catalogue mapping, legacy inference)
- [x] lib/calculations/packaging-factor.ts (pure interpolation returning WaterfallResult; deterministic endpoint fetch)
- [x] Calculator: parametric partition, recycled multiplier gated to legacy rows, snapshot pins, pinned-recalc carries pins, fingerprint includes endpoint pin
- [x] Aggregator: EoL default flipped to cut-off; parametric rows forced cut-off; supersede scoped to reference_year and runs before completion
- [x] Resolver: deterministic ORDER BY on all fuzzy lookups; hard category='Packaging' scope; post-calc ingredient factor pinning
- [x] UI: PackagingMaterialClassPicker replaces factor search; recycled % un-gated; wizard writes classes; save builder + loaders updated
- [x] Report: factor_derivation rendered as a one-line parametric derivation with endpoints, library version and allocation
- [x] Admin dry-run mapping tool at /admin-tools/packaging-migration (apply writes classes only, no recompute)
- [x] Wizard materialHasAssignedFactor recognises parametric rows
- [x] Tests: 31 new (interpolation golden/property/idempotency, vocabulary coverage, carbon-negative regression) + 3 updated for the cut-off default; scoped suites all green (500+ tests)

## Review
- Verified locally: migrations applied to local Supabase (13 endpoints, 3 gap-fillers, 6 pin
  columns, dedupe index, 0 remaining duplicate PCFs). Browser: class picker replaces the
  factor search, live derived-factor caption updates with recycled % (aluminium at 70% =
  2.970 = 8.50 - 0.7 x (8.50 - 0.60)), autosave writes data_source='parametric' + class to
  product_materials, admin tool buckets 6 legacy rows with correct dry-run diffs and applies
  classes without recompute.
- Everleaf regression locked in tests: a 100% recycled flint bottle derives exactly the
  recycled endpoint and can never net carbon-negative under cut-off; the old avoided-burden
  behaviour is asserted as the documented bug.
- ⚠️ Migrations 20260717100000/110000/120000 pending PROD apply (SQL posted in chat).
- ⚠️ Endpoint values are provisional (is_provisional=true, MEDIUM data quality) pending
  ecoinvent 3.12 sign-off; approving them is the Phase 0 gate for HIGH grade.
- ⚠️ Phase 3 (prod backfill via the mapping tool + recompute + user comms) deliberately not
  executed; run after reviewing dry-run diffs per product.
- Note: full wizard Calculate click-through on local was limited by missing local factor
  seed data (local staging_emission_factors is nearly empty) and an intermittent tool
  outage; the calculation path itself is covered by the full-flow calculator/aggregator
  suites (mocked Supabase) plus the golden tests.

---

# Onboarding UX/UI overnight design (2026-07-22)

Brief from Tim: design a world-class first-run flow, signup through payment, desk
arrival, first facility, first product. Capture maximum data without intrusion; every
room warm by desk-time; the user learns to navigate the house.

- [x] Map the redesign's existing arrival ritual, desk, rooms, give door, provenance, ask queue
- [x] Map the production journey on main (signup, Stripe setup-mode trial, Fast Track wizard, facility/product creation, capture assists)
- [x] Research external best practice (Superhuman, Clay, Attio, Mercury, Vanta/Drata, Greenly/Watershed, trial benchmarks)
- [x] Write the design specification: `tasks/onboarding-uxui-spec.md`
- [x] Build + browser-verify the clickable prototype: `tasks/prototypes/first-hour-prototype.html`
      (17 screens, studio design language, embedded Space Grotesk, per-screen design notes
      via the Notes toggle or the N key)
- [x] Publish the prototype as a private artifact for review

## Review
The spec proposes "The First Hour" in four acts: the doorstep (signup with domain
enrichment), the threshold (the existing 6-step arrival ritual plus a new facility step,
a warmth meter, a working ticker, Companies House, a rebuilt no-website path), the walk
(six room cards replacing both the post-payment spinner and the fragile DeskWelcome
popover tour), and the desk (First Week card, flagship-recipe Ask of the Day, provenance
scoreboard). Twelve changes, all riding on existing machinery; implementation map in
spec section 10, open decisions for Tim in section 12.

Prerequisites before any build: the arrival + Stripe checkout has never been walked
end-to-end on staging with a real card (needs a TEST-mode webhook endpoint), and live
Rosa plus paint-my-house are unverified in a true cold signup.

## Round 1 feedback (2026-07-23, applied)
- [x] Walk cards explain each room's contents (purpose + what-lives-here + tabs + "Already inside")
- [x] New pre-walk slide teaching the house navigation concept
- [x] Agreement page: fuller tier cards + recommended plan computed from captured data
- [x] Reveal: logo + palette from the website, not the label
- [ ] Point 5 of Tim's feedback was cut off; awaiting the fifth change

## Build plan
- [x] Phased implementation plan written: `tasks/onboarding-build-plan.md`
      (7 phases, ~3 weeks; Phase 0 = staging Stripe TEST webhook + baseline cold
      signup + Tim's 5 decisions; no DB migrations required; redesign branch only)

## Next (needs Tim)
- [ ] Approve the build plan + decide the five open questions (spec section 12 / plan 0.3)
- [ ] Provide the missing point 5 from round-1 feedback
- [ ] If approved: start Phase 0/1 in the redesign worktree
