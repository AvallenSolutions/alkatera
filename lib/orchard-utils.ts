/**
 * Orchard feature utilities
 */

/**
 * Check if an organisation is eligible for orchard features.
 * Currently gated to Spirits producers (calvados, cider) and admin users.
 */
export function isOrchardEligible(
  org: { product_type?: string | null; feature_flags?: Record<string, unknown> } | null | undefined,
  isAlkateraAdmin: boolean
): boolean {
  if (isAlkateraAdmin) return true;
  if ((org?.feature_flags as Record<string, unknown>)?.orchard_beta === true) return true;
  // Allow for spirits producers (calvados, cider) and cider producers
  const type = org?.product_type?.toLowerCase();
  return type === 'spirits' || type === 'cider';
}

/** Human-readable labels for orchard types */
export const ORCHARD_TYPE_LABELS: Record<string, string> = {
  apple: 'Apple',
  pear: 'Pear',
  cherry: 'Cherry',
  plum: 'Plum',
  citrus: 'Citrus',
  stone_fruit: 'Stone Fruit',
  mixed: 'Mixed',
  other: 'Other',
};

/** Human-readable labels for training systems */
export const TRAINING_SYSTEM_LABELS: Record<string, string> = {
  bush: 'Bush/Gobelet',
  spindle: 'Spindle',
  espalier: 'Espalier',
  trellis: 'Trellis',
  central_leader: 'Central Leader',
  open_vase: 'Open Vase',
  other: 'Other',
};

/** Human-readable labels for orchard pesticide types */
export const ORCHARD_PESTICIDE_TYPE_LABELS: Record<string, string> = {
  generic: 'Generic pesticide',
  sulfur: 'Sulfur',
  mancozeb: 'Mancozeb',
  synthetic_fungicide: 'Synthetic fungicide',
  insecticide_codling_moth: 'Codling moth insecticide',
  insecticide_aphid: 'Aphid insecticide',
  herbicide_glyphosate: 'Glyphosate herbicide',
};
