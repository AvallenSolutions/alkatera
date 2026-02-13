/**
 * EPR Compliance Tool — Data Completeness Validation
 *
 * Checks which EPR fields are missing on each packaging item to help
 * users complete their data before generating submissions.
 */

import type { PackagingCategory } from '@/lib/types/lca';
import type { EPRDataGap, EPRDataCompletenessResult } from './types';

// =============================================================================
// Required Fields per Packaging Category
// =============================================================================

/**
 * Fields that are required for EPR reporting on every packaging item.
 */
const ALWAYS_REQUIRED = [
  'epr_packaging_activity',
  'epr_uk_nation',
  'net_weight_g',
] as const;

/**
 * Additional fields required for primary packaging (container, label, closure).
 */
const PRIMARY_REQUIRED = [
  'epr_is_household',
] as const;

/**
 * Additional fields required for containers.
 */
const CONTAINER_REQUIRED = [
  'epr_is_drinks_container',
] as const;

/**
 * Fields recommended (but not blocking) for Year 2+ submissions.
 */
const RECOMMENDED_FOR_MODULATION = [
  'epr_ram_rating',
] as const;

// =============================================================================
// Field Display Names
// =============================================================================

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  epr_packaging_activity: 'Packaging Activity',
  epr_packaging_level: 'Packaging Level',
  epr_uk_nation: 'UK Nation',
  epr_ram_rating: 'RAM Rating',
  epr_is_household: 'Household/Non-household',
  epr_is_drinks_container: 'Drinks Container flag',
  net_weight_g: 'Net Weight',
  epr_material_type: 'EPR Material Type',
};

// =============================================================================
// Validation Functions
// =============================================================================

interface PackagingItem {
  id: number;
  product_id: number;
  product_name?: string;
  material_name: string;
  packaging_category: PackagingCategory | string;
  net_weight_g: number | null;
  epr_packaging_activity: string | null;
  epr_packaging_level: string | null;
  epr_uk_nation: string | null;
  epr_ram_rating: string | null;
  epr_is_household: boolean | null;
  epr_is_drinks_container: boolean | null;
  epr_material_type: string | null;
}

/**
 * Check a single packaging item for missing EPR fields.
 * Returns an array of missing field names.
 */
export function checkMissingFields(item: PackagingItem): string[] {
  const missing: string[] = [];

  // Always required
  for (const field of ALWAYS_REQUIRED) {
    const value = item[field as keyof PackagingItem];
    if (value == null || value === '' || value === 0) {
      missing.push(FIELD_DISPLAY_NAMES[field] || field);
    }
  }

  // Primary packaging requires household flag
  const isPrimary = ['container', 'label', 'closure'].includes(item.packaging_category);
  if (isPrimary) {
    for (const field of PRIMARY_REQUIRED) {
      if (item[field as keyof PackagingItem] == null) {
        missing.push(FIELD_DISPLAY_NAMES[field] || field);
      }
    }
  }

  // Containers require drinks container flag
  if (item.packaging_category === 'container') {
    for (const field of CONTAINER_REQUIRED) {
      if (item[field as keyof PackagingItem] == null) {
        missing.push(FIELD_DISPLAY_NAMES[field] || field);
      }
    }
  }

  return missing;
}

/**
 * Assess EPR data completeness across all packaging items for an organisation.
 */
export function assessDataCompleteness(items: PackagingItem[]): EPRDataCompletenessResult {
  const gaps: EPRDataGap[] = [];
  let completeCount = 0;

  for (const item of items) {
    const missingFields = checkMissingFields(item);

    if (missingFields.length === 0) {
      completeCount++;
    } else {
      gaps.push({
        product_id: item.product_id,
        product_name: item.product_name || `Product #${item.product_id}`,
        product_material_id: item.id,
        material_name: item.material_name,
        packaging_category: item.packaging_category,
        missing_fields: missingFields,
      });
    }
  }

  const total = items.length;
  return {
    total_packaging_items: total,
    complete_items: completeCount,
    incomplete_items: total - completeCount,
    completeness_pct: total > 0 ? Math.round((completeCount / total) * 100) : 100,
    gaps,
  };
}

/**
 * Check if all items needed for a submission period have sufficient data.
 * Returns true if completeness is 100%.
 */
export function isSubmissionReady(items: PackagingItem[]): boolean {
  return items.every(item => checkMissingFields(item).length === 0);
}
