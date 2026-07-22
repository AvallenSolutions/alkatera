# End-use scenarios: one product, one core LCA, many journeys

**Written 21 July 2026.** Companion to `tasks/lca-experience-plan.md` (the
dossier plan). That plan re-conceives how an LCA is created and confirmed;
this one re-conceives how many LCAs a product needs. The answer is one.

---

## 1. The problem

A user raised it directly: the same product sold into two channels (a bar and
retail) requires two complete LCAs today. Same liquid, same bottle, same
recipe, same facility. The only things that differ are the journey to the
customer, what happens while it is being used, and which bin it ends up in.

The cost of the current model:

- **Everything upstream is entered and maintained twice.** Recipe, packaging,
  facility allocation, factor matches: duplicated per channel.
- **The numbers drift.** Recalculate one and not the other and the same
  product now has two conflicting cradle-to-gate footprints. Nothing detects
  this.
- **Both burn the customer's LCA quota** (`max_lcas` counts PCF rows).
- **The liquid template makes the anti-pattern cheaper to commit**, not
  better: it lets you stamp out the duplicate product faster, then leaves the
  copies to drift independently.

## 2. The concept

**Split the footprint where the physics splits it.** Everything up to the
gate (ingredients, processing, packaging) is identical for a SKU regardless
of where it is sold. Everything after the gate (distribution, use phase, end
of life) varies by channel. So:

> One product has one core LCA, computed once, and any number of **end-use
> scenarios**: named bundles of downstream assumptions layered on the shared
> core. Footprint per scenario = core + that scenario's downstream stages.

This is not a convenience hack; it is how the standards already work. EPDs
under EN 15804 are declared in modules (A1-A3 core, downstream modules added
per scenario). ISO 14067 and the GHG Protocol Product Standard treat
downstream stages as scenario-modelled and require the scenario assumptions
to be documented. PEF publishes default distribution and EoL scenarios per
channel for exactly this purpose. Two full LCAs for one SKU was always the
methodological workaround; scenarios are the orthodox form.

### The two axes, and which one this plan covers

| Axis | Example | Mechanism | Status |
|---|---|---|---|
| Same liquid, different pack | 70cl bottle vs keg vs can | Liquid template (scaled copy at apply time, `ingredients_templates` + maturation) | **Exists.** Different cradle-to-gate, so genuinely different products. Out of scope here. |
| Same SKU, different end use | Bottle to a bar vs bottle to retail | **End-use scenarios on one PCF** | **This plan.** |

Known limitation of the template axis, noted and deliberately deferred: it
copies rather than links, so a recipe correction on one format does not
propagate to sibling formats. If that generates support noise, live-linking
is a future plan. Nothing in this plan makes it harder.

## 3. Why the seams already exist

This lands softly because the codebase already separates exactly the right
things:

- **The PCF stores downstream state in three dedicated columns**:
  `distribution_config`, `use_phase_config`, `eol_config` (plus
  `product_loss_config`), all jsonb on `product_carbon_footprints`. A
  scenario is precisely those blobs with a name.
- **The aggregator already buckets by stage**: `by_lifecycle_stage` in
  `lib/product-lca-aggregator.ts` reports `distribution`, `use_phase` and
  `end_of_life` separately from `raw_materials`/`processing`/`packaging`,
  and the PCF row carries per-stage totals (`total_ghg_transport`,
  `total_ghg_use`, `total_ghg_end_of_life`).
- **The downstream maths is local and cheap.** Distribution is transport
  legs times DEFRA factors times shipped weight
  (`lib/distribution-factors.ts`); use phase is refrigeration/carbonation
  factors; EoL is pathway percentages over material masses already on the
  PCF. No OpenLCA round-trips. Computing a scenario is milliseconds, so
  recomputing every scenario on every recalc is free.
- **The dossier already has the right sections**: `lib/lca/dossier.ts`
  defines `distribution` and `after` (use phase, end of life). Scenarios are
  a dimension added to those two sections; the other sections are untouched.
- **The ask queue and provenance vocabulary** carry the confirmation flow
  unchanged: a scenario's preset values are `estimated`, confirmations flip
  them, the gate reads the share.

