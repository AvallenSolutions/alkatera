# Entering a liquid and a pack: the design

**Written 22 July 2026.** The entry-experience design for
`tasks/liquid-and-pack-plan.md`. That plan settled what the entities are; this
one settles how data gets into them, before anything is built. The measure of
success: a founder assembles a complete product without ever feeling like they
filled in a form.

The governing rule is the data revolution's: **you never fill in an empty
form. Correcting beats authoring.** Every flow below starts from something the
platform already has or can extract, shows it as a draft with provenance
chips, and asks only the questions nothing else can answer.

---

## 1. What already exists to build on

Verified in code, because designing around imagined machinery wastes everyone's
time:

- **Smart upload** already classifies `bom` (bill of materials),
  `packaging_spec` and `supplier_coa` documents, with self-learning from
  corrections. `RecipeEditorPanel` already consumes BOM extractions.
- **Breww holds batch recipes as brewed**: `/stock-items` (the master
  ingredient catalogue), `/ingredient-batches`, and per-batch stock
  allocations. The client code for all three exists.
- **Batch-mode entry is live**: per unit, per batch with a yield, or a
  multi-stage chain.
- **Supplier products** carry origin address/coords/country, carbon intensity,
  unit measurements and a verification state.
- **Parametric packaging classes** mean a pack needs only class, variant and
  weight to compute, and `packaging-weight-ranges` already knows what a
  plausible weight looks like per category.
- **The ask queue, provenance chips, estimate-first birth and Rosa's tool
  loop** carry the confirmation flow for everything below.

## 2. Where a liquid comes from

A ladder, best source first. The UI presents it as one question, "How do you
want to start?", with the manual path last and never punished.

### 2a. Drop the brew sheet (extend smart upload)
The single highest-value flow. A brew sheet, distillation record, batch
record or BOM goes into the GiveDoor; the classifier already recognises BOMs.
**New work**: a `liquid` extraction target that reads ingredients *at batch
scale* (quantities + batch volume or yield straight off the sheet, since batch
mode already exists to receive them), plus maturation hints (cask type, ABV).
Result: a draft liquid, every line `drafted` provenance, batch yield
pre-filled, named from the document ("Amber Ale 3,500 L"). The user's job is
to glance and correct, not to type.

### 2b. Pull it from Breww (extend the integration)
For breweries, the recipe already lives in software that knows it better than
any document. **New work**: "Import from Breww" on the liquid create surface,
listing recent batches; picking one converts its stock allocations into liquid
lines at batch scale, mapped through the existing stock-item catalogue.
Provenance `drafted` with the batch reference in the hint. This is the
never-enter-twice rule applied across company boundaries: the brewer entered
it once, into Breww, and that counts.

