# Handoff: redesign — studio design system + sustainability report programme
Updated: 2026-07-18 12:30 | Branch: redesign | Worktree: /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign | Dev port: 8891 (preview_start name "redesign")

## Goal
The alkatera redesign ("house of rooms" studio design language) lives on branch `redesign`,
auto-deployed on push to Vercel staging. Current programme: rebuild the DOCUMENT GENERATORS
in the studio design and upgrade sustainability-report customisation (plan:
`tasks/sustainability-report-redesign-plan.md`, phases A–E, Tim-approved order A→B→C→E→D).
A+B are done; **next is Phase E: one studio funnel + real share links**. Redesign NEVER
merges to main until go-live.

## Done (verified)
- **LCA PDF template in studio design** (0ef5f515): faithful implementation of Tim's Claude
  Design project d03d39b6 (`LCA Report Template.dc.html`); 26-page fixture PDF inspected
  page-by-page via headless Chromium (the PDFShift engine).
- **Shared studio PDF kit** `lib/pdf/studio-kit.ts` (99481453): all primitives incl.
  `onBand()` (luminance → ink/cream text on any brand colour). LCA re-render byte-identical.
- **Report Phase A** (99481453+fe49b65a): theme/heroImages/leadership were persisted but
  NEVER read back (placebo picker; forewords/photos never reached PDFs) — fixed + typed;
  dead `config_snapshot` reads removed; SlideSpeak fully retired; generate-html shares
  buildReportConfig.
- **Report Phase B** (4b3a2454, e16e69db, 3710089a, 263a9d55): themes studio-native
  (Annual/Working/Board/Technical/Editorial, ids unchanged); full colour/font sweep; cover,
  foreword, dividers, score panels, closing = brand poster blocks (NO dark pages); dynamic
  section numbers (`__SECTION_NUM__`, appendix '!'/'A' kept); SDG tiles on-brand; zero pills.
- **Five audience-led styles** (8f631439): `lib/pdf/templates/report-styles.ts` — Marketing /
  Customers / Compliance / Investors&Board / Supply-Chain. Style binds theme + legacy
  audience + tier + imagery + ToV + narrative section ORDER + default sections. Renderer
  assembles in the style's arc; FramingStep's primary choice is the 5 styles. Verified:
  investors = landscape brief w/ targets p2, sequential numbering; compliance/marketing OK.
- Earlier today (all verified, see git log): scrape background fix chain (74640aea, 55c9cdec,
  9af65370), beverage illustrations (5ca73b92), studio FieldLabel (7c7a28f8), PulseCard
  studio refactor (c5606339).
- Verification harnesses in session scratchpad (recreate if gone — pattern is simple):
  `render-fixture.ts` (LCA) + `render-sust-fixture.ts` (report; arg = style id or theme id)
  → run `cd WORKTREE && npx tsx <script> <style> out.html`, then headless-chrome
  `--print-to-pdf`, then Read the PDF pages.

## Done (unverified)
- **ToV threading into AI writers** (8f631439): tone param wired into section-narrative +
  exec-summary assistants from both build paths; code compiles, fails gracefully, but NO
  live AI run possible until Anthropic quota resets (~1 Aug). Fixture narratives are static.
- FramingStep style-picker UI: typechecks, never browser-clicked.
- Report generation on staging (real PDFShift run) never exercised post-redesign.

## In flight
Nothing mid-edit. Worktree clean EXCEPT `lib/pulse/__tests__/widget-tier.test.ts` — that is
a SEPARATE task-chip session's work (task_9f49442d); do not touch or commit it.

## Next
1. **Phase E — one funnel + share links** (the big one):
   a. Collapse QuickGenerateDialog + 4-step wizard (`reports/builder`) into ONE studio-native
      flow in the arrival confirm-not-ask idiom: style picker first (5 styles), smart
      defaults prefilled from data + org `report_defaults`, framing statement as the one
      open question, progressive disclosure for the rest. Rebuild the 19 pre-studio
      `components/report-builder/**` files on the studio kit (FieldLabel/Panel/FactList/
      StateChip/PillButton/MonoTabs) as part of this — not a separate restyle pass.
   b. Share links: `report_shares` table (token, report_id, expires_at, revoked_at) +
      public route `app/(public)/report/[token]` serving the screenMode document +
      share/revoke actions on the report card. Migration → post SQL in chat (/migration).
2. screenMode (interactive HTML) restyle to the studio web document; Board/Editorial full
   page audits; risk/opportunity tinted panels purist cleanup; light-brand onBand test.
3. **Phase C** — draft-then-edit narratives: generate into a store BEFORE render, review/edit
   step, per-section regenerate with tone hint, CEO-foreword drafting. Build any time;
   live-test after 1 Aug.
4. **Phase D** — org brand kit (extend `organizations.report_defaults`), imagery library,
   ungate foreword/photos from storytelling audiences, section reorder UI, truthful preview.
5. Design-scout leftovers (scout details in git history of this file): /uploads rebuild (L),
   shadcn Tabs→MonoTabs on /settings + /reports/sustainability (S), delete dead pulse
   widgets FinancialFootprintWidget/MaccChartWidget (~740 LOC, zero refs).

## Gotchas and decisions
- ⚠️ **CWD DISCIPLINE**: shell cwd resets between Bash calls; several commands this session
  accidentally hit the MAIN repo (its report renderer was contaminated + restored via
  checkout). ALWAYS `cd` the worktree or use absolute paths in EVERY file-touching command.
- Push to redesign auto-deploys staging. British English, no em dashes, plain language,
  brand is alka**tera** lowercase.
- Studio canon: no dark pages (poster blocks carry contrast); customer brand colour takes
  the saturated-band slot with `onBand()` contrast; working tones = mono caps, NEVER pills;
  radius 6; Space Grotesk speaks / Inter explains / JetBrains Mono annotates.
- Fixed A4 page divs are DELIBERATE (Chromium spike: canvas bg doesn't paint margins, fixed
  footers land unpredictably). Don't "improve" to CSS flow.
- `generated_reports.audience` CHECK constraint predates styles → style id lives in `config`
  jsonb; legacy audience maps via `resolveReportStyle()` fallback.
- Vercel Deployment Protection is ON for staging: only Tim's browser can drive the app;
  Claude verifies via staging Supabase MCP (project vwhdyqvlgjqmlzmsvaes) + `vercel` CLI
  logs. Staging login tim@alkatera.com / alkatera-staging-2026.
- Staging is deliberately NO-Inngest: never set INNGEST_* env there (a stray key silently
  reroutes background dispatch into the void — burned us twice; memory saved).
- URL-import scrape: fully verified except the final Claude leg — Anthropic key hit its
  monthly cap, resets 1 Aug. No code change needed.
- Full `vitest` hangs — always scope (`npx vitest run lib/pdf` etc). lib/pdf 64/64 green.

## Pending Tim actions
- **~1 Aug (Anthropic quota reset):** reload staging arrival-confirm → scrape should
  complete; generate a styled report → narratives should carry each style's ToV.
- **Any time:** on staging, generate a report and click Download to exercise the new
  template through real PDFShift (works without AI narratives).
- Prod: 10+ redesign migrations pending (never merged); staging Stripe test keys optional.
