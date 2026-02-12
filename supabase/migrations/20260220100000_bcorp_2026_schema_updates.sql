-- B Corp 2026 Schema Updates
-- Adds support for pass/fail scoring model and year-based progression

-- 1. Add scoring_model to certification_frameworks
ALTER TABLE "public"."certification_frameworks"
  ADD COLUMN IF NOT EXISTS "scoring_model" character varying(50) DEFAULT 'points';

-- 2. Add progression_model (JSONB) for year-based progression
ALTER TABLE "public"."certification_frameworks"
  ADD COLUMN IF NOT EXISTS "progression_model" jsonb;

-- 3. Add year-based applicability to requirements
ALTER TABLE "public"."certification_framework_requirements"
  ADD COLUMN IF NOT EXISTS "applicable_from_year" integer DEFAULT 0;

-- 4. Add size threshold for requirements that only apply to certain org sizes
ALTER TABLE "public"."certification_framework_requirements"
  ADD COLUMN IF NOT EXISTS "size_threshold" character varying(50) DEFAULT 'all';

-- 5. Add topic_area for grouping (foundation vs impact_topic)
ALTER TABLE "public"."certification_framework_requirements"
  ADD COLUMN IF NOT EXISTS "topic_area" character varying(100);

-- 6. Add current_year to organization_certifications for tracking progression
ALTER TABLE "public"."organization_certifications"
  ADD COLUMN IF NOT EXISTS "current_year" integer DEFAULT 0;

-- Add same columns to framework_requirements table (the duplicate)
ALTER TABLE "public"."framework_requirements"
  ADD COLUMN IF NOT EXISTS "applicable_from_year" integer DEFAULT 0;

ALTER TABLE "public"."framework_requirements"
  ADD COLUMN IF NOT EXISTS "size_threshold" character varying(50) DEFAULT 'all';

ALTER TABLE "public"."framework_requirements"
  ADD COLUMN IF NOT EXISTS "topic_area" character varying(100);

-- Add comments for documentation
COMMENT ON COLUMN "public"."certification_frameworks"."scoring_model" IS 'Scoring model: points (legacy numeric scoring) or pass_fail (mandatory requirement checking)';
COMMENT ON COLUMN "public"."certification_frameworks"."progression_model" IS 'JSON defining year-based progression, e.g. {"years": [0,3,5], "labels": ["Year 0","Year 3","Year 5"]}';
COMMENT ON COLUMN "public"."certification_framework_requirements"."applicable_from_year" IS 'Year from which this requirement becomes applicable (0, 3, or 5 for B Corp 2026)';
COMMENT ON COLUMN "public"."certification_framework_requirements"."size_threshold" IS 'Organisation size threshold: all, medium_large, large_only';
COMMENT ON COLUMN "public"."certification_framework_requirements"."topic_area" IS 'Grouping: foundation (Foundation Requirements) or impact_topic name';
COMMENT ON COLUMN "public"."organization_certifications"."current_year" IS 'Current progression year for frameworks with year-based progression';