### 2c. Start from a typical one (new: archetype liquids)
A producer with nothing to hand should still get a number today. A small
curated set of **archetype liquids** per category (a typical gin, a typical
session IPA, a typical cider), built from the reference factor sets, each line
`estimated`. Picking one creates a liquid that computes immediately and
generates asks ordered by impact ("your base spirit is 80% of this figure,
what is it really?"). This is the arrival ritual's estimate-first principle
applied to recipes, and it makes the demo moment ("drop nothing, get a
number") honest rather than magical.

### 2d. Type it in (exists)
The recipe editor as it stands, batch-first. Stays the fallback and the
correction surface for everything above.

## 3. Where a pack comes from

### 3a. The supplier declares it (extend supplier portal)
The structurally right answer: a bottle's weight, material class and recycled
content are the *supplier's* facts. **New work**: supplier-declared **pack
components** in the supplier portal, so a glass supplier declares "700 ml
flint bottle, 480 g, 51% PCR" once, verification state and all, and every
customer of that supplier composes it into pack formats by reference. When
the supplier updates the spec, dependent products recalc with the dossier
saying why. This extends the existing supplier-product machinery rather than
inventing a parallel one.

### 3b. Drop the spec sheet (extend smart upload)
`packaging_spec` classification exists. **New work**: route its extraction
into a draft pack format (components with class, variant, weight), not just
into supplier impact data. Same glance-and-correct loop as the brew sheet.

### 3c. Photograph the product (new)
A photo of the finished product is something every founder has. Vision
extraction proposes the component list (glass bottle, aluminium closure,
paper label) with material classes, and *estimated* weights from the
category's plausibility ranges, every value chip-labelled and asked about.
Weight from a photo is a guess and is always presented as one; the ask says
"weigh one empty bottle if you can". This flow exists to remove the blank
page, not to be right.

### 3d. Pick from the library (exists, promoted in L2)
Org pack formats, plus a starter set of typical formats (700 ml spirits
bottle, 330 ml can) built on parametric classes, mirroring archetype liquids.

## 4. The composition surface

One screen, three slots, a number materialising on the right.

- **Slots**: liquid, fill volume, pack format. Each slot offers "pick
  existing" first (with search), then its ladder ("or start one: drop a brew
  sheet / pull from Breww / start from a typical gin"). Starting one opens
  inline, never navigates away; the composition survives.
- **The number forms live.** As soon as both slots hold anything (archetype
  included), the estimated footprint appears with its provenance rollup, the
  same estimate-first birth as the dossier plan's phase 4. There is no moment
  where the screen is a form with a Save button; there is a product taking
  shape.
- **Second-format flow**: from any product, "Same liquid, different pack"
  pre-fills the liquid slot. The under-a-minute case the whole model exists
  for.
- **Asks fire at the end, not during.** The composition never blocks on a
  missing fact; it computes with estimates and queues the questions,
  impact-first. The user decides when to answer them, from the desk or the
  dossier.

## 5. The supplier flywheel (new, the biggest lever)

Today every ask lands on the founder. Many of them are actually questions
about a supplier's product, and the founder answers by forwarding an email.
**New work**: an "ask the supplier" action on any ask whose target is a
supplier-linked line. It sends through the existing supplier survey channel,
the answer lands as a supplier-declared fact with supplier provenance, and it
propagates to every product that references the component, for every customer
of that supplier who links it. Each answered question improves the platform
for more than one org, which is the closest thing this system has to a
network effect. The email-intake machinery (dormant, awaiting the kSuite
mailbox) is the natural return path.

## 6. What Rosa does

All of the above, conversationally. "I make a 5.2% pale ale in 440 ml cans,
2,000 L batches" is enough for Rosa to draft an archetype-based liquid, a
can pack format, and the composition, using the same creation paths as the
screens (new tools: `propose_liquid`, `propose_pack_format`,
`propose_composition`). Rosa proposes, the user confirms; nothing writes
without the confirm step, matching her existing tool discipline.

## 7. Build order for the new pieces

Ordered by value against effort, after audit Phases 1 and 2 and L1/L2 land:

| Piece | Effort | Why this position |
|---|---|---|
| Brew sheet → liquid extraction (2a) | Medium | Highest value; classifier + batch mode + editor all exist, only the extraction target and draft flow are new |
| Spec sheet → pack format (3b) | Small | Classification exists; new routing only |
| Composition surface (§4) | Medium | The L3 flow itself |
| Archetype liquids + starter packs (2c, 3d) | Small | Curated data + one picker each |
| Breww batch import (2b) | Medium | Client exists; mapping UI is new |
| Supplier-declared components + ask-the-supplier (3a, §5) | Large | Biggest structural win; touches portal, surveys, propagation |
| Product photo → pack draft (3c) | Medium | Genuinely new; ship after the others prove the draft-and-correct loop |
| Rosa composition tools (§6) | Small | Thin wrappers once the APIs exist |

## 8. Decisions for Tim

1. **Archetype liquids**: curate an initial set ourselves (recommended: one
   per major category, ~10 to start, factors from the reference sets), or
   launch without and rely on documents only?
2. **Photo-to-pack**: in the first release of the composition flow, or held
   back until the draft-and-correct loop has proven itself on documents
   (recommended: held back)?
3. **Supplier flywheel scope**: start with ask-the-supplier on existing
   supplier-linked lines only (recommended), or hold it until
   supplier-declared pack components ship so both directions land together?
4. **Visual design next**: mock the composition surface and the two draft
   review screens on the Superdesign canvas before build, or go straight to
   build from this document?
