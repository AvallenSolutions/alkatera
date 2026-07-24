# The product pages: the world-class cellar pass

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev config
`redesign-verify` on :8894). Design canon: `design/studio-design-language.md`.
Parent tracker: `tasks/redesign-todo.md`. Companion plans already settled with
Tim: `tasks/redesign-cellar-plan.md` (10 July restyle pass),
`tasks/lca-experience-plan.md` (the dossier), `tasks/onboarding-support-plan.md`
(arrival ritual, coachmarks, room checklists).

STATUS: PLAN. Nothing is built until Tim settles the decisions below.

## Context

Tim's read: the product pages still look like production alkatera, not the
redesign, and they will be among the most-used pages on the platform, so they
must be the best we can do. He also wants the current Rosa tour replaced with
guidance in line with the new onboarding flow.

The diagnosis after a full exploration of the redesign worktree: the 10 July
cellar pass restyled the product pages' chrome but deliberately kept the old
structure, and the canon's first NEVER is "retint an old layout and call it
redesigned". The hub `/products/[id]` is a studio Statement bolted onto the old
five-tab machine (Overview / Specification / Facilities / Passport / Settings)
with three duplicated impact surfaces (ProductHeroImpact + QuickImpactBar +
four ImpactAccordions), a stray `#ccff00` survives on the list, the recipe
editor's internals are still shadcn cards, and the 16/20 July "main wins logic"
merges pulled main-styled product components back in. The old Rosa tour
(ProductGuide: dark spotlight overlay, typewriter, auto-starts 1s after first
visit) plus RecipeSidebarTour are still mounted, against the new onboarding
principle that "room intros are inline statements, not overlay tours".

A drinks founder comes to a product page for five things: see the number,
trust the number, fix what is wrong, get the proof, edit the recipe. The
settled dossier direction already gives the answer shape: every product is
born with a footprint; the dossier is where a footprint is read and corrected.
So the roles become crisp: **the hub is the product's one-page story; the
dossier is the footprint record.** They do not merge. One number appears on
both, deliberately.

**Note on worktrees: this session's own worktree (`product-page-redesign-d4e0f5`)
is based on MAIN and is not the target. All edits happen in the `redesign`
worktree, per that stream's standing rule. Never merge to main.**

## Part A: the hub `/products/[id]` becomes a one-page story

Rewrite `app/(authenticated)/products/[id]/page.tsx` as sections down the page,
no tabs (nothing on the hub is a genuine mode). Width `max-w-4xl` (matching the
dossier; the current `max-w-6xl` is a dashboard width). Target ~250 lines of
page + new section components under `components/products/hub/`.

1. **The statement.** Back link, 64px image plate, `Statement` (eyebrow
   THE CELLAR · PRODUCT, headline `{name}.`), `BigNumber size="display"
   tone="room"` showing the latest PCF of ANY status (estimate-first
   birthright), with `ProvenanceChip` + mono "recalculated 3 July, 14:02".
   Chip row pruned to the actionable: Recipe changed, Setup incomplete,
   Multipack, BrewwLinkBadge (the LCA complete / No LCA yet / Ready to
   calculate chips die; provenance carries that story). Mono meta line
   `SKU X · GIN · 700 ML · CRADLE TO GRAVE`. Actions: one room act
   **Open the footprint** (→ dossier), outline **Edit the recipe**, ghost
   **Edit details**. Download moves to the proof section.
