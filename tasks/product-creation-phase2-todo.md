# Product-creation remediation — phase 2 follow-ups (session 2026-07-15)

Continuing from `tasks/handoff.md`. Item 1 (all-orgs recalc) is a Tim browser action — not code.
Focusing on the buildable items: 2, 3, 4.

## Root cause shared by items 2 & 3
`app/(authenticated)/products/[id]/page.tsx` Specification branch renders **only**
`MultipackContentsEditor` (components) for a multipack — there is no packaging UI. So a
multipack's own transit/secondary packaging (stored as `product_materials` packaging rows,
written by `createCompleteMultipack` in the CREATE flow) cannot be edited after creation and
never renders on Specification. (Overview already shows it via `MultipackContentsCard`.)

## Item 2 + 3 — Multipack own-packaging editor on the Specification tab  ✅ SHIPPED (commit 17af0c65)
Verified end-to-end vs local Supabase (product 29): add/edit/remove persist to
product_materials (quantity + container_material in lockstep, units_per_group=1);
pulls through to Specification AND Overview; single staleness banner.
- [x] `lib/multipacks.ts`: add mutation helpers reusing `buildMultipackPackagingRow`:
      `insertMultipackPackaging`, `updateMultipackPackaging`, `deleteMultipackPackaging`.
      Update = rebuild row via the builder, strip `product_id` + `epr_is_household` +
      `epr_is_drinks_container` (preserve full-editor EPR choices; activity/nation are absent
      from the builder so are never clobbered).
- [ ] New `components/products/MultipackPackagingSection.tsx`: fetch rows via
      `fetchMultipackPackagingMaterials` -> map to `SecondaryPackagingItem[]` -> render the
      existing `MultipackSecondaryPackagingForm` (controlled) -> Save diffs current vs original
      (insert temp-id items, update changed real-id items, delete removed) -> stale after save.
- [ ] Wire into `products/[id]/page.tsx` multipack Specification branch: render
      `MultipackContentsEditor` + `MultipackPackagingSection`. Fixes editability (item 2) and
      Specification pull-through (item 3). Overview half already works.
- [ ] Verify in browser: create/open a multipack, add + edit + remove shipment packaging,
      confirm it persists, renders on Specification AND Overview.

## Item 4 — EPR completeness "won't go green"  ✅ SHIPPED (explicit selector)
Tim chose: add an explicit EPR material-type selector. Built + verified end-to-end
(product 12 glass bottle): selector renders in the compliance section, loads the saved
value, and changing it autosaves the override to product_materials.epr_material_type
(glass -> steel, then reverted). This lets users fix rows that auto-derive to 'other'
(wood/foam/fabric/metal) so they can reach the dashboard's >=80% green.
Save-path override already unit-tested (packaging-material-data.test.ts, 7/7 green).

### Original investigation (for reference)
Two surfaces:
1. EPR dashboard (`app/(authenticated)/epr/page.tsx`): org-level "X/Y items complete", green
   only at >=80%. Per-row requires net_weight, packaging_activity, uk_nation, material_type
   (present & != 'other'), + conditionals.
2. Per-row summary "X of 4 sections" (`components/products/lib/section-completion.ts`
   `packagingComplianceStatus`): requires only `epr_packaging_activity && epr_uk_nation` -
   does NOT check material_type. So the two definitions diverge.
- Multipack packaging rows never get `epr_packaging_activity`/`epr_uk_nation`
  (`buildMultipackPackagingRow` omits them) -> always dashboard-incomplete.
- `epr_material_type` derives to 'other' for wood/foam/fabric/metal materials.
- [ ] DECISION for Tim: which fix? (a) explicit EPR material-type selector in the packaging
      editor; (b) improve material inference; (c) expose activity/nation in the multipack
      packaging editor. Cannot see Clair's Everleaf prod data locally, so confirm the stubborn
      field before over-building.

## Item 6 — copy/UX polish  ✅ SHIPPED (commit 9642548b)
- IngredientRow + PackagingRow: outer summary `<button>` (which wrapped AskRosaButton /
  remove control — invalid nested-button HTML → hydration warning) → `div[role=button]`
  with Enter/Space keyboard handling. Verified: no button-in-button in DOM; toggle still works.
- LCA wizard em dashes removed (GuideStep intro, WizardSidebar glossary/tips) → commas/colons.
- NOT done (bounded follow-up): app-wide em-dash sweep. Many more prose em dashes exist in
  GoalScopeForm, ComplianceWizard, InterpretationDashboard, IngredientFormCard SelectItem
  descriptions, etc. Left the empty-state `'—'` markers alone (UI convention, not prose).

## Item 5 — deferred phase-1 items  ⚠️ ASSESSED, NOT BUILT (recommend re-scope)
- **5a Stash pickup-before-commit (useIngestStash):** the comment's "defer DELETE to commit"
  fix does NOT actually deliver retry-after-cancel: in every consumer the file is also held
  in memory (lost on cancel anyway) AND the deep-link params are stripped on pickup, so a
  surviving stash isn't reachable without also making the deep link resumable. Spray consumes
  the file synchronously (no cancel window); only BOM + evidence defer. Marginal benefit,
  4 sensitive ingest files, can't verify the dropzone→deep-link flow locally. Recommend a
  proper redesign (resumable deep link + release-on-commit) or drop.
- **5b Background forced-type reclassify (>5MB):** ✅ SHIPPED (commit c8b9d301). Shared
  `lib/ingest/reclassify.ts` `runReclassify` (extract → overwrite job → learning-loop feedback →
  profile hint), used by both the sync route (small files, unsupported→422) and a new Inngest
  function `ingest-reclassify.ts` (large files: route flips job to 'extracting', fires
  `ingest/reclassify.run`, returns 202; UniversalDropzone polls GET until done). No migration
  (reuses status='extracting' + existing poll + GET's 3-min terminal rescue). Verified: typecheck
  clean, /api/inngest compiles + registers, 80 ingest tests + 3 new runReclassify tests green.
  NOT verifiable locally: the live background run (Inngest dev server + Claude on a >5MB doc);
  it mirrors the proven documents pipeline exactly.
  ⚠️ GIT HYGIENE: `lib/inngest/client.ts` + `functions/index.ts` had uncommitted OTHER-SESSION
  WIP (the inngest refactor: delete scraping.ts, add scheduled.ts). I committed only my 2-line
  additions on a HEAD base (keeps scraping.ts, which is still tracked, so the commit builds) and
  restored their WIP to the working tree. When their inngest refactor lands, it must re-apply the
  scraping deletion + scheduled addition on top of my `ingestReclassifyRun` registration.

## Notes / guardrails
- 176 dirty files in tree are OTHER sessions' WIP — do NOT commit them. Only commit my files.
- Push to main directly (house rule). Local dev = LOCAL Supabase.
- Multipack own packaging counts ONCE (units_per_group=1); it is the sellable unit.
