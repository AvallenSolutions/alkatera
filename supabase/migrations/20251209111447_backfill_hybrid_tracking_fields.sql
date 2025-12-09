/*
  # Backfill Hybrid Tracking Fields for Existing LCAs

  1. Purpose
    - Populate category_type for all existing materials
    - Set gwp_data_source and non_gwp_data_source based on existing data
    - Initialize is_hybrid_source flag
    - Set data_quality_grade based on existing data quality indicators
    - Preserve all existing impact values (no data loss)

  2. Changes
    - Updates product_lca_materials with category detection
    - Updates staging_emission_factors with category detection
    - Sets default values for new tracking fields
    - Maintains backward compatibility

  3. Data Safety
    - No destructive operations
    - All existing impact values preserved
    - Default values for new fields
    - Idempotent (can be run multiple times safely)
*/

-- ============================================================================
-- 1. Backfill product_lca_materials
-- ============================================================================

-- Update category_type based on material name patterns
UPDATE product_lca_materials
SET category_type = (CASE
  -- Energy materials
  WHEN LOWER(name) LIKE '%electricity%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%natural gas%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%diesel%combustion%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%petrol%combustion%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%fuel oil%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%lpg%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%coal%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%heating%' THEN 'SCOPE_1_2_ENERGY'

  -- Freight transport materials
  WHEN LOWER(name) LIKE '%hgv%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%freight%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%cargo%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%shipping%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%sea freight%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%air freight%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%transport%' AND NOT LOWER(name) LIKE '%passenger%' THEN 'SCOPE_3_TRANSPORT'

  -- Commuting transport materials
  WHEN LOWER(name) LIKE '%rail%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%bus%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%car%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%taxi%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%underground%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%metro%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%commut%' THEN 'SCOPE_3_COMMUTING'

  -- Waste materials
  WHEN LOWER(name) LIKE '%waste%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%landfill%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%incineration%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%recycl%' THEN 'WASTE'

  -- Default: Manufacturing material
  ELSE 'MANUFACTURING_MATERIAL'
END)::material_category_type
WHERE category_type IS NULL;

-- Set gwp_data_source based on existing data_source
UPDATE product_lca_materials
SET gwp_data_source = CASE
  WHEN data_source = 'supplier' THEN 'Supplier EPD'
  WHEN data_source = 'ecoinvent' THEN 'Ecoinvent 3.12'
  WHEN data_source = 'staging' THEN
    CASE
      WHEN category_type IN ('SCOPE_1_2_ENERGY', 'SCOPE_3_TRANSPORT', 'SCOPE_3_COMMUTING')
      THEN 'DEFRA 2025'
      ELSE 'Ecoinvent 3.12'
    END
  ELSE 'Unknown'
END
WHERE gwp_data_source IS NULL;

-- Set non_gwp_data_source
UPDATE product_lca_materials
SET non_gwp_data_source = CASE
  WHEN data_source = 'supplier' THEN 'Supplier EPD'
  WHEN data_source = 'ecoinvent' THEN 'Ecoinvent 3.12'
  WHEN data_source = 'staging' THEN 'Ecoinvent 3.12'
  ELSE 'Unknown'
END
WHERE non_gwp_data_source IS NULL;

-- Set is_hybrid_source flag
UPDATE product_lca_materials
SET is_hybrid_source = (
  gwp_data_source != non_gwp_data_source
  AND gwp_data_source IS NOT NULL
  AND non_gwp_data_source IS NOT NULL
)
WHERE is_hybrid_source IS NULL;

-- Set data_quality_grade based on data source
UPDATE product_lca_materials
SET data_quality_grade = CASE
  WHEN data_source = 'supplier' THEN 'HIGH'
  WHEN data_source = 'ecoinvent' THEN 'MEDIUM'
  WHEN data_source = 'staging' AND category_type IN ('SCOPE_1_2_ENERGY', 'SCOPE_3_TRANSPORT', 'SCOPE_3_COMMUTING') THEN 'MEDIUM'
  WHEN data_source = 'staging' THEN 'LOW'
  ELSE 'LOW'
END
WHERE data_quality_grade IS NULL;

