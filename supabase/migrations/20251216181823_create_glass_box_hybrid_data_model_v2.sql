/*
  # Glass Box Hybrid Data Model for Integrated Facility Waste & Water Reporting
  
  ## Overview
  This migration implements a scope-neutral data storage architecture with comprehensive
  provenance tracking for water and waste data, following the Glass Box principle.
  
  ## New Tables
  1. facility_activity_entries - Unified storage with provenance tracking
  2. emissions_calculation_context - Scope-neutral temporal lookup
  3. supplier_data_submissions - Third-party data intake
  4. facility_data_quality_snapshot - Monthly confidence tracking
  
  ## Key Design Principles
  - Data is scope-neutral: Scope assigned at calculation time
  - Physical allocation: (Brand Volume / Total Facility Volume) × Total Facility Impact
  - Provenance tracking: Every record has documented source and quality rating
*/

-- Create enums with safe handling
DO $$ BEGIN
  CREATE TYPE data_provenance_enum AS ENUM (
    'primary_supplier_verified',
    'primary_measured_onsite',
    'secondary_modelled_industry_average',
    'secondary_calculated_allocation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE allocation_basis_enum AS ENUM (
    'physical_mass',
    'volume_proportion',
    'production_volume_ratio',
    'none'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE facility_activity_category_enum AS ENUM (
    'utility_electricity',
    'utility_gas',
    'utility_fuel',
    'utility_other',
    'water_intake',
    'water_discharge',
    'water_recycled',
    'waste_general',
    'waste_hazardous',
    'waste_recycling'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE water_source_type_enum AS ENUM (
    'municipal',
    'groundwater',
    'surface_water',
    'recycled',
    'rainwater',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE water_classification_enum AS ENUM (
    'blue',
    'green',
    'grey'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE wastewater_treatment_method_enum AS ENUM (
    'primary_treatment',
    'secondary_treatment',
    'tertiary_treatment',
    'none',
    'unknown'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE waste_category_enum AS ENUM (
    'food_waste',
    'packaging_waste',
    'process_waste',
    'hazardous',
    'construction',
    'electronic',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE waste_treatment_method_enum AS ENUM (
    'landfill',
    'recycling',
    'composting',
    'incineration_with_recovery',
    'incineration_without_recovery',
    'anaerobic_digestion',
    'reuse',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_attestation_level_enum AS ENUM (
    'self_reported',
    'auditor_verified',
    'certified'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE submission_verification_status_enum AS ENUM (
    'pending',
    'accepted',
    'disputed',
    'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Table 1: facility_activity_entries
CREATE TABLE IF NOT EXISTS facility_activity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  activity_category facility_activity_category_enum NOT NULL,
  activity_date date NOT NULL,
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  
  quantity numeric NOT NULL CHECK (quantity >= 0),
  unit text NOT NULL,
  
  data_provenance data_provenance_enum NOT NULL DEFAULT 'secondary_modelled_industry_average',
  confidence_score integer CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  allocation_basis allocation_basis_enum DEFAULT 'none',
  brand_volume_reported numeric CHECK (brand_volume_reported IS NULL OR brand_volume_reported >= 0),
  total_facility_volume_reported numeric CHECK (total_facility_volume_reported IS NULL OR total_facility_volume_reported > 0),
  allocation_percentage numeric CHECK (allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)),
  original_facility_value numeric CHECK (original_facility_value IS NULL OR original_facility_value >= 0),
  
  water_source_type water_source_type_enum,
  water_classification water_classification_enum,
  wastewater_treatment_method wastewater_treatment_method_enum,
  water_recycling_rate_percent numeric CHECK (water_recycling_rate_percent IS NULL OR (water_recycling_rate_percent >= 0 AND water_recycling_rate_percent <= 100)),
  water_stress_area_flag boolean DEFAULT false,
  
  waste_category waste_category_enum,
  waste_treatment_method waste_treatment_method_enum,
  waste_recovery_percentage numeric CHECK (waste_recovery_percentage IS NULL OR (waste_recovery_percentage >= 0 AND waste_recovery_percentage <= 100)),
  hazard_classification text CHECK (hazard_classification IS NULL OR hazard_classification IN ('non_hazardous', 'hazardous', 'unknown')),
  disposal_facility_type text CHECK (disposal_facility_type IS NULL OR disposal_facility_type IN ('in_house', 'third_party_licensed', 'unspecified')),
  
  source_facility_id uuid REFERENCES facilities(id),
  source_attestation_url text,
  supplier_submission_id uuid,
  
  emission_factor_id uuid,
  calculated_emissions_kg_co2e numeric CHECK (calculated_emissions_kg_co2e IS NULL OR calculated_emissions_kg_co2e >= 0),
  
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  reporting_session_id uuid REFERENCES facility_reporting_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_fae_facility_date ON facility_activity_entries(facility_id, activity_date);
CREATE INDEX IF NOT EXISTS idx_fae_org_period ON facility_activity_entries(organization_id, reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_fae_category ON facility_activity_entries(activity_category);
CREATE INDEX IF NOT EXISTS idx_fae_provenance ON facility_activity_entries(data_provenance);

ALTER TABLE facility_activity_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fae_select_policy" ON facility_activity_entries;
CREATE POLICY "fae_select_policy" ON facility_activity_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_activity_entries.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "fae_insert_policy" ON facility_activity_entries;
CREATE POLICY "fae_insert_policy" ON facility_activity_entries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_activity_entries.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "fae_update_policy" ON facility_activity_entries;
CREATE POLICY "fae_update_policy" ON facility_activity_entries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_activity_entries.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_activity_entries.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "fae_delete_policy" ON facility_activity_entries;
CREATE POLICY "fae_delete_policy" ON facility_activity_entries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_activity_entries.organization_id AND om.user_id = auth.uid()));

-- Table 2: emissions_calculation_context
CREATE TABLE IF NOT EXISTS emissions_calculation_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  
  operational_control_status_at_period text NOT NULL CHECK (
    operational_control_status_at_period IN ('owned', 'third_party')
  ),
  
  context_established_at timestamptz DEFAULT now(),
  context_established_by uuid REFERENCES auth.users(id),
  context_notes text,
  
  calculation_version integer DEFAULT 1,
  superseded_by uuid REFERENCES emissions_calculation_context(id),
  is_current boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ecc_facility ON emissions_calculation_context(facility_id, is_current);
CREATE INDEX IF NOT EXISTS idx_ecc_period ON emissions_calculation_context(reporting_period_start, reporting_period_end);
CREATE INDEX IF NOT EXISTS idx_ecc_org ON emissions_calculation_context(organization_id);

ALTER TABLE emissions_calculation_context ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ecc_select_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_select_policy" ON emissions_calculation_context FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = emissions_calculation_context.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "ecc_insert_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_insert_policy" ON emissions_calculation_context FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = emissions_calculation_context.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "ecc_update_policy" ON emissions_calculation_context;
CREATE POLICY "ecc_update_policy" ON emissions_calculation_context FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = emissions_calculation_context.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = emissions_calculation_context.organization_id AND om.user_id = auth.uid()));

-- Table 3: supplier_data_submissions
CREATE TABLE IF NOT EXISTS supplier_data_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id uuid REFERENCES suppliers(id),
  facility_id uuid REFERENCES facilities(id),
  
  submission_date timestamptz DEFAULT now(),
  reporting_period_start date NOT NULL,
  reporting_period_end date NOT NULL,
  
  data_format text NOT NULL CHECK (data_format IN ('structured_entry', 'csv_upload', 'api_submission', 'manual_entry')),
  attestation_level submission_attestation_level_enum NOT NULL DEFAULT 'self_reported',
  verification_status submission_verification_status_enum NOT NULL DEFAULT 'pending',
  
  attestation_document_url text,
  attestation_document_name text,
  
  total_water_entries integer DEFAULT 0,
  total_waste_entries integer DEFAULT 0,
  total_utility_entries integer DEFAULT 0,
  
  total_facility_production_volume numeric CHECK (total_facility_production_volume IS NULL OR total_facility_production_volume > 0),
  production_volume_unit text,
  brand_attributed_volume numeric CHECK (brand_attributed_volume IS NULL OR brand_attributed_volume >= 0),
  
  validation_errors jsonb DEFAULT '[]'::jsonb,
  validation_warnings jsonb DEFAULT '[]'::jsonb,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  review_notes text,
  
  submitter_name text,
  submitter_email text,
  submitter_role text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sds_org ON supplier_data_submissions(organization_id);
CREATE INDEX IF NOT EXISTS idx_sds_supplier ON supplier_data_submissions(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sds_status ON supplier_data_submissions(verification_status);
CREATE INDEX IF NOT EXISTS idx_sds_period ON supplier_data_submissions(reporting_period_start, reporting_period_end);

ALTER TABLE supplier_data_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sds_select_policy" ON supplier_data_submissions;
CREATE POLICY "sds_select_policy" ON supplier_data_submissions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = supplier_data_submissions.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "sds_insert_policy" ON supplier_data_submissions;
CREATE POLICY "sds_insert_policy" ON supplier_data_submissions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = supplier_data_submissions.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "sds_update_policy" ON supplier_data_submissions;
CREATE POLICY "sds_update_policy" ON supplier_data_submissions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = supplier_data_submissions.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = supplier_data_submissions.organization_id AND om.user_id = auth.uid()));

-- Add FK reference
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_fae_supplier_submission') THEN
    ALTER TABLE facility_activity_entries 
      ADD CONSTRAINT fk_fae_supplier_submission
      FOREIGN KEY (supplier_submission_id) 
      REFERENCES supplier_data_submissions(id);
  END IF;
END $$;

-- Table 4: facility_data_quality_snapshot
CREATE TABLE IF NOT EXISTS facility_data_quality_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  snapshot_date date NOT NULL,
  snapshot_month integer NOT NULL CHECK (snapshot_month >= 1 AND snapshot_month <= 12),
  snapshot_year integer NOT NULL CHECK (snapshot_year >= 2000 AND snapshot_year <= 2100),
  
  overall_confidence_percentage numeric NOT NULL CHECK (overall_confidence_percentage >= 0 AND overall_confidence_percentage <= 100),
  confidence_rating text NOT NULL CHECK (confidence_rating IN ('high', 'medium', 'low', 'very_low')),
  
  utility_confidence_percentage numeric CHECK (utility_confidence_percentage >= 0 AND utility_confidence_percentage <= 100),
  water_confidence_percentage numeric CHECK (water_confidence_percentage >= 0 AND water_confidence_percentage <= 100),
  waste_confidence_percentage numeric CHECK (waste_confidence_percentage >= 0 AND waste_confidence_percentage <= 100),
  
  primary_supplier_verified_count integer DEFAULT 0,
  primary_measured_onsite_count integer DEFAULT 0,
  secondary_modelled_count integer DEFAULT 0,
  secondary_allocated_count integer DEFAULT 0,
  total_entries_count integer DEFAULT 0,
  
  previous_month_confidence numeric,
  confidence_change_percentage numeric,
  trend_direction text CHECK (trend_direction IS NULL OR trend_direction IN ('improving', 'stable', 'declining')),
  
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  priority_suppliers_to_engage jsonb DEFAULT '[]'::jsonb,
  
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fdqs_facility ON facility_data_quality_snapshot(facility_id);
CREATE INDEX IF NOT EXISTS idx_fdqs_org ON facility_data_quality_snapshot(organization_id);
CREATE INDEX IF NOT EXISTS idx_fdqs_date ON facility_data_quality_snapshot(snapshot_year, snapshot_month);
CREATE INDEX IF NOT EXISTS idx_fdqs_rating ON facility_data_quality_snapshot(confidence_rating);

ALTER TABLE facility_data_quality_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fdqs_select_policy" ON facility_data_quality_snapshot;
CREATE POLICY "fdqs_select_policy" ON facility_data_quality_snapshot FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_data_quality_snapshot.organization_id AND om.user_id = auth.uid()));

DROP POLICY IF EXISTS "fdqs_insert_policy" ON facility_data_quality_snapshot;
CREATE POLICY "fdqs_insert_policy" ON facility_data_quality_snapshot FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = facility_data_quality_snapshot.organization_id AND om.user_id = auth.uid()));

