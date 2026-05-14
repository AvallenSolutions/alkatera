import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateCompleteness } from './completeness-calculator';
import { calculateVitality, type FieldValue } from './vitality-calculator';
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
  brand_profile_id: string;
  completeness: number;
  vitality: number;
  vitality_tier: string;
  fields_populated: number;
  fields_total: number;
}

/**
 * Recompute completeness and vitality for a single brand, persist a
 * snapshot row, and mirror the headline scores onto brand_profiles for
 * cheap reads from the brand list / dashboard.
 *
 * Pipeline:
 *   1. Read every "active" scraped_brand_data row (superseded_by is null).
 *      For completeness we only need the field keys; for vitality we
 *      need the full value (to grade against benchmarks).
 *   2. When multiple sources have the same field_key (e.g. alkatera_live
 *      overlaid on a Wikipedia finding), prefer the highest-confidence
 *      row — same precedence the data merger uses for display.
 *   3. Run both calculators.
 *   4. Insert one brand_completeness_snapshots row (now also carrying
 *      vitality_score + vitality_tier).
 *   5. Mirror brand_profiles.{completeness_score, sustainability_score,
 *      score_tier}.
 */
export async function recalculateCompleteness(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<RecalcResult | null> {
  const { data: brand } = await supabase
    .from('brand_profiles')
    .select('id, distributor_org_id')
    .eq('id', brandProfileId)
    .maybeSingle();
  if (!brand) return null;
  const distributorOrgId = (brand as { distributor_org_id: string }).distributor_org_id;

  // Fetch the full active row set so we can grade values, not just count keys.
  const { data: rows } = await supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, field_value_numeric, confidence')
    .eq('brand_profile_id', brandProfileId)
    .is('superseded_by', null);

  type Row = {
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    confidence: number;
  };
  const all = (rows ?? []) as Row[];

  // Highest-confidence winner per field_key (matches the display layer).
  const bestByKey = new Map<FieldKey, Row>();
  for (const row of all) {
    const existing = bestByKey.get(row.field_key as FieldKey);
    if (!existing || row.confidence > existing.confidence) {
      bestByKey.set(row.field_key as FieldKey, row);
    }
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
    });
  }
  const vitality = calculateVitality(valuesForVitality);

  const snapshotRow: Record<string, unknown> = {
    brand_profile_id: brandProfileId,
    distributor_org_id: distributorOrgId,
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

  await supabase
    .from('brand_profiles')
    .update({
      completeness_score: completeness.overall,
      sustainability_score: vitality.overall,
      score_tier: vitality.tier,
      score_updated_at: new Date().toISOString(),
    })
    .eq('id', brandProfileId);

  return {
    brand_profile_id: brandProfileId,
    completeness: completeness.overall,
    vitality: vitality.overall,
    vitality_tier: vitality.tier,
    fields_populated: completeness.fields_populated,
    fields_total: completeness.fields_total,
  };
}

/**
 * Recompute completeness + vitality for every brand in a distributor
 * org. Used by the manual recalculate route.
 */
export async function recalculateOrg(
  supabase: SupabaseClient,
  distributorOrgId: string,
): Promise<{ updated: number }> {
  const { data: brands } = await supabase
    .from('brand_profiles')
    .select('id')
    .eq('distributor_org_id', distributorOrgId);
  let updated = 0;
  for (const row of (brands ?? []) as Array<{ id: string }>) {
    const result = await recalculateCompleteness(supabase, row.id);
    if (result) updated += 1;
  }
  return { updated };
}
