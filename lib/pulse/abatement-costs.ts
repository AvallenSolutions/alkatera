/**
 * Pulse -- Abatement cost library.
 *
 * Published reference capex/opex figures for the decarbonisation levers a
 * typical drinks-industry org can pull. Used by:
 *   - F3 MACC  (Marginal Abatement Cost Curve)
 *   - F7 What-if payback (CapEx payback, NPV)
 *
 * Each lever covers the activity categories it attacks, the share of that
 * category it can realistically eliminate (maxReductionFactor), and the
 * £ capex / £ annual opex needed to deliver it at a "typical mid-size
 * facility" scale. Orgs can override these via an override store in future.
 *
 * Sources (Q2 2026 reference rates):
 *   - BEIS "Non-Domestic Renewable Heat" impact assessments
 *   - UK Green Book supplementary guidance (discount rate 3.5% social, 8% private)
 *   - Carbon Trust industrial decarbonisation reference costs
 *   - Manufacturer quotes (heat pumps, PPA terms)
 */

export interface AbatementLever {
  id: string;
  label: string;
  description: string;
  /** Activity categories the lever can affect (facility_activity_entries.activity_category). */
  categories: string[];
  /** Maximum proportion of the affected categories that can be cut at 100% adoption (0-1). */
  maxReductionFactor: number;
  /** Default adoption % the What-if playground starts at (0-100). */
  defaultPct: number;
  /** Capex per unit of reference capacity (£). See capexBasis for what the unit is. */
  capexGbp: number;
  /** What the capex buys. "per facility" is the simplest -- pro-rata by facility count. */
  capexBasis: 'per_facility' | 'per_tonne_abated_per_year' | 'zero';
  /** Annual non-carbon opex saving as a share of the avoided activity cost (0-1). 1 = full utility bill savings. */
  utilityBillSavingFactor: number;
  /** Expected lifetime (years) for NPV calculation. */
  lifetimeYears: number;
  /** Typical £ utility tariff per tCO2e avoided. Used to estimate bill savings when org-level data is thin. */
  avgUtilityCostGbpPerTonne: number;
}

export const ABATEMENT_LEVERS: AbatementLever[] = [
  {
    id: 'renewable-electricity',
    label: 'Switch to renewable electricity',
    description: 'PPA / REGO-backed tariff replacing the standard grid mix.',
    categories: ['utility_electricity'],
    maxReductionFactor: 1.0,
    defaultPct: 100,
    // A green tariff is usually cost-neutral or small premium; capex = 0, opex saving ~0.
    capexGbp: 0,
    capexBasis: 'zero',
    utilityBillSavingFactor: 0,
    lifetimeYears: 10,
    avgUtilityCostGbpPerTonne: 0,
  },
  {
    id: 'heat-pumps',
    label: 'Replace gas with heat pumps',
    description: 'Air- or ground-source heat pumps for process and space heating.',
    categories: ['utility_gas'],
    maxReductionFactor: 0.85,
    defaultPct: 50,
    // BEIS reference: ~£800k capex for a mid-size ~500kW industrial ASHP installation.
    capexGbp: 800_000,
    capexBasis: 'per_facility',
    // Heat pumps ~3x gas efficiency so running cost drops meaningfully even with higher £/kWh.
    utilityBillSavingFactor: 0.35,
    lifetimeYears: 15,
    avgUtilityCostGbpPerTonne: 200,
  },
  {
    id: 'hvo-fuel',
    label: 'Switch diesel to HVO / biofuel',
    description: 'Drop-in renewable diesel for on-site fleet and gensets.',
    categories: ['utility_fuel'],
    maxReductionFactor: 0.85,
    defaultPct: 75,
    // Near-zero capex (drop-in fuel), but ~15% price premium = negative utility saving.
    capexGbp: 0,
    capexBasis: 'zero',
    utilityBillSavingFactor: -0.15,
    lifetimeYears: 10,
    avgUtilityCostGbpPerTonne: 400,
  },
  {
    id: 'lightweight-glass',
    label: 'Lightweight or recycled packaging',
    description: 'Reduce glass mass or move to higher-recycled-content cullet.',
    categories: ['utility_other'],
    maxReductionFactor: 0.4,
    defaultPct: 30,
    // Packaging tooling changes + supplier qualification.
    capexGbp: 120_000,
    capexBasis: 'per_facility',
    // Lighter bottles reduce glass cost + freight.
    utilityBillSavingFactor: 0.1,
    lifetimeYears: 8,
    avgUtilityCostGbpPerTonne: 150,
  },
  {
    id: 'waste-diversion',
    label: 'Divert waste from landfill',
    description: 'Composting, anaerobic digestion and recycling.',
    categories: ['waste_general'],
    maxReductionFactor: 0.7,
    defaultPct: 60,
    // Sorting kit / skip reorg.
    capexGbp: 40_000,
    capexBasis: 'per_facility',
    // Landfill tax avoided (~£103/t) = strong bill saving.
    utilityBillSavingFactor: 0.5,
    lifetimeYears: 8,
    avgUtilityCostGbpPerTonne: 120,
  },
  {
    id: 'solar-onsite',
    label: 'On-site solar generation',
    description: 'Rooftop / carport PV supplying operational electricity.',
    categories: ['utility_electricity'],
    maxReductionFactor: 0.35,
    defaultPct: 100,
    // ~£700/kWp installed; a 500kWp array ~ £350k.
    capexGbp: 350_000,
    capexBasis: 'per_facility',
    // Avoided grid electricity + export revenue.
    utilityBillSavingFactor: 1.0,
    lifetimeYears: 25,
    avgUtilityCostGbpPerTonne: 250,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Finance helpers
// ─────────────────────────────────────────────────────────────────────────

/**
 * Simple payback in years: capex / annual_saving.
 * Returns null if capex or saving is non-positive (means payback doesn't apply).
 */
export function simplePayback(capex: number, annualSaving: number): number | null {
  if (capex <= 0) return 0;
  if (annualSaving <= 0) return null;
  return capex / annualSaving;
}

/**
 * NPV over the lever's lifetime at the given discount rate.
 * NPV = -capex + Σ (annual_saving / (1+r)^t) for t=1..lifetime
 */
export function netPresentValue(
  capex: number,
  annualSaving: number,
  lifetimeYears: number,
  discountRate: number,
): number {
  if (annualSaving === 0 || lifetimeYears <= 0) return -capex;
  let npv = -capex;
  for (let t = 1; t <= lifetimeYears; t += 1) {
    npv += annualSaving / Math.pow(1 + discountRate, t);
  }
  return npv;
}

/**
 * Levelised abatement cost: annualised capex + opex impact per tonne avoided.
 * This is the £/tCO2e figure plotted on a MACC (negative = saves money).
 *
 *   levelised_cost_gbp_per_tonne =
 *       (annualised_capex - annual_utility_saving) / annual_tonnes_abated
 */
export function levelisedAbatementCost(args: {
  capex: number;
  lifetimeYears: number;
  discountRate: number;
  annualUtilitySavingGbp: number;
  annualTonnesAbated: number;
}): number {
  if (args.annualTonnesAbated <= 0) return 0;
  // Capital recovery factor: a / (1 - (1+r)^-n)
  const r = args.discountRate;
  const n = args.lifetimeYears;
  const crf = r > 0 ? r / (1 - Math.pow(1 + r, -n)) : 1 / n;
  const annualisedCapex = args.capex * crf;
  return (annualisedCapex - args.annualUtilitySavingGbp) / args.annualTonnesAbated;
}
