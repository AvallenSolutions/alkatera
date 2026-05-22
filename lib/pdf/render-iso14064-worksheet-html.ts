/**
 * ISO 14064-1:2018 Auditor / Verification Worksheet.
 *
 * Renders a structured, verifier-facing summary of the GHG inventory:
 * per emission category — scope, quantification methodology, data quality,
 * emission-factor provenance, uncertainty tier, completeness, evidence and a
 * notes column for verifier annotations. Mirrors the single-page PDFShift
 * pattern used by render-regulatory-index-html.ts.
 */

import { uncertaintyTierForProvenance } from '../data-quality-assessment';

function escapeHtml(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface Iso14064LineItem {
  /** GHG Protocol scope, e.g. "Scope 1", "Scope 3 Cat 5", "FLAG". */
  scope: string;
  /** Source category, e.g. "Stationary combustion", "Vine biomass burning". */
  sourceCategory: string;
  /** Quantification methodology statement (auto-populated where possible). */
  methodology: string;
  /** Data quality rating label (e.g. from DATA_QUALITY_OPTIONS). */
  dataQuality: string;
  /** data_provenance value — drives the uncertainty tier. */
  dataProvenance?: string | null;
  /** Emission factor source + version, e.g. "DEFRA 2025". */
  emissionFactorSource: string;
  /** Completeness assessment. */
  completeness: 'Complete' | 'Estimated' | 'Missing';
  /** Emissions in tCO2e (used for volume-weighted uncertainty). */
  emissionsTco2e: number;
  /** Evidence link / reference, if any. */
  evidence?: string | null;
  /** Free-text verifier notes (usually blank on first issue). */
  notes?: string | null;
}

export interface Iso14064WorksheetData {
  organisationName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  lineItems: Iso14064LineItem[];
  branding: { logo: string | null; primaryColor: string };
}

/** Default methodology statements per source category (auditor-facing). */
export const METHODOLOGY_STATEMENTS: Record<string, string> = {
  stationary_combustion:
    'Fuel consumption (litre/kWh) × DEFRA Scope 1 GHG conversion factors. Activity data from invoices/meter readings.',
  mobile_combustion:
    'Fuel volume or distance × DEFRA mobile-combustion factors, disaggregated by fuel type (incl. red diesel / aviation).',
  co2_winemaking:
    'Purchased CO2 (kg) applied directly as a Scope 1 process emission (1 kg = 1 kg CO2e). Biogenic fermentation CO2 excluded per GHG Protocol / ISO 14064.',
  refrigerants:
    'Refrigerant leaked (kg) × refrigerant-specific GWP-100 (IPCC AR5/AR6). Per-system refrigerant type captured.',
  viticulture_n2o:
    'IPCC 2019 Refinement Ch. 11 Tier 1. EF1 applied to synthetic N + crop-residue N, EF4/EF5 for indirect emissions, disaggregated by climate zone.',
  vine_biomass_burning:
    'IPCC 2006 Vol 4 Ch 2.4. CH4 + N2O from in-field burning of vine prunings (Mb × Cf × Gef). Biogenic CO2 excluded.',
  wastewater_ch4:
    'IPCC 2006 Vol 5 Ch 6. CH4 = COD load × Bo (0.25) × MCF by treatment pathway. On-site = Scope 1; sewer = Scope 3 Cat 5.',
  electricity:
    'Metered consumption (kWh) × location-based grid emission factor for the facility country/year.',
  default:
    'Activity data × applicable published emission factor; see emission factor source column.',
};

export function renderIso14064WorksheetHtml(data: Iso14064WorksheetData): string {
  const primary = data.branding.primaryColor || '#ccff00';

  const totalEmissions = data.lineItems.reduce(
    (s, li) => s + (li.emissionsTco2e || 0),
    0,
  );

  // Volume-weighted inventory uncertainty (Σ wᵢ·uᵢ).
  const weightedUncertainty =
    totalEmissions > 0
      ? data.lineItems.reduce((s, li) => {
          const tier = uncertaintyTierForProvenance(li.dataProvenance);
          return s + (Math.abs(li.emissionsTco2e) / totalEmissions) * tier.pct;
        }, 0)
      : 0;

  const completenessIcon = (c: string) =>
    c === 'Complete'
      ? '<span style="color:#22c55e;">&#10003;</span>'
      : c === 'Estimated'
        ? '<span style="color:#f59e0b;">&#9711;</span>'
        : '<span style="color:#ef4444;">&#10007;</span>';

  const rows = data.lineItems
    .map((li) => {
      const tier = uncertaintyTierForProvenance(li.dataProvenance);
      return `
      <tr style="border-bottom:1px solid #e7e5e4; vertical-align:top;">
        <td style="padding:8px 6px; font-weight:600; white-space:nowrap;">${escapeHtml(li.scope)}</td>
        <td style="padding:8px 6px;">${escapeHtml(li.sourceCategory)}</td>
        <td style="padding:8px 6px; font-size:10px; color:#57534e;">${escapeHtml(li.methodology)}</td>
        <td style="padding:8px 6px; white-space:nowrap;">${escapeHtml(li.dataQuality)}</td>
        <td style="padding:8px 6px; white-space:nowrap;">${escapeHtml(li.emissionFactorSource)}</td>
        <td style="padding:8px 6px; white-space:nowrap;">${escapeHtml(tier.label)} (&plusmn;${tier.pct}%)</td>
        <td style="padding:8px 6px; text-align:center;">${completenessIcon(li.completeness)}</td>
        <td style="padding:8px 6px; text-align:right; white-space:nowrap;">${(li.emissionsTco2e || 0).toFixed(3)}</td>
        <td style="padding:8px 6px; font-size:10px; color:#78716c;">${escapeHtml(li.evidence || '—')}</td>
        <td style="padding:8px 6px; font-size:10px; color:#78716c;">${escapeHtml(li.notes || '')}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>ISO 14064-1 Auditor Worksheet — ${escapeHtml(data.organisationName)} ${data.reportYear}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:white; color:#1c1917; }
    @page { size: A4 landscape; margin: 0; }
    .page { width:1123px; min-height:794px; padding:36px 40px; position:relative; }
    h1 { font-size:20px; font-weight:700; }
    .sub { font-size:11px; color:#78716c; margin-top:4px; }
    table { width:100%; border-collapse:collapse; font-size:11px; margin-top:18px; }
    thead th {
      text-align:left; padding:8px 6px; background:#1c1917; color:white;
      font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em;
    }
    .summary {
      margin-top:18px; background:#f5f5f4; border-radius:10px; padding:16px;
      display:flex; justify-content:space-between; align-items:center;
    }
    .footer { margin-top:24px; font-size:9px; color:#a8a29e; border-top:1px solid #e7e5e4; padding-top:10px; }
    .accent { color:${primary}; }
  </style>
</head>
<body>
  <div class="page">
    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h1>ISO 14064-1:2018 Verification Worksheet</h1>
        <div class="sub">${escapeHtml(data.organisationName)} — FY ${data.reportYear}
          (${escapeHtml(data.reportingPeriodStart)} to ${escapeHtml(data.reportingPeriodEnd)})</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:22px; font-weight:700;" class="accent">${weightedUncertainty.toFixed(1)}%</div>
        <div style="font-size:9px; color:#a8a29e;">inventory uncertainty (volume-weighted)</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Scope</th><th>Source category</th><th>Quantification methodology</th>
          <th>Data quality</th><th>Emission factor</th><th>Uncertainty tier</th>
          <th>Compl.</th><th>tCO&#8322;e</th><th>Evidence</th><th>Verifier notes</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="10" style="padding:16px; text-align:center; color:#a8a29e;">No inventory line items.</td></tr>'}
      </tbody>
    </table>

    <div class="summary">
      <div>
        <div style="font-size:12px; font-weight:600;">Total reported emissions</div>
        <div style="font-size:10px; color:#78716c;">FLAG emissions and removals are reported separately and never netted (SBTi FLAG v1.2 / GHG Protocol LSR).</div>
      </div>
      <div style="font-size:20px; font-weight:700;" class="accent">${totalEmissions.toFixed(3)} tCO&#8322;e</div>
    </div>

    <div class="footer">
      Prepared per ISO 14064-1:2018. Uncertainty tiers: Low &plusmn;8% (measured/supplier-verified),
      Medium &plusmn;20% (calculated/allocated), High &plusmn;50% (modelled/industry average).
      Generated by alkatera. This worksheet supports third-party verification and is not itself an assurance statement.
    </div>
  </div>
</body>
</html>`;
}
