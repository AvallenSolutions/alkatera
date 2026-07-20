# Cutover test plan: main (Netlify) → redesign (Vercel)

**DECIDED 2026-07-20 (Tim): customer data never moves.** Alkatera2 stays the one
production database; the staging Supabase project is a disposable test bed and is
never promoted. At launch the Vercel app points at Alkatera2 with the redesign's
additive migrations applied. Strategy and phases: `tasks/alkatera-v2-launch-plan.md`.
This document remains the tactical test detail behind that plan.

Written 2026-07-20, immediately after the main → redesign merge. The cutover is three
simultaneous changes (app code, hosting platform, database schema), so the plan is
layered: each layer proves one of the three, and the order matters. Nothing below
requires merging redesign → main; everything runs on the redesign branch + staging
until the final section.

## Layer 0 — every session, cheap, already automated

Run scoped (full `vitest` hangs):

```
npx tsc --noEmit
npx vitest run lib/__tests__/packaging-parametric-golden.test.ts \
  lib/calculations lib/constants/__tests__/packaging-material-classes.test.ts \
  lib/rosa lib/reports lib/provenance lib/pdf components/report-builder \
  lib/epr lib/products components/products \
  lib/__tests__/copy-style.test.ts lib/__tests__/prompt-house-style.test.ts
pnpm build
```

Status 2026-07-20: all green (811 tests) on the merged tree.

Gap worth closing: there is NO CI test gate on any branch (the only workflows are
deploy-edge-functions and escalate-feedback). Add a GitHub workflow running the scoped
suites + tsc on push to redesign, so the merge cadence from main cannot silently break
the branch between sessions.

## Layer 1 — the numbers must not change (the harness that makes cutover provable)

The single biggest risk class: an LCA/EPR figure a customer has already published
shifts because redesign computes differently.

1. **Golden packaging test** (now on redesign): `lib/__tests__/packaging-parametric-golden.test.ts`.
2. **Extend to whole-PCF goldens**: snapshot prod's stored `aggregated_impacts` for every
   COMPLETED PCF (Happy Curations 16 products, Everleaf 3), commit as fixtures, and assert
   the redesign calculator reproduces them. Obstacle: the calculator is browser-only, so
   either extract the pure maths or drive `/admin-tools/recalculate-lca` headlessly against
   local Supabase seeded with the prod fixture rows.
   **Sequencing rule: Tim runs the all-orgs recalc on PROD first** (pending action from the
   parametric rollout), THEN we snapshot. Otherwise recalc drift and redesign drift are
   indistinguishable.
3. **EPR tonnage golden**: one seeded submission through `/api/epr` on local, assert line
   tonnages (guards the DRS zero-rating fix and the uuid material id fix).
4. Acceptance: goldens byte-stable across two runs, and identical between a main checkout
   and a redesign checkout against the same DB fixture.

## Layer 2 — schema parity (Supabase)

1. **Repo vs staging**: after pushing this merge, `supabase db push` to alkatera-staging
   must apply exactly the five `20260719*` migrations and nothing else. If it proposes
   more, stop and diff.
2. **Repo vs prod**: prod records migrations under apply-time timestamps and by name.
   Audit: every migration name in the repo appears in prod's `schema_migrations` (or is
   knowingly staging-only, i.e. the 13 redesign-only ones). Produce the list; the cutover
   day's prod push is exactly those 13 + anything added since — rehearse it on a
   structural clone first.
3. **RLS spot-checks** on staging after push: `staging_emission_factors` global rows
   visible (the restore migration), `rosa_message_feedback` readable only by own org,
   `report_shares` NOT directly readable (served through the server).

## Layer 3 — feature walk-throughs on staging (browser, per room)

Vercel Deployment Protection blocks the agent browser on staging, so these are Tim's
scripts (or drop protection for a preview URL). Each script is 5-10 minutes.

- **Cellar / products (merge-sensitive, do FIRST)**: create a product, add packaging via
  the wizard (bottle + closure + label), confirm the material-class picker sets the factor
  with NO search step, complete an LCA, check the boundary label on the products list, and
  confirm a cradle-to-grave study keeps Distribution/Use/EoL steps (the normaliseBoundary
  fix).
