/**
 * Shared types for the unified LCA wizard.
 * Extracted from CalculateLCASheet for use across wizard step components.
 */

import type { ProductMaterial } from '@/lib/impact-waterfall-resolver';
import type { OperationStep } from '@/components/ui/operation-progress';
import type { MatchStatus } from '@/lib/types/lca';

// ============================================================================
// MATERIAL VALIDATION
// ============================================================================

/**
 * Tri-state validation status for materials:
 * - 'resolved': Factor assigned AND the resolver successfully computed impact numbers
 * - 'assigned': Factor assigned in DB but the resolver failed transiently (timeout, network, etc.)
 * - 'missing':  No factor assigned — user needs to pick one
 */
export type MaterialValidationStatus = 'resolved' | 'assigned' | 'missing' | 'validating';

/**
 * Check whether a material has a factor assigned in the DB, regardless of
 * whether the waterfall resolver can currently compute full impact numbers.
 *
 * This is the single source of truth for "has the user picked a factor?".
 * The DB constraint `data_source_integrity` guarantees:
 *   (data_source = 'openlca'  AND data_source_id IS NOT NULL)
 * | (data_source = 'supplier' AND supplier_product_id IS NOT NULL)
 * | (data_source = 'parametric' AND packaging_material_class IS NOT NULL)
 * | (data_source IS NULL)
 */
export function materialHasAssignedFactor(mat: ProductMaterial): boolean {
  if (mat.data_source === 'supplier' && mat.supplier_product_id) return true;
  // Parametric packaging: the material class IS the factor assignment — the
  // calculator derives the number from the endpoint library, no id to pick.
  if ((mat as any).packaging_material_class) return true;
  if (mat.data_source && mat.data_source_id) return true;
  return false;
}

export interface MaterialWithValidation extends ProductMaterial {
  hasData: boolean;
  /** Tri-state status distinguishing fully resolved, assigned-but-unresolved, and truly missing */
  validationStatus: MaterialValidationStatus;

  // Emission-factor provenance columns (product_materials.match_status /
  // ef_*), written by ef-auto-match.ts / auto-proxy.ts / InlineIngredientSearch
  // but not yet declared on the shared ProductMaterial type. Declared here
  // (rather than widened on the shared type, which feeds the calculation
  // engine) so the review step can read them without an `as any` cast.
  match_status?: MatchStatus | null;
  ef_source?: string | null;
  ef_source_type?: string | null;
  ef_data_quality_grade?: string | null;
  ef_uncertainty_percent?: number | null;

  dataQuality?: string;
  confidenceScore?: number;
  error?: string;
  /** The resolved factor name used for calculation (may differ from material_name when a proxy is used) */
  resolvedFactorName?: string;
  /** Human-readable data source for the resolved factor (e.g. "ecoinvent 3.12", "AGRIBALYSE 3.2", "Supplier verified") */
  resolvedFactorSource?: string;
  /** Priority tier used (1=supplier, 2=DEFRA hybrid, 3=ecoinvent/staging) */
  resolvedPriority?: 1 | 2 | 3;

  // Impact decomposition transparency (populated from contribution analysis)
  /** Factor geography (ISO code, e.g. "GLO", "ZW") — from ecoinvent process */
  factorGeography?: string;
  /** Percentage of the factor's climate impact attributable to transport */
  embeddedTransportPercent?: number;
  /** Percentage attributable to electricity */
  embeddedElectricityPercent?: number;
  /** Geography of the embedded electricity process */
  embeddedElectricityGeography?: string | null;
}

// ============================================================================
// FACILITY TYPES
// ============================================================================

export interface LinkedFacility {
  id: string;
  facility_id: string;
  facility: {
    id: string;
    name: string;
    operational_control: 'owned' | 'third_party';
    address_city: string | null;
    address_country: string | null;
  };
}

export type DataCollectionMode = 'primary' | 'archetype_proxy' | 'hybrid';

export interface HybridArchetypeOverrides {
  electricity_kwh_per_unit?: number;
  natural_gas_kwh_per_unit?: number;
  thermal_fuel_kwh_per_unit?: number;
  water_litres_per_unit?: number;
}

export interface FacilityAllocation {
  facilityId: string;
  facilityName: string;
  operationalControl: 'owned' | 'third_party';
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  productionVolume: string;
  productionVolumeUnit: string;
  facilityTotalProduction: string;
  /** Unit of facilityTotalProduction (defaults to the reporting session's unit). */
  facilityTotalProductionUnit?: string;
  selectedSessionId?: string;

  // Proxy-mode fields. `primary` is the default and requires no extra data.
  dataCollectionMode?: DataCollectionMode;
  archetypeId?: string | null;
  archetypeSlug?: string | null;
  proxyJustification?: string;
  hybridOverrides?: HybridArchetypeOverrides;
}

export interface ReportingSession {
  id: string;
  facility_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  total_production_volume: number;
  volume_unit: string;
  data_source_type: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Re-exported from the canonical vocabulary. This used to be one of TWO
// exports named PRODUCTION_UNITS (the other, in lib/constants/utility-types,
// was capitalised), which is how a product volume in 'litres' ended up being
// compared against a facility total in 'Litres'.
export { PRODUCTION_UNITS } from '@/lib/constants/production-units';

// ============================================================================
// PRE-CALCULATION STATE
// ============================================================================

export interface PreCalculationState {
  // Material validation
  materials: MaterialWithValidation[];
  canCalculate: boolean;
  missingCount: number;
  editingMaterialId: string | null;
  savingMaterialId: string | null;
  product: any | null;

  // Facility allocation
  linkedFacilities: LinkedFacility[];
  facilityAllocations: FacilityAllocation[];
  reportingSessions: Record<string, ReportingSession[]>;

  // Calculation progress
  calculating: boolean;
  calcSteps: OperationStep[];
  calcProgress: number;

  // Loading
  materialDataLoaded: boolean;
  materialDataLoading: boolean;
}

export const INITIAL_PRE_CALC_STATE: PreCalculationState = {
  materials: [],
  canCalculate: false,
  missingCount: 0,
  editingMaterialId: null,
  savingMaterialId: null,
  product: null,
  linkedFacilities: [],
  facilityAllocations: [],
  reportingSessions: {},
  calculating: false,
  calcSteps: [],
  calcProgress: 0,
  materialDataLoaded: false,
  materialDataLoading: true,
};
