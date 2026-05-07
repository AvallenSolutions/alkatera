/**
 * Factor Suitability Engine
 *
 * Pure, rule-based evaluator that turns a search result's structured metadata
 * into plain-English guidance:
 *  - whatItCovers: 1–2 sentences summarising what the factor includes.
 *  - goodMatchIf:  bullets explaining when this is a sensible choice.
 *  - lookElsewhereIf: bullets flagging when a different factor would be better.
 *
 * No free-text parsing — we only make claims from structured fields. This
 * keeps us deterministic and avoids inventing things the data does not say.
 */

import type { SearchResult } from '@/components/lca/InlineIngredientSearch';
import { translateBoundary } from './lca-glossary';

export interface SuitabilityContext {
  /** ISO-2 country code of the user's organisation, lowercase. */
  userCountry?: string | null;
  /** Whether this is a search for an ingredient or a packaging item. */
  materialType?: 'ingredient' | 'packaging';
}

export interface FactorSuitability {
  whatItCovers: string;
  goodMatchIf: string[];
  lookElsewhereIf: string[];
}

const EU_REGIONS = new Set([
  'rer',
  'europe',
  'europe without switzerland',
  'eu',
  'eu27',
  'eu-28',
  'eu28',
]);

const EU_COUNTRIES = new Set([
  'gb', 'fr', 'de', 'es', 'it', 'nl', 'be', 'pt', 'ie', 'dk', 'se', 'fi',
  'pl', 'cz', 'at', 'gr', 'no', 'ch', 'ro', 'hu',
]);

function normaliseGeo(geo?: string | null): string {
  return (geo ?? '').trim().toLowerCase().replace(/[{}]/g, '');
}

function isGlobalAverage(geo?: string | null): boolean {
  const g = normaliseGeo(geo);
  return g === 'glo' || g === 'row' || g === 'global';
}

function isEuropean(geo?: string | null): boolean {
  const g = normaliseGeo(geo);
  return EU_REGIONS.has(g) || EU_COUNTRIES.has(g);
}

function sourceLabel(source_type?: SearchResult['source_type']): string {
  switch (source_type) {
    case 'primary': return 'verified supplier data';
    case 'ecoinvent_live':
    case 'ecoinvent_proxy': return 'ecoinvent';
    case 'agribalyse_live': return 'Agribalyse';
    case 'global_library': return 'our peer-reviewed library';
    case 'defra': return 'DEFRA';
    case 'staging': return 'an internal estimate';
    default: return 'database';
  }
}

/**
 * Generate the "What this covers" sentence(s) from structured fields.
 */
function buildWhatItCovers(result: SearchResult): string {
  const meta = result.metadata ?? {};
  const boundary = translateBoundary(meta.system_boundary);
  const drinksRelevance: string | undefined = meta.drinks_relevance;
  const source = sourceLabel(result.source_type);
  const unit = result.unit || 'kg';

  // Lead with the boundary if we have one, otherwise a sensible default.
  let lead: string;
  if (boundary) {
    lead = `${boundary.headline} factor from ${source} — ${boundary.summary}`;
  } else if (result.source_type === 'primary') {
    lead = `Verified supplier data covering this product as delivered to your facility.`;
  } else if (result.source_type === 'agribalyse_live') {
    lead = `Cradle-to-gate agricultural factor from Agribalyse, covering farming through to leaving the producer.`;
  } else if (result.source_type === 'ecoinvent_live' || result.source_type === 'ecoinvent_proxy') {
    lead = `Cradle-to-gate factor from ecoinvent — typically covers raw materials through to leaving the production site.`;
  } else if (result.source_type === 'defra') {
    lead = `UK government emissions factor (DEFRA) — usually a per-${unit} average for the listed activity.`;
  } else {
    lead = `Carbon-intensity estimate for one ${unit} of this material.`;
  }

  if (drinksRelevance && typeof drinksRelevance === 'string') {
    return `${lead} Most relevant for ${drinksRelevance}.`;
  }

  return lead;
}

