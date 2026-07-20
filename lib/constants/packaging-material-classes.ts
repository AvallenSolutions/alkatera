// Controlled vocabulary for parametric packaging factors.
//
// Users never pick an emissions factor for packaging: they pick a material
// class (and a variant where it moves the factor, e.g. glass colour), and the
// calculator derives the factor deterministically from the virgin/recycled
// endpoints in packaging_factor_endpoints at the item's recycled content.
//
// Two kinds of class:
//   - 'parametric': mono-materials with vetted virgin + recycled endpoints;
//     factor = virgin - r * (virgin - recycled), r = recycled content 0..1.
//   - 'gap_filler': composites with no ecoinvent mono-material equivalent
//     (bag-in-box, laminate pouch, liquid carton). A single curated
//     staging_emission_factors row, pinned BY ID, never fuzzy-matched, and
//     no recycled interpolation (the blended factor stands as reviewed).

import type { CatalogueMaterial } from './packaging-catalogue';

export type PackagingMaterialClass =
  | 'glass'
  | 'aluminium'
  | 'steel'
  | 'pet'
  | 'hdpe'
  | 'pp'
  | 'ldpe_film'
  | 'paperboard'
  | 'kraft'
  | 'corrugated'
  | 'cork'
  // Composites (gap-fillers)
  | 'bib_composite'
  | 'plastic_laminate'
  | 'liquid_carton';

export interface MaterialVariant {
  key: string;
  label: string;
}

export interface MaterialClassDef {
  key: PackagingMaterialClass;
  label: string;
  kind: 'parametric' | 'gap_filler';
  /** Always at least [{ key: 'standard', ... }]; glass carries colours. */
  variants: MaterialVariant[];
  defaultVariant: string;
  /** End-of-life factor key understood by calculateMaterialEoL / getMaterialFactorKey. */
  eolKey: CatalogueMaterial['eolKey'];
  /**
   * For kind='gap_filler': the curated global staging_emission_factors row.
   * Seeded with a fixed UUID by migration 20260719100000 so it can be pinned
   * by ID in every environment.
   */
  gapFillerFactorId?: string;
  gapFillerFactorName?: string;
}

const STANDARD: MaterialVariant[] = [{ key: 'standard', label: 'Standard' }];

export const MATERIAL_CLASSES: Record<PackagingMaterialClass, MaterialClassDef> = {
  glass: {
    key: 'glass',
    label: 'Glass',
    kind: 'parametric',
    variants: [
      { key: 'flint', label: 'Flint (clear)' },
      { key: 'green', label: 'Green' },
      { key: 'amber', label: 'Amber' },
    ],
    defaultVariant: 'flint',
    eolKey: 'glass',
  },
  aluminium: {
    key: 'aluminium',
    label: 'Aluminium',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'aluminium',
  },
  steel: {
    key: 'steel',
    label: 'Steel / tinplate',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'steel',
  },
  pet: {
    key: 'pet',
    label: 'Plastic (PET)',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'pet',
  },
  hdpe: {
    key: 'hdpe',
    label: 'Plastic (HDPE)',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'hdpe',
  },
  pp: {
    key: 'pp',
    label: 'Plastic (PP)',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'hdpe',
  },
  ldpe_film: {
    key: 'ldpe_film',
    label: 'Plastic film (LDPE)',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'hdpe',
  },
  paperboard: {
    key: 'paperboard',
    label: 'Paperboard / carton board',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'paper',
  },
  kraft: {
    key: 'kraft',
    label: 'Kraft paper',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'paper',
  },
  corrugated: {
    key: 'corrugated',
    label: 'Corrugated board',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'paper',
  },
  cork: {
    key: 'cork',
    label: 'Cork',
    kind: 'parametric',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'cork',
  },
  bib_composite: {
    key: 'bib_composite',
    label: 'Bag-in-box (composite)',
    kind: 'gap_filler',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'paper',
    gapFillerFactorId: 'b2000000-0000-4000-8000-000000000001',
    gapFillerFactorName: 'Gap-filler: Bag-in-box composite (curated)',
  },
  plastic_laminate: {
    key: 'plastic_laminate',
    label: 'Plastic laminate pouch (composite)',
    kind: 'gap_filler',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'pet',
    gapFillerFactorId: 'b2000000-0000-4000-8000-000000000002',
    gapFillerFactorName: 'Gap-filler: Plastic laminate pouch (curated)',
  },
  liquid_carton: {
    key: 'liquid_carton',
    label: 'Liquid carton (composite)',
    kind: 'gap_filler',
    variants: STANDARD,
    defaultVariant: 'standard',
    eolKey: 'paper',
    gapFillerFactorId: 'b2000000-0000-4000-8000-000000000003',
    gapFillerFactorName: 'Gap-filler: Liquid carton (curated)',
  },
};

