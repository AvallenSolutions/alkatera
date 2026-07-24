/**
 * Shapes the carbon deep-dive reads.
 *
 * These lived in CarbonBreakdownSheet, which step 3 of the vitality redesign
 * made unreachable — the axis pages replaced the sheets. The sheet is gone;
 * the two types it happened to declare are not, so they moved here rather
 * than keeping a 159-line dead component alive to hold them.
 */

export interface MaterialBreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  climate: number;
  water?: number;
  land?: number;
  waste?: number;
  source?: string;
  warning?: string;
}

export interface GHGBreakdown {
  carbon_origin: {
    fossil: number;
    biogenic: number;
    land_use_change: number;
  };
  gas_inventory: {
    co2_fossil: number;
    co2_biogenic: number;
    methane: number;
    methane_fossil?: number;
    methane_biogenic?: number;
    nitrous_oxide: number;
    hfc_pfc: number;
  };
  physical_mass?: {
    ch4_fossil_kg: number;
    ch4_biogenic_kg: number;
    n2o_kg: number;
  };
  gwp_factors: {
    methane_gwp100?: number;
    ch4_fossil_gwp100?: number;
    ch4_biogenic_gwp100?: number;
    n2o_gwp100: number;
    method: string;
  };
  data_quality?: 'primary' | 'secondary' | 'tertiary';
}
