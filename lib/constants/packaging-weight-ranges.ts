// Plausibility ranges for packaging weights and ingredient amounts.
//
// These are deliberately wide "is this physically believable?" bounds, not
// quality targets. They exist to catch order-of-magnitude entry mistakes
// (a 5 g glass bottle, a 5 kg label) before they reach a calculation, where
// they have produced badly wrong footprints. Warnings are advisory and never
// block saving.
//
// Sources: typical commercial drinks packaging weights (UK/EU). A 330 ml
// aluminium can is ~9-15 g; a 750 ml glass wine/spirits bottle 300-900 g
// (lightweight ~300 g, premium spirits up to ~900 g); PET bottles 15-60 g;
// stainless kegs 9-13 kg.

export interface WeightCheckInput {
  /** Role of the packaging item: container | label | closure | secondary | shipment | tertiary */
  packagingCategory?: string | null;
  /** Free-text material/item name, used to infer the material */
  materialName?: string | null;
  /** Product unit size in millilitres, when known (e.g. 750 for a 75 cl bottle) */
  containerSizeMl?: number | null;
  /** Entered weight in grams */
  weightG?: number | string | null;
}

export interface WeightCheckResult {
  level: 'ok' | 'warning';
  /** Plain-language message for the user when level is 'warning' */
  message?: string;
  /** The range the value was checked against, when one applied */
  range?: { minG: number; maxG: number; label: string };
}

interface RangeRule {
  /** Keyword patterns matched against the material name (lower-cased) */
  pattern: RegExp;
  /** Optional size bands for containers; first matching band wins */
  bands?: Array<{ maxSizeMl: number; minG: number; maxG: number }>;
  minG: number;
  maxG: number;
  label: string;
}

const CONTAINER_RULES: RangeRule[] = [
  // Steel before aluminium: "steel can" must not hit the aluminium rule's
  // generic "can" keyword (steel cans are roughly twice the weight).
  {
    pattern: /steel|tinplate/,
    bands: [
      { maxSizeMl: 350, minG: 15, maxG: 45 },
      { maxSizeMl: 600, minG: 20, maxG: 80 },
    ],
    minG: 15,
    maxG: 16000, // up to stainless kegs
    label: 'a steel container',
  },
  {
    pattern: /alumin(i)?um|alu\b|can\b/,
    bands: [
      { maxSizeMl: 350, minG: 8, maxG: 18 },
      { maxSizeMl: 600, minG: 10, maxG: 25 },
    ],
    minG: 8,
    maxG: 60,
    label: 'an aluminium can',
  },
  {
    pattern: /glass/,
    bands: [
      { maxSizeMl: 250, minG: 60, maxG: 400 },
      { maxSizeMl: 550, minG: 120, maxG: 700 },
      { maxSizeMl: 800, minG: 250, maxG: 1000 },
    ],
    minG: 60,
    maxG: 2000,
    label: 'a glass bottle',
  },
  // Kegs before PET: a "plastic (PET) keg" is keg-sized, not bottle-sized.
  {
    pattern: /keg|cask|firkin|\bpin\b/,
    minG: 800,
    maxG: 16000,
    label: 'a keg or cask',
  },
  {
    pattern: /\bpet\b|plastic bottle|hdpe/,
    minG: 10,
    maxG: 120,
    label: 'a plastic (PET) bottle',
  },
  {
    pattern: /tetra|carton|gable/,
    minG: 10,
    maxG: 80,
    label: 'a drinks carton',
  },
  {
    pattern: /pouch|sachet/,
    minG: 3,
    maxG: 60,
    label: 'a pouch',
  },
  {
    pattern: /bag.in.box|\bbib\b/,
    minG: 50,
    maxG: 500,
    label: 'a bag-in-box',
  },
];

const ROLE_RULES: Record<string, { minG: number; maxG: number; label: string }> = {
  label: { minG: 0.2, maxG: 10, label: 'a label' },
  closure: { minG: 0.5, maxG: 15, label: 'a cap, cork or closure' },
  secondary: { minG: 10, maxG: 5000, label: 'a multipack or case' },
  shipment: { minG: 10, maxG: 10000, label: 'shipping packaging' },
  tertiary: { minG: 100, maxG: 35000, label: 'tertiary packaging (e.g. a pallet or stretch wrap)' },
};

