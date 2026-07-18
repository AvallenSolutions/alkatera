# Handoff: redesign — sustainability report programme
Updated: 2026-07-18 17:00 | Branch: redesign | Worktree: /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign | Dev port: 8896 (`preview_start` name "redesign"); a spare config "redesign-verify" exists when another chat holds the first

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
1. **Steps 2-10 of `tasks/report-sections-plan.md`.** Biggest open correctness gap. Tim's
   original ask (warn when a section's data is incomplete) is step 9 and needs the rest first.
2. **Staging click-through of the whole programme** (needs Tim or staging creds): real prose
   replaces fallbacks, voice switching genuinely changes register, foreword accept, ship a
   PDF through PDFShift, share it. This is the main go-live risk.
3. **Decide what "products confirmed" should mean for a whole-company report** — it still
   means "has a completed LCA" (coverage), which is right for the LCA gate but arguably wrong
   for a company report. Check the corrected metric on a real org (Everleaf), not demo data.
4. Same-family bugs recorded: `hasVineyards` gates the vineyards page with no section check;
   the dashboards' invented fallbacks (livingWageCompliance 50, genderPayGap 0) will disagree
   with the report once sections render (the report is correct); three availability oracles
   (`useReportDataAvailability`, `sectionCompleteness`, `dataAvailability`) want consolidating.
5. Smaller: share-link expiry UI (`expires_at` exists, no picker), screenMode polish audits
   (Board/Editorial), a11y aria-labels on style cards, /uploads rebuild (last pre-studio live
   surface), Tabs->MonoTabs on /settings + /reports/sustainability, delete dead pulse widgets
   (~740 LOC, zero refs).

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
  (a revoked share kept serving until this landed). Fixed here; MAIN still has it in
  `getServiceRoleClient` — spun off as a task chip Tim has started.
- Studio canon: no dark pages, working tones are mono caps and NEVER pills, radius 6, Space
  Grotesk speaks / Inter explains / JetBrains Mono annotates. British English, no em dashes,
  plain language, alka**tera** lowercase.
- Fixed A4 page divs are DELIBERATE (a Chromium spike proved CSS-flow paging fails here).
- Staging is deliberately NO-Inngest: a stray `INNGEST_*` key silently reroutes background
  dispatch into the void. Burned us twice.
- Full `vitest` hangs: always scope (`npx vitest run lib/reports lib/pdf lib/provenance
  components/report-builder`). 187 green at last run; `npx tsc --noEmit` clean.
- The dirty `lib/pulse/__tests__/widget-tier.test.ts` in the worktree belongs to a separate
  task-chip session. Do not touch or commit it.

## Pending Tim actions
- **Staging click-through** (item 2 above). Login tim@alkatera.com / alkatera-staging-2026.
  Vercel Deployment Protection blocks Claude's browser there, so this one needs you.
- **~1 Aug**: Anthropic quota resets, then retest the URL-import scrape on staging. Report
  narratives are GEMINI and are testable on staging NOW.
- **Prod**: 10+ redesign migrations pending (never merged); the two main-branch bug chips
  (stale fetch cache in `getServiceRoleClient`, ambiguous `products!inner` joins) are running
  in your other sessions.

Next session opener: `Read tasks/handoff.md and continue.`
