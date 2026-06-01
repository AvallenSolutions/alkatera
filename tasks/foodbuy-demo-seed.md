# Foodbuy demo data seed — todo

Goal: populate the Foodbuy procurement portal (prod) with a bespoke 16-brand demo dataset for today's sales call. Procurement org `foodbuy` already exists; only `procurement_skus` was empty.

## Composition (16 brands)
- 10 wine (4 white / 4 red / 1 rosé / 1 sparkling): 8 scraped (real brands, real data) + 2 alkatera (Rathfinny + 1 made-up, fabricated rich data)
- 2 spirits: 1 scraped (real) + 1 alkatera (made-up)
- 2 beer: 1 scraped (real) + 1 alkatera (made-up)
- 2 non-alc: 1 scraped (real) + 1 alkatera (made-up)

Alkatera (5, badge + Leader tier, ~85-95% coverage, 10-14 verified fields):
1. Rathfinny Wine Estate — Sparkling — England — Hallgarten (REAL brand, signing up next month; real+rich data)
2. Maison Clairval — White — France — Enotria (made-up)
3. Verdant & Vine Gin — Gin — UK — Hallgarten (made-up)
4. Tidewater Brewing Co — Lager — UK — Hallgarten (made-up)
5. Botánica Zero — Non-alc spirit — UK — Hallgarten (made-up)

Scraped (11, real brands, REAL scraped data, range of tiers):
- White: Cloudy Bay (NZ, Hall), Villa Maria (NZ, Hall), Gérard Bertrand (FR, Eno)
- Red: Antinori (IT, Eno), Penfolds (AU, Eno), Catena Zapata (AR, Eno), Familia Torres (ES, Eno)
- Rosé: Mirabeau en Provence (FR, Hall)
- Spirits: Flor de Caña (NIC, Eno)
- Beer: Peroni (IT, Eno)
- Non-alc: Seedlip (UK, Hall)

## Mechanism
- 4 tables: organizations (5, → trigger creates brand_directory), brand_directory (11 scraped direct + 5 alkatera via UPDATE), scraped_brand_data (by brand_directory_id), procurement_skus.
- Scores set DIRECTLY (no recalc trigger fires on insert). Tiers: scraped 60/35/15, alkatera 75/50/25.
- Idempotent + tagged for teardown: org slug `fb-demo-*`, procurement_skus.procurement_notes='fb-demo-seed', scraped_brand_data.source_url contains 'fbdemo'.
- Hallgarten id b402dfb4-16af-4c52-adef-f876172e4317 / Enotria 52e121a5-55e8-4122-974d-5b2055c2a73f / Foodbuy proc org 73267946-829a-4bd1-bc6d-8214a0c10984.

