/**
 * EPR Compliance Tool — Drinks Container Rules
 *
 * Implements the divergent component reporting rules for drinks containers:
 * - Glass: components (lid, label, cap) reported as SEPARATE RPD lines
 * - Aluminium/PET/Steel: components AGGREGATED into the container weight
 *
 * Also implements DRS exclusion logic for containers 150ml-3L.
 */

import type { EPRMaterialType } from '@/lib/types/lca';
import { DRS_MATERIALS, DRS_MIN_SIZE_ML, DRS_MAX_SIZE_ML } from './constants';
import type { RPDMaterialCode } from './types';
import { mapMaterialToRPD } from './mappings';

// =============================================================================
// DRS Exclusion
// =============================================================================

/**
 * Determine if a drinks container is excluded from EPR fees because it
 * will enter the Deposit Return Scheme (Oct 2027).
 *
 * Conditions (ALL must be true):
 * 1. Item is flagged as a drinks container
 * 2. Product unit size is between 150ml and 3000ml (inclusive)
 * 3. Container material is aluminium, rigid plastic (PET), or steel
 */
export function isDRSExcluded(
  isDrinksContainer: boolean,
  unitSizeML: number | null | undefined,
  materialType: EPRMaterialType
): boolean {
  if (!isDrinksContainer) return false;
  if (unitSizeML == null) return false;
  if (unitSizeML < DRS_MIN_SIZE_ML || unitSizeML > DRS_MAX_SIZE_ML) return false;
  return (DRS_MATERIALS as readonly string[]).includes(materialType);
}

// =============================================================================
// Component Reporting Rules
// =============================================================================

/**
 * For glass drinks containers, each component must be reported separately.
 * This is because glass recycling is contaminated by non-glass ancillaries,
 * so regulators need to track cap/label materials individually.
 */
export function isGlassDrinksContainer(
  isDrinksContainer: boolean,
  containerMaterial: EPRMaterialType
): boolean {
  return isDrinksContainer && containerMaterial === 'glass';
}

/**
 * For aluminium, PET, and steel drinks containers, ancillary components
 * (lids, labels) are aggregated into the container weight. The entire
 * weight is reported under the primary container's material code.
 */
export function isAggregatedDrinksContainer(
  isDrinksContainer: boolean,
  containerMaterial: EPRMaterialType
): boolean {
  return isDrinksContainer && ['aluminium', 'plastic_rigid', 'steel'].includes(containerMaterial);
}

// =============================================================================
// Component Weight Breakdown
// =============================================================================

export interface ComponentWeight {
  material_type: EPRMaterialType;
  rpd_material_code: RPDMaterialCode;
  component_name: string;
  weight_grams: number;
}

/**
 * Extract component weights from the product_materials column fields.
 * These are the legacy component_*_weight columns.
 */
export function extractComponentWeights(material: {
  component_glass_weight?: number | null;
  component_aluminium_weight?: number | null;
  component_steel_weight?: number | null;
  component_paper_weight?: number | null;
  component_wood_weight?: number | null;
  component_other_weight?: number | null;
}): ComponentWeight[] {
  const components: ComponentWeight[] = [];

  if (material.component_glass_weight && material.component_glass_weight > 0) {
    components.push({
      material_type: 'glass',
      rpd_material_code: 'GL',
      component_name: 'Glass',
      weight_grams: material.component_glass_weight,
    });
  }
  if (material.component_aluminium_weight && material.component_aluminium_weight > 0) {
    components.push({
      material_type: 'aluminium',
      rpd_material_code: 'AL',
      component_name: 'Aluminium',
      weight_grams: material.component_aluminium_weight,
    });
  }
  if (material.component_steel_weight && material.component_steel_weight > 0) {
    components.push({
      material_type: 'steel',
      rpd_material_code: 'ST',
      component_name: 'Steel',
      weight_grams: material.component_steel_weight,
    });
  }
  if (material.component_paper_weight && material.component_paper_weight > 0) {
    components.push({
      material_type: 'paper_cardboard',
      rpd_material_code: 'PC',
      component_name: 'Paper/Card',
      weight_grams: material.component_paper_weight,
    });
  }
  if (material.component_wood_weight && material.component_wood_weight > 0) {
    components.push({
      material_type: 'wood',
      rpd_material_code: 'WD',
      component_name: 'Wood',
      weight_grams: material.component_wood_weight,
    });
  }
  if (material.component_other_weight && material.component_other_weight > 0) {
    components.push({
      material_type: 'other',
      rpd_material_code: 'OT',
      component_name: 'Other',
      weight_grams: material.component_other_weight,
    });
  }

  return components;
}

/**
 * For glass drinks containers with component breakdown:
 * return each component as a separate line.
 *
 * For aggregated containers (aluminium/PET/steel):
 * sum all component weights into a single line under the container material.
 */
export function processContainerComponents(
  isDrinksContainer: boolean,
  containerMaterial: EPRMaterialType,
  components: ComponentWeight[],
  totalWeightGrams: number
): ComponentWeight[] {
  if (components.length === 0) {
    // No component breakdown — return as single item
    return [{
      material_type: containerMaterial,
      rpd_material_code: mapMaterialToRPD(containerMaterial),
      component_name: 'Container',
      weight_grams: totalWeightGrams,
    }];
  }

  // Glass drinks container: separate lines per component
  if (isGlassDrinksContainer(isDrinksContainer, containerMaterial)) {
    return components;
  }

  // Aggregated drinks container: sum all into primary material
  if (isAggregatedDrinksContainer(isDrinksContainer, containerMaterial)) {
    const totalWeight = components.reduce((sum, c) => sum + c.weight_grams, 0);
    return [{
      material_type: containerMaterial,
      rpd_material_code: mapMaterialToRPD(containerMaterial),
      component_name: 'Container (aggregated)',
      weight_grams: totalWeight,
    }];
  }

  // Non-drinks-container packaging: separate lines per component
  return components;
}
