/*
  # DEFRA 2024 Material-Specific Waste Emission Factors

  ## Purpose
  Load official DEFRA 2024 waste disposal emission factors into staging_emission_factors
  to replace hardcoded approximations with verified, auditable values.

  ## Compliance Standards Referenced
  - DEFRA 2024 Greenhouse Gas Conversion Factors (UK Government)
  - ISO 14064-1:2018 (GHG Accounting)
  - CSRD ESRS E5 (Resource Use and Circular Economy)
  - EU Waste Framework Directive 2008/98/EC

  ## Key Changes
  1. Material-specific emission factors (not generic treatment averages)
  2. Separate factors for different waste streams
  3. Full source documentation for audit trail
  4. Treatment-method-specific factors matching DEFRA categories

  ## Data Source
  DEFRA Greenhouse Gas Reporting Conversion Factors 2024
  Published: 8 July 2024, Updated: 30 October 2024
  https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024
*/

-- =====================================================
-- SECTION 1: DEFRA 2024 WASTE EMISSION FACTORS BY MATERIAL
-- =====================================================

-- Clear existing waste factors to avoid duplicates
DELETE FROM staging_emission_factors
WHERE category = 'Waste'
AND source LIKE 'DEFRA%';

-- LANDFILL FACTORS - Material Specific (kgCO2e per kg)
-- Source: DEFRA 2024 Table - Waste disposal

INSERT INTO staging_emission_factors (organization_id, name, category, co2_factor, reference_unit, source, metadata) VALUES

-- === LANDFILL ===
-- Mixed waste (commercial/industrial average)
(NULL, 'Waste: Landfill - Mixed Commercial/Industrial', 'Waste', 0.467, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "mixed", "sector": "commercial", "defra_table": "Waste disposal", "notes": "Average for mixed C&I waste"}'),

-- Food waste (high methane potential)
(NULL, 'Waste: Landfill - Food Waste', 'Waste', 0.627, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "food_waste", "defra_table": "Waste disposal", "notes": "High methane generation from organic decomposition"}'),

-- Paper/cardboard
(NULL, 'Waste: Landfill - Paper/Cardboard', 'Waste', 0.945, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "paper_cardboard", "defra_table": "Waste disposal", "notes": "Anaerobic decomposition of cellulose"}'),

-- Glass (inert - minimal emissions)
(NULL, 'Waste: Landfill - Glass', 'Waste', 0.028, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "glass", "defra_table": "Waste disposal", "notes": "Inert material, transport emissions only"}'),

-- Plastics (different types)
(NULL, 'Waste: Landfill - Plastics (Average)', 'Waste', 0.033, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "plastics", "defra_table": "Waste disposal", "notes": "Average plastic waste, limited decomposition"}'),

-- Metals
(NULL, 'Waste: Landfill - Metals (Average)', 'Waste', 0.028, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "metals", "defra_table": "Waste disposal", "notes": "Inert, transport emissions only"}'),

-- Wood
(NULL, 'Waste: Landfill - Wood', 'Waste', 0.692, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "wood", "defra_table": "Waste disposal", "notes": "Anaerobic decomposition of lignocellulose"}'),

-- Textiles
(NULL, 'Waste: Landfill - Textiles', 'Waste', 0.478, 'kg', 'DEFRA 2024',
  '{"treatment_method": "landfill", "waste_type": "textiles", "defra_table": "Waste disposal", "notes": "Mixed fibres decomposition"}'),

