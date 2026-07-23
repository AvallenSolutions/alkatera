# Handoff: main → redesign cutover prep, Rosa, and the demo seed
Updated: 2026-07-19 21:10 | Branch: claude/tasks-handoff-continue-dece9a (pushes to main) | Worktree: `.claude/worktrees/tasks-handoff-continue-dece9a` | Dev port: 8893 (add a config to `.claude/launch.json`, revert it before committing)

## Goal
Prepare the move from the current production alkatera (branch `main`, hosted on **Netlify**,
serving paying customers) to the redesign (branch `redesign`, hosted on **Vercel** at
**https://alkatera-staging.vercel.app**, against the `alkatera-staging` Supabase project).
This is THREE simultaneous changes: app code, hosting platform, and database schema. Along the
way this session also consolidated Rosa, closed her feedback loop, and filled the demo seed so
there is something to click through.

**Read this first: the redesign is on VERCEL, not Netlify.** I got that wrong twice and it
invalidated a whole plan. `redesign` has `vercel.json` and has DELETED `netlify.toml` and the
entire `netlify/` directory. Vercel is staging-only for now; production stays on Netlify.

## Done (verified)
All pushed to main. Working tree clean at `b0a041d0`.
- **LCA boundary normalisation** (`fc43a631`). `normaliseBoundary()` in `lib/system-boundaries.ts`;
  an unnormalised stored boundary was collapsing cradle-to-grave studies to the 10 base steps,
  silently dropping Distribution/Use/EoL. Proved with 3 failing tests first, then browser-verified.
- **House copy style** (`e7283900`) `lib/copy-style.ts`, and **Rosa single source** (`5b4ab5a2`)
  `lib/rosa/persona.ts`. Rosa was defined in 8 places, 2 of them dead. Full detail:
  `tasks/rosa-single-source-plan.md`.
- **Rosa feedback loop** (`c218e55d`) + **learning surface** (`582de1c5`) at `/admin/rosa-learning`.
  Verified end to end against local Supabase: correction → `rosa_memory` → back into the prompt.
- **Fixed 4 long-failing test suites** (`ccccef3f`). Verified by MUTATION, not by going green.
- **gaia-query edge function removed** (`d85a2792`) after proving it unused five ways.
- **Migration collision fixed on main** (`8550d30d`). Four collisions, renumbered to
  `20260719100000`-`130000` + `20260622120001`. Ordering provably unchanged. See
  `tasks/main-to-redesign-sync.md`.
- **EPR migration APPLIED TO PROD** and verified: `epr_submission_lines.product_material_id`
  bigint → uuid. Proved the fix with a real `product_materials.id` insert into a structural clone.

## Done (unverified)
Do not trust these without exercising them.
- **The demo seed's four new modules** (`f11351bc`: hospitality, EPR, reports, Rosa) have been run
  against LOCAL Supabase only, never against prod. Idempotency verified locally (identical counts
  over two runs). Nobody has clicked `/admin/demo-seed` on prod since.
- **The EPR DRS zero-rating fix** (`f11351bc`). The coercion bug is proven (`Number('2025-26')` is
  NaN), and the corrected guard verified in isolation, but no real submission has been generated.
- **Production-sites seeding** (`fd74af62`). Insert shape verified against the real schema, but the
  full seeder cannot run locally (it needs prod product ids 130-236).

## In flight
Nothing mid-edit. The scheduled-jobs diff is **DONE** — full report at
`tasks/netlify-to-vercel-jobs-diff.md`. Its premise turned out to be false; read the report
before planning anything about background jobs.

## Next
1. **Reissue the Vercel connector token** (Tim) — see Pending. Everything else about Vercel is
   blocked on it.
2. ~~The netlify → vercel scheduled-jobs diff.~~ **DONE 2026-07-21, and the fear was unfounded.**
   Redesign moved every heartbeat into the Inngest function definitions as native `{ cron: ... }`
   triggers, so `vercel.json` having no `crons` key is correct. All 16 scheduled jobs and all 7
   background functions have equivalents; nothing stops. Full table in
   `tasks/netlify-to-vercel-jobs-diff.md`.
   **The replacement task is an Inngest environment check.** Both branches are
   `new Inngest({ id: 'alkatera' })`. If Vercel staging gets the PRODUCTION Inngest keys, Inngest
   re-points every production function URL at the staging deployment, silently. Give staging a
   Branch-environment key pair, and confirm in the Inngest dashboard which environment `alkatera`
   is synced to. One dashboard look settles it.
3. ~~Redesign's own migration duplicate.~~ **ALREADY RESOLVED before this list was written:**
   the local-dev squash (`7095a97b`, on redesign) moved `20260714200000_chemical_library_user_submissions.sql`
   into `supabase/migrations_archive/`. No duplicate timestamps remain on either branch.
4. ~~Merge main → redesign.~~ **DONE, twice.** The big merge happened 20 Jul (`094cac4d` on
   redesign, 28 commits incl. parametric packaging, so the "silent LCA revert" cutover risk
   below is closed). The last 3 straggler commits (email delivery visibility) merged 23 Jul
   (`ff0fcbc2`); the incoming migration renumbered to `20260721110000` to clear
   `pcf_end_use_scenarios` on staging. Divergence 0. Redesign's `tasks/handoff.md` is now the
   live handoff; treat this file as historical.
5. **The numbers-don't-change harness.** Extend `lib/__tests__/packaging-parametric-golden.test.ts`:
   snapshot prod's stored `aggregated_impacts` per completed PCF, assert redesign reproduces them.
   Obstacle: the calculator is browser-only, so this needs the pure maths extracted or the recalc
   tool driven headlessly. This is what makes a cutover provable rather than hopeful.

## Gotchas and decisions
- **I assumed the hosting platform twice and was wrong both times.** First I audited Netlify
  exhaustively and concluded "no deployment exists"; it was on Vercel. Then the Vercel API 404'd
  and I inferred the project lived elsewhere; it does not. VERIFY the platform before planning
  against it, and when something is absent say "I cannot see it" rather than "it does not exist".
- **The Vercel MCP token is project-scoped and predates `alkatera-staging`.** It returns exactly
  4 projects (agentos 2 Jul, healthyhospo 4 Jul, founder-os 10 Jul, hayle-council 11 Jul);
  `alkatera-staging` was created 18 Jul and 404s by team id, team slug, project slug AND
  deployment hostname. Not an account boundary, a token scope.
- **Cutting over today would silently revert the LCA engine.** `redesign` does NOT have main's
  parametric packaging work: no `lib/calculations/packaging-factor.ts`, no
  `PackagingMaterialClassPicker`, no golden test. Packaging would compute the old fuzzy-matched
  way and every customer's numbers would shift back. This is the single biggest cutover risk.
- **Sequence matters: run the recalc BEFORE porting.** Otherwise you cannot tell recalc drift from
  redesign drift, and there are three number-states in play at once.
- **Two deployments, one Inngest app id.** `id: 'alkatera'` on both branches. Inngest keys are the
  only thing keeping staging out of production's function registry. Treat the Inngest env vars on
  Vercel as a production-safety control, not config.
- **Wiki→Rosa sync changes cadence at cutover**, from once per successful deploy to every 6 hours.
  Only behavioural regression found in the jobs diff. Small, but tell whoever edits the wiki.
- **Prod assigns its own migration timestamps at apply time** and matches by name, never by repo
  filename. That is why the duplicate versions never bit prod, and why the renumbering needs
  nothing re-applied anywhere.
- **Do NOT run Recalculate LCAs after seeding the demo org.** The seed writes completed PCFs
  directly; a recalc would skip all 7 and the admin page used to wrongly tell you to run it.
- `gaia_knowledge_base` is SHARED across every org. Never write customer-derived text into it.
- Local dev = LOCAL Supabase. Never bare `npx vitest run` (it hangs); always scope to files.

## Pending Tim actions
- **Reissue the Vercel connector token** with full-account scope, or add `alkatera-staging` to the
  existing token's project list. Until then the Vercel API is useless to a session.
- **Run the all-orgs recalc** at `/admin-tools/recalculate-lca`. It acts on the ACTIVE org, so
  switch org then click; it runs in the browser so keep the tab open. Only two orgs matter:
  **Happy Curations Ltd (16 products)** and **London Botanical Drinks / Everleaf (3)**. The rest
  skip for want of facility allocations. Do Happy Curations first, check one report, then Everleaf.
  Warn Clair first: packaging goes UP, EPR tonnage down ~24x on shared cases, and she may have
  published those numbers.
- **Click `/admin/demo-seed` → Seed Drinks Co demo** on prod to load the new breadth data.
- **Delete the `gaia-query` edge function** in the Supabase dashboard (Edge Functions → gaia-query
  → Delete). Removed from the repo and from CI, but still deployed and served.
- Migrations: the EPR one is APPLIED to prod. Nothing else pending there.
