/**
 * Facility archetype proxy resolver.
 *
 * When a 3rd-party facility cannot supply primary energy/water data, we fall
 * back to industry-typical intensities seeded in the `facility_archetypes`
 * reference table. Emissions are computed from those intensities × the
 * client's allocated production volume, with DEFRA emission factors and a
 * pedigree-matrix downgrade applied so the report transparently reflects the
 * lower data quality (ISO 14044 §4.2.3.6, ISO 14067 §6.3.5).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type ArchetypeUnit =
  | 'litre_packaged'
  | 'can'
  | 'bottle'
  | 'litre_concentrate'
  | 'hl';

export type DataCollectionMode = 'primary' | 'archetype_proxy' | 'hybrid';

export interface FacilityArchetype {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  unit: ArchetypeUnit;
  electricityKwhPerUnit: number;
  naturalGasKwhPerUnit: number;
  thermalFuelKwhPerUnit: number;
  waterLitresPerUnit: number;
  pedigreeReliability: number;
  pedigreeCompleteness: number;
  pedigreeTemporal: number;
  pedigreeGeographical: number;
  pedigreeTechnological: number;
  uncertaintyPct: number;
  geography: string;
  sourceCitation: string;
  sourceUrl: string | null;
  sourceYear: number;
}

export interface HybridOverrides {
  electricity_kwh_per_unit?: number;
  natural_gas_kwh_per_unit?: number;
  thermal_fuel_kwh_per_unit?: number;
  water_litres_per_unit?: number;
}

export interface ProxyEmissionsBreakdown {
  electricityKwh: number;
  electricityCo2eKg: number;
  naturalGasKwh: number;
  naturalGasCo2eKg: number;
  thermalFuelKwh: number;
  thermalFuelCo2eKg: number;
  waterLitres: number;
  scope1Kg: number;
  scope2Kg: number;
  totalKg: number;
}

export interface ProxyResolutionResult {
  archetype: FacilityArchetype;
  mode: DataCollectionMode;
  appliedOverrides: HybridOverrides;
  emissionFactors: {
    electricityKgCo2ePerKwh: number;
    naturalGasKgCo2ePerKwh: number;
    thermalFuelKgCo2ePerKwh: number;
    gridFactorSource: string;
  };
  breakdown: ProxyEmissionsBreakdown;
  pedigreeScores: {
    reliability: number;
    completeness: number;
    temporal: number;
    geographical: number;
    technological: number;
  };
  uncertaintyPct: number;
  /**
   * Frozen archetype values at the time of this calculation. Stored on the
   * allocation row so re-calculation is reproducible even if the reference
   * table is updated later.
   */
  snapshot: FacilityArchetype;
}

// -----------------------------------------------------------------------------
// Data access
// -----------------------------------------------------------------------------

export async function listFacilityArchetypes(
  supabase: SupabaseClient,
): Promise<FacilityArchetype[]> {
  const { data, error } = await supabase
    .from('facility_archetypes')
    .select('*')
    .order('display_name');

  if (error) {
    console.error('[listFacilityArchetypes] Failed:', error);
    return [];
  }
  return (data ?? []).map(rowToArchetype);
}

export async function getFacilityArchetypeById(
  supabase: SupabaseClient,
  id: string,
): Promise<FacilityArchetype | null> {
  const { data, error } = await supabase
    .from('facility_archetypes')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return null;
  return rowToArchetype(data);
}

export async function getFacilityArchetypeBySlug(
  supabase: SupabaseClient,
  slug: string,
): Promise<FacilityArchetype | null> {
  const { data, error } = await supabase
    .from('facility_archetypes')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) return null;
  return rowToArchetype(data);
}

function rowToArchetype(row: any): FacilityArchetype {
  return {
    id: row.id,
    slug: row.slug,
    displayName: row.display_name,
    description: row.description ?? null,
    unit: row.unit as ArchetypeUnit,
    electricityKwhPerUnit: Number(row.electricity_kwh_per_unit ?? 0),
    naturalGasKwhPerUnit: Number(row.natural_gas_kwh_per_unit ?? 0),
    thermalFuelKwhPerUnit: Number(row.thermal_fuel_kwh_per_unit ?? 0),
    waterLitresPerUnit: Number(row.water_litres_per_unit ?? 0),
    pedigreeReliability: Number(row.pedigree_reliability ?? 4),
    pedigreeCompleteness: Number(row.pedigree_completeness ?? 3),
    pedigreeTemporal: Number(row.pedigree_temporal ?? 3),
    pedigreeGeographical: Number(row.pedigree_geographical ?? 3),
    pedigreeTechnological: Number(row.pedigree_technological ?? 3),
    uncertaintyPct: Number(row.uncertainty_pct ?? 30),
    geography: row.geography ?? 'GLO',
    sourceCitation: row.source_citation,
    sourceUrl: row.source_url ?? null,
    sourceYear: Number(row.source_year ?? 0),
  };
}

