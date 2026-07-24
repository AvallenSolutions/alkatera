/**
 * A pack format token that means the same thing in two different businesses.
 *
 * The peer benchmark's whole claim is boundary-and-format consistency: a
 * cradle-to-gate figure for a 700 ml glass bottle compared against other
 * cradle-to-gate figures for glass bottles. Packaging is 40-60% of a drink's
 * footprint, so a cohort that mixes glass and aluminium is not a like-for-like
 * comparison however many products are in it.
 *
 * `pack_formats.id` cannot do this job. A pack format is owned by one
 * organisation and the L2 backfill created them 1:1 from products, so two
 * businesses packing in the identical bottle hold two unrelated rows. What is
 * comparable across organisations is what the bottle IS: its material class
 * and its container shape.
 *
 * Hence one low-cardinality token, `<material>-<format>`, e.g. `glass-bottle`
 * or `aluminium-can`. Low cardinality is the point — a cohort has to reach
 * five distinct organisations, and a token carrying colour, weight or fill
 * volume would split every bucket until none of them ever did.
 *
 * Resolution order for a product's container, most trustworthy first:
 *   1. the parametric fields (`packaging_material_class` + `container_format`),
 *      which are what the calculator actually selects the factor from;
 *   2. `container_material`, the guided wizard's structured identity;
 *   3. `material_type` / `material_name` keyword inference, for the rows that
 *      predate both.
 *
 * A product whose container cannot be resolved returns null. It then falls
 * through to the category-only rung rather than being dropped — an unknown
 * pack is a reason not to claim like-for-like, not a reason to say nothing.
 */

/** Cross-organisation container shapes. Mirrors CONTAINER_FORMATS in the packaging catalogue. */
export type CanonicalContainerFormat =
  | 'bottle'
  | 'can'
  | 'keg'
  | 'carton'
  | 'pouch'
  | 'bag_in_box';

/**
 * Cross-organisation container materials. Deliberately coarser than
 * PackagingMaterialClass: colour variants and the pp/ldpe distinction do not
 * change the comparison a producer is making, and they would fragment cohorts.
 */
export type CanonicalContainerMaterial =
  | 'glass'
  | 'aluminium'
  | 'steel'
  | 'pet'
  | 'hdpe'
  | 'paperboard'
  | 'composite';

/** The minimum a packaging row has to expose for this module to read it. */
export interface PackFormatMaterialRow {
  material_name?: string | null;
  material_type?: string | null;
  packaging_category?: string | null;
  packaging_material_class?: string | null;
  container_format?: string | null;
  container_material?: string | null;
  net_weight_g?: number | string | null;
}

/** Material classes from the parametric vocabulary, folded to the coarse set. */
const MATERIAL_CLASS_TO_CANONICAL: Record<string, CanonicalContainerMaterial> = {
  glass: 'glass',
  aluminium: 'aluminium',
  aluminum: 'aluminium',
  steel: 'steel',
  pet: 'pet',
  hdpe: 'hdpe',
  pp: 'hdpe',
  ldpe_film: 'hdpe',
  paperboard: 'paperboard',
  kraft: 'paperboard',
  corrugated: 'paperboard',
  paper: 'paperboard',
  // Composites have no mono-material equivalent and are priced from a single
  // curated factor, so they stay one bucket.
  bib_composite: 'composite',
  plastic_laminate: 'composite',
  liquid_carton: 'composite',
};

const CONTAINER_FORMATS = new Set<CanonicalContainerFormat>([
  'bottle',
  'can',
  'keg',
  'carton',
  'pouch',
  'bag_in_box',
]);

/**
 * Free-text fallbacks, checked in order, first match wins. More specific
 * patterns come first so "aluminium bottle" does not resolve as a can.
 */
const MATERIAL_KEYWORDS: Array<[RegExp, CanonicalContainerMaterial]> = [
  [/bag[\s-]?in[\s-]?box|\bbib\b/i, 'composite'],
  [/laminate|pouch/i, 'composite'],
  [/tetra|liquid\s*carton|gable\s*top/i, 'composite'],
  [/glass/i, 'glass'],
  [/alumini?um|\balu\b/i, 'aluminium'],
  [/\bsteel\b|\btinplate\b/i, 'steel'],
  [/\bpet\b|polyethylene\s+terephthalate|rpet/i, 'pet'],
  [/\bhdpe\b|\bpp\b|\bldpe\b|polypropylene|polyethylene/i, 'hdpe'],
  [/cardboard|paperboard|carton|kraft|corrugated|\bpaper\b/i, 'paperboard'],
];

