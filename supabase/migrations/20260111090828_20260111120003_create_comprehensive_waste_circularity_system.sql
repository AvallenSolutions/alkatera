/*
  # Comprehensive Waste & Circularity Tracking System

  1. New Tables
    - `packaging_circularity_profiles` - Material-specific circularity data
    - `product_end_of_life_scenarios` - End-of-life pathway tracking
    - `circularity_targets` - Organisation circularity goals
    
  2. Enhanced Columns
    - Add recyclability and recycled content fields to product_lca_materials
    - Add circularity metrics to products table

  3. Views
    - `waste_stream_summary` - Aggregated waste data
    - `circularity_metrics_summary` - Organisation-level circularity

  4. Security
    - Enable RLS on all new tables
    - Add appropriate policies for organization members
*/

-- Add enhanced circularity fields to product_lca_materials
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'recyclability_score'
  ) THEN
    ALTER TABLE product_lca_materials ADD COLUMN recyclability_score numeric CHECK (recyclability_score IS NULL OR (recyclability_score >= 0 AND recyclability_score <= 100));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'recycled_content_percentage'
  ) THEN
    ALTER TABLE product_lca_materials ADD COLUMN recycled_content_percentage numeric DEFAULT 0 CHECK (recycled_content_percentage IS NULL OR (recycled_content_percentage >= 0 AND recycled_content_percentage <= 100));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'is_reusable'
  ) THEN
    ALTER TABLE product_lca_materials ADD COLUMN is_reusable boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'is_compostable'
  ) THEN
    ALTER TABLE product_lca_materials ADD COLUMN is_compostable boolean DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_lca_materials' AND column_name = 'end_of_life_pathway'
  ) THEN
    ALTER TABLE product_lca_materials ADD COLUMN end_of_life_pathway text CHECK (end_of_life_pathway IS NULL OR end_of_life_pathway IN ('recycling', 'landfill', 'incineration', 'composting', 'anaerobic_digestion', 'reuse', 'mixed'));
  END IF;
END $$;

-- Add circularity metrics to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'packaging_circularity_score'
  ) THEN
    ALTER TABLE products ADD COLUMN packaging_circularity_score numeric CHECK (packaging_circularity_score IS NULL OR (packaging_circularity_score >= 0 AND packaging_circularity_score <= 100));
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'material_circularity_indicator'
  ) THEN
    ALTER TABLE products ADD COLUMN material_circularity_indicator numeric CHECK (material_circularity_indicator IS NULL OR (material_circularity_indicator >= 0 AND material_circularity_indicator <= 1));
  END IF;
END $$;

-- Create packaging_circularity_profiles table
CREATE TABLE IF NOT EXISTS packaging_circularity_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  material_type text NOT NULL CHECK (material_type IN (
    'glass', 'plastic_pet', 'plastic_hdpe', 'plastic_ldpe', 'plastic_pp', 'plastic_ps', 'plastic_other',
    'paper', 'cardboard', 'aluminium', 'steel', 'wood', 'composite', 'bioplastic', 'other'
  )),
  material_name text NOT NULL,
  
  recyclability_score numeric NOT NULL DEFAULT 0 CHECK (recyclability_score >= 0 AND recyclability_score <= 100),
  recycled_content_percentage numeric NOT NULL DEFAULT 0 CHECK (recycled_content_percentage >= 0 AND recycled_content_percentage <= 100),
  reusability_score numeric DEFAULT 0 CHECK (reusability_score IS NULL OR (reusability_score >= 0 AND reusability_score <= 100)),
  
  is_compostable boolean DEFAULT false,
  is_biodegradable boolean DEFAULT false,
  
  regional_recycling_rate numeric CHECK (regional_recycling_rate IS NULL OR (regional_recycling_rate >= 0 AND regional_recycling_rate <= 100)),
  collection_rate numeric CHECK (collection_rate IS NULL OR (collection_rate >= 0 AND collection_rate <= 100)),
  
  end_of_life_pathway text DEFAULT 'mixed' CHECK (end_of_life_pathway IN ('recycling', 'landfill', 'incineration', 'composting', 'anaerobic_digestion', 'reuse', 'mixed')),
  
  virgin_material_density numeric CHECK (virgin_material_density IS NULL OR virgin_material_density > 0),
  recycled_material_density numeric CHECK (recycled_material_density IS NULL OR recycled_material_density > 0),
  
  notes text,
  source_reference text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, material_type, material_name)
);

