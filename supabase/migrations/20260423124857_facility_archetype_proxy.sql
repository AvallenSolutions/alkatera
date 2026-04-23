-- =============================================================================
-- Facility Archetype Proxy Mode
-- =============================================================================
-- Adds a formal "proxy data" tier for contract-manufacturing facilities that
-- cannot supply primary energy/water data (e.g. multi-line canning facilities
-- that do not track individual runs).
--
-- Design:
--   1. facility_archetypes: reference table of industry-typical intensities
--      per facility archetype (contract_distillery, canning_line, etc.).
--   2. contract_manufacturer_allocations: add data_collection_mode,
--      archetype_id, proxy_basis_snapshot (frozen archetype row for audit
--      reproducibility), and upgrade_from_allocation_id (self-FK so a
--      primary-data row can point back at the proxy version it superseded).
--
-- Aligns with ISO 14044 §4.2.3.6 (data quality requirements) and ISO 14067
-- §6.3.5 (data quality declaration). Proxy allocations flow through the
-- existing pedigree-matrix DQI machinery so the report transparently reflects
-- the lower data quality.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. facility_archetypes reference table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."facility_archetypes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL PRIMARY KEY,
    "slug" "text" NOT NULL UNIQUE,
    "display_name" "text" NOT NULL,
    "description" "text",
    "unit" "text" NOT NULL,
    "electricity_kwh_per_unit" numeric NOT NULL DEFAULT 0,
    "natural_gas_kwh_per_unit" numeric NOT NULL DEFAULT 0,
    "thermal_fuel_kwh_per_unit" numeric NOT NULL DEFAULT 0,
    "water_litres_per_unit" numeric NOT NULL DEFAULT 0,
    "pedigree_reliability" integer NOT NULL DEFAULT 4,
    "pedigree_completeness" integer NOT NULL DEFAULT 3,
    "pedigree_temporal" integer NOT NULL DEFAULT 3,
    "pedigree_geographical" integer NOT NULL DEFAULT 3,
    "pedigree_technological" integer NOT NULL DEFAULT 3,
    "uncertainty_pct" numeric NOT NULL DEFAULT 30,
    "geography" "text" NOT NULL DEFAULT 'GLO',
    "source_citation" "text" NOT NULL,
    "source_url" "text",
    "source_year" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "facility_archetypes_unit_check" CHECK ("unit" = ANY (ARRAY['litre_packaged'::"text", 'can'::"text", 'bottle'::"text", 'litre_concentrate'::"text", 'hl'::"text"])),
    CONSTRAINT "facility_archetypes_pedigree_reliability_check" CHECK (("pedigree_reliability" >= 1) AND ("pedigree_reliability" <= 5)),
    CONSTRAINT "facility_archetypes_pedigree_completeness_check" CHECK (("pedigree_completeness" >= 1) AND ("pedigree_completeness" <= 5)),
    CONSTRAINT "facility_archetypes_pedigree_temporal_check" CHECK (("pedigree_temporal" >= 1) AND ("pedigree_temporal" <= 5)),
    CONSTRAINT "facility_archetypes_pedigree_geographical_check" CHECK (("pedigree_geographical" >= 1) AND ("pedigree_geographical" <= 5)),
    CONSTRAINT "facility_archetypes_pedigree_technological_check" CHECK (("pedigree_technological" >= 1) AND ("pedigree_technological" <= 5))
);

ALTER TABLE "public"."facility_archetypes" OWNER TO "postgres";

COMMENT ON TABLE "public"."facility_archetypes" IS 'Industry-typical energy/water intensities used when contract facilities cannot supply primary data. Pedigree defaults per ISO 14044 §4.2.3.6.';
COMMENT ON COLUMN "public"."facility_archetypes"."slug" IS 'Machine identifier (e.g. canning_line, contract_distillery, concentrate_producer).';
COMMENT ON COLUMN "public"."facility_archetypes"."unit" IS 'Functional unit the intensities are expressed per: litre_packaged | can | bottle | litre_concentrate | hl';
COMMENT ON COLUMN "public"."facility_archetypes"."uncertainty_pct" IS 'Default ± uncertainty applied to archetype-derived emissions for uncertainty propagation.';

