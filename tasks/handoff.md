# Handoff: redesign — studio design system + sustainability report programme
Updated: 2026-07-18 16:15 | Branch: redesign | Worktree: /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign | Dev port: 8896 (preview_start name "redesign"); a second config "redesign-verify" exists for sessions locked out of the first (harness may shift its port)

## Goal
The alkatera redesign ("house of rooms" studio design language) lives on branch `redesign`,
auto-deployed on push to Vercel staging. Current programme: rebuild the DOCUMENT GENERATORS
in the studio design and upgrade sustainability-report customisation (plan:
`tasks/sustainability-report-redesign-plan.md`, phases A–E, Tim-approved order A→B→C→E→D).
**ALL FIVE PHASES (A+B+C+D+E) ARE DONE — the report programme is complete.** Next work is
staging click-throughs, the provenance-gate decision, and the design-scout leftovers.
Redesign NEVER merges to main until go-live.

## Done (verified)
- **Confirmed-data gate fixed + widened (37777b31), verified live.** The gate only sat on the
  two PDF routes, so HTML ship, PUBLIC share links, investor summary, regulatory index and the
  ISO 14064 worksheet all bypassed it. Fixing the METRIC came first because widening a broken
  lock would have locked real customers out:
  (a) areas with NO records are excluded from the weighting and the rest renormalised, instead
      of scoring 0% — this capped a no-facilities org at 65% against an 80% threshold FOREVER,
      with no blocker shown for the area responsible (the v1 comment predicted it);
  (b) archived products no longer inflate the catalogue denominator (archived_at, NOT is_draft);
  (c) PARAMETRIC packaging counts as confirmed (derived factors leave matched_source_name null
      by design, so the old test pinned packaging near zero for the model we are moving to).
  LCA publishing is now scoped to THAT product's materials (checkProductProvenanceGate), not
  catalogue LCA coverage. Drafting + preview stay ungated. useProvenanceGate surfaces the
  blockers in the funnel BEFORE drafting, and turns any gated route's 403 into the studio
  dialog. Demo org moved 17% -> 29% and is still blocked, but for fixable reasons with a 100%
  ceiling. 187 vitest, tsc clean, no migration.
  ⚠️ OPEN QUESTION for Tim: "products confirmed" still means "has a completed LCA" (coverage),
  not "the data behind it is confirmed". That is the right shape for the LCA gate now, but for
  the whole-company report the honest question is arguably "is the data behind THIS report's
  numbers confirmed". Worth revisiting before go-live.
- **Phase D SHIPPED (5c601edd), verified live on local.** Brand kit tab on the report hub
  (logo + colours + foreword author + reusable image library; merge-writes ONLY the
  branding/imageLibrary keys of shared report_defaults; logo mirrors organizations.logo_url).
  Named imagery slots (cover/divider1/divider2/people) replace heroImages indices with a
  render-time legacy fallback; theme = single look authority (leadership page + foreword
  drafting ungated from tier: Customers + Supply-chain gain both; Investors/Compliance stay
  imagery-free). Running-order chevrons materialise config.sectionOrder (renderer + review +
  preview all prefer it; renumbering stays sequential); per-section scopes (products pcfIds,
  trends year range) typed in config jsonb, precedence scope > reportYears > fallback; NO
  migration. Truthful preview: the orphaned /api/reports/preview real-render route revived
  (route-auth + no-store + products scope + a pinned no-AI invariant) behind a collapsed
  panel with a sandboxed srcDoc iframe, manual refresh and a "Preview is behind" chip.
  Verified: kit saves/seeds, cover from library, custom order in preview AND shipped share
  doc, leadership page with kit author, legacy share byte-stable. 127 vitest, tsc clean.
  NOTE: local demo library entry (rosa-the-dog URL) seeded in LOCAL DB only.
- **Phase C SHIPPED (0465fad0), verified live on local (fallback narratives, no GEMINI key).**
  Draft-then-edit: create parks the report as 'draft' (migration 20260718150000, applied
  LOCAL + STAGING, not prod), narratives draft synchronously into data_snapshot
  (narratives + keyFindings + narrative_meta + full inputs + drift digest), funnel gains a
  review branch ("Read it before it ships."): inline edit (server flips aiGenerated:false),
  per-block regenerate with tone hint, voice override (confident/measured/technical, always
  force — assistant caches ignore tone), CEO-foreword draft (foreword-assistant.ts,
  Marketing style only, prints only after explicit accept). Ship consumes the store in both
  build paths; unreviewed blocks carry a mono "AI-assisted draft" note in the document
  (INCLUDING re-rendered pre-Phase-C reports — deliberate honesty). Drafts park with a
  Draft chip + Review draft resume (?draft={id}), no polling, no staleness. Shared assembly
  (assemble-report-data.ts) deduped both paths and finally populates emissionsTrends +
  targets + key-findings-in-HTML. Routes: POST/PATCH /api/reports/[id]/narratives,
  POST .../narratives/regenerate (Bearer+RLS+no-store via route-auth.ts,
  enforceExportAllowed on draft POST, .eq(status,'draft') ship-race lock). 114 vitest, tsc
  clean; full walk verified incl. shipped share doc carrying the edited text verbatim.
  - **Fixed in passing (PROD-RELEVANT): products!inner from product_carbon_footprints is
    ambiguous (products.latest_lca_id_fkey) and 300s silently** — emptied report product
    sections, landing lcaCount, LCA narrative/suggestion routes, Sankey + timeline. All 7
    sites now pin products!product_lcas_product_id_fkey. Main has the same bug: task chip
    spawned (task_d8c430d5).
