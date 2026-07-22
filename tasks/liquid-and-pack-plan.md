# Liquids and packs: the product becomes a composition

**Written 22 July 2026**, from a review of product creation on the redesign
branch. Third of a set: `tasks/lca-experience-plan.md` re-conceives how an LCA
is confirmed, `tasks/lca-end-use-scenarios-plan.md` how many LCAs a product
needs downstream, and this one how a product is built upstream. It also builds
directly on the duplication audit (`tasks/product-data-duplication-plan.md` on
`claude/product-data-duplication-audit-0dce12`), which diagnosed the root
cause this plan finishes fixing.

---

## 1. What the review found

Three findings, one of them good news.

**Batch-first recipes are already built, end to end.** The ask was: let users
enter a recipe for a batch and have the platform derive per-bottle amounts.
That shipped in the product-creation remediation: `RecipeModePicker` asks "How
do you measure your ingredients?" with three modes (`per_unit`, `per_batch`,
`per_chain` for multi-stage production), `products` carries
`recipe_scale_mode` + `batch_yield_value/unit` with a CHECK constraint, and
the calculator divides through `computeBottlesPerBatch` (3500 L batch at
700 ml = 5000 bottles) or the production-chain divisor. A brewer can enter the
brew sheet as brewed. What remains is not building it but making sure users
find it: the mode picker exists, but nothing in onboarding or the asks points
a batch producer at it.

**The duplication audit already named the disease.** Its root cause F1: facts
that belong to a supplier, an ingredient or a facility are stored on the
product row, so a producer with 12 SKUs sharing one malt enters that malt's
origin 12 times. Its Phase 2 promotes the ingredient and the supplier-product
to first-class records. That work is right and this plan depends on it.

**But the audit stops one level short of the recipe.** The liquid itself, the
thing a distillery actually makes, still has no home of its own. It lives as
rows on one product, and the only reuse mechanism is `ingredients_templates`:
a stamp, not a link. Apply a template to three bottle formats and you have
three copies that drift the moment one is corrected. The template is a
workaround carrying the weight of a missing entity, exactly the pattern F1
describes, applied to the recipe as a whole rather than its lines.

## 2. The answer to "should liquid and packaging build separately?"

Yes, and the shape is already implied by everything around it:

> **A product is a composition: one liquid, at a fill volume, in one pack
> format, sold through one or more routes to market.**

- **Liquid**: the recipe (ingredients + maturation + production stages),
  defined at whatever scale the producer actually measures (per batch, per
  1000 L, per unit) using the batch machinery that already exists. Owned once,
  **linked** into products, never copied. Correct the malt origin once and
  every format follows.
- **Pack format**: bottle/can/keg with closure, label, secondary and tertiary
  packaging, built on the parametric material classes. `packaging_templates`
  already exists and gets promoted the same way (the audit's Phase 2 fix for
  its material-class round-trip is a prerequisite).
- **Product (SKU)**: a liquid at a fill volume in a pack format. Creating one
  becomes three picks, not forty fields. The scenarios work already covers the
  fourth axis: the same SKU down different channels.

The full matrix, with each fact entered exactly once at its own level:

| Level | Entered once | Serves |
|---|---|---|
| Ingredient / supplier (audit Phase 2) | origin, factor match, transport | every liquid using it |
| **Liquid (this plan)** | recipe at batch scale, maturation, stages | every format of it |
| **Pack format (this plan)** | materials, weights, shared packaging | every product in that format |
| Product | fill volume, name, identity | its channels |
| Route to market (shipped) | journey, use, end of life | its exports |

## 3. Why this is safe to build

**The calculator contract is untouched.** `product_materials` stays exactly
what it is: the per-product material rows the sacred calculator reads. Liquid
and pack become authoring-layer entities that *write* those rows, the same
mirror pattern the scenarios table uses for the PCF's config columns, already
proven this week. No engine change, no golden-number risk.

**Propagation infrastructure exists.** Editing a liquid dispatches
`lca/recalc.requested` per dependent product, debounced, exactly as recipe
saves do today. The dossier plan's phase 1 built this path; the liquid entity
just fans it out.

