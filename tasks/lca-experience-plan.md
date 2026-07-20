# The LCA experience plan: from wizard to dossier

**Written 20 July 2026, from a full review of the compliance wizard on main.**
This plan is the basis for how LCAs are created in the redesign. The main
platform will not change; everything here lands in the cellar.

---

## 1. The diagnosis

Three findings from the review, each with a number attached.

**A completed LCA costs a founder 45 to 55 discrete actions.** Roughly 5 to
create the product, 16 to 20 in the recipe editor (the substantive data), and
22 to 28 in the wizard itself, of which about 9 are bare "Next" clicks. The
wizard ranges from 10 steps (cradle-to-gate) to 14 (cradle-to-grave).

**About half the wizard is not data entry, it is ISO paperwork.** Goal &
Purpose, Cut-off, Data Quality, Critical Review and Interpretation collect
methodology documentation, and every one of them auto-fills with standard
wording that passes its own validation (`STANDARD_ISO_TEXT` in
`WizardContext.tsx`, auto-seeded coverage text in `DataQualityStep.tsx`).
A founder either burns an hour writing ISO prose they do not understand, or
clicks "Mark Complete & Continue" through machine boilerplate that then
appears in a signed report as if a human considered it. Both outcomes are bad;
the second is quietly worse.

**The remaining friction is the platform asking for what it already knows or
could infer.** The per-material factor "Fix" loop (one manual search per
unmatched ingredient), facility volumes re-typed when `annual_production_volume`
and Breww hold them, three separate country pickers with no reuse, the silent
50 km distribution default that passes validation untouched, and an EoL
recycling-allocation dropdown that can flip the headline number, offered with
an ISO clause citation as its only help.

The wizard is an ISO 14044 practitioner's tool wearing a wizard costume. Our
users are drinks founders. The redesign already states the answer as a
principle: **you never fill in an empty form. Correcting beats authoring.**
The wizard is the last big surface that predates that principle. The cellar
pass deliberately restyled its chrome and left the machinery untouched; this
plan is the re-conception that pass deferred.

---

## 2. The concept: the LCA is a dossier, not a form

Stop treating an LCA as a thing a user *makes* by walking a corridor of steps.
Treat it as a thing the platform *maintains* and the user *confirms*.

**Every product has a footprint from the day it exists.** The arrival ritual
already creates estimate PCFs from volumes. Extend that birthright to every
product however it arrives (GiveDoor document, pasted URL, CSV, manual,
Breww): the moment a product has a recipe sketch, the platform computes an
estimated footprint with every input provenance-labelled `estimated`. There is
no "create an LCA" moment and no empty state, only a number that starts rough
and honest.

