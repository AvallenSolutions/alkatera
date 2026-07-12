# The cellar: the plan

Working branch: `redesign` (worktree `.claude/worktrees/redesign`, dev server :8891).
Parent tracker: `tasks/redesign-todo.md`. Design reference: `design/studio-design-language.md`.
Follows the Today and workbench passes; the room-landing pattern is now proven.

STATUS: PLAN ONLY. Nothing is built until Tim has read this and settled the decisions.

## What the cellar is

The product footprints being made. Plum band. Registry tabs: Products, LCAs,
with Nature in More… and /performance (the vitality page) mapped to the room
but LISTED NOWHERE: it is unreachable except through the desk's vitality panel.
Nineteen routes in total. This room contains the platform's crown jewels (the
recipe editor, the LCA wizard, the client-side calculator) and also its largest
graveyard.

## The headline finding: a dead parallel flow

The audits found that EIGHT of the nineteen routes are a complete legacy LCA
flow that the Enhanced Compliance Wizard superseded but nobody removed. None of
them is reachable through normal navigation (verified by grep for inbound
links):

| Route | Lines | State |
|---|---|---|
| /products/detail | 314 | Dead. Query-param twin of /products/[id]; all action buttons literally `disabled`. Zero inbound links. |
| /products/[id]/materials | 428 | Dead AND broken AND banned. Reads the wrong param so it hangs on an infinite loader; and it is a free-text inline material/packaging row builder, the exact pattern the product-input programme prohibited. |
| /products/[id]/core-operations | 451 | Superseded by the wizard's FacilityAllocationStep; its own banner says so, linking to a route that does not exist. |
| /products/[id]/distribution | 70 | "Coming Soon" stub with the same dead link. Real entry: wizard DistributionStep. |
| /products/[id]/end-of-life | 70 | Identical stub. Real entry: wizard EndOfLifeStep + UsePhaseStep. |
| /products/[id]/calculate-lca | 1,158 | The old pre-flight + calculate page. Zero inbound links. Duplicates the wizard's materials/facilities/calculate steps. |
| /products/[id]/report (+ /lca-report/[id] print page) | 1,263+ | The old report view, reachable only from calculate-lca. **Honesty hazard: silently falls back to MOCK data**: fabricated water sources, waste streams and supplier claims ("Direct EPDs from 3 tier-1 suppliers") rendered as fact. Also mounts the legacy 783-line modal wizard alongside a tracker pointing at the new one, and tells users to browser-print, contradicting the PDFShift pipeline. Largest route in the app (313 kB). |
| /products/[id]/lca-pdf | 27 | Redirect stub, zero inbound links. |

