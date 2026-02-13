/**
 * EPR Compliance Tool — Internal ↔ RPD Code Mappings
 *
 * Maps Alkatera's internal EPR types (from lib/types/lca.ts) to the official
 * RPD portal codes required in the Defra CSV file specification.
 */

import type {
  EPRMaterialType,
  EPRPackagingActivity,
  EPRPackagingLevel,
  EPRRAMRating,
  EPRUKNation,
  PackagingCategory,
} from '@/lib/types/lca';

import type {
  RPDMaterialCode,
  RPDPackagingActivity,
  RPDPackagingType,
  RPDNation,
  RPDRecyclabilityRating,
} from './types';

// =============================================================================
// Packaging Activity: Internal → RPD
// =============================================================================

const ACTIVITY_MAP: Record<EPRPackagingActivity, RPDPackagingActivity> = {
  brand: 'SO',
  packed_filled: 'PF',
  imported: 'IM',
  empty: 'SE',
  hired: 'HL',
  marketplace: 'OM',
};

export function mapActivityToRPD(activity: EPRPackagingActivity): RPDPackagingActivity {
  return ACTIVITY_MAP[activity];
}

export function mapRPDToActivity(rpd: RPDPackagingActivity): EPRPackagingActivity {
  const reverse = Object.entries(ACTIVITY_MAP).find(([, v]) => v === rpd);
  return (reverse?.[0] as EPRPackagingActivity) || 'brand';
}

// =============================================================================
// Material Type: Internal → RPD
// =============================================================================

const MATERIAL_MAP: Record<EPRMaterialType, RPDMaterialCode> = {
  aluminium: 'AL',
  fibre_composite: 'FC',
  glass: 'GL',
  paper_cardboard: 'PC',
  plastic_rigid: 'PL',
  plastic_flexible: 'PL',
  steel: 'ST',
  wood: 'WD',
  other: 'OT',
  // Sub-component materials map to Other
  adhesive: 'OT',
  ink: 'OT',
  coating: 'OT',
  lacquer: 'OT',
};

export function mapMaterialToRPD(materialType: EPRMaterialType): RPDMaterialCode {
  return MATERIAL_MAP[materialType] || 'OT';
}

/**
 * Derive the material subtype for Column I of the RPD CSV.
 * Required for plastic (rigid/flexible) and optional for other materials.
 */
export function deriveMaterialSubtype(materialType: EPRMaterialType): string | null {
  if (materialType === 'plastic_rigid') return 'Rigid';
  if (materialType === 'plastic_flexible') return 'Flexible';
  return null;
}

// =============================================================================
// UK Nation: Internal → RPD
// =============================================================================

const NATION_MAP: Record<EPRUKNation, RPDNation> = {
  england: 'EN',
  scotland: 'SC',
  wales: 'WS',
  northern_ireland: 'NI',
};

export function mapNationToRPD(nation: EPRUKNation): RPDNation {
  return NATION_MAP[nation];
}

export function mapRPDToNation(rpd: RPDNation): EPRUKNation {
  const reverse = Object.entries(NATION_MAP).find(([, v]) => v === rpd);
  return (reverse?.[0] as EPRUKNation) || 'england';
}

// =============================================================================
// RAM Rating: Internal → RPD
// =============================================================================

/**
 * Map RAM rating to RPD recyclability rating code.
 * @param rating - Internal RAM rating
 * @param isModulated - Whether the fee year uses modulated rates
 */
export function mapRAMRatingToRPD(
  rating: EPRRAMRating | null | undefined,
  isModulated: boolean
): RPDRecyclabilityRating | null {
  if (!rating) return null;

  const baseMap: Record<EPRRAMRating, string> = {
    red: 'R',
    amber: 'A',
    green: 'G',
  };

  const base = baseMap[rating];
  return (isModulated ? `${base}-M` : base) as RPDRecyclabilityRating;
}

// =============================================================================
// Packaging Type Derivation
// =============================================================================

/**
 * Derive the RPD Packaging Type code from packaging attributes.
 *
 * Rules:
 * - Drinks container + household → HDC
 * - Drinks container + non-household → NDC
 * - Primary/closure/label + household → HH
 * - Primary/closure/label + non-household → NH
 * - Secondary/shipment → NH (always non-household per Defra rules)
 * - Tertiary → NH (always non-household)
 */
export function derivePackagingType(
  packagingCategory: PackagingCategory,
  isHousehold: boolean,
  isDrinksContainer: boolean
): RPDPackagingType {
  // Drinks containers have their own type codes
  if (isDrinksContainer) {
    return isHousehold ? 'HDC' : 'NDC';
  }

  // Primary packaging (container, label, closure)
  if (packagingCategory === 'container' || packagingCategory === 'label' || packagingCategory === 'closure') {
    return isHousehold ? 'HH' : 'NH';
  }

  // Secondary, shipment, and tertiary are always non-household
  return 'NH';
}

// =============================================================================
// Packaging Class Derivation
// =============================================================================

/**
 * Derive the RPD Packaging Class code from the packaging level.
 *
 * Defra class codes:
 * - P1-P6: Primary packaging (different sub-types)
 * - O1: Secondary packaging
 * - O2: Shipment packaging
 * - B1: Tertiary/transit packaging
 *
 * Simplified mapping: we use P1 for all primary (most common for drinks).
 */
export function derivePackagingClass(
  packagingLevel: EPRPackagingLevel | null | undefined,
  packagingCategory: PackagingCategory
): string {
  // If explicit level is set, use it
  if (packagingLevel) {
    switch (packagingLevel) {
      case 'primary': return 'P1';
      case 'secondary': return 'O1';
      case 'shipment': return 'O2';
      case 'tertiary': return 'B1';
    }
  }

  // Derive from packaging category
  switch (packagingCategory) {
    case 'container':
    case 'label':
    case 'closure':
      return 'P1';
    case 'secondary':
      return 'O1';
    case 'shipment':
      return 'O2';
    case 'tertiary':
      return 'B1';
    default:
      return 'P1';
  }
}

// =============================================================================
// Packaging Level: Category → Level
// =============================================================================

const CATEGORY_TO_LEVEL: Record<PackagingCategory, EPRPackagingLevel> = {
  container: 'primary',
  label: 'primary',
  closure: 'primary',
  secondary: 'secondary',
  shipment: 'shipment',
  tertiary: 'tertiary',
};

export function categoryToPackagingLevel(category: PackagingCategory): EPRPackagingLevel {
  return CATEGORY_TO_LEVEL[category];
}