**The LCA surface is a dossier in the cellar.** One page per product footprint:
statement, the plum poster carrying the number, a provenance rollup ("62% of
this footprint is confirmed"), and the dossier sections below as fact rows,
each carrying its provenance chip. The user's job on this page is to look at
what the platform believes and correct it. This replaces the wizard as the
default surface.

**The few genuine questions become asks.** Everything the platform truly
cannot know goes through the existing ask queue, one plain-language question
at a time, ordered by impact share ("this question is worth 12% of your
footprint"). Everything else is drafted or estimated and labelled as such.

**The paperwork becomes machine-authored and says so.** Goal & scope, cut-off,
data quality, interpretation: written by the platform, shown in the dossier as
"Standard methodology, applied by alka**tera**", editable behind "Open the
full record" for the rare expert. The data-quality section stops asking the
user to describe their own temporal coverage in free text and instead computes
it from the factors actually used (the pedigree work shipped 20 July on
`claude/lca-temporal-score-eaa66a`: shared year parser, database vintage
table, impact-weighted pedigree matrix). Honesty comes from provenance chips
and the confirmed-share gate, not from forcing a founder to retype boilerplate.

**Trust is enforced at the exit, not the entrance.** Internal views (desk,
vitality, forest) compute from estimates, as the data revolution already
decided. The ISO PDF, exports and the passport sit behind the existing 80%
confirmed-share gate (`lib/provenance/gate.ts`). An unreviewed 50 km guess can
inform a dashboard; it cannot ship in a signed report.

### What the user experiences

Day one: drop a spec sheet in the GiveDoor. The product appears in the cellar
with an estimated footprint the same day, zero questions asked. Over the next
week, the ask queue surfaces perhaps six to eight questions, biggest first:
"Roughly how far do your bottles travel to customers?", "Is this glass weight
right: 480 g?", "You make this at Sompting; how many units a year?". Each
answer flips a chip from `estimated` to `confirmed`, the number firms up, the
forest grows. When the confirmed share crosses the gate, the export unlocks
and the PDF that comes out is the same ISO-structured document as today,
except the methodology text is honestly attributed and the data-quality tables
are computed, not typed.

Target: **zero actions to a first number; eight or fewer confirmations to an
exportable LCA.** Down from 45 to 55.

---

## 3. What survives untouched

The machinery is sacred; only the experience around it changes.

- `lib/product-lca-calculator.ts` (`calculateProductLCA`) and its contract
- `lib/product-lca-aggregator.ts`, `lib/impact-waterfall-resolver.ts` (the
  factor waterfall: supplier data, DEFRA/ecoinvent hybrid, OpenLCA live,
  staging, parametric packaging)
- The recipe editor (`useRecipeEditor`, `RecipeEditorPanel`), `PackagingWizard`,
  the composer pattern, the banned-inline-row-builder rule
- The PDFShift path in `SummaryStep` and the versioning model (one active PCF
  per product and reference year; supersede, never overwrite)
- The provenance vocabulary, ask queue, GiveDoor, growth score, Rosa's tool
  loop, and the studio design canon

The wizard's step *machinery* (WizardContext ordering, per-step validation
gates) is what eventually retires, and only at the end.

---

## 4. The build, in five phases

Phases are ordered so each ships value alone and nothing breaks the wizard
until the dossier has fully replaced it.

### Phase 1: Calculation becomes a service (the enabler)

The calculator is client-side only today, which is why "recalculate" is a
button a human must click in a browser and why every staleness prompt exists.
Nothing in the dossier concept works while a browser session is the only
place a footprint can refresh.

- Extract `calculateProductLCA` so it runs under Inngest as well as in the
  browser (per the house rule: anything over 30 seconds goes to Inngest). The
  OpenLCA calls, factor resolution and aggregation are already plain
  async code; the work is auth context and progress reporting.
- Event: `lca/recalc.requested` with `{productId, trigger}`. Recipe saves,
  packaging library updates, factor-set refreshes and ask answers dispatch it.
  Debounce per product. Results version via the existing supersede path.
- Staleness banners become unnecessary on redesign surfaces: the footprint is
  simply current, with a mono note ("recalculated 3 July, 14:02").
- Exit criteria: a recipe edit updates the footprint with no browser click;
  the wizard still works unchanged.

### Phase 2: The dossier surface (read first, then confirm)

The new default LCA page in the cellar, replacing the wizard as where
`/products/[id]` sends people.

- **Sections:** the number (poster), ingredients & packaging (from the recipe,
  with per-material factor provenance), making it (facility allocation),
  getting it to customers (distribution), after it is sold (use phase + EoL,
  boundary permitting), and the methods (machine-authored goal & scope,
  cut-off, data quality, interpretation, review status).
- Every fact row carries a provenance chip. Confirming is inline: look, adjust
  if wrong, confirm. No step order; sections are visited in any order or never.
- The distribution section is the editable card already specced on 20 July:
  three states (configured, unreviewed default, out of boundary), preset
  scenarios, live delta preview, save-and-supersede. It becomes the template
  for every other section.
- The methods sections render computed content: the pedigree matrix from real
  factor vintages, coverage from actual ingredient origins and facility
  country, the DQI from the aggregator. The three free-text coverage fields,
  the assumptions list gate and the review-type gate are not carried over.
- "Open the full record" links to the wizard for experts, per the demote-not-
  delete principle.
- Exit criteria: a founder can read and confirm an existing LCA end to end
  without opening the wizard.

### Phase 3: The questions move into the ask queue

- A new sweep source in `lib/asks/generate.ts`: dossier gaps. Unreviewed
  distribution default, facility volume missing, EoL region unset, proxy
  factors carrying a large impact share, boundary narrower than the product's
  market suggests. Impact-ordered like every other ask.
- Boundary is reframed in plain language as "how far should this footprint
  follow the product?" with three pictures (to your gate, to the shelf, to
  the bin), defaulted by product category and tier, asked once, confirmable
  from the dossier. The words cradle-to-grave survive only in the mono
  annotation and the PDF.
