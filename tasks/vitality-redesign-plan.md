# The vitality page: review and redesign plan

`/performance/`, the evidence room's hero surface. Reviewed 24 July 2026.

## What is there now

The page is 1,300 lines and pulls in ~10,900 lines of `components/vitality/*`.
Reading top to bottom, a user meets:

1. Header, still eyebrowed `THE CELLAR · VITALITY` (fixed while reviewing).
2. `EsgVitalityScoreHero` — the ring, the verdict sentence, Rosa's read, a
   12-week trend, then **PILLAR BREAKDOWN**: E / S / G with nine sub-scores
   (Climate 60, Water 46, Circularity 58, Nature 100, Community 6, People 0,
   Supplier ESG 0, Governance 5, Certifications 14), then the weights.
3. A bare `<select>` year picker and "Based on 9 assessed products".
4. `FlagThresholdBanner`.
5. **Four expandable pillar cards** — Climate 60, Water 46, Circularity 58,
   Nature 100. The same four numbers as step 2.
6. `PerformanceSummary` — strengths and areas for improvement.
7. Collapsible: impact hotspots.
8. Collapsible: methodology and reporting.
9. A calculation-methodology panel.
10. Four full-screen sheets behind "View full analysis".

## What is wrong with it

**It states the same four scores twice.** The hero's pillar breakdown and the
four pillar cards are the same data, forty pixels apart. Nothing tells you why
you are reading it again, and the second telling is the one with the boxes.

**Four levels of disclosure for one number.** Pillar card → expand the card →
read the deep-dive → "View full analysis" → a sheet on top of the page. The
house rule from 9 July is "recurse the rhythm, not the navigation"; this is
navigation nested four deep inside a single page.

**Environmental is buried by its own detail while social and governance are
invisible.** The composite is 34 and Rosa correctly says People & culture is
what is dragging it. But the page then spends its entire body on the four
environmental pillars, which are the healthy ones, and offers no way at all to
open Social or Governance. The page argues against its own headline.

**It is a page of boxes.** `rounded-[6px] border border-border bg-card`
appears on every collapsible, every card and every panel. The studio's own
answer — hairlines, one poster, fact rows — is what the rest of the house now
uses.

**Units are raw.** `TCO2EQ`, `M3 WORLD EQ`, `M2A CROP EQ` on the cards. Nobody
outside an LCA practice reads "m2a crop eq".

**The old design is concentrated in five files.** Marker counts (shadcn Card,
`bg-card`/`border-border`, raw red/amber/emerald/blue, `rounded-lg`, `shadow-`,
Badge, Loader2):

| File | Lines | Markers |
|---|---|---|
| `CarbonDeepDive.tsx` | 1,131 | 115 |
| `WasteDeepDive.tsx` | 839 | 81 |
| `WaterDeepDive.tsx` | 1,157 | 72 |
| `CircularitySheet.tsx` | 694 | 63 |
| `Scope3CategoryBreakdown.tsx` | 640 | 42 |

Those five are 4,461 lines and 373 of the ~570 markers on the whole surface.
Everything else is comparatively light.

## The redesign

### The shape

One page, one scroll, three levels at most: **the score → the nine axes → one
axis in full**. The sheets and the in-card expansion both go; an axis opens on
its own route instead.

```
THE EVIDENCE · VITALITY
Your vitality is emerging.                        ← statement, the verdict

[ 34 / 100 · EMERGING ]                           ← the one brick poster
Rosa's read + next move                           ← unchanged, it is good
12-week trend                                     ← unchanged

THE ENVIRONMENT            64                     ← three sections, hairline
  Climate          60   673 t CO2e        →
  Water            46   125,100 m³         →
  Circularity      58   62% recycled       →
  Nature          100   18,700 m² a year   →
THE PEOPLE                  2
  Community impact  6   ...                →
  People & culture  0   Nothing yet        →
  Supplier ESG      0   Nothing yet        →
THE GOVERNANCE              5
  Governance        5   ...                →
  Certifications   14   0 of 1 achieved    →

WHAT WOULD MOVE IT MOST                           ← the improvements, ranked
WHAT IS ALREADY GOOD                              ← the strengths, quieter
IMPACT HOTSPOTS                                   ← fact rows, not a collapsible
METHODOLOGY                                       ← one quiet foot section
```

