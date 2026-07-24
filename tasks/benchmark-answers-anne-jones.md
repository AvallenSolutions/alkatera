# Carbon intensity benchmarks: Anne Jones's answers

Received 24 July 2026, in response to `tasks/benchmark-questions-anne-jones.md`.
Verbatim, apart from this header. **Do not edit; this is the source record.**

Every cited source was traced back to the actual document. The headline: almost
every row in `lib/industry-benchmarks.ts` has a citation that does not support
its number, two rows have unit/boundary errors baked into the value, and the
Question 2 boundary mismatch is disqualifying under ISO 14044 rather than a
judgement call.

**Time-sensitive:** several BIER PDFs now 404 on bieroundtable.com after a site
restructure and survive only on Wix's CDN (`docs.wixstatic.com`). Archive them
if we intend to keep citing them.

---

## Question 1: what boundary is each figure actually on?

### Answer 1: row by row

| Category | Our figure | What the cited source actually is | Boundary of cited source | Does the source support the figure? |
|---|---|---|---|---|
| Spirits | 3.0 | BIER, *Research on the Carbon Footprint of Spirits*, June 2012 (not 2023; no Institute of Brewing & Distilling involvement is visible in the document, that attribution appears spurious) | Cradle-to-grave, but the functional unit is a **750 ml bottle**, not a litre | No. The document gives 2.745 kg CO2e per 750 ml bottle (column distillation) and 2.971 kg (pot). Our 3.0 looks like the per-bottle pot figure rounded and mislabelled as per-litre. True per-litre equivalents are **3.7 to 4.0 kg CO2e/l** |
| Beer & Cider | 0.85 | BIER 2023 Water, Energy and GHG Benchmarking Study | **Operational, facility scope 1+2** (breweries, distilleries, wineries, bottling plants; facilitated by Antea Group). It publishes only percentage improvements, no absolute per-litre figures at all | No, and it could not. Facility-level beverage emissions are of the order of **tens of grams** CO2e per litre (the parallel Antea study for IBWA reports about 22 g/l). Nothing in this study can source a 0.85 kg/l lifecycle number |
| Wine | 1.6 | Pinto da Silva & Esteves da Silva 2022 review, *Cleaner and Circular Bioeconomy* | A literature review across **mixed boundaries**; its own finding is "widely variable carbon footprints between reviewed studies". It publishes no single headline figure | Not attributably. 1.6 sits between cradle-to-gate literature averages (about 1.1 to 1.5 kg/l including packaging) and Rugani's cradle-to-grave mean (2.2 ± 1.34 kg per bottle, about 2.9 kg/l). Defensible as a mid-range, not citable to this paper |
| RTD | 0.55 | BIER, *Research on the Carbon Footprint of Carbonated Soft Drinks*, June **2012** (not 2023) | Cradle-to-grave | Partly. 0.55 is the **North American aluminium-can scenario only** (about 550 g/l). The European 1.5 l PET scenario in the same study is about **170 g/l**, three times lower. Quoting 0.55 as "the" figure hides a threefold packaging dependence, and it contains no alcohol |
| Non-Alcoholic | 0.35 | Same CSD study plus bottled water | Cradle-to-grave | No. 0.35 matches nothing in either document (can 0.55, PET 0.17, bottled water 0.11 to 0.17). It appears to be an interpolation |
| Whisky / Bourbon / Rye | 3.8 | Leinonen, MacLeod & Bell 2018 (MDPI *Sustainability*) | **Cradle to end of distillation only** (no maturation, no packaging, no distribution), functional unit **1 litre of pure alcohol**. Headline about 2.6 kg CO2e/LPA | No, on both boundary and unit. At 40% ABV that source implies about 1.0 kg/l of unpackaged liquid. The number 3.8 is coincidentally close to correct for packaged whisky cradle-to-gate: the *Journal of the Institute of Brewing* single malt case study gives 2.83 kg per 70 cl bottle, about **4.04 kg/l**, and BIER 2012 gives 3.7 to 4.0. Right number, wrong citation |
| Sparkling Wine | 2.0 | Abinandan et al. 2024, *Communications Earth & Environment* | Cradle to winery gate; the paper is about **eco-innovative wastewater treatment in wine generally**. It does not study sparkling wine | No. The right source is the MDPI *Applied Sciences* systematic review of sparkling wine LCAs: typically **0.9 to 1.9 kg CO2e per bottle** (about 1.2 to 2.5 kg/l), packaging up to 55 to 60% of total. 2.0 kg/l is inside that range; re-cite it |
| Still / Sparkling Water | 0.15 / 0.20 | IBWA environmental footprint page | Two different studies live behind that page: the IBWA/Antea benchmarking (**operational scope 1+2**, about 0.022 kg/l) and the Trayak 2021 packaging LCA (cradle-to-grave but publishes **no numeric footprints**, only rankings) | No. Neither supports 0.15 or 0.20. BIER 2012 bottled water (cradle-to-grave) gives 0.11 to 0.17 kg/l, so 0.15 for still is accidentally in range; 0.20 for sparkling is unsourced |

