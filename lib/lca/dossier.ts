import type { Provenance } from '@/lib/provenance';
import {
  provenanceFromEfSourceType,
  provenanceFromPcfStatus,
} from '@/lib/provenance';
import { boundaryNeedsDistribution, boundaryNeedsEndOfLife, boundaryNeedsUsePhase } from '@/lib/system-boundaries';

/**
 * The dossier: one product's footprint, as something to read and correct
 * rather than a form to fill in.
 *
 * The wizard asked a founder to author an LCA across ten to fourteen steps,
 * about half of which were ISO documentation that auto-filled with boilerplate
 * and passed its own validation. This model inverts that. Every section starts
 * populated with what the platform already believes, carries a provenance
 * label saying how much to trust it, and can be corrected in place.
 *
 * Nothing here computes emissions. The aggregator has already done that; this
 * only reads the result and says honestly where each part came from.
 */

export type SectionId = 'materials' | 'making' | 'distribution' | 'after' | 'methods';

/**
 * What the reader should understand about a section at a glance.
 *
 * `unreviewed` is the important one, and it is the reason this model exists.
 * The wizard silently injected a 50 km truck leg on mount and let its own
 * Next button accept it, so an exporter could ship a cradle-to-grave figure
 * carrying an unexamined local-delivery assumption with nothing on screen
 * saying so. A default nobody has looked at is not the same as a fact, and
 * the dossier refuses to render them identically.
 */
export type SectionState =
  | 'settled'      // populated and confirmed, or computed from confirmed inputs
  | 'unreviewed'   // a default is standing in and nobody has looked at it
  | 'incomplete'   // genuinely missing something the footprint needs
  | 'out_of_scope'; // the boundary excludes this stage, correctly

export interface DossierRow {
  id: string;
  title: string;
  hint?: string;
  value?: string;
  unit?: string | null;
  provenance?: Provenance;
}

export interface DossierSection {
  id: SectionId;
  /** Plain language. No "system boundary", no "functional unit". */
  title: string;
  /** One sentence saying what this section covers, in the user's terms. */
  blurb: string;
  state: SectionState;
  /** What the reader should do, when there is something to do. */
  note?: string;
  kgCo2e: number | null;
  sharePct: number | null;
  provenance: Provenance;
  rows: DossierRow[];
}

export interface Dossier {
  productId: string;
  productName: string;
  /** Fossil carbon footprint per unit: the headline, biogenic excluded. */
  headlineKgCo2e: number | null;
  functionalUnit: string | null;
  referenceYear: number | null;
  systemBoundary: string | null;
  /** Plain-language rendering of the boundary, for people who do not speak ISO. */
  boundaryLabel: string;
  pcfId: string | null;
  pcfStatus: string | null;
  provenance: Provenance;
  /** 0-100. How much of this footprint rests on confirmed data. */
  confirmedPct: number;
  calculatedAt: string | null;
  sections: DossierSection[];
}

/**
 * The boundary, said in words a drinks founder would use. The ISO phrasing
 * survives in the mono annotation and the PDF, not in the reading line.
 */
export const BOUNDARY_LABELS: Record<string, string> = {
  'cradle-to-gate': 'Up to your factory gate',
  'cradle-to-shelf': 'Up to the shelf it sells from',
  'cradle-to-consumer': 'Up to the person who drinks it',
  'cradle-to-grave': 'All the way to the bin',
};

export function boundaryLabel(boundary: string | null | undefined): string {
  if (!boundary) return 'Not set yet';
  return BOUNDARY_LABELS[boundary] ?? boundary;
}

