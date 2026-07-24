# Handoff: THE VITALITY PAGE
Updated: 2026-07-24 13:40 | Branch: redesign | Worktree: `.claude/worktrees/redesign` | Dev port: 8894 (`redesign-verify`)

## START HERE
**Work `tasks/vitality-redesign-plan.md`, starting at step 1 of "The work, in
order".** Nothing else. Tim has asked for the vitality page twice; two sessions
have now done other things instead.

There are other live streams in this worktree (`tasks/phase2-staging-handoff.md`,
`tasks/alkatera-v2-launch-plan.md`). **Do not start on them.** They are listed
at the FOOT of this file for context only. A previous session read a pointer to
the staging handoff at the top of this file and worked its punch list instead of
the vitality page — that was a defect in how this file was written, not in the
session's judgement.

## Goal
Tim's room-by-room polish of the redesign, done in one session: reorganise which
pages live in which room, put the four growing/hospitality modules behind a
"what do you work with?" question instead of admin beta flags, bring the Rosa
surfaces onto the studio design system, and plan the vitality page rebuild.
Everything is LOCAL and uncommitted on `redesign`. Never merge to main.

## Done (verified)
- **Room reorganisation.** New map in `components/studio/platform-rooms.ts`:
  Evidence = Reports/LCAs/Vitality/Emissions (+overflow); Cellar narrowed to
  Products/Liquids/Packaging/Ingredients; Library gained "Your library" and
  Uploads; Workbench gained Integrations. Moved: `/performance`, `/reports/lcas`,
  `/nature-assessment` (cellar→evidence), `/data/scope-1-2` (workbench→evidence),
  `/evidence-library` + `/uploads` (→library). Verified in a browser on
  `/cellar` and `/desk`; 35 tests in `platform-rooms.test.ts`, incl. a guard that
  every tab resolves back to its own room.
- **Beta flags retired.** `viticulture_beta`/`orchard_beta`/`arable_beta`/
  `hospitality_beta` are gone; the four are ordinary Canopy features named
  `viticulture`/`orchards`/`arable_fields`/`hospitality`. New split: **declared**
  (`organizations.works_with`) vs **entitled** (Canopy). Single source of truth
  `lib/subscription/works-with.ts`; one server gate `lib/subscription/module-access.ts`.
  Two migrations applied to the LOCAL db and proven idempotent; the seed carried
  Local Dev Co's three old beta grants into `works_with` correctly.
- **`arrival-modules` step** added to the arrival ritual (now 8 screens, was 7),
  plus `components/settings/WorksWithPanel.tsx` to change the answer later.
- **Rosa on the studio system.** ActionProposalCard, RosaDrawer, NudgeRail,
  RosaConversation, RosaInputBar, RosaPersonaPrompt, plus hub children
  (ProgressTracker now uses `Panel`, OnboardingResumeBanner, RosaCanvas). Zero
  old-design markers left across 13 live files. Drawer and hub screenshotted
  signed-in with real data.
- **Desk greeting name.** `lib/user-name.ts`, three sources: signup metadata →
  `profiles.full_name` → email local part (role addresses and company slugs
  refused). `tim@alkatera.com` now renders "Good morning, Tim." — seen live.
  9 tests. Same helper adopted by the Rosa brief, which had the identical bug.
- **"Give us anything" moved into the ink band** beside Ask Rosa and removed
  from all six room landings. Screenshotted open.
- **Forest only on the desk**; removed from the other six rooms, `pb-48` → `pb-16`,
  single-child fragments collapsed.
- **Forest "see it on its own" toggle** — cards fade, pill becomes "Show the
  desk", Escape also returns. Measured: opacity 0 / `pointer-events: none` when
  cleared, back to 1 via both routes.
- **The walk's slide transitions.** Was one keyed `fixed inset-0` panel per
  slide, so advancing unmounted the old and faded the new in from transparent —
  the desk flashed through. Now one persistent backdrop that only changes
  colour. Measured: 22 intermediate colours over ~620ms, backdrop opacity 1 in
  every frame.
- **The walk's Network slide** was `STUDIO.ochreInk` (ochre's accent form for
  text ON PAPER) on the ochre ground: dark gold on gold. Now ink, ~7.8:1.
  Measured across all six slides: network is the only one with ink text.
