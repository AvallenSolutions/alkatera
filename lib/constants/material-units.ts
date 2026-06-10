// Single source of truth for the units a user can attach to a product
// material (ingredient or packaging) quantity.
//
// Why this exists: product_materials.unit was historically free text. The
// calculator (normalizeToKg in lib/impact-waterfall-resolver.ts) silently
// treated any unit it didn't recognise as kilograms, so a typo'd or exotic
// unit could inflate or deflate a footprint by 10-1000x. Every unit select
// in the product forms must bind to this vocabulary, and the calculator
// refuses to silently pass through anything that isn't in it.
//
// Volume units convert at an assumed density of 1 kg/L (fine for water-based
// liquids; flagged to the user via `assumedDensity` in tryNormalizeToKg).

export type UnitKind = 'mass' | 'volume' | 'count';

export interface MaterialUnit {
  /** Canonical value stored in product_materials.unit */
  value: string;
  /** Human label for selects */
  label: string;
  kind: UnitKind;
  /**
   * Multiply a quantity by this to get kilograms. For volume units this
   * assumes density 1 kg/L. Null for count units (emission factors are
   * per item, so the quantity passes through unchanged).
   */
  toKg: number | null;
  /**
   * For sub-kilogram units, divide by this instead of multiplying by toKg
   * so conversions stay floating-point exact (350 g -> 0.35 kg, not
   * 0.35000000000000003).
   */
  kgDivisor?: number;
  /** Legacy free-text variants that should normalise to this unit */
  aliases: string[];
}

/** Convert a quantity of the given unit definition to kilograms. */
export function quantityToKg(qty: number, def: MaterialUnit): number | null {
  if (def.toKg === null) return null;
  return def.kgDivisor ? qty / def.kgDivisor : qty * def.toKg;
}

export const MATERIAL_UNITS: MaterialUnit[] = [
  {
    value: 'kg', label: 'Kilograms (kg)', kind: 'mass', toKg: 1,
    aliases: ['kilogram', 'kilograms', 'kgs'],
  },
  {
    value: 'g', label: 'Grams (g)', kind: 'mass', toKg: 0.001, kgDivisor: 1000,
    aliases: ['gram', 'grams'],
  },
  {
    value: 'mg', label: 'Milligrams (mg)', kind: 'mass', toKg: 0.000001, kgDivisor: 1_000_000,
    aliases: ['milligram', 'milligrams'],
  },
  {
    value: 't', label: 'Tonnes (t)', kind: 'mass', toKg: 1000,
    aliases: ['tonne', 'tonnes', 'metric_ton', 'metric_tons', 'metric ton', 'metric tons'],
  },
  {
    value: 'lb', label: 'Pounds (lb)', kind: 'mass', toKg: 0.453592,
    aliases: ['lbs', 'pound', 'pounds'],
  },
  {
    value: 'oz', label: 'Ounces (oz)', kind: 'mass', toKg: 0.0283495,
    aliases: ['ounce', 'ounces'],
  },
  {
    value: 'l', label: 'Litres (l)', kind: 'volume', toKg: 1,
    aliases: ['litre', 'litres', 'liter', 'liters'],
  },
  {
    value: 'ml', label: 'Millilitres (ml)', kind: 'volume', toKg: 0.001, kgDivisor: 1000,
    aliases: ['millilitre', 'millilitres', 'milliliter', 'milliliters'],
  },
  {
    value: 'unit', label: 'Units', kind: 'count', toKg: null,
    aliases: ['units', 'item', 'items', 'piece', 'pieces', 'each', 'ea', 'pcs'],
  },
];

/** Units offered when entering an ingredient quantity. */
export const INGREDIENT_UNITS: MaterialUnit[] = ['ml', 'l', 'g', 'kg', 'oz', 'lb', 'unit']
  .map((v) => MATERIAL_UNITS.find((u) => u.value === v)!)
  .filter(Boolean);

/**
 * Units offered for packaging. Packaging is always entered as a mass per
 * product unit (net_weight_g drives the value), so only mass units make
 * sense here. Restricting the set removes a whole class of unit-mismatch
 * errors (e.g. a 400 g bottle stored with unit 'l' became 400 kg).
 */
export const PACKAGING_UNITS: MaterialUnit[] = ['g', 'kg']
  .map((v) => MATERIAL_UNITS.find((u) => u.value === v)!)
  .filter(Boolean);

const UNIT_LOOKUP: Map<string, MaterialUnit> = (() => {
  const map = new Map<string, MaterialUnit>();
  for (const u of MATERIAL_UNITS) {
    map.set(u.value, u);
    for (const alias of u.aliases) map.set(alias, u);
  }
  return map;
})();

/** Resolve a raw unit string (any case, legacy variants) to its definition. */
export function findUnit(raw: string | null | undefined): MaterialUnit | null {
  if (!raw) return null;
  return UNIT_LOOKUP.get(raw.toLowerCase().trim()) ?? null;
}

export function isKnownUnit(raw: string | null | undefined): boolean {
  return findUnit(raw) !== null;
}

/** The kind of a unit ('mass' | 'volume' | 'count'), or null if unrecognised. */
export function unitKind(raw: string | null | undefined): UnitKind | null {
  return findUnit(raw)?.kind ?? null;
}

/** Canonical stored value for a raw unit string, or null if unrecognised. */
export function canonicaliseUnit(raw: string | null | undefined): string | null {
  return findUnit(raw)?.value ?? null;
}

/**
 * Map an OpenLCA reference unit name (as returned by gdt-server, e.g. "kg",
 * "l", "m3", "Item(s)", "p", "MJ") to this vocabulary. Returns null for
 * units we can't express (MJ, m2a, tkm...) so callers treat the factor's
 * reference unit as unknown rather than guessing.
 */
export function mapOpenLcaUnit(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().trim();
  const direct = findUnit(cleaned);
  if (direct) return direct.value;
  if (cleaned === 'item(s)' || cleaned === 'p' || cleaned === 'pc' || cleaned === 'pcs.') return 'unit';
  if (cleaned === 'm3' || cleaned === 'm³') return null; // not in vocabulary; treat as unknown
  return null;
}

/**
 * Convert a product unit size to millilitres (e.g. "750 ml" -> 750,
 * "0.75 l" -> 750). Returns null for non-volume sizes (g, kg, units).
 */
export function unitSizeToMl(
  value: number | string | null | undefined,
  unit: string | null | undefined
): number | null {
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (!v || isNaN(v) || v <= 0) return null;
  const u = (unit || '').toLowerCase().trim();
  if (u === 'ml') return v;
  if (u === 'l') return v * 1000;
  return null;
}

/**
 * Convert a quantity between two units of this vocabulary, keeping the
 * physical amount the same. Mass <-> volume conversions assume density
 * 1 kg/L. Returns null when either unit is a count unit or unrecognised,
 * so callers can leave the amount untouched.
 */
export function convertQuantity(
  amount: number | string,
  fromUnit: string,
  toUnit: string
): number | null {
  const qty = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(qty) || qty <= 0) return null;
  if (fromUnit === toUnit) return qty;

  const from = findUnit(fromUnit);
  const to = findUnit(toUnit);
  if (!from?.toKg || !to?.toKg) return null;

  const kg = qty * from.toKg;
  const converted = kg / to.toKg;
  // Round to avoid floating-point noise (max 6 significant figures)
  return parseFloat(converted.toPrecision(6));
}