### The decisions behind it

**One list of nine axes, not two lists of four.** The hero keeps the ring, the
verdict and Rosa's read; the pillar breakdown moves out of the hero and becomes
the page's body, as three `FactList` sections under mono eyebrows. That removes
the duplication and gives Social and Governance the same standing as
Environmental for the first time.

**An axis opens on its own route**, `/performance/[axis]/`, not in a sheet and
not inside the card. Each axis page is a normal studio page — statement, one
poster, fact rows — and re-uses the existing deep-dive body. This is what kills
the four-level nesting: from the vitality page you go *to* an axis, the way you
go from the cellar to a product.

**Plain units on the summary rows, precise units on the axis page.** "673 t
CO2e" and "18,700 m² a year" on the list; "m²a crop eq" stays on the axis page
where the methodology note sits beside it.

**Scores stay typographic.** `BigNumber` for the axis score, `StateChip` for
the band, a hairline rule for the bar. No tinted cards, no badges.

### Data visualisation

The one genuinely new piece of visual work: **a nine-axis profile** at the top
of the body, so the shape of the org is legible in one glance instead of nine
readings. Rendered as nine hairline bars in the three section colours (not a
radar — a radar makes 0 look like a shape, and three of these axes are 0).

Everything else already has a chart; those charts move to the axis pages and
get the studio's chart treatment (`dataviz` skill palette, no default Recharts
colours).

## The scoring problem (reviewed by the sustainability advisor, 24 July)

This started as "the year-on-year sub-score rewards contraction". The advisor
review found the problem is bigger than a weighting choice.

### The finding: `yoy_sub` does not measure emissions

`buildClimateInputs` computes BOTH years from the same per-unit figure — the
single current completed PCF — times each year's production. Its own docstring:

> "Computed from the same per-unit emissions figure × units produced in each
> year (so we're holding product-level intensity constant and only tracking the
> change in volume × mix)."

So `yoy_sub` is arithmetically a **production volume and mix index**. It cannot
detect decarbonisation. Verified in `lib/vitality/environmental.ts` and
`app/api/vitality/composite/route.ts` (the `perUnit` read at ~line 503).

Consequences:

- The label "year-on-year emissions trend" describes something that is not an
  emissions trend. That is a substantiation problem inside our own product.
- **The obvious fix does not work.** Swapping the trend to measure intensity
  change yields identically 0.00% for every org, forever, while one PCF serves
  both years: 26 free points on a 40%-weighted component. Year-vintaged PCFs
  are a prerequisite, and that is a data-model change.

### What the real customer data showed

alkatera Drinks Co: 517.2 t / 848,674 units (2025) → 322.1 t / 528,467 units
(2026). Per-unit 0.6094 → 0.6096. That 0.02% is mix drift, not a measurement:
the system cannot currently tell whether their intensity moved.

Three cases through the actual scoring functions:

| Business | intensity ratio | absolute Δ | intensity_sub | yoy_sub | score |
|---|---|---|---|---|---|
| Shrank 38%, intensity flat | 1.39× | −37.7% | 34 | 100 | **60** |
| Grew 20%, intensity improved 8% | 1.15× | +10.4% | 55 | 19 | **41** |
| Flat volume, intensity improved 8% | 1.15× | −8% | 55 | 94 | **71** |

Rows 2 and 3 are the same business doing identical work, swinging 30 points on
a commercial decision. That is the failure that would lose customers.

### Corrections to what was originally proposed

- **The SBTi justification was wrong on the load-bearing half.** SBTi does NOT
  prohibit meeting a target through output reduction; recalculation is
  triggered by *structural* change (M&A, divestment, method change), not
  organic contraction. Use SBTi descriptively, never normatively, and keep it
  out of user-facing copy. The honest justification needs no standard: a score
  claiming to measure performance must not be dominated by a variable that is
  not performance.