- **Footer = the other rooms.** The ink band repeated the room's own tabs, which
  the band three lines above already carried. Now `otherRoomLinks()`, persona-
  ordered, current room and desk excluded. Verified on `/cellar` and `/desk`.
- **Stale room eyebrows fixed** on the three moved pages (LCAs, Nature,
  Vitality still said "THE CELLAR").
- `tsc --noEmit` clean and `pnpm build` exit 0 after every stage; 132 tests green
  across `components/studio`, `lib/studio`, `lib/onboarding`, `lib/subscription`,
  `lib/__tests__/user-name`.

## Done (unverified)
- **The arrival `arrival-modules` step has never been walked in a browser.** Its
  save path (`PUT /api/organization/works-with` → `refreshOrganizations`) is
  typechecked and unit-tested at the parser level only.
- **`WorksWithPanel` in Settings** — same: never clicked.
- The CANOPY-locked state of a declared module in the workbench (chip + billing
  link) has not been seen; the local org is Canopy so it always renders unlocked.
- Rosa's live conversation rendering was checked against realistic markdown in a
  harness, not against a real streamed LLM turn. The history dropdown opens but
  Radix portals do not appear in screenshots.

## In flight
Nothing half-edited. The last change was `app/api/vitality/composite/route.ts`
+ `lib/vitality/environmental.ts`, adding a `progress` object to
`climate_breakdown` (both years, delta, per-unit actual vs benchmark). The route
was computing these and discarding them; the type's own comment said to keep
them "so the UI can show the math". Additive, typechecks, returns real data.

The Climate axis mockup now lives at `tasks/vitality-axis-mockup.tsx.txt`,
moved out of `app/` before committing so it does not ship as a live route.

## Next — the vitality page, and only the vitality page
1. **Vitality visual redesign** — `tasks/vitality-redesign-plan.md`, "The work,
   in order", steps 1-7. **Step 1 (move the pillar breakdown out of the hero and
   delete the four duplicate PillarCards) is independently shippable** and makes
   the current page better on its own. Start there.
   The Climate axis mockup Tim approved the shape of is
   `tasks/vitality-axis-mockup.tsx.txt` — real studio primitives, real numbers.
   Kept as `.txt` so it is neither routed nor typechecked; drop it back into
   `app/` temporarily if you want to look at it running.
2. **Vitality scoring** — the separate stream at the foot of the same plan. Do
   NOT bundle it with the visual work. Order matters: false label → unit-size
   fallback → benchmark boundary audit → year-vintaged PCFs → re-anchor.

Only after both, and only if asked:
3. Walk the arrival ritual on a fresh org to exercise `arrival-modules`, and
   click `WorksWithPanel` in Settings (both untested, see above).
4. Commit. None of this session's 89 changed files are committed.

## Other live streams — CONTEXT ONLY, do not start here
- `tasks/phase2-staging-handoff.md` — Phase 2 staging test punch list. Still
  live and unfinished, but it is NOT this stream's work.
- `tasks/alkatera-v2-launch-plan.md` — the cutover strategy.
- **Done from that stream on 24 Jul, do not redo:** the numbers-don't-change
  golden harness. `lib/__tests__/lca-aggregator-golden.test.ts` +
  `support/aggregator-harness.ts` + `fixtures/lca-golden-cases.ts`. 8/8 pass on
  redesign (re-run and confirmed 24 Jul 13:34); proves redesign reproduces
  main's LCA numbers exactly, and the reorder of downstream stages vs the loss
  block is behaviour-preserving. Verified by mutation, not by going green.
  **Caveat: all three files are UNTRACKED, and exist only in the `redesign` and
  `zealous-golick-15a7ed` worktrees.** If they are meant to be a cross-branch
  invariant they need committing on both branches, or they evaporate.

## Gotchas and decisions
- **Declared vs entitled is deliberate.** A declared module shows in the
  workbench on ANY tier wearing a CANOPY chip. That visibility IS the upsell —
  do not "fix" it by hiding it. Tim's call.
- The four modules are deliberately NOT in the static room registry;
  `roomWithModules()` appends the declared ones per org, so a business that
  grows nothing never sees the words.