(/products/[id]/lca-report is a ninth: a 27-line redirect that still gets one
inbound link from Rosa's ProductSpotlight; repoint that link and it can go too.)

**Recommendation (decision 1): delete the lot.** This is not feature removal:
every job these pages once did is done better by the wizard and the library,
several are broken or misleading, and one reintroduces a banned pattern.
Restyling them would launder dead UI. The deletion list touches nothing with
inbound navigation except the one Rosa link, which gets repointed.

## The real spine (what the room actually is)

    /products (list) → /products/[id] (hub) → /products/[id]/recipe (editor)
        → /products/[id]/compliance-wizard (the LCA wizard) → /reports/lcas (library)

plus /nature-assessment (annual TNFD form) and /performance (vitality analysis).

## The noise audit (surviving surfaces)

### /products (list, 660 lines)
Header already studio, but FOUR header buttons (Smart upload, Find supplier
matches, Import from Website, Add New Product) plus the count on one line;
supplier-match discovery appears twice (button + nudge banner); product cards
are icon-card soup lite; dashed icon-medallion empty state that duplicates two
header actions as two more buttons; three Loader2 spinners; raw red delete.

### /products/new (930 lines)
Pre-studio header. Phase one is three giant icon-headed choice cards (manual /
BOM / spreadsheet), the third being just a redirect to /import. Phase two is
Card-per-section with a green saturated BOM alert. Tier limit banner is an
icon-disc Lock card.

### /products/import (911 lines) — heaviest noise in the room
A Template/Import shadcn tab bar that is really sequential steps; icon-headed
cards throughout; DIY border-spinners; badge-pill soup; a 3-stat icon row
duplicating the per-product cards below it. NOTE (side-finding): bulk import
does not run checkLimit/increment_product_count client-side; whether the API
enforces product limits needs confirming (flag, not a design matter).

### /products/supplier-matches (134 lines)
Nearly studio already. Off-palette cobalt Sparkles icon on a plum page, no
eyebrow, "% match" badge pill. Light touch.

### /products/[id] (the hub, 361 lines + tabs totalling ~1,900)
Three pulsing gradient orbs animate behind everything (direct violation); a
five-tab internal bar with icons and lime active states; the Create LCA call to
action appears THREE times; amber estimate badge pills; skeleton soup. Good raw
material: useProductData's isHealthy readiness and the recipe-staleness signal
want to be working-tone chips.

### /products/[id]/recipe (201 lines over a 936-line panel + ~1,000-line hook)
The crown jewel. Internal Ingredients/Packaging/Maturation tabs are a genuine
data-entry mode switch (keep, restyled quiet); icon-square card headers and the
green Import BOM button are the noise. PROTECTED, restyle-only: PackagingWizard
(the question-led builder), PackagingTemplateDialog + usePackagingTemplates
(the shared-packaging system), IngredientTemplateDialog, useRecipeEditor (owns
autosave and all writes). The panel is a skin over the hook; redesign the skin,
never the hook.

### /products/[id]/compliance-wizard (~14,200 lines)
The canonical wizard, 10-14 boundary-dependent steps. Chrome noise: numbered
circle-and-connector step rail, "~N minutes remaining" timer, Sparkles resume
banner, and a SECOND AI assistant (WizardSidebar: suggestions, tips, glossary)
sitting beside the ambient Rosa drawer. DANGER ZONES (restyle around, never
rewrite): per-step nextDisabled validation inline in the footer; CalculationStep's
client-side calculateProductLCA call and progress contract; WizardContext step
IDs and ordering; SummaryStep's stale-recipe error path and PDFShift call.

### /reports/lcas (449 lines)
Half-studio already (statement, StateChips, PDFShift pipeline). Stale eyebrow
says THE EVIDENCE; three KPI cards (one is a "CSRD Compliant" boast); a Filter
button that does nothing; hardcoded "v1.0" badge; icon-headed About card;
synthesised report titles.

### /nature-assessment (760 lines)
Closest-to-converted page in the room. LEAP section strip is a mild internal
tab bar; stat cards, water-stress badge pills, a Progress bar duplicating the
tab status colours. Light pass: sections down one paper, mono progress line.

### /performance (1,382 lines + ~11k in components/vitality)
Header converted; everything below is the old grammar: PillarCards with
gradients, icon+emoji headers, ring glows and traffic-light pills; green/amber
Strengths/Improvements cards; tinted stat tiles; ~8 saturated blocks against a
budget of 1. The composite score is fetched twice on one page. PROTECTED:
PillarCard/PillarGrid/PerformanceSummary are imported by the hospitality
dashboard (already converted): restyle via a studio variant or move hospitality
to the new look in the same change; VitalityRing/ScoreExplainer/lib/vitality
ripple to the desk; /api/vitality/composite is shared with the desk and Rosa,
and score derivation must stay server-side.

## The design moves

### 1. The landing: the cellar door (/cellar/ or /products/ absorbs it?)
NEW ROUTE `/workbench/`-style landing (decision 5 settles the poster):
1. Statement: "The cellar." with a quiet note ("The footprints being made.").
2. The one plum poster: THE VITALITY: composite score + band word (RISING /
   DEVELOPING etc.) from /api/vitality/composite, linking to /performance
   (recommended, decision 5).
3. Fact rows with live counts via a new /api/cellar/counts (clone of the
   workbench counts route): The products (N), The LCAs (N complete, N draft),
   The nature assessment (status chip for the current year), The vitality
   (row if not the poster), supplier matches waiting (from the existing
   ingredient-matches API if cheap).
4. Registry: workbench-style landing entry; the band's room name links here.

### 2. Registry and hygiene
- Add Vitality as a listed cellar tab (it is currently invisible); eyebrow on
  /reports/lcas becomes THE CELLAR · LCAS; supplier-matches gets a statement
  header; all Title Case buttons to sentence case.
- Repoint Rosa ProductSpotlight's completed-LCA link from /lca-report/ to the
  wizard (or the library), then remove the redirect stubs (decision 1).

### 3. Products list: one door in
Header slims to the count + TWO actions: "Add product" (the room pill) and one
"Bring products in" entry that fronts the import options (smart upload, website,
spreadsheet) as quiet rows in a small sheet or on /products/new (decision 3).
Supplier-match discovery collapses to the nudge row alone. Cards become quiet
fact rows (image thumb, name, footprint figure, LCA status chip, staleness
tone), or keep the card grid but recut quiet: decision 4. Empty state: one dim
line + one pill. Spinners become busy text.

### 4. /products/new and /products/import
New: method chooser becomes quiet selectable rows (the spreadsheet row simply
links to /import); form Cards become hairline sections; product-type toggle
becomes quiet mono tabs; limit banner becomes a hairline attention row.
Import: the fake Template/Import tabs become one linear flow with a mono stage
line (the existing StageBar primitive if it fits); icon cards to sections;
badge soup to StateChips; DIY spinners to quiet progress text; the 3-stat row
dies (duplicated facts).

### 5. The hub: a product's one-page story
Gradient orbs deleted. Statement: product name + the footprint figure standing
right + working-tone chips (LCA status, recipe staleness, isHealthy). ONE
Create/Update LCA call to action (the room pill; the other two die). The five
icon tabs become quiet mono tabs (Overview reads as the default paper:
specification summary rows linking to the recipe editor, facilities, passport,
settings behind quiet tabs since they are genuine modes). Estimate badges to
chips; skeletons to the quiet PageLoader.

### 6. Recipe: restyle the skin, never the hook
Mode tabs to quiet mono text; icon-square headers to mono eyebrows; Import BOM
demoted to outline; amber alerts to attention-tone rows. PackagingWizard,
template dialogs and useRecipeEditor untouched.

### 7. The wizard: quiet chrome around sacred machinery
- WizardProgress becomes a quiet mono step list (STEP 4 OF 12 · DISTRIBUTION,
  hairline rail), no circles, no timer, no Sparkles banner.
- WizardSidebar (the second AI) folds away (decision 2): glossary and tips
  become a quiet aside or move into Rosa's drawer context; the drawer is the
  one assistant.
- Footer restyled (pills, mono saved-state text), validation logic untouched.
- CalculationStep's progress theatre becomes one quiet line; the call contract
  untouched. Step internals decarded gradually: card soup to sections, chips.

### 8. Library and nature: light passes
Library: eyebrow, KPI cards to one hairline figures row (drop the CSRD boast or
make it honest), dead Filter button either works or dies, About card to a quiet
foot section, real report titles. Nature: LEAP tabs to hairline sections down
one paper, stat cards to fact rows, Progress bar to one mono line, water-stress
pills to chips.

### 9. Vitality: the deep-dive surface
- PillarCard/PerformanceSummary get studio variants (quiet panels, mono
  eyebrows, tone chips instead of traffic lights, no gradients/emoji/glows);
  hospitality's dashboard moves to the same variant in the same change so the
  shared component stays shared.
- Strengths/improvements become quiet fact-row lists with tones. Hotspots and
  Scope 3 keep their content, recut quiet. One composite fetch, not two.
- The desk's VitalityHero and /api/vitality/composite are untouched.

## Decisions (settled with Tim, 10 July)

1. **Delete the dead parallel flow: YES, with one salvage.** Delete the seven
   fully-dead routes (products/detail, products/[id]/materials,
   core-operations, distribution, end-of-life, calculate-lca, lca-pdf) plus the
   /report page shell and the /lca-report top-level print page, and the
   /lca-report redirect stub once Rosa's link is repointed. SALVAGE from /report
   before deleting it: keep the EF3.1 components (EF31ImpactCategoriesTable,
   EF31SingleScoreCard) as files for a future real-data library detail view;
   they carry no mock data themselves (the mock lived in the page). Everything
   else /report imported that is orphaned may go.
2. **WizardSidebar: fold into Rosa.** The drawer is the one assistant;
   glossary/tips become a quiet static aside, suggestions move to Rosa context.
3. **Import consolidation: YES.** List header = Add product + one "Bring
   products in" entry fronting smart upload / website / spreadsheet.
4. **Products list body: recut card grid.** Keep cards (products are visual),
   quieten them (thumbnail, name, figure, LCA chip), single column on mobile.
5. **Landing poster: the vitality score** (composite + band, links to
   /performance); Vitality also becomes a listed cellar tab.

## Protections (restated for the build agents)

- Client-side LCA calculator (lib/product-lca-calculator.ts) and every call
  site contract: presentation only, never move or rewrite.
- useRecipeEditor, PackagingWizard, PackagingTemplateDialog + templates: the
  banned inline-row-builder pattern must not creep back anywhere.
- WizardContext step IDs/ordering/validation; SummaryStep PDF + staleness path.
- PillarCard family shared with hospitality; VitalityRing/composite shared with
  the desk and Rosa; score derivation stays server-side.
- Tier gating (product limits, read-only advisors) keeps working everywhere.

## Build order — ALL DONE (10 July)

- [x] 1. Deletions + Rosa repoint + registry. Deleted 10 orphaned route dirs
        (products/detail, [id]/{materials,core-operations,distribution,end-of-life,
        calculate-lca,lca-pdf,report,lca-report}, top-level /lca-report/[id]);
        zero broken imports after (proof they were dead). Kept the shared
        components/lca-report/ tree and salvaged EF31 components. Rosa completed-LCA
        link repointed to the wizard; robots stale entry removed. Registry:
        Vitality is now a listed tab, /cellar prefix + landing added, room name links.
- [x] 2. Landing at /cellar/ (vitality poster, decision 5) + /api/cellar/counts.
- [x] 3. Products list (two-action header, one import door, recut card grid) + new
        (quiet chooser + sections) + import (linear flow, no fake tabs) +
        supplier-matches (statement + chips).
- [x] 4. Hub: gradient orbs deleted, statement + footprint + status chips, ONE
        Create-LCA pill, five icon tabs to quiet mono tabs.
- [x] 5. Recipe skin: mono mode tabs, eyebrows, Import BOM demoted, chips; the
        useRecipeEditor hook / PackagingWizard / templates untouched.
- [x] 6. Wizard chrome: quiet mono step rail (no circles/timer/Sparkles),
        WizardSidebar's AI folded into Rosa (decision 2; AI-suggestion paths
        deleted, static help bridged to Rosa context), CalculationStep theatre to
        one line with the calculateProductLCA contract byte-for-byte intact.
