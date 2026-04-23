/**
 * Pulse -- Board-pack HTML template.
 *
 * Pure HTML/CSS render of the financial summary for one-click PDF export via
 * PDFShift. Designed to fit two A4 landscape pages: the first is the
 * executive summary (hero £ + sensitivity + MACC top-3), the second is
 * driver detail + regulatory exposure + budgets.
 *
 * Keep styling inline / scoped to the template so PDFShift's Chromium can
 * render without external CSS.
 */

export interface BoardPackInput {
  organizationName: string;
  generatedAt: string;
  reportingWindow: string; // e.g. "Apr 2025 - Apr 2026"
  financialFootprint: {
    total_gbp: number;
    prior_gbp: number;
    delta_gbp: number;
    delta_pct: number | null;
    by_metric: Array<{ label: string; gbp: number; pct: number }>;
  };
  intensity: {
    per_m_revenue: number | null;
    per_fte: number | null;
    per_unit: number | null;
  };
  scenarioSensitivity: {
    annual_tonnes: number;
    current_gbp_per_t: number;
    sensitivity_gbp_per_10: number;
    stress_gbp: number;
  };
  topLineItems: Array<{
    rank: number;
    label: string;
    gbp: number;
    pct: number;
  }>;
  maccTop: Array<{
    label: string;
    tonnes: number;
    gbp_per_tonne: number;
    payback_years: number | null;
  }>;
  regulatory: {
    total_gbp: number;
    lines: Array<{ label: string; gbp: number; basis: string }>;
  };
  budgets: Array<{
    label: string;
    budget_t: number;
    actual_t: number;
    variance_pct: number;
    status: 'on_track' | 'at_risk' | 'over';
  }>;
}

