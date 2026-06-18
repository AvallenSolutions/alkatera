-- Add missing columns to supplier_products that are referenced by the
-- waterfall resolver, search APIs, and TypeScript types but never existed
-- in the database.

-- ==========================================================================
-- 1. GHG Breakdown
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS ghg_fossil numeric(12,6),
  ADD COLUMN IF NOT EXISTS ghg_biogenic numeric(12,6),
  ADD COLUMN IF NOT EXISTS ghg_land_use_change numeric(12,6);

COMMENT ON COLUMN supplier_products.ghg_fossil IS 'Fossil GHG emissions (kg CO2e per unit)';
COMMENT ON COLUMN supplier_products.ghg_biogenic IS 'Biogenic GHG emissions (kg CO2e per unit)';
COMMENT ON COLUMN supplier_products.ghg_land_use_change IS 'Direct land use change GHG emissions (kg CO2e per unit)';

-- ==========================================================================
-- 2. Water Scarcity
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS water_scarcity_factor numeric(12,6);

COMMENT ON COLUMN supplier_products.water_scarcity_factor IS 'AWARE water scarcity characterisation factor for product origin';

-- ==========================================================================
-- 3. Circularity Score
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS circularity_score numeric(5,2)
    CHECK (circularity_score IS NULL OR (circularity_score >= 0 AND circularity_score <= 100));

COMMENT ON COLUMN supplier_products.circularity_score IS 'Overall circularity score (0-100)';

-- ==========================================================================
-- 4. Nature / Biodiversity
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS terrestrial_ecotoxicity numeric(12,6),
  ADD COLUMN IF NOT EXISTS freshwater_eutrophication numeric(12,6),
  ADD COLUMN IF NOT EXISTS terrestrial_acidification numeric(12,6);

COMMENT ON COLUMN supplier_products.terrestrial_ecotoxicity IS 'Terrestrial ecotoxicity (kg 1,4-DCB eq per unit)';
COMMENT ON COLUMN supplier_products.freshwater_eutrophication IS 'Freshwater eutrophication (kg P eq per unit)';
COMMENT ON COLUMN supplier_products.terrestrial_acidification IS 'Terrestrial acidification (kg SO2 eq per unit)';

-- ==========================================================================
-- 5. Data Quality & Methodology
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS data_quality_score numeric(3,1)
    CHECK (data_quality_score IS NULL OR (data_quality_score >= 0 AND data_quality_score <= 5)),
  ADD COLUMN IF NOT EXISTS data_confidence_pct numeric(5,2)
    CHECK (data_confidence_pct IS NULL OR (data_confidence_pct >= 0 AND data_confidence_pct <= 100)),
  ADD COLUMN IF NOT EXISTS data_source_type text,
  ADD COLUMN IF NOT EXISTS methodology_standard text,
  ADD COLUMN IF NOT EXISTS functional_unit text,
  ADD COLUMN IF NOT EXISTS system_boundary text;

COMMENT ON COLUMN supplier_products.data_quality_score IS 'Data quality score 1-5 (ISO 14044 pedigree matrix)';
COMMENT ON COLUMN supplier_products.data_confidence_pct IS 'Data confidence percentage (0-100)';
COMMENT ON COLUMN supplier_products.data_source_type IS 'e.g. primary_measured, secondary_literature, proxy_estimate';
COMMENT ON COLUMN supplier_products.methodology_standard IS 'e.g. ISO 14044, ISO 14067, PEF';
COMMENT ON COLUMN supplier_products.functional_unit IS 'e.g. 1 kg of product at factory gate';
COMMENT ON COLUMN supplier_products.system_boundary IS 'e.g. cradle-to-gate, cradle-to-grave';

-- ==========================================================================
-- 6. External Verification
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS is_externally_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verifier_name text;

COMMENT ON COLUMN supplier_products.is_externally_verified IS 'Whether impact data has been externally verified';
COMMENT ON COLUMN supplier_products.verifier_name IS 'Name of the external verification body';

-- ==========================================================================
-- 7. Temporal / Geographic Validity
-- ==========================================================================
ALTER TABLE supplier_products
  ADD COLUMN IF NOT EXISTS valid_from date,
  ADD COLUMN IF NOT EXISTS valid_until date,
  ADD COLUMN IF NOT EXISTS reference_year integer,
  ADD COLUMN IF NOT EXISTS geographic_scope text;

COMMENT ON COLUMN supplier_products.valid_from IS 'Date from which this impact data is valid';
COMMENT ON COLUMN supplier_products.valid_until IS 'Date until which this impact data is valid';
COMMENT ON COLUMN supplier_products.reference_year IS 'Reference year for the impact data';
COMMENT ON COLUMN supplier_products.geographic_scope IS 'Geographic scope e.g. GB, EU, Global';

NOTIFY pgrst, 'reload schema';
