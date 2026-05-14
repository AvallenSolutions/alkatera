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
 * Read the canonical sustainability data for a brand directory entry,
 * gated by the calling distributor's sharing relationship with the
 * brand. Wraps the get_brand_data_for_distributor SQL RPC.
 *
 * After Phase 3 the underlying findings hang off `brand_directory_id`,
 * so two distributors that list the same brand both see the same
 * picture. The `distributorOrgId` argument still matters: it gates the
 * `alkatera_live` overlay (which respects per-distributor sharing
 * preferences via `brand_distributor_links` + `brand_sharing_preferences`).
 */
export async function readMergedBrandData(
  supabase: SupabaseClient,
  brandDirectoryId: string,
  distributorOrgId: string,
): Promise<MergedFieldRow[]> {
  const { data, error } = await supabase.rpc('get_brand_data_for_distributor', {
    p_brand_directory_id: brandDirectoryId,
    p_distributor_org_id: distributorOrgId,
  });
  if (!error && Array.isArray(data)) {
    return (data as Array<{
      field_key: string;
      field_value: string | null;
      field_value_numeric: number | null;
      source: string;
      confidence: number;
      scraped_at: string;
    }>).map((r) => ({
      field_key: r.field_key as FieldKey,
      field_value: r.field_value,
      field_value_numeric: r.field_value_numeric,
      source: r.source,
      confidence: r.confidence,
      scraped_at: r.scraped_at,
    }));
  }

  // RPC absent or errored — fall back to a plain directory-scoped read
  // so the caller still gets the base layer.
  const { data: rows } = await supabase
    .from('scraped_brand_data')
    .select('field_key, field_value, field_value_numeric, source_name, confidence, scraped_at')
    .eq('brand_directory_id', brandDirectoryId)
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
 * Resolve a brand_profile (listing) id to its brand_directory_id.
 * Returns null if the listing doesn't exist in the caller's RLS scope.
 *
 * Phase 3 split data-bearing tables onto brand_directory_id while
 * leaving URLs / per-distributor state on brand_profile_id. Most
 * callers still have a brand_profile_id at hand and need this
 * resolution before reading findings or computing scores.
 */
export async function resolveBrandDirectoryId(
  supabase: SupabaseClient,
  brandProfileId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('brand_profiles')
    .select('brand_directory_id')
    .eq('id', brandProfileId)
    .maybeSingle();
  return (data as { brand_directory_id: string } | null)?.brand_directory_id ?? null;
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