CREATE INDEX IF NOT EXISTS idx_pcp_organization ON packaging_circularity_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_pcp_material_type ON packaging_circularity_profiles(material_type);

ALTER TABLE packaging_circularity_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pcp_select_policy" ON packaging_circularity_profiles;
CREATE POLICY "pcp_select_policy" ON packaging_circularity_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = packaging_circularity_profiles.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "pcp_insert_policy" ON packaging_circularity_profiles;
CREATE POLICY "pcp_insert_policy" ON packaging_circularity_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = packaging_circularity_profiles.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "pcp_update_policy" ON packaging_circularity_profiles;
CREATE POLICY "pcp_update_policy" ON packaging_circularity_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = packaging_circularity_profiles.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = packaging_circularity_profiles.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "pcp_delete_policy" ON packaging_circularity_profiles;
CREATE POLICY "pcp_delete_policy" ON packaging_circularity_profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = packaging_circularity_profiles.organization_id AND om.user_id = auth.uid()));

-- Create product_end_of_life_scenarios table
CREATE TABLE IF NOT EXISTS product_end_of_life_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  material_id uuid REFERENCES product_lca_materials(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  scenario_name text DEFAULT 'Default',
  is_primary_scenario boolean DEFAULT true,
  
  recycling_percentage numeric DEFAULT 0 CHECK (recycling_percentage >= 0 AND recycling_percentage <= 100),
  landfill_percentage numeric DEFAULT 0 CHECK (landfill_percentage >= 0 AND landfill_percentage <= 100),
  incineration_percentage numeric DEFAULT 0 CHECK (incineration_percentage >= 0 AND incineration_percentage <= 100),
  composting_percentage numeric DEFAULT 0 CHECK (composting_percentage >= 0 AND composting_percentage <= 100),
  anaerobic_digestion_percentage numeric DEFAULT 0 CHECK (anaerobic_digestion_percentage >= 0 AND anaerobic_digestion_percentage <= 100),
  reuse_percentage numeric DEFAULT 0 CHECK (reuse_percentage >= 0 AND reuse_percentage <= 100),
  
  recycling_emissions_factor numeric DEFAULT 0,
  landfill_emissions_factor numeric DEFAULT 0,
  incineration_emissions_factor numeric DEFAULT 0,
  composting_emissions_factor numeric DEFAULT 0,
  
  total_emissions_kg_co2e numeric DEFAULT 0,
  avoided_emissions_kg_co2e numeric DEFAULT 0,
  
  material_mass_kg numeric CHECK (material_mass_kg IS NULL OR material_mass_kg >= 0),
  
  data_source text,
  notes text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT eol_percentages_sum CHECK (
    (COALESCE(recycling_percentage, 0) + COALESCE(landfill_percentage, 0) + 
     COALESCE(incineration_percentage, 0) + COALESCE(composting_percentage, 0) + 
     COALESCE(anaerobic_digestion_percentage, 0) + COALESCE(reuse_percentage, 0)) <= 100.01
  )
);

CREATE INDEX IF NOT EXISTS idx_peols_product ON product_end_of_life_scenarios(product_id);
CREATE INDEX IF NOT EXISTS idx_peols_organization ON product_end_of_life_scenarios(organization_id);
CREATE INDEX IF NOT EXISTS idx_peols_material ON product_end_of_life_scenarios(material_id);

ALTER TABLE product_end_of_life_scenarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "peols_select_policy" ON product_end_of_life_scenarios;
CREATE POLICY "peols_select_policy" ON product_end_of_life_scenarios FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = product_end_of_life_scenarios.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "peols_insert_policy" ON product_end_of_life_scenarios;
CREATE POLICY "peols_insert_policy" ON product_end_of_life_scenarios FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = product_end_of_life_scenarios.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "peols_update_policy" ON product_end_of_life_scenarios;
CREATE POLICY "peols_update_policy" ON product_end_of_life_scenarios FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = product_end_of_life_scenarios.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = product_end_of_life_scenarios.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "peols_delete_policy" ON product_end_of_life_scenarios;
CREATE POLICY "peols_delete_policy" ON product_end_of_life_scenarios FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = product_end_of_life_scenarios.organization_id AND om.user_id = auth.uid()));