Only one row (Beer & Cider) cites an operational study, but almost every row has
a citation that does not support its number, and two rows (Spirits, Whisky) have
unit or boundary errors baked into the number itself. Several figures are roughly
right by accident. Not a table you could put in front of an auditor, but not as
far from repairable as feared.

One row cannot stand: **Non-Alcoholic**. The category map sends 100% juice
(roughly 0.7 to 1.1 kg/l), smoothies, coffee drinks, dairy drinks (milk roughly
1.3 to 1.9 kg/l) and plant milks (0.4 to 1.0) to a 0.35 benchmark derived from
fizzy drinks and water. A dairy or juice brand will look two to four times worse
than "industry" purely because of the wrong denominator. Mark those
sub-categories "no benchmark"; keep 0.35-ish only for CSDs, seltzers and mixers.

Also: the **default benchmark of 1.0 kg/l ("BIER Beverage Industry Average")** —
no such published figure exists, and the citation is to the operational
benchmarking page. An internal assumption dressed as a source.

### Answer 2: better sources, or no benchmark?

Where a corrected published figure exists, use it and fix the citation:

- Spirits (aged, brown): BIER 2012 spirits (per-litre 3.7 to 4.0) plus the JIB single malt study (4.04). But see the caveat on white spirits.
- Beer: use format-resolved BIER 2012 / Oregon DEQ figures rather than one number.
- Wine: cite the literature range (Rugani, Ponstein, Tsalidis, Ferrara & De Feo); state the chosen boundary.
- Sparkling: the *Applied Sciences* systematic review.
- CSD/RTD: BIER 2012 CSD, stated per format.
- Bottled water: BIER 2012 bottled water (0.11 to 0.17 cradle-to-grave), not IBWA.

Where none exists, show no benchmark: juice, smoothies, coffee/tea drinks, dairy,
plant milks, kombucha, syrups and cordials, and arguably fortified wine and sake.

**Caveat not asked about:** the Spirits group benchmark has the opposite failure
mode from beer. It derives from aged North American whiskey in 450 g glass. Our
customer base is gin and rum distillers. An unaged white spirit runs far lower (a
published Spanish gin PCF is 0.57 kg per 70 cl bottle, about 0.8 kg/l), so a gin
brand scored against 3.0, let alone 4.0, gets a flattering ratio of 0.3 to 0.7 and
a score in the 90s regardless of anything they do. Spirits needs at least an
aged/unaged split, or it is not discriminating anything.

### Answer 3: is 0.85 credible lifecycle for Beer & Cider?

As an economy-wide, all-format average, roughly yes: returnable glass 0.42, steel
can 0.64, aluminium can 0.90, single-use glass 1.05 kg CO2e/l (BIER 2012 via
Oregon DEQ), kegs about 0.25, small-brewery glass 1.3 to 1.9 (Cimini & Moresi
2018: 127 kg/hl large rising to 192 kg/hl small; Gavinelli 2016 finds craft more
than double industrial per litre).

Our glass arithmetic was confirmed: at EU-average container-glass factors (about
0.8 to 1.0 kg CO2e/kg with typical cullet) a 200 to 220 g bottle is 0.16 to 0.22
kg CO2e, i.e. 0.5 to 0.65 kg/l at 330 ml before any liquid. A glass-packing craft
brewer sits at roughly 1.3 to 1.9 kg/l and will be scored at a ratio of 1.5 to 2.2
against 0.85, i.e. **10 to 25 points**, for choosing the packaging their market
demands and being small. Against our customer base specifically, 0.85 is the most
misrepresentative number in the table even though it is the most "correct" on
average.

### Answer 4: CSD as an RTD proxy

