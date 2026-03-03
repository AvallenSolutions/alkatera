/**
 * Impact Valuation Calculator
 *
 * Pure TypeScript module — no Supabase, no React.
 * Takes structured inputs + proxy values and returns monetised impact values
 * across four capitals: Natural, Human, Social, Governance.
 *
 * Zero-hallucination rule: every number in the output traces to either
 * an input value or a proxy value that was passed in.
 */

// ─── Input types ────────────────────────────────────────────────────────────

export interface NaturalCapitalInputs {
  total_emissions_tco2e: number | null;
  water_consumption_m3: number | null;
  land_use_ha: number | null;
  waste_to_landfill_tonnes: number | null;
}

export interface HumanCapitalInputs {
  living_wage_gap_annual_gbp: number | null;
  total_training_hours: number | null;
  employee_count: number | null;
  wellbeing_score: number | null;
}

export interface SocialCapitalInputs {
  volunteering_hours_total: number | null;
  charitable_giving_total_gbp: number | null;
  local_supply_spend_gbp: number | null;
}

export interface GovernanceCapitalInputs {
  governance_score: number | null;
}

export interface ProxyValues {
  carbon_tonne: number;
  water_m3: number;
  land_ha: number;
  waste_tonne: number;
  living_wage_gap_gbp: number;
  training_hour: number;
  wellbeing_score_point: number;
  volunteering_hour: number;
  charitable_giving_gbp: number;
  local_multiplier: number;
  governance_score_point: number;
}

export interface ImpactValuationInputs {
  natural: NaturalCapitalInputs;
  human: HumanCapitalInputs;
  social: SocialCapitalInputs;
  governance: GovernanceCapitalInputs;
  proxies: ProxyValues;
  reporting_year: number;
}

// ─── Output types ────────────────────────────────────────────────────────────

export interface CapitalBreakdownItem {
  key: string;
  label: string;
  value: number;
  raw_input: number | null;
  proxy_used: number;
  unit: string;
  has_data: boolean;
}

export interface CapitalBreakdown {
  total: number;
  items: CapitalBreakdownItem[];
}

export interface ImpactValuationResult {
  natural: CapitalBreakdown;
  human: CapitalBreakdown;
  social: CapitalBreakdown;
  governance: CapitalBreakdown;
  grand_total: number;
  data_coverage: number; // 0–1, fraction of metrics with real data
  confidence_level: 'high' | 'medium' | 'low';
  reporting_year: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcItem(
  key: string,
  label: string,
  rawInput: number | null,
  proxy: number,
  unit: string
): CapitalBreakdownItem {
  const hasData = rawInput !== null;
  const value = (rawInput ?? 0) * proxy;
  return { key, label, value, raw_input: rawInput, proxy_used: proxy, unit, has_data: hasData };
}

function sumItems(items: CapitalBreakdownItem[]): number {
  return items.reduce((acc, item) => acc + item.value, 0);
}

// ─── Main calculation ────────────────────────────────────────────────────────

export function calculateImpactValuation(
  inputs: ImpactValuationInputs
): ImpactValuationResult {
  const { natural: n, human: h, social: s, governance: g, proxies: p } = inputs;

  // ── Natural Capital ──────────────────────────────────────────────────────
  const naturalItems: CapitalBreakdownItem[] = [
    calcItem('carbon_tonne', 'Carbon (GHG)', n.total_emissions_tco2e, p.carbon_tonne, 'per tCO2e'),
    calcItem('water_m3', 'Water Use', n.water_consumption_m3, p.water_m3, 'per m³ world-eq'),
    calcItem('land_ha', 'Land Use', n.land_use_ha, p.land_ha, 'per ha/yr'),
    calcItem('waste_tonne', 'Waste to Landfill', n.waste_to_landfill_tonnes, p.waste_tonne, 'per tonne'),
  ];
  const naturalTotal = sumItems(naturalItems);

  // ── Human Capital ────────────────────────────────────────────────────────
  const humanItems: CapitalBreakdownItem[] = [
    calcItem('living_wage_gap_gbp', 'Living Wage Uplift', h.living_wage_gap_annual_gbp, p.living_wage_gap_gbp, 'per £1 gap/yr'),
    calcItem('training_hour', 'Employee Training', h.total_training_hours, p.training_hour, 'per hour'),
    calcItem('wellbeing_score_point', 'Employee Wellbeing', h.wellbeing_score, p.wellbeing_score_point, 'per 1pt score improvement'),
  ];
  const humanTotal = sumItems(humanItems);

  // ── Social Capital ───────────────────────────────────────────────────────
  const socialItems: CapitalBreakdownItem[] = [
    calcItem('volunteering_hour', 'Volunteering Hours', s.volunteering_hours_total, p.volunteering_hour, 'per hour'),
    calcItem('charitable_giving_gbp', 'Charitable Giving', s.charitable_giving_total_gbp, p.charitable_giving_gbp, 'per £1 donated'),
    calcItem('local_multiplier', 'Local Supply Chain Spend', s.local_supply_spend_gbp, p.local_multiplier, 'per £1 local spend'),
  ];
  const socialTotal = sumItems(socialItems);

  // ── Governance Capital ───────────────────────────────────────────────────
  const governanceItems: CapitalBreakdownItem[] = [
    calcItem('governance_score_point', 'Governance Quality', g.governance_score, p.governance_score_point, 'per 1pt score (0–100)'),
  ];
  const governanceTotal = sumItems(governanceItems);

  // ── Coverage & confidence ────────────────────────────────────────────────
  // All metrics that can have data
  const coverageInputs: (number | null)[] = [
    n.total_emissions_tco2e,
    n.water_consumption_m3,
    n.land_use_ha,
    n.waste_to_landfill_tonnes,
    h.living_wage_gap_annual_gbp,
    h.total_training_hours,
    h.wellbeing_score,
    s.volunteering_hours_total,
    s.charitable_giving_total_gbp,
    s.local_supply_spend_gbp,
    g.governance_score,
  ];

  const nonNullCount = coverageInputs.filter((v) => v !== null).length;
  const dataCoverage = coverageInputs.length > 0 ? nonNullCount / coverageInputs.length : 0;

  let confidenceLevel: 'high' | 'medium' | 'low';
  if (dataCoverage >= 0.8) {
    confidenceLevel = 'high';
  } else if (dataCoverage >= 0.5) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  const grandTotal = naturalTotal + humanTotal + socialTotal + governanceTotal;

  return {
    natural: { total: naturalTotal, items: naturalItems },
    human: { total: humanTotal, items: humanItems },
    social: { total: socialTotal, items: socialItems },
    governance: { total: governanceTotal, items: governanceItems },
    grand_total: grandTotal,
    data_coverage: dataCoverage,
    confidence_level: confidenceLevel,
    reporting_year: inputs.reporting_year,
  };
}