function share(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

/**
 * The weakest link wins. A section is only as trustworthy as its least
 * trustworthy input, because that is the one that will embarrass you.
 */
function weakest(values: Provenance[]): Provenance {
  if (values.length === 0) return 'estimated';
  if (values.includes('estimated')) return 'estimated';
  if (values.includes('drafted')) return 'drafted';
  return 'confirmed';
}

export interface DossierInput {
  product: { id: string | number; name: string };
  pcf: {
    id: string;
    status: string | null;
    functional_unit: string | null;
    reference_year: number | null;
    system_boundary: string | null;
    aggregated_impacts: any;
    distribution_config: any;
    updated_at: string | null;
  } | null;
  materials: Array<{
    id: string;
    material_name: string | null;
    material_type: string | null;
    impact_climate: number | null;
    ef_source_type?: string | null;
    matched_source_name?: string | null;
    data_source?: string | null;
    gwp_data_source?: string | null;
  }>;
  facilityCount: number;
}

export function buildDossier(input: DossierInput): Dossier {
  const { product, pcf, materials, facilityCount } = input;

  const impacts = pcf?.aggregated_impacts ?? {};
  const stages = impacts?.breakdown?.by_lifecycle_stage ?? {};

  // ISO 14067 §6.4.9.3: the headline excludes biogenic CO2, which is reported
  // separately. Matching the report transformer rather than inventing a
  // second definition of "the number".
  const totalIncludingBiogenic = typeof impacts.climate_change_gwp100 === 'number'
    ? impacts.climate_change_gwp100
    : null;
  const biogenic = typeof impacts.climate_biogenic === 'number' ? impacts.climate_biogenic : 0;
  const headline = totalIncludingBiogenic === null ? null : totalIncludingBiogenic - biogenic;

  const boundary = pcf?.system_boundary ?? null;
  const pcfProvenance = provenanceFromPcfStatus(pcf?.status);

  const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

  // ── Materials ────────────────────────────────────────────────────────
  const materialsKg = (num(stages.raw_materials) ?? 0) + (num(stages.packaging) ?? 0);
  const materialProvenances = materials.map((m) =>
    provenanceFromEfSourceType(m.ef_source_type ?? null, {
      userAccepted: Boolean(m.matched_source_name),
    }),
  );
  const proxyCount = materialProvenances.filter((p) => p === 'estimated').length;

  const materialsSection: DossierSection = {
    id: 'materials',
    title: 'What it is made of',
    blurb: 'Your recipe and packaging, and where each figure came from.',
    state: materials.length === 0 ? 'incomplete' : proxyCount > 0 ? 'unreviewed' : 'settled',
    note:
      materials.length === 0
        ? 'No ingredients or packaging yet. Add a recipe and the footprint follows.'
        : proxyCount > 0
          ? `${proxyCount} of ${materials.length} are matched to an industry average rather than a specific source.`
          : undefined,
    kgCo2e: materials.length === 0 ? null : materialsKg,
    sharePct: share(materialsKg, headline),
    provenance: weakest(materialProvenances),
    rows: materials
      .slice()
      .sort((a, b) => (Number(b.impact_climate) || 0) - (Number(a.impact_climate) || 0))
      .map((m, i) => ({
        id: m.id || `material-${i}`,
        title: m.material_name || 'Unnamed',
        hint: m.matched_source_name || m.gwp_data_source || undefined,
        value: m.impact_climate === null ? undefined : Number(m.impact_climate).toFixed(4),
        unit: 'kg CO₂e',
        provenance: materialProvenances[i],
      })),
  };

  // ── Making ───────────────────────────────────────────────────────────
  const processingKg = num(stages.processing);
  const makingSection: DossierSection = {
    id: 'making',
    title: 'Making it',
    blurb: 'The energy and processing at the sites where this product is made.',
    state: facilityCount === 0 ? 'incomplete' : 'settled',
    note:
      facilityCount === 0
        ? 'No site is linked yet, so making it counts as zero. That is almost certainly too low.'
        : undefined,
    kgCo2e: processingKg,
    sharePct: share(processingKg, headline),
    provenance: facilityCount === 0 ? 'estimated' : pcfProvenance,
    rows: [],
  };

  // ── Distribution ─────────────────────────────────────────────────────
  const distributionKg = num(stages.distribution);
  const legs: any[] = pcf?.distribution_config?.legs ?? [];
  const inScope = boundary ? boundaryNeedsDistribution(boundary) : false;
  // The 50 km truck leg the wizard injected on mount, untouched. One leg, that
  // exact distance and mode, with the label it ships with.
  const looksLikeUntouchedDefault =
    legs.length === 1 &&
    Number(legs[0]?.distanceKm) === 50 &&
    legs[0]?.transportMode === 'truck' &&
    (legs[0]?.label ?? '').toLowerCase() === 'factory to retail';

  const distributionSection: DossierSection = {
    id: 'distribution',
    title: 'Getting it to customers',
    blurb: 'How far this product travels after it leaves you, and by what.',
    state: !inScope
      ? 'out_of_scope'
      : legs.length === 0
        ? 'incomplete'
        : looksLikeUntouchedDefault
          ? 'unreviewed'
          : 'settled',
    note: !inScope
      ? 'This footprint stops at your factory gate, so sales out is not counted. Widen it to include this.'
      : legs.length === 0
        ? 'Nothing set yet, so this counts as zero.'
        : looksLikeUntouchedDefault
          ? 'Using a standard 50 km delivery by lorry. Nobody has checked that against your actual routes.'
          : undefined,
    kgCo2e: inScope ? distributionKg : null,
    sharePct: inScope ? share(distributionKg, headline) : null,
    provenance: looksLikeUntouchedDefault || legs.length === 0 ? 'estimated' : 'confirmed',
    rows: legs.map((leg: any, i: number) => ({
      id: leg.id || `leg-${i}`,
      title: leg.label || `Leg ${i + 1}`,
      hint: leg.transportMode ? String(leg.transportMode) : undefined,
      value: leg.distanceKm === undefined ? undefined : String(leg.distanceKm),
      unit: 'km',
      provenance: looksLikeUntouchedDefault ? ('estimated' as Provenance) : ('confirmed' as Provenance),
    })),
  };

  // ── After it is sold ─────────────────────────────────────────────────
  const useKg = num(stages.use_phase);
  const eolKg = num(stages.end_of_life);
  const usePhaseInScope = boundary ? boundaryNeedsUsePhase(boundary) : false;
  const eolInScope = boundary ? boundaryNeedsEndOfLife(boundary) : false;
  const afterInScope = usePhaseInScope || eolInScope;
  const afterKg = (useKg ?? 0) + (eolKg ?? 0);

  const afterSection: DossierSection = {
    id: 'after',
    title: 'After it is sold',
    blurb: 'Chilling it, drinking it, and what happens to the packaging.',
    state: !afterInScope ? 'out_of_scope' : 'settled',
    note: !afterInScope
      ? 'This footprint stops before the customer, so none of this is counted.'
      : undefined,
    kgCo2e: afterInScope ? afterKg : null,
    sharePct: afterInScope ? share(afterKg, headline) : null,
    provenance: afterInScope ? 'estimated' : 'confirmed',
    rows: afterInScope
      ? [
          ...(usePhaseInScope
            ? [{
                id: 'use-phase',
                title: 'Keeping it cold and serving it',
                value: useKg === null ? undefined : useKg.toFixed(4),
                unit: 'kg CO₂e',
                provenance: 'estimated' as Provenance,
              }]
            : []),
          ...(eolInScope
            ? [{
                id: 'end-of-life',
                title: 'Recycling and disposal',
                value: eolKg === null ? undefined : eolKg.toFixed(4),
                unit: 'kg CO₂e',
                provenance: 'estimated' as Provenance,
              }]
            : []),
        ]
      : [],
  };

  // ── Methods ──────────────────────────────────────────────────────────
  // Machine-authored and attributed as such. The wizard made a founder write
  // three ISO-framed paragraphs, or more often accept boilerplate that then
  // appeared in a signed report as though a human had considered it.
  const methodsSection: DossierSection = {
    id: 'methods',
    title: 'How this was worked out',
    blurb: 'Standard methodology, applied by alkatera. Nothing here needs you.',
    state: 'settled',
    kgCo2e: null,
    sharePct: null,
    provenance: 'confirmed',
    rows: [
      {
        id: 'standards',
        title: 'Follows ISO 14067 and ISO 14044',
        hint: 'The international standards for product carbon footprints',
      },
      {
        id: 'boundary',
        title: boundaryLabel(boundary),
        hint: boundary ? `system boundary · ${boundary}` : 'not set',
      },
      {
        id: 'gwp',
        title: 'IPCC AR6 global warming potentials',
        hint: 'The current values, over 100 years',
      },
      {
        id: 'reference-year',
        title: pcf?.reference_year ? `Reference year ${pcf.reference_year}` : 'Reference year not set',
      },
    ],
  };

  const sections = [
    materialsSection,
    makingSection,
    distributionSection,
    afterSection,
    methodsSection,
  ];

  // Confirmed share across the sections that actually count towards the
  // number. Out-of-scope stages are not unconfirmed, they are irrelevant.
  const counting = sections.filter((s) => s.id !== 'methods' && s.state !== 'out_of_scope');
  const confirmedPct =
    counting.length === 0
      ? 0
      : Math.round(
          (counting.filter((s) => s.provenance === 'confirmed').length / counting.length) * 100,
        );

  // The footprint is only as trustworthy as the data under it, NOT as
  // trustworthy as its own status. A PCF marked 'completed' whose every input
  // is an industry average is a finished calculation over estimated data, and
  // labelling that "Confirmed." next to "0% confirmed" is exactly the kind of
  // flattering contradiction this surface exists to stop printing.
  const overallProvenance = weakest(counting.map((s) => s.provenance));

  return {
    productId: String(product.id),
    productName: product.name,
    headlineKgCo2e: headline,
    functionalUnit: pcf?.functional_unit ?? null,
    referenceYear: pcf?.reference_year ?? null,
    systemBoundary: boundary,
    boundaryLabel: boundaryLabel(boundary),
    pcfId: pcf?.id ?? null,
    pcfStatus: pcf?.status ?? null,
    provenance: pcf ? overallProvenance : pcfProvenance,
    confirmedPct,
    calculatedAt: pcf?.updated_at ?? null,
    sections,
  };
}
