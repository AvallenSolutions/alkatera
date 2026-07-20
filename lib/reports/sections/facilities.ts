/**
 * Facilities report section fetcher.
 *
 * House pattern (lib/provenance/rollup.ts): `gatherFacilities` does ONLY
 * I/O — no auth, the caller passes an already-scoped Supabase client — and
 * `mapFacilities` is the pure, unit-testable half.
 *
 * YEAR POLICY: period overlap. facility_emissions_aggregated and
 * facility_production_volumes rows count towards the report year when their
 * reporting period overlaps it (starts before the year ends AND ends after
 * it starts) — facility periods rarely align to calendar years, and strict
 * containment would silently drop a Jul-Jun reporting period.
 *
 * UNITS — the highest-consequence conversion in the report:
 * facility_emissions_aggregated.total_co2e is stored in KG (the column
 * default is 'kg CO₂e') while FacilityInfo.totalEmissions and every other
 * figure in the renderer is TONNES. The kg→tonnes divide is GUARDED on the
 * row's unit column via `toTonnes`: only rows whose unit says kg are divided
 * by 1000; rows already in tonnes pass through. Getting this wrong publishes
 * a single site at 1000× the whole company.
 *
 * An unmeasured facility keeps totalEmissions/unitsProduced null and
 * hasData false — never a fabricated 0.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FacilityInfo } from './types';

// ============================================================================
// Raw row shapes (only the columns the mapper reads)
// ============================================================================

export interface FacilityRow {
  id: string;
  name: string | null;
  /** facility_types.name via the facility_type_id join. */
  type_name: string | null;
  location: string | null;
  address_city: string | null;
  address_country: string | null;
  location_city: string | null;
  location_country_code: string | null;
}

export interface FacilityEmissionsRow {
  facility_id: string | null;
  total_co2e: number | null;
  /** e.g. 'kg CO₂e' (the DB default) or a tonnes label. */
  unit: string | null;
}

export interface FacilityProductionRow {
  facility_id: string | null;
  production_volume: number | null;
}

export interface FacilitiesRaw {
  facilities: FacilityRow[];
  /** Already scoped to periods overlapping the report year. */
  emissions: FacilityEmissionsRow[];
  /** Already scoped to periods overlapping the report year. */
  production: FacilityProductionRow[];
}

// ============================================================================
// Pure mapper
// ============================================================================

/**
 * Convert a facility emissions value to TONNES, guarded on the unit column:
 * - unit says kg ("kg", "kg CO₂e", "kgCO2e", ...) → divide by 1000;
 * - unit says tonnes ("t", "tonnes", "tCO2e", ...) → pass through;
 * - unit missing → treat as kg (the column is NOT NULL with a kg default,
 *   and the source pipeline writes kg — documented in types.ts);
 * - anything else → pass through unchanged rather than guess.
 */
export function toTonnes(value: number, unit: string | null | undefined): number {
  const u = (unit ?? '').trim().toLowerCase();
  if (u === '' || u.startsWith('kg')) return value / 1000;
  if (u.startsWith('t')) return value;
  return value;
}

function facilityLocation(f: FacilityRow): string {
  if (f.location) return f.location;
  const parts = [
    f.address_city ?? f.location_city,
    f.address_country ?? f.location_country_code,
  ].filter((p): p is string => !!p);
  return parts.join(', ');
}

export function mapFacilities(raw: FacilitiesRaw): FacilityInfo[] {
  const emissionsByFacility = new Map<string, FacilityEmissionsRow[]>();
  for (const row of raw.emissions) {
    if (!row.facility_id) continue;
    const list = emissionsByFacility.get(row.facility_id) ?? [];
    list.push(row);
    emissionsByFacility.set(row.facility_id, list);
  }

  const productionByFacility = new Map<string, number>();
  const productionSeen = new Set<string>();
  for (const row of raw.production) {
    if (!row.facility_id) continue;
    productionSeen.add(row.facility_id);
    productionByFacility.set(
      row.facility_id,
      (productionByFacility.get(row.facility_id) ?? 0) + (row.production_volume || 0),
    );
  }

  return raw.facilities.map((f) => {
    const emissionRows = (emissionsByFacility.get(f.id) ?? []).filter(
      (e) => e.total_co2e != null,
    );
    const totalEmissions =
      emissionRows.length > 0
        ? Math.round(
            emissionRows.reduce((sum, e) => sum + toTonnes(e.total_co2e!, e.unit), 0) *
              1000,
          ) / 1000
        : null;
    const unitsProduced = productionSeen.has(f.id)
      ? productionByFacility.get(f.id) ?? null
      : null;

    return {
      name: f.name ?? '',
      type: f.type_name ?? 'Unspecified',
      location: facilityLocation(f),
      totalEmissions,
      unitsProduced,
      hasData: emissionRows.length > 0,
    };
  });
}

// ============================================================================
// Gather (I/O only)
// ============================================================================

export async function gatherFacilities(
  supabase: SupabaseClient,
  organizationId: string,
  year: number,
): Promise<FacilityInfo[]> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [facilities, emissions, production] = await Promise.all([
    supabase
      .from('facilities')
      .select(
        'id, name, location, address_city, address_country, location_city, location_country_code, facility_types ( name )',
      )
      .eq('organization_id', organizationId),
    supabase
      .from('facility_emissions_aggregated')
      .select('facility_id, total_co2e, unit')
      .eq('organization_id', organizationId)
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart),
    supabase
      .from('facility_production_volumes')
      .select('facility_id, production_volume')
      .eq('organization_id', organizationId)
      .lte('reporting_period_start', yearEnd)
      .gte('reporting_period_end', yearStart),
  ]);

  for (const res of [facilities, emissions, production]) {
    if (res.error) throw new Error(`gatherFacilities: ${res.error.message}`);
  }

  const facilityRows: FacilityRow[] = ((facilities.data ?? []) as any[]).map((row) => {
    const ft = Array.isArray(row.facility_types)
      ? row.facility_types[0]
      : row.facility_types;
    return {
      id: String(row.id),
      name: row.name ?? null,
      type_name: ft?.name ?? null,
      location: row.location ?? null,
      address_city: row.address_city ?? null,
      address_country: row.address_country ?? null,
      location_city: row.location_city ?? null,
      location_country_code: row.location_country_code ?? null,
    };
  });

  return mapFacilities({
    facilities: facilityRows,
    emissions: ((emissions.data ?? []) as any[]).map((row) => ({
      facility_id: row.facility_id != null ? String(row.facility_id) : null,
      total_co2e: row.total_co2e ?? null,
      unit: row.unit ?? null,
    })),
    production: ((production.data ?? []) as any[]).map((row) => ({
      facility_id: row.facility_id != null ? String(row.facility_id) : null,
      production_volume: row.production_volume ?? null,
    })),
  });
}
