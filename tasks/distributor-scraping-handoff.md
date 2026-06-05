# Distributor scraping — session handoff (2026-06-05)

## TL;DR
The **scoring mechanism (the original ask) is DONE, deployed, and working.** This
handoff is ONLY about the remaining blocker: distributor **scrapes don't complete**,
so brand scores don't refresh after a scrape. Root cause is now precisely known.

---

## ✅ What's complete (don't redo)
Unified brand scoring lives in `lib/distributor/scoring/`:
- `pillar-scorer.ts` — 4 env pillars (Climate/Nature/Water/Circularity) + Social + Governance,
  one 0–100 scale, env-dominant weights, **evidence-coverage cap** (≤1 pillar→max 29, 2–3→max 69),
  confidence label, `scoreFromScrapedFields` + `scoreFromAlkateraComposite`.
- `certification-credibility.ts`, `target-scorer.ts`, `category-detector.ts`.
- `recalculate.ts` dispatches; writes per-pillar + confidence to `brand_completeness_snapshots`
  and mirrors onto `brand_directory`.
- New field `carbon_neutral_operations` (field-definitions + field-labels + scorer + website extractor).
- UI: `components/distributor/brand-detail/vitality-card.tsx`, admin `brand-score-breakdown-panel.tsx`.
- Tests: `lib/__tests__/distributor-pillar-scorer.test.ts` (all green). `npx tsc --noEmit` clean.
- Migrations (apply in Supabase SQL editor; CHECK whether already run):
  - `supabase/migrations/20262703500000_unified_pillar_scores.sql` (per-pillar + confidence cols) — applied.
  - `supabase/migrations/20262703600000_get_secret_rpc.sql` (Vault read RPC for SENDER token) — VERIFY applied.
- Vault: `SENDER_API_TOKEN` moved to Supabase Vault (990 chars); `lib/secrets/vault.ts`;
  contact + greenwash routes read it via `getVaultSecret`. Removed from Netlify env.
