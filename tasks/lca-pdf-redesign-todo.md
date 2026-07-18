# LCA PDF redesign — implement "LCA Report Template.dc.html"

Source design: Claude Design project d03d39b6-c0b4-4031-8e54-b4953be6a269, file `LCA Report Template.dc.html`
(extracted to scratchpad `lca-design.html`, 976 lines, ~20 sections). Print variant adds only
@media print break rules; main file is source of truth. Design contains real Everleaf Marine data —
implement as a TEMPLATE with every literal bound to `LCAReportData`.

## Decisions (made, not open)
- Keep `renderLcaReportHtml(data: LCAReportData)` signature; route + PDFShift client untouched if possible.
- A4 stays (route already sends A4; UK market). Design's letter/0.65in adapted to A4 margins.
- Page architecture changes: fixed-height `.page` divs (overflow hidden = clipping risk) →
  FLOWING content with `break-before: page` / `break-inside: avoid` (the design + its print variant idiom).
- Repeating footer: `position: fixed; bottom: 0` (Chromium repeats per printed page). Fallback if
  PDFShift misrenders: add native `footer` option to pdfshift-client.
- Chapter divider pages dropped (design has none). Commitment page → design's back cover.
- Conditional sections not in the design (viticulture, flag removals, transport notes etc.) KEPT,
  restyled in the new idiom, slotted at their current positions.
- Design section colour rhythm (band colours) followed exactly.

## Checklist
- [x] Shared primitives: sectionBand, statCard, monoTable, kicker/cardTitle/body helpers, footer, page CSS
- [x] Cover (forest block, leaf mark, 3-fact grid)
- [x] 01 Executive summary (forest KEY INSIGHT block + 3 stat cards)
- [x] 02 Goal & scope (cobalt band, 2-col defs, boundary panel, EoL table)
- [x] 03 Methodology + characterisation models
- [x] 04 Data quality + notes
- [x] 05 Climate impact + 05c processing & manufacturing
- [x] 06 Detailed GHG reporting
- [x] 07 Environmental impact categories
- [x] 08 Ingredient impact breakdown
- [x] 09 Water footprint
- [x] 10 Circularity & waste
- [x] 11 Land use
- [x] 12 Supply chain
- [x] 13 Interpretation + limitations/recommendations
- [x] 14 Uncertainty & sensitivity
- [x] 15 Critical review & compliance + 15b AI-assisted internal review
- [x] Back cover
- [x] Conditional legacy sections restyled (viticulture, notes)
- [x] Verify: fixture-render HTML → browser + print preview; typecheck; page-break audit
- [x] Commit + push

## Review
All 20 design sections implemented and bound to LCAReportData; conditional legacy sections
(viticulture + FLAG removals, facility proxy disclosure) restyled in the idiom. File went
2,409 → ~1,550 lines. Verified: 0 TS errors project-wide; lib/pdf vitest 64/64; full
26-page fixture PDF (design's own Everleaf data) rendered via headless Chromium (the
PDFShift engine) and visually inspected page by page — cover, all bands/colours (forest/
cobalt/ochre-ink/brick/ink), hero numbers, mono tables with ink header rules, working-tone
chips, proxy sublines, transport sublines, Other-lifecycle-stages reconciliation row,
back cover all faithful. Spike proved fixed-page divs (not CSS flow) are the right
architecture: Chromium neither paints canvas bg over margins nor places fixed footers
reliably, and the design itself models discrete pages with CONT. bands.