function formatGrams(g: number): string {
  if (g >= 1000) {
    const kg = g / 1000;
    return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
  }
  return `${g} g`;
}

/**
 * Check a packaging weight for physical plausibility.
 * Returns a non-blocking, plain-language warning when the weight falls
 * outside the believable range for what the item appears to be.
 */
export function checkPackagingWeight(input: WeightCheckInput): WeightCheckResult {
  const weight = Number(input.weightG);
  if (!weight || isNaN(weight) || weight <= 0) return { level: 'ok' };

  const name = (input.materialName || '').toLowerCase();
  const category = (input.packagingCategory || '').toLowerCase();

  let minG: number | null = null;
  let maxG: number | null = null;
  let label = '';

  // Role categories (label, closure, secondary, ...) get their role's range.
  // Everything else — 'container', legacy values like 'primary', or no
  // category at all — falls through to name-based inference, so a row whose
  // category was never set is still checked against what its name says it is.
  if (!ROLE_RULES[category]) {
    for (const rule of CONTAINER_RULES) {
      if (!rule.pattern.test(name)) continue;
      label = rule.label;
      minG = rule.minG;
      maxG = rule.maxG;
      const sizeMl = Number(input.containerSizeMl);
      if (rule.bands && sizeMl > 0) {
        const band = rule.bands.find((b) => sizeMl <= b.maxSizeMl);
        if (band) {
          minG = band.minG;
          maxG = band.maxG;
          label = `a ${sizeMl} ml ${rule.label.replace(/^an? /, '')}`;
        }
      }
      break;
    }
  }

  if (minG === null && ROLE_RULES[category]) {
    const rule = ROLE_RULES[category];
    minG = rule.minG;
    maxG = rule.maxG;
    label = rule.label;
  }

  if (minG === null || maxG === null) return { level: 'ok' };

  if (weight < minG || weight > maxG) {
    return {
      level: 'warning',
      message:
        `${formatGrams(weight)} is unusual for ${label} — these typically weigh ` +
        `${formatGrams(minG)} to ${formatGrams(maxG)}. Please double-check the weight ` +
        `(and that it's entered in grams).`,
      range: { minG, maxG, label },
    };
  }

  return { level: 'ok', range: { minG, maxG, label } };
}

/**
 * Check an ingredient amount (per single product unit) for plausibility
 * against the product's unit size. Catches batch quantities entered as
 * per-unit values (e.g. 500 kg of barley against a 330 ml beer).
 *
 * `amountKgPerUnit` must already be normalised to kg per product unit
 * (per-bottle, not per-batch).
 */
export function checkIngredientAmount(input: {
  amountKgPerUnit: number;
  unitSizeMl?: number | null;
  ingredientName?: string | null;
}): WeightCheckResult {
  const { amountKgPerUnit } = input;
  const sizeMl = Number(input.unitSizeMl);
  if (!amountKgPerUnit || amountKgPerUnit <= 0 || !sizeMl || sizeMl <= 0) {
    return { level: 'ok' };
  }

  // A single ingredient rarely exceeds ~3x the finished product's mass
  // (water-heavy processes like brewing consume more water than ends up in
  // the bottle, hence the generous multiplier).
  const productMassKg = sizeMl / 1000; // density ~1 kg/L
  const ceilingKg = productMassKg * 3;

  if (amountKgPerUnit > ceilingKg) {
    const name = input.ingredientName ? `of ${input.ingredientName} ` : '';
    return {
      level: 'warning',
      message:
        `${amountKgPerUnit.toFixed(2)} kg ${name}per ${sizeMl} ml product seems high — ` +
        `that's more than 3x the product's own weight. If this is the amount used per ` +
        `batch rather than per unit, switch to batch mode or divide by the batch size.`,
    };
  }

  return { level: 'ok' };
}
