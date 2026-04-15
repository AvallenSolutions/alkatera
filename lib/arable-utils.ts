/**
 * Arable field feature utilities
 */

/**
 * Check if an organisation is eligible for arable field features.
 * Currently gated to Spirits/Whisky producers and admin users.
 */
export function isArableEligible(
  org: { product_type?: string | null; feature_flags?: Record<string, unknown> } | null | undefined,
  isAlkateraAdmin: boolean
): boolean {
  if (isAlkateraAdmin) return true;
  if ((org?.feature_flags as Record<string, unknown>)?.arable_beta === true) return true;
  const type = org?.product_type?.toLowerCase();
  return type === 'spirits' || type === 'whisky' || type === 'beer';
}

/** Human-readable labels for crop types */
export const CROP_TYPE_LABELS: Record<string, string> = {
  barley: 'Barley',
  wheat: 'Wheat',
  oats: 'Oats',
  rye: 'Rye',
  maize: 'Maize',
  other: 'Other',
};

/** Human-readable labels for sowing methods */
export const SOWING_METHOD_LABELS: Record<string, string> = {
  drilled: 'Drilled',
  broadcast: 'Broadcast',
  direct_drill: 'Direct Drill (No-till)',
  other: 'Other',
};

/** Human-readable labels for straw management */
export const STRAW_MANAGEMENT_LABELS: Record<string, string> = {
  incorporated: 'Incorporated into soil',
  baled_removed: 'Baled and removed',
  burned: 'Burned (stubble burning)',
  mulched: 'Mulched / left on surface',
};

/** Human-readable labels for grain drying fuel types */
export const GRAIN_DRYING_FUEL_LABELS: Record<string, string> = {
  natural_gas: 'Natural gas',
  lpg: 'LPG',
  diesel: 'Diesel',
  biomass: 'Biomass',
  grid_electricity: 'Grid electricity',
  none: 'No drying required',
};

/** Human-readable labels for lime types */
export const LIME_TYPE_LABELS: Record<string, string> = {
  ite: 'Limestone (CaCO3)',
  dolomite: 'Dolomite (CaMg(CO3)2)',
  none: 'No lime applied',
};

/** Human-readable labels for arable pesticide types */
export const ARABLE_PESTICIDE_TYPE_LABELS: Record<string, string> = {
  generic: 'Generic pesticide',
  sulfur: 'Sulfur',
  synthetic_fungicide: 'Synthetic fungicide',
  herbicide_glyphosate: 'Glyphosate herbicide',
  growth_regulator: 'Growth regulator',
};

/** Human-readable labels for arable certification */
export const ARABLE_CERTIFICATION_LABELS: Record<string, string> = {
  conventional: 'Conventional',
  organic: 'Organic',
  other: 'Other',
};
