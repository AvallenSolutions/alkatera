# Supplier Smart Upload — Plan

## Goal
Let suppliers drop a PDF (LCA report, EPD, product spec sheet) or spreadsheet (catalogue) onto the supplier portal and have alka**tera** auto-populate `supplier_products` rows. Cuts onboarding from "fill 12 fields per product" to "upload one file, review, confirm."

Driven by the Frugalpac issue: bottle landed with `weight_g=0`, `recycled_content_pct=null`, `product_type='ingredient'`. A smart upload that pulls from the public Frugal Bottle datasheet would have set those correctly first time.

## Scope (v1)

### In scope
- PDF upload: LCA reports, EPDs, technical datasheets, spec sheets.
- Spreadsheet upload: CSV/XLSX catalogues with one row per product.
- Server-side extraction via Claude Sonnet with a structured-output schema matching `supplier_products` columns.
- Review/confirm UX modelled on the existing brand-side `WebsiteImportFlow` — tick rows, edit fields inline, then confirm.
- Caching by file SHA-256 so re-uploads skip re-billing.

### Out of scope (v1)
- LCA component-level breakdown (the `supplier_product_components` rows). Defer to v2.
- Multi-document fusion (uploading both a catalogue and an EPD and merging them).
- Image extraction (product photos from PDFs).

## Architecture

### Reuse
- Existing brand URL-import pattern: `app/api/products/import-from-url/route.ts` (kicks off a job) + `[jobId]/route.ts` (polls) + `confirm/route.ts` (writes).
- Existing review UX: `components/products/WebsiteImportFlow.tsx` — copy and adapt for supplier context.
- Storage bucket pattern from `evidence_library` (we already accept supplier PDFs).

### New
- `app/api/supplier-products/smart-import/route.ts` — POST a file, returns `{ jobId }`.
- `app/api/supplier-products/smart-import/[jobId]/route.ts` — poll for status + extracted rows.
- `app/api/supplier-products/smart-import/confirm/route.ts` — write approved rows.
- `lib/extraction/supplier-product-extractor.ts` — Claude prompt + JSON schema. Two prompts: one for "single product datasheet/EPD" mode, one for "catalogue table" mode. Auto-detect by checking page count + structure.
- `components/supplier-portal/SmartImportFlow.tsx` — upload → progress → review table → confirm. Mirrors `WebsiteImportFlow`.
- DB: small `supplier_smart_import_jobs` table for status + cached extraction (file_hash unique key).

### Extraction schema (structured output)
```ts
type ExtractedSupplierProduct = {
  name: string;
  product_type: 'ingredient' | 'packaging';
  // packaging
  packaging_category?: 'container' | 'label' | 'closure' | 'secondary' | 'shipment' | 'tertiary';
  weight_g?: number;
  primary_material?: string;
  recycled_content_pct?: number;
  recyclability_pct?: number;
  epr_material_code?: 'AL' | 'FC' | 'GL' | 'PC' | 'PL' | 'ST' | 'WD' | 'OT';
  epr_is_drinks_container?: boolean;
  // climate / water / waste / nature
  impact_climate?: number;     // kg CO2e per unit
  impact_water?: number;       // m³ per unit
  impact_waste?: number;
  impact_land?: number;
  // origin
  origin_country_code?: string;
  // confidence so we can highlight low-confidence rows in the review UI
  _confidence: 'high' | 'medium' | 'low';
  _source_quote?: string;      // verbatim sentence from the doc
};
```

Each extracted field carries the verbatim quote it came from — surfaced as a tooltip in the review UI so the supplier can sanity-check before confirming.

## Risks / tradeoffs
1. **Quality varies by doc type.** Well-structured EPDs are near-perfect; marketing catalogues are noisy. Mitigation: review step is mandatory, low-confidence fields are flagged amber.
2. **Cost.** ~£0.05–0.20 per doc with Sonnet, depending on length. SHA-256 cache stops re-billing on re-uploads. Add a daily cap per supplier as a guardrail.
3. **Hallucination on missing fields.** Numbers especially — a supplier datasheet that says "lightweight bottle" with no number will tempt the model to invent. Mitigation: require `_source_quote` for every numeric field; drop fields with no quote.
4. **PII / commercial sensitivity.** Some EPDs are confidential. Documents stay in the supplier's own org bucket; extraction request goes to Anthropic but no fan-out beyond.

## Plan checklist

- [ ] `supplier_smart_import_jobs` migration (id, supplier_id, file_hash, status, raw_extraction jsonb, created_at)
- [ ] `lib/extraction/supplier-product-extractor.ts` — structured output prompts (datasheet mode, catalogue mode)
- [ ] POST `/api/supplier-products/smart-import` (upload + dedupe by hash + kick job)
- [ ] GET `/api/supplier-products/smart-import/[jobId]` (status + extracted rows)
- [ ] POST `/api/supplier-products/smart-import/confirm` (insert into supplier_products with sane defaults + audit row)
- [ ] `components/supplier-portal/SmartImportFlow.tsx` — review/edit/confirm UI
- [ ] Hook into `app/(authenticated)/supplier-portal/products/page.tsx` next to "Add Product"
- [ ] CSV/XLSX path via xlsx parsing → same extractor (catalogue mode skips PDF read step)
- [ ] Daily extraction cap per supplier in `/api/supplier-products/smart-import` (env-tunable, default 20/day)
- [ ] Smoke test with: Frugal Bottle PDF, a generic ingredient catalogue CSV, a long marketing PDF

## Verification
- Frugal Bottle PDF should round-trip to: `product_type=packaging`, `packaging_category=container`, `weight_g=82`, `recycled_content_pct=94`, `primary_material=recycled_paperboard`.
- Catalogue CSV with 50 rows should extract all 50, flag the rows with missing units as low-confidence.
- Re-uploading the same file inside 24h should not re-bill (hash cache hit).

## v2 ideas (not now)
- LCA component breakdown into `supplier_product_components`.
- Auto-link extracted EPD as evidence in `evidence_library`.
- Cross-doc fusion ("catalogue gave the SKUs, EPD gave the impacts, merge them").