## Steps
- [x] Research real sustainability data for 12 real brands (incl Rathfinny)
- [x] Compose fabricated rich data for 4 made-up alkatera brands
- [x] Write idempotent seed script (scripts/seed-foodbuy-demo.mjs)
- [x] Run against production — 16 brands, 124 findings, 19 procurement SKUs
- [x] Verify dashboard aggregations via scripts/verify-foodbuy-demo.mjs (read-only)
- [x] Provide teardown script (scripts/teardown-foodbuy-demo.mjs)
- [ ] Final visual: Tim logs in at localhost:8890 (tim@alkatera.com) to view populated dashboard (auth is his action; browser session can't be forged)

## Verified result
- Totals: 19 SKUs, 16 brands, 2 channels, 52.3% coverage, 5 Leaders.
- Tiers: Leader 5 / Progressing 6 / Developing 4 / Insufficient 1.
- Top wins = all 5 alkatera brands (90/88/87/83/81).
- Top gaps (volume-weighted) = Peroni, Cloudy Bay, Penfolds, Villa Maria, Familia Torres.
- Confidence gate verified: Maison Clairval 17/17 visible; Peroni 3/5 (2 low-confidence hidden).
- Dev server: preview config `foodbuy` (port 8890), login renders branded.

## Scripts (in worktree scripts/)
- seed-foodbuy-demo.mjs — idempotent seed (re-runnable)
- verify-foodbuy-demo.mjs — read-only dashboard aggregation + RLS access + pillar coverage check
- teardown-foodbuy-demo.mjs — removes all demo data after the trial

## Iteration 2: six-pillar alkatera data + RLS fix (2026-06-01)
- BUG FOUND + FIXED: procurement_has_access_to_brand() requires a brand_profiles row in a linked
  distributor tenant. The lean seed skipped brand_profiles, so the logged-in procurement user (RLS,
  not service role) would have seen EMPTY brand-detail findings. Seed now creates 16 brand_profiles
  (normalized_name 'fbdemo <name>', linked brand_directory_id). Verified: all 16 brands pass
  procurement_has_access_to_brand.
- UPGRADE: registered alkatera brands now carry rich data across all six pillars (Climate, Water,
  Circularity, Nature, Social, Governance) as alkatera_live findings (25-34 fields each). Scraped
  brands stay sparse (2-6 public fields). Maison Clairval: 34 findings across all 6 pillars; Peroni: 2.
- NEW CODE: lib/procurement/pillars.ts (field_key -> pillar/label/format), components/procurement/
  brand-detail/pillar-breakdown.tsx, and app/procurement/[slug]/(portal)/brands/[id]/page.tsx now
  renders a six-pillar breakdown for registered brands vs the flat public grid for scraped brands.
- pnpm typecheck: 0 errors. Procurement pages use getSupabaseServerClient() (RLS, anon+cookies),
  NOT service role — esg_score_snapshots is NOT procurement-readable, which is why pillar data is
  sourced from scraped_brand_data alkatera_live findings (the same pattern the distributor portal uses).

## Iteration 3: metric accuracy realignment (2026-06-01)
- Tim flagged that alkatera produces LCAs, not EPDs. Audited all alkatera-brand metrics against what
  the platform ACTUALLY measures (researched lib/vitality/*, alkatera-sync, migrations).
- REMOVED invented metrics: epd_published, renewable_energy_percentage, carbon_negative_claim,
  cdr_partnership, water_replenishment_percentage, bottle_weight_g, packaging_reuse_scheme,
  waste_diverted_from_landfill_percentage, regenerative_agriculture_percentage,
  pesticide_reduction_percentage, biodiversity_programme, sustainability_report_published, and the
  boolean fudges (living_wage_employer, employee_wellbeing_programme, board_sustainability_oversight,
  third_party_assured) for registered brands.
- REPLACED with real platform metrics: lca_verified (LCA, not EPD); LCA impact categories
  land_use_m2a_per_litre, freshwater_eutrophication_per_litre, terrestrial_acidification_per_litre,
  water_scarcity_m3eq_per_litre; packaging_recyclability_score, packaging_end_of_life;
  nature_positive_hectares + nature_action_type (nature_actions), tnfd_dependencies_assessed;
  people_culture-derived living_wage_compliance_percentage, gender_pay_gap_median_percentage,
  employee_wellbeing_score; supplier_esg_coverage_percentage; governance_scores
  transparency/board/policy. NOTE: scraping-vocabulary fields (renewable_energy_percentage,
  epd_published, etc.) remain valid for SCRAPED brands' public data, just not emitted for alkatera_live.
- Result: Maison Clairval 33 findings across all 6 pillars (Climate 7/Water 3/Circularity 4/Nature 8/
  Social 5/Governance 6); typecheck 0 errors; RLS access OK for all 16.
- IMPORTANT: the distributor alkatera-sync currently emits only a SUBSET as discrete alkatera_live
  fields (scopes, carbon intensity, net-zero, water L/L + recycled %, recycled packaging %, primary
  material, 7 certs). Nature/social granular metrics exist on the platform but are NOT yet synced as
  discrete fields (only as ESG sub-scores). The demo seeds them directly; to make this REAL for live
  customers, extend syncAlkateraDataForBrand to emit LCA impact categories + people_culture/community/
  supplier/governance metrics. Follow-up, not blocking for the demo.