2. **The footprint, told once** (`hub/FootprintStory.tsx`). Replaces
   ProductHeroImpact + QuickImpactBar + all four ImpactAccordions. The one
   visual is the redesigned **ContainerVisual**
   (`hub/ContainerVisual.tsx`, Tim's call 24 Jul): the bottle/can/keg
   silhouettes extracted from ProductHeroImpact, restyled to studio (ink
   hairline outline, plum stage fills at stepped opacities, no gradients),
   fill layers = lifecycle-stage shares, paired with mono stage rows beside
   it (plain-language stage names Ingredients · Packaging · Making it ·
   Getting it there · After it is sold, each `label · % · kg`). One quiet row
   of the other capitals as three panel BigNumbers (water scarcity,
   circularity %, land use). One mono gate line ("74% confirmed · 80% unlocks
   the export") + FLAG removals note only when non-zero. Footer room-accent
   link "Open the footprint →". Empty state: one quiet sentence + recipe
   link; the wizard link dies (demotion complete).
3. **What it is made of** (`hub/CompositionSection.tsx`). First hub surface for
   the liquid × pack model: two FactRows, Made from `{liquid}` and Packed in
   `{pack}` with mono hints ("12 ingredients · shared with 2 other formats"),
   linking to `/products/liquids/` and `/products/packs/`; quiet mono link
   "Same liquid, different pack" → `/products/new/compose?liquid={id}`.
   Beneath: the condensed spec recut one-column (top-3 ingredients with
   MaterialSourceChip, packaging counts, maturation facts). Multipack variant
   renders MultipackContentsEditor + MultipackPackagingSection here. Supply
   chain map kept as a collapsed reveal at the section foot (same lazy-load).
   Shared read extracted to `lib/products/composition-facts.ts` (used by both
   CompositionStrip and this section so they never drift).
4. **Where it is made** (`hub/FacilitiesSection.tsx` = FacilitiesTab moved,
   tab framing dropped, `id="facilities"` anchor, assignment dialog and
   annual-volume editing untouched). ProductProductionSparkline (Breww) moves
   here: production volume is a facility fact.
5. **The proof** (`hub/ProofSection.tsx`). Eyebrow THE PROOF.
   PassportManagementPanel inlined as-is (already studio + gate-aware);
   DownloadLCAButton; last three reports as fact rows linking to the dossier
   (not the compliance wizard).
6. **Housekeeping** (`hub/HousekeepingFooter.tsx`). Quiet footer, mono eyebrow,
   ghost Archive / Delete with the existing AlertDialogs + the multipack
   cascade guard. SettingsTab dies.

Compatibility: URL unchanged. `?tab=facilities&facility=...` deep link from
`/company/production-allocation` maps to a scroll-to-`#facilities` + prop
pass-through. `useProductData` extended, not broken.

## Part B: the products list `/products`

Finish, don't re-conceive: the bones (Statement header, count, Bring-products-in
popover) are right.

- **One round trip.** New `app/api/cellar/products/route.ts` (pattern:
  `/api/cellar/counts`, `resolveAccessibleOrg`): two server-side queries
  (products where product_kind='product' + one PCF select for status,
  boundary, dqi, per-unit climate, facility detail across all ids), assembled
  rows out. Replaces the client's four sequential queries. Portfolio points
  built from the same payload.
- **Kill the stray lime**: Show-archived toggle becomes a mono text toggle in
  the view-switcher row. View switcher → `MonoTabs` primitive. Search input →
  quiet hairline underline, mono placeholder.
- **Card recut** into `components/products/ProductCard.tsx`: image plate, name
  (display semibold), mono meta (`700 ML · CRADLE TO GRAVE`), panel BigNumber
  shown for estimates too with compact ProvenanceChip; the LCA-status
  StateChip dies (provenance is the one status vocabulary). Hover
  border-accent + kebab (duplicate/delete) kept.
- **Unify delete**: extract the hub's guarded delete (multipack cascade check,
  materials + PCFs first) into `lib/products/delete-product.ts`; both list and
  hub call it (the list currently deletes products directly, orphaning PCFs).
- Portfolio matrix: light restyle only (studio axes, plum points, cream panel
  tooltip). Empty state copy: "Nothing in the cellar yet."
- Keep: FlagThresholdBanner, supplier-match nudge, Rosa slice, archived_at
  filter, 200 limit, read-only advisor gating.

## Part C: the recipe editor skin

PROTECTED, restyle-only: `useRecipeEditor`, PackagingWizard,
PackagingTemplateDialog, IngredientTemplateDialog, BOMImportFlow, autosave,
and the banned inline-row-builder rule are untouched.

- `RecipeEditorPanel.tsx`: Card shells → Panel + Eyebrow + sentence; local
  MONO_TAB constants → the MonoTabs primitive (Ingredients / Packaging /
  Maturation stay tabs: a genuine mode switch).
- `IngredientRow.tsx` / `PackagingRow.tsx` (the real work): shadcn Card +
  Badge + icon chips → studio row grammar (hairline rows on cream, display
  semibold name, mono meta `120 G · FRANCE · TRUCK 450 KM`, factor source as
  ProvenanceChip/StateChip, chevron reveal into the existing editor tabs).
  All handlers and props preserved in behaviour.
- `MatchStatusBadge.tsx` → typographic chip (shared with the wizard's
  MaterialValidationStep; verify that step still renders).
- Sweep: RecipeToolbar, RecipeModePicker, MaturationProfileCard,
  RecipeChecklist, SearchGuidePanel. Restyle visuals only on main-merged
  components (PackagingMaterialClassPicker etc.), never their logic.