- The EoL allocation method stops being a user dropdown. Default cut-off
  (consistent with the packaging factor endpoints EoL default), stated in the
  methods section; changeable in the full record only.
- Factor fixing leaves the user's path entirely, completing the data
  revolution decision: confident matches apply silently at recipe save,
  unconfident ones get a Rosa-proposed conservative proxy plus a row in the
  admin factor queue, and the dossier shows the honest chip.
- Rosa: extend her with `get_lca_dossier` (section-by-section provenance
  state) and `propose_confirm_dossier_section`, so the whole confirmation flow
  works conversationally as well as on the page.
- Exit criteria: the six-to-eight questions for a typical product all arrive
  as asks; answering them from the desk updates the dossier and the number.

### Phase 4: Born with a footprint

- On any product acquiring its first recipe materials (from any intake route),
  auto-create an estimated PCF and dispatch the first calculation. Provenance
  `estimated` throughout; the cellar list shows the chip, never a blank.
- Boundary defaults per category; distribution defaults per the scenario
  presets keyed to what the platform knows (market country, D2C flag), always
  chip-labelled, always generating their ask.
- The growth `production` band and vitality already read LCA coverage; wire
  the confirmed share into them so the forest rewards confirmation, not just
  existence.
- Exit criteria: GiveDoor to first number with zero questions asked, same day.

### Phase 5: Retirement and the gate

- Wire the PDF/export/passport paths to the 80% confirmed-share gate with the
  existing `provenance-gate-dialog`.
- The wizard route stops being linked from anywhere except "Open the full
  record". Its Guide step, progress rail, resume banners and per-step Next
  gates are no longer load-bearing. Do not delete the route until a full
  quarter of dossier-only usage has passed cleanly.
- The lca-wizard test plan (`tasks/lca-wizard-test-plan.md`) is superseded by
  a dossier click-through plan; the live-verification note from 15 July
  remains the record of the old surface.

---

## 5. Decisions (settled with Tim, 20 July 2026)

1. **Boundary default: ask.** A category-based default is proposed, but it is
   confirmed through an ask in plain language ("how far should this footprint
   follow the product?"), never silently applied.
2. **Tier gates move to the export.** Estimate freely at any boundary. The
   confirmed export is gated by tier, and a user attempting to export beyond
   their tier's boundary gets an upgrade prompt rather than a dead end.
3. **Facility volumes: derive.** Auto-derived from `annual_production_volume`
   and Breww, confirmed through an ask. Never a required entry field.
4. **PDF wording: approved.** "Standard methodology, applied by alka**tera**"
   attribution stands in the ISO document.

## 6. What this plan deliberately does not do

- No changes to main. The wizard on main keeps working for current customers
  until the migration.
- No rewrite of the calculator, resolver, aggregator, recipe editor or PDF
  pipeline.
- No second assistant, no new room, no new navigation concept. The dossier is
  a cellar surface using the existing kit of parts.
- No dark-pattern shortcuts: every estimate stays labelled until a human
  confirms it, and nothing unlabelled reaches a signed report.
