/**
 * The fallback ladder: one rule, applied per product, in order.
 *
 *   1. Peer, like-for-like — same category, same pack format, same boundary, k≥5.
 *   2. Peer, category-only — same category and boundary, any format, k≥5.
 *   3. Literature, with its caveat surfaced, and only where the citation
 *      actually supports the value.
 *   4. No benchmark. The measured figure, alone.
 *
 * Rung 4 is a supported outcome, not a failure. "We cannot benchmark this yet"
 * beside a real number is more credible than a fabricated 70, and it is what
 * several categories deserve today: the Non-Alcoholic sub-categories, where
 * one figure is asked to cover juice, dairy and fizzy drinks, and anything
 * landing on the default fallback, which is an internal assumption dressed as
 * a source.
 *
 * Every consumer must say which rung it is on. A peer benchmark and a
 * literature benchmark must never look alike on screen.
 *
 * What a peer cohort is and is not
 * ================================
 * It is boundary-consistent by construction: the same engine, the same factor
 * sets, the same pack format, the same lifecycle stages. That satisfies ISO
 * 14044's same-boundary requirement structurally rather than by curation,
 * which is the thing a literature table can never do however well cited.
 *
 * It is NOT a sample of the drinks sector. It is a sample of businesses that
 * bought carbon software, and should be expected to beat the sector. Nothing
 * built on this may be labelled "industry average". Call it what it is: other
 * products on alkatera.
 *
 * Two properties worth stating plainly, because they are structural:
 *
 *   - The peer figure is the cohort median, so half of any cohort scores below
 *     it by construction. That is the correct behaviour for a relative
 *     benchmark and a poor one to mistake for an absolute standard.
 *   - If the engine carries a systematic bias, benchmarking customers against
 *     each other hides it, because both sides of the comparison carry the same
 *     error. The literature comparison in `./literature-check.ts` is the only
 *     cheap guard against that, which is why it is not optional.
 */

import {
  getBenchmarkForCategory,
  getBenchmarkForProductType,
  getGroupForCategory,
  type IndustryBenchmark,
} from '@/lib/industry-benchmarks';
import type { SystemBoundary } from '@/lib/system-boundaries';
import { packFormatLabel } from './pack-format';

export type BenchmarkRung =
  | 'peer-like-for-like'
  | 'peer-category'
  | 'literature'
  | 'none';

/**
 * The k-anonymity floor. Enforced in `product_intensity_benchmark_view` so no
 * route can bypass it; re-asserted here so a hand-built cohort, a test fixture
 * or a future admin path cannot either. Two guards, one number, no drift.
 */
export const MINIMUM_COHORT_ORGANIZATIONS = 5;

/**
 * Whether rung 3 requires the literature row's citation to actually support
 * its value.
 *
 * True is the plan's rule and what ships. It has teeth: as of the 24 July 2026
 * audit, `sourceSupportsValue: 'no'` covers Spirits, Beer & Cider,
 * Non-Alcoholic, the three whiskies, Sparkling Wine, Sparkling Water and the
 * default fallback. Those products go to rung 4 until either a peer cohort
 * fills or the citations are repaired, and their climate score falls back to
 * the year-on-year term alone.
 *
 * That is the intended behaviour and the whole argument of the plan. It is a
 * named constant rather than an inline condition so that turning it off is one
 * visible line during the citation-repair work, not a scattered edit.
 */
export const LITERATURE_RUNG_REQUIRES_SUPPORTED_SOURCE = true;

/** One row of `product_intensity_benchmark_view`. */
export interface PeerBucket {
  bucket_kind: 'category_format' | 'category';
  metric_key: string;
  category_group: string | null;
  system_boundary: string;
  pack_format: string | null;
  /** Products behind the percentiles. This is what a producer wants to know. */
  sample_size: number;
  /** Businesses behind those products. This is what the privacy floor is set on. */
  organization_count: number;
  p25: number;
  p50: number;
  p75: number;
  mean_value: number;
}

/** The product being benchmarked. */
export interface BenchmarkSubject {
  /** Specific category, e.g. 'Gin'. Used for the literature rung and the group lookup. */
  productCategory: string | null;
  /** Product type group, e.g. 'Spirits'. Falls back to the org's when absent. */
  productType?: string | null;
  orgProductType?: string | null;
  /** Canonical boundary. Null means we could not read it, which blocks both peer rungs. */
  systemBoundary: SystemBoundary | null;
  /** Cross-org pack token, e.g. 'glass-bottle'. Null blocks rung 1 only. */
  packFormat: string | null;
}