**The migration is mechanical.** Every existing product's ingredient rows
become a liquid of one product (1:1, nothing moves, nothing recomputes).
Identical-liquid detection then *proposes* merges, mirroring the decision
already taken for duplicate products: leave them working, offer the merge,
never rewrite customer data silently.

## 4. The build, in three phases

Sequenced after the audit's Phase 1 (org/facility inheritance) and Phase 2
(ingredient/supplier promotion), which remove most of the typing this plan
would otherwise inherit.

### Phase L1: the liquid entity
`liquids` table (org-scoped: name, recipe scale mode, batch yield, maturation,
stages) + `products.liquid_id`. Recipe editor edits the liquid; saves fan out
derived `product_materials` to every linked product and dispatch recalcs. The
1:1 migration lifts every product's current recipe into its own liquid, so day
one changes nothing anyone sees.
*Exit: correcting one ingredient in a liquid updates every format's rows and
footprints without another click.*

### Phase L2: the pack format entity
Promote `packaging_templates` from stamp to link the same way:
`pack_formats` + `products.pack_format_id`, carrying the parametric
material-class fix from the audit. Shared packaging (`units_per_group`) rides
along unchanged.
*Exit: one glass-weight correction reaches every product in that bottle.*

### Phase L3: composition as the creation flow
"New product": pick a liquid (or start one), pick a pack format (or start
one), type the fill volume. Estimate-first birth (dossier plan phase 4) fires
from the composition, so the product lands in the cellar with a number the
same minute. `ingredients_templates` retires: a template is just a liquid
nothing links to yet, and existing templates migrate as exactly that.
*Exit: second-format-of-an-existing-liquid takes under a minute and asks for
nothing already known.*

## 5. DEFRA road freight, separately

The 2026 conversion factors were published 11 June 2026. HGV tonne-km factors
rose 12 to 13 percent against 2025, driven by lower observed payloads, so this
is not cosmetic: every distribution stage will move when the update lands.

- The live code path has no hardcoded factor (it throws if the row is
  missing), so this is a data operation: load the 2026 transport rows into
  `staging_emission_factors` from the official spreadsheet, via the admin
  reference-data surface per the house rule, on staging first.
- Update the "DEFRA 2025" labels in `lib/utils/transport-emissions-calculator.ts`
  comments and factor names at the same time, and the local dev seed.
- Because distribution figures will rise, fold the update into the same
  customer-communication moment as the parametric-packaging recalc rather
  than letting numbers move twice in a month.

## 6. Decisions (settled with Tim, 22 July 2026)

1. **Sequencing: audit Phases 1 and 2 first**, then L1 to L3. They shrink
   every form this plan composes.
2. **Identical-liquid merges: propose-only.** The platform detects and
   proposes; the user holds the authority to merge. Never silent.
