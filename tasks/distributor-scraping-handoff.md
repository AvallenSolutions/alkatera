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

## ✅ BLOCKER FIXED & VERIFIED IN PROD (2026-06-05, commit `e5be2061`)
**True root cause** (found via esbuild `--metafile`): the import chain
`extractors/html-to-text.ts → sanitize-html → postcss → require('nanoid/non-secure')`.
sanitize-html dragged the whole postcss CSS parser into a *scraper*; postcss has a
nested `require('nanoid/non-secure')`. Netlify's zip-it-and-ship-it bundler externalised
that nested require and then couldn't copy `nanoid` through pnpm's symlinked
`node_modules` → `Runtime.ImportModuleError` at init.

**What didn't work:** removing `external_node_modules=["nanoid"]` from netlify.toml
(commit `fb115fee`). It fixed *local* esbuild (which inlines nanoid) but Netlify's
bundler still externalised the require nested inside postcss. Deploy still crashed.

**The fix:** rewrote `html-to-text.ts` to strip HTML→text with a dependency-free regex
pass (it only ever needed tag removal, not a CSS parser). That deletes the entire
sanitize-html→postcss→nanoid chain from the function bundle. sanitize-html stays
installed for `app/blog/[slug]/page.tsx`, which legitimately needs it.

**Verified in prod** (function log, 13:42): Nc'Nean job `d63c6813…` ran the full agent
(~64s, all Gemini calls) → `status: 'complete', written: 9`. No ImportModuleError.

**Minor follow-up (not a blocker):** two other jobs that same run finished
`status: 'error', written: 0` after only a category-detect call — i.e. the function
loads fine but those brands had no usable source (likely missing/failed website).
Worth a glance at which brands and why, but it's normal per-brand operational outcome,
not the bundling crash.

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
