-- Country-level biodiversity-context factors for land use scoring.
--
-- V2-b of the Nature pillar redesign: a hectare cultivated in a
-- biodiversity hotspot country (Mexico, Mediterranean basin, Caribbean,
-- South Africa, etc.) carries higher biodiversity-loss potential than a
-- hectare in already-cultivated Northern European farmland. This table
-- stores per-country multipliers applied to the land_use axis of the
-- nature score before banding against thresholds.
--
-- Source: Conservation International "Biodiversity Hotspots" (Myers et al.
-- 2000; Mittermeier et al. 2011) — 36 designated hotspots covering ~2.4%
-- of Earth's land surface but holding ~50% of plant species and ~43% of
-- vertebrates as endemics.
--   https://www.conservation.org/priorities/biodiversity-hotspots
--
-- Multiplier scheme (deliberately conservative for v2):
--   1.5  countries dominated by hotspot regions (e.g. Madagascar)
--   1.3  countries with substantial hotspot overlap (Mexico, Italy, Chile)
--   1.1  countries with partial hotspot area (USA, Australia)
--   1.0  default — non-hotspot or already heavily modified land
--
-- v3 (planned): replace with spatial polygon lookup (IBAT / KBA / IUCN
-- Red List of Ecosystems) for sub-country precision.

CREATE TABLE IF NOT EXISTS "public"."country_biodiversity_factors" (
    "country_code" "text" NOT NULL,
    "country_name" "text" NOT NULL,
    "land_use_multiplier" numeric DEFAULT 1.0 NOT NULL,
    "hotspot_names" "text"[],
    "source" "text" DEFAULT 'Conservation International (2011)' NOT NULL,
    "last_review_date" "date" DEFAULT '2026-05-10' NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "country_biodiversity_factors_country_code_check"
        CHECK (("length"("country_code") = 2)),
    CONSTRAINT "country_biodiversity_factors_multiplier_check"
        CHECK (("land_use_multiplier" >= (0.5)::numeric) AND ("land_use_multiplier" <= (2.0)::numeric))
);

ALTER TABLE "public"."country_biodiversity_factors" OWNER TO "postgres";
ALTER TABLE ONLY "public"."country_biodiversity_factors"
    ADD CONSTRAINT "country_biodiversity_factors_pkey" PRIMARY KEY ("country_code");

-- This table is reference data — readable by all authenticated users,
-- writable only by service role. No RLS needed.
GRANT SELECT ON TABLE "public"."country_biodiversity_factors" TO "anon";
GRANT SELECT ON TABLE "public"."country_biodiversity_factors" TO "authenticated";
GRANT ALL ON TABLE "public"."country_biodiversity_factors" TO "service_role";

-- ---------------------------------------------------------------------------
-- Seed data — Conservation International hotspot countries.
--   1.5  pure hotspot dominance
--   1.3  major hotspot overlap (significant land area within hotspot)
--   1.1  partial hotspot overlap
-- Countries not listed default to 1.0 in the application logic.
-- ---------------------------------------------------------------------------

INSERT INTO "public"."country_biodiversity_factors"
    ("country_code", "country_name", "land_use_multiplier", "hotspot_names")