- **Intensity is the measure of EFFICIENCY, not of "a sustainable business".**
  A business can be efficient and still growing its contribution to warming.
  Copy should say: intensity is how we judge whether you are getting better;
  absolute tonnes is what reaches the atmosphere, and it drives your targets.
- **An intensity trend is volume-neutral but not MIX-neutral.** Discontinue a
  heavy 700ml glass spirit, grow a canned RTD, and portfolio intensity falls
  with zero decarbonisation. Score the trend at constant base-year mix and
  report the mix effect as its own line.
- **`E = I × V` does not decompose cleanly** — `ΔE = ΔI·V₀ + I₀·ΔV + ΔI·ΔV`
  leaves an interaction residual. Use additive **LMDI** (Ang, Energy Policy
  2005), which is exact and residual-free, giving efficiency / volume / mix.

### Two live bugs found

1. **The `?? 1.0` unit-size fallback is a one-directional flattering bias.**
   `unit_size_l` appears ONLY in the benchmark numerator, never on the actual
   side (verified), so an undeclared unit size inflates the benchmark and
   raises the score: ~30 points on a 700ml spirit (51 → 81), roughly threefold
   on a 330ml can. Hard fail against the CMA's "robust evidence / no material
   omissions" if it ever leaves the platform. Remove it; raise an ask instead.
2. **Possible benchmark boundary mismatch.** `lib/industry-benchmarks.ts`
   claims its figures are lifecycle, but the cited BIER study is facility-level
   (scope 1+2 per hL). If so, we divide a cradle-to-grave numerator by an
   operational denominator and every intensity ratio in the product is wrong.
   **Highest-value item to put to Anne Jones.**

### Other advisor notes worth keeping

- Denominator should be **per litre of packaged product**, not per unit: per
  unit is blind to pack format, so 700ml glass → 200ml cans "improves" per-unit
  intensity while per-litre may worsen. Reject per-litre-of-pure-alcohol (it
  divides by zero for every non-alc customer). Keep revenue-based as an ESRS
  E1-6 disclosure output only.
- Benchmarks are already category-varying and portfolio-weighted (`pickBenchmark`
  cascade); 0.4401 is a derived blend, not a single sector figure. But: Beer &
  Cider at 0.85 kg/L looks low for a glass-packed craft brewer (glass alone in a
  330ml bottle is ~0.16-0.20 kg CO2e), and point estimates scored to 1%
  increments is false precision. Give each benchmark a range and flatten the
  curve inside it.
- The YoY curve contradicts itself: the comment cites ~7%/yr while 4.2%/yr is
  the SBTi near-term linear rate. Pick one, name it, anchor 100 on it. Today
  a producer hitting SBTi exactly (−4.2%) scores 82 and full marks sits at 2.4×
  the aligned rate. 0% change scoring 65 is too generous; 50 at most.
- A single-year delta is mostly noise (harvest variability, one export
  shipment, a factor-set update). Move to a three-year rolling rate against a
  fixed base year once vintages exist.
- **Restate the prior year using the current method and factor set** before
  computing any trend, or the component punishes a customer for upgrading a
  proxy factor to real supplier data.
- `ratio 0 → 100` is dangerous if `climate_change_gwp100` can ever include
  purchased offsets — that buys a 100 exactly as EmpCo restricts offset-based
  neutrality claims. Check whether offsets can enter that field; exclude them
  regardless, and move the 100 anchor to ~0.3 of benchmark.
- Once both components measure intensity they are a level and its derivative,
  strongly correlated. Weight the level higher: **70/30**, not 60/40.
- **EmpCo (EU 2024/825), national rules from 27 Sept 2026** bans sustainability
  labels not based on a certification scheme. Fine as an internal tool; get
  legal advice before a shareable badge or a QR carbon-label menu in the EU.

