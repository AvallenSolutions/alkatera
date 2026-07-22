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

Migration `20260722100000_phase1_inheritance_homes.sql`, applied locally and
re-run clean; **pending prod**.

**Next: audit Phase 2**, promoting `ingredients` and `supplier_products` to
first-class records. Then L1, L2, L3.
