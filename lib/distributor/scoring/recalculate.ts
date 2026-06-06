import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCompleteness } from './completeness-calculator';
import {
  scoreFromScrapedFields,
  scoreFromAlkateraComposite,
  type FieldValue,
  type UnifiedScoreResult,
  type CategoryConfidence,
} from './pillar-scorer';
import { detectBrandCategory } from './category-detector';
import { isKnownCategory, inferCategoryFromText } from '@/lib/industry-benchmarks';
import type { VitalityComposite } from '@/lib/vitality/composite';
import type { FieldKey, Pillar } from '../scraping/field-definitions';

const PILLAR_COLUMN: Record<Pillar, string> = {
  carbon: 'carbon_completeness',
  water: 'water_completeness',
  packaging: 'packaging_completeness',
  agriculture: 'agriculture_completeness',
  governance: 'governance_completeness',
  corporate: 'corporate_completeness',
};

export interface RecalcResult {
  brand_directory_id: string;
  completeness: number;
  vitality: number;
  vitality_tier: string;
  fields_populated: number;
  fields_total: number;
}

/**
 * Recompute completeness and vitality for a single canonical brand,
 * persist a snapshot row, and mirror the headline scores onto
 * brand_directory so the brand list / dashboard can read them without
 * touching the snapshot table.
 *
 * Pipeline:
 *   1. Read every "active" scraped_brand_data row (superseded_by is null)
 *      for the directory. The findings already canonicalise across
 *      every listing of the brand — that's the whole point of Phase 3.
 *   2. When multiple sources have the same field_key (e.g. alkatera_live
 *      overlaid on a Wikipedia finding), prefer the highest-confidence
 *      row — same precedence the data merger uses for display.
 *   3. Run both calculators.
 *   4. Insert one brand_completeness_snapshots row (now also carrying
 *      vitality_score + vitality_tier).
 *   5. Mirror brand_directory.{completeness_score, sustainability_score,
 *      score_tier, score_updated_at}.
 */