-- Create circularity_targets table
CREATE TABLE IF NOT EXISTS circularity_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  target_year integer NOT NULL CHECK (target_year >= 2020 AND target_year <= 2100),
  
  waste_diversion_target numeric CHECK (waste_diversion_target IS NULL OR (waste_diversion_target >= 0 AND waste_diversion_target <= 100)),
  recycled_content_target numeric CHECK (recycled_content_target IS NULL OR (recycled_content_target >= 0 AND recycled_content_target <= 100)),
  circularity_score_target numeric CHECK (circularity_score_target IS NULL OR (circularity_score_target >= 0 AND circularity_score_target <= 100)),
  virgin_plastic_reduction_target numeric CHECK (virgin_plastic_reduction_target IS NULL OR (virgin_plastic_reduction_target >= 0 AND virgin_plastic_reduction_target <= 100)),
  packaging_recyclability_target numeric CHECK (packaging_recyclability_target IS NULL OR (packaging_recyclability_target >= 0 AND packaging_recyclability_target <= 100)),
  
  zero_waste_to_landfill_target boolean DEFAULT false,
  
  baseline_year integer CHECK (baseline_year IS NULL OR (baseline_year >= 2010 AND baseline_year <= 2100)),
  baseline_waste_diversion numeric,
  baseline_recycled_content numeric,
  
  notes text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, target_year)
);

CREATE INDEX IF NOT EXISTS idx_ct_organization ON circularity_targets(organization_id);
CREATE INDEX IF NOT EXISTS idx_ct_year ON circularity_targets(target_year);

ALTER TABLE circularity_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct_select_policy" ON circularity_targets;
CREATE POLICY "ct_select_policy" ON circularity_targets FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = circularity_targets.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "ct_insert_policy" ON circularity_targets;
CREATE POLICY "ct_insert_policy" ON circularity_targets FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = circularity_targets.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "ct_update_policy" ON circularity_targets;
CREATE POLICY "ct_update_policy" ON circularity_targets FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = circularity_targets.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = circularity_targets.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "ct_delete_policy" ON circularity_targets;
CREATE POLICY "ct_delete_policy" ON circularity_targets FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = circularity_targets.organization_id AND om.user_id = auth.uid()));

-- Create waste_stream_summary view for aggregated waste metrics
DROP VIEW IF EXISTS waste_stream_summary;
CREATE VIEW waste_stream_summary AS
SELECT 
  fae.organization_id,
  fae.facility_id,
  f.name as facility_name,
  EXTRACT(YEAR FROM fae.activity_date)::integer as year,
  EXTRACT(MONTH FROM fae.activity_date)::integer as month,
  fae.waste_category,
  fae.waste_treatment_method,
  fae.hazard_classification,
  COUNT(*)::integer as entry_count,
  SUM(fae.quantity) as total_quantity_kg,
  AVG(fae.waste_recovery_percentage) as avg_recovery_percentage,
  SUM(fae.calculated_emissions_kg_co2e) as total_emissions_kg_co2e,
  MAX(fae.data_provenance::text) as data_provenance,
  AVG(fae.confidence_score) as avg_confidence_score
FROM facility_activity_entries fae
JOIN facilities f ON f.id = fae.facility_id
WHERE fae.activity_category IN ('waste_general', 'waste_hazardous', 'waste_recycling')
  AND fae.waste_category IS NOT NULL
GROUP BY 
  fae.organization_id,
  fae.facility_id,
  f.name,
  EXTRACT(YEAR FROM fae.activity_date),
  EXTRACT(MONTH FROM fae.activity_date),
  fae.waste_category,
  fae.waste_treatment_method,
  fae.hazard_classification;

-- Create circularity_metrics_summary view for organisation-level circularity
DROP VIEW IF EXISTS circularity_metrics_summary;
CREATE VIEW circularity_metrics_summary AS
SELECT 
  p.organization_id,
  COUNT(DISTINCT p.id)::integer as total_products,
  AVG(p.packaging_circularity_score) as avg_packaging_circularity,
  AVG(p.material_circularity_indicator) as avg_mci,
  AVG(plm.recycled_content_percentage) as avg_recycled_content,
  AVG(plm.recyclability_score) as avg_recyclability,
  (SUM(CASE WHEN plm.is_reusable THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(plm.id), 0) * 100) as reusable_materials_percentage,
  (SUM(CASE WHEN plm.is_compostable THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(plm.id), 0) * 100) as compostable_materials_percentage,
  COUNT(DISTINCT plm.id)::integer as total_materials_assessed
FROM products p
LEFT JOIN product_lcas pl ON pl.product_id = p.id AND pl.status = 'completed'
LEFT JOIN product_lca_materials plm ON plm.product_lca_id = pl.id
GROUP BY p.organization_id;
