-- Our own completed LCAs as the benchmark denominator.
--
-- `lib/industry-benchmarks.ts` is thirteen rows assembled from eight
-- incompatible papers, and Anne Jones's audit on 24 July 2026 found that not
-- one of them is supported by the source it cites. The strategic answer is not
-- "our data is better" — with a small customer base it is thinner. It is that
-- a peer benchmark is boundary-consistent BY CONSTRUCTION: a cradle-to-gate
-- figure compared against other cradle-to-gate figures, computed by the same
-- engine on the same factor sets, at the same pack format. That is ISO 14044's
-- same-boundary requirement satisfied structurally rather than by curation,
-- which is the one thing a literature table can never do however well cited.
--
-- Why not metric_snapshots
-- =======================
-- Two reasons, either sufficient.
--
--   1. It is unique on (organization_id, metric_key, snapshot_date), one row
--      per org per metric per day. Intensity is per PRODUCT and needs several
--      rows per org per day — a business making a gin and a canned RTD has two
--      genuinely different intensities and no meaningful average of them.
--
--   2. `peer_benchmark_view` groups by metric_key ALONE. A `co2e_per_litre`
--      key dropped into metric_snapshots would immediately produce a
--      cross-category, cross-boundary, cross-format percentile that any route
--      could read and no caller could tell apart from a valid one. That is a
--      worse number than the literature row it replaces.
--
-- So: a sibling table shaped like metric_snapshots, and a sibling view that
-- carries the k-anonymity guard in exactly the same place Pulse put it.

-- ---------------------------------------------------------------------------
-- The snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."product_intensity_snapshots" (
  "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
  "organization_id" "uuid" NOT NULL,
  "product_id" bigint NOT NULL,
  "pcf_id" "uuid" NOT NULL,
  "metric_key" "text" NOT NULL,
  "snapshot_date" "date" NOT NULL,
  "value" numeric NOT NULL,
  "unit" "text" NOT NULL,

  -- The bucket dimensions, as columns rather than a string-mangled metric key.
  -- A key like 'co2e_per_litre:spirits:cradle-to-gate:glass-bottle' cannot be
  -- grouped, filtered or indexed without parsing, and every consumer would
  -- have to agree on the mangling.
  "category_group" "text",
  "product_category" "text",
  "system_boundary" "text" NOT NULL,
  "pack_format" "text",

  -- Everything that describes the row without bucketing it: fill volume, the
  -- reference year, whether the boundary was chosen or assumed. Kept for the
  -- admin surface and for the finer buckets a larger customer base will allow.
  "dimensions" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
  "computed_at" timestamp with time zone DEFAULT "now"() NOT NULL,

  CONSTRAINT "product_intensity_snapshots_pkey" PRIMARY KEY ("id"),
  -- A per-litre intensity of zero or below is not a carbon-negative product,
  -- it is a broken calculation, and one of them poisons a percentile. The
  -- writer skips them and logs; the constraint stops anything else inserting
  -- one quietly.
  CONSTRAINT "product_intensity_snapshots_value_positive" CHECK ("value" > 0)
);

ALTER TABLE "public"."product_intensity_snapshots"
  DROP CONSTRAINT IF EXISTS "product_intensity_snapshots_organization_id_fkey";
ALTER TABLE "public"."product_intensity_snapshots"
  ADD CONSTRAINT "product_intensity_snapshots_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE CASCADE;

ALTER TABLE "public"."product_intensity_snapshots"
  DROP CONSTRAINT IF EXISTS "product_intensity_snapshots_pcf_id_fkey";
ALTER TABLE "public"."product_intensity_snapshots"
  ADD CONSTRAINT "product_intensity_snapshots_pcf_id_fkey"
  FOREIGN KEY ("pcf_id") REFERENCES "public"."product_carbon_footprints"("id") ON DELETE CASCADE;

-- One row per product per metric per day: same-day reruns are idempotent, and
-- the daily sweep and the on-completion write cannot duplicate each other.
CREATE UNIQUE INDEX IF NOT EXISTS "product_intensity_snapshots_unique"
  ON "public"."product_intensity_snapshots" ("product_id", "metric_key", "snapshot_date");

CREATE INDEX IF NOT EXISTS "idx_product_intensity_snapshots_bucket"
  ON "public"."product_intensity_snapshots"
  ("metric_key", "category_group", "system_boundary", "pack_format", "snapshot_date" DESC);

CREATE INDEX IF NOT EXISTS "idx_product_intensity_snapshots_org"
  ON "public"."product_intensity_snapshots" ("organization_id", "snapshot_date" DESC);

