# Archived benchmark sources

Archived 24 July 2026, after Anne Jones's audit found that several sources
behind `lib/industry-benchmarks.ts` had already disappeared from their
publishers' sites.

**Two were already dead when we checked**, which is why this folder exists:

- BIER bottled water (2012) — 404 on bieroundtable.com; recovered from Wix's CDN.
- Oregon DEQ beer PEF full report — 404 on oregon.gov; recovered from the
  Wayback Machine (snapshot 2 Sept 2025). This is the source of the
  format-resolved beer figures Anne quotes.

## What is here

| File | What it is | Boundary | Provenance |
|---|---|---|---|
| `bier-2012-spirits-carbon-footprint.pdf` | BIER, *Research on the Carbon Footprint of Spirits*, June 2012 | cradle-to-grave, FU = 750 ml bottle | Wix CDN (dead on bieroundtable.com) |
| `bier-2012-carbonated-soft-drinks-carbon-footprint.pdf` | BIER, *Research on the Carbon Footprint of Carbonated Soft Drinks*, June 2012 | cradle-to-grave, per format | Wix CDN |
| `bier-2012-bottled-water-carbon-footprint.pdf` | BIER, *Research on the Carbon Footprint of Bottled Water*, 2012 | cradle-to-grave | Wix CDN (**404 on the main site**) |
| `oregon-deq-beer-pef-fullreport.pdf` | Oregon DEQ beer footprint literature summary | lifecycle, format-resolved | **Wayback Machine** (404 on oregon.gov) |
| `ibwa-antea-2024-benchmarking-exec-summary.pdf` | IBWA / Antea benchmarking | **operational scope 1+2** (~0.022 kg/l) | bottledwater.org |
| `trayak-2021-bottled-water-packaging-lca.pdf` | Trayak packaging LCA | cradle-to-grave, **no numeric footprints published** | bottledwater.org |
| `pefcr-beer.pdf` | EU PEFCR for beer, 88pp | cradle-to-grave, FU = 1 hl | sazp.sk mirror |
| `pefcr-wine.pdf` | EU PEFCR for wine, 94pp | cradle-to-grave, FU = 0.75 l packaged | sazp.sk mirror |
| `epa-2019-container-glass-carbon-intensities.pdf` | EPA container glass plant intensities | plant-level | epa.gov |

Journal articles (ScienceDirect, Nature, MDPI, JIB) are **deliberately not
archived here** — they are copyrighted publisher PDFs and a DOI is both more
durable and more appropriate. They are cited in
`tasks/benchmark-answers-anne-jones.md`.

## The PEFCR benchmark values — the gap Anne could not fill

Anne noted that the numeric benchmark tables sit in Section 7.1 and that her
accessible copies truncated before it. **These copies do not truncate.**
Extracted verbatim:

### Beer — PEFCR Table 21, "for 1 hl consumed beer"

| | Life cycle excl. use stage | Use stage |
|---|---|---|
| Climate change | **55.1 kg CO2 eq** | 17.5 |

1 hl = 100 l, so **0.551 kg CO2e/litre** excluding the use stage, **0.726
kg/litre** including it.

### Wine — PEFCR Tables 22 and 23, FU = a 0.75 l bottle (or equivalent volume)

| | Life cycle excl. use stage | Use stage |
|---|---|---|
| Still wine (Table 22) | **1.50 kg CO2 eq** | 0.0839 |
| Sparkling wine (Table 23) | **2.1 kg CO2 eq** | 0.081 |

Per litre: still **2.00** excl. use / **2.11** incl. use; sparkling **2.80**
excl. use / **2.91** incl. use.

### How our current figures compare

| Category | Ours today | PEFCR excl. use | PEFCR incl. use |
|---|---|---|---|
| Beer & Cider | 0.85 | 0.551 | 0.726 |
| Wine | 1.6 | **2.00** | **2.11** |
| Sparkling Wine | 2.0 | **2.80** | **2.91** |

So our **wine and sparkling benchmarks are too LOW** against the official EU
reference, which makes those customers look worse than they are — the opposite
direction to the beer problem. Beer at 0.85 is above the EU average beer, which
is heavily canned and kegged; it is still far below a glass-packing craft
brewer at 1.3-1.9, which is Anne's point.

**Caveats before using these.** PEF uses the EF 3.x method set, not the
ReCiPe/GWP100 basis our calculator uses, so the two are not perfectly
commensurable. The wine tables give "Climate change" as a total with biogenic
and land-use-change reported separately beneath it; we have taken the total as
printed. And the wine FU is defined by volume, not by one bottle, so the
per-litre conversion above is sound.

## Re-archiving

These are static PDFs; nothing needs refreshing on a schedule. If a citation
changes, add the new file and update the table rather than overwriting, so the
provenance chain stays intact.