-- Functions
CREATE OR REPLACE FUNCTION calculate_provenance_confidence_score(provenance data_provenance_enum)
RETURNS integer AS $$
BEGIN
  RETURN CASE provenance
    WHEN 'primary_supplier_verified' THEN 95
    WHEN 'primary_measured_onsite' THEN 90
    WHEN 'secondary_calculated_allocation' THEN 70
    WHEN 'secondary_modelled_industry_average' THEN 50
    ELSE 30
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION set_activity_entry_confidence_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.confidence_score IS NULL THEN
    NEW.confidence_score := calculate_provenance_confidence_score(NEW.data_provenance);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_activity_confidence ON facility_activity_entries;
CREATE TRIGGER trigger_set_activity_confidence
  BEFORE INSERT OR UPDATE ON facility_activity_entries
  FOR EACH ROW EXECUTE FUNCTION set_activity_entry_confidence_score();

CREATE OR REPLACE FUNCTION validate_physical_allocation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.allocation_basis != 'none' 
     AND NEW.brand_volume_reported IS NOT NULL 
     AND NEW.total_facility_volume_reported IS NOT NULL THEN
    IF NEW.brand_volume_reported > NEW.total_facility_volume_reported THEN
      RAISE EXCEPTION 'Brand volume cannot exceed total facility volume';
    END IF;
    NEW.allocation_percentage := (NEW.brand_volume_reported / NEW.total_facility_volume_reported) * 100;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validate_allocation ON facility_activity_entries;
