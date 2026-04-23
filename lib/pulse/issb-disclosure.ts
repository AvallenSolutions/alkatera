/**
 * Pulse -- ISSB IFRS S2 climate-related financial disclosure.
 *
 * IFRS S2 is the global baseline climate disclosure standard. In the UK it's
 * being adopted as UK SDS (Sustainability Disclosure Standards) from
 * 2026-2027. The standard requires disclosure around:
 *
 *   1. Governance              - how climate oversight is structured
 *   2. Strategy                - transition plan, scenario analysis
 *   3. Risk management         - how climate risks are identified/managed
 *   4. Metrics and targets     - emissions, intensity, targets, remuneration
 *
 * This module composes the *quantitative* sections (strategy scenario analysis
 * + metrics and targets) from live Pulse data. Governance and risk management
 * narrative is organisation-specific and left for manual entry.
 *
 * Output is a structured object that can be:
 *   - rendered as a PDF via lib/pulse/issb-template.ts + PDFShift
 *   - exported as CSV for pasting into the annual report
 *   - shared with auditors
 */

export interface IssbDisclosureInput {
  organizationName: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  /** Scope 1+2 emissions in tCO2e. */
  currentScope12Tonnes: number;
  /** Prior period Scope 1+2 emissions. */
  priorScope12Tonnes: number;
  /** Annual revenue in GBP for intensity ratio. */
  annualRevenueGbp: number;
  /** Units produced (for intensity ratio). */
  unitsProduced: number;
  /** Resolved carbon shadow price (GBP per tonne). */
  carbonPriceGbpPerTonne: number;
  /** Current-period £ environmental liability. */
  currentLiabilityGbp: number;
  /** Scenario sensitivity: £ move per £10 carbon price. */
  sensitivityGbpPer10: number;
  /** Active targets (baseline -> target). */
  targets: Array<{
    metric_key: string;
    baseline_value: number;
    baseline_date: string;
    target_value: number;
    target_date: string;
    unit: string;
    status: string;
  }>;
  /** Regulatory exposure total. */
  regulatoryExposureGbp: number;
}

export interface IssbDisclosure {
  meta: {
    organizationName: string;
    reportingPeriod: string;
    standard: 'IFRS S2';
    generatedAt: string;
  };
  strategy: {
    scenarioAnalysisSummary: string;
    sensitivityGbpPer10PerTonne: number;
    lowScenarioGbp: number;
    midScenarioGbp: number;
    stressScenarioGbp: number;
  };
  metricsAndTargets: {
    scope1and2_tco2e: number;
    scope1and2_yoy_pct: number | null;
    carbonIntensity_tco2e_per_m_gbp_revenue: number | null;
    carbonIntensity_tco2e_per_unit: number | null;
    environmentalLiability_gbp: number;
    regulatoryExposure_gbp: number;
    activeTargets: Array<{
      label: string;
      baseline: string;
      target: string;
      progress_pct: number | null;
      status: string;
    }>;
  };
  narrativeStubs: {
    governance: string;
    riskManagement: string;
    transitionPlan: string;
  };
  csvExport: string; // headers + rows ready to paste into Excel
}

