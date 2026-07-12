/**
 * Shared shapes for the emissions surface (/data/scope-1-2/).
 *
 * The page owns all data fetching; these types describe what it hands the
 * section components. SCOPE_COLOURS is the one place the scope inks are
 * chosen: studio chart inks on paper, never the old traffic-light hexes.
 */

import { STUDIO } from '@/components/studio';

export interface Facility {
  id: string;
  name: string;
  location: string | null;
}

export interface CorporateReport {
  id: string;
  year: number;
  status: string;
  total_emissions: number;
  breakdown_json: any;
  created_at: string;
  updated_at: string;
}

export interface OverheadEntry {
  id: string;
  category: string;
  description: string;
  spend_amount: number;
  currency: string;
  entry_date: string;
  computed_co2e: number;
  fte_count?: number;
  asset_type?: string;
  transport_mode?: string;
  distance_km?: number;
  weight_kg?: number;
  material_type?: string;
  disposal_method?: string;
}

export interface UtilityDataEntry {
  id: string;
  facility_id: string;
  utility_type: string;
  quantity: number;
  unit: string;
  refrigerant_type?: string | null;
  reporting_period_start: string;
  reporting_period_end: string;
  calculated_scope: string;
  facility?: {
    id: string;
    name: string;
    location: string | null;
  };
}

export interface FacilityBreakdown {
  facility_id: string;
  facility_name: string;
  scope1_co2e: number;
  scope2_co2e: number;
  entries: UtilityDataEntry[];
}

export interface SourceBreakdown {
  utility_type: string;
  label: string;
  scope: 'Scope 1' | 'Scope 2';
  total_quantity: number;
  unit: string;
  total_co2e: number;
}

export interface TrendYear {
  year: number;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

/** Per-source values (tonnes) that sit inside each scope total. */
export interface ScopeSources {
  s1Utilities: number;
  s1Fleet: number;
  s1Xero: number;
  s2Utilities: number;
  s2Fleet: number;
  s2Xero: number;
  s3Products: number;
  s3UsePhase: number;
  s3Activities: number;
  s3Xero: number;
  s3Fleet: number;
}

/** SoT scope totals (tonnes). */
export interface ScopeTotals {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
}

/** The scopes speak in studio chart inks on paper. */
export const SCOPE_COLOURS = {
  scope1: STUDIO.cobalt,
  scope2: STUDIO.ochreInk,
  scope3: STUDIO.forest,
} as const;