One genuine subtlety, so it is stated here rather than discovered later:
**`product_loss_config` couples downstream to upstream.** Losses at
distribution/retail/consumer are applied as an upstream multiplier per ISO
14044 (more units produced per unit consumed). Two scenarios with different
loss rates therefore report different core contributions per functional
unit. The model handles this cleanly: the shared core is computed once, and
each scenario applies its own loss multiplier as a scalar over it. Cheap,
but it means "core" in the UI copy should say "shared", not "identical".

## 4. Data model

New table (timestamp chosen at build time; note redesign's own duplicate
`20260714200000` must be renumbered first, per the cutover handoff):

```sql
CREATE TABLE public.pcf_end_use_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pcf_id uuid NOT NULL REFERENCES public.product_carbon_footprints(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  name text NOT NULL,                    -- "Retail (off-trade)"
  channel text NOT NULL CHECK (channel IN
    ('on_trade','off_trade_retail','dtc','export','custom')),
  is_primary boolean NOT NULL DEFAULT false,
  share_pct numeric CHECK (share_pct >= 0 AND share_pct <= 100),
                                         -- share of annual volume; null until asked
  distribution_config jsonb,             -- same shapes as the PCF columns
  use_phase_config jsonb,
  eol_config jsonb,
  product_loss_config jsonb,
  stage_results jsonb,                   -- computed downstream impacts + adjusted totals
  computed_at timestamptz,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,  -- estimated/confirmed per sub-config
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pcf_id, name)
);
-- exactly one primary per PCF (partial unique index on (pcf_id) WHERE is_primary)
-- RLS: standard org-membership pattern, advisor-read via resolveAccessibleOrg
```

Rules:

- **Scenarios do not count against `max_lcas`.** The quota function counts
  `product_carbon_footprints` rows; scenarios live in their own table, so
  this holds structurally. A scenario is not a new study. (Pricing decision
  1, below.)
- **Versioning follows the PCF.** One active PCF per product and reference
  year, supersede never overwrite: that model is sacred. On supersede,
  scenarios are copied forward to the new PCF version (configs and
  provenance; results recomputed).
- **Compatibility by mirroring.** The existing PCF columns
  (`distribution_config` etc.) become a mirror of the **primary scenario**.
  On first scenario creation, the PCF's current configs are lifted into
  scenario one (primary). Writers update the scenario and the mirror
  together; old readers (wizard, existing PDF path, main-era queries)
  keep working unmodified until they are migrated. The mirror is removed
  only in the last phase.
- **Boundary bounds the scenario.** Scenarios exist only where the declared
  boundary reaches past the gate, and a scenario never widens the boundary:
  a cradle-to-shelf study gets distribution scenarios but no use/EoL
  variance. Cradle-to-gate products have no scenario UI at all.

## 5. Calculation

Extract a pure function, the one real piece of engine work:

```
computeDownstreamStages(core: CoreResults, scenario: ScenarioConfigs) -> StageResults
```

- Pulled out of `calculateProductLCA`'s existing distribution/use/EoL/loss
  paths without changing them; the calculator then calls it for the primary
  scenario so the wizard path is bit-identical.
- **Correctness anchor:** a golden test asserting that
  `computeDownstreamStages` over a completed PCF's stored core and configs
  reproduces that PCF's stored downstream stage numbers exactly, in the
  spirit of the packaging parametric golden test. This is what makes the
  refactor provable rather than hopeful.
- Every `lca/recalc.requested` run (dossier plan phase 1) finishes by
  recomputing all scenarios for the PCF: one core computation, N cheap
  downstream passes, all stored in `stage_results`, one `computed_at`.

## 6. The headline number

With multiple scenarios there must be one declared number, or someone quotes
the flattering one.

- **When channel shares are known** (`share_pct` set): the poster shows the
  **sales-volume-weighted footprint** across scenarios, with the per-channel
  range visible ("2.1 to 2.6 kg CO2e depending on route to customer").
  Methodologically this is the best single number the product has.
