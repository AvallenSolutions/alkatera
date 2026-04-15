/**
 * Convert a product's unit size (value + unit) to millilitres.
 *
 * Only handles volumetric units commonly used in the drinks industry
 * (ml, cl, dl, l). Mass units (g, kg) and generic "unit" return null so
 * callers can treat them as "cannot scale" and fall back to 1:1 apply.
 */
export function productVolumeToMl(
  value: number | null | undefined,
  unit: string | null | undefined
): number | null {
  if (value == null || !unit) return null;
  const v = typeof value === 'string' ? parseFloat(value) : value;
  if (!Number.isFinite(v) || v <= 0) return null;

  const u = unit.trim().toLowerCase();
  switch (u) {
    case 'ml':
      return v;
    case 'cl':
      return v * 10;
    case 'dl':
      return v * 100;
    case 'l':
    case 'litre':
    case 'litres':
    case 'liter':
    case 'liters':
      return v * 1000;
    default:
      return null;
  }
}

/**
 * Format a volume value + unit as a short display string, e.g. "70cl".
 * Returns null when either part is missing.
 */
export function formatProductVolume(
  value: number | null | undefined,
  unit: string | null | undefined
): string | null {
  if (value == null || !unit) return null;
  return `${value}${unit}`;
}
