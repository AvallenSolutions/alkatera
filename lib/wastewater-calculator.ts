/**
 * Wastewater CH4 calculator — IPCC 2006 Vol 5 Ch 6 (Tier 1).
 *
 * Computes methane from biological treatment of wastewater using the
 * Chemical Oxygen Demand (COD) load. This is the canonical, pure,
 * unit-tested implementation; it drives the live preview in the wastewater
 * data-entry form and is mirrored (formula only) in the
 * calculate-scope3-cat5-waste-wastewater edge function for the persisted path.
 *
 * Scope split (GHG Protocol):
 *   - on-site treatment / land application / discharge to water body
 *       => Scope 1 (direct emissions from a source the org controls)
 *   - discharge to municipal sewer
 *       => Scope 3 Category 5 (treated off-site by the utility)
 *
 * When COD is unavailable the caller should fall back to the legacy
 * volume × emission-factor path (used_cod_model = false).
 */

import { IPCC_AR6_GWP, WASTEWATER_FACTORS } from './ghg-constants';

export type WastewaterDischargeDestination =
  | 'on_site_treatment'
  | 'sewer'
  | 'water_body'
  | 'land';

export interface WastewaterCalculatorInput {
  /** Volume of wastewater discharged in the reporting period (m³). */
  volume_m3: number;
  /** Chemical Oxygen Demand (mg O2/L). Null/0 → caller uses legacy path. */
  cod_mg_per_litre: number | null | undefined;
  /** wastewater_treatment_method_enum value (or future anaerobic options). */
  treatment_method: string;
  /** Where the wastewater goes. Determines Scope 1 vs Scope 3 Cat 5. */
  discharge_destination: WastewaterDischargeDestination | null | undefined;
  /** Optional fraction of CH4 captured/flared (0..1), e.g. biogas recovery. */
  ch4_recovery_fraction?: number;
}

export interface WastewaterImpactResult {
  /** CH4 mass emitted (kg). */
  ch4_kg: number;
  /** CH4 expressed as CO2e (kg), biogenic GWP. */
  ch4_co2e_kg: number;
  /** GHG Protocol scope for this discharge. */
  scope: 'Scope 1' | 'Scope 3';
  /** COD load (kg) used in the calculation. */
  cod_load_kg: number;
  /** Methane correction factor applied. */
  mcf_used: number;
  /** Whether the COD model was used (false → caller must use legacy path). */
  used_cod_model: boolean;
  /** Human-readable methodology statement for the audit trail. */
  methodology_note: string;
}

/** Sewer => off-site municipal treatment => Scope 3 Cat 5. Else direct => Scope 1. */
export function wastewaterScope(
  destination: WastewaterDischargeDestination | null | undefined,
): 'Scope 1' | 'Scope 3' {
  return destination === 'sewer' ? 'Scope 3' : 'Scope 1';
}

export function calculateWastewaterCH4(
  input: WastewaterCalculatorInput,
): WastewaterImpactResult {
  const scope = wastewaterScope(input.discharge_destination);

  if (
    input.cod_mg_per_litre == null ||
    input.cod_mg_per_litre <= 0 ||
    input.volume_m3 <= 0
  ) {
    return {
      ch4_kg: 0,
      ch4_co2e_kg: 0,
      scope,
      cod_load_kg: 0,
      mcf_used: 0,
      used_cod_model: false,
      methodology_note:
        'No COD supplied — caller falls back to legacy volume × emission-factor path.',
    };
  }

  // mg/L × m³ → kg : (mg/L) × 1000 L/m³ × m³ × 1e-6 kg/mg = × 0.001
  const codLoadKg = input.volume_m3 * input.cod_mg_per_litre * 0.001;
  const mcf =
    WASTEWATER_FACTORS.MCF[input.treatment_method] ??
    WASTEWATER_FACTORS.MCF.unknown;
  const recovery = Math.min(Math.max(input.ch4_recovery_fraction ?? 0, 0), 1);
  const ch4Kg = codLoadKg * WASTEWATER_FACTORS.Bo * mcf * (1 - recovery);

  return {
    ch4_kg: ch4Kg,
    ch4_co2e_kg: ch4Kg * IPCC_AR6_GWP.CH4_BIOGENIC,
    scope,
    cod_load_kg: codLoadKg,
    mcf_used: mcf,
    used_cod_model: true,
    methodology_note:
      `IPCC 2006 Vol 5 Ch 6: COD ${input.cod_mg_per_litre} mg/L × ${input.volume_m3} m³ ` +
      `× Bo ${WASTEWATER_FACTORS.Bo} × MCF ${mcf}` +
      (recovery > 0 ? ` × (1 − ${recovery} recovery)` : '') +
      ` → ${ch4Kg.toFixed(2)} kg CH4 (${scope}).`,
  };
}