- **Until shares are known**: the primary scenario's number, chip-labelled
  `estimated` mix, with an ask in the queue ("Roughly what share of this
  product goes to bars vs shops?", worth its impact spread).
- **Corporate roll-up uses the weighted mix.** `lib/calculations/corporate-
  emissions.ts` currently takes the product's single footprint; wiring the
  weighted scenario figure in makes Scope 3 quietly more honest.
- Exports always name their scenario: "Cradle-to-grave, retail scenario",
  per ISO 14067's scenario-documentation requirement. The machine-authored
  methods section states each scenario's assumptions; that requirement is
  what the methods section exists for.

## 7. The experience

In the dossier (`/products/[id]/dossier`), nothing changes for a product
sold one way. The scenario machinery appears only when it earns its place:

- The **distribution** and **after it is sold** sections gain a channel
  switcher: quiet tabs ("Retail", "On-trade"), each row keeping its own
  provenance chip per scenario. The 20 July distribution card (three states,
  presets, live delta, save-and-supersede) is the template; a scenario is
  that card's state, named and kept.
- **Creating a scenario is one action**: "Sold somewhere else too?" offers
  the channel presets. Picking "On-trade" seeds PEF/category defaults for
  draught-or-bottle journey, glass-washing use phase, commercial waste EoL,
  every value chip-labelled `estimated`.
- **The asks do the confirming.** New sweep source alongside the dossier-gap
  asks: unconfirmed scenario share, unreviewed preset distances, EoL region
  per channel. Impact-ordered like everything else.
- **The poster** shows the weighted number and the range once a second
  scenario exists.
- **Rosa** gets the scenario state through `get_lca_dossier` and can propose
  scenario confirmations through the same `propose_confirm_dossier_section`
  path, so the whole flow works conversationally.
- **The gate** applies per scenario: exporting the retail PDF requires the
  retail scenario's confirmed share to pass, not the bar's.

## 8. The build, in four phases

**ALL FOUR SHIPPED, 21-22 July 2026** (commits 22b693ad, ce0444e9, 46e4ce62,
9610a74e, f699d1d0 on `redesign`, local only). Migration
`20260721100000_pcf_end_use_scenarios.sql` is applied LOCALLY only; staging
and prod still pending. Decisions taken: scenarios free and uncapped,
volume-weighted headline, existing duplicate products left alone with a merge
tool deferred.

Sequenced so each ships value alone; nothing touches the wizard.

### Phase 1: the engine seam
Extract `computeDownstreamStages` + the golden reproduction test. Calculator
calls it for the existing single-config path. Zero behaviour change,
provably.
*Exit: golden test green on real completed PCFs; wizard output bit-identical.*

### Phase 2: schema and compute
The table, RLS, the lift of existing configs into primary scenarios, the
mirror rule, recalc recomputing all scenarios, supersede carrying them
forward.
*Exit: a second scenario created via API computes correct downstream numbers
and survives a supersede; quota provably uncharged.*

### Phase 3: the dossier surface
Channel switcher on the two downstream sections, one-action scenario
creation with presets, weighted poster number and range, share ask, scenario
asks in the sweep, Rosa tool extension.
*Exit: a founder models bar vs retail from the dossier alone in under a
minute, and the asks arrive.*

### Phase 4: outputs
Scenario-named ISO PDF and exports behind the per-scenario gate, weighted
corporate roll-up, passport wording.
*Exit: two channel PDFs for one product, one quota slot, corporate Scope 3
using the weighted mix.*

## 9. What this plan deliberately does not do

- **No changes to main.** Consistent with the dossier plan; the wizard and
  the one-LCA-per-SKU model keep working for current customers until the
  cutover.
- **No pack-format modularisation.** The liquid template owns that axis;
  live-linking templates is a separate future plan.
- **No per-scenario recipe or packaging overrides.** The moment packaging
  differs it is a different product with its own PCF, by design. The scenario
  schema has no material references, which keeps that door closed.
- **No new LCA methodology.** Same factors, same allocation defaults (EoL
  cut-off), same boundary vocabulary. Scenarios re-use what the study
  already declares.

## 10. Decisions for Tim

1. **Quota: scenarios are free.** Recommended: yes. A scenario is not a
   study; charging for it recreates the duplication incentive. If a
   commercial cap is wanted later, cap scenarios per product, not against
   `max_lcas`.
2. **Launch preset set.** Proposed: On-trade, Retail (off-trade), Direct to
   customer, Export. Custom always available.
3. **Headline rule.** Recommended: volume-weighted when shares known,
   primary scenario until then, range always visible once two scenarios
   exist.
4. **Timing.** Phase 1 and 2 are independent of the dossier plan's own
   phases and could start now; phase 3 lands best after the dossier plan's
   phase 2 (the surface it extends) is stable. Confirm the interleave.
