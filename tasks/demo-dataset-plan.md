# alkatera Drinks Co — Complete Demo Dataset Plan

Target org: **alkatera Drinks Co** (`b0a00000-0000-4000-8000-000000000001`, slug `alkatera-drinks-co`, canopy tier). Feature flags already on: `viticulture_beta`, `orchard_beta`, `epr_beta`, `xero_integration_beta`. Goal: a coherent, reconciling dataset that lights up **every** part of the platform for lead demos, with history to show change over time and B Corp progress.

Constraint: `.env.local` targets **production**, so all seeding writes to prod. Build it idempotent and re-runnable.

---

## 1. Live gap analysis (read-only profile, 2026-06-13)

| Domain | Current state | Verdict |
|---|---|---|
| Org config | canopy, 4 beta flags on, founded 2019, Beverages, UK | ✅ good |
| Facilities | 8 rows — 6 well-defined (Winery, Distillery, 3rd-party Bottling, Brewery, Head Office, 3rd-party Botanical Partners) + **2 junk** ("Brewery", "alkatera Drinks Co Facility" with generic functions) | ⚠️ curate |
| Products | 22 — 5 clean finished (Bacchus wine, Highland malt, Session Ale, Botanica Zero, Bath Dry Gin) + **17 half-finished drafts** (Avallen Calvados ×6 dupes, Floral Haze IPA pack variants, Clear Water Lager variants), inconsistent lowercase `beer` category | ⚠️ curate heavily |
| product_materials | 112 rows, but **0 self-grown / 0 vineyard_id / 0 orchard_id** | ❌ viticulture/orchard not linked to any product |
| **LCAs / PCFs** | **0** — no footprints at all, `has_active_lca=false` everywhere | ❌ biggest gap |
| **Facility activity / utility** | **0** activity entries, **0** utility entries, **0** production logs | ❌ no primary data; water/energy/intensity all empty |
| Vineyards / orchards | 1 vineyard (Cotswolds, 5.2ha) + 1 growing profile; **0 orchards** despite orchard_beta + a Calvados (apple) product | ⚠️ link vineyard; add orchard |
| metric_snapshots | 474 rows, 2025-04-17 → 2026-06-13 (~14mo), 4 metric keys present | ⚠️ exists but "floats" — won't reconcile with empty PCFs/activity |
| ESG / vitality | esg_score_snapshots = **1 date only**; vitality_score_snapshots = 0 | ❌ no ESG trend |
| Targets / initiatives | 1 target (total_co2e 21000→16800 by 2030); **0 reduction_initiatives**, 0 flag_targets, 0 carbon_budgets | ❌ no action plan / MACC / SBTi FLAG |
| **B Corp** | **0** organization_certifications, 0 evidence_suggestions, 0 evidence_documents | ❌ entire B Corp journey empty |
| Social — People | workforce demographics 8, training 5, DEI 3, benefits 5; **compensation/living-wage 0** | ⚠️ mostly good |
| Social — Governance | board 5, policies 6, mission 1; **ethics 0** | ⚠️ mostly good |
| Social — Community | donations 4, volunteering 3; **stories 0, engagements 0** | ⚠️ thin |
| **Suppliers / Xero** | suppliers 0, organization_suppliers 0, xero_transactions 0, xero_connections 0, ESG assessments 0 | ❌ entire supplier/procurement arc empty |
| Misc | materiality 0, gaia_conversations 0, greenwash 0, epr_submissions 0, ghg_emissions 0, operational_change_events 0 | ❌ empty |

**Summary:** good skeleton (org, facilities, social People/Governance, a metric history), but the load-bearing operational + outcome data is missing — no LCAs, no facility activity, no B Corp record, no suppliers, no action plan, and the agricultural features aren't actually wired to any product. The existing metric_snapshots are "floating" (not derived from real data) and will contradict the empty underlying tables if a lead drills in.

---

## 2. Target narrative & portfolio

**alkatera Drinks Co** — a Bath-based craft drinks producer (founded 2019) on a B Corp journey, deliberately spanning every data pathway:

| Product | Type | Showcases | Ag? | Data mode |
|---|---|---|---|---|
| Cotswolds Estate Bacchus 2024 | Wine 750ml | **Viticulture** (own vineyard, self-grown grapes, biogenic + land use) | Vineyard | owned / primary |
| Avallen Calvados (glass) | Spirits 70cl | **Orchard** (own apples), and a paper-bottle variant for **packaging/EoL comparison** | Orchard | owned / primary |
| Avallen Calvados (paper) | Spirits 70cl | Packaging comparison vs glass | Orchard | owned / primary |
| Highland Reserve 12yr Single Malt | Spirits 700cl | Maturation + **third-party bottling** (Scope 3) | No | 3rd-party / primary |
| West Country Session Ale | Beer 330ml can | Brewery primary data, aluminium can | No | owned / primary |
| Floral Haze IPA — 24-can case | Multipack | **Multipack LCA** (components + secondary packaging) | No | owned |
| Botanica Zero | Non-Alcoholic 500ml | **Archetype-proxy / hybrid** data mode + ISO justification | No | 3rd-party / proxy |
| Bath Dry Gin | Spirits 700ml | Botanicals from suppliers, glass | No | owned / primary |

Covers: with-ag (vineyard + orchard) and without; owned (Scope 1&2) and third-party (Scope 3); primary, proxy and hybrid data; single and multipack; glass / can / keg / paper packaging.

---

## 3. Build blueprint (what gets seeded)

1. **Curate facilities & products.** Remove the 2 junk facilities; keep the 6 real ones. Reduce the 22 products to ~8 deliberate showcase products (promote the clean ones to finished, de-dupe the Calvados rows, finalise one IPA case as a real multipack, fix categories). Everything else either finished or removed.
2. **Agricultural wiring.** Link the Bacchus wine's grape `product_material` to the Cotswolds vineyard (`is_self_grown=true`, `vineyard_id`, growing profile for vintage 2024). Create a West Country **orchard** + growing profile and link the Calvados apple material to it. This is what makes viticulture/orchard actually render in an LCA.
3. **Operational primary data — ~24 months.** Per owned facility: monthly electricity, gas, water (intake/discharge/recycled), waste (general/recycling/hazardous), refrigerant leakage (distillery/brewery), plus `production_logs` volumes so per-litre intensity computes. Trend consumption **down** over time to pair with the reduction target and B Corp story.
4. **LCAs / PCFs.** Seed `product_carbon_footprints` (status `completed`, reference_year, fossil/biogenic/dluc split, per-stage totals, `data_quality_summary`) + `product_carbon_footprint_materials` (per-material impacts with `data_source`/`data_priority`/quality tags — a realistic mix of supplier-primary and proxy; removals for the ag products). Set `has_active_lca`/`latest_lca_id` on products.
5. **Reconcile time-series.** Rebuild/extend `metric_snapshots` (the 4 metric keys) so they match the new real totals across ~24 months; add monthly `esg_score_snapshots` (V/E/S/G) + `vitality_score_snapshots` trending up.
6. **Targets & action plan.** Keep the emissions target; add water-intensity and 100%-LCA-coverage targets and an SBTi **FLAG** target + a carbon budget. Add `reduction_initiatives` across the workflow states (draft / pending / active / completed) tied to abatement levers and linked to targets — populates the MACC, the action board and B Corp evidence IT5-Y3-002.
7. **B Corp.** Create `organization_certifications` for the B Corp 2026 framework (status in-progress, `current_year` 0 progressing to 3, readiness/completeness reflecting the real social + climate data). Generate `evidence_suggestions` via the existing `lib/certifications/platform-data.ts` mapping; add a couple of `evidence_documents`; seed `certification_score_history` to show progress.
8. **Social gap-fill.** Add `people_employee_compensation` (living-wage), `community_impact_stories` (published), `community_engagements`, `governance_ethics_records` so People / Governance / Community all render fully.
9. **Suppliers & Xero.** ~10 suppliers (glass, cans, malt, hops, botanicals, labels, cartons, logistics, etc.) with country + annual_spend; `organization_suppliers` links; `supplier_esg_assessments` with a spread of ratings (leader / progressing / needs improvement); `supplier_engagements` at mixed statuses; a `xero_connections` + `xero_transactions` set that auto-links to suppliers and auto-tiers by spend (shows the recent spend-linking + tiering features); link some `product_materials.supplier_product_id` to supplier products (the primary-data path / supplier-attribution waterfall).
10. **Anomalies & polish.** 1–2 `operational_change_events` + an `anomaly_explanation` so the Pulse anomaly "Why" explainer demos; optionally a couple of Rosa `gaia_conversations`, an `evidence_documents` library and a `materiality_assessment`.