-- Set confidence_score based on data quality grade
UPDATE product_lca_materials
SET confidence_score = CASE
  WHEN data_quality_grade = 'HIGH' THEN 95
  WHEN data_quality_grade = 'MEDIUM' AND is_hybrid_source = true THEN 80
  WHEN data_quality_grade = 'MEDIUM' THEN 70
  WHEN data_quality_grade = 'LOW' THEN 50
  ELSE 50
END
WHERE confidence_score IS NULL;

-- Set methodology based on sources
UPDATE product_lca_materials
SET methodology = CASE
  WHEN is_hybrid_source = true THEN gwp_data_source || ' (GWP) + ' || non_gwp_data_source || ' (non-GWP)'
  ELSE COALESCE(gwp_data_source, 'Unknown')
END
WHERE methodology IS NULL;

-- ============================================================================
-- 2. Backfill staging_emission_factors
-- ============================================================================

-- Update category_type for staging factors
UPDATE staging_emission_factors
SET category_type = (CASE
  -- Energy materials
  WHEN LOWER(name) LIKE '%electricity%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%natural gas%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%diesel%' AND LOWER(category) LIKE '%combustion%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%petrol%' AND LOWER(category) LIKE '%combustion%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%fuel oil%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%lpg%' THEN 'SCOPE_1_2_ENERGY'
  WHEN LOWER(name) LIKE '%coal%' THEN 'SCOPE_1_2_ENERGY'

  -- Freight transport
  WHEN LOWER(name) LIKE '%hgv%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%freight%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%cargo%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%shipping%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%sea freight%' THEN 'SCOPE_3_TRANSPORT'
  WHEN LOWER(name) LIKE '%air freight%' THEN 'SCOPE_3_TRANSPORT'

  -- Commuting transport
  WHEN LOWER(name) LIKE '%rail%' AND LOWER(category) LIKE '%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%bus%' AND LOWER(category) LIKE '%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%car%' AND LOWER(category) LIKE '%passenger%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%taxi%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%underground%' THEN 'SCOPE_3_COMMUTING'
  WHEN LOWER(name) LIKE '%metro%' THEN 'SCOPE_3_COMMUTING'

  -- Waste
  WHEN LOWER(name) LIKE '%waste%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%landfill%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%incineration%' THEN 'WASTE'
  WHEN LOWER(name) LIKE '%recycl%' THEN 'WASTE'

  ELSE 'MANUFACTURING_MATERIAL'
END)::material_category_type
WHERE category_type IS NULL;

-- Set geographic_scope
UPDATE staging_emission_factors
SET geographic_scope = CASE
  WHEN LOWER(name) LIKE '%uk%' OR LOWER(name) LIKE '%gb%' THEN 'UK'
  WHEN LOWER(name) LIKE '%eu%' OR LOWER(name) LIKE '%europe%' THEN 'EU'
  WHEN LOWER(name) LIKE '%global%' OR LOWER(name) LIKE '%world%' THEN 'GLO'
  ELSE 'GLO'
END
WHERE geographic_scope IS NULL;

-- ============================================================================
-- 3. Set default values for NULL fields
-- ============================================================================

UPDATE product_lca_materials
SET
  category_type = COALESCE(category_type, 'MANUFACTURING_MATERIAL'::material_category_type),
  gwp_data_source = COALESCE(gwp_data_source, 'Unknown'),
  non_gwp_data_source = COALESCE(non_gwp_data_source, 'Unknown'),
  is_hybrid_source = COALESCE(is_hybrid_source, false),
  data_quality_grade = COALESCE(data_quality_grade, 'LOW'),
  confidence_score = COALESCE(confidence_score, 50),
  methodology = COALESCE(methodology, 'Unknown')
WHERE
  category_type IS NULL
  OR gwp_data_source IS NULL
  OR non_gwp_data_source IS NULL
  OR is_hybrid_source IS NULL
  OR data_quality_grade IS NULL
  OR confidence_score IS NULL
  OR methodology IS NULL;

UPDATE staging_emission_factors
SET
  category_type = COALESCE(category_type, 'MANUFACTURING_MATERIAL'::material_category_type),
  geographic_scope = COALESCE(geographic_scope, 'GLO')
WHERE
  category_type IS NULL
  OR geographic_scope IS NULL;