export const MATERIAL_CLASS_LIST: MaterialClassDef[] = Object.values(MATERIAL_CLASSES);

export function getMaterialClass(key: string | null | undefined): MaterialClassDef | null {
  if (!key) return null;
  return MATERIAL_CLASSES[key as PackagingMaterialClass] ?? null;
}

export function isParametricClass(key: string | null | undefined): boolean {
  return getMaterialClass(key)?.kind === 'parametric';
}

export function isGapFillerClass(key: string | null | undefined): boolean {
  return getMaterialClass(key)?.kind === 'gap_filler';
}

/** Resolve a class's variant, falling back to its default. */
export function resolveVariant(classKey: string | null | undefined, variant: string | null | undefined): string {
  const def = getMaterialClass(classKey);
  if (!def) return 'standard';
  if (variant && def.variants.some((v) => v.key === variant)) return variant;
  return def.defaultVariant;
}

// ---------------------------------------------------------------------------
// Legacy mapping (Phase 3 backfill tooling ONLY — never used in the calc path)
// ---------------------------------------------------------------------------

/**
 * Coarse map from every product_materials.container_material value the
 * packaging catalogue has ever written to a material class. The wizard and
 * class picker write packaging_material_class directly; this exists so the
 * admin migration tool can propose classes for pre-parametric rows.
 */
export const CONTAINER_MATERIAL_TO_CLASS: Record<string, { class: PackagingMaterialClass; variant?: string }> = {
  glass: { class: 'glass', variant: 'flint' },
  pet: { class: 'pet' },
  hdpe: { class: 'hdpe' },
  pp: { class: 'pp' },
  aluminium: { class: 'aluminium' },
  steel: { class: 'steel' },
  paperboard: { class: 'paperboard' },
  paper: { class: 'kraft' },
  cork: { class: 'cork' },
  plastic_laminate: { class: 'plastic_laminate' },
  bib_composite: { class: 'bib_composite' },
  // 'ink' (printed-direct decoration) intentionally unmapped: tiny mass, no
  // sensible mono-material endpoint; rows keep the legacy resolution path.
};

/** Map from getMaterialFactorKey() outputs to a class (name-inference fallback). */
const EOL_KEY_TO_CLASS: Record<string, PackagingMaterialClass> = {
  glass: 'glass',
  aluminium: 'aluminium',
  steel: 'steel',
  pet: 'pet',
  hdpe: 'hdpe',
  pp: 'pp',
  paper: 'paperboard',
  cardboard: 'paperboard',
  cork: 'cork',
};

export interface LegacyClassInference {
  class: PackagingMaterialClass | null;
  variant: string;
  confidence: 'exact' | 'inferred' | 'none';
}

/**
 * Propose a material class for a legacy packaging row. Exact when the row
 * carries a catalogue container_material; inferred when the material/factor
 * name classifies via getMaterialFactorKey; none otherwise (human decides).
 *
 * getMaterialFactorKey is passed in rather than imported to keep this module
 * dependency-light for client bundles.
 */
export function inferMaterialClassFromLegacyRow(
  row: {
    container_material?: string | null;
    packaging_category?: string | null;
    material_name?: string | null;
    name?: string | null;
    matched_source_name?: string | null;
  },
  getMaterialFactorKey: (category: string, materialName?: string, factorName?: string) => string,
): LegacyClassInference {
  const containerMaterial = (row.container_material || '').toLowerCase().trim();
  const exact = containerMaterial ? CONTAINER_MATERIAL_TO_CLASS[containerMaterial] : undefined;
  if (exact) {
    const variant = exact.variant ?? MATERIAL_CLASSES[exact.class].defaultVariant;
    return { class: exact.class, variant: inferGlassVariant(exact.class, row) ?? variant, confidence: 'exact' };
  }

  const factorKey = getMaterialFactorKey(
    row.packaging_category || '',
    row.material_name || row.name || undefined,
    row.matched_source_name || undefined,
  );
  const inferred = EOL_KEY_TO_CLASS[factorKey];
  if (inferred) {
    const variant = inferGlassVariant(inferred, row) ?? MATERIAL_CLASSES[inferred].defaultVariant;
    return { class: inferred, variant, confidence: 'inferred' };
  }

  return { class: null, variant: 'standard', confidence: 'none' };
}

/** Pull a glass colour out of the material/factor name when obvious. */
function inferGlassVariant(
  cls: PackagingMaterialClass,
  row: { material_name?: string | null; name?: string | null; matched_source_name?: string | null },
): string | null {
  if (cls !== 'glass') return null;
  const hay = [row.material_name, row.name, row.matched_source_name].filter(Boolean).join(' ').toLowerCase();
  if (/\bgreen\b/.test(hay)) return 'green';
  if (/\bamber\b|\bbrown\b/.test(hay)) return 'amber';
  if (/\bflint\b|\bclear\b/.test(hay)) return 'flint';
  return null;
}