// -----------------------------------------------------------------------------
// Emission factors
// -----------------------------------------------------------------------------

// DEFRA 2025 GHG Conversion Factors
export const NATURAL_GAS_KG_CO2E_PER_KWH = 0.18293;
// Typical mid-range thermal fuel mix (heavy fuel oil) in kWh equivalent.
export const THERMAL_FUEL_KG_CO2E_PER_KWH = 0.28; // conservative mid-range per DEFRA 2025

// -----------------------------------------------------------------------------
// Unit conversions
// -----------------------------------------------------------------------------

/**
 * Convert a client production volume (and its declared unit) into the
 * archetype's native unit. Returns `null` when we cannot convert without
 * making unsafe assumptions — callers should warn the user and require a
 * compatible unit.
 */
export function convertProductionVolumeToArchetypeUnit(
  volume: number,
  fromUnit: string,
  archetypeUnit: ArchetypeUnit,
): number | null {
  if (volume <= 0 || !Number.isFinite(volume)) return 0;

  const from = normaliseUnit(fromUnit);
  const to = archetypeUnit;

  if (from === to) return volume;

  // litres -> hl
  if (from === 'litres' && to === 'hl') return volume / 100;

  // packaged-litre equivalents: litres maps 1:1 onto litre_packaged and
  // litre_concentrate (concentrate uses its own intensity so the mapping is
  // intentional; the user must pick the right archetype).
  if (from === 'litres' && (to === 'litre_packaged' || to === 'litre_concentrate')) {
    return volume;
  }

  // units -> cans/bottles: treat "units" as the facility's packaged unit
  // count. Safe when the archetype is can- or bottle-based.
  if (from === 'units' && (to === 'can' || to === 'bottle')) return volume;

  return null;
}

function normaliseUnit(unit: string): string {
  const u = (unit || '').trim().toLowerCase();
  if (u === 'l' || u === 'litre' || u === 'litres' || u === 'liter' || u === 'liters') return 'litres';
  if (u === 'hl' || u === 'hectolitre' || u === 'hectolitres') return 'hl';
  if (u === 'cans' || u === 'can') return 'can';
  if (u === 'bottles' || u === 'bottle') return 'bottle';
  if (u === 'unit' || u === 'units') return 'units';
  return u;
}

// -----------------------------------------------------------------------------
// Resolver — the main entry point
// -----------------------------------------------------------------------------

export interface ResolveProxyInput {
  archetype: FacilityArchetype;
  mode: DataCollectionMode; // 'archetype_proxy' | 'hybrid'
  clientProductionVolume: number;
  clientProductionUnit: string;
  /** kg CO2e / kWh — usually from getGridFactor(country) */
  gridEmissionFactor: number;
  gridFactorSource: string;
  /** Only meaningful when mode === 'hybrid'. */
  overrides?: HybridOverrides;
}

