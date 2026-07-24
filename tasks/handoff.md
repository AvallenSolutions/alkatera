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
5. ~~The numbers-don't-change harness.~~ **BUILT 2026-07-24, and REDESIGN REPRODUCES MAIN
   EXACTLY.** Three new files, meant to stay byte-identical on both branches:
   `lib/__tests__/lca-aggregator-golden.test.ts`, `lib/__tests__/fixtures/lca-golden-cases.ts`,
   `lib/__tests__/support/aggregator-harness.ts`. 8 tests, 4 boundary cases (gate / grave /
   shelf-chilled / grave-with-loss). Copied to the redesign worktree and run there: **8/8 pass
   with the numbers unchanged.**
   - **The stated obstacle was wrong.** The calculator is NOT browser-only: there is no
     window/document/localStorage anywhere in `lib/product-lca-calculator.ts`, only a single
     `getSupabaseBrowserClient()` call, and `aggregateProductImpacts` — which is what actually
     produces `aggregated_impacts` — already takes its client as an argument. It needed a
     client, not a browser. No maths extraction and no headless browser were required.
   - Proven by MUTATION on both branches, not by going green: scaling distribution by the loss
     multiplier, dropping the shelf-boundary retail-chilling branch, and a 0.1% packaging drift
     each fail (the last fails 4 tests). Mutating **redesign's own**
     `lib/lca/downstream-stages.ts` also fails, which is how we know its pass was real and not
     vacuous. All mutations reverted; both worktrees clean.
   - Redesign's reorder (downstream stages computed BEFORE the product-loss block, where main
     computed them after) is behaviour-preserving: the loss block only scales scalar running
     totals and never touches `materials`, and both branches add downstream results after
     scaling. There is now a test that pins this rather than an argument that asserts it.
   - **Coverage limit, read before trusting it:** the harness starts from already-resolved
     material rows, so it locks the AGGREGATOR. It does not cover factor resolution in
     `product-lca-calculator.ts` (124 changed lines) or `impact-waterfall-resolver.ts` (72).
     Those remain unproven and are the natural next extension.

## Gotchas and decisions
- **Cutover + the pending recalc together WILL move UK orgs' end-of-life numbers.** Found while
  building the harness. `main` hardcodes `region: 'eu'` in `EndOfLifeStep.tsx`; `redesign`
  derives it via the new `eolRegionForCountry(organizationCountry)`. Both orgs that matter for
  the pending all-orgs recalc are UK (**Happy Curations**, **London Botanical Drinks/Everleaf**),
  so on redesign they default to the UK waste profile instead of the EU one. Measured on the
  golden bottle: **end-of-life +41.8%** (0.00170 → 0.00241 kg CO2e), **headline total +0.14%**.
  Big at the stage level, small at the headline. Stored PCFs do NOT change on their own — this
  only bites when something recalculates. It is arguably a correctness FIX (a UK distillery
  should not carry EU recycling rates), so the action is to expect it and tell Clair, not to
  revert it. The harness passes an explicit region, so it does not catch this by design.
- **A failed freight-factor lookup silently zeroes distribution.**
  `calculateTransportEmissions` throws when the `staging_emission_factors` row is missing, and
  `calculateDistributionEmissions` catches PER LEG and books 0 with only a `console.warn`. So a
  missing factor on staging looks like a plausibly small footprint, not an error. This is
  exactly what happened inside the harness before the factor row was fixtured. Worth checking
  `staging_emission_factors` on the staging Supabase before reading any staging LCA number.
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
- **Warn Clair about the UK end-of-life shift too**, not just the packaging/EPR move already
  listed above. Same conversation, one more number: EoL rises ~42% for UK products once they
  are recalculated on redesign. See the first bullet under Gotchas.
- **Delete the `gaia-query` edge function** in the Supabase dashboard (Edge Functions → gaia-query
  → Delete). Removed from the repo and from CI, but still deployed and served.
- Migrations: the EPR one is APPLIED to prod. Nothing else pending there.