CREATE TRIGGER trigger_validate_allocation
  BEFORE INSERT OR UPDATE ON facility_activity_entries
  FOR EACH ROW EXECUTE FUNCTION validate_physical_allocation();

-- Views
DROP VIEW IF EXISTS facility_activity_with_scope;
CREATE VIEW facility_activity_with_scope AS
SELECT 
  fae.*,
  CASE 
    WHEN ecc.operational_control_status_at_period = 'owned' THEN
      CASE 
        WHEN fae.activity_category IN ('utility_electricity', 'utility_gas', 'utility_fuel', 'utility_other') THEN 'Scope 1/2'
        WHEN fae.activity_category::text LIKE 'waste_%' THEN 'Operational Waste'
        WHEN fae.activity_category::text LIKE 'water_%' THEN 'Operational Water'
        ELSE 'Operational'
      END
    WHEN ecc.operational_control_status_at_period = 'third_party' THEN
      CASE 
        WHEN fae.activity_category::text LIKE 'waste_%' THEN 'Scope 3 - Upstream Waste'
        WHEN fae.activity_category::text LIKE 'water_%' THEN 'Scope 3 - Upstream Water'
        ELSE 'Scope 3 - Upstream Processes'
      END
    ELSE 'Unclassified'
  END AS assigned_scope,
  ecc.operational_control_status_at_period,
  ecc.calculation_version