export function resolveProxyEmissions(
  input: ResolveProxyInput,
): ProxyResolutionResult {
  const {
    archetype,
    mode,
    clientProductionVolume,
    clientProductionUnit,
    gridEmissionFactor,
    gridFactorSource,
    overrides,
  } = input;

  if (mode === 'primary') {
    throw new Error('resolveProxyEmissions must not be called for primary data');
  }

  const volumeInArchetypeUnit = convertProductionVolumeToArchetypeUnit(
    clientProductionVolume,
    clientProductionUnit,
    archetype.unit,
  );

  if (volumeInArchetypeUnit === null) {
    throw new Error(
      `Cannot convert production volume unit "${clientProductionUnit}" to archetype unit "${archetype.unit}". ` +
        `Choose an archetype with a compatible unit or convert the volume manually.`,
    );
  }

  // Apply hybrid overrides on top of archetype defaults
  const applied: HybridOverrides = mode === 'hybrid' ? (overrides ?? {}) : {};
  const electricityPerUnit =
    applied.electricity_kwh_per_unit ?? archetype.electricityKwhPerUnit;
  const naturalGasPerUnit =
    applied.natural_gas_kwh_per_unit ?? archetype.naturalGasKwhPerUnit;
  const thermalFuelPerUnit =
    applied.thermal_fuel_kwh_per_unit ?? archetype.thermalFuelKwhPerUnit;
  const waterPerUnit =
    applied.water_litres_per_unit ?? archetype.waterLitresPerUnit;

  const electricityKwh = electricityPerUnit * volumeInArchetypeUnit;
  const naturalGasKwh = naturalGasPerUnit * volumeInArchetypeUnit;
  const thermalFuelKwh = thermalFuelPerUnit * volumeInArchetypeUnit;
  const waterLitres = waterPerUnit * volumeInArchetypeUnit;

  const electricityCo2eKg = electricityKwh * gridEmissionFactor;
  const naturalGasCo2eKg = naturalGasKwh * NATURAL_GAS_KG_CO2E_PER_KWH;
  const thermalFuelCo2eKg = thermalFuelKwh * THERMAL_FUEL_KG_CO2E_PER_KWH;

  const scope1Kg = naturalGasCo2eKg + thermalFuelCo2eKg;
  const scope2Kg = electricityCo2eKg;
  const totalKg = scope1Kg + scope2Kg;

  // Hybrid with user-supplied primary numbers improves a subset of pedigree
  // scores by 1 (better), capped at 1 (best). The fields overridden are
  // user-measured for their own facility, so reliability goes up.
  const pedigreeBump = mode === 'hybrid' && Object.keys(applied).length > 0 ? 1 : 0;

  const pedigreeScores = {
    reliability: Math.max(1, archetype.pedigreeReliability - pedigreeBump),
    completeness: Math.max(1, archetype.pedigreeCompleteness - pedigreeBump),
    temporal: archetype.pedigreeTemporal,
    geographical: archetype.pedigreeGeographical,
    technological: archetype.pedigreeTechnological,
  };

  return {
    archetype,
    mode,
    appliedOverrides: applied,
    emissionFactors: {
      electricityKgCo2ePerKwh: gridEmissionFactor,
      naturalGasKgCo2ePerKwh: NATURAL_GAS_KG_CO2E_PER_KWH,
      thermalFuelKgCo2ePerKwh: THERMAL_FUEL_KG_CO2E_PER_KWH,
      gridFactorSource,
    },
    breakdown: {
      electricityKwh,
      electricityCo2eKg,
      naturalGasKwh,
      naturalGasCo2eKg,
      thermalFuelKwh,
      thermalFuelCo2eKg,
      waterLitres,
      scope1Kg,
      scope2Kg,
      totalKg,
    },
    pedigreeScores,
    uncertaintyPct: archetype.uncertaintyPct,
    snapshot: archetype,
  };
}

// -----------------------------------------------------------------------------
// Pedigree-aware confidence downgrade
// -----------------------------------------------------------------------------

/**
 * Convert the 1-5 pedigree scores into a 0-100 confidence percent roughly
 * equivalent to the existing platform DQI scale. Used when aggregating the
 * report-level Data Quality section for proxy-backed facilities.
 *
 * Formula: mean(score) of 1 → 95%, 5 → 25%, linear between.
 */
export function pedigreeToConfidencePct(p: {
  reliability: number;
  completeness: number;
  temporal: number;
  geographical: number;
  technological: number;
}): number {
  const mean =
    (p.reliability + p.completeness + p.temporal + p.geographical + p.technological) / 5;
  const clamped = Math.max(1, Math.min(5, mean));
  return Math.round(95 - ((clamped - 1) / 4) * 70);
}

/**
 * Suggested improvement actions surfaced in the Data Improvement Plan report
 * section when a facility is backed by proxy data. Ordered by impact.
 */
export function suggestUpgradeActions(archetype: FacilityArchetype): string[] {
  const actions: string[] = [];
  if (archetype.electricityKwhPerUnit > 0) {
    actions.push(
      'Request the facility\u2019s total annual electricity consumption (kWh) and total production volume for the same period; apply mass- or volume-based allocation to derive a per-unit intensity.',
    );
  }
  if (archetype.naturalGasKwhPerUnit + archetype.thermalFuelKwhPerUnit > 0) {
    actions.push(
      'Collect thermal-energy invoices (natural gas, LPG, heavy fuel oil) for the reporting period and allocate by production volume.',
    );
  }
  if (archetype.waterLitresPerUnit > 0) {
    actions.push(
      'Ask the facility for water-meter readings or supplier invoices; proxy water intensity is a common data gap and easy to close.',
    );
  }
  actions.push(
    'Where the facility runs multiple lines, agree a physical-allocation methodology in writing (run time, throughput, or packaged-litre share) to support ISO 14044 \u00a74.3.4.2 requirements.',
  );
  actions.push(
    'Consider installing sub-meters on the line(s) that produce your product — the marginal cost is typically recovered within one reporting cycle of improved primary data.',
  );
  return actions;
}
