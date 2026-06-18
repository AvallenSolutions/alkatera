-- ============================================================
-- Agribalyse v3.2 Integration Schema Changes
-- Extends cache and product_materials to support dual-database
-- (ecoinvent + Agribalyse) impact calculations.
-- ============================================================

-- 1. Add source_database to openlca_impact_cache
-- This tracks which database (ecoinvent or Agribalyse) a cached
-- calculation result came from. Same process UUID could exist in
-- both databases with different results.
ALTER TABLE openlca_impact_cache
  ADD COLUMN IF NOT EXISTS source_database text DEFAULT 'ecoinvent';

-- Add a check constraint for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_cache_source_database'
  ) THEN
    ALTER TABLE openlca_impact_cache
      ADD CONSTRAINT check_cache_source_database
      CHECK (source_database IN ('ecoinvent', 'agribalyse'));
  END IF;
END $$;

-- Drop old unique index and create new one that includes source_database
-- so the same process can be cached from different databases
DROP INDEX IF EXISTS idx_openlca_impact_cache_org_process;
CREATE UNIQUE INDEX IF NOT EXISTS idx_openlca_impact_cache_org_process_db
  ON openlca_impact_cache(organization_id, process_id, source_database);

-- Index for efficient lookups by source database
CREATE INDEX IF NOT EXISTS idx_openlca_cache_source_db
  ON openlca_impact_cache(source_database);


-- 2. Add openlca_database to product_materials
-- This tracks which database a linked OpenLCA process UUID belongs to,
-- so recalculations use the correct database.
ALTER TABLE product_materials
  ADD COLUMN IF NOT EXISTS openlca_database text DEFAULT 'ecoinvent';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_pm_openlca_database'
  ) THEN
    ALTER TABLE product_materials
      ADD CONSTRAINT check_pm_openlca_database
      CHECK (openlca_database IN ('ecoinvent', 'agribalyse'));
  END IF;
END $$;

-- Index for querying materials by their data source database
CREATE INDEX IF NOT EXISTS idx_product_materials_openlca_db
  ON product_materials(data_source, openlca_database)
  WHERE data_source = 'openlca';


-- 3. Add source_database to staging_emission_factors metadata
-- (Agribalyse-sourced factors already carry this in the metadata JSONB,
-- but add a top-level column for efficient filtering)
ALTER TABLE staging_emission_factors
  ADD COLUMN IF NOT EXISTS source_database text DEFAULT NULL;

-- Note: source_database is nullable here — NULL means the factor was
-- manually curated from literature. 'agribalyse' means it was extracted
-- from the Agribalyse database. 'ecoinvent' means it was derived from
-- ecoinvent data.

COMMENT ON COLUMN openlca_impact_cache.source_database IS
  'Which OpenLCA database this cached result was calculated from (ecoinvent or agribalyse)';

COMMENT ON COLUMN product_materials.openlca_database IS
  'Which OpenLCA database the linked process UUID belongs to (ecoinvent or agribalyse)';

COMMENT ON COLUMN staging_emission_factors.source_database IS
  'Database origin of this factor: null=literature, agribalyse=Agribalyse v3.2, ecoinvent=ecoinvent 3.12';