const FORMAT_KEYWORDS: Array<[RegExp, CanonicalContainerFormat]> = [
  [/bag[\s-]?in[\s-]?box|\bbib\b/i, 'bag_in_box'],
  [/\bpouch\b/i, 'pouch'],
  [/\bkeg\b|\bcask\b/i, 'keg'],
  [/\bcarton\b|tetra|gable\s*top/i, 'carton'],
  [/\bcan\b|\btin\b/i, 'can'],
  [/\bbottle\b|\bjar\b|\bflask\b/i, 'bottle'],
];

/** Containers a material implies when the shape is not stated. */
const MATERIAL_IMPLIES_FORMAT: Partial<Record<CanonicalContainerMaterial, CanonicalContainerFormat>> = {
  glass: 'bottle',
  aluminium: 'can',
};

function numeric(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? parseFloat(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

function firstMatch<T>(text: string, rules: Array<[RegExp, T]>): T | null {
  for (const [pattern, value] of rules) {
    if (pattern.test(text)) return value;
  }
  return null;
}

/**
 * The row a pack format is judged by: its container, or failing an explicit
 * container role, its heaviest packaging row. Same defining-component rule the
 * pack namer uses, so the benchmark bucket and the pack's own name never
 * disagree about which part is the bottle.
 */
export function definingContainerRow(
  rows: PackFormatMaterialRow[],
): PackFormatMaterialRow | null {
  if (!rows || rows.length === 0) return null;

  const byWeightDesc = (a: PackFormatMaterialRow, b: PackFormatMaterialRow) =>
    numeric(b.net_weight_g) - numeric(a.net_weight_g);

  const containers = rows
    .filter((r) => {
      const role = (r.packaging_category ?? '').trim().toLowerCase();
      // 'container' is the current role vocabulary; 'primary' is the legacy
      // EPR-level spelling that older rows still carry.
      return role === 'container' || role === 'primary';
    })
    .sort(byWeightDesc);
  if (containers.length > 0) return containers[0];

  return [...rows].sort(byWeightDesc)[0] ?? null;
}

/** The coarse material of one packaging row, or null when nothing says. */
export function canonicalContainerMaterial(
  row: PackFormatMaterialRow | null,
): CanonicalContainerMaterial | null {
  if (!row) return null;

  const structured = [row.packaging_material_class, row.container_material]
    .map((v) => (v ?? '').trim().toLowerCase())
    .find((v) => v && MATERIAL_CLASS_TO_CANONICAL[v]);
  if (structured) return MATERIAL_CLASS_TO_CANONICAL[structured];

  const text = [row.material_type, row.material_name].filter(Boolean).join(' ');
  return text ? firstMatch(text, MATERIAL_KEYWORDS) : null;
}

/** The container shape of one packaging row, or null when nothing says. */
export function canonicalContainerFormat(
  row: PackFormatMaterialRow | null,
  material: CanonicalContainerMaterial | null,
): CanonicalContainerFormat | null {
  if (!row) return null;

  const structured = (row.container_format ?? '').trim().toLowerCase();
  if (CONTAINER_FORMATS.has(structured as CanonicalContainerFormat)) {
    return structured as CanonicalContainerFormat;
  }

  const text = [row.material_type, row.material_name].filter(Boolean).join(' ');
  const inferred = text ? firstMatch(text, FORMAT_KEYWORDS) : null;
  if (inferred) return inferred;

  // Last resort. Glass in a drinks business is a bottle and aluminium is a can
  // often enough to be worth the assumption; nothing else is, so nothing else
  // gets one.
  return material ? MATERIAL_IMPLIES_FORMAT[material] ?? null : null;
}

/**
 * The benchmark bucket token for a product's packaging, e.g. `glass-bottle`.
 * Null when the container cannot be resolved with enough confidence to claim
 * two products are packed the same way.
 */
export function packFormatToken(rows: PackFormatMaterialRow[]): string | null {
  const row = definingContainerRow(rows);
  const material = canonicalContainerMaterial(row);
  if (!material) return null;
  const format = canonicalContainerFormat(row, material);
  if (!format) return null;
  return `${material}-${format}`;
}

/** Plain-language name for a token, for the cohort line in the UI. */
export function packFormatLabel(token: string | null | undefined): string | null {
  if (!token) return null;
  const [material, ...rest] = token.split('-');
  const format = rest.join('-');
  const materialLabels: Record<string, string> = {
    glass: 'glass',
    aluminium: 'aluminium',
    steel: 'steel',
    pet: 'PET',
    hdpe: 'HDPE',
    paperboard: 'paperboard',
    composite: 'composite',
  };
  const formatLabels: Record<string, string> = {
    bottle: 'bottles',
    can: 'cans',
    keg: 'kegs',
    carton: 'cartons',
    pouch: 'pouches',
    bag_in_box: 'bag-in-box',
  };
  const m = materialLabels[material];
  const f = formatLabels[format];
  if (!m || !f) return null;
  return `${m} ${f}`;
}