Defensible in magnitude for canned RTDs, as a clearly labelled interim. No
peer-reviewed hard-seltzer or RTD LCA exists. The arithmetic bounds it: a 5% ABV
product carries 0.05 LPA per litre and neutral spirit runs roughly 1.5 to 2.6 kg
CO2e/LPA, so alcohol adds about **0.08 to 0.13 kg CO2e/l** on top of a CSD system.
The one commercial datapoint (SERVED hard seltzer, CarbonCloud, cradle-to-shelf)
is 0.41 to 0.42 kg/l. So 0.55 is not crazy for a canned RTD; it is wrong for a
bottled one. Label the proxy openly rather than silently.

---

## Question 2: mismatched boundaries between numerator and denominator

Right that this is the bigger problem, and **not a judgement call**. ISO 14044 is
explicit: comparisons shall be made on the same functional unit with consistent
system boundaries, omissions documented. A ratio whose numerator boundary varies
by product while the denominator is fixed fails that test for every product whose
boundary differs from the benchmark's — which, given the table's boundaries are
themselves mixed, is most of them. The tier-gating consequence, where paying for
more complete accounting worsens the score, is the kind of finding that would
damage trust in everything else the product shows had a customer's auditor
reached it first.

### Answers 5, 6 and 7 together

The three options are not alternatives; they are one design with fallbacks. The
defensible architecture is a **stage-resolved benchmark**:

Hold the benchmark per category as components, not a point: liquid production
(cradle-to-gate), packaging manufacture (per declared format at a reference
weight, which we can generate from our own parametric packaging model),
distribution (reference scenario), use phase (chilling), end-of-life. Then, per
product, **assemble the denominator from exactly the stages that product's LCA
declares**. The denominator gains end-of-life at the same moment the numerator
does. The perverse incentive disappears structurally rather than by adjustment.

Published data exists at that granularity:

- BIER 2012 studies publish stage breakdowns (spirits: distillation 36%, glass bottle 20%, warehousing 10%, corn 9%, transport 7%; NA CSD: can 71%, sweeteners 10%, distribution 9%).
- The EU **PEFCRs for beer and for wine** are exactly this: cradle-to-grave category rules with representative products, stage breakdowns and formal benchmark values (beer FU 1 hl; wine FU 0.75 l packaged, packaging mix 79% glass / 16% bag-in-box / 4% PET). The only boundary-consistent officially published category benchmarks in drinks. **Gap: the numeric tables sit in Section 7.1 and the accessible copies truncate before it** — still need pulling from the full PDFs (sazp.sk mirrors). No PEFCR for spirits, soft drinks or packaged water.
- Wine literature separates cradle-to-gate (1.1 to 1.5 kg/l) from cradle-to-grave (about 2.9 kg/l mean).
- Packaging references we already model parametrically, stronger than any literature point estimate.

**Same-sprint interim:** normalise scoring to **cradle-to-gate** (which every
product has), and show deeper stages unscored as context. On the worry that this
discards packaging end-of-life: cradle-to-gate *includes packaging manufacture*,
which is the large packaging term (40 to 60% of the packaging-phase impact in wine
is making the bottle). End-of-life is the smaller residual. Gate-normalisation
keeps most of the packaging signal; what it loses is the recycling-rate lever.

Option 7 (stop scoring, show the figure beside a labelled reference range) is the
per-category fallback wherever even a gate-boundary benchmark is unsupportable:
the Non-Alcoholic sub-categories, and anything on the default fallback. "We cannot
benchmark this yet" beside a measured figure is more credible than a 70.

---

## Question 3: the denominator unit

### Answer 8: per litre, yes — but note what the code already does

Per litre of packaged product is the sector norm (brewers report kg CO2e/hl; beer
PEFCR FU is 1 hl; wine PEFCR is volume of packaged wine).

**But**: in `environmental.ts` the per-unit benchmark is built as
`kgCO2ePerLitre × unit_size_l`, and the ratio is per-unit actual over per-unit
benchmark, so **unit size cancels and the intensity ratio is already
mathematically a per-litre comparison**. A 700 ml to 200 ml format shift does not
change the ratio, provided `unit_size_l` is declared correctly. What is misleading
is the per-unit figure as a *displayed* KPI, and cross-product comparison of
per-unit numbers. So: the score is fine on this axis; display per litre.

The exception, a real bug, is finding 13 below.

### Answer 9: per litre of pure alcohol