- Env-budget guard set STRICT in netlify.toml (`STRICT_ENV_BUDGET=1`); `FEATURE_FLAGS` excluded
  in `scripts/check-function-env-budget.mjs` (it's a Netlify build-only var, not forwarded to fns).
- The whole directory was rescored via the admin **Rescore all** button
  (`components/admin/directory/rescore-all-button.tsx` → `/api/admin/directory/rescore`).
  Example: Nc'Nean 58.87 progressing; Cincoro correctly fell to insufficient (1 data point).

---

## ✅ BLOCKER FIXED (2026-06-05, commit `fb115fee`, deployed live)
Root cause was the *opposite* of fix A's framing: `external_node_modules = ["nanoid"]`
in `netlify.toml` told esbuild NOT to inline nanoid, leaving a runtime
`require('nanoid/non-secure')` and relying on Netlify to copy the package next to the
function. Under pnpm's symlinked `node_modules`, Netlify's file-tracer never copies it →
`Runtime.ImportModuleError` at init. **Fix: removed `external_node_modules`** so esbuild
inlines nanoid's source into the single function bundle (no runtime require).
Verified locally: esbuild bundles clean (CJS+ESM, incl. the dynamic scoring import),
zero leftover `require("nanoid")`, bundle `require()`s and exposes `handler`.
`.npmrc public-hoist-pattern` (fix A) was NOT needed and NOT applied.
Pending: live end-to-end confirmation (trigger a scrape, watch the fn log show
`[scrape-brand-bg] done` instead of the init error).

---

## ❌ (HISTORICAL) THE BLOCKER: scrape background function crashed at load

### Architecture now (correct, but the last link crashes)
`netlify.toml` schedules the Next route every 2 min:
`[functions."app/api/cron/process-scraping-queue/route"] schedule = "*/2 * * * *"`.
That route (`app/api/cron/process-scraping-queue/route.ts`) claims queued `scraping_jobs`,
marks them `running`, recovers stale (>16 min) ones, and **HMAC-fires** the background function
`netlify/functions/scrape-brand-background.ts` per job (proven find-websites pattern, from the
Next server handler). The background function (15-min budget) runs `runBrandAgent` and writes the
terminal job status. **The route fires successfully (`dispatched:1`).**

### The exact error (from the Netlify function log for scrape-brand-background)
```
Runtime.ImportModuleError: Error: Cannot find module 'nanoid/non-secure'
Require stack: /var/task/netlify/functions/scrape-brand-background.js ... Phase: init
```
So the function **crashes at init** → never runs the agent → job stays `running`, 0 findings,
no recalc, score never updates.

### Why
- `nanoid@3.3.11` IS installed (has the real `/non-secure` file). It's a **transitive** dep pulled
  into the agent's import graph (NOT supabase/gemini — `find-websites-background` uses those and works).
- The repo uses **pnpm** (symlinked `node_modules`). Netlify's standalone esbuild function bundler
  doesn't include `nanoid` through pnpm's layout → unresolved `require('nanoid/non-secure')` at runtime.
- Tried `external_node_modules=["nanoid"]` in netlify.toml for the fn — did NOT fix it.
- Made `recalculateCompleteness` a lazy `import()` in `brand-agent.ts` to drop the vitality graph from
  static load — error persisted at `init`, so the nanoid importer is in the **always-loaded** part of
  the graph (sources / pdf-ingester / product-matcher / confidence-scorer), not the scoring graph.
  Couldn't pin the exact importer (no agent module imports `ai`/`nanoid` directly).

### Two viable fixes (next session — pick one)
**A. Fix the bundling (recommended first; high-confidence for this pnpm/nanoid symptom):**
   - Add `.npmrc` at repo root: `public-hoist-pattern[]=*nanoid*` (and re-`pnpm install` to flatten
     nanoid into top-level `node_modules` so the Netlify bundler finds it). Remove the now-useless
     `external_node_modules=["nanoid"]` block from netlify.toml.
   - If another `Cannot find module` surfaces after, hoist that too (or `shamefully-hoist=true` as a
     blunt instrument — affects whole build, weigh it).
   - Redeploy, fire a scrape (below), confirm the fn log shows no init error and the job completes.

**B. Chunk the agent for Inngest (no standalone bundling):** break `runBrandAgent` into per-source
   `step.run` chunks each <30 s, run via `/api/inngest` (Next/webpack bundle handles nanoid fine).
   More work; only if A fails. NOTE: Inngest scheduled-fn heartbeats are also broken — see below.

---

## ⚠️ Second systemic issue (separate, also needs fixing)
Netlify **scheduled functions can't load the Inngest client** — log shows
`[documents-queue-tick] inngest.send threw: Cannot read properties of undefined (reading 'send')`.
So the Inngest-based heartbeats (documents, matching, old scraping) silently no-op. Scraping was
moved off Inngest onto the route+background pattern to sidestep this; documents/matching still need it.

---

## Key facts / how to test
- **Prod**: alkatera.com. Netlify project `taupe-stroopwafel-31e3e4`,
  site_id `4c090ce9-db07-49a5-ba4c-ffbaf834ed15`, account_id `68dd12b15f24b4e0067b0dfc`. CLI is linked + authed.
- **`.env.local` points at PRODUCTION Supabase.** Has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.
  Does NOT have `GEMINI_API_KEY` / `INNGEST_*`. **`CRON_SECRET` in .env.local is STALE** — get the live
  value via `netlify api getEnvVars --data '{"accountId":"68dd...","siteId":"4c09..."}'` (parse the key).
  Same trick for `INTERNAL_JOB_HMAC_SECRET` (prod value ~96 chars; local is wrong).
- **Test brand**: Nc'Nean. brand_directory_id `1e520838-d857-46d0-b5ff-ceb41494a500`,
  brand_profile_id `8bc7565e-77d5-46b1-9a6b-18543f9babb3`, a parked job
  `d63c6813-8437-46bf-a726-e1c80edd98c5`. It WAS progressing/58.87; once a scrape completes it should
  capture `carbon_neutral_operations` (already proven to extract) and climb toward Leader.
- **Fire a scrape** (after a deploy): reset the job to `queued`, then POST the route with the live cron secret:
  `POST https://alkatera.com/api/cron/process-scraping-queue` with `Authorization: Bearer <CRON_SECRET>`
  → returns `{"dispatched":N}`. Then watch `scraping_jobs.status` → `complete` and the new
  `brand_directory.sustainability_score`. Check the `scrape-brand-background` function log in the Netlify
  dashboard for init errors.
- **Reference that works**: `netlify/functions/find-websites-background.ts` (same HMAC + supabase + gemini
  pattern, bundles cleanly — its graph just doesn't pull nanoid).
- Recent commits: `ef84bbcf` (nanoid external_node_modules + lazy recalc), `6dce4fbd` (route→bg dispatch),
  `922fe504` (background fn), `301897d8` (gemini timeout), `9c90088a` (inngest concurrency cap),
  `8caceb3e`, `5c6eb99e`, `5cfee8d9`, `2082125f`, `4447b02d` (scoring core).

## Workflow notes
- Push to `main` (Netlify auto-deploys). Watch deploy state via `netlify api listSiteDeploys`.
- Tim prefers UI/buttons over asking him to run CLI; this session he checked Netlify function logs (those
  were essential — the dashboard Functions → scrape-brand-background → Logs shows the exact crash).
