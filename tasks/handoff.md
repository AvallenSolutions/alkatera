# Handoff: redesign — main merged in (2026-07-20) + sustainability report programme
Updated: 2026-07-20 | Branch: redesign (merge landed via `merge/main-into-redesign-20260720`) | Worktree: `.claude/worktrees/inspiring-varahamihira-baadb0`

## THE STRATEGY (decided 2026-07-20, read `tasks/alkatera-v2-launch-plan.md` first)
alkatera v2 = redesign UI + Vercel hosting + the EXISTING Alkatera2 database.
Customer data never moves; the staging Supabase project is a disposable test bed,
never promoted. Staging is where Tim tests until happy; at launch the additive
migrations are applied to Alkatera2, redesign merges to main, Vercel production
points at Alkatera2, DNS moves, Netlify shuts down after a watch week.
STATUS: the five 20260719* migrations are APPLIED AND VERIFIED on staging
(2026-07-20, via SQL editor, recorded in the tracker) — the packaging picker and
LCA calculation now work there. Next per the plan: seed staging (`/admin/demo-seed`),
real GEMINI/PDFShift/Stripe-test keys into the staging Vercel env, then the
report-sections stream.

## NEW: main → redesign merge (2026-07-20)

All 28 main-only commits (last two weeks of production fixes) are now on redesign.
Merge base was `0132d992` (2026-07-16); 23 files conflicted and were resolved by hand.
Full analysis and the cutover test plan: `tasks/cutover-test-plan.md`.

What came across cleanly (whole-subsystem adds):
- **Parametric packaging factors** (`257adce8`): `lib/calculations/packaging-factor.ts`,
  `PackagingMaterialClassPicker`, material classes + golden test. This was THE cutover
  blocker (numbers would have silently reverted to fuzzy matching).
- **Rosa persona single source** `lib/rosa/persona.ts`, **house copy style** `lib/copy-style.ts`,
  the LCA boundary normalisation (`normaliseBoundary`, verified wired in WizardContext),
  auth fixes, the ~64-route fetch-cache fixes, ISO 14044 gate + Monte Carlo, demo-seed
  breadth modules, and migrations `20260719100000`–`140000`.

Conflict resolutions worth knowing:
- **Rosa surfaces**: kept REDESIGN's implementations (feedback verdicts →
  `rosa_message_feedback`, learning cases/exemplars page, `system-prompt.ts` base prompt,
  which already carries the "never say AI" rules and is byte-shared with the eval harness).
  Adopted main's injection-hardened `buildRosaPageContextBlock` (persona.ts) for page
  context in the chat route. Main's `buildRosaChatPersona` is NOT used by the chat route;
  persona.ts still serves pulse commentary, anomaly explains and gaia. Follow-up worth
  doing: compose `system-prompt.ts` from persona.ts blocks so the persona text isn't in
  two places again.
- **Packaging**: parametric picker wins in `PackagingFormCard`; removed redesign's
  packaging auto-match/auto-proxy effect (it belonged to the retired fuzzy model and would
  fight the endpoint-derived factors). Ingredients keep their auto-match.
  `PackagingWizard` keeps redesign's `makePackagingRow` builder + main's parametric-first
  `handleComplete`.
- **Slidespeak routes + Sidebar.tsx**: kept redesign's deletions (main's edits were only
  fetch-cache opt-outs; `/admin/rosa-learning` is linked from admin-tools, so no nav loss).
- **Reports/PDF**: kept redesign's studio implementations; verified main's fixes are
  natively covered (`route-auth.ts` has noStoreFetch, render-lca-html has the 0.316/0.326
  reconciliation, no neon).
- Cron routes (detect-anomalies, generate-insights): redesign's sweep-helper structure +
  main's noStoreFetch added to the raw clients.

Verified after the merge: `tsc --noEmit` clean; scoped vitest 811 tests green
(packaging golden + factor + classes, copy-style, prompt-house-style, rosa, reports,
provenance, pdf, report-builder, calculations, epr, products); production build green.

