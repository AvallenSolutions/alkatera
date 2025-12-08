import { ImpactSourceType } from '@/lib/types/lca';

/**
 * Maps data quality tags to impact source types for database storage
 *
 * Data Quality Tags are human-readable labels used in audit trails and UI:
 * - Primary_Verified: Supplier-provided EPDs and verified LCAs
 * - Regional_Standard: Government databases (DEFRA, EPA) and regional averages
 * - Secondary_Modelled: LCA databases (Ecoinvent, staging factors)
 *
 * Impact Source Types are normalized database enum values:
 * - primary_verified: Verified supplier data
 * - secondary_modelled: All modelled data (regional + LCA databases)
 * - hybrid_proxy: Mixed primary + proxy data
 *
 * @param dataQualityTag - Human-readable tag from waterfall resolver
 * @returns Database-compatible impact source enum value
 */
export function mapDataQualityToImpactSource(
  dataQualityTag: string | null | undefined
): ImpactSourceType | null {
  if (!dataQualityTag) {
    return null;
  }

  const normalized = dataQualityTag.toLowerCase().trim();

  switch (normalized) {
    case 'primary_verified':
      return 'primary_verified';

    case 'regional_standard':
      return 'secondary_modelled';

    case 'secondary_modelled':
      return 'secondary_modelled';

    case 'hybrid_proxy':
      return 'hybrid_proxy';

    default:
      console.warn(
        `[data-quality-mapper] Unknown data quality tag: "${dataQualityTag}". Defaulting to secondary_modelled.`
      );
      return 'secondary_modelled';
  }
}

/**
 * Maps data priority levels to impact source types
 *
 * @param dataPriority - Priority level from waterfall resolver (1-3)
 * @returns Database-compatible impact source enum value
 */
export function mapDataPriorityToImpactSource(
  dataPriority: 1 | 2 | 3
): ImpactSourceType {
  switch (dataPriority) {
    case 1:
      return 'primary_verified';
    case 2:
    case 3:
      return 'secondary_modelled';
    default:
      return 'secondary_modelled';
  }
}

/**
 * Determines the impact source based on both data quality tag and priority
 * Uses tag if available, falls back to priority-based mapping
 *
 * @param dataQualityTag - Human-readable tag
 * @param dataPriority - Priority level (1-3)
 * @returns Database-compatible impact source enum value
 */
export function resolveImpactSource(
  dataQualityTag: string | null | undefined,
  dataPriority: 1 | 2 | 3
): ImpactSourceType {
  const tagBasedSource = mapDataQualityToImpactSource(dataQualityTag);

  if (tagBasedSource) {
    return tagBasedSource;
  }

  return mapDataPriorityToImpactSource(dataPriority);
}