FROM facility_activity_entries fae
LEFT JOIN emissions_calculation_context ecc 
  ON fae.facility_id = ecc.facility_id
  AND fae.activity_date >= ecc.reporting_period_start
  AND fae.activity_date <= ecc.reporting_period_end
  AND ecc.is_current = true;

GRANT SELECT ON facility_activity_with_scope TO authenticated;

DROP VIEW IF EXISTS facility_confidence_summary;
CREATE VIEW facility_confidence_summary AS
SELECT 
  facility_id,
  organization_id,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE data_provenance = 'primary_supplier_verified') AS primary_verified_count,
  COUNT(*) FILTER (WHERE data_provenance = 'primary_measured_onsite') AS primary_measured_count,
  COUNT(*) FILTER (WHERE data_provenance = 'secondary_modelled_industry_average') AS secondary_modelled_count,
  COUNT(*) FILTER (WHERE data_provenance = 'secondary_calculated_allocation') AS secondary_allocated_count,
  ROUND(AVG(confidence_score), 1) AS average_confidence_score,
  ROUND(
    (COUNT(*) FILTER (WHERE data_provenance IN ('primary_supplier_verified', 'primary_measured_onsite'))::numeric 
    / NULLIF(COUNT(*), 0) * 100), 1
  ) AS primary_data_percentage,
  CASE 
    WHEN AVG(confidence_score) >= 80 THEN 'high'
    WHEN AVG(confidence_score) >= 60 THEN 'medium'
    WHEN AVG(confidence_score) >= 40 THEN 'low'
    ELSE 'very_low'
  END AS confidence_rating
FROM facility_activity_entries
GROUP BY facility_id, organization_id;

GRANT SELECT ON facility_confidence_summary TO authenticated;

-- Comments
COMMENT ON TABLE facility_activity_entries IS 'Unified storage for facility activity data with Glass Box provenance tracking. Scope-neutral design.';
COMMENT ON TABLE emissions_calculation_context IS 'Temporal lookup for scope assignment. Records operational_control status per reporting period.';
COMMENT ON TABLE supplier_data_submissions IS 'Third-party data intake workflow with attestation and verification tracking.';
COMMENT ON TABLE facility_data_quality_snapshot IS 'Monthly confidence score tracking for supplier engagement metrics.';
