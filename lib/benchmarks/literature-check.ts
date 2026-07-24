/**
 * Step 5 of the internal-benchmarks plan, and it is not optional.
 *
 * Before anybody is scored against peer data, every bucket that clears the
 * k-anonymity floor is compared against the literature row it would have
 * replaced. Large divergence is a finding either way: it either impugns the
 * literature row, or it reveals a systematic modelling error in our own
 * engine.
 *
 * This is the only cheap guard we have against circularity. If the engine
 * carries a bias, benchmarking customers against each other hides it perfectly
 * — both sides of the comparison carry the identical error, and the cohort
 * looks internally consistent right up until an auditor prices it against
 * something external. An outside number, however shaky, is the only thing in
 * the system that can disagree with us.
 *
 * Nothing here changes a score. It produces findings for a person to read.
 */

import {
  getBenchmarkForCategory,
  getBenchmarkForProductType,
  type BenchmarkBoundary,
  type IndustryBenchmark,
} from '@/lib/industry-benchmarks';
import type { PeerBucket } from './ladder';

/**
 * How our bucket's boundary relates to the literature row's.
 *
 * The two vocabularies are not the same set, and that is the point. Our
 * boundaries are the four ISO tiers the platform models. The literature rows
 * carry whatever their source actually measured, which includes an operational
 * scope 1+2 facility study and a cradle-to-distillation figure per litre of
 * pure alcohol. Those cannot be compared to a product footprint at all, and
 * saying so is more useful than producing a ratio nobody should act on.
 */
export type BoundaryRelation =
  | 'same'
  | 'ours-narrower'
  | 'ours-wider'
  | 'incomparable';

/** Ordered by breadth, so two comparable boundaries can be ranked. */
const OUR_BOUNDARY_BREADTH: Record<string, number> = {
  'cradle-to-gate': 1,
  'cradle-to-shelf': 2,
  'cradle-to-consumer': 3,
  'cradle-to-grave': 4,
};

const LITERATURE_BOUNDARY_BREADTH: Partial<Record<BenchmarkBoundary, number>> = {
  'cradle-to-gate': 1,
  'cradle-to-grave': 4,
};

export function boundaryRelation(
  ours: string,
  theirs: BenchmarkBoundary,
): BoundaryRelation {
  const a = OUR_BOUNDARY_BREADTH[ours];
  const b = LITERATURE_BOUNDARY_BREADTH[theirs];
  if (a === undefined || b === undefined) return 'incomparable';
  if (a === b) return 'same';
  return a < b ? 'ours-narrower' : 'ours-wider';
}

/**
 * Agreement band. Beyond ±33% the two numbers are telling different stories
 * about the same product, which is worth a person's attention. Inside it, the
 * spread between reputable published figures for the same drink is wider than
 * the gap, so tightening the band would generate noise, not findings.
 */
const AGREEMENT_LOWER = 0.75;
const AGREEMENT_UPPER = 1.33;

export type ComparisonVerdict =
  | 'agrees'
  | 'ours-lower'
  | 'ours-higher'
  | 'not-comparable'
  | 'no-literature-row';

export interface LiteratureComparison {
  bucket_kind: PeerBucket['bucket_kind'];
  category_group: string | null;
  system_boundary: string;
  pack_format: string | null;
  sample_size: number;
  organization_count: number;
  /** Our cohort median, kg CO2e per litre. */
  peer_p50: number;
  /** The literature figure it would have replaced, when one exists. */
  literature_value: number | null;
  literature_source: string | null;
  literature_boundary: BenchmarkBoundary | null;
  /** Whether the citation supports the literature figure at all. */
  literature_source_supports: IndustryBenchmark['sourceSupportsValue'] | null;
  boundary_relation: BoundaryRelation | null;
  /** peer_p50 / literature_value. Null when there is nothing to divide by. */
  ratio: number | null;
  verdict: ComparisonVerdict;
  /** One sentence a person can act on. */
  finding: string;
}

function literatureRowForGroup(group: string | null): IndustryBenchmark | null {
  if (!group) return null;
  // Buckets are keyed on the product-type group ('Spirits', 'Wine'), which is
  // exactly what getBenchmarkForProductType takes.
  const byType = getBenchmarkForProductType(group, []);
  if (byType?.benchmark) return byType.benchmark;
  const byCategory = getBenchmarkForCategory(group);
  return byCategory ?? null;
}

