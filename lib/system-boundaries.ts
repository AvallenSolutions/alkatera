/**
 * System Boundary Definitions
 *
 * Single source of truth for LCA system boundary tiers
 * used across the entire platform: wizard, reports, PDF, passport, etc.
 */

export type SystemBoundary =
  | 'cradle-to-gate'
  | 'cradle-to-shelf'
  | 'cradle-to-consumer'
  | 'cradle-to-grave';

export const ALL_LIFECYCLE_STAGES = [
  'raw_materials',
  'processing',
  'packaging',
  'distribution',
  'use_phase',
  'end_of_life',
] as const;

export type LifecycleStage = (typeof ALL_LIFECYCLE_STAGES)[number];

export interface SystemBoundaryDefinition {
  value: SystemBoundary;
  label: string;
  shortLabel: string;
  description: string;
  includedStages: LifecycleStage[];
}

export const SYSTEM_BOUNDARIES: SystemBoundaryDefinition[] = [
  {
    value: 'cradle-to-gate',
    label: 'Cradle-to-Gate',
    shortLabel: 'Gate',
    description: 'Raw materials through factory gate',
    includedStages: ['raw_materials', 'processing', 'packaging'],
  },
  {
    value: 'cradle-to-shelf',
    label: 'Cradle-to-Shelf',
    shortLabel: 'Shelf',
    description: 'Includes distribution to point of sale',
    includedStages: ['raw_materials', 'processing', 'packaging', 'distribution'],
  },
  {
    value: 'cradle-to-consumer',
    label: 'Cradle-to-Consumer',
    shortLabel: 'Consumer',
    description: 'Includes consumer use phase (refrigeration, carbonation)',
    includedStages: ['raw_materials', 'processing', 'packaging', 'distribution', 'use_phase'],
  },
  {
    value: 'cradle-to-grave',
    label: 'Cradle-to-Grave',
    shortLabel: 'Grave',
    description: 'Full lifecycle including end-of-life disposal & recycling',
    includedStages: [
      'raw_materials',
      'processing',
      'packaging',
      'distribution',
      'use_phase',
      'end_of_life',
    ],
  },
];

/**
 * Friendly display names for lifecycle stages
 */
export const STAGE_LABELS: Record<LifecycleStage, string> = {
  raw_materials: 'Raw Materials',
  processing: 'Processing',
  packaging: 'Packaging',
  distribution: 'Distribution',
  use_phase: 'Use Phase',
  end_of_life: 'End of Life',
};

/**
 * Get the full definition for a system boundary value
 */
export function getBoundaryDefinition(boundary: string): SystemBoundaryDefinition {
  return (
    SYSTEM_BOUNDARIES.find((b) => b.value === boundary) ||
    SYSTEM_BOUNDARIES[0] // Default to cradle-to-gate
  );
}

/**
 * Get the human-readable label for a system boundary
 */
export function getBoundaryLabel(boundary: string): string {
  return getBoundaryDefinition(boundary).label;
}

/**
 * Get the included lifecycle stages for a system boundary
 */
export function getBoundaryIncludedStages(boundary: string): LifecycleStage[] {
  return getBoundaryDefinition(boundary).includedStages;
}

/**
 * Get the excluded lifecycle stages for a system boundary
 */
export function getBoundaryExcludedStages(boundary: string): LifecycleStage[] {
  const included = new Set(getBoundaryIncludedStages(boundary));
  return ALL_LIFECYCLE_STAGES.filter((s) => !included.has(s)) as LifecycleStage[];
}

/**
 * Check if a lifecycle stage is included in a system boundary
 */
export function isStageIncluded(boundary: string, stage: string): boolean {
  return getBoundaryIncludedStages(boundary).includes(stage as LifecycleStage);
}

/**
 * Whether the boundary requires use-phase configuration
 */
export function boundaryNeedsUsePhase(boundary: string): boolean {
  return boundary === 'cradle-to-consumer' || boundary === 'cradle-to-grave';
}

/**
 * Whether the boundary requires end-of-life configuration
 */
export function boundaryNeedsEndOfLife(boundary: string): boolean {
  return boundary === 'cradle-to-grave';
}

/**
 * Convert between DB enum format (underscores) and code format (hyphens)
 */
export function boundaryToDbEnum(boundary: string): string {
  return boundary.replace(/-/g, '_');
}

export function boundaryFromDbEnum(dbValue: string): SystemBoundary {
  return dbValue.replace(/_/g, '-') as SystemBoundary;
}