export async function recalculateCompleteness(
  supabase: SupabaseClient,
  brandDirectoryId: string,
): Promise<RecalcResult | null> {
  const { data: directory } = await supabase
    .from('brand_directory')
    .select('id, alkatera_org_id, name, category, category_source, country_of_origin')
    .eq('id', brandDirectoryId)
    .maybeSingle();
  if (!directory) return null;
  const dir = directory as {
    alkatera_org_id: string | null;
    name: string | null;
    category: string | null;
    category_source: 'declared' | 'detected' | 'default' | null;
    country_of_origin: string | null;
  };
  const scoringMode: 'alkatera' | 'scraped' = dir.alkatera_org_id ? 'alkatera' : 'scraped';

  // Fetch the full active row set so we can grade values, not just count keys.
  const { data: rows } = await supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, field_value_numeric, source_name, confidence')
    .eq('brand_directory_id', brandDirectoryId)
    .is('superseded_by', null);

  type Row = {
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
  };
  const all = (rows ?? []) as Row[];

  // Pick the active row per field using the same precedence as the
  // data-merger (brand_verified > alkatera_live > highest confidence)
  // so the persisted score and the on-page breakdown agree on which
  // source is the canonical one. Provenance matters for the alka**tera**
  // scorer's verified-source bonus.
  const bestByKey = new Map<FieldKey, Row>();
  for (const row of all) {
    const key = row.field_key as FieldKey;
    const existing = bestByKey.get(key);
    if (!existing) {
      bestByKey.set(key, row);
      continue;
    }
    if (row.source_name === 'brand_verified' && existing.source_name !== 'brand_verified') {
      bestByKey.set(key, row);
      continue;
    }
    if (existing.source_name === 'brand_verified') continue;
    if (row.source_name === 'alkatera_live' && existing.source_name !== 'alkatera_live') {
      bestByKey.set(key, row);
      continue;
    }
    if (existing.source_name === 'alkatera_live') continue;
    if (row.confidence > existing.confidence) bestByKey.set(key, row);
  }

  const fieldKeys = Array.from(bestByKey.keys());
  const completeness = calculateCompleteness(fieldKeys);

  const valuesForVitality = new Map<FieldKey, FieldValue>();
  for (const [key, row] of Array.from(bestByKey.entries())) {
    if (row.field_value === null) continue;
    valuesForVitality.set(key, {
      field_key: key,
      text: row.field_value,
      numeric: row.field_value_numeric,
      source: row.source_name,
    });
  }

  // Resolve the brand's product category — declared → SKU-derived →
  // AI-detected → industry default. The category drives the
  // category-adjusted carbon / water benchmarks in the scorer. Only
  // spend an LLM detection call on scraped brands; alka**tera** brands
  // score from their on-platform composite, where category is irrelevant.
  const cat = await resolveCategory(
    supabase,
    brandDirectoryId,
    dir.category,
    dir.category_source,
    dir.name ?? '',
    valuesForVitality,
    scoringMode === 'scraped',
  );

  // Dispatch onto the single unified scale. alka**tera**-linked brands
  // pass their real on-platform per-pillar scores through; everything
  // else is estimated from the scraped / brand-verified fields. Both
  // land on the same pillars, scale and tier bands.
  let result: UnifiedScoreResult;
  if (scoringMode === 'alkatera') {
    const composite = await loadAlkateraComposite(supabase, dir.alkatera_org_id as string);
    result = composite
      ? scoreFromAlkateraComposite(composite)
      : scoreFromScrapedFields(valuesForVitality, {
          category: cat.category,
          categoryConfidence: cat.confidence,
        });
  } else {
    result = scoreFromScrapedFields(valuesForVitality, {
      category: cat.category,
      categoryConfidence: cat.confidence,
    });
  }

  // A brand with zero scraped findings has no estimable score (the
  // pillar scorer floors to 0/insufficient) — persist null so the UI
  // shows a dash, not a misleading floor. An alka**tera** brand scored
  // from its composite keeps its score even with few local findings.
  const scoredFromComposite = result.evidence.source === 'alkatera';
  const persistScore =
    completeness.fields_populated > 0 || (scoredFromComposite && result.overall > 0);

  const snapshotRow: Record<string, unknown> = {
    brand_directory_id: brandDirectoryId,
    completeness_score: completeness.overall,
    fields_populated: completeness.fields_populated,
    fields_total: completeness.fields_total,
    vitality_score: persistScore ? result.overall : null,
    vitality_tier: persistScore ? result.tier : null,
    climate_score: result.by_pillar.climate,
    nature_score: result.by_pillar.nature,
    water_score: result.by_pillar.water,
    circularity_score: result.by_pillar.circularity,
    social_score: result.by_pillar.social,
    governance_score: result.by_pillar.governance,
    environment_score: result.environment,
    score_confidence: persistScore ? result.confidence : null,
    category_confidence: cat.confidence,
  };
  // Legacy per-pillar *completeness* columns (the 6-pillar coverage
  // model) stay on the snapshot, untouched, alongside the new vitality
  // pillar scores.
  for (const [pillar, column] of Object.entries(PILLAR_COLUMN)) {
    const value = completeness.by_pillar[pillar as Pillar];
    if (typeof value === 'number') snapshotRow[column] = value;
  }
  await supabase.from('brand_completeness_snapshots').insert(snapshotRow);

  const update: Record<string, unknown> = {
    completeness_score: completeness.overall,
    sustainability_score: persistScore ? result.overall : null,
    score_tier: persistScore ? result.tier : null,
    scoring_mode: scoringMode,
    score_confidence: persistScore ? result.confidence : null,
    category_source: cat.dbSource,
    score_updated_at: new Date().toISOString(),
  };
  if (cat.category) update.category = cat.category;

  // Mirror a scraped country onto the canonical row so the brand detail
  // "Key details" and the directory list can read it directly (they
  // don't all walk the scraped_brand_data fallback). Prefer an explicit
  // country_of_origin finding, fall back to the corporate hq_country
  // finding. Only fill when the directory doesn't already carry a
  // (curated / declared) value — never overwrite a human-set country.
  if (!dir.country_of_origin) {
    const scrapedCountry =
      valuesForVitality.get('country_of_origin' as FieldKey)?.text?.trim() ||
      valuesForVitality.get('hq_country' as FieldKey)?.text?.trim() ||
      null;
    if (scrapedCountry) update.country_of_origin = scrapedCountry;
  }

  await supabase.from('brand_directory').update(update).eq('id', brandDirectoryId);

  return {
    brand_directory_id: brandDirectoryId,
    completeness: completeness.overall,
    vitality: result.overall,
    vitality_tier: result.tier,
    fields_populated: completeness.fields_populated,
    fields_total: completeness.fields_total,
  };
}

/**
 * Load the brand's most recent on-platform ESG composite (the full
 * VitalityComposite with per-pillar breakdown) from esg_score_snapshots.
 * Returns null when there's no snapshot or no composite_json (older
 * snapshots stored only the scalar composite).
 */
async function loadAlkateraComposite(
  supabase: SupabaseClient,
  orgId: string,
): Promise<VitalityComposite | null> {
  const { data } = await supabase
    .from('esg_score_snapshots')
    .select('composite_json')
    .eq('organization_id', orgId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const raw = (data as { composite_json: unknown } | null)?.composite_json;
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object' && 'e' in (parsed as Record<string, unknown>)) {
      return parsed as VitalityComposite;
    }
    return null;
  } catch {
    return null;
  }
}

interface ResolvedCategory {
  category: string | null;
  /** Value to persist on brand_directory.category_source. */
  dbSource: 'declared' | 'detected' | 'default';
  /** Value the scorer + snapshot use. */
  confidence: CategoryConfidence;
}

/**
 * Resolve a brand's product category, cheapest source first:
 *   1. declared on the directory entry,
 *   2. declared on any of its distributor listings / SKUs,
 *   3. AI-detected from the brand description + SKU names,
 *   4. industry default (no category).
 */