ALTER TABLE "public"."facility_archetypes" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read facility archetypes" ON "public"."facility_archetypes" FOR SELECT TO "authenticated" USING (true);

GRANT SELECT ON TABLE "public"."facility_archetypes" TO "anon", "authenticated";
GRANT ALL ON TABLE "public"."facility_archetypes" TO "service_role";

-- -----------------------------------------------------------------------------
-- 2. Seed archetype reference data
-- -----------------------------------------------------------------------------
-- Sources: BIER 2023 Benchmarking, ecoinvent 3.10 market processes, and
-- published beverage-sector LCA studies. Values are mid-range industry
-- typicals appropriate for screening-grade assessments.
INSERT INTO "public"."facility_archetypes" (
    "slug", "display_name", "description", "unit",
    "electricity_kwh_per_unit", "natural_gas_kwh_per_unit", "thermal_fuel_kwh_per_unit", "water_litres_per_unit",
    "pedigree_reliability", "pedigree_completeness", "pedigree_temporal", "pedigree_geographical", "pedigree_technological",
    "uncertainty_pct", "geography", "source_citation", "source_url", "source_year"
) VALUES
    ('canning_line',
     'Canning Line (3rd-party can filler)',
     'Multi-line beverage canning facility performing depalletising, filling, seaming, pasteurisation (where applicable), labelling and palletising. Electricity-dominant.',
     'litre_packaged',
     0.12, 0.04, 0, 3.5,
     4, 3, 3, 3, 3,
     30, 'GLO',
     'BIER 2023 Water, Energy & GHG Benchmarking (brewery/soft-drink packaging module); ecoinvent 3.10 "packaging, beverage can filling"',
     'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
     2023),

    ('bottling_line',
     'Bottling Line (3rd-party glass bottler)',
     'Glass-bottle filling line: rinsing, filling, capping, labelling, pasteurisation. Electricity + thermal energy for wash/pasteuriser.',
     'litre_packaged',
     0.18, 0.22, 0, 4.2,
     4, 3, 3, 3, 3,
     30, 'GLO',
     'BIER 2023 Benchmarking Study; ecoinvent 3.10 "bottling, beverages"',
     'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
     2023),

    ('contract_distillery',
     'Contract Distillery (spirits)',
     'Grain-neutral or pot-still distillation including mashing, fermentation, distillation. Thermal-energy dominant.',
     'litre_packaged',
     0.35, 2.4, 0.30, 12.0,
     4, 3, 3, 3, 3,
     35, 'GLO',
     'MDPI – Scottish Malt Whisky GHG Study (2018); BIER 2023 Benchmarking (spirits)',
     'https://www.mdpi.com/2071-1050/10/5/1473',
     2018),

    ('contract_brewery',
     'Contract Brewery',
     'Mashing, boiling, fermentation, conditioning. Thermal + electrical.',
     'litre_packaged',
     0.15, 0.32, 0.05, 5.5,
     4, 3, 3, 3, 3,
     30, 'GLO',
     'BIER 2023 Benchmarking (brewery)',
     'https://www.bieroundtable.com/news/bier-issues-results-2023-water-energy-ghg-benchmarking-study/',
     2023),

    ('contract_winery',
     'Contract Winery',
     'Crush, ferment, press, fining, filtration, cold stabilisation. Refrigeration-dominant.',
     'litre_packaged',
     0.25, 0.05, 0, 4.8,
     4, 3, 3, 3, 3,
     30, 'GLO',
     'Nature – Eco-innovation & Wine Carbon Footprint (2024); BIER 2023',
     'https://www.nature.com/articles/s43247-024-01766-0',
     2024),

    ('co_pack_rtd',
     'Co-pack RTD / Ready-to-Drink',
     'Blending, carbonation, filling into cans or bottles. Typically combines canning/bottling intensity with light blending energy.',
     'litre_packaged',
     0.14, 0.06, 0, 3.8,
     4, 3, 3, 3, 3,
     30, 'GLO',
     'BIER 2023 Carbonated Soft Drinks Study (used as RTD proxy)',
     'https://www.bieroundtable.com/wp-content/uploads/49d7a0_7a5cfa72d8e74c04be5aeb81f38b136b.pdf',
     2023),

    ('concentrate_producer',
     'Concentrate / Liquid Base Producer',
     'Produces concentrated liquid base for dilution downstream. Intensities expressed per litre of concentrate shipped.',
     'litre_concentrate',
     0.22, 0.45, 0, 6.0,
     4, 3, 3, 3, 3,
     35, 'GLO',
     'ecoinvent 3.10 "fruit juice concentrate production"; BIER 2023 non-alcoholic module',
     'https://www.bieroundtable.com/work/benchmarking/',
     2023)