Keep, but only as a secondary metric *within spirits*. It is the spirits norm (SWA
reports kg CO2e/LPA: 0.92 in 2022, 0.83 in 2023 — though that is operational
scope 1+2, not lifecycle) and answers a question per-litre cannot. Our reasons
against it as a headline are correct. Never the headline; useful in spirits detail.

### Answer 10: ESRS E1-6 revenue intensity

Show in reporting outputs, never as a scored or comparative metric. E1-6 mandates
exactly one intensity: total GHG per net revenue, reconciled to the financial
statements. Physical intensity is not required by E1-6 at all. It moves with
price, mix and premiumisation — an English sparkling producer would "improve" it
by raising prices. Keep it out of the vitality score and out of rankings.

---

## Question 4: precision

### Answer 11: uncertainty ranges, yes — and the curve is too sharp for its inputs

Published spreads: conventional still wine 0.06 to 3.0 kg CO2e per bottle across
studies; Rugani's cradle-to-grave mean carries ±1.34 on 2.2; beer moves about 2.5×
by packaging format and roughly doubles from large to small breweries. Against
that, the difference between ratio 1.00 and 1.15 is meaningless.

Carry a band, hold the score flat across it. Indicative bands: spirits (aged) 3.0
to 4.5; white spirits 1.0 to 2.5 if split; beer 0.6 to 1.2 if one band is kept;
still wine 1.1 to 2.2 depending on boundary; sparkling 1.2 to 2.5; CSD/RTD 0.17 to
0.6 spanning PET to can; bottled water 0.10 to 0.17. **Assembled literature
ranges, not published constants — label them so.** Flatten the curve: flat at 70
across the band, meaningful movement only beyond roughly ±25 to 30% of midpoint.

### Answer 12: format-aware benchmarks are the sound version, not over-engineering

A category point benchmark with a wide flat band has little discriminating power
left, precisely because packaging and scale — the things the band absorbs — are the
biggest levers. The way out is category liquid reference plus a modelled pack
reference for the declared format at a reference weight. We already hold the
strongest part in-house.

**This is the real argument for it: one stage-and-format-resolved benchmark
simultaneously solves the boundary mismatch, the tier-gating incentive, the
craft-brewer misrepresentation and most of the uncertainty-band problem**, because
a 330 ml single-use glass reference for a craft brewer is a fair comparator in a
way no all-format category number can be.

Guardrails: reference pack weights from a published or clearly stated source per
format; the liquid reference stated per category with its boundary; and where the
customer's format has no defensible reference, fall back to the category band.

---

## Regulatory note

Directive (EU) 2024/825 (Empowering Consumers), applying **27 September 2026**:
sustainability labels shown to consumers must be based on a certification scheme
or established by a public authority; generic environmental claims banned unless
substantiated; claims of neutral/reduced/positive climate impact **based on
offsetting** banned outright.

Two implications. An internal B2B management score is outside consumer-protection
scope, but the moment a customer puts the 0-100 on pack or in consumer marketing
it functions as a sustainability label and needs a qualifying scheme behind it —
consider contractual language before September. And **our scoring code awards 100
for "climate-positive" ratios below zero**; if that state is reachable via offsets
rather than genuine net removals, any customer surfacing it walks into the
offsetting ban.

The separate Green Claims Directive is stalled (Commission announced intention to
withdraw in June 2025), so 2024/825 is the binding regime to design against.

---

## Three code findings we did not ask about

13. **The `unit_size_l ?? 1.0` fallback distorts scores.** Products without a
    declared unit size fall back to 1.0 l, so the benchmark becomes
    `kgCO2ePerLitre × 1.0` while the numerator is the real per-unit figure for
    what might be a 250 ml can — flattering that product's ratio by 4×, and
    penalising undeclared magnums. Such products should be **excluded** from the
    intensity calculation, not defaulted.
14. **The default 1.0 kg/l fallback benchmark** means an uncategorised product is
    scored against an invented number with an operational citation. Uncategorised
    should mean unscored.
15. **The table header is the first thing to fix.** The comment asserting
    "lifecycle emissions including raw materials, production, packaging, and
    distribution" is currently false for the file it sits above, and it is the
    sentence an auditor will quote. Per-row `boundary` and `functionalUnit` fields
    on `IndustryBenchmark` would make the data structure incapable of hiding this
    class of error again.

---

## Suggested order of work

