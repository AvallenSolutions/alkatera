// One-line packaging matcher: turns free text ("330ml amber glass bottle")
// into a catalogue format + material + size, the same deterministic mapping
// PackagingWizard uses (lib/constants/packaging-catalogue.ts). Powers
// PackagingComposer's instant inference so typing a name behaves like the
// guided wizard without the six clicks.
//
// Deliberately conservative: a confident format match is required before a
// material or size is attempted. Text that doesn't name a recognised format
// ("something bespoke") returns null and the composer falls back to a plain
// name + background emission-factor search, same as the ingredient composer.

import {
  CONTAINER_FORMATS,
  getFormat,
  getMaterial,
  getTypicalWeight,
  containerDisplayName,
  type ContainerFormat,
  type CatalogueMaterial,
} from '@/lib/constants/packaging-catalogue';

export interface PackagingTextMatch {
  format: ContainerFormat;
  material: CatalogueMaterial;
  sizeMl: number | null;
  typicalWeight: { medianG: number; minG: number; maxG: number } | null;
  /** Display name to pre-fill, e.g. "330 ml glass bottle". Falls back to the
   *  typed text when the size isn't known yet. */
  displayName: string;
}

// A few extra words per format beyond its own key/label — real users don't
// always say "bottle", they say "jar" or "tin".
const FORMAT_SYNONYMS: Record<string, string[]> = {
  bottle: ['bottle', 'jar'],
  can: ['can', 'tin'],
  keg: ['keg', 'cask', 'firkin', 'pin'],
  carton: ['carton', 'tetra pak', 'tetrapak', 'tetra'],
  pouch: ['pouch', 'sachet', 'stand-up pouch', 'standup pouch'],
  bag_in_box: ['bag-in-box', 'bag in box', 'bib', 'box bag'],
};

// Material synonyms, matched only within the chosen format's material list
// so "plastic" resolves to PET on a bottle but doesn't collide with a can's
// aluminium/steel choice.
const MATERIAL_SYNONYMS: Record<string, string[]> = {
  glass: ['glass', 'amber glass', 'clear glass', 'green glass'],
  pet: ['pet', 'plastic', 'polyethylene terephthalate'],
  hdpe: ['hdpe', 'high-density polyethylene', 'high density polyethylene'],
  aluminium: ['aluminium', 'aluminum', 'alu'],
  steel: ['steel', 'stainless', 'stainless steel', 'tinplate'],
  paperboard: ['paperboard', 'paper', 'cardboard', 'tetra pak', 'tetra'],
  plastic_laminate: ['laminate', 'foil laminate', 'plastic laminate'],
  bib_composite: ['composite', 'bag and box'],
};

/** Size in ml from text like "330ml", "500 ml", "1 litre", "20l", "40.9 litre". */
export function findPackagingSizeMl(text: string): number | null {
  const lower = text.toLowerCase();
  const mlMatch = lower.match(/(\d+(?:\.\d+)?)\s*m\s*l\b/);
  if (mlMatch) return parseFloat(mlMatch[1]);
  const lMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:litre|liter|l)s?\b/);
  if (lMatch) return parseFloat(lMatch[1]) * 1000;
  return null;
}

function findFormat(text: string): ContainerFormat | null {
  const lower = text.toLowerCase();
  for (const format of CONTAINER_FORMATS) {
    const words = [format.key, format.label.toLowerCase(), ...(FORMAT_SYNONYMS[format.key] ?? [])];
    if (words.some((w) => lower.includes(w))) return format;
  }
  return null;
}

function findMaterial(format: ContainerFormat, text: string): CatalogueMaterial | null {
  const lower = text.toLowerCase();
  for (const material of format.materials) {
    const words = [material.key, material.label.toLowerCase(), ...(MATERIAL_SYNONYMS[material.key] ?? [])];
    if (words.some((w) => lower.includes(w))) return material;
  }
  return null;
}

/**
 * Match free text against the packaging catalogue. `fallbackSizeMl` (usually
 * the product's own unit size) is used when the text doesn't state one, so
 * "glass bottle" on a 750 ml product still gets a typical weight.
 */
export function matchPackagingText(text: string, fallbackSizeMl?: number | null): PackagingTextMatch | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const format = findFormat(trimmed);
  if (!format) return null;

  const material = findMaterial(format, trimmed) ?? getMaterial(format.key, format.materials[0]?.key) ?? format.materials[0] ?? null;
  if (!material) return null;

  const sizeMl = findPackagingSizeMl(trimmed) ?? fallbackSizeMl ?? format.sizePresets[0]?.ml ?? null;
  const typicalWeight = getTypicalWeight(material, sizeMl);
  const displayName = sizeMl ? containerDisplayName(format, material, sizeMl) : trimmed;

  return { format, material, sizeMl, typicalWeight, displayName };
}

/** Re-exported for callers that only need to check a format resolves at all
 *  (used to keep the material-key lookup consistent with PackagingWizard). */
export { getFormat };