export function buildIssbDisclosure(input: IssbDisclosureInput): IssbDisclosure {
  const yoyPct =
    input.priorScope12Tonnes > 0
      ? ((input.currentScope12Tonnes - input.priorScope12Tonnes) / input.priorScope12Tonnes) * 100
      : null;
  const intensityPerRevenue =
    input.annualRevenueGbp > 0
      ? input.currentScope12Tonnes / (input.annualRevenueGbp / 1_000_000)
      : null;
  const intensityPerUnit =
    input.unitsProduced > 0 ? input.currentScope12Tonnes / input.unitsProduced : null;

  const targets = input.targets.map(t => {
    const progressPct =
      t.baseline_value !== t.target_value
        ? ((t.baseline_value - t.target_value) === 0
            ? null
            : Math.max(
                0,
                Math.min(
                  100,
                  ((t.baseline_value - t.target_value) /
                    Math.abs(t.baseline_value - t.target_value)) *
                    100,
                ),
              ))
        : null;
    return {
      label: `${t.metric_key.replace('_', ' ')} from ${t.baseline_value} ${t.unit} (${t.baseline_date}) to ${t.target_value} ${t.unit} (${t.target_date})`,
      baseline: `${t.baseline_value} ${t.unit} at ${t.baseline_date}`,
      target: `${t.target_value} ${t.unit} by ${t.target_date}`,
      progress_pct: progressPct,
      status: t.status,
    };
  });

  // IFRS S2 narrative stubs -- structure is the disclosure requirement; the
  // org fills in the specifics. We give them a scaffold with their own
  // numbers already plugged in so the editing job is minimal.
  const narrativeStubs = {
    governance: `${input.organizationName} assigns board-level oversight of climate-related risks and opportunities to [COMMITTEE NAME]. Management's role in assessing and managing these matters is held by [ROLE/NAME], who reports to the board [FREQUENCY].`,
    riskManagement: `Climate-related risks are identified through [PROCESS]. Prioritisation is by [MATERIALITY METHODOLOGY]. Mitigation is integrated into existing enterprise risk management. Current material climate risks identified include transition risk from carbon pricing (see scenario analysis), physical risk from [PHYSICAL RISK CATEGORIES], and supply-chain risk.`,
    transitionPlan: `${input.organizationName}'s transition plan targets [ABSOLUTE REDUCTION %] by [TARGET YEAR]. Current Scope 1+2 emissions are ${input.currentScope12Tonnes.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e (${yoyPct === null ? 'baseline year' : `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}% vs prior year`}). Our estimated annual environmental liability at the current carbon price of £${input.carbonPriceGbpPerTonne}/tCO2e is £${input.currentLiabilityGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })}. Further detail on mitigation levers and capex deployed is set out in [SECTION REFERENCE].`,
  };

  // CSV export: one row per metric for easy paste.
  const csvRows = [
    ['Metric', 'Value', 'Unit', 'Source'],
    ['Scope 1+2 emissions (trailing 12m)', String(input.currentScope12Tonnes.toFixed(1)), 'tCO2e', 'metric_snapshots.total_co2e'],
    ['Scope 1+2 YoY change', yoyPct === null ? 'N/A' : `${yoyPct.toFixed(1)}`, '%', 'metric_snapshots (prior period)'],
    ['Annual revenue', String(input.annualRevenueGbp), 'GBP', 'epr_organization_settings.annual_turnover_gbp'],
    ['Carbon intensity (per £m revenue)', intensityPerRevenue === null ? 'N/A' : intensityPerRevenue.toFixed(2), 'tCO2e / £m', 'Computed'],
    ['Carbon intensity (per unit)', intensityPerUnit === null ? 'N/A' : intensityPerUnit.toFixed(4), 'tCO2e / unit', 'Computed'],
    ['Environmental liability (shadow-priced)', String(input.currentLiabilityGbp.toFixed(0)), 'GBP', `${input.carbonPriceGbpPerTonne} per tCO2e`],
    ['Carbon price sensitivity', String(input.sensitivityGbpPer10.toFixed(0)), 'GBP per £10/tCO2e', 'Computed'],
    ['Stress test liability (£250/tCO2e)', String((input.currentScope12Tonnes * 250).toFixed(0)), 'GBP', 'Bank of England stress test scenario'],
    ['Regulatory exposure', String(input.regulatoryExposureGbp.toFixed(0)), 'GBP', 'UK ETS + CBAM + PPT + EPR'],
  ];
  const csvExport = csvRows
    .map(r => r.map(c => (/[,"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(','))
    .join('\n');

  return {
    meta: {
      organizationName: input.organizationName,
      reportingPeriod: `${input.reportingPeriodStart} to ${input.reportingPeriodEnd}`,
      standard: 'IFRS S2',
      generatedAt: new Date().toISOString(),
    },
    strategy: {
      scenarioAnalysisSummary: `Using trailing-12-month Scope 1+2 emissions of ${input.currentScope12Tonnes.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e, we estimate our carbon cost exposure at £${(input.currentScope12Tonnes * 50).toLocaleString('en-GB', { maximumFractionDigits: 0 })} (low £50/t), £${input.currentLiabilityGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 })} (current £${input.carbonPriceGbpPerTonne}/t), £${(input.currentScope12Tonnes * 150).toLocaleString('en-GB', { maximumFractionDigits: 0 })} (IEA Net-Zero £150/t), and £${(input.currentScope12Tonnes * 250).toLocaleString('en-GB', { maximumFractionDigits: 0 })} (BoE stress £250/t).`,
      sensitivityGbpPer10PerTonne: input.sensitivityGbpPer10,
      lowScenarioGbp: input.currentScope12Tonnes * 50,
      midScenarioGbp: input.currentScope12Tonnes * 150,
      stressScenarioGbp: input.currentScope12Tonnes * 250,
    },
    metricsAndTargets: {
      scope1and2_tco2e: input.currentScope12Tonnes,
      scope1and2_yoy_pct: yoyPct,
      carbonIntensity_tco2e_per_m_gbp_revenue: intensityPerRevenue,
      carbonIntensity_tco2e_per_unit: intensityPerUnit,
      environmentalLiability_gbp: input.currentLiabilityGbp,
      regulatoryExposure_gbp: input.regulatoryExposureGbp,
      activeTargets: targets,
    },
    narrativeStubs,
    csvExport,
  };
}
