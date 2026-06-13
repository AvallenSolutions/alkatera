// Water-use ratio: litres of water per litre of product.
//
// The recognised drinks-industry water metric (e.g. "3.4 litres of water per
// litre of beer"). The platform stores water intensity as m3 per production
// unit; this converts it to the familiar litres-per-litre ratio when the
// production unit is a volume. For non-volume output (units, kg, cases) the
// ratio is undefined and callers keep showing m3 per unit. Pure + tested.

/** Litres of product per one production unit, for volume units only. */
export const VOLUME_UNIT_LITRES: Record<string, number> = {
  l: 1,
  litre: 1,
  litres: 1,
  liter: 1,
  liters: 1,
  hl: 100,
  hectolitre: 100,
  hectolitres: 100,
  hectoliter: 100,
  hectoliters: 100,
  ml: 0.001,
  millilitre: 0.001,
  millilitres: 0.001,
  cl: 0.01,
  centilitre: 0.01,
  centilitres: 0.01,
};

/** True when a production unit measures a volume (so litres-per-litre applies). */
export function isVolumeProductionUnit(unit: string | null | undefined): boolean {
  if (!unit) return false;
  return (unit.toLowerCase().trim()) in VOLUME_UNIT_LITRES;
}

/**
 * Litres of water per litre of product. Returns null when the production unit
 * is not a volume, or when the inputs are not positive (so the metric is only
 * shown when it is meaningful).
 *
 * @param netWaterM3       net water consumed, cubic metres
 * @param productionVolume product output, in `productionUnit`
 * @param productionUnit   the unit of productionVolume
 */
export function litresPerLitre(
  netWaterM3: number | null | undefined,
  productionVolume: number | null | undefined,
  productionUnit: string | null | undefined,
): number | null {
  const water = Number(netWaterM3);
  const volume = Number(productionVolume);
  if (!Number.isFinite(water) || water <= 0) return null;
  if (!Number.isFinite(volume) || volume <= 0) return null;

  const litresPerUnit = VOLUME_UNIT_LITRES[(productionUnit ?? '').toLowerCase().trim()];
  if (!litresPerUnit) return null;

  const productLitres = volume * litresPerUnit;
  if (productLitres <= 0) return null;

  const waterLitres = water * 1000;
  return waterLitres / productLitres;
}

/** Plain-language ratio label, e.g. "3.4 litres per litre". */
export function formatWaterRatio(ratio: number | null): string {
  if (ratio === null || !Number.isFinite(ratio)) return 'Not available';
  const rounded = ratio >= 100 ? Math.round(ratio) : Math.round(ratio * 10) / 10;
  return `${rounded.toLocaleString('en-GB')} litres per litre`;
}

/**
 * Aggregate an org-level water-use ratio across facilities that report
 * production in a volume unit (others are excluded). Returns the ratio plus
 * how many facilities contributed, so the UI can state the coverage.
 */
export function aggregateWaterUseRatio(
  facilities: Array<{ netWaterM3: number | null; productionVolume: number | null; productionUnit: string | null }>,
): { ratio: number | null; facilityCount: number } {
  let totalWaterLitres = 0;
  let totalProductLitres = 0;
  let count = 0;

  for (const f of facilities) {
    const litresPerUnit = VOLUME_UNIT_LITRES[(f.productionUnit ?? '').toLowerCase().trim()];
    const water = Number(f.netWaterM3);
    const volume = Number(f.productionVolume);
    if (!litresPerUnit || !Number.isFinite(water) || water <= 0 || !Number.isFinite(volume) || volume <= 0) {
      continue;
    }
    totalWaterLitres += water * 1000;
    totalProductLitres += volume * litresPerUnit;
    count += 1;
  }

  return {
    ratio: totalProductLitres > 0 ? totalWaterLitres / totalProductLitres : null,
    facilityCount: count,
  };
}