- **`yoy_sub` in the vitality climate score does not measure emissions.** Both
  years come from the same current PCF × that year's units, so it is a volume
  and mix index. Confirmed in code and by the sustainability advisor. Do not
  "fix" it by swapping to an intensity trend — that yields 0.00% for every org
  until PCFs are year-vintaged. Full write-up in the plan.
- **The `?? 1.0` unit-size fallback flatters the score by up to ~30 points**,
  one-directionally (`unit_size_l` is only in the benchmark numerator). Green-
  claims risk. Remove it.
- Do not repeat the SBTi claim that you cannot meet a target through output
  reduction. It is wrong; recalculation triggers on structural change only.
- Setting `color` on the walk's root element does not reach its text (an
  `!important` inline does not move the computed value either, and no matching
  CSS rule was found). Set it on the content wrapper. Cause unexplained.
- Browser-pane quirks that cost time: fixed overlays screenshot blank until you
  `dispatchEvent(new Event('resize'))`; `navigate` sometimes drops the path, so
  use `window.location.href`; the walk auto-advances every 8s, which invalidates
  slow multi-call DOM probes — do the whole probe in ONE `javascript_exec`.
- Never bare `npx vitest run` (hangs). Scope to directories or files.
- **The LCA calculator is NOT browser-only**, whatever older notes say.
  `lib/product-lca-calculator.ts` has zero `window`/`document`/`localStorage`;
  its only browser touch is `ctx?.supabase ?? getSupabaseBrowserClient()`, a
  fallback that a passed-in client bypasses. `aggregateProductImpacts(supabase,
  …)` takes the client as an argument. It needs a client, not a browser. The
  aggregator's "runs entirely client-side" docstring propagated this and has
  been corrected in place. Verified 24 Jul.
- `tsconfig.json` is auto-edited by the dev server (adds `.next-8894/types`).
  Revert before committing; it is not part of the work.
- Local Supabase for this worktree is the **alkatera main-repo instance** on
  :54321 (`supabase_db_alkatera`); the redesign worktree's own `supabase start`
  fails on a port clash. The two migrations below were applied there.

## Pending Tim actions
- **Two migrations to run on prod/staging when this ships** (both already on
  local, first one proven idempotent):
  - `supabase/migrations/20260724100000_organizations_works_with.sql` — adds
    the column, seeds it from the dying beta flags, then strips them.
  - `supabase/migrations/20260724110000_tier_features_single_source.sql` —
    regenerated tier features; canopy 65 → 69.
- **ANNE JONES HAS ANSWERED** (`tasks/benchmark-answers-anne-jones.md`, the
  source record — do not edit it). Headline: **not one of the 13 benchmark rows
  is supported by the source it cites** (9 'no', 4 'approximate', 0 'yes'), and
  the boundary mismatch fails ISO 14044 outright rather than being a judgement
  call. `lib/industry-benchmarks.ts` now records boundary, functional unit and
  source-support per row so this cannot hide again; **no values changed** —
  those move live customer scores and need Tim. Revised 11-step order is in
  `tasks/vitality-redesign-plan.md`. Two things needing Tim specifically:
  archive the BIER PDFs (several now 404, surviving only on Wix's CDN), and
  approve the value corrections.
- ~~Anne Jones questions — written up and ready to send~~ (sent, answered):
  `tasks/benchmark-questions-anne-jones.md`. Twelve questions in four groups,
  self-contained (she needs no code access). The two that matter:
  (a) are the benchmark figures lifecycle or operational — the BIER 2023 rows
  (Beer & Cider, RTD, Non-Alc) look like facility scope 1+2 per hL while the
  file header claims lifecycle; and (b) **the numerator and denominator are on
  different boundaries**, verified: nothing adjusts for `system_boundary`, so a
  cradle-to-gate and a cradle-to-grave product are scored against the same
  fixed benchmark. Because distribution / use phase / end-of-life are
  TIER-GATED, a customer who upgrades and switches on end-of-life makes their
  own intensity score worse for doing more thorough work. Fix that regardless
  of what Anne says.
- Decide whether absolute emissions leave the vitality score entirely and
  become the outcome + Targets driver (recommended, agreed in principle).
- Legal view on EmpCo before any shareable "vitality score" badge or an EU
  QR carbon-label menu (national rules from 27 Sept 2026).

Next session opener: `Read tasks/handoff.md and continue.`