export interface ResolvedBenchmark {
  rung: BenchmarkRung;
  /** kg CO2e per litre. Null on rung 4 — the caller must not substitute one. */
  kgCO2ePerLitre: number | null;
  /** One line naming the comparison, for the UI. Never a bare number. */
  label: string;
  /** Products in the cohort, on a peer rung. */
  cohortProducts: number | null;
  /** Businesses in the cohort, on a peer rung. */
  cohortOrganizations: number | null;
  /** The literature row, on rung 3, so the UI can cite and caveat it. */
  literature: IndustryBenchmark | null;
  /** Why this figure is not to be trusted as fact. Null when it is clean. */
  caveat: string | null;
}

/** Buckets indexed for lookup. Build once per request, use per product. */
export interface PeerCohortIndex {
  byCategoryFormat: Map<string, PeerBucket>;
  byCategory: Map<string, PeerBucket>;
}

const keyOf = (parts: Array<string | null>): string =>
  parts.map((p) => (p ?? '')).join('|');

/**
 * Index the view's rows. Buckets below the floor are dropped rather than
 * indexed-and-filtered: the only rows in the maps are rows that may be used.
 */
export function indexPeerCohorts(buckets: PeerBucket[]): PeerCohortIndex {
  const byCategoryFormat = new Map<string, PeerBucket>();
  const byCategory = new Map<string, PeerBucket>();

  for (const b of buckets) {
    if (!b || !Number.isFinite(b.p50) || b.p50 <= 0) continue;
    if ((b.organization_count ?? 0) < MINIMUM_COHORT_ORGANIZATIONS) continue;

    if (b.bucket_kind === 'category_format' && b.pack_format) {
      byCategoryFormat.set(
        keyOf([b.metric_key, b.category_group, b.system_boundary, b.pack_format]),
        b,
      );
    } else if (b.bucket_kind === 'category') {
      byCategory.set(keyOf([b.metric_key, b.category_group, b.system_boundary]), b);
    }
  }

  return { byCategoryFormat, byCategory };
}

/** The empty index, for callers with no cohort data at all. */
export function emptyPeerCohorts(): PeerCohortIndex {
  return { byCategoryFormat: new Map(), byCategory: new Map() };
}

/**
 * The benchmark group a subject belongs to: its own category's group, then its
 * declared type, then the organisation's. Peer rungs bucket on the group
 * rather than the specific category because a small customer base splits into
 * specific categories that will not reach five businesses for a long time.
 * The specific category is stored on every snapshot row, so tightening this
 * later is a view change and not a re-backfill.
 */
export function subjectGroup(subject: BenchmarkSubject): string | null {
  return (
    getGroupForCategory(subject.productCategory) ??
    subject.productType ??
    subject.orgProductType ??
    null
  );
}

const peerLabel = (
  bucket: PeerBucket,
  group: string | null,
  format: string | null,
): string => {
  const others = Math.max(bucket.sample_size - 1, 1);
  const formatText = packFormatLabel(format);
  if (formatText) {
    return `Compared with ${others} similar ${group ? `${group.toLowerCase()} ` : ''}${formatText} on alkatera`;
  }
  return `Compared with ${others} other ${group ? group.toLowerCase() : 'products'} on alkatera`;
};

/**
 * Walk the ladder for one product.
 *
 * `metricKey` is a parameter because the table is built to carry more than
 * carbon; water intensity is the obvious next one and should not need a second
 * copy of this function.
 */
export function resolveProductBenchmark(
  subject: BenchmarkSubject,
  cohorts: PeerCohortIndex,
  metricKey = 'co2e_per_litre',
): ResolvedBenchmark {
  const group = subjectGroup(subject);
  const boundary = subject.systemBoundary;

  // ── Rung 1: peer, like-for-like ────────────────────────────────────────
  if (group && boundary && subject.packFormat) {
    const bucket = cohorts.byCategoryFormat.get(
      keyOf([metricKey, group, boundary, subject.packFormat]),
    );
    if (bucket) {
      return {
        rung: 'peer-like-for-like',
        kgCO2ePerLitre: bucket.p50,
        label: peerLabel(bucket, group, subject.packFormat),
        cohortProducts: bucket.sample_size,
        cohortOrganizations: bucket.organization_count,
        literature: null,
        caveat: null,
      };
    }
  }

  // ── Rung 2: peer, category-only ────────────────────────────────────────
  if (group && boundary) {
    const bucket = cohorts.byCategory.get(keyOf([metricKey, group, boundary]));
    if (bucket) {
      return {
        rung: 'peer-category',
        kgCO2ePerLitre: bucket.p50,
        label: peerLabel(bucket, group, null),
        cohortProducts: bucket.sample_size,
        cohortOrganizations: bucket.organization_count,
        literature: null,
        caveat: null,
      };
    }
  }

  // ── Rung 3: literature ─────────────────────────────────────────────────
  const literature = pickLiteratureBenchmark(subject);
  if (literature) {
    const usable =
      !LITERATURE_RUNG_REQUIRES_SUPPORTED_SOURCE ||
      literature.sourceSupportsValue !== 'no';
    if (usable && literature.kgCO2ePerLitre > 0) {
      return {
        rung: 'literature',
        kgCO2ePerLitre: literature.kgCO2ePerLitre,
        label: `Published figure: ${literature.sourceName} (${literature.sourceYear})`,
        cohortProducts: null,
        cohortOrganizations: null,
        literature,
        caveat:
          literature.sourceSupportsValue === 'yes'
            ? null
            : literature.caveat ??
              'The cited source does not directly state this figure.',
      };
    }
  }

  // ── Rung 4: no benchmark ───────────────────────────────────────────────
  return {
    rung: 'none',
    kgCO2ePerLitre: null,
    label: 'We cannot benchmark this yet',
    cohortProducts: null,
    cohortOrganizations: null,
    literature: null,
    caveat:
      'No peer cohort has reached five businesses for this category, boundary and pack, and no published figure we hold is supported by its own source. The measured footprint stands on its own.',
  };
}