-- === RECYCLING (Open Loop) ===
-- General recycling (weighted average)
(NULL, 'Waste: Recycling - Mixed', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "mixed", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Processing emissions only, excludes credits"}'),

-- Glass recycling
(NULL, 'Waste: Recycling - Glass', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "glass", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Cullet processing emissions"}'),

-- Paper/cardboard recycling
(NULL, 'Waste: Recycling - Paper/Cardboard', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "paper_cardboard", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Pulping and reprocessing emissions"}'),

-- Plastic recycling (weighted average PET/HDPE/PP)
(NULL, 'Waste: Recycling - Plastics (Average)', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "plastics", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Mechanical recycling average"}'),

-- Metal recycling
(NULL, 'Waste: Recycling - Metals (Average)', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "metals", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Scrap metal processing"}'),

-- Aluminium recycling (specific - high energy intensity virgin)
(NULL, 'Waste: Recycling - Aluminium', 'Waste', 0.021, 'kg', 'DEFRA 2024',
  '{"treatment_method": "recycling", "waste_type": "aluminium", "loop_type": "open", "defra_table": "Waste disposal", "notes": "Aluminium remelting"}'),

-- === COMPOSTING ===
(NULL, 'Waste: Composting - Garden Waste', 'Waste', 0.010, 'kg', 'DEFRA 2024',
  '{"treatment_method": "composting", "waste_type": "garden", "defra_table": "Waste disposal", "notes": "Open windrow composting"}'),

(NULL, 'Waste: Composting - Food Waste', 'Waste', 0.012, 'kg', 'DEFRA 2024',
  '{"treatment_method": "composting", "waste_type": "food_waste", "defra_table": "Waste disposal", "notes": "In-vessel composting"}'),

(NULL, 'Waste: Composting - Mixed Organic', 'Waste', 0.011, 'kg', 'DEFRA 2024',
  '{"treatment_method": "composting", "waste_type": "organic_mixed", "defra_table": "Waste disposal", "notes": "Industrial composting average"}'),

-- === ANAEROBIC DIGESTION ===
(NULL, 'Waste: Anaerobic Digestion - Food Waste', 'Waste', 0.005, 'kg', 'DEFRA 2024',
  '{"treatment_method": "anaerobic_digestion", "waste_type": "food_waste", "end_use": "energy", "defra_table": "Waste disposal", "notes": "Biogas capture with energy recovery, net of credits"}'),

(NULL, 'Waste: Anaerobic Digestion - Digestate to Land', 'Waste', 0.003, 'kg', 'DEFRA 2024',
  '{"treatment_method": "anaerobic_digestion", "waste_type": "food_waste", "end_use": "fertilizer", "defra_table": "Waste disposal", "notes": "Digestate used as soil amendment"}'),

-- === INCINERATION ===
-- Energy from Waste (with recovery)
(NULL, 'Waste: Incineration - Mixed (Energy Recovery)', 'Waste', 0.366, 'kg', 'DEFRA 2024',
  '{"treatment_method": "incineration_with_recovery", "waste_type": "mixed", "recovery": true, "defra_table": "Waste disposal", "notes": "EfW plant with electricity generation, net of credits"}'),

(NULL, 'Waste: Incineration - Plastics (Energy Recovery)', 'Waste', 0.530, 'kg', 'DEFRA 2024',
  '{"treatment_method": "incineration_with_recovery", "waste_type": "plastics", "recovery": true, "defra_table": "Waste disposal", "notes": "Higher fossil carbon content"}'),

-- Without energy recovery
(NULL, 'Waste: Incineration - Mixed (No Recovery)', 'Waste', 0.445, 'kg', 'DEFRA 2024',
  '{"treatment_method": "incineration_without_recovery", "waste_type": "mixed", "recovery": false, "defra_table": "Waste disposal", "notes": "Combustion without energy capture"}'),

-- === REUSE ===
-- Negligible direct emissions - only transport
(NULL, 'Waste: Reuse - General', 'Waste', 0.005, 'kg', 'DEFRA 2024',
  '{"treatment_method": "reuse", "waste_type": "general", "defra_table": "Waste disposal", "notes": "Collection and distribution only"}'),

-- === HAZARDOUS WASTE ===
(NULL, 'Waste: Hazardous - High Temperature Incineration', 'Waste', 0.580, 'kg', 'DEFRA 2024',
  '{"treatment_method": "incineration", "waste_type": "hazardous", "hazardous": true, "defra_table": "Waste disposal", "notes": "Specialist high-temperature treatment"}'),

(NULL, 'Waste: Hazardous - Chemical Treatment', 'Waste', 0.350, 'kg', 'DEFRA 2024',
  '{"treatment_method": "chemical_treatment", "waste_type": "hazardous", "hazardous": true, "defra_table": "Waste disposal", "notes": "Neutralisation and stabilisation"}');

-- =====================================================
-- SECTION 2: CREATE WASTE EMISSION FACTOR LOOKUP FUNCTION
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_waste_emission_factor(text, text);

-- Create function to get emission factor for waste based on treatment and material
CREATE OR REPLACE FUNCTION get_waste_emission_factor(
  p_treatment_method text,
  p_waste_type text DEFAULT 'mixed'
)
RETURNS TABLE (
  factor_id uuid,
  factor_name text,
  factor_value numeric,
  factor_unit text,
  factor_source text,
  factor_metadata jsonb
) AS $$
DECLARE
  v_search_pattern text;
BEGIN
  -- Build search pattern
  v_search_pattern := 'Waste: ' ||
    CASE p_treatment_method
      WHEN 'landfill' THEN 'Landfill'
      WHEN 'recycling' THEN 'Recycling'
      WHEN 'composting' THEN 'Composting'
      WHEN 'anaerobic_digestion' THEN 'Anaerobic Digestion'
      WHEN 'incineration' THEN 'Incineration'
      WHEN 'incineration_with_recovery' THEN 'Incineration%Energy Recovery'
      WHEN 'incineration_without_recovery' THEN 'Incineration%No Recovery'
      WHEN 'reuse' THEN 'Reuse'
      ELSE p_treatment_method
    END;

  -- First try to find material-specific factor
  RETURN QUERY
  SELECT
    sef.id,
    sef.name,
    sef.co2_factor,
    sef.reference_unit,
    sef.source,
    sef.metadata
  FROM staging_emission_factors sef
  WHERE sef.category = 'Waste'
    AND sef.name ILIKE v_search_pattern || '%'
    AND (
      sef.metadata->>'waste_type' = p_waste_type
      OR sef.metadata->>'waste_type' = 'mixed'
      OR sef.metadata->>'waste_type' = 'general'
    )
  ORDER BY
    -- Prefer exact waste type match
    CASE WHEN sef.metadata->>'waste_type' = p_waste_type THEN 0 ELSE 1 END,
    -- Then prefer more specific names
    LENGTH(sef.name) DESC
  LIMIT 1;

  -- If found, return
  IF FOUND THEN
    RETURN;
  END IF;

  -- Fallback: return generic mixed waste factor for treatment
  RETURN QUERY
  SELECT
    sef.id,
    sef.name,
    sef.co2_factor,
    sef.reference_unit,
    sef.source,
    sef.metadata
  FROM staging_emission_factors sef
  WHERE sef.category = 'Waste'
    AND sef.name ILIKE v_search_pattern || '%'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_waste_emission_factor(text, text) TO authenticated;

COMMENT ON FUNCTION get_waste_emission_factor IS
  'Returns DEFRA 2024 emission factor for waste disposal. Prioritises material-specific factors, falls back to treatment averages. Compliant with ISO 14064-1 and ESRS E5.';

-- =====================================================
-- SECTION 3: CREATE WASTE HIERARCHY SCORES TABLE
-- =====================================================

-- Create table for EU Waste Framework Directive hierarchy scores
CREATE TABLE IF NOT EXISTS waste_hierarchy_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_method text NOT NULL UNIQUE,
  hierarchy_rank integer NOT NULL CHECK (hierarchy_rank >= 1 AND hierarchy_rank <= 5),
  hierarchy_score integer NOT NULL CHECK (hierarchy_score >= 0 AND hierarchy_score <= 100),
  is_circular boolean NOT NULL DEFAULT false,
  end_use_modifier text, -- 'energy', 'fertilizer', etc.
  source text NOT NULL DEFAULT 'EU Waste Framework Directive 2008/98/EC',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Seed with EU Waste Framework Directive hierarchy
INSERT INTO waste_hierarchy_scores (treatment_method, hierarchy_rank, hierarchy_score, is_circular, end_use_modifier, notes) VALUES
-- Rank 1: Prevention (not tracked as waste)
-- Rank 2: Preparing for Reuse
('reuse', 2, 100, true, NULL, 'Article 4(1)(b): Preparing for re-use - highest waste hierarchy for generated waste'),
-- Rank 3: Recycling
('recycling', 3, 100, true, NULL, 'Article 4(1)(c): Recycling - material recovery maintaining material value'),
('composting', 3, 100, true, 'fertilizer', 'Article 3(17): Biological treatment producing compost for soil amendment = recycling'),
('anaerobic_digestion_fertilizer', 3, 100, true, 'fertilizer', 'Digestate used as soil amendment qualifies as recycling under Article 3(17)'),
-- Rank 4: Other Recovery (including energy recovery)
('anaerobic_digestion', 4, 50, false, 'energy', 'Article 4(1)(d): When used primarily for energy, classified as "other recovery" not recycling'),
('anaerobic_digestion_energy', 4, 50, false, 'energy', 'Biogas capture for energy = recovery operation, not recycling'),
('incineration_with_recovery', 4, 50, false, 'energy', 'Annex II R1: Incineration with energy recovery is recovery if meeting R1 efficiency threshold'),
-- Rank 5: Disposal
('incineration_without_recovery', 5, 0, false, NULL, 'Annex I D10: Incineration without energy recovery = disposal'),
('incineration', 5, 0, false, NULL, 'Default incineration without specified recovery = disposal'),
('landfill', 5, 0, false, NULL, 'Annex I D1: Deposit into/onto land = disposal (lowest hierarchy)')
ON CONFLICT (treatment_method) DO UPDATE SET
  hierarchy_rank = EXCLUDED.hierarchy_rank,
  hierarchy_score = EXCLUDED.hierarchy_score,
  is_circular = EXCLUDED.is_circular,
  end_use_modifier = EXCLUDED.end_use_modifier,
  notes = EXCLUDED.notes;

-- Enable RLS
ALTER TABLE waste_hierarchy_scores ENABLE ROW LEVEL SECURITY;

-- Read-only policy (reference data)
CREATE POLICY "waste_hierarchy_scores_read" ON waste_hierarchy_scores
  FOR SELECT TO authenticated USING (true);

COMMENT ON TABLE waste_hierarchy_scores IS
  'EU Waste Framework Directive 2008/98/EC Article 4 hierarchy scores. Used for ESRS E5 compliance. NOT the Ellen MacArthur MCI.';

-- =====================================================
-- SECTION 4: CREATE COMPLIANCE METADATA VIEW
-- =====================================================

-- Create view documenting calculation methodology for ESRS E5 disclosure
CREATE OR REPLACE VIEW waste_calculation_methodology AS
SELECT
  'ESRS E5 - Resource Use and Circular Economy' as disclosure_standard,
  'E5-5: Resource outflows' as disclosure_requirement,
  jsonb_build_object(
    'emission_factors', jsonb_build_object(
      'source', 'DEFRA 2024 Greenhouse Gas Reporting Conversion Factors',
      'publication_date', '2024-07-08',
      'last_updated', '2024-10-30',
      'url', 'https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024',
      'methodology', 'Activity-based: waste quantity (kg) × treatment-specific emission factor (kgCO2e/kg)',
      'material_specificity', 'Where available, material-specific factors used; otherwise treatment averages applied',
      'scope', 'Scope 3 Category 5 - Waste generated in operations'
    ),
    'hierarchy_scores', jsonb_build_object(
      'source', 'EU Waste Framework Directive 2008/98/EC Article 4',
      'methodology', 'Treatment methods scored 0-100 based on position in waste hierarchy',
      'circular_definition', 'Treatments scoring 100 (reuse, recycling, composting for soil) keep materials in productive use',
      'energy_recovery', 'Anaerobic digestion and incineration with energy recovery score 50 as "other recovery"',
      'disposal', 'Landfill and incineration without recovery score 0 as "disposal"'
    ),
    'thresholds', jsonb_build_object(
      'diversion_rate', jsonb_build_object(
        'excellent', 90,
        'high', 70,
        'medium', 40,
        'source', 'Industry best practice benchmarks, not regulatory mandates'
      ),
      'hazardous_waste', jsonb_build_object(
        'high_concern', 10,
        'moderate_concern', 5,
        'source', 'Industry best practice benchmarks for manufacturing sector'
      )
    ),
    'disclaimers', jsonb_build_array(
      'Performance thresholds are indicative benchmarks, not regulatory requirements',
      'Actual emission factors vary by geography, technology, and material composition',
      'For critical reporting, verify factors against current DEFRA publication',
      'Hierarchy scores represent EU Waste Framework compliance, not Ellen MacArthur MCI'
    )
  ) as methodology_documentation,
  now() as generated_at;

COMMENT ON VIEW waste_calculation_methodology IS
  'ESRS E5-MDR disclosure: Documents calculation methodology for waste emissions and circularity metrics.';
