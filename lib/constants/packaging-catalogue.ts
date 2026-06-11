// Structured packaging catalogue for the guided packaging wizard.
//
// This is the keystone of the question-led packaging flow: each answer the
// user gives ("a bottle" -> "glass" -> "750 ml") maps DETERMINISTICALLY to
// the fields the calculator needs (packaging role, material identity for
// end-of-life factors, an emission factor search, weight expectations and
// circularity defaults). No free-text material names in the happy path, so
// the fragile keyword inference in lib/end-of-life-factors.ts is never
// needed for wizard-created rows.
//
// Typical weights are wide commercial norms for UK/EU drinks packaging; the
// median pre-fills the form, the range powers the plausibility warning in
// lib/constants/packaging-weight-ranges.ts.

import type { PackagingDefaults } from './packaging-defaults';

export interface WeightBand {
  /** Band applies up to and including this size (ml). Last band may be Infinity. */
  maxSizeMl: number;
  medianG: number;
  minG: number;
  maxG: number;
}

export interface CatalogueMaterial {
  /** Stored in product_materials.container_material */
  key: string;
  label: string;
  /** End-of-life factor key understood by getMaterialFactorKey/MATERIAL_TYPE_MAP */
  eolKey: 'glass' | 'aluminium' | 'pet' | 'hdpe' | 'paper' | 'steel' | 'cork' | 'other';
  /** Deterministic emission factor search (run against /api/ingredients/search) */
  efSearchQuery: string;
  /** Circularity defaults applied to the row */
  defaults: PackagingDefaults;
  /** Typical weight bands by container size; null = no size relationship */
  weightBands: WeightBand[] | null;
  /** Flat typical weight when there is no size relationship */
  typicalWeightG?: { medianG: number; minG: number; maxG: number };
}

export interface SizePreset {
  label: string;
  ml: number;
}

export interface ContainerFormat {
  /** Stored in product_materials.container_format */
  key: string;
  label: string;
  /** Plain-language helper shown on the format card */
  description: string;
  materials: CatalogueMaterial[];
  sizePresets: SizePreset[];
}

// ---------------------------------------------------------------------------
// Container formats
// ---------------------------------------------------------------------------