async function resolveCategory(
  supabase: SupabaseClient,
  brandDirectoryId: string,
  declared: string | null,
  declaredSource: 'declared' | 'detected' | 'default' | null,
  brandName: string,
  values: Map<FieldKey, FieldValue>,
  allowDetect: boolean,
): Promise<ResolvedCategory> {
  // Only honour the directory's own category when it was genuinely
  // declared (curated / imported), NOT when a previous recalc auto-set
  // it. If we trusted any existing value, an inferred category would be
  // read back as "declared" on the next run — masquerading as human data
  // and, worse, freezing it so improved inference rules could never
  // update it. Re-deriving below keeps auto categories both honestly
  // labelled ('detected') and re-derivable.
  if (declared && declared.trim() && declaredSource === 'declared') {
    return { category: declared.trim(), dbSource: 'declared', confidence: 'declared' };
  }

  const { data: profiles } = await supabase
    .from('brand_profiles')
    .select('id, category')
    .eq('brand_directory_id', brandDirectoryId);
  const profileRows = (profiles ?? []) as Array<{ id: string; category: string | null }>;
  const fromProfiles = mostCommonKnown(profileRows.map((p) => p.category));
  if (fromProfiles) return { category: fromProfiles, dbSource: 'declared', confidence: 'declared' };

  let skuNames: string[] = [];
  const profileIds = profileRows.map((p) => p.id);
  if (profileIds.length > 0) {
    const { data: skus } = await supabase
      .from('brand_skus')
      .select('category, product_name')
      .in('brand_profile_id', profileIds);
    const skuRows = (skus ?? []) as Array<{ category: string | null; product_name: string | null }>;
    const fromSkus = mostCommonKnown(skuRows.map((s) => s.category));
    if (fromSkus) return { category: fromSkus, dbSource: 'declared', confidence: 'declared' };
    skuNames = skuRows
      .map((s) => s.product_name)
      .filter((n): n is string => !!n && n.trim().length > 0)
      .slice(0, 20);
  }

  // A category the brand-website scraper read directly off the site
  // (the LLM extractor's product_category field). High-signal — the page
  // almost always states the product type — so we trust it for display.
  // Known categories also drive the category-adjusted benchmark; an
  // accurate-but-unrecognised label (rare) still shows to the user but
  // scores against the industry default.
  const scrapedCategory = values.get('product_category' as FieldKey)?.text?.trim();
  if (scrapedCategory) {
    return {
      category: scrapedCategory,
      dbSource: 'detected',
      confidence: isKnownCategory(scrapedCategory) ? 'detected' : 'industry_default',
    };
  }

  // Deterministic inference from the brand name + SKU/product names.
  // Drinks products almost always name their type in plain text
  // ("Arcane Rhum", "X Single Malt", "Y London Dry Gin"), so this
  // resolves most of the catalogue with zero LLM calls and — crucially —
  // works on data we already hold, so a plain rescore backfills category
  // for brands whose website scrape captured nothing. Runs before the LLM
  // detector because it's both more reliable here and free.
  const inferred = inferCategoryFromText([brandName, ...skuNames].join(' '));
  if (inferred) {
    return { category: inferred, dbSource: 'detected', confidence: 'detected' };
  }

  if (allowDetect) {
    const description = values.get('company_description' as FieldKey)?.text ?? null;
    try {
      const det = await detectBrandCategory({ brandName, description, skuNames });
      if (det.category) {
        return { category: det.category, dbSource: 'detected', confidence: 'detected' };
      }
    } catch {
      /* detection is best-effort — fall through to default */
    }
  }

  return { category: null, dbSource: 'default', confidence: 'industry_default' };
}

/** Most common recognised category in a list, or null if none recognised. */
function mostCommonKnown(cats: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const c of cats) {
    if (c && isKnownCategory(c)) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let top: string | null = null;
  let max = 0;
  for (const [c, n] of Array.from(counts.entries())) {
    if (n > max) {
      max = n;
      top = c;
    }
  }
  return top;
}

/**
 * Recompute completeness + vitality for every brand in a distributor
 * org. Dedupes by brand_directory_id so we don't recompute the same
 * canonical brand twice when two listings of the same directory entry
 * exist within one org (rare but possible).
 */
export async function recalculateOrg(
  supabase: SupabaseClient,
  distributorOrgId: string,
): Promise<{ updated: number }> {
  const { data: brands } = await supabase
    .from('brand_profiles')
    .select('brand_directory_id')
    .eq('distributor_org_id', distributorOrgId);

  const seen = new Set<string>();
  for (const row of (brands ?? []) as Array<{ brand_directory_id: string }>) {
    if (row.brand_directory_id) seen.add(row.brand_directory_id);
  }

  let updated = 0;
  for (const directoryId of Array.from(seen)) {
    const result = await recalculateCompleteness(supabase, directoryId);
    if (result) updated += 1;
  }
  return { updated };
}
