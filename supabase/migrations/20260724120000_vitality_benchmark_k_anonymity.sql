-- Close the privacy hole in the vitality benchmark.
--
-- `get_organization_benchmark_comparison` returned `*_top` — the single best
-- organisation's exact pillar score — alongside `organization_count`, with no
-- minimum-cohort guard anywhere in the function or the view beneath it. In a
-- category holding three organisations, "top performer in Spirits" is close to
-- publishing a named competitor's number, and the average of the other two is
-- solvable from it.
--
-- Pulse got this right and is the model: `peer_benchmark_view` carries
-- `HAVING count(*) >= 5` INSIDE the view, so no route, RPC or ad-hoc query can
-- bypass k-anonymity by forgetting a filter. This migration puts the same
-- guard inside `vitality_benchmarks`.
--
-- Two changes, not one:
--
--   1. k ≥ 5 DISTINCT organisations, enforced in the view. A cohort below that
--      produces no row at all, so the RPC has nothing to leak and the UI shows
--      no benchmark rather than a thin one.
--
--   2. `max(score)` becomes `percentile_cont(0.75)`. A maximum is always one
--      identifiable organisation's score, and k ≥ 5 does not change that — it
--      only means four others are hiding behind it. The internal-benchmarks
--      plan says as much: "k≥5 plus never exposing a max is the floor". The
--      top quartile keeps the aspirational anchor the UI was built around
--      without publishing anybody's row.
--
-- The RPC also now returns `cohort_count` on each block, so the surface can
-- say what it is comparing against instead of showing a bare number.

-- ---------------------------------------------------------------------------
-- The view
-- ---------------------------------------------------------------------------
-- Dropped rather than replaced: the column list changes (`*_top` → `*_p75`),
-- and CREATE OR REPLACE VIEW cannot rename or retype existing columns.
DROP VIEW IF EXISTS "public"."vitality_benchmarks";

CREATE VIEW "public"."vitality_benchmarks" AS
 WITH "latest_scores" AS (
         SELECT DISTINCT ON ("organization_vitality_scores"."organization_id")
            "organization_vitality_scores"."organization_id",
            "organization_vitality_scores"."overall_score",
            "organization_vitality_scores"."climate_score",
            "organization_vitality_scores"."water_score",
            "organization_vitality_scores"."circularity_score",
            "organization_vitality_scores"."nature_score",
            "organization_vitality_scores"."year",
            "organization_vitality_scores"."calculation_date"
           FROM "public"."organization_vitality_scores"
          ORDER BY "organization_vitality_scores"."organization_id",
                   "organization_vitality_scores"."calculation_date" DESC
        ), "org_categories" AS (
         SELECT "organizations"."id" AS "organization_id",
            "organizations"."industry_sector" AS "category_name"
           FROM "public"."organizations"
          WHERE ("organizations"."industry_sector" IS NOT NULL)
        )
 SELECT 'platform'::"text" AS "benchmark_type",
    NULL::"text" AS "category_name",
    ("round"("avg"("ls"."overall_score")))::integer AS "overall_avg",
    ("round"("avg"("ls"."climate_score")))::integer AS "climate_avg",
    ("round"("avg"("ls"."water_score")))::integer AS "water_avg",
    ("round"("avg"("ls"."circularity_score")))::integer AS "circularity_avg",
    ("round"("avg"("ls"."nature_score")))::integer AS "nature_avg",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."overall_score")::double precision))::numeric)::integer AS "overall_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."climate_score")::double precision))::numeric)::integer AS "climate_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."water_score")::double precision))::numeric)::integer AS "water_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."circularity_score")::double precision))::numeric)::integer AS "circularity_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."nature_score")::double precision))::numeric)::integer AS "nature_p75",
    "count"(DISTINCT "ls"."organization_id") AS "organization_count",
    "now"() AS "calculated_at"
   FROM "latest_scores" "ls"
  HAVING ("count"(DISTINCT "ls"."organization_id") >= 5)
UNION ALL
 SELECT 'category'::"text" AS "benchmark_type",
    "oc"."category_name",
    ("round"("avg"("ls"."overall_score")))::integer AS "overall_avg",
    ("round"("avg"("ls"."climate_score")))::integer AS "climate_avg",
    ("round"("avg"("ls"."water_score")))::integer AS "water_avg",
    ("round"("avg"("ls"."circularity_score")))::integer AS "circularity_avg",
    ("round"("avg"("ls"."nature_score")))::integer AS "nature_avg",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."overall_score")::double precision))::numeric)::integer AS "overall_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."climate_score")::double precision))::numeric)::integer AS "climate_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."water_score")::double precision))::numeric)::integer AS "water_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."circularity_score")::double precision))::numeric)::integer AS "circularity_p75",
    ("round"("percentile_cont"(0.75) WITHIN GROUP (ORDER BY ("ls"."nature_score")::double precision))::numeric)::integer AS "nature_p75",
    "count"(DISTINCT "ls"."organization_id") AS "organization_count",
    "now"() AS "calculated_at"
   FROM ("latest_scores" "ls"
     JOIN "org_categories" "oc" ON (("ls"."organization_id" = "oc"."organization_id")))
  WHERE ("oc"."category_name" IS NOT NULL)
  GROUP BY "oc"."category_name"
 HAVING ("count"(DISTINCT "ls"."organization_id") >= 5);

