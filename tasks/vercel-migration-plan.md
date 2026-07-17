# Deploy the redesign to Vercel, then cut production over

**Worktree:** `.claude/worktrees/redesign` (branch `redesign`). Production stays on Netlify (branch `main`) and is untouched until the final cutover. Plan also lands in the worktree as `tasks/vercel-migration-plan.md`.

## Context

Two goals. First, get the redesign into a live environment connected to the real OpenLCA factor servers, Anthropic/Gemini, and a database, because local testing has hit a wall (OpenLCA unreachable locally, no Gemini key, email-in and the whole data-revolution flywheel unverifiable). Second, Tim is moving alka**tera** off Netlify onto Vercel anyway, so the redesign's staging deployment doubles as the migration's proving ground: prove Vercel with zero customer exposure, then cut production over once the redesign is ready.

**The "migrate user data" step is not an ETL.** The redesign is the same Next.js app reading the same Supabase database and the same tables. Its migrations are all additive (audited: no `DROP COLUMN`/`DROP TABLE`/`ALTER TYPE`/`RENAME`/`DELETE`; the only drops are constraint/index rewrites). So cutover is: run the additive migrations against the live production database (safe while v1 still serves), run one provenance backfill, deploy the redesign code, flip DNS. The data never moves.

## Decisions locked

- Staging DB = **anonymised clone of production** (faithful data shapes for a true migration rehearsal, PII scrubbed).
- Scheduling = **Inngest native crons** (the `lib/inngest/functions/dns-health.ts` pattern already in the codebase), matching the house "always Inngest" rule; almost no Vercel-specific cron config.
- Provisioning via the **Vercel MCP** (and Supabase MCP for the staging clone); steps needing Tim's dashboards (Xero/Breww OAuth, DNS) are flagged.

## Netlify footprint to port (from exploration)

- **7 background workers** invoked via hardcoded `/.netlify/functions/<x>-background` URLs (404 on Vercel): import-from-url, ingest-auto, deep-enrich, directory-sourcing, find-websites, process-sku-import, scrape-brand. On the critical path for smart upload / website import / email-in.
- **14 scheduled heartbeats** in `netlify/functions/` (7 fire `inngest.send()`, 7 `fetch` an `/api/cron/*` route) + a duplicate cron layer in `netlify.toml` (`[functions."app/api/cron/..."]`). Consolidate all into Inngest crons.
- **`deploy-succeeded.ts`** deploy hook → re-syncs wiki into Rosa's KB.
- **~12 sites** reading Netlify-only `process.env.URL`/`DEPLOY_URL`/`NETLIFY`.
- Two lockfiles (`package-lock.json` + `pnpm-lock.yaml`); `netlify.toml` security headers + CSP; `@netlify/functions` dep; `STRICT_ENV_BUDGET` prebuild guard.

## Phase 1 — Platform-neutralise the code (redesign branch, no Vercel needed)