- **Phase E SHIPPED (78bd38f4), verified live on local.**
  - **One studio funnel** at /reports/builder: confirm-not-ask page (arrival idiom). Style
    picker (5 styles) → framing statement (the one open question) → confirmed fact-list
    (name/period/sections/standards/format/brand) with quiet Edit swaps. Defaults = org
    report_defaults + live data detection (`hooks/useReportDataAvailability.ts`); a style's
    sections filter to what the data supports; the catalogue shows honest Data ready /
    No data yet chips. QuickGenerateDialog + the 4-step wizard + 11 dead components DELETED
    (19 files, ~7k LOC gone); landing page has one Create-a-report CTA + in-flight polling.
    `lib/pdf/templates/report-styles.ts` is now the single style registry (added
    defaultStandards + cues; REPORT_STYLE_CHOICES deleted from types).
    Verified: style switch re-derives sections/standards live, HTML generation completes
    (narratives fail gracefully without keys), 80 scoped vitest, tsc clean.
  - **Real share links**: `report_shares` table + private `report-shares` bucket
    (migration 20260718120000) · POST/DELETE `/api/reports/[id]/share` renders the
    screen-mode doc once (`lib/reports/build-screen-report.ts`, extracted from and shared
    with generate-html), stores it, mints a 128-bit token · public `/report/[token]` route
    serves the stored bytes (noindex, no-store, robots disallow) · Share/Copy/Revoke on the
    report card. Verified: anonymous 200 on a fresh link, revoke → 404 + stored object
    deleted, bad token 404.
  - **saveDefaults now MERGES** organizations.report_defaults (was clobbering hospitality's
    band-threshold/marketplace keys) and persists the chosen style.
  - **Root fetch-cache fix**: `getServiceRoleClient` (lib/supabase/api-client.ts) + both
    report routes now pass a no-store fetch override. Found live: a revoked share kept
    serving because Next's patched fetch cached the PostgREST select + storage download.
    Same latent bug exists on MAIN's api-client — spawned as a task chip.
- Phases A+B, LCA template, studio kit, five styles: see git log (99481453, 4b3a2454,
  8f631439, 263a9d55) and the plan file. Screen-mode renderer tests were stale after the
  five-styles change (investors → landscape executive theme, cream background) — updated
  in 78bd38f4 after confirming the behaviour was deliberate.

## Done (unverified)
- ToV threading into AI writers (8f631439): no live AI run until Anthropic quota resets ~1 Aug.
- Share flow on STAGING: code deployed and migration APPLIED to staging via MCP
  (2026-07-18, verified: table + 3 policies + private bucket). A real staging click-through
  (share, open in a private window, revoke) has not been done yet.
- Real PDFShift PDF generation post-redesign still not exercised (needs staging).

## In flight
Nothing mid-edit. Worktree clean EXCEPT `lib/pulse/__tests__/widget-tier.test.ts`
(separate task-chip session, task_9f49442d — do not touch) and untracked supabase/.temp.

## Next
1. **Phase D** — org brand kit, imagery library, ungate foreword/photos, section reorder,
   truthful preview.
3. Smaller: screenMode restyle polish audits (Board/Editorial), share-link expiry UI
   (expires_at column exists, no picker yet), a11y aria-labels on the style cards
   (accessible names come only from inner text), design-scout leftovers (/uploads rebuild,
   Tabs→MonoTabs on /settings, dead pulse widgets deletion).

## Gotchas and decisions
- ⚠️ CWD DISCIPLINE: shell cwd resets between Bash calls; always cd this worktree.
- Browser-pane synthetic clicks did NOT register on React buttons this session (element
  positions verified correct); `element.click()` via javascript_tool works and proves the
  handlers. Real user clicks are fine. Also: the app scrolls `<main>`, not the window —
  scroll via JS or scroll_to.
- The `report-shares` bucket mime allowlist matches EXACTLY: upload contentType must be
  plain `text/html` (no charset suffix), the public route adds the charset when serving.
- Shares are served THROUGH the server from the PRIVATE bucket so revocation truly cuts
  access (report-assets is public and images/pdf-only — do not move shares there).
- Studio canon: no dark pages, working tones = mono caps never pills, radius 6, Space
  Grotesk speaks / Inter explains / JetBrains Mono annotates. British English, no em
  dashes in copy, alka**tera** lowercase.
- Push to redesign auto-deploys staging. Staging is deliberately NO-Inngest; never set
  INNGEST_* there. Vercel Deployment Protection blocks Claude's browser on staging;
  verify via staging Supabase MCP + `vercel` CLI logs.
- Full `vitest` hangs — always scope. Local Supabase has the migration + bucket applied.

## Pending Tim actions
- ~1 Aug (Anthropic quota): staging scrape retest. (Report narratives are GEMINI, not
  Anthropic — they are live-testable on staging NOW.)
- Any time on staging (after migration): generate a report → Share link → open in a private
  window → Revoke → confirm the link dies.