3. **Propagation: automatic.** A liquid edit recalculates every linked
   product, and the dossier says why the number moved ("recalculated because
   the recipe changed").
4. **Templates: retire the feature, keep the mapping until cutover.** The UI
   goes at L3, but `ingredients_templates` and the template-to-liquid
   conversion survive until the production import has actually run: customer
   templates on the production platform are real work, and they come across
   as liquids nothing links to yet (lossless: source volume, items and
   maturation are all a liquid needs). The table drops only after cutover
   data lands, not when L3 ships.

---

## 7. Progress log

### Audit Phase 1 complete (22 July 2026, branch `redesign`)

Build item 1 of 5. Commits `d1ab8e87`, `6a7e3bc9`, `fe6bd7cb`, `9e0fa9f1`.

- **EPR inheritance.** `lib/epr/inheritance.ts` is the one cascade (row →
  organisation → platform), shared by the forms, the gaps page and the
  submission generator, which each carried their own version. Measured on real
  local data (alkatera Drinks Co, 31 packaging rows): 31 gaps / 67 questions
  became 5 gaps / 5 questions, and the 5 survivors are all EPR material type,
  a fact no higher level can answer. `BulkEditStep` deleted; the EPR wizard is
  15 steps.
- **Facility hybrid overrides** persist to `facilities.default_hybrid_overrides`
  and seed every allocation. They previously survived only inside a single
  run's `draft_data` blob and were dropped entirely on facility save.
- **EoL region and consumer market** default from `organizations.country`. The
  wizard never loaded the organisation record at all.
- **Bug X4** closed both ways: `maturation_profiles.warehouse_facility_id`
  gives the warehouse country a home, and the synthetic warehouse row is
  dropped when that facility's measured electricity already covers the period.
  Narrow by decision: only fires once a warehouse is explicitly named, so no
  existing footprint moves until a user opts in.

New shared component `components/studio/inherited-field.tsx` carries the
audit's P2 (inherit with override) and P3 (derive, then state the assumption).
Phase 2 reuses it rather than reimplementing the pattern per form.

Migration `20260722100000_phase1_inheritance_homes.sql` — **APPLIED TO PROD 22 Jul 2026**.

**Next: audit Phase 2**, promoting `ingredients` and `supplier_products` to
first-class records. Then L1, L2, L3.

### Audit Phase 2, first pass (22 July 2026)

Commits `5de241d5`, `1a32fa14`. Migration `20260722110000_ingredients_first_class.sql` — **APPLIED TO PROD 22 Jul 2026**.

- **Packaging templates** round-trip `packaging_material_class` and
  `packaging_material_variant` again. Both were missing from both directions,
  so a restored row came back with no class and the next save NULLed the
  column, dropping the row out of the parametric factor path. The hook had no
  test at all; it has one now.
- **Supplier-declared facts** stop being dropped. Recyclability, end-of-life
  pathway and organic certification all have a home on the material row and
  were being discarded. Extracted to `lib/suppliers/declared-facts.ts` so the
  rule exists once. Two guards: never overwrite an answer the user gave, and
  never assert a certification the supplier did not claim.
- **`ingredients` is a real record.** Find-or-create on save, `material_id`
  populated for the first time, facts accumulated rather than overwritten.
  Verified end to end: 6 records created from the demo gin, 6 rows linked,
  second save idempotent.

Still open from Phase 2:
- Move origin address/coords/country, transport legs and the inbound delivery
  container to `supplier_products` and inherit them via
  `ingredients.default_supplier_product_id` (the column exists; nothing reads
  it yet). `supplier_products.origin_address` has carried the comment "Can be
  overridden at material level" since it was created.
- Surface the ingredient record in the UI: the recipe editor writes it but
  nothing lets a user browse, edit or merge ingredients yet, and a second
  product does not visibly inherit from the first.
- Duplicate-ingredient detection and the propose-a-merge flow.

Then L1, L2, L3.

### Audit Phase 2 complete, L1 landed (22 July 2026)

Commits `a5f6e311`, `e56b3eb4`, `5dd032b1`. Migrations `20260722120000` and
`20260722130000` — **both APPLIED TO PROD 22 Jul 2026**. Post-run check on prod:
20 liquids / 20 products linked / 20 products with a recipe, the invariant the
1:1 backfill is supposed to produce.

**Phase 2 finished:**
- `supplier_products` gained `transport_legs` and the six `inbound_container_*`
  columns, so the route from an origin and the container it arrives in have a
  supplier-level home. `supplierDeliveryDefaults()` replaces the origin block
  that was duplicated in both link handlers.
- The recipe editor's load path overlays each row's ingredient record, so a
  second product opens with the factor, biogenic flag, organic status and farm
  link already answered.
- `is_organic_certified` is now null-means-inherit. The column is nullable, so
  null genuinely means "nobody has said"; `|| false` collapsed that and pinned
  every row. `is_biogenic_carbon` is NOT NULL and cannot express it, so that
  asymmetry is stated in the code rather than being an accident.
- The ingredient shelf at `/products/ingredients`: what the organisation buys,
  which products use each, and duplicates proposed (never merged).

**L1 landed:** `liquids` + `products.liquid_id`, 1:1 backfill (21 products →
21 liquids locally), and recipe saves fan out to every product sharing the
liquid, with a recalc requested for each. Exit criterion met and verified.

Still open before L2:
- The liquid has no UI of its own yet. Nothing lets a user name a liquid,
  browse liquids, or point a second product at an existing one, so the shared
  case is reachable only from the database today. That is the first L1
  follow-on and the thing L3's composition surface builds on.
- Maturation and production stages still hang off the product, not the liquid.
  The plan lists them as part of the liquid; moving them is a separate slice.
- Identical-liquid detection and the propose-a-merge flow (decision 2), which
  can reuse the ingredient duplicate-detection shape.
- `ingredients_templates` retirement stays deferred to L3 per decision 4.

### The liquid UI (22 July 2026)

Commit `3f738486`. No migration.

- **The liquid shelf** at `/products/liquids`: what the organisation makes,
  which formats bottle each, identical recipes proposed, and a merge that
  repoints products rather than rewriting any material row (so no footprint
  moves and nothing needs recalculating).
- **LiquidStrip** on the recipe editor: "Made from", a warning naming the other
  formats an edit will reach, and the second-format flow that adopts an
  existing liquid's recipe.
- Identity is exact, not fuzzy, and units are not converted. A recipe is the
  product, so a wrong merge proposal is worse than a missed one.
- Switch ordering extracted to `lib/products/switch-liquid.ts`: donor read
  before clearing, link set last, nothing cleared when there is no recipe to
  adopt.

Two org-mismatch bugs of the same class have now been found and fixed (the
ingredient save path, the liquid picker). Both came from trusting the browser's
current organisation instead of the product's. Worth grepping for the pattern
before L2 rather than finding a third.

Still open before L2:
- Naming a liquid. The shelf lists them and the strip picks them, but a liquid
  is still named after whichever product it was lifted from and cannot be
  renamed. That is the smallest remaining gap and the most visible.
- Maturation and production stages still hang off the product, not the liquid.
- `ingredients_templates` retirement, deferred to L3 per decision 4.

### Post-migration state on prod (22 July 2026)

All four migrations applied. `liquids` = 20, `products.liquid_id` set on 20,
20 products have a recipe. The invariant holds.

**One thing the migrations deliberately do NOT do:** there is no backfill for
`ingredients` or for `product_materials.material_id`. Ingredient records are
created by the recipe editor's find-or-create on save, so on prod today:

- the ingredient shelf at `/products/ingredients` is empty,
- `/api/emissions/inventory` returns no rows (it no longer 42703s, but there is
  nothing to return), so the Xero inventory linker still shows its empty state,
- ingredient-level inheritance does nothing yet.

All three fill in per product as recipes are saved. A backfill is possible
(insert distinct `product_materials.material_name` per org, then set
`material_id`) and would make the shelf useful immediately, but it writes
customer data on the basis of name-matching, which is the thing the duplicate
decision says to propose rather than do. Not written; raise with Tim if the
empty shelf is worth more than that caution.

### Naming, and L2 (22 July 2026)

Commits `806f9822` (naming), `00b5c0d1` (L2). Migration
`20260722140000_pack_formats.sql`, **pending prod**.

- **Liquids can be renamed** inline on the shelf. The backfill named each after
  whichever product it was lifted from, which stops being right the moment two
  formats share one.
- **L2 landed.** `pack_formats` + `products.pack_format_id`, 1:1 backfill (12
  products with packaging → 12 formats locally), fan-out on packaging save,
  identity + propose-only merge, a shelf at `/products/packs`, a PACKS tab, and
  the strip on the packaging tab.

L1's machinery was generalised rather than copied: `composition-fanout`,
`switch-composition` and `composition-identity` now serve both halves,
parameterised by link column and material type. `/api/liquids/merge` became
`/api/compositions/merge`. Copying tested logic would have been the exact
failure this programme exists to remove.

`pack_formats` is deliberately thin. The first draft denormalised container
format/material/size onto it; that is a second home for facts that live on
`product_materials` and would drift on the first correction. A pack's spec is
its rows.

Still open:
- **L3**: composition as the creation flow (pick a liquid, a fill volume, a
  pack), estimate-first birth, and `ingredients_templates` retirement.
- Maturation and production stages still hang off the product, not the liquid.
- The entry-design ladder (§7 of tasks/liquid-pack-entry-design.md): brew sheet
  extraction, spec sheet → pack, archetypes, Breww, the supplier flywheel.
- Audit Phase 3 (wizard reads/writes canonical) and Phase 4 (duplicate tables).
- The org-mismatch grep: two found and fixed so far, both from trusting the
  browser's current organisation over the product's.