COMMENT ON TABLE "public"."product_intensity_snapshots" IS
  'Per-product emission intensity (kg CO2e per litre) from completed PCFs, dimensioned by category, system boundary and pack format. The cohort behind the peer benchmark. Read cross-organisation ONLY through product_intensity_benchmark_view, which enforces k-anonymity; this table is readable only within your own organisation.';

COMMENT ON COLUMN "public"."product_intensity_snapshots"."system_boundary" IS
  'Canonical hyphenated boundary (cradle-to-gate, cradle-to-shelf, cradle-to-consumer, cradle-to-grave), written through normaliseBoundary. NOT NULL and never defaulted here: comparing across boundaries is the exact failure the literature table has.';

COMMENT ON COLUMN "public"."product_intensity_snapshots"."pack_format" IS
  'Cross-organisation pack token from lib/benchmarks/pack-format.ts, e.g. glass-bottle. Null when the container could not be resolved — such a product still reaches the category-only rung.';

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
-- Members read their own organisation's rows and nothing else. Every
-- cross-organisation read goes through the view below. Writes are service-role
-- only: these rows are computed from PCFs, never entered.
ALTER TABLE "public"."product_intensity_snapshots" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "product_intensity_snapshots_member_read" ON "public"."product_intensity_snapshots";
CREATE POLICY "product_intensity_snapshots_member_read"
  ON "public"."product_intensity_snapshots" FOR SELECT
  USING ("organization_id" IN (
    SELECT "om"."organization_id" FROM "public"."organization_members" "om"
    WHERE "om"."user_id" = "auth"."uid"()
  ));

GRANT SELECT ON TABLE "public"."product_intensity_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."product_intensity_snapshots" TO "service_role";

-- ---------------------------------------------------------------------------
-- The benchmark view
-- ---------------------------------------------------------------------------
-- k-anonymity lives HERE, not in a route, for the reason Pulse's
-- peer_benchmark_view exists: a guard in application code is one forgotten
-- filter away from being no guard at all.
--
-- The count is on DISTINCT organisations, not rows. `peer_benchmark_view` uses
-- count(*), which is equivalent for it because it holds one row per org per
-- metric — but here it is emphatically not: eight products from two businesses
-- is eight rows and no anonymity whatever.
--
-- Two figures are reported and they are different questions. `sample_size` is
-- how many products the percentiles are computed over, which is what a
-- producer wants to know. `organization_count` is how many businesses those
-- came from, which is what the privacy floor is set on.
--
-- No min and no max. A cohort extreme is one identifiable product's exact
-- footprint however many businesses are in the bucket.
--
-- Window: 365 days, against Pulse's 90. A completed LCA is not recomputed
-- daily, so a 90-day window would empty the cohort of every product nobody
-- happened to touch this quarter. The daily sweep re-stamps live products so
-- the window stays honest rather than merely long.
DROP VIEW IF EXISTS "public"."product_intensity_benchmark_view";

CREATE VIEW "public"."product_intensity_benchmark_view" AS
 WITH "latest_per_product" AS (
   SELECT DISTINCT ON ("s"."product_id", "s"."metric_key")
     "s"."organization_id",
     "s"."product_id",
     "s"."metric_key",
     "s"."value",
     "s"."category_group",
     "s"."system_boundary",
     "s"."pack_format",
     "s"."snapshot_date"
   FROM "public"."product_intensity_snapshots" "s"
   WHERE "s"."snapshot_date" >= (CURRENT_DATE - '365 days'::interval)
   ORDER BY "s"."product_id", "s"."metric_key", "s"."snapshot_date" DESC
 )
 -- Rung 1: like-for-like. Same category, same boundary, same pack format.
 SELECT
   'category_format'::"text" AS "bucket_kind",
   "metric_key",
   "category_group",
   "system_boundary",
   "pack_format",
   "count"(*) AS "sample_size",
   "count"(DISTINCT "organization_id") AS "organization_count",
   "percentile_cont"(0.25) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p25",
   "percentile_cont"(0.50) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p50",
   "percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p75",
   "avg"("value") AS "mean_value"
 FROM "latest_per_product"
 WHERE "category_group" IS NOT NULL AND "pack_format" IS NOT NULL
 GROUP BY "metric_key", "category_group", "system_boundary", "pack_format"
 HAVING "count"(DISTINCT "organization_id") >= 5