Advisor confidence: high on SBTi criteria substance, **medium on version
numbers and dates**; its knowledge base had no entries on target-setting
methodology, sector denominators or composite-score design, so that material is
fresh research, not grounded. Verify against primary sources before any of it
reaches customers.

## The work, in order

1. **Fix the duplication first** — move the pillar breakdown out of
   `EsgVitalityScoreHero` into the page body as three hairline sections; delete
   the four `PillarCard`s. This alone removes a whole redundant layer and is
   independently shippable.
2. **The nine-axis profile** component, in `components/vitality/`.
3. **The axis route** `/performance/[axis]/` + move the four deep-dives onto
   it; delete the four sheets and the in-card expansion.
4. **Restyle the five heavy files** (Carbon, Waste, Water, Circularity,
   Scope3) as they land on the axis pages, rather than in place — otherwise
   they get restyled twice.
5. **Social + Governance axis pages** (currently unreachable from here).
6. Hotspots and methodology to plain sections; retire the collapsibles.
7. Plain-language units; retire the bare `<select>` for the studio's own control.

Steps 1–3 are the ones that change how the page feels. 4 is the bulk of the
line count. 5 is new surface area. 6–7 are tidy-up.

### Anne Jones's verdict on the benchmarks (24 July) — read `tasks/benchmark-answers-anne-jones.md`

She traced every citation. **Not one of the 13 benchmark rows is supported by
the source it cites** (`sourceSupportsValue` is now recorded per row: 9 'no',
4 'approximate', 0 'yes'). Two rows carry errors inside the number itself:

- **Spirits 3.0** is a per-750ml-BOTTLE figure mislabelled per litre. Per-litre
  is 3.7-4.0. And it derives from aged American whiskey, so our gin and rum
  customers score ~90 whatever they do. Needs an aged/unaged split.
- **Whisky 3.8** cites a cradle-to-DISTILLATION study measured per litre of
  pure alcohol (~1.0 kg/l of liquid). Right number, wrong citation.
- **Beer & Cider 0.85** cites an operational study that publishes no absolute
  figures at all. Our glass arithmetic was confirmed: a glass-packing craft
  brewer is really 1.3-1.9 kg/l and gets scored **10 to 25**.
- **Non-Alcoholic 0.35** sends juice (0.7-1.1), dairy (1.3-1.9) and plant milks
  to a fizzy-drink benchmark. Those sub-categories must read "no benchmark".
- **DEFAULT_BENCHMARK 1.0** is an internal assumption dressed as a source.

On Question 2 she is unambiguous: a ratio whose numerator boundary varies while
the denominator is fixed **fails ISO 14044's same-boundary requirement**. Not a
judgement call.

Two corrections to our own assumptions:

- **Per-unit vs per-litre is already fine in the maths.** The benchmark is
  built as `kgCO2ePerLitre × unit_size_l` and the ratio is per-unit over
  per-unit, so unit size cancels: the ratio IS a per-litre comparison. The
  format-shift fear was unfounded FOR THE SCORE. What is misleading is the
  per-unit figure as a displayed KPI. (The `?? 1.0` fallback is still a real
  bug — it breaks exactly this cancellation, by 4× on a 250ml can.)
- The fix for Questions 2, 3 and 4 is **one fix**: a stage-and-format-resolved
  benchmark simultaneously solves the boundary mismatch, the tier-gating
  incentive, the craft-brewer misrepresentation and most of the uncertainty
  band. We already hold the strongest part (parametric packaging) in-house.

Done on 24 Jul: `lib/industry-benchmarks.ts` now REQUIRES `boundary`,
`functionalUnit` and `sourceSupportsValue` per row, populated from her audit,
so this class of error cannot hide again. **No values were changed** — every
edit there moves live customer scores and needs Tim's go.

### The scoring work, in order (separate stream, do NOT bundle with the visual redesign)

The advisor's sequence, which is deliberately not the order it feels natural to
tackle. Trust it: the labelling fix is urgent and cheap, the intensity trend is
blocked on a data-model change, and the benchmark audit could invalidate
everything downstream of it.

