# Smart Upload: close the remaining gaps

Driven by the platform-wide audit. Everything stays **upload-only** (no email-in).

## Phase 1 — Remove the email function (keep it upload-only)
- [ ] Delete `app/api/ingest/email/route.ts`.
- [ ] Remove the "Forward documents to Rosa" inbox card + `agent_inbox_address` from `components/agents/RosaQueue.tsx`.
- [ ] Remove the "Forward an email" row + inbox logic from `components/rosa/QuickActions.tsx`.

## Phase 2 — Extraction depth (gap #2)
- [ ] **BOM line items**: give `identify_bom` a `line_items` array (ingredient/packaging name, qty, unit) so image BOMs work and the user previews ingredients before handoff; pass them through to the recipe editor / `BOMImportFlow`.
- [ ] **Invoice quantities**: add optional `quantity` + `unit` to `extract_supplier_invoice` line items; show them in `SupplierInvoicePanel`; persist qty/unit on the saved spend row so the activity detail is not lost.

## Phase 3 — New classifier tools (gap #3, by value)
- [ ] **Freight / transport invoice** → `extract_freight_invoice` + `POST /api/spend/freight`: activity-based (mode, weight_kg, distance_km → tonne-km factor) writing `corporate_overheads` (`upstream_transportation`); spend fallback when distance absent. Reuse `lib/utils/transport-emissions-calculator.ts` + `getOrCreateCorporateReport`.
- [ ] **Refrigerant / F-gas service record** → `extract_refrigerant_service` + `POST /api/data/refrigerant`: write `utility_data_entries` (`utility_type:'refrigerant_leakage'`, `refrigerant_type` clamped to `REFRIGERANT_GWP` key, `quantity` kg). Review UI needs a **facility picker**.
- [ ] **Packaging spec sheet** → `extract_packaging_spec`: components (epr_material_type, weight_g, recyclability) via `buildPackagingMaterialData()`. Review UI needs a **product picker**. (Heavier — may follow.)
- [ ] **Certificate of Analysis / spec sheet** → `extract_supplier_coa`: attach to `supplier_product_evidence` (`evidence_type:'specification_sheet'`). Needs a **supplier-product picker**. (Heavier — may follow.)
- [ ] **Certification certificate** → `extract_certification`: resolve `framework_code → framework_id`, upsert `organization_certifications` via `POST /api/certifications/frameworks`; fall back to evidence library when no framework matches. (Heavier — may follow.)

## Phase 4 — Surfacing (gap #4)
- [ ] Add the shared `UniversalDropzone` trigger to the main data-entry journeys (facilities, products, suppliers) so smart upload is discoverable, not just on the `/rosa` Queue tab. Leave the existing per-page bill dialogs in place (own extraction) but offer the universal dropzone alongside.

## Verification
- [ ] `tsc` clean; scoped tests; dev-main compiles the touched routes.
- [ ] Each new save endpoint auth-gates and writes the right table.

## Review (2026-06-19)

Done & type-clean (tsc 0 errors; facilities/products/suppliers/rosa compile 200; new endpoints auth-gate 401):
- **Phase 1 — email removed.** Deleted `app/api/ingest/email/route.ts`; removed the inbox card + `agent_inbox_address` from `RosaQueue.tsx` and the "Forward an email" row from `QuickActions.tsx`. Upload-only now.
- **Phase 2 — depth.** BOM `identify_bom` now extracts `line_items` (name/qty/unit/type) + a preview in `BomHandoffPanel`. Supplier-invoice lines now carry `quantity`+`unit`, folded into the saved spend description.
- **Phase 3 (partial) — new tools.** Freight invoice (`extract_freight_invoice` → `FreightInvoicePanel` → `POST /api/spend/freight`, activity tonne-km with spend fallback) and refrigerant service (`extract_refrigerant_service` → `RefrigerantPanel` → `POST /api/data/refrigerant`, utility_data_entries, facility picker).
- **Phase 4 — surfacing.** `SmartUploadButton` added to facilities, products, suppliers headers.

### Picker-based tools (built 2026-06-19, batch 3 — tsc 0 errors; endpoints auth-gate 401)
- **Packaging spec** → `extract_packaging_spec` → `PackagingSpecPanel` (product picker) → `POST /api/products/[id]/packaging` (builds rows via `buildPackagingMaterialData`, user-client insert under RLS).
- **Certificate of Analysis** → `extract_supplier_coa` → `SupplierCoaPanel` (supplier-product picker via `/api/supplier-products/search`) → `POST /api/supplier-products/evidence` (copies stashed file ingest-staging → supplier-product-evidence, inserts metadata).
- **Certification** → `extract_certification` → `CertificationPanel` (framework picker via `/api/certifications/frameworks`, auto-matched from hint) → reuses `POST /api/certifications/frameworks` with `status:'certified'`.

Still deferred:
- Full BOM `line_items` carry-through into `BOMImportFlow` match step (today shows a preview; recipe editor still re-parses via `/api/bom/parse`).
- No `organic` / `Fairtrade` framework rows exist, so those certs fall to the "other" picker fallback.

After deploy: no migration needed. New saves write existing tables.