- Verified: no hospitality route imports components/products/* or
  useProductData, so no shared-component collisions.

## Part D: the guidance system (replaces the Rosa tour)

Three parts, aligned with the onboarding canon; ProductGuide and
RecipeSidebarTour are deleted.

1. **ProductSetupPanel** (`components/products/ProductSetupPanel.tsx`):
   the RoomSetupPanel pattern at product level, inline under the Statement.
   First-visit intro sentence ("This is the product's one home. What it is
   made of, where it is made and the footprint that follows.") + a checklist
   derived from the product's own data (Add the liquid. / Add the packaging. /
   Allocate a production site. / Calculate the footprint. / Publish the
   passport.), mono "2 of 5 done.", footer links "Ask Rosa about this
   product." and "Hide this.". Auto-fades when the footprint is complete.
   (Growth signals are org-level, so items derive from useProductData.)
2. **CoachmarkSequence** (`components/studio/coachmark-sequence.tsx`, new
   studio primitive + additive `footer` prop on CoachmarkBody): anchored
   hairline callouts stepping across the page's `data-guide` anchors
   (product-statement → product-footprint-cta → product-recipe →
   product-story → the Ask Rosa affordance), mono "Step N of M", Back./Skip./
   Next./Done., static ring-1 room-accent outline, no scrim, no typewriter,
   ResizeObserver not polling, missing anchors auto-skip, smooth
   scrollIntoView, Esc/arrow keys, role=dialog. **Auto-runs once per user**
   (Tim's call 24 Jul) on their first product-page visit, and is always
   skippable in one tap; completing or skipping marks the flag, and users who
   completed the OLD tour (flag already set) are never re-toured. Replay any
   time via a quiet mono "Show me this page." button where ProductGuideTrigger
   sits today. Because it is quiet (no scrim, no modal), an auto-run reads as
   a gentle pointer, not a takeover; the 1s spotlight auto-modal still dies.
   Copy registry in `lib/product-page-walk.ts`, Rosa's voice, e.g. "The recipe
   is the heart of it. The liquid and the packaging, each ingredient owned in
   one place."
3. **Rosa handoff**: `useRosaPageContext` slice (product id, category, counts,
   LCA status, undone setup items) so ⌘/ and the panel's ask land in a
   conversation that already knows the product; walk's final step ends on
   askRosa("What should I do next for {name}?").

Recipe editor: one Coachmark-shell first-run callout on the editor tab strip
("Work top to bottom. Basics, then source, then logistics, then save.") gated
on the existing flag.

Persistence and migration, zero new keys, zero migrations:
`productGuideCompleted` repurposed as "product intro seen";
`recipeSidebarTourCompleted` repurposed as "recipe coachmark dismissed" (users
who completed the old tours are never re-toured); checklist hide via the
existing `state.coachmarks` map; the walk persists nothing. Telemetry mirrors
room_checklist within the existing CHECK constraint (flows product_checklist /
product_walk / recipe_coachmark, detail in meta.kind).

Deleted: `components/products/ProductGuide.tsx`, `lib/product-guide.ts`,
`components/products/RecipeSidebarTour.tsx` (RecipeEditorPanel loses tourStep
state and data-tour-anchor attributes). A TheWalk-style full-screen product
walk was considered and rejected: full-screen ceremony per entity inflates a
ritual into a routine; the desk walk already carries first-run ceremony.

## Data layer (no migrations)

- `hooks/data/useProductData.ts`: five queries → Promise.all (halves hub load);
  add `latestPcf` of any status (keep `lcaReports` shape untouched for
  existing consumers); fold in the maturation-profile read.
- New `/api/cellar/products` list route (above).
- Calculator, aggregator, resolver, PDF pipeline, tier gating untouched.

## Component inventory

Reused as-is: studio primitives, dossier components, PassportManagementPanel,
EditProductForm, DownloadLCAButton, Breww components, Multipack components,
SupplyChainMap, LcaStalenessBanner (until service recalc obsoletes it),
UniversalDropzone, WebsiteImportFlow, recipe dialogs, the wizard.

New: `components/products/hub/{FootprintStory,LifecycleBar,CompositionSection,
FacilitiesSection,ProofSection,HousekeepingFooter}.tsx`,
`components/products/{ProductCard,ProductSetupPanel}.tsx`,
`components/studio/coachmark-sequence.tsx`, `lib/products/{composition-facts,
delete-product}.ts`, `lib/product-page-walk.ts`, `app/api/cellar/products/route.ts`.

Deleted after verification: OverviewTab, ProductHeroImpact (+ its
BottleVisualization), QuickImpactBar, ImpactAccordion, SpecificationTab,
SettingsTab (no consumers outside OverviewTab, verified), ProductGuide,
RecipeSidebarTour, lib/product-guide.ts.

## Phase 0 baseline (done, 24 July, :8894, alkatera Drinks Co)

Seen in the browser. The diagnosis holds, and one new finding.

- **The list** is the healthiest surface: statement header, plum band, quiet
  cards, provenance ("LCA COMPLETE CONFIRMED.") and boundary on each card.
  Fixes needed are the ones planned (four queries, the boxed search input, the
  bordered Show-archived button, the LCA-status chip duplicating provenance).
- **The hub** is the retint, confirmed: Statement + BigNumber over five tabs,
  a yellow shadcn alert banner, then IMPACT AT A GLANCE (four numbers) followed
  immediately by a Climate accordion that restates the same 0.303 as a
  stage breakdown, then Water/Circularity/Nature accordions restating the
  other three. Three surfaces, one story.
- **NEW FINDING, a real inconsistency:** the hub chips say "LCA COMPLETE" while
  the dossier for the same product says "ESTIMATED. 0% CONFIRMED" and
  "NOT READY TO SHARE". The hub is telling the founder the work is done while
  the record says none of it is confirmed. This is the strongest argument for
  killing the LCA-status chips and letting provenance be the single status
  vocabulary, as planned.
- **The recipe editor** is worst: RecipeSidebarTour auto-fires a "STEP 1 OF 4 ·
  Start here" card over a dark scrim on arrival (two fixed rgba(0,0,0) layers
  measured), and the expanded row is pure old design (blue Note alert, shadcn
  Database / "Matched, please check" / "Ecoinvent Database (Medium Quality)"
  badges, red asterisks, boxed inputs).
- **The dossier is excellent** and sets the bar: statement, plum number, mono
  provenance line, quiet gate panel, section panels with per-section figures
  and tone chips. The hub should read like this. First visual verification of
  the dossier since it was built (the LCA plan flagged it as never seen).

## Build order

Dev server: `redesign-verify` (:8894). Sign in as dev@local.test.

- **Phase 0 — look first.** Baseline screenshots of list, hub, recipe, dossier
  on :8894 (the dossier has never been visually verified; do it here).
- **Phase A — the list.** API route, one-fetch page, ProductCard, lime
  removal, MonoTabs switcher, quiet search, delete helper, portfolio restyle.
  Verify: counts match before/after, one data fetch in the network tab,
  archived/search/portfolio/duplicate/delete (incl. multipack-blocked case),
  read-only advisor.
- **Phase B — the hub.** useProductData improvements; build the six sections
  alongside the old tabs, then cut the page over; deep-link mapping; then
  delete the dead tab components and grep for dangling imports. Verify with:
  a completed-LCA product, an estimate-only product, a bare product, a
  multipack, a Breww-linked product; production-allocation deep link; passport
  gate; archive/delete; dossier round-trip.
- **Phase C — the recipe skin.** Panel shells, row recut, chips, sweep.
  Verify: full recipe editing round-trip (add/edit/remove, autosave note,
  templates, BOM import, packaging wizard) + wizard MaterialValidationStep.
- **Phase D — the guidance system.** CoachmarkSequence primitive (+ studio-kit
  gallery entry) → walk + anchors on the new hub → ProductSetupPanel →
  recipe coachmark swap → delete the three legacy files. Verify: fresh user
  sees the intro once and no auto overlay; walk steps, skips missing anchors,
  Esc; legacy-flag users are not re-toured; telemetry rows arrive.
- **Phase E — the sweep.** Copy pass (British English, full stops, no em
  dashes, middot mono facts); `grep -rn "ccff00|LCA complete|No LCA yet|
  product-guide"` clean; tsc 0; scoped tests; mobile 375 clean; final
  click-through of every cellar tab; commit per phase on `redesign`.

## Decisions (settled with Tim, 24 July)

1. **The hub's one room-colour act: Open the footprint.** Edit the recipe goes
   outline.
2. **Add product default door: compose first.** The list's "Add product"
   opens `/products/new/compose`; the classic form stays reachable via a
   quiet link for edge cases (multipacks).
3. **Portfolio matrix stays** as the list's second view.
4. **The walk auto-runs once for every new user** on their first product-page
   visit, always skippable; replayable via "Show me this page."; old-tour
   completers never re-toured.
5. **The container visualisations (bottle/can/keg) are KEPT and redesigned**
   to the studio system as `hub/ContainerVisual.tsx`, the footprint section's
   one visual (ink hairline outlines, plum stepped-opacity stage fills, mono
   stage rows beside). Other minor calls stand: supply chain map stays on the
   hub collapsed; checklist "Hide this." is per user; "Publish the passport."
   stays a checklist item.

## What does not change

All data flows, calculations, autosave, PDF generation, template systems,
provenance gate, tier gating, Rosa context contracts, URLs of surviving
surfaces, the compliance wizard (demoted but working). No migrations. No prod.
Local preview only; never merge to main.