Known deltas to carry:
- **Demo-seed Rosa module writes `gaia_feedback`** (main's table) but redesign's
  /admin/rosa-learning reads `rosa_message_feedback` + learning cases, so a seeded org
  won't fully light that page up. Decide whether to point the seeder at the redesign
  tables.
- Main's "remember this correction" feedback flow (free text + org-memory write) was NOT
  ported; redesign's verdict chips are the shipped UX. The `saveMemory` select-then-write
  fix IS on redesign (auto-merged).
- **Staging migrations**: `supabase db push` against alkatera-staging will now apply the
  five `20260719*` migrations (fresh versions, no collisions — the old
  `20260717*` collision was defused by main's renumbering; the rumoured redesign-side
  `chemical_library_user_submissions` duplicate does not exist).
- **Prod cutover**: ALL scheduling on redesign is Inngest-native crons (14 jobs). Vercel
  prod MUST be registered as an Inngest app (INNGEST_EVENT_KEY + SIGNING_KEY, serve URL
  /api/inngest) or every scheduled job stops silently. Staging deliberately stays
  NO-Inngest.

## Goal
The alkatera redesign ("house of rooms" studio design language) lives on branch `redesign`
and auto-deploys to Vercel staging on push. The current programme rebuilt the document
generators in the studio design and upgraded sustainability-report customisation (plan:
`tasks/sustainability-report-redesign-plan.md`, phases A-E). **All five phases are shipped.**
Work now in flight: making the social and value-chain report sections actually render, with
honest "not yet measured" gaps (plan: `tasks/report-sections-plan.md`). Redesign NEVER merges
to main until go-live.

## Done (verified — all walked in a browser on LOCAL, against Local Dev Co)
- **Phase A+B** (99481453, 4b3a2454, 8f631439): theme picker was a placebo (forewords and
  cover photos never reached PDFs); themes made studio-native; five audience-led styles.
- **Phase E** (78bd38f4): one confirm-not-ask funnel replacing the 4-step wizard and Quick
  Generate (19 files, ~7k LOC deleted); real share links (`report_shares` + private bucket +
  `/report/[token]`), gated at creation so issued links keep working.
- **Phase C** (0465fad0): draft-then-edit narratives. Reports park as `draft`, narratives
  draft into `data_snapshot`, the funnel gains a review step (inline edit flips the AI flag
  server-side, per-block regenerate with a tone hint, voice override, CEO-foreword accept).
  Unreviewed AI text prints a small "AI-assisted draft" note; edited text prints clean.
- **Phase D** (5c601edd): brand kit tab (logo, colours, foreword author, image library,
  merge-written into shared `report_defaults`); named imagery slots replacing heroImages
  indices with legacy fallback; theme is the single look authority for imagery; running-order
  chevrons + per-section scopes (picked SKUs, trends year range); truthful preview reviving
  the orphaned `/api/reports/preview` behind a sandboxed iframe.
- **Confirmed-data gate** (37777b31): it sat on the two PDF routes only, so HTML ship, public
  share links and three exports bypassed it. Fixed the METRIC first because widening a broken
  lock would have locked customers out: areas with NO records are now excluded from the
  weighting instead of scoring 0% (this capped a no-facilities org at 65% against an 80%
  threshold FOREVER); archived products no longer inflate the denominator; parametric
  packaging counts as confirmed. LCA publishing is now scoped to that product's materials,
  not catalogue coverage. Demo org 17% -> 29%, still blocked but for fixable reasons.
- **Report sections step 1/10** (372c4f6e): `lib/reports/sections/types.ts` owns the five
  payload interfaces; nullability tightened (tsc immediately found six unguarded `.toFixed()`
  that would throw once these sections render); notMeasured* skeleton helpers added.

## Done (unverified — do not trust these)
- **Nothing in the whole programme has been exercised on STAGING.** Local has no GEMINI key
  and no PDFShift, so every narrative seen so far is the deterministic fallback and no PDF has
  ever been produced end to end. Tone-of-voice threading, real prose quality, and the PDFShift
  run are all unproven.
- Migrations `20260718120000_report_shares` and `20260718150000_report_draft_status` are
  applied to LOCAL + STAGING, not prod (correct: redesign never merged).
- ~~The merged packaging UI has not been walked in a browser yet.~~ WALKED 2026-07-20
  against local Supabase (dev port 8897, config "merge-verify"): created a product,
  ran the guided packaging wizard (glass bottle + aluminium screw cap + paper label),
  and verified in product_materials that all three rows saved with
  packaging_material_class set (glass/flint, aluminium, kraft),
  data_source='parametric', match_status='verified' and catalogue circularity
  defaults applied. No factor search appeared anywhere. Test product deleted after.
  Still unwalked: a full LCA calculation over parametric rows in the wizard
  (the golden test covers the maths; a real calc needs ingredients + facility
  allocations).

## In flight
**Report sections: render them, be honest about gaps.** Plan at `tasks/report-sections-plan.md`
(10 ordered steps, each independently green). Step 1 shipped; steps 2-10 remain and step 3
(six fetcher modules) is the bulk. Nothing is mid-edit; the tree is clean.

THE FINDING behind it: `assembleReportData` never fetches people / governance / community /
suppliers / facilities data, the page renderers early-return empty, and the sections are
skipped because `dataAvailability.hasX` is never set. So ticking People & Culture yields a
report with NO such page, silently, while the funnel says "Data ready". Facilities has no
renderer at all. Predates Phase C. Four more silent failures found while planning, all
scheduled in the plan: `SECTION_TO_TOPIC` points at topic ids that do not exist (materiality
callouts can never appear on governance/community/supply-chain); `renderTargetsPage` reads
never-populated `data.governance`, so EVERY report ever generated says "No climate
commitments have been recorded yet"; `app/api/reports/preview-data` counts four nonexistent
tables with zero callers; `app/api/reports/sample` passes 0-1 where the renderer wants 0-100.

## Next
1. ~~Browser walk-through of the merged packaging flow~~ DONE 2026-07-20 (see Done
   section). Remaining slice: a full LCA calc over parametric packaging in the wizard.
2. **Steps 2-10 of `tasks/report-sections-plan.md`.** Biggest open correctness gap. Tim's
   original ask (warn when a section's data is incomplete) is step 9 and needs the rest first.
3. **Staging click-through of the whole programme** (needs Tim or staging creds): real prose
   replaces fallbacks, voice switching genuinely changes register, foreword accept, ship a
   PDF through PDFShift, share it. This is the main go-live risk.
4. **Decide what "products confirmed" should mean for a whole-company report** — it still
   means "has a completed LCA" (coverage), which is right for the LCA gate but arguably wrong
   for a company report. Check the corrected metric on a real org (Everleaf), not demo data.
5. Same-family bugs recorded: `hasVineyards` gates the vineyards page with no section check;
   the dashboards' invented fallbacks (livingWageCompliance 50, genderPayGap 0) will disagree
   with the report once sections render (the report is correct); three availability oracles
   (`useReportDataAvailability`, `sectionCompleteness`, `dataAvailability`) want consolidating.
6. Smaller: share-link expiry UI (`expires_at` exists, no picker), screenMode polish audits
   (Board/Editorial), a11y aria-labels on style cards, /uploads rebuild (last pre-studio live
   surface), Tabs->MonoTabs on /settings + /reports/sustainability, delete dead pulse widgets
   (~740 LOC, zero refs), compose `lib/rosa/system-prompt.ts` from persona.ts blocks.

## Gotchas and decisions
- ⚠️ **CWD DISCIPLINE**: the shell cwd resets between Bash calls and silently lands in the
  MAIN repo. It bit twice this session (a tsc run and a grep both reported on main). `cd` the
  worktree in EVERY Bash call, and prefer absolute paths in file tools.
- ⚠️ **Verify scripted edits.** Several `python3` search-and-replace edits on the handoff
  silently no-oped because the anchor text had already changed, while still printing
  "updated". Use the Edit tool (which fails loudly on a miss) or assert the match.
- ⚠️ **kg vs tonnes**: `facility_emissions_aggregated.total_co2e` is in KG; every other figure
  in the renderer is tonnes. The facilities page must divide by 1000, guarded on the `unit`
  column, or one site publishes at 1000x the whole company. Highest-consequence line left.
- Browser-pane synthetic clicks do NOT register on these React buttons (positions verified
  correct); `element.click()` via `javascript_tool` works and proves the handlers. The app
  scrolls `<main>`, not the window, so scroll via JS or `scroll_to`.
- `report-shares` bucket mime allowlist matches EXACTLY: upload as plain `text/html`, no
  charset suffix. Shares are served THROUGH the server from a PRIVATE bucket so revocation
  really cuts access; never move them to the public report-assets bucket.
- Raw `createClient` calls need the no-store fetch override or Next 14 serves stale reads
  (a revoked share kept serving until this landed). Main's ~64-route sweep is now merged in.
- Studio canon: no dark pages, working tones are mono caps and NEVER pills, radius 6, Space
  Grotesk speaks / Inter explains / JetBrains Mono annotates. British English, no em dashes,
  plain language, alka**tera** lowercase.
- Fixed A4 page divs are DELIBERATE (a Chromium spike proved CSS-flow paging fails here).
- Staging is deliberately NO-Inngest: a stray `INNGEST_*` key silently reroutes background
  dispatch into the void. Burned us twice. (Prod is the opposite: Inngest registration is
  mandatory or all 14 crons stop — see the merge section above.)
- Full `vitest` hangs: always scope (`npx vitest run lib/reports lib/pdf lib/provenance
  components/report-builder`). 811 green across the merge-touched suites at last run;
  `npx tsc --noEmit` clean.

## Pending Tim actions
- **Staging click-through** (item 3 above). Login tim@alkatera.com / alkatera-staging-2026.
  Vercel Deployment Protection blocks Claude's browser there, so this one needs you.
- **Push staging migrations**: after this merge deploys, run `supabase db push` against
  alkatera-staging (or paste the five `20260719*` files in the SQL editor) so the packaging
  endpoint tables exist there — `lib/calculations/packaging-factor.ts` queries them.
- **~1 Aug**: Anthropic quota resets, then retest the URL-import scrape on staging. Report
  narratives are GEMINI and are testable on staging NOW.
- **Prod**: 10+ redesign migrations pending (never merged); the two main-branch bug chips
  (stale fetch cache in `getServiceRoleClient`, ambiguous `products!inner` joins) are running
  in your other sessions.

Next session opener: `Read tasks/handoff.md and continue.`