export function renderBoardPackHtml(input: BoardPackInput): string {
  const {
    organizationName,
    generatedAt,
    reportingWindow,
    financialFootprint,
    intensity,
    scenarioSensitivity,
    topLineItems,
    maccTop,
    regulatory,
    budgets,
  } = input;

  const fmtGbp = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 100_000) {
      return v.toLocaleString('en-GB', {
        style: 'currency',
        currency: 'GBP',
        notation: 'compact',
        maximumFractionDigits: 1,
      });
    }
    return v.toLocaleString('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0,
    });
  };

  const deltaArrow = financialFootprint.delta_gbp < 0 ? '↓' : '↑';
  const deltaColour = financialFootprint.delta_gbp < 0 ? '#10b981' : '#ef4444';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Financial board pack -- ${escapeHtml(organizationName)}</title>
  <style>
    @page { size: A4 landscape; margin: 18mm 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; font-size: 11px; line-height: 1.4; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 2px 0; }
    h2 { font-size: 13px; margin: 14px 0 6px 0; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .header { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #ccff00; padding-bottom: 8px; margin-bottom: 16px; }
    .hero { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 12px; }
    .hero .num { font-size: 32px; font-weight: 700; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
    th { font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    .chip { display: inline-block; padding: 1px 6px; border-radius: 99px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; }
    .chip-green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
    .chip-amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
    .chip-red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
    .section { margin-bottom: 10px; }
    .page-break { page-break-before: always; }
    .stat { border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
    .stat .lbl { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; }
    .stat .val { font-size: 16px; font-weight: 700; }
    .footer { margin-top: 16px; font-size: 8px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px; }
  </style>
</head>
<body>

  <div class="header">
    <div>
      <h1>Financial board pack</h1>
      <div style="color:#64748b; font-size: 11px;">${escapeHtml(organizationName)} · ${escapeHtml(reportingWindow)}</div>
    </div>
    <div style="color:#64748b; font-size: 10px;">Generated ${escapeHtml(generatedAt)} by alkatera Pulse</div>
  </div>

  <div class="hero">
    <div style="color:#64748b; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em;">Annual environmental liability</div>
    <div class="num">${fmtGbp(financialFootprint.total_gbp)}</div>
    <div style="font-size: 12px; color: ${deltaColour};">
      ${deltaArrow} ${fmtGbp(Math.abs(financialFootprint.delta_gbp))}
      ${financialFootprint.delta_pct !== null ? ` (${financialFootprint.delta_pct >= 0 ? '+' : ''}${financialFootprint.delta_pct.toFixed(1)}%)` : ''}
      <span style="color:#64748b;">vs prior 12 months</span>
    </div>
  </div>

  <div class="row">
    <div class="col">
      <h2>Cost driver mix</h2>
      <table>
        <tr>
          <th>Metric</th><th class="num">£ / year</th><th class="num">%</th>
        </tr>
        ${financialFootprint.by_metric
          .map(m => `<tr><td>${escapeHtml(m.label)}</td><td class="num">${fmtGbp(m.gbp)}</td><td class="num">${m.pct.toFixed(0)}%</td></tr>`)
          .join('')}
      </table>
    </div>
    <div class="col">
      <h2>Intensity</h2>
      <div class="row">
        <div class="stat col">
          <div class="lbl">per £m revenue</div>
          <div class="val">${intensity.per_m_revenue !== null ? fmtGbp(intensity.per_m_revenue) : '—'}</div>
        </div>
        <div class="stat col">
          <div class="lbl">per FTE</div>
          <div class="val">${intensity.per_fte !== null ? fmtGbp(intensity.per_fte) : '—'}</div>
        </div>
        <div class="stat col">
          <div class="lbl">per unit</div>
          <div class="val">${intensity.per_unit !== null ? fmtGbp(intensity.per_unit) : '—'}</div>
        </div>
      </div>
      <h2 style="margin-top: 10px;">Sensitivity</h2>
      <div style="font-size: 11px; line-height: 1.6;">
        At <b>${scenarioSensitivity.annual_tonnes.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO₂e</b> annual emissions,
        every <b>£10</b> change in carbon price moves the bill by
        <b style="color:#0f172a;">±${fmtGbp(scenarioSensitivity.sensitivity_gbp_per_10)}</b>.
        Bank of England stress test (£250/t) would reprice to
        <b>${fmtGbp(scenarioSensitivity.stress_gbp)}</b>.
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Highest-ROI abatement (MACC top 5)</h2>
    <table>
      <tr><th>Intervention</th><th class="num">tCO₂e / yr abated</th><th class="num">Levelised £/t</th><th class="num">Payback</th></tr>
      ${maccTop
        .slice(0, 5)
        .map(
          l => `<tr>
            <td>${escapeHtml(l.label)}</td>
            <td class="num">${l.tonnes.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</td>
            <td class="num" style="color: ${l.gbp_per_tonne < 0 ? '#10b981' : '#0f172a'};">
              ${l.gbp_per_tonne < 0 ? '-' : ''}£${Math.round(Math.abs(l.gbp_per_tonne))}/t
            </td>
            <td class="num">${l.payback_years === null ? 'N/A' : l.payback_years === 0 ? 'Instant' : `${l.payback_years.toFixed(1)} yrs`}</td>
          </tr>`,
        )
        .join('')}
    </table>
  </div>

  <!-- Page 2 -->
  <div class="page-break"></div>

  <div class="row">
    <div class="col">
      <h2>Top cost drivers (trailing 12m)</h2>
      <table>
        <tr><th>#</th><th>Line item</th><th class="num">£ / year</th><th class="num">%</th></tr>
        ${topLineItems
          .slice(0, 10)
          .map(
            l => `<tr>
              <td>${l.rank}</td>
              <td>${escapeHtml(l.label)}</td>
              <td class="num">${fmtGbp(l.gbp)}</td>
              <td class="num">${l.pct.toFixed(0)}%</td>
            </tr>`,
          )
          .join('')}
      </table>
    </div>
    <div class="col">
      <h2>Regulatory exposure</h2>
      <div style="margin-bottom: 4px;">
        <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b;">Total annual liability</span>
        <div style="font-size: 20px; font-weight: 700;">${fmtGbp(regulatory.total_gbp)}</div>
      </div>
      <table>
        <tr><th>Regime</th><th class="num">£ / year</th></tr>
        ${regulatory.lines
          .map(
            l => `<tr>
              <td>${escapeHtml(l.label)}<br/><span style="font-size: 9px; color: #94a3b8;">${escapeHtml(l.basis)}</span></td>
              <td class="num">${l.gbp > 0 ? fmtGbp(l.gbp) : '—'}</td>
            </tr>`,
          )
          .join('')}
      </table>
    </div>
  </div>

  ${
    budgets.length > 0
      ? `<div class="section" style="margin-top: 12px;">
    <h2>Carbon budgets</h2>
    <table>
      <tr><th>Budget</th><th class="num">Actual (t)</th><th class="num">Budget (t)</th><th class="num">Variance</th><th>Status</th></tr>
      ${budgets
        .map(
          b => `<tr>
            <td>${escapeHtml(b.label)}</td>
            <td class="num">${b.actual_t.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</td>
            <td class="num">${b.budget_t.toLocaleString('en-GB', { maximumFractionDigits: 1 })}</td>
            <td class="num">${b.variance_pct >= 0 ? '+' : ''}${b.variance_pct.toFixed(0)}%</td>
            <td><span class="chip chip-${b.status === 'on_track' ? 'green' : b.status === 'at_risk' ? 'amber' : 'red'}">${b.status.replace('_', ' ')}</span></td>
          </tr>`,
        )
        .join('')}
    </table>
  </div>`
      : ''
  }

  <div class="footer">
    Figures derive from alkatera Pulse metric snapshots, facility activity entries and current shadow prices.
    Abatement costs use published reference figures and should be validated with procurement quotes before capex decisions.
  </div>

</body>
</html>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