Merged with Anne's suggested order. Steps 1-4 are "now", and none of them
needs a decision from anyone.

1. **Stop the false label.** Rename `yoy_sub` to what it measures (production
   volume and mix change) or suppress the component until it can be computed
   from year-vintaged data. It is a substantiation problem, not a polish item.
2. **Remove the `?? 1.0` unit-size fallback.** Anne is firmer than we were:
   products with no declared unit size should be **excluded** from the
   intensity calculation, not defaulted. Same for the 1.0 kg/l
   DEFAULT_BENCHMARK — uncategorised should mean unscored.
3. **Archive the BIER PDFs.** Several 404 on bieroundtable.com after a site
   restructure and survive only on Wix's CDN. If they vanish we lose the only
   defensible source for four rows. *(Tim's call — downloading files.)*
4. **Mark the unsupportable rows "no benchmark"** rather than showing a number
   we cannot defend: the Non-Alcoholic sub-categories (juice, dairy, plant
   milk, coffee, kombucha, syrups) and anything on the default fallback.
5. **Correct the citations, and the two wrong values** — Spirits to 3.7-4.0 or
   split aged/unaged; Whisky re-cited to JIB/BIER; Beer re-cited to BIER 2012
   with a format caveat; Sparkling to the Applied Sciences review; water to
   BIER 2012. *(Changes live scores — needs Tim's go.)*
6. **Normalise scoring to cradle-to-gate** as the same-sprint interim: truncate
   the numerator to gate stages, show deeper stages unscored. Kills the
   tier-gating perversity. Note gate INCLUDES packaging manufacture, which is
   the large packaging term, so little signal is lost.
7. **Flatten the curve, add the uncertainty band** — flat at 70 across the
   band, movement only beyond ~±25-30% of midpoint. Indicative bands are in
   the answers doc; label them assembled literature ranges, not constants.
8. **Year-vintaged PCFs** with constant-method restatement. Only then can the
   trend component measure intensity, at constant base-year mix, with LMDI.
9. **Re-anchor the trend curve** on one named rate; 0% scores no better than
   50; move the intensity 100 anchor off zero; weight 70/30 level-over-trend.
10. **The stage-and-format-resolved benchmark** — the real fix. Category liquid
    reference plus a modelled pack reference from our parametric packaging
    model. Pull the beer and wine PEFCR Section 7.1 values to anchor those two
    cradle-to-grave (the accessible copies truncate before that table).
11. Decide whether absolute leaves the score entirely (recommended) and becomes
    the outcome + the Targets driver.

**Before any consumer-facing use**, separately: EmpCo 2024/825 from 27 Sept
2026, and specifically the offsetting-claim ban against our "climate-positive"
100 anchor — check whether `climate_change_gwp100` can ever include purchased
offsets. If it can, a customer surfacing that score walks into the ban.

**Mandatory on export**, whenever a climate figure leaves the platform: the
boundary, the metric and its denominator, and the volume decomposition, in the
same visual block. Phrasing that survives scrutiny:

> Total footprint fell 195 t CO2e, from 517 t to 322 t. Per-unit impact was
> effectively unchanged (0.61 kg CO2e per unit in both years), so the fall came
> from producing 38% fewer units, not from lower-carbon production.

(That sentence is only sayable once vintaged PCFs exist. Until then the page
must say it cannot yet split the two — which is what the mockup now says.)

## Decisions (Tim, 24 July 2026)

1. **Axis pages as routes** — approved in principle, subject to seeing one.
   A worked mockup of the Climate axis is the next deliverable; the structure
   is only settled once that has been looked at.
2. **The 12-week trend does not earn its place while the history is sparse.**
   It becomes a single sentence ("down 46 points since May") and only draws
   the bars once there are enough weeks with real movement to read as a
   shape. Threshold to agree when building: at least 6 of 12 weeks with data.
3. **Weights adjust in a pop-out on the page**, not by navigating away to
   `/governance/vitality-weights/`. The link out stays as an alias for the
   full governance surface, but the common case (nudging E/S/G) happens here.