- [x] 7. Library (THE CELLAR eyebrow, figures row, honest ISO count, dead Filter
        removed, About foot section) + nature (LEAP tabs stay quiet tabs to keep
        autosave; progress to mono line; pills to chips).
- [x] 8. Vitality recut: PillarCard restyled in place (no gradients/emoji/glows),
        hospitality stays intact via the unchanged API; double composite fetch
        collapsed to one.
- [x] 9. Sweep: mobile 375 clean (no horizontal scroll), tsc exit 0, zero
        ccff00/off-palette in product pages, IngredientRow/PackagingRow medallions
        quietened, vitality band-sentence grammar fixed ("needs attention"),
        four user-facing em dashes fixed (product guide x3, BOM loading, facilities
        total). One dead API route (ai-suggestions) left orphaned, flagged.

## Verification note (10 July)

Visually verified on :8891: the landing, products list, the hub (seeded product),
recipe editor, LCA library, nature, vitality (incl. the copy fix). The compliance
WIZARD's multi-step body is data-gated (`if (!pcfId) return null` plus a
recipe/materials requirement) and renders empty for a bare demo product, so its
step chrome (mono rail, folded sidebar, CalculationStep line) is verified
STRUCTURALLY ONLY: tsc clean, shell renders correctly, no runtime or server
errors. Recommend a click-through on a real product with a full recipe (e.g. an
Everleaf product on a seeded org) to confirm the step rail visually.

## What does not change

- All data flows, calculations, autosave, PDF generation (PDFShift), template
  systems, tier gating, Rosa context slices.
- URLs of every surviving surface.
- No migrations. No prod. Local preview only, as ever.