/**
 * The literature row for a subject, or null.
 *
 * This is the old `pickBenchmark` cascade with one change that matters: it no
 * longer ends at `getBenchmarkForCategory(null)`. That call returns
 * DEFAULT_BENCHMARK, a 1.0 kg/l figure whose own caveat reads "INTERNAL
 * ASSUMPTION DRESSED AS A SOURCE", and returning it unconditionally is what
 * made "always returns something" true and made rung 4 unreachable.
 */
export function pickLiteratureBenchmark(
  subject: BenchmarkSubject,
): IndustryBenchmark | null {
  if (subject.productCategory) {
    const b = getBenchmarkForCategory(subject.productCategory);
    if (b) return b;
  }
  if (subject.productType) {
    const result = getBenchmarkForProductType(subject.productType, []);
    if (result?.benchmark) return result.benchmark;
  }
  if (subject.orgProductType) {
    const result = getBenchmarkForProductType(subject.orgProductType, []);
    if (result?.benchmark) return result.benchmark;
  }
  return null;
}

/** How a set of resolved benchmarks reads as one summary, for the UI. */
export interface BenchmarkMix {
  /** The rung most of the scored volume sits on. Null when nothing was scored. */
  dominant_rung: BenchmarkRung | null;
  /** Products on each rung. */
  by_rung: Record<BenchmarkRung, number>;
  /** Cohort sizes of the dominant rung, when it is a peer rung. */
  cohort_products: number | null;
  cohort_organizations: number | null;
  /** The dominant rung's one-line description and caveat. */
  label: string | null;
  caveat: string | null;
}

export function emptyBenchmarkMix(): BenchmarkMix {
  return {
    dominant_rung: null,
    by_rung: {
      'peer-like-for-like': 0,
      'peer-category': 0,
      literature: 0,
      none: 0,
    },
    cohort_products: null,
    cohort_organizations: null,
    label: null,
    caveat: null,
  };
}

/**
 * Summarise per-product resolutions, weighted by units produced.
 *
 * Weighted, not counted: a producer with one flagship at a million units and
 * nine trial SKUs at a hundred each is described by the flagship. The weight
 * mirrors how the intensity ratio itself is weighted, so the sentence in the
 * UI describes the number beside it.
 */
export function summariseBenchmarkMix(
  entries: Array<{ resolved: ResolvedBenchmark; weight: number }>,
): BenchmarkMix {
  const mix = emptyBenchmarkMix();
  if (entries.length === 0) return mix;

  const weightByRung: Record<BenchmarkRung, number> = {
    'peer-like-for-like': 0,
    'peer-category': 0,
    literature: 0,
    none: 0,
  };

  for (const { resolved, weight } of entries) {
    mix.by_rung[resolved.rung] += 1;
    weightByRung[resolved.rung] += Number.isFinite(weight) && weight > 0 ? weight : 0;
  }

  // Ties, and the all-zero-weight case, resolve up the ladder: the better rung
  // wins, so a summary never understates what the comparison actually was.
  const order: BenchmarkRung[] = [
    'peer-like-for-like',
    'peer-category',
    'literature',
    'none',
  ];
  let dominant: BenchmarkRung = order[0];
  let best = -1;
  for (const rung of order) {
    const w = weightByRung[rung] > 0 ? weightByRung[rung] : mix.by_rung[rung] * 1e-9;
    if (w > best) {
      best = w;
      dominant = rung;
    }
  }
  if (mix.by_rung[dominant] === 0) return mix;

  mix.dominant_rung = dominant;
  const exemplar = entries.find((e) => e.resolved.rung === dominant)?.resolved ?? null;
  mix.label = exemplar?.label ?? null;
  mix.caveat = exemplar?.caveat ?? null;
  mix.cohort_products = exemplar?.cohortProducts ?? null;
  mix.cohort_organizations = exemplar?.cohortOrganizations ?? null;
  return mix;
}
