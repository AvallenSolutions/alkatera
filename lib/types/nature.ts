/**
 * TNFD Nature Impact Assessment types
 *
 * Types for the annual nature dependency and impact questionnaire
 * aligned with the TNFD LEAP Framework (Locate, Evaluate, Assess, Prepare)
 * and CSRD ESRS E4 (Biodiversity and Ecosystems).
 */

export type DependencyLevel = 'low' | 'medium' | 'high' | 'critical';

export type InvasiveSpeciesRisk = 'none' | 'low' | 'medium' | 'high';

export type NatureRiskMateriality =
  | 'not_material'
  | 'potentially_material'
  | 'material'
  | 'highly_material';

export type AssessmentStatus = 'draft' | 'complete' | 'reviewed';

export type EcosystemType =
  | 'temperate_forest'
  | 'mediterranean'
  | 'grassland'
  | 'wetland'
  | 'shrubland'
  | 'tropical_forest'
  | 'boreal_forest'
  | 'semi_arid'
  | 'other';

export type WaterStressIndex = 'low' | 'medium' | 'high' | 'very_high';

export interface NatureImpactAssessment {
  id: string;
  organization_id: string;
  assessment_year: number;
  assessment_status: AssessmentStatus;

  // Dependencies
  water_dependency_level?: DependencyLevel;
  water_dependency_notes?: string;
  pollination_dependency_level?: DependencyLevel;
  pollination_dependency_notes?: string;
  soil_health_dependency_level?: DependencyLevel;
  soil_health_dependency_notes?: string;

  // Impacts
  land_use_ha?: number;
  land_converted_ha?: number;
  pollution_outputs_kg_n?: number;
  pollution_outputs_kg_p?: number;
  pesticide_kg_active?: number;
  invasive_species_risk?: InvasiveSpeciesRisk;
  invasive_species_details?: string;

  // Materiality
  nature_risk_materiality?: NatureRiskMateriality;
  materiality_rationale?: string;
  physical_risk_notes?: string;
  transition_risk_notes?: string;

  // Targets
  has_nature_positive_target: boolean;
  nature_positive_target_year?: number;
  nature_positive_target_description?: string;
  nature_positive_baseline_year?: number;

  created_at: string;
  updated_at: string;
}
