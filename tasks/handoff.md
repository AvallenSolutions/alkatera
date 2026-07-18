# Handoff: redesign — studio design system + sustainability report programme
Updated: 2026-07-18 13:15 | Branch: redesign | Worktree: /Users/timej/Documents/GitHub/alkatera/.claude/worktrees/redesign | Dev port: 8896 (preview_start name "redesign"); a second config "redesign-verify" exists for sessions locked out of the first (harness may shift its port)

## Goal
The alkatera redesign ("house of rooms" studio design language) lives on branch `redesign`,
auto-deployed on push to Vercel staging. Current programme: rebuild the DOCUMENT GENERATORS
in the studio design and upgrade sustainability-report customisation (plan:
`tasks/sustainability-report-redesign-plan.md`, phases A–E, Tim-approved order A→B→C→E→D).
**A+B+E are done; next is Phase C (draft-then-edit narratives), then D.** Redesign NEVER
merges to main until go-live.

## Done (verified)
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
1. **Phase C — draft-then-edit narratives**: generate into a store BEFORE render, review/edit
   step, per-section regenerate with tone hint, CEO-foreword drafting. Build any time;
   live-test after 1 Aug (Anthropic quota).
2. **Phase D** — org brand kit, imagery library, ungate foreword/photos, section reorder,
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
- ~1 Aug (Anthropic quota): staging scrape retest; styled-report narratives; Phase C live test.
- Any time on staging (after migration): generate a report → Share link → open in a private
  window → Revoke → confirm the link dies.
