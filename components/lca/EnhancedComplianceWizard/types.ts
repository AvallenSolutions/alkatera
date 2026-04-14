/**
 * Shared types for the unified LCA wizard.
 * Extracted from CalculateLCASheet for use across wizard step components.
 */

import type { ProductMaterial } from '@/lib/impact-waterfall-resolver';
import type { OperationStep } from '@/components/ui/operation-progress';

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
 * | (data_source IS NULL)
 */
export function materialHasAssignedFactor(mat: ProductMaterial): boolean {
  if (mat.data_source === 'supplier' && mat.supplier_product_id) return true;
  if (mat.data_source && mat.data_source_id) return true;
  return false;
}

export interface MaterialWithValidation extends ProductMaterial {
  hasData: boolean;
  /** Tri-state status distinguishing fully resolved, assigned-but-unresolved, and truly missing */
  validationStatus: MaterialValidationStatus;
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

export interface FacilityAllocation {
  facilityId: string;
  facilityName: string;
  operationalControl: 'owned' | 'third_party';
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  productionVolume: string;
  productionVolumeUnit: string;
  facilityTotalProduction: string;
  selectedSessionId?: string;
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

export const PRODUCTION_UNITS = [
  { value: 'units', label: 'Units' },
  { value: 'litres', label: 'Litres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'tonnes', label: 'Tonnes' },
  { value: 'cases', label: 'Cases' },
  { value: 'pallets', label: 'Pallets' },
];

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