1. **Now:** archive the Wix-mirrored BIER PDFs; correct the citations and the two
   wrong values (Spirits to ~3.8-4.0, or split white spirits out; Beer & Cider
   re-cited to BIER 2012 with format caveat); mark the unsupportable Non-Alcoholic
   sub-categories and the default fallback "no benchmark"; fix the unit-size
   fallback; add `boundary` fields.
2. **Next:** normalise scoring to cradle-to-gate (numerator truncated to gate
   stages, deeper stages displayed unscored); flatten the curve and add the flat
   uncertainty band.
3. **Then:** build the stage-and-format-resolved benchmark from the parametric
   packaging model plus liquid references; pull the beer and wine PEFCR Section
   7.1 benchmark values to anchor those two categories cradle-to-grave.
4. **Before any consumer-facing use:** revisit 2024/825, the offsetting-claim ban
   against the climate-positive score state, and whether a recognised
   certification scheme needs to sit behind the score.

---

## Sources

- BIER 2023 Water, Energy and GHG Benchmarking Study (operational): https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/ and https://www.bieroundtable.com/publication/2023-water-and-energy-use-benchmarking-study/
- BIER, Research on the Carbon Footprint of Spirits (2012), Wix mirror: https://docs.wixstatic.com/ugd/49d7a0_7643fd3fae5d4daf939cd5373389e4e0.pdf
- BIER, Research on the Carbon Footprint of Carbonated Soft Drinks (2012), Wix mirror: https://docs.wixstatic.com/ugd/49d7a0_7a5cfa72d8e74c04be5aeb81f38b136b.pdf
- BIER, Research on the Carbon Footprint of Bottled Water (2012): https://www.bieroundtable.com/wp-content/uploads/49d7a0_824b8dcfeaa74427a56b57abb8e2417e.pdf
- Oregon DEQ, Beer footprint literature summary: https://www.oregon.gov/deq/FilterDocs/PEF-Beer-FullReport.pdf
- IBWA/Antea benchmarking (operational): https://bottledwater.org/wp-content/uploads/2024/08/IBWA-Benchmarking-Executive-Summary_May-2024.pdf; Trayak 2021 packaging LCA: https://bottledwater.org/wp-content/uploads/2021/06/Trayak-LCA_2021.pdf
- Pinto da Silva & Esteves da Silva 2022 wine review: https://www.sciencedirect.com/science/article/pii/S2772801322000173
- Ponstein et al. 2019, German wine cradle-to-gate: https://klimaneutralerwein.de/wp-content/uploads/2021/07/Ponstein_et_al_2019_GHG_emissions_and_mitigation_options_from_wine_production_in_Germany.pdf
- Sparkling wine LCA systematic review, Applied Sciences: https://www.mdpi.com/2076-3417/16/9/4220
- Abinandan et al. 2024 (the miscited Nature paper): https://www.nature.com/articles/s43247-024-01766-0
- Leinonen, MacLeod & Bell 2018, Scottish malt whisky: https://www.mdpi.com/2071-1050/10/5/1473
- JIB single malt carbon calculator study: https://jib.cibd.org.uk/index.php/jib/article/view/77
- Scotch Whisky Association climate reporting (kg CO2e/LPA): https://www.scotch-whisky.org.uk/industry-insights/sustainability/climate-change/
- Beer PEFCR (mirror): https://www.sazp.sk/dokument/f/pivo.pdf; Wine PEFCR (mirror): https://www.sazp.sk/dokument/f/vino.pdf
- ISO 14044:2006 comparability requirements (sample text): https://cdn.standards.iteh.ai/samples/38498/17324bfe9ec44e27a2f84e1a8ac3ca26/ISO-14044-2006.pdf
- ESRS E1 delegated act (E1-6 paras 53-55): https://www.efrag.org/sites/default/files/media/document/2024-08/ESRS%20E1%20Delegated-act-2023-5303-annex-1_en.pdf
- Directive (EU) 2024/825 application and effect: https://transition-pathways.europa.eu/legislation/directive-eu-2024825-empowering-consumer-green-transition
- Green Claims Directive withdrawal status: https://www.lw.com/en/insights/european-commission-announces-intention-to-withdraw-eu-green-claims-directive-proposal
- EPA container glass plant intensities: https://www.epa.gov/system/files/documents/2022-06/2019%20Container%20Glass%20Plant%20Carbon%20Intensities%20Fact%20Sheet%20.pdf
