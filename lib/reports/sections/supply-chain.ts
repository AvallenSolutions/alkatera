/**
 * Supply chain report section fetcher.
 *
 * House pattern (lib/provenance/rollup.ts): `gatherSupplyChain` does ONLY
 * I/O — no auth, the caller passes an already-scoped Supabase client — and
 * `mapSupplyChain` is the pure, unit-testable half.
 *
 * YEAR POLICY: none for the roster — the report shows the CURRENT supplier
 * roster (organization_suppliers joined to platform_suppliers, exactly what
 * the /suppliers page shows), footnoted as such on the page. The year only
 * scopes `emissionsData`: a supplier counts as having shared data when a
 * supplier_data_submissions row overlaps the report year.
 *
 * Renames per the report contract: platform_suppliers.industry_sector →
 * category (no category column exists).
 *
 * SCHEMA MISMATCH, handled here: supplier_data_submissions.supplier_id
 * references the legacy per-org `suppliers` table, not platform_suppliers,
 * and no FK links the two rosters. The join is by case-insensitive name
 * within the org — imperfect, but the only bridge that exists, and a miss
 * degrades to "no data shared" (emissionsData = {}), never to a false claim
 * of sharing.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupplierData } from './types';

// ============================================================================
// Raw row shapes (only the columns the mapper reads)
// ============================================================================

export interface RosterSupplierRow {
  /** platform_suppliers.name via the organization_suppliers join. */
  name: string | null;
  industry_sector: string | null;
}

export interface LegacySupplierRow {
  id: string;
  name: string | null;
}

export interface SupplierSubmissionRow {
  /** FK to the legacy `suppliers` table. */
  supplier_id: string | null;
  submission_date: string | null;
  total_utility_entries: number | null;
  total_water_entries: number | null;
  total_waste_entries: number | null;
  total_facility_production_volume: number | null;
}

export interface SupplyChainRaw {
  roster: RosterSupplierRow[];
  legacySuppliers: LegacySupplierRow[];
  /** Already scoped to submissions overlapping the report year. */
  submissions: SupplierSubmissionRow[];
}

// ============================================================================
// Pure mapper
// ============================================================================

const normaliseName = (name: string) => name.trim().toLowerCase();

export function mapSupplyChain(raw: SupplyChainRaw): SupplierData[] {
  // legacy supplier id -> its submissions for the year
  const submissionsBySupplierId = new Map<string, SupplierSubmissionRow[]>();
  for (const sub of raw.submissions) {
    if (!sub.supplier_id) continue;
    const list = submissionsBySupplierId.get(sub.supplier_id) ?? [];
    list.push(sub);
    submissionsBySupplierId.set(sub.supplier_id, list);
  }

  // normalised legacy name -> submissions (the name bridge)
  const submissionsByName = new Map<string, SupplierSubmissionRow[]>();
  for (const legacy of raw.legacySuppliers) {
    if (!legacy.name) continue;
    const subs = submissionsBySupplierId.get(legacy.id);
    if (!subs || subs.length === 0) continue;
    const key = normaliseName(legacy.name);
    submissionsByName.set(key, [...(submissionsByName.get(key) ?? []), ...subs]);
  }

  return raw.roster
    .filter((s) => !!s.name)
    .map((s) => {
      const subs = submissionsByName.get(normaliseName(s.name!)) ?? [];
      let emissionsData: Record<string, any> = {};
      if (subs.length > 0) {
        const latest = [...subs].sort((a, b) =>
          (b.submission_date ?? '').localeCompare(a.submission_date ?? ''),
        )[0];
        emissionsData = {
          submissions: subs.length,
          latestSubmissionDate: latest.submission_date ?? null,
          utilityEntries: subs.reduce((n, x) => n + (x.total_utility_entries || 0), 0),
          waterEntries: subs.reduce((n, x) => n + (x.total_water_entries || 0), 0),
          wasteEntries: subs.reduce((n, x) => n + (x.total_waste_entries || 0), 0),
        };
      }
      return {
        name: s.name!,
        category: s.industry_sector ?? 'Uncategorised',
        emissionsData,
      };
    });
}

// ============================================================================
// Gather (I/O only)
// ============================================================================

export async function gatherSupplyChain(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<SupplierData[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [roster, legacySuppliers, submissions] = await Promise.all([
    supabase
      .from('organization_suppliers')
      .select('platform_suppliers ( name, industry_sector )')
      .eq('organization_id', organizationId),
    supabase
      .from('suppliers')
      .select('id, name')
      .eq('organization_id', organizationId),
    // Period-overlap with the report year: starts before the year ends AND
    // ends after the year starts.
    supabase
      .from('supplier_data_submissions')
      .select(
        'supplier_id, submission_date, total_utility_entries, total_water_entries, total_waste_entries, total_facility_production_volume',
      )
      .eq('organization_id', organizationId)
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart),
  ]);

  for (const res of [roster, legacySuppliers, submissions]) {
    if (res.error) throw new Error(`gatherSupplyChain: ${res.error.message}`);
  }

  // The many-to-one join comes back as a nested object (or null when the
  // platform supplier has been deleted); flatten it to the raw row shape.
  const rosterRows: RosterSupplierRow[] = ((roster.data ?? []) as any[]).map((row) => {
    const ps = Array.isArray(row.platform_suppliers)
      ? row.platform_suppliers[0]
      : row.platform_suppliers;
    return {
      name: ps?.name ?? null,
      industry_sector: ps?.industry_sector ?? null,
    };
  });

  return mapSupplyChain({
    roster: rosterRows,
    legacySuppliers: (legacySuppliers.data ?? []) as LegacySupplierRow[],
    submissions: (submissions.data ?? []) as SupplierSubmissionRow[],
  });
}