1. **`lib/deployment/base-url.ts`** — one `getAppBaseUrl(request?)`: prefer `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL`/`VERCEL_URL` (add `https://`) → request `host` header → hardcoded `https://alkatera.com`. Plus `isProductionRuntime()` replacing the four `process.env.NETLIFY` isDev checks. Replace the ~12 scattered base-URL sites (representative: `lib/inngest/functions/email-intake.ts`, `lib/ingest/enqueue.ts`, `app/api/ingest/auto/*`, `app/api/cron/process-scraping-queue/route.ts`, `app/api/distributor/*`, `app/api/admin/directory/*`, `lib/certifications/recalculate.ts`).
2. **Port the 7 background workers to Inngest.** Each `netlify/functions/<x>-background.ts` → a `lib/inngest/functions/<x>.ts` (event-triggered, `step.run`-wrapped), registered in `functions/index.ts`, event added to `AlkateraEvents`. Change every caller from `fetch('/.netlify/functions/…')` to `inngest.send(...)`. Local dev runs them through the Inngest dev server (drop the `@/netlify/functions/*` dynamic imports). Reuse the existing `scraping.ts`/`documents.ts`/`enrich.ts`/`matching.ts` patterns.
3. **Scheduling → Inngest native crons.** Add `cron:` triggers to the target Inngest functions (folding the 7 HTTP-dispatch routes' work — pulse-*, process-reminders, process-scraping-queue tick — into their Inngest functions). Retire the `netlify/functions/*` heartbeats and the `netlify.toml` schedule block. Wiki-sync becomes a small Inngest cron (every ~6h) instead of the deploy hook.
4. **`vercel.json`** — port the security headers + CSP from `netlify.toml`; any residual HTTP-only cron (aim for none); build stays `next build`. `.node-version` = 20 already correct.
5. **Repo hygiene:** delete `package-lock.json`, add `"packageManager": "pnpm@…"` (house rule: pnpm only); make `scripts/check-function-env-budget.mjs` a no-op off Netlify; remove `@netlify/functions` once nothing imports it; delete `netlify/` + `netlify.toml` **on the redesign branch only** (main keeps serving Netlify untouched).
6. Verify: `npx tsc --noEmit`, scoped vitest, and a local Inngest-dev run proving a smart-upload/website-import job completes through the new Inngest path.

## Phase 2 — Provision Vercel staging + anonymised DB

1. **Staging Supabase** (Supabase MCP): clone prod schema + data into a new project/branch, run an **anonymisation pass** (scrub `auth.users` emails → `staging+<id>@alkatera.test`, org names, contact PII; keep IDs/relationships/footprint shapes intact). Then apply the full pending-migration stack (already applied locally) — this is the migration rehearsal.
2. **Vercel project** (Vercel MCP): new project on the repo, production branch = `redesign`, so it deploys the redesign. Framework Next.js, pnpm.
3. **Env vars** (staging scope): full deduped set with staging values — staging Supabase keys, real Anthropic/Gemini keys, Inngest staging keys, OpenLCA real servers, `NEXT_PUBLIC_SITE_URL` = the staging domain, `CRON_SECRET`, Stripe test mode, `EMAIL_INTAKE_*` (a staging mailbox or left dormant). **Tim-flagged:** `XERO_REDIRECT_URI`/`BREWW_OAUTH_REDIRECT_URI` must be registered for the staging domain in those consoles, or those integrations stay disabled on staging.
4. **Inngest:** register the Vercel staging deployment as an Inngest app (sync `/api/inngest`) so the native crons fire against staging.
5. Staging domain (e.g. `staging.alkatera.com` or the `*.vercel.app` URL).

## Phase 3 — Verify staging live

Exercise everything local couldn't: OpenLCA factor matching in the LCA wizard (the material step auto-resolves for real), Rosa answering via live Gemini, email-in (send a bill to the staging address → `/uploads` → queue → write), smart-upload + website-import background jobs, the arrival→data-revolution loop, the ask queue, and report generation hitting the confirmed-share gate. The migration rehearsal is already banked (Phase 2 ran the stack against real-shaped data).

## Phase 4 — Production cutover (when the redesign is ready)

The "migrate user data" step, reframed as migrate-then-deploy against the **live production Supabase** (staging clone is thrown away; prod data never moves):

1. **Backup:** verified Supabase PITR snapshot of prod, restore path tested.
2. **Expand:** run the additive migrations against live prod while v1 (Netlify) still serves — zero downtime, backward-compatible by construction.
3. **Backfill:** run the **provenance-confirmed backfill** (stamp all pre-existing user-entered data `confirmed`, so existing customers aren't locked out of reports by the 80% gate). Written and rehearsed on staging first — the one net-new cutover migration.
4. **Deploy:** merge `redesign` → `main`; production Vercel project deploys `main` with prod env values; Inngest prod app synced.
5. **DNS:** point the app domain from Netlify to Vercel; register prod OAuth redirect URIs (Xero/Breww).
6. **Verify prod;** keep the Netlify deploy live as instant rollback (additive migrations mean v1 still runs against the migrated schema). Decommission Netlify after a soak.

## Verification

- Phase 1: tsc + scoped vitest green; a job driven end-to-end through the new Inngest path locally (no `/.netlify/functions/` call remains — `grep -r "\.netlify/functions" app lib` is clean).
- Phase 2/3: staging URL loads; a real OpenLCA match, a live Rosa answer, and an emailed-in bill all succeed; migration stack applied to the clone with zero errors.
- Phase 4: dry-run the entire cutover (backup → migrate → backfill → deploy → verify) against the staging clone before touching prod; rollback rehearsed.

## Risks

- **Background-worker port is the riskiest code change** (7 workers, many callers) — do it first, verify each job type locally through Inngest before Vercel.
- **OAuth redirects + `NEXT_PUBLIC_SITE_URL`** are the easiest things to forget per-environment; the base-URL helper centralises the app's own URL, but the standalone `XERO_REDIRECT_URI`/`BREWW_*` need manual registration.
- **Anonymisation completeness** — verify no real email/PII survives the scrub before anyone else can reach staging.
- Production cutover stays reversible only while migrations remain additive; do not introduce a destructive migration into the cutover set.
