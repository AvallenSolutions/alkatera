/**
 * Canonical production-unit vocabulary.
 *
 * Before this module there were six competing lists for one concept, including
 * TWO different exports both literally named PRODUCTION_UNITS:
 *
 *   components/products/FacilitiesTab.tsx        units | litres | kg | tonnes | bottles | cases
 *   components/lca/.../types.ts                  units | litres | kg | tonnes | cases | pallets
 *   lib/constants/utility-types.ts               Litres | Hectolitres | Units | kg   (capitalised)
 *   components/facilities/ProductionRunDataEntry Litres | Hectolitres | Units | kg   (capitalised)
 *   components/production/LogProductionModal     Litre | Hectolitre | Unit          (singular)
 *
 * Three hand-rolled mapper functions existed to paper over the mismatch, and a
 * product volume in 'litres' still compared unequal to a facility total in
 * 'Litres' -- which is what produced the spurious unit-mismatch warnings on
 * facility attribution.
 *
 * Canonical values are lowercase. `normaliseProductionUnit` maps every legacy
 * spelling (capitalised, singular, and the ml/L/g/kg product-size vocabulary)
 * onto them, so existing rows keep comparing correctly without a backfill.
 */

export type ProductionUnit =
  | 'units'
  | 'litres'
  | 'hectolitres'
  | 'kg'
  | 'tonnes'
  | 'bottles'
  | 'cases'
  | 'pallets';

export const PRODUCTION_UNITS: ReadonlyArray<{
  value: ProductionUnit;
  label: string;
}> = [
  { value: 'units', label: 'Units' },
  { value: 'litres', label: 'Litres' },
  { value: 'hectolitres', label: 'Hectolitres' },
  { value: 'kg', label: 'Kilograms' },
  { value: 'tonnes', label: 'Tonnes' },
  { value: 'bottles', label: 'Bottles' },
  { value: 'cases', label: 'Cases' },
  { value: 'pallets', label: 'Pallets' },
] as const;

/**
 * Every legacy spelling seen in the codebase and in stored rows, mapped to its
 * canonical form. Keys are compared lowercased, so this only needs to cover
 * distinct WORDS, not casing variants.
 */
const ALIASES: Record<string, ProductionUnit> = {
  unit: 'units',
  units: 'units',
  bottle: 'bottles',
  bottles: 'bottles',
  case: 'cases',
  cases: 'cases',
  pallet: 'pallets',
  pallets: 'pallets',
  litre: 'litres',
  litres: 'litres',
  liter: 'litres',
  liters: 'litres',
  l: 'litres',
  hectolitre: 'hectolitres',
  hectolitres: 'hectolitres',
  hectoliter: 'hectolitres',
  hectoliters: 'hectolitres',
  hl: 'hectolitres',
  kg: 'kg',
  kgs: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  tonne: 'tonnes',
  tonnes: 'tonnes',
  ton: 'tonnes',
  tons: 'tonnes',
  t: 'tonnes',
};

/**
 * Map any known spelling of a production unit onto its canonical value.
 * Returns null for empty/unknown input so callers can decide whether an
 * unrecognised unit is an error or simply "not set".
 */
export function normaliseProductionUnit(
  value: string | null | undefined,
): ProductionUnit | null {
  if (!value) return null;
  return ALIASES[value.trim().toLowerCase()] ?? null;
}

/**
 * True when two unit strings mean the same thing, regardless of spelling.
 *
 * Use this for the attribution guard instead of `a === b`: a product volume
 * stored as 'litres' and a facility total stored as 'Litres' are the same
 * unit and must not raise a mismatch warning.
 */
export function sameProductionUnit(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const na = normaliseProductionUnit(a);
  const nb = normaliseProductionUnit(b);
  return na !== null && nb !== null && na === nb;
}

/** Human label for a unit, falling back to the raw value if unrecognised. */
export function productionUnitLabel(value: string | null | undefined): string {
  const canonical = normaliseProductionUnit(value);
  if (!canonical) return value ?? '';
  return PRODUCTION_UNITS.find((u) => u.value === canonical)?.label ?? canonical;
}

/**
 * Sensible default production unit for a product, derived from the unit size
 * it is sold in (products.unit_size_unit uses ml | L | g | kg).
 *
 * Replaces defaultProductionUnit() in FacilitiesTab.
 */
export function defaultProductionUnitForSize(
  unitSizeUnit: string | null | undefined,
): ProductionUnit {
  switch ((unitSizeUnit ?? '').trim().toLowerCase()) {
    case 'ml':
    case 'l':
      return 'litres';
    case 'g':
    case 'kg':
      return 'kg';
    default:
      return 'units';
  }
}