export const CONTAINER_FORMATS: ContainerFormat[] = [
  {
    key: 'bottle',
    label: 'Bottle',
    description: 'Glass or plastic bottles of any shape',
    sizePresets: [
      { label: '187 ml', ml: 187 },
      { label: '275 ml', ml: 275 },
      { label: '330 ml', ml: 330 },
      { label: '500 ml', ml: 500 },
      { label: '700 ml', ml: 700 },
      { label: '750 ml', ml: 750 },
      { label: '1 litre', ml: 1000 },
    ],
    materials: [
      {
        key: 'glass',
        label: 'Glass',
        eolKey: 'glass',
        efSearchQuery: 'glass bottle',
        defaults: { recycled_content_percentage: 40, recyclability_percent: 100, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 250, medianG: 200, minG: 60, maxG: 400 },
          { maxSizeMl: 400, medianG: 280, minG: 120, maxG: 600 },
          { maxSizeMl: 550, medianG: 380, minG: 120, maxG: 700 },
          { maxSizeMl: 800, medianG: 500, minG: 250, maxG: 1000 },
          { maxSizeMl: Infinity, medianG: 700, minG: 300, maxG: 2000 },
        ],
      },
      {
        key: 'pet',
        label: 'Plastic (PET)',
        eolKey: 'pet',
        efSearchQuery: 'PET bottle',
        defaults: { recycled_content_percentage: 30, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 600, medianG: 25, minG: 10, maxG: 50 },
          { maxSizeMl: Infinity, medianG: 40, minG: 20, maxG: 120 },
        ],
      },
      {
        key: 'hdpe',
        label: 'Plastic (HDPE)',
        eolKey: 'hdpe',
        efSearchQuery: 'HDPE bottle',
        defaults: { recycled_content_percentage: 25, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 1000, medianG: 40, minG: 15, maxG: 90 },
          { maxSizeMl: Infinity, medianG: 70, minG: 30, maxG: 150 },
        ],
      },
    ],
  },
  {
    key: 'can',
    label: 'Can',
    description: 'Aluminium or steel drinks cans',
    sizePresets: [
      { label: '150 ml', ml: 150 },
      { label: '250 ml', ml: 250 },
      { label: '330 ml', ml: 330 },
      { label: '440 ml', ml: 440 },
      { label: '500 ml', ml: 500 },
    ],
    materials: [
      {
        key: 'aluminium',
        label: 'Aluminium',
        eolKey: 'aluminium',
        efSearchQuery: 'aluminium can',
        defaults: { recycled_content_percentage: 70, recyclability_percent: 95, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 350, medianG: 13, minG: 8, maxG: 18 },
          { maxSizeMl: 600, medianG: 16, minG: 10, maxG: 25 },
          { maxSizeMl: Infinity, medianG: 25, minG: 15, maxG: 60 },
        ],
      },
      {
        key: 'steel',
        label: 'Steel',
        eolKey: 'steel',
        efSearchQuery: 'steel can',
        defaults: { recycled_content_percentage: 60, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 350, medianG: 28, minG: 18, maxG: 45 },
          { maxSizeMl: Infinity, medianG: 40, minG: 25, maxG: 80 },
        ],
      },
    ],
  },
  {
    key: 'keg',
    label: 'Keg or cask',
    description: 'Reusable kegs, casks and firkins',
    sizePresets: [
      { label: '20 litres', ml: 20000 },
      { label: '30 litres', ml: 30000 },
      { label: '40.9 litres (firkin)', ml: 40900 },
      { label: '50 litres', ml: 50000 },
    ],
    materials: [
      {
        key: 'steel',
        label: 'Stainless steel',
        eolKey: 'steel',
        efSearchQuery: 'stainless steel keg',
        defaults: { reuse_trips: 150, recyclability_percent: 95, end_of_life_pathway: 'reuse' },
        weightBands: [
          { maxSizeMl: 25000, medianG: 7000, minG: 3000, maxG: 11000 },
          { maxSizeMl: Infinity, medianG: 10000, minG: 5000, maxG: 16000 },
        ],
      },
      {
        key: 'pet',
        label: 'Plastic (one-way keg)',
        eolKey: 'pet',
        efSearchQuery: 'PET keg',
        defaults: { recycled_content_percentage: 0, recyclability_percent: 80, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: Infinity, medianG: 1500, minG: 800, maxG: 3000 },
        ],
      },
    ],
  },
  {
    key: 'carton',
    label: 'Carton',
    description: 'Tetra Pak style drinks cartons',
    sizePresets: [
      { label: '200 ml', ml: 200 },
      { label: '330 ml', ml: 330 },
      { label: '500 ml', ml: 500 },
      { label: '1 litre', ml: 1000 },
    ],
    materials: [
      {
        key: 'paperboard',
        label: 'Paperboard (Tetra Pak)',
        eolKey: 'paper',
        efSearchQuery: 'beverage carton',
        defaults: { recycled_content_percentage: 25, recyclability_percent: 50, end_of_life_pathway: 'recycling' },
        weightBands: [
          { maxSizeMl: 350, medianG: 12, minG: 8, maxG: 25 },
          { maxSizeMl: 600, medianG: 18, minG: 10, maxG: 35 },
          { maxSizeMl: Infinity, medianG: 30, minG: 15, maxG: 80 },
        ],
      },
    ],
  },
  {
    key: 'pouch',
    label: 'Pouch',
    description: 'Flexible stand-up pouches and sachets',
    sizePresets: [
      { label: '150 ml', ml: 150 },
      { label: '250 ml', ml: 250 },
      { label: '500 ml', ml: 500 },
    ],
    materials: [
      {
        key: 'plastic_laminate',
        label: 'Plastic laminate',
        eolKey: 'pet',
        efSearchQuery: 'stand-up pouch',
        defaults: { recycled_content_percentage: 0, recyclability_percent: 20, end_of_life_pathway: 'incineration' },
        weightBands: [
          { maxSizeMl: 300, medianG: 8, minG: 3, maxG: 20 },
          { maxSizeMl: Infinity, medianG: 15, minG: 5, maxG: 60 },
        ],
      },
    ],
  },
  {
    key: 'bag_in_box',
    label: 'Bag-in-box',
    description: 'A plastic bag with tap inside a cardboard box',
    sizePresets: [
      { label: '3 litres', ml: 3000 },
      { label: '5 litres', ml: 5000 },
      { label: '10 litres', ml: 10000 },
    ],
    materials: [
      {
        key: 'bib_composite',
        label: 'Plastic bag + cardboard box',
        eolKey: 'paper',
        efSearchQuery: 'bag-in-box',
        defaults: { recycled_content_percentage: 30, recyclability_percent: 40, end_of_life_pathway: 'landfill' },
        weightBands: [
          { maxSizeMl: 3500, medianG: 180, minG: 50, maxG: 350 },
          { maxSizeMl: Infinity, medianG: 280, minG: 100, maxG: 500 },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Closures and labels (asked after the container)
// ---------------------------------------------------------------------------

export interface AccessoryOption {
  key: string;
  label: string;
  /** Formats this option makes sense for; empty = all */
  formats: string[];
  eolKey: CatalogueMaterial['eolKey'];
  efSearchQuery: string;
  typicalWeightG: { medianG: number; minG: number; maxG: number };
  defaults: PackagingDefaults;
  /** Stored in product_materials.container_material for the accessory row */
  materialKey: string;
}

export const CLOSURE_OPTIONS: AccessoryOption[] = [
  {
    key: 'crown_cap',
    label: 'Crown cap',
    formats: ['bottle'],
    eolKey: 'steel',
    materialKey: 'steel',
    efSearchQuery: 'crown cap',
    typicalWeightG: { medianG: 2.2, minG: 1.5, maxG: 4 },
    defaults: { recycled_content_percentage: 60, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'screw_cap_alu',
    label: 'Aluminium screw cap',
    formats: ['bottle'],
    eolKey: 'aluminium',
    materialKey: 'aluminium',
    efSearchQuery: 'aluminium screw cap',
    typicalWeightG: { medianG: 5, minG: 3, maxG: 10 },
    defaults: { recycled_content_percentage: 40, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'screw_cap_plastic',
    label: 'Plastic screw cap',
    formats: ['bottle', 'carton', 'pouch', 'bag_in_box'],
    eolKey: 'pet',
    materialKey: 'pet',
    efSearchQuery: 'plastic screw cap',
    typicalWeightG: { medianG: 3, minG: 1, maxG: 8 },
    defaults: { recycled_content_percentage: 0, recyclability_percent: 80, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'cork_natural',
    label: 'Cork stopper',
    formats: ['bottle'],
    eolKey: 'cork',
    materialKey: 'cork',
    efSearchQuery: 'cork stopper',
    typicalWeightG: { medianG: 5, minG: 3, maxG: 10 },
    defaults: { recycled_content_percentage: 0, recyclability_percent: 0, end_of_life_pathway: 'composting' },
  },
];

export const LABEL_OPTIONS: AccessoryOption[] = [
  {
    key: 'paper_label',
    label: 'Paper label',
    formats: [],
    eolKey: 'paper',
    materialKey: 'paper',
    efSearchQuery: 'paper label',
    typicalWeightG: { medianG: 1.5, minG: 0.3, maxG: 6 },
    defaults: { recycled_content_percentage: 30, recyclability_percent: 80, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'plastic_label',
    label: 'Plastic label or sleeve',
    formats: [],
    eolKey: 'pet',
    materialKey: 'pet',
    efSearchQuery: 'plastic film label',
    typicalWeightG: { medianG: 1, minG: 0.3, maxG: 5 },
    defaults: { recycled_content_percentage: 0, recyclability_percent: 30, end_of_life_pathway: 'incineration' },
  },
  {
    // Direct-to-container decoration, increasingly common on cans (and some
    // glass). The only added material is the ink itself, so the row carries
    // a tiny ink mass rather than a label substrate.
    key: 'printed_direct',
    label: 'Printed directly (no label)',
    formats: ['can', 'bottle'],
    eolKey: 'other',
    materialKey: 'ink',
    efSearchQuery: 'printing ink',
    typicalWeightG: { medianG: 0.4, minG: 0.1, maxG: 2 },
    defaults: { recycled_content_percentage: 0, recyclability_percent: 0, end_of_life_pathway: 'incineration' },
  },
];

// ---------------------------------------------------------------------------
// Multipack / case (shared packaging; the units question IS units_per_group)
// ---------------------------------------------------------------------------

export const MULTIPACK_OPTIONS: AccessoryOption[] = [
  {
    key: 'cardboard_multipack',
    label: 'Cardboard multipack wrap',
    formats: [],
    eolKey: 'paper',
    materialKey: 'paperboard',
    efSearchQuery: 'folding carton',
    typicalWeightG: { medianG: 40, minG: 15, maxG: 150 },
    defaults: { recycled_content_percentage: 25, recyclability_percent: 80, end_of_life_pathway: 'recycling' },
  },
  {
    // Drinks cases are almost always flat carton board (folding boxboard),
    // not corrugated shipping board — so this matches carton board box
    // production, and the corrugated option below covers transit shippers.
    key: 'cardboard_case',
    label: 'Cardboard case or box (flat)',
    formats: [],
    eolKey: 'paper',
    materialKey: 'paperboard',
    efSearchQuery: 'carton board box',
    typicalWeightG: { medianG: 250, minG: 50, maxG: 1000 },
    defaults: { recycled_content_percentage: 70, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'corrugated_shipper',
    label: 'Corrugated shipping box',
    formats: [],
    eolKey: 'paper',
    materialKey: 'paperboard',
    efSearchQuery: 'corrugated board box',
    typicalWeightG: { medianG: 300, minG: 80, maxG: 1500 },
    defaults: { recycled_content_percentage: 70, recyclability_percent: 90, end_of_life_pathway: 'recycling' },
  },
  {
    key: 'shrink_wrap',
    label: 'Plastic shrink wrap',
    formats: [],
    eolKey: 'pet',
    materialKey: 'pet',
    efSearchQuery: 'shrink wrap',
    typicalWeightG: { medianG: 20, minG: 5, maxG: 80 },
    defaults: { recycled_content_percentage: 0, recyclability_percent: 40, end_of_life_pathway: 'incineration' },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getFormat(key: string | null | undefined): ContainerFormat | null {
  return CONTAINER_FORMATS.find((f) => f.key === key) ?? null;
}

export function getMaterial(formatKey: string | null | undefined, materialKey: string | null | undefined): CatalogueMaterial | null {
  return getFormat(formatKey)?.materials.find((m) => m.key === materialKey) ?? null;
}

/** Typical weight for a format material at a given size, if the catalogue knows one. */
export function getTypicalWeight(
  material: CatalogueMaterial | AccessoryOption | null,
  sizeMl?: number | null
): { medianG: number; minG: number; maxG: number } | null {
  if (!material) return null;
  if ('weightBands' in material && material.weightBands && sizeMl && sizeMl > 0) {
    const band = material.weightBands.find((b) => sizeMl <= b.maxSizeMl);
    if (band) return { medianG: band.medianG, minG: band.minG, maxG: band.maxG };
  }
  if ('typicalWeightG' in material && material.typicalWeightG) return material.typicalWeightG;
  return null;
}

export function accessoryOptionsForFormat(options: AccessoryOption[], formatKey: string): AccessoryOption[] {
  return options.filter((o) => o.formats.length === 0 || o.formats.includes(formatKey));
}

/** Human-readable container name, e.g. "750 ml glass bottle". */
export function containerDisplayName(format: ContainerFormat, material: CatalogueMaterial, sizeMl: number): string {
  const size = sizeMl >= 1000 ? `${sizeMl / 1000} litre` : `${sizeMl} ml`;
  return `${size} ${material.label.toLowerCase()} ${format.label.toLowerCase()}`.replace(/\s+/g, ' ');
}