const pct = (ratio: number): string => `${Math.round(Math.abs(ratio - 1) * 100)}%`;

/**
 * Compare one bucket against the literature. Pure, so the admin surface and
 * any future scheduled check read the same verdict.
 */
export function compareBucketToLiterature(bucket: PeerBucket): LiteratureComparison {
  const base = {
    bucket_kind: bucket.bucket_kind,
    category_group: bucket.category_group,
    system_boundary: bucket.system_boundary,
    pack_format: bucket.pack_format,
    sample_size: bucket.sample_size,
    organization_count: bucket.organization_count,
    peer_p50: bucket.p50,
  };

  const literature = literatureRowForGroup(bucket.category_group);

  if (!literature) {
    return {
      ...base,
      literature_value: null,
      literature_source: null,
      literature_boundary: null,
      literature_source_supports: null,
      boundary_relation: null,
      ratio: null,
      verdict: 'no-literature-row',
      finding:
        'No published row exists for this category, so this cohort has nothing external to be checked against. It cannot be used to detect a modelling bias.',
    };
  }

  const relation = boundaryRelation(bucket.system_boundary, literature.boundary);
  const ratio =
    literature.kgCO2ePerLitre > 0 ? bucket.p50 / literature.kgCO2ePerLitre : null;

  const shared = {
    ...base,
    literature_value: literature.kgCO2ePerLitre,
    literature_source: literature.sourceName,
    literature_boundary: literature.boundary,
    literature_source_supports: literature.sourceSupportsValue,
    boundary_relation: relation,
    ratio,
  };

  if (relation === 'incomparable' || ratio === null) {
    return {
      ...shared,
      verdict: 'not-comparable',
      finding: `The published figure measures ${literature.functionalUnit} on a ${literature.boundary} basis, which cannot be set against a ${bucket.system_boundary} product footprint. This cohort has no usable external check.`,
    };
  }

  // A row whose own citation does not support it cannot convict our engine of
  // anything. Say which side of the comparison is the weak one before anybody
  // starts rewriting a calculator on the strength of it.
  const suspectSource = literature.sourceSupportsValue === 'no';
  const sourceNote = suspectSource
    ? ' The published figure is itself unsupported by its citation, so the divergence more likely impugns the published row than our engine.'
    : '';

  const boundaryNote =
    relation === 'ours-narrower'
      ? ` Our boundary is narrower than the published one, so our figure should sit BELOW it before any judgement is made.`
      : relation === 'ours-wider'
        ? ` Our boundary is wider than the published one, so our figure should sit ABOVE it before any judgement is made.`
        : '';

  if (ratio >= AGREEMENT_LOWER && ratio <= AGREEMENT_UPPER) {
    return {
      ...shared,
      verdict: 'agrees',
      finding: `Our cohort median of ${bucket.p50.toFixed(2)} kg CO2e per litre is within ${pct(ratio)} of the published ${literature.kgCO2ePerLitre} for this category.${boundaryNote}`,
    };
  }

  if (ratio < AGREEMENT_LOWER) {
    return {
      ...shared,
      verdict: 'ours-lower',
      finding: `Our cohort median of ${bucket.p50.toFixed(2)} kg CO2e per litre is ${pct(ratio)} BELOW the published ${literature.kgCO2ePerLitre}. Either the published row is too high, or the engine is under-counting somewhere in this category.${boundaryNote}${sourceNote}`,
    };
  }

  return {
    ...shared,
    verdict: 'ours-higher',
    finding: `Our cohort median of ${bucket.p50.toFixed(2)} kg CO2e per litre is ${pct(ratio)} ABOVE the published ${literature.kgCO2ePerLitre}. Either the published row is too low, or the engine is over-counting somewhere in this category.${boundaryNote}${sourceNote}`,
  };
}

/**
 * Run the check across a set of buckets. Only buckets clearing the floor are
 * checked: a bucket of three businesses has a median but not a meaningful one,
 * and treating it as evidence about the engine would be the same mistake in
 * the other direction.
 */
export function checkBucketsAgainstLiterature(
  buckets: Array<PeerBucket & { clears_k_anonymity?: boolean }>,
): LiteratureComparison[] {
  return buckets
    .filter((b) => b.clears_k_anonymity !== false && b.organization_count >= 5)
    .map(compareBucketToLiterature);
}