/**
 * Generate the "Good match if…" / "Look elsewhere if…" bullets.
 *
 * Rules derive only from structured fields. Each bullet must be ≤12 words.
 */
function buildSuitabilityBullets(
  result: SearchResult,
  ctx: SuitabilityContext,
): { goodMatchIf: string[]; lookElsewhereIf: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  const meta = result.metadata ?? {};
  const geo = normaliseGeo(result.location ?? meta.geographic_scope);
  const userCountry = (ctx.userCountry ?? '').toLowerCase();
  const grade = result.data_quality_grade ?? meta.data_quality_grade;
  const isOrganic = /\borganic\b/i.test(result.name ?? '');
  const isConventional = /\bconventional\b/i.test(result.name ?? '');
  const recycledPct = result.recycled_content_pct ?? meta.recycled_content_pct;
  const temporal: string | undefined = meta.temporal_coverage;

  // ── Source-based ─────────────────────────────────────────────────────
  if (result.source_type === 'primary') {
    good.push('You buy from this exact supplier');
    bad.push('You source from a different supplier');
  } else if (result.source_type === 'global_library' && grade === 'HIGH') {
    good.push('You want vetted, peer-reviewed data');
  } else if (result.source_type === 'staging') {
    bad.push('Better-quality data is available — upgrade if you can');
  }

  // ── Geography ────────────────────────────────────────────────────────
  if (geo) {
    if (isGlobalAverage(geo)) {
      good.push('No regional factor exists for your supplier');
      bad.push('You know your supplier’s region — pick a regional factor');
    } else if (isEuropean(geo)) {
      good.push('You source from Europe or the UK');
      if (userCountry && !EU_COUNTRIES.has(userCountry)) {
        bad.push('Your supplier is outside Europe');
      }
    } else if (userCountry && geo === userCountry) {
      good.push(`You source from ${geo.toUpperCase()}`);
    } else if (userCountry && geo !== userCountry && geo.length === 2) {
      bad.push(`Your supplier is not in ${geo.toUpperCase()}`);
    }
  }

  // ── Organic / conventional ───────────────────────────────────────────
  if (isOrganic) {
    good.push('Your supplier is certified organic');
    bad.push('Your supplier uses conventional farming');
  } else if (isConventional) {
    good.push('Your supplier uses conventional farming');
    bad.push('Your supplier is certified organic');
  }

  // ── Recycled content (packaging) ─────────────────────────────────────
  if (ctx.materialType === 'packaging') {
    if (typeof recycledPct === 'number' && recycledPct > 0) {
      good.push(`Your packaging contains ~${recycledPct}% recycled content`);
      bad.push('You use virgin material with no recycled content');
    } else if (recycledPct === 0) {
      good.push('You use virgin material with no recycled content');
      bad.push('Your packaging contains recycled content');
    }
  }

  // ── Commodity / deforestation ────────────────────────────────────────
  if (result.commodity_type && result.commodity_type !== 'none' && !result.deforestation_commitment_verified) {
    bad.push('You need a deforestation-verified factor for this commodity');
  }

  // ── Temporal coverage age ────────────────────────────────────────────
  if (temporal) {
    const yearMatch = String(temporal).match(/(19|20)\d{2}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0], 10);
      const currentYear = new Date().getFullYear();
      if (currentYear - year >= 10) {
        bad.push('You need recent data — this dataset is over 10 years old');
      }
    }
  }

  // ── Data quality fallback ────────────────────────────────────────────
  if (!good.length && grade === 'HIGH') good.push('You want the best available data quality');
  if (!bad.length && grade === 'LOW') bad.push('You need higher-confidence data for compliance');

  return { goodMatchIf: dedupe(good), lookElsewhereIf: dedupe(bad) };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr)).slice(0, 4);
}

export function getMatchSuitability(
  result: SearchResult,
  ctx: SuitabilityContext = {},
): FactorSuitability {
  const whatItCovers = buildWhatItCovers(result);
  const { goodMatchIf, lookElsewhereIf } = buildSuitabilityBullets(result, ctx);
  return { whatItCovers, goodMatchIf, lookElsewhereIf };
}
