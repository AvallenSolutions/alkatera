# Handoff: alkatera v2 — Phase 2 testing on staging
Updated: 2026-07-21 | Branch: merge/main-into-redesign-20260720 (pushes to redesign) | Worktree: `.claude/worktrees/inspiring-varahamihira-baadb0` | Dev port: 8897 (launch config "merge-verify", uncommitted)

## Goal
alkatera v2 = redesign UI + Vercel hosting + the EXISTING Alkatera2 database. Customer
data never moves; the staging Supabase project (`vwhdyqvlgjqmlzmsvaes`) is a disposable
test bed, never promoted. Staging (https://alkatera-staging.vercel.app, auto-deploys
`redesign` on push) is where Tim tests until happy; then the additive migrations go to
Alkatera2, redesign merges to main, DNS moves, Netlify shuts down. Strategy:
`tasks/alkatera-v2-launch-plan.md`. We are in PHASE 2: Tim's room-by-room pass per
`tasks/phase2-test-script.md`, sessions work the punch list at its foot.

## Done (verified)
- **main merged into redesign** (`094cac4d`, 28 commits incl. parametric packaging).
  811 scoped tests, tsc, prod build green; packaging wizard walked in a browser
  (parametric rows in product_materials, no factor search). Divergence with main: 0.
- **Five 20260719* migrations applied to STAGING** and verified (13 endpoints, 3
  gap-fillers, EPR uuid, PCF index, RLS policy); recorded in its migration tracker.
- **Report-sections plan: all 10 steps shipped** (`76cfab11..fb47b6e2`). Five sections
  render with honest skeletons, facilities page new, zero N/A, four phantom
  SECTION_TO_TOPIC ids fixed, one completeness oracle drives document AND funnel.
  Browser-verified on empty org: funnel "0 of 13 measures recorded" rows, generated doc
  contains the People page with the honest line.
- **Demo seeder now self-sufficient** (`6c7dd675`): foundation.ts creates org/
  facilities/products when missing (prod unchanged); seed ran twice on a wiped local
  org, identical counts, second run a no-op.
- **Unauthenticated deep-link bug fixed** (`5405065c`): cold visit to an authed URL
  skeletoned forever (org provider never cleared isLoading when user was null at boot);
  verified logged-out /desk now redirects to /login. This was Tim's staging symptom.
- **Staging account unblocked by hand** (via Supabase MCP): tim@alkatera.com arrival
  marked complete, `is_alkatera_admin=true`, org Avallenspirits set canopy/active
  (was seed/pending, which the payment gate correctly bounced).
- GEMINI_API_KEY added to staging Vercel (Tim) and deployed; env audit found nothing
  else missing that matters (PostHog key absent = harmless console noise).

## Done (unverified)
- Nothing on staging beyond login has been exercised: the demo-seed click, the rooms,
  reports end-to-end with real Gemini + PDFShift are all untested there.
- Report sections against RICH data (only the all-skeleton empty-org case is proven);
  the thin-data mixed state (one demographics row → some tiles real, rest skeletons)
  is the exact case Tim originally asked for and still needs eyes.

## In flight
**A PARALLEL SESSION is building the cellar LCA dossier stream** (commits up to
`aad9f57f`: server-side footprint calc under Inngest, the dossier UI, asks, a share
gate, an Inngest concurrency-cap fix). Its state lives in its own build log
(`tasks/` docs from commits `69b4ee8a`/`15c6d703`). Coordinate before touching
cellar/LCA files; this handoff does not speak for that stream.

Tim is mid Phase 2 setup: just unblocked past /complete-subscription. His next clicks:
refresh staging → desk loads → `/admin/demo-seed` → Seed Drinks Co demo (do NOT run
Recalculate LCAs after) → start the Cellar checklist in `tasks/phase2-test-script.md`.

## Next
1. Work the punch list in `tasks/phase2-test-script.md` as Tim adds items (3 done so far).
2. Thin-data mixed-state report check (add one demographics row, regenerate).
3. If Tim wants the full arrival checkout testable on staging: add a Stripe TEST-mode
   webhook endpoint pointing at the staging URL first.
4. Phase 3 in parallel (see launch plan): goldens harness AFTER Tim's prod recalc;
   migration rehearsal on an Alkatera2 clone; production Vercel project + env parity;
   Inngest registration (mandatory or all 14 crons stop silently); enable RLS with read
   policies on the 11 flagged reference tables; rotate the old prod service-role key.

## Gotchas and decisions
- THE DECIDED PATH: Alkatera2 is production forever; staging DB never promoted. The one
  sanctioned redesign→main merge happens at launch only. Push work to `redesign`.
- Staging is deliberately NO-Inngest (stray INNGEST_* keys strand jobs); production
  cutover REQUIRES Inngest app registration.
- Payment gate: an org with subscription 'pending' outside the arrival ritual bounces
  to /complete-subscription BY DESIGN; on staging unblock via DB (tier+status), never
  by clicking through Stripe.
- Stripe webhook points at prod Netlify; a staging checkout will hang after payment.
  Config gap, not a bug; repoint is a Layer 4 cutover item.
- Anthropic quota exhausted until ~1 Aug: the arrival website scrape on staging fails
  and falls back to manual entry. Expected.
- get_user_bootstrap / get_supplier_context RPCs are absent on staging (prod-only,
  applied ad hoc); code falls back by design, but staging↔prod function drift is real.
- Browser-pane quirks: viewport can collapse to 0x0 (fix: resize_window desktop, then
  dispatch a resize event); Radix components need full pointerdown→click sequences;
  the app scrolls <main>, not the window. Never bare `npx vitest run` (hangs) — scope.
- Worktree dirty-by-design, do NOT commit: `.claude/launch.json` (merge-verify :8897),
  `tsconfig.json` (Next auto-edit), `.env.local` (local-only Supabase demo keys).
- Local DB hand-tweaks this session: dev@local.test is admin, its metadata org points
  at Local Dev Co, local Avallenspirits arrival completed, local demo org fully seeded.
- Seeder foundation quirk: advancing the products id sequence uses throwaway inserts
  (PostgREST cannot setval); gated so it never runs where products already existed.

## Pending Tim actions
- Refresh staging; seed the demo org; walk `tasks/phase2-test-script.md`, adding one
  punch-list line per issue.
- Staging Supabase Auth → URL Configuration → Add URL:
  `https://alkatera-staging.vercel.app/**` (redirect allow-list was empty).
- Phase 3, when ready: run the all-orgs recalc on PROD (/admin-tools/recalculate-lca,
  Happy Curations then Everleaf, warn Clair first) BEFORE we snapshot goldens; delete
  the gaia-query edge function in the prod Supabase dashboard.

Next session opener: `Read tasks/handoff.md and continue.`