- **Evidence / reports**: run the report funnel end to end with real GEMINI + PDFShift
  keys: narratives draft (not fallback prose), voice override changes register, foreword
  accept, PDF ships, share link works and revokes. (Named go-live risk in the programme
  handoff; still unproven.)
- **Desk / arrival**: fresh org through the arrival ritual (front door owns org creation),
  growth field renders, checklists match `get_setup_next_steps`.
- **Network + Wiring**: supplier invite (advisor org-access flow), EPR submission preview
  on a seeded org (DRS lines zero-rated, tonnage sane), admin: demo-seed page seeds
  idempotently, `/admin/rosa-learning` populates after some drawer feedback.
- **Rosa**: ask the drawer "who are you" (never says AI), give a thumbs verdict, check it
  lands in `rosa_message_feedback`, page-context question on a product page (the hardened
  context block), attachment question.
- **Workbench / measures**: facility utility entry, Pulse widgets respect tier gating,
  anomaly + insight sweeps runnable via the manual cron routes with CRON_SECRET.

## Layer 4 — platform behaviour (Vercel-specific)

1. **Scheduled jobs**: all 14 crons are Inngest-native on redesign; nothing else fires
   them. On the PRODUCTION Vercel project (not staging, which is deliberately NO-Inngest):
   register the app with Inngest Cloud (serve URL `/api/inngest`), set INNGEST_EVENT_KEY +
   INNGEST_SIGNING_KEY, then verify in the Inngest dashboard that all 14 functions appear
   WITH their cron triggers, and after 24h that each has run (pulse snapshots at 02:00,
   insights 06:00, anomalies hourly, grid-carbon half-hourly, queues every 1-2 min).
   **Failure mode: silent.** Add a canary: the forest-stall sweep or a daily heartbeat
   that writes a row we can alert on if stale.
2. **Env parity audit**: `.env.example` is identical across branches; diff Netlify prod
   env vars against the Vercel project before cutover (CRON_SECRET, GEMINI_API_KEY,
   PDFSHIFT, STRIPE keys + webhook secret, SUPABASE service keys, RESEND, CALDAV,
   INNGEST_*). Remember the scanner rule: no NEXT_PUBLIC_GOOGLE_MAPS_API_KEY; maps key is
   served via /api/config/maps.
3. **Webhooks with fixed URLs**: Stripe webhook endpoint, Inngest, Resend, any Supabase
   auth redirect URLs — must be repointed at the new domain at cutover, and the old
   Netlify deploy kept receiving until DNS settles.
4. **Function limits**: routes relying on `maxDuration` 120-300 (rosa chat, PDF
   generation, insights) — confirm the Vercel plan honours them (Fluid Compute default
   is fine, but verify per-route config survives the build).

## Layer 5 — cutover day runbook (condensed)

1. Freeze main (fixes only, and every fix merges to redesign same-day from here on).
2. Tim's prod recalc + Layer 1 goldens captured BEFORE the switch.
3. Apply the 13 redesign migrations to prod (rehearsed on a clone in Layer 2).
4. Point production domain at Vercel; keep Netlify deploy warm as instant rollback
   (rollback = DNS back + no schema rollback needed IF the 13 migrations are additive —
   verify that: they are all new tables/columns/indexes, no drops or rewrites).
5. Inngest registration + webhook repoints (Layer 4), then the 24h cron watch.
6. Post-cutover goldens: re-run Layer 1 against prod data; spot-check one published
   report and one EPR submission byte-for-byte against pre-cutover copies.
7. Watch list for week 1: Inngest dashboard daily, Stripe webhook delivery log,
   Supabase logs for RLS denials, and the fetch-cache class of bug (stale reads) on any
   route added since the sweep.

## Standing risks this plan does NOT cover

- Distributor + procurement portals are not yet converted to the studio language; the
  Foodbuy pilot work lives on a separate local branch. Cutover scope must explicitly
  include or exclude those routes.
- Email-in intake (imapflow) is dormant pending the kSuite mailbox + env vars; untestable
  until then.
- The reports programme's five unrendered sections (report-sections plan steps 2-10) are
  a known correctness gap shipping WITH the cutover unless finished first.