ON CONFLICT ("slug") DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Extend contract_manufacturer_allocations
-- -----------------------------------------------------------------------------
ALTER TABLE "public"."contract_manufacturer_allocations"
    ADD COLUMN IF NOT EXISTS "data_collection_mode" "text" NOT NULL DEFAULT 'primary',
    ADD COLUMN IF NOT EXISTS "archetype_id" "uuid" REFERENCES "public"."facility_archetypes"("id"),
    ADD COLUMN IF NOT EXISTS "proxy_basis_snapshot" "jsonb",
    ADD COLUMN IF NOT EXISTS "proxy_justification" "text",
    ADD COLUMN IF NOT EXISTS "upgrade_from_allocation_id" "uuid" REFERENCES "public"."contract_manufacturer_allocations"("id") ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS "superseded_at" timestamp with time zone,
    ADD COLUMN IF NOT EXISTS "hybrid_overrides" "jsonb";

-- Drop the constraint if it already exists (safe re-run)
ALTER TABLE "public"."contract_manufacturer_allocations"
    DROP CONSTRAINT IF EXISTS "contract_manufacturer_allocations_data_collection_mode_check";

ALTER TABLE "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_data_collection_mode_check"
    CHECK ("data_collection_mode" = ANY (ARRAY['primary'::"text", 'archetype_proxy'::"text", 'hybrid'::"text"]));

-- When mode is archetype_proxy or hybrid, archetype_id must be set
ALTER TABLE "public"."contract_manufacturer_allocations"
    DROP CONSTRAINT IF EXISTS "contract_manufacturer_allocations_archetype_required";

ALTER TABLE "public"."contract_manufacturer_allocations"
    ADD CONSTRAINT "contract_manufacturer_allocations_archetype_required"
    CHECK (
        ("data_collection_mode" = 'primary') OR
        ("archetype_id" IS NOT NULL)
    );

COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."data_collection_mode" IS 'How facility data was collected: primary (direct from facility), archetype_proxy (industry typical), hybrid (archetype with user overrides).';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."archetype_id" IS 'FK to facility_archetypes when mode is archetype_proxy or hybrid.';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."proxy_basis_snapshot" IS 'Frozen copy of the archetype row at the time of calculation. Enables reproducible recalculation even if the reference table is updated.';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."proxy_justification" IS 'User-supplied explanation for why primary data could not be obtained (ISO 14044 §4.2.3.6 audit requirement).';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."upgrade_from_allocation_id" IS 'Self-FK: when this row is a primary-data upgrade of a previous proxy allocation, points at that superseded row.';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."superseded_at" IS 'Timestamp when a proxy row was superseded by a primary-data upgrade. NULL for currently-active rows.';
COMMENT ON COLUMN "public"."contract_manufacturer_allocations"."hybrid_overrides" IS 'JSON object of { electricity_kwh_per_unit?, natural_gas_kwh_per_unit?, water_litres_per_unit?, ... } overrides applied on top of the archetype in hybrid mode.';

CREATE INDEX IF NOT EXISTS "idx_cm_allocations_data_collection_mode"
    ON "public"."contract_manufacturer_allocations" ("data_collection_mode");
CREATE INDEX IF NOT EXISTS "idx_cm_allocations_archetype_id"
    ON "public"."contract_manufacturer_allocations" ("archetype_id");
CREATE INDEX IF NOT EXISTS "idx_cm_allocations_upgrade_chain"
    ON "public"."contract_manufacturer_allocations" ("upgrade_from_allocation_id")
    WHERE "upgrade_from_allocation_id" IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Backfill: existing rows are primary data by definition
-- -----------------------------------------------------------------------------
UPDATE "public"."contract_manufacturer_allocations"
    SET "data_collection_mode" = 'primary'
    WHERE "data_collection_mode" IS NULL;

COMMIT;