ALTER VIEW "public"."vitality_benchmarks" OWNER TO "postgres";

COMMENT ON VIEW "public"."vitality_benchmarks" IS
  'Anonymised cross-org vitality percentiles. k-anonymity (≥5 DISTINCT organisations) is enforced HERE, not in application code, so no route can bypass it — same architecture as peer_benchmark_view. Exposes a p75 rather than a max: a maximum is one identifiable organisation''s score however large the cohort.';

GRANT SELECT ON TABLE "public"."vitality_benchmarks" TO "anon";
GRANT SELECT ON TABLE "public"."vitality_benchmarks" TO "authenticated";
GRANT ALL ON TABLE "public"."vitality_benchmarks" TO "service_role";

-- ---------------------------------------------------------------------------
-- The RPC
-- ---------------------------------------------------------------------------
-- Same signature and same access check; what changes is that a benchmark block
-- is only built when the view actually returned a row for it, and each block
-- now names its cohort size so the UI can say what it compared against.
CREATE OR REPLACE FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
v_result jsonb;
v_latest_score organization_vitality_scores%ROWTYPE;
v_platform_benchmark vitality_benchmarks%ROWTYPE;
v_category_benchmark vitality_benchmarks%ROWTYPE;
v_org_category text;
BEGIN
IF NOT EXISTS (
SELECT 1 FROM organization_members
WHERE organization_id = p_organization_id
AND user_id = auth.uid()
) THEN
RAISE EXCEPTION 'Access denied';
END IF;

SELECT * INTO v_latest_score
FROM organization_vitality_scores
WHERE organization_id = p_organization_id
ORDER BY calculation_date DESC
LIMIT 1;

IF NOT FOUND THEN
RETURN jsonb_build_object(
'has_data', false,
'message', 'No vitality scores calculated yet'
);
END IF;

SELECT industry_sector INTO v_org_category
FROM organizations
WHERE id = p_organization_id;

-- Both of these can come back empty. The view withholds any cohort below
-- five distinct organisations, so NOT FOUND here means "too few peers to
-- compare against", and the block is left out entirely rather than filled
-- with nulls that a caller might render as zeroes.
SELECT * INTO v_platform_benchmark
FROM vitality_benchmarks
WHERE benchmark_type = 'platform';

IF v_org_category IS NOT NULL THEN
SELECT * INTO v_category_benchmark
FROM vitality_benchmarks
WHERE benchmark_type = 'category'
AND category_name = v_org_category;
END IF;

v_result := jsonb_build_object(
'has_data', true,
'current_scores', jsonb_build_object(
'overall', v_latest_score.overall_score,
'climate', v_latest_score.climate_score,
'water', v_latest_score.water_score,
'circularity', v_latest_score.circularity_score,
'nature', v_latest_score.nature_score,
'calculation_date', v_latest_score.calculation_date
),
'minimum_cohort', 5
);

IF v_platform_benchmark.organization_count IS NOT NULL THEN
v_result := v_result || jsonb_build_object(
'platform_benchmarks', jsonb_build_object(
'overall_average', v_platform_benchmark.overall_avg,
'climate_average', v_platform_benchmark.climate_avg,
'water_average', v_platform_benchmark.water_avg,
'circularity_average', v_platform_benchmark.circularity_avg,
'nature_average', v_platform_benchmark.nature_avg,
'overall_top_quartile', v_platform_benchmark.overall_p75,
'climate_top_quartile', v_platform_benchmark.climate_p75,
'water_top_quartile', v_platform_benchmark.water_p75,
'circularity_top_quartile', v_platform_benchmark.circularity_p75,
'nature_top_quartile', v_platform_benchmark.nature_p75,
'organization_count', v_platform_benchmark.organization_count
)
);
END IF;

IF v_category_benchmark.organization_count IS NOT NULL THEN
v_result := v_result || jsonb_build_object(
'category_benchmarks', jsonb_build_object(
'category_name', v_org_category,
'overall_average', v_category_benchmark.overall_avg,
'climate_average', v_category_benchmark.climate_avg,
'water_average', v_category_benchmark.water_avg,
'circularity_average', v_category_benchmark.circularity_avg,
'nature_average', v_category_benchmark.nature_avg,
'overall_top_quartile', v_category_benchmark.overall_p75,
'climate_top_quartile', v_category_benchmark.climate_p75,
'water_top_quartile', v_category_benchmark.water_p75,
'circularity_top_quartile', v_category_benchmark.circularity_p75,
'nature_top_quartile', v_category_benchmark.nature_p75,
'organization_count', v_category_benchmark.organization_count
)
);
END IF;

RETURN v_result;
END;
$$;

ALTER FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") OWNER TO "postgres";

COMMENT ON FUNCTION "public"."get_organization_benchmark_comparison"("p_organization_id" "uuid") IS
  'Vitality peer comparison for one organisation. Reads vitality_benchmarks, which withholds any cohort below five distinct organisations, so a missing platform_benchmarks or category_benchmarks block means "too few peers", not "no data". Returns a top quartile, never a single best score.';