UNION ALL
 -- Rung 2: category only. Same category and boundary, any format.
 SELECT
   'category'::"text" AS "bucket_kind",
   "metric_key",
   "category_group",
   "system_boundary",
   NULL::"text" AS "pack_format",
   "count"(*) AS "sample_size",
   "count"(DISTINCT "organization_id") AS "organization_count",
   "percentile_cont"(0.25) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p25",
   "percentile_cont"(0.50) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p50",
   "percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("value")::double precision) AS "p75",
   "avg"("value") AS "mean_value"
 FROM "latest_per_product"
 WHERE "category_group" IS NOT NULL
 GROUP BY "metric_key", "category_group", "system_boundary"
 HAVING "count"(DISTINCT "organization_id") >= 5;

ALTER VIEW "public"."product_intensity_benchmark_view" OWNER TO "postgres";

COMMENT ON VIEW "public"."product_intensity_benchmark_view" IS
  'Anonymised peer intensity percentiles for the benchmark ladder. k-anonymity (≥5 DISTINCT organisations) is enforced HERE so no route can bypass it. sample_size counts products, organization_count counts businesses; the privacy floor is set on the latter. No min or max is exposed: a cohort extreme is one identifiable product. This is a cohort of alkatera customers, NOT a sample of the drinks sector — never label it an industry average.';

GRANT SELECT ON TABLE "public"."product_intensity_benchmark_view" TO "authenticated";
GRANT ALL ON TABLE "public"."product_intensity_benchmark_view" TO "service_role";

-- ---------------------------------------------------------------------------
-- The admin shape-of-the-data function
-- ---------------------------------------------------------------------------
-- Phase 2 of the plan needs to see buckets that DON'T clear k≥5 — that is the
-- entire point of looking before we score anyone. So it cannot read the view,
-- and it must be admin-only and expose no organisation identity at all: bucket
-- dimensions, counts and percentiles, nothing else.
CREATE OR REPLACE FUNCTION "public"."get_product_intensity_buckets"()
RETURNS TABLE (
  "bucket_kind" "text",
  "metric_key" "text",
  "category_group" "text",
  "system_boundary" "text",
  "pack_format" "text",
  "sample_size" bigint,
  "organization_count" bigint,
  "p25" double precision,
  "p50" double precision,
  "p75" double precision,
  "mean_value" numeric,
  "clears_k_anonymity" boolean
)
LANGUAGE "plpgsql" STABLE SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_alkatera_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  WITH latest_per_product AS (
    SELECT DISTINCT ON (s.product_id, s.metric_key)
      s.organization_id, s.product_id, s.metric_key, s.value,
      s.category_group, s.system_boundary, s.pack_format, s.snapshot_date
    FROM public.product_intensity_snapshots s
    WHERE s.snapshot_date >= (CURRENT_DATE - '365 days'::interval)
    ORDER BY s.product_id, s.metric_key, s.snapshot_date DESC
  )
  SELECT
    'category_format'::text,
    l.metric_key,
    l.category_group,
    l.system_boundary,
    l.pack_format,
    count(*)::bigint,
    count(DISTINCT l.organization_id)::bigint,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (l.value)::double precision),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY (l.value)::double precision),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (l.value)::double precision),
    avg(l.value),
    count(DISTINCT l.organization_id) >= 5
  FROM latest_per_product l
  WHERE l.category_group IS NOT NULL AND l.pack_format IS NOT NULL
  GROUP BY l.metric_key, l.category_group, l.system_boundary, l.pack_format
  UNION ALL
  SELECT
    'category'::text,
    l.metric_key,
    l.category_group,
    l.system_boundary,
    NULL::text,
    count(*)::bigint,
    count(DISTINCT l.organization_id)::bigint,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY (l.value)::double precision),
    percentile_cont(0.50) WITHIN GROUP (ORDER BY (l.value)::double precision),
    percentile_cont(0.75) WITHIN GROUP (ORDER BY (l.value)::double precision),
    avg(l.value),
    count(DISTINCT l.organization_id) >= 5
  FROM latest_per_product l
  WHERE l.category_group IS NOT NULL
  GROUP BY l.metric_key, l.category_group, l.system_boundary;
END;
$$;

ALTER FUNCTION "public"."get_product_intensity_buckets"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_product_intensity_buckets"() IS
  'Admin-only. Every intensity bucket INCLUDING those below the k-anonymity floor, so we can see the shape of our own data before scoring anyone against it. Exposes no organisation identity, only counts and percentiles. Customer-facing reads use product_intensity_benchmark_view.';

REVOKE ALL ON FUNCTION "public"."get_product_intensity_buckets"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."get_product_intensity_buckets"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."get_product_intensity_buckets"() TO "service_role";
