# Handoff: redesign staging + arrival flow + design-system adoption
Updated: 2026-07-17 21:15 | Branch: redesign | Worktree: /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign | Dev port: 8891 (or 8895 redesign-verify)

## Goal
The alkatera redesign (studio "house of rooms") lives on branch `redesign`, deployed to a Vercel STAGING project so Tim can test against real integrations. We just rebuilt the new-user arrival ritual (org creation folded in, website-first) and are now adopting Tim's canonical **Claude Design system** (project id `dcd0e757-0ba1-4f98-aae3-b114fee7cd6a`, "Alkatera Redesign Design System") so surfaces stop being "old forms recoloured". Redesign NEVER merges to main until go-live.

## Staging environment (LIVE)
- URL: https://alkatera-staging-git-redesign-avallen-solutions.vercel.app (Vercel project `alkatera-staging`, team avallen-solutions, deploys `redesign` on every push)
- Login: tim@alkatera.com / `alkatera-staging-2026` (org-less, so it hits the arrival ritual). Confirmed working.
- Supabase staging: ref `vwhdyqvlgjqmlzmsvaes` (fresh, eu-west-2). Full schema (356 tables, 59 migrations), roles seeded, `create-organization` edge fn deployed (verify_jwt=false). Vercel env set: staging Supabase + Anthropic + Gemini + OpenLCA + Google Maps + PDFShift + Resend. NO Inngest (deliberate), NO Stripe test keys yet.
- Diagnose staging DB / deploy edge fns via the Supabase MCP (project vwhdyqvlgjqmlzmsvaes). Read Vercel build/runtime logs via the local `vercel` CLI (authed) — the Vercel MCP connector is scoped to 4 old projects and 404s alkatera-staging.

## Done (verified)
- Data-revolution + onboarding programme + Vercel platform-neutralisation (Inngest-everywhere, Netlify removed) all committed on redesign; builds + deploys clean on Vercel.
- Arrival front door (2c73989d): org-less user lands in "Where can we find you?", org created silently, 6-step flow to desk. Walked live on staging past org creation.
- Custom hairline beverage icons replaced emojis (831c4ef8); confirm step redesigned (fact-list, confirmed rows). Verified on staging.
- Duplicate migration version fixed (1825939c): `trial_tier_limits` shared version 20260622120000 with drop_pulse_beta_flag — that collision is what left every fresh `supabase db reset` empty. Now 20260622120001. (This is why staging needed a brand-new Supabase project; the old repurposed one was un-cleanable due to Postgres lock exhaustion on the reset.)

## Done (unverified / BROKEN)
- **Website scrape still FAILS on staging.** Diagnosed: `app/api/products/import-from-url/route.ts` runs the scrape INLINE via `await runImportFromUrl` (no Inngest on staging), holding the POST open ~60-120s → job stranded → 20-min janitor in `[jobId]/route.ts` marks it "took too long". THE FIX (not shipped): return jobId immediately, run the scrape in the background via `unstable_after` from next/server (repo is Next 14.2.5), passing a SERVICE-ROLE client (mirror `service()` in lib/inngest/functions/product-import.ts), keep `export const maxDuration = 300`. Keep the Inngest branch for when INNGEST_EVENT_KEY is set.

## In flight — UNCOMMITTED changes exist, REVIEW FIRST
`git status` (ignore supabase/.temp) shows modified: `app/api/products/import-from-url/route.ts`, `lib/inngest/functions/product-import.ts`, `components/onboarding/steps/beverage-icons.tsx`, `package.json`, `pnpm-lock.yaml`; untracked `public/assets/drinks/*.svg` (Tim's 18 brand illustrations, copied from ~/Downloads/"Alkatera Website Redesign (1).zip") and `tasks/lca-verifier-backup.json`. `git diff` these before trusting — likely a partial/orphaned start of the scrape fix + illustration swap. Decide keep vs discard, then finish jobs 1-2 below.

## Next
1. Finish the **scrape background fix** (unstable_after + service client, per above); verify on staging (submit avallenspirits.com, watch product_import_jobs go completed).
2. Swap the beverage selector to Tim's illustrations in `public/assets/drinks/` (beer→beer-glass, cider→cider-apple, spirits→spirits-bottle, wine→wine-glass, rtd→soda-can, non_alcoholic→non-alcoholic, functional→functional) as `<img>` in a fixed square box, object-contain; replace the custom-SVG BeverageIcon set. Commit + push (auto-deploys).
3. **THE BIG ONE — adopt the Claude Design system** (project `dcd0e757-...`). Use the `DesignSync` MCP tool (read: list_files/get_file) + `/design-sync` skill. Contains tokens/ (colors,typography,spacing,motion,effects css), components/core/ (Button,Panel,FactRow,BigNumber,StateChip,Tabs,StageBar,AccentPanel as jsx+.d.ts+.prompt.md), components/growth/ (GrowthField), assets/ (marks + species illustrations + logo). Read SKILL.md + readme.md in the project first (SKILL.md already read: gallery not dashboard; one saturated block; hairlines not boxes; statements end with full stop; wordmark lowercase alka+**tera**; tabular numbers with mono label; ease cubic-bezier(0.2,0.8,0.2,1)). Plan: pull tokens first, reconcile with existing components/studio/, refactor surfaces starting with the arrival forms. Do NOT wholesale-replace; incremental, one component at a time.

## Gotchas and decisions
- Design rules in memory (feedback_no_emojis_custom_graphics): NEVER emojis, always custom graphics; redesign don't recolour. Palette: paper #ECEAE3, cream #F2F1EA, hairline #D9D6CB, ink #1A1B1D; rooms forest #205E40 / cobalt #2B46C0 / ochre #DFA32B (ink text always) / brick #BF4B2A. Never coloured text on coloured blocks; one saturated block per surface.
- Vercel CLI file-upload deploys ("Upload aborted") fail for this big repo — deploy via git push only.
- Never point staging at production Supabase; Stripe on staging must be TEST keys (live = real charges); do NOT copy prod Inngest keys (hijacks prod's Inngest app).
- Push to redesign auto-deploys staging. British English, no em dashes, plain language.

## Pending Tim actions
- 10+ migrations + arrival/design work PENDING PROD (redesign never merged). See tasks/data-revolution-plan.md build log.
- Staging Inngest env + Stripe test keys optional for fuller staging (scrape fix in job 1 removes the Inngest need for the scrape).
- Pre-existing prod bugs as task chips: staging_emission_factors RLS regression (fixed on main, prod run pending); admin routes stale fetch-cache.