Build order respects FK dependencies (facilities → ag → products → activity → PCFs → snapshots → targets/initiatives → B Corp → social → suppliers/Xero → polish).

---

## 4. Delivery mechanism (recommended)

Build it as a **re-runnable admin seed module behind a button** — "Seed / Reset alkatera Drinks Co demo" — following the existing `/admin/demo-seed` + `/api/admin/seed-inventory-demo` pattern (service-role API route, idempotent upserts keyed on natural keys, with a matching teardown). Matches the "build buttons, not terminal commands" preference, is safely re-runnable, and can be reset between demos. Alternative: one large idempotent SQL script pasted into the Supabase SQL editor (matches the migration-posting preference) — workable but less maintainable for a relational dataset this size.

## 5. Verification

Log in to the org and walk every surface (Pulse overview + trends, company footprint, products list + a wine/calvados/multipack LCA report, water dashboard, targets + MACC, B Corp readiness, social sections, suppliers + tiering + Xero) confirming each renders **and that the headline numbers reconcile** (snapshot totals == sum of PCFs == facility activity). Capture screenshots.

## 6. Decisions (confirmed)

- Delivery: **admin button** (re-runnable seed + reset, service-role API route).
- Cleanup: **curate fully** (remove junk facilities, de-dupe Calvados, finalise drafts, fix categories).
- LCA realism: **run the real calculator** — seed inputs + recalc-readiness, then drive the browser recalc tool.

## 7. Concrete findings from live inspection (drives the build)

- **Calculator is browser-only** (`getSupabaseBrowserClient` + `auth.getUser()`), so the seed (service-role) can only write the prerequisite rows; the real PCF is produced by the existing `/admin-tools/recalculate-lca` button in Tim's authenticated browser. Recalc-readiness per product = `products.last_wizard_settings` (≥ `systemBoundary`) + one seed `product_carbon_footprints` row whose `draft_data.facilityAllocations` has a primary entry with non-zero `productionVolume` + `facilityTotalProduction` + ≥1 `product_materials` row whose names resolve an emission factor. EF-resolution can throw, so verify one product before batching.
- **Products table has no `product_type` column** — only `product_category` + name; maturation/orchard triggering keys on these, so keep names like "...Single Malt" / "...Calvados".
- **Keep & finalise (showcase):** 130 Bacchus (Wine, viticulture), 131 Highland Single Malt (maturation), 132 Session Ale, 133 Botanica Zero (proxy mode), 134 Bath Dry Gin — all have rich named materials. 228→ finalise as Calvados glass (orchard), 229→ Calvados paper (packaging comparison). 236 Floral Haze IPA can (component) + 235 → real multipack (24×236).
- **Delete (clutter):** 230,231,232,233 (Calvados en-dash dupes), 234 fridge-pack, 237,238,239 IPA keg/firkin, 240–244 lager/stout variants. Fix lowercase `beer` → `Beer & Cider`.
- **Junk facilities to remove:** `241cf877…` ("Brewery") and `f77a74b0…` ("alkatera Drinks Co Facility"). Keep the 6 named ones.
- **Vineyard** `b0a20001…` + growing profile (2024, 5.2ha, 20t, organic_compost, cover_cropping) exist but `product_id` is null and no material is self-grown → link to Bacchus grape material. **No orchard** → create one for Calvados.
- **Manual step (documented):** after the Seed button, Tim clicks **Recalculate LCAs** with Drinks Co active to compute the real PCFs (calculator must run in the browser). Confirm tim@alkatera.com can switch to this org.

## 8. Module layout

`lib/demo-seed/drinks-co/`: `shared.ts` (ctx, helpers, constants), `entities.ts` (curate + facilities + agriculture + products + multipack + recalc-ready), `operations.ts` (activity + production + snapshots), `programme.ts` (targets + initiatives + FLAG + budget + B Corp + social), `supply-chain.ts` (suppliers + ESG + engagements + Xero + anomalies), `index.ts` (orchestrator + reset). API route `app/api/admin/seed-drinks-co-demo/route.ts`; admin button on the existing demo-seed page.