VALUES
    -- Pure / dominant hotspot countries
    ('MG', 'Madagascar', 1.5, ARRAY['Madagascar and Indian Ocean Islands']),
    ('NZ', 'New Zealand', 1.5, ARRAY['New Zealand']),
    ('JP', 'Japan', 1.4, ARRAY['Japan']),
    ('PH', 'Philippines', 1.5, ARRAY['Philippines']),
    ('NC', 'New Caledonia', 1.5, ARRAY['New Caledonia']),
    ('LK', 'Sri Lanka', 1.5, ARRAY['Western Ghats and Sri Lanka']),

    -- Major hotspot countries
    ('MX', 'Mexico', 1.4, ARRAY['Mesoamerica', 'Madrean Pine-Oak Woodlands', 'California Floristic Province']),
    ('BR', 'Brazil', 1.4, ARRAY['Atlantic Forest', 'Cerrado']),
    ('CO', 'Colombia', 1.5, ARRAY['Tropical Andes', 'Tumbes-Chocó-Magdalena']),
    ('EC', 'Ecuador', 1.5, ARRAY['Tropical Andes', 'Tumbes-Chocó-Magdalena']),
    ('PE', 'Peru', 1.4, ARRAY['Tropical Andes']),
    ('CL', 'Chile', 1.4, ARRAY['Chilean Winter Rainfall-Valdivian Forests', 'Tropical Andes']),
    ('ZA', 'South Africa', 1.4, ARRAY['Cape Floristic Region', 'Maputaland-Pondoland-Albany', 'Succulent Karoo']),
    ('ID', 'Indonesia', 1.5, ARRAY['Sundaland', 'Wallacea']),
    ('MY', 'Malaysia', 1.4, ARRAY['Sundaland']),
    ('TH', 'Thailand', 1.3, ARRAY['Indo-Burma', 'Sundaland']),
    ('VN', 'Vietnam', 1.4, ARRAY['Indo-Burma']),
    ('MM', 'Myanmar', 1.3, ARRAY['Indo-Burma', 'Himalaya']),
    ('KH', 'Cambodia', 1.3, ARRAY['Indo-Burma']),
    ('LA', 'Laos', 1.3, ARRAY['Indo-Burma']),
    ('IN', 'India', 1.3, ARRAY['Western Ghats and Sri Lanka', 'Himalaya', 'Indo-Burma']),
    ('NP', 'Nepal', 1.4, ARRAY['Himalaya']),
    ('BT', 'Bhutan', 1.5, ARRAY['Himalaya']),
    ('KE', 'Kenya', 1.3, ARRAY['Eastern Afromontane', 'Coastal Forests of East Africa']),
    ('TZ', 'Tanzania', 1.4, ARRAY['Eastern Afromontane', 'Coastal Forests of East Africa']),
    ('ET', 'Ethiopia', 1.3, ARRAY['Eastern Afromontane', 'Horn of Africa']),
    ('UG', 'Uganda', 1.3, ARRAY['Eastern Afromontane']),

    -- Mediterranean basin (significant hotspot area in southern parts)
    ('IT', 'Italy', 1.3, ARRAY['Mediterranean Basin']),
    ('ES', 'Spain', 1.3, ARRAY['Mediterranean Basin']),
    ('GR', 'Greece', 1.4, ARRAY['Mediterranean Basin']),
    ('PT', 'Portugal', 1.3, ARRAY['Mediterranean Basin']),
    ('TR', 'Turkey', 1.3, ARRAY['Mediterranean Basin', 'Caucasus', 'Irano-Anatolian']),
    ('MA', 'Morocco', 1.3, ARRAY['Mediterranean Basin']),
    ('TN', 'Tunisia', 1.3, ARRAY['Mediterranean Basin']),
    ('FR', 'France', 1.2, ARRAY['Mediterranean Basin']), -- Hotspot area is southern France only
    ('HR', 'Croatia', 1.3, ARRAY['Mediterranean Basin']),
    ('CY', 'Cyprus', 1.4, ARRAY['Mediterranean Basin']),
    ('MT', 'Malta', 1.4, ARRAY['Mediterranean Basin']),

    -- Caribbean
    ('CU', 'Cuba', 1.5, ARRAY['Caribbean Islands']),
    ('JM', 'Jamaica', 1.5, ARRAY['Caribbean Islands']),
    ('DO', 'Dominican Republic', 1.5, ARRAY['Caribbean Islands']),
    ('HT', 'Haiti', 1.5, ARRAY['Caribbean Islands']),
    ('PR', 'Puerto Rico', 1.4, ARRAY['Caribbean Islands']),
    ('TT', 'Trinidad and Tobago', 1.4, ARRAY['Caribbean Islands']),
    ('BB', 'Barbados', 1.4, ARRAY['Caribbean Islands']),

    -- Australia (Southwest hotspot + East coast)
    ('AU', 'Australia', 1.2, ARRAY['Southwest Australia', 'Forests of East Australia']),

    -- USA (California is hotspot; rest mostly not)
    ('US', 'United States', 1.1, ARRAY['California Floristic Province', 'Madrean Pine-Oak Woodlands', 'North American Coastal Plain']),

    -- Caucasus / Central Asia
    ('GE', 'Georgia', 1.3, ARRAY['Caucasus']),
    ('AM', 'Armenia', 1.3, ARRAY['Caucasus']),
    ('AZ', 'Azerbaijan', 1.3, ARRAY['Caucasus']),
    ('IR', 'Iran', 1.3, ARRAY['Irano-Anatolian', 'Caucasus']),

    -- Other
    ('CN', 'China', 1.2, ARRAY['Mountains of Southwest China', 'Himalaya', 'Indo-Burma']),
    ('AR', 'Argentina', 1.2, ARRAY['Atlantic Forest', 'Tropical Andes', 'Chilean Winter Rainfall-Valdivian Forests']),
    ('VE', 'Venezuela', 1.3, ARRAY['Tropical Andes', 'Caribbean']),
    ('BO', 'Bolivia', 1.3, ARRAY['Tropical Andes']),
    ('PA', 'Panama', 1.3, ARRAY['Mesoamerica', 'Tumbes-Chocó-Magdalena']),
    ('CR', 'Costa Rica', 1.4, ARRAY['Mesoamerica']),
    ('GT', 'Guatemala', 1.3, ARRAY['Mesoamerica']),
    ('HN', 'Honduras', 1.3, ARRAY['Mesoamerica']),
    ('NI', 'Nicaragua', 1.3, ARRAY['Mesoamerica']),
    ('SV', 'El Salvador', 1.3, ARRAY['Mesoamerica']),
    ('BZ', 'Belize', 1.3, ARRAY['Mesoamerica']),

    -- Explicitly listed at default (already heavily modified, useful for app
    -- to verify the country was queried, not just defaulted to 1.0).
    ('GB', 'United Kingdom', 1.0, NULL),
    ('IE', 'Ireland', 1.0, NULL),
    ('DE', 'Germany', 1.0, NULL),
    ('NL', 'Netherlands', 1.0, NULL),
    ('BE', 'Belgium', 1.0, NULL),
    ('DK', 'Denmark', 1.0, NULL),
    ('SE', 'Sweden', 1.0, NULL),
    ('NO', 'Norway', 1.0, NULL),
    ('FI', 'Finland', 1.0, NULL),
    ('PL', 'Poland', 1.0, NULL),
    ('CZ', 'Czech Republic', 1.0, NULL),
    ('AT', 'Austria', 1.0, NULL),
    ('CH', 'Switzerland', 1.0, NULL),
    ('CA', 'Canada', 1.0, NULL),
    ('RU', 'Russia', 1.0, NULL)
ON CONFLICT ("country_code") DO UPDATE SET
    "country_name" = EXCLUDED."country_name",
    "land_use_multiplier" = EXCLUDED."land_use_multiplier",
    "hotspot_names" = EXCLUDED."hotspot_names";
