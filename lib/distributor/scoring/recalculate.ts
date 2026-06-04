import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCompleteness } from './completeness-calculator';
import { calculateVitality, type FieldValue, type ScoreTier } from './vitality-calculator';
import { calculateScrapedVitality } from './scraped-vitality';
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
    .select('id, alkatera_org_id')
    .eq('id', brandDirectoryId)
    .maybeSingle();
  if (!directory) return null;
  const scoringMode = (directory as { alkatera_org_id: string | null }).alkatera_org_id
    ? 'alkatera'
    : 'scraped';

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
  // alka**tera** brands also feed the latest ESG composite into the
  // scorer when present — captures alka**tera**'s on-platform pillar
  // calculation the field-level model can't fully replicate.
  let esgComposite: number | null = null;
  if (scoringMode === 'alkatera') {
    const { data: directoryWithOrg } = await supabase
      .from('brand_directory')
      .select('alkatera_org_id')
      .eq('id', brandDirectoryId)
      .maybeSingle();
    const orgId = (directoryWithOrg as { alkatera_org_id: string | null } | null)?.alkatera_org_id;
    if (orgId) {
      const { data: latestSnapshot } = await supabase
        .from('esg_score_snapshots')
        .select('composite')
        .eq('organization_id', orgId)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      const composite = (latestSnapshot as { composite: number | null } | null)?.composite;
      if (typeof composite === 'number' && Number.isFinite(composite)) esgComposite = composite;
    }
  }

  // Score by the friendlier of the two calculators — monotone-merge
  // guarantee. Joining alka**tera** must NEVER drop a brand's
  // distributor-visible score; it can only raise or hold.
  //
  // The two calculators measure the same evidence differently:
  //   - scraped (3-pillar signal-count): a small number of leadership
  //     signals firing is enough to clear Leader. Friendly to brands
  //     with great certifications but sparse quantitative data.
  //   - alka**tera** (6-pillar credit-based): rewards platform-
  //     verified rows with a 1.25× weight bonus and folds in the
  //     ESG composite as a heavy Governance signal. Better when the
  //     platform has comprehensive coverage.
  //
  // We run BOTH for alka**tera**-linked brands and take the higher.
  // For unlinked brands the alkatera calculator is meaningless
  // (no composite, no verified-source bonus to capture) so we just
  // use scraped. Either way the brand can never be punished for the
  // alka**tera** path producing a lower number on partial data.
  const scrapedVitality = calculateScrapedVitality(valuesForVitality);
  const alkateraVitality =
    scoringMode === 'alkatera'
      ? calculateVitality(valuesForVitality, { esgComposite })
      : null;
  const vitality: { overall: number; tier: ScoreTier } =
    alkateraVitality && alkateraVitality.overall > scrapedVitality.overall
      ? alkateraVitality
      : scrapedVitality;

  const snapshotRow: Record<string, unknown> = {
    brand_directory_id: brandDirectoryId,
    completeness_score: completeness.overall,
    fields_populated: completeness.fields_populated,
    fields_total: completeness.fields_total,
    vitality_score: vitality.overall,
    vitality_tier: vitality.tier,
  };
  for (const [pillar, column] of Object.entries(PILLAR_COLUMN)) {
    const value = completeness.by_pillar[pillar as Pillar];
    if (typeof value === 'number') snapshotRow[column] = value;
  }
  await supabase.from('brand_completeness_snapshots').insert(snapshotRow);

  // If the brand has zero findings, the vitality calculator still
  // returns a non-zero "missing fields" floor (~8/100) which renders
  // as a misleading score on the Discover page. Treat "no findings"
  // as "no score" — null — so consumers fall back to a dash.
  const hasAnyFindings = completeness.fields_populated > 0;
  await supabase
    .from('brand_directory')
    .update({
      completeness_score: completeness.overall,
      sustainability_score: hasAnyFindings ? vitality.overall : null,
      score_tier: hasAnyFindings ? vitality.tier : null,
      scoring_mode: scoringMode,
      score_updated_at: new Date().toISOString(),
    })
    .eq('id', brandDirectoryId);

  return {
    brand_directory_id: brandDirectoryId,
    completeness: completeness.overall,
    vitality: vitality.overall,
    vitality_tier: vitality.tier,
    fields_populated: completeness.fields_populated,
    fields_total: completeness.fields_total,
  };
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
