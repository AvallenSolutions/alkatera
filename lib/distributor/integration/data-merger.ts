import type { SupabaseClient } from '@supabase/supabase-js';
import type { FieldKey } from '../scraping/field-definitions';

export interface MergedFieldRow {
  field_key: FieldKey;
  field_value: string | null;
  field_value_numeric: number | null;
  source: string;
  confidence: number;
  scraped_at: string;
}

/**
 * Read brand data for the distributor view, honouring sharing flags
 * and per-field privacy preferences. Wraps the get_brand_data_for_distributor
 * SQL RPC.
 *
 * When the Phase 6 migration hasn't been applied yet, the RPC won't
 * exist — we fall back to a plain scraped_brand_data read so the rest
 * of the platform keeps working.
 */
export async function readMergedBrandData(
  supabase: SupabaseClient,
  brandProfileId: string,
  distributorOrgId: string,
): Promise<MergedFieldRow[]> {
  try {
    const { data, error } = await supabase.rpc('get_brand_data_for_distributor', {
      p_brand_profile_id: brandProfileId,
      p_distributor_org_id: distributorOrgId,
    });
    if (!error && Array.isArray(data)) {
      return data as MergedFieldRow[];
    }
  } catch {
    // RPC absent — fall through to legacy read.
  }

  const { data: rows } = await supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, field_value_numeric, source_name, confidence, scraped_at')
    .eq('brand_profile_id', brandProfileId)
    .is('superseded_by', null);
  return ((rows ?? []) as Array<{
    field_key: string;
    field_value: string | null;
    field_value_numeric: number | null;
    source_name: string;
    confidence: number;
    scraped_at: string;
  }>).map((r) => ({
    field_key: r.field_key as FieldKey,
    field_value: r.field_value,
    field_value_numeric: r.field_value_numeric,
    source: r.source_name,
    confidence: r.confidence,
    scraped_at: r.scraped_at,
  }));
}

/**
 * Collapse merged rows down to one "active" value per field — used by
 * the brand-detail Data tab and the public review portal.
 *
 * Precedence:
 *   1. brand_verified  — the brand itself ticked "looks right" or
 *      corrected our value via the /brand-upload review page. Always
 *      wins; it's the ground truth.
 *   2. alkatera_live  — the brand has joined alkatera and confirmed
 *      sharing with this distributor. The platform owns the data.
 *   3. Highest-confidence scraped/uploaded finding.
 */
export function pickActivePerField(rows: MergedFieldRow[]): Map<FieldKey, MergedFieldRow> {
  const byField = new Map<FieldKey, MergedFieldRow>();
  for (const row of rows) {
    const existing = byField.get(row.field_key);
    if (!existing) {
      byField.set(row.field_key, row);
      continue;
    }
    if (row.source === 'brand_verified' && existing.source !== 'brand_verified') {
      byField.set(row.field_key, row);
      continue;
    }
    if (existing.source === 'brand_verified') continue;
    if (row.source === 'alkatera_live' && existing.source !== 'alkatera_live') {
      byField.set(row.field_key, row);
      continue;
    }
    if (existing.source === 'alkatera_live') continue;
    if (row.confidence > existing.confidence) {
      byField.set(row.field_key, row);
    }
  }
  return byField;
}
