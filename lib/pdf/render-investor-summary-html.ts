/**
 * Investor Summary HTML Renderer
 *
 * A focused 2-page PDF-ready summary for investor audiences:
 *   Page 1 — Emissions overview, scope breakdown, YoY change, SBTi badge
 *   Page 2 — Key findings, targets, transition milestones, risks
 *
 * Self-contained HTML using the same design system as render-sustainability-report-html.ts.
 * Intended for use with PDFShift (A4, no page breaks).
 */

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(value: number, decimals = 1): string {
  if (value === null || value === undefined || isNaN(value)) return 'N/A';
  return value.toLocaleString('en-GB', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function badge(text: string, bg: string, color: string): string {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:${bg};color:${color};">${escapeHtml(text)}</span>`;
}

// ============================================================================
// TYPES
// ============================================================================

export interface InvestorSummaryData {
  organisationName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  sector?: string;
  emissions: { scope1: number; scope2: number; scope3: number; total: number };
  yoyChangePct?: string;
  sbtiAligned?: boolean;
  sbtiTargetYear?: number;
  targets?: Array<{ scope: string; targetYear: number; reductionPct: number }>;
  milestones?: Array<{ title: string; targetDate: string; status: string }>;
  risks?: Array<{ title: string; type: 'risk' | 'opportunity'; likelihood: string; impact: string }>;
  keyFindings?: Array<{ title: string; narrative: string }>;
  primaryMessage?: string;
  branding: { logo: string | null; primaryColor: string };
}

const ALKATERA_LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

// ============================================================================
// RENDERER
// ============================================================================

export function renderInvestorSummaryHtml(data: InvestorSummaryData): string {
  const primary = data.branding.primaryColor || '#ccff00';
  const total = data.emissions.total;
  const scope3Pct = total > 0 ? ((data.emissions.scope3 / total) * 100).toFixed(0) : '0';
  const scope1Pct = total > 0 ? ((data.emissions.scope1 / total) * 100).toFixed(0) : '0';
  const scope2Pct = total > 0 ? ((data.emissions.scope2 / total) * 100).toFixed(0) : '0';

  const yoyArrow = data.yoyChangePct
    ? (data.yoyChangePct.startsWith('-') ? '&#8595;' : '&#8593;')
    : '';
  const yoyColor = data.yoyChangePct?.startsWith('-') ? '#22c55e' : '#ef4444';

  const scopeRows = [
    { label: 'Scope 1 — Direct', value: data.emissions.scope1, pct: scope1Pct, color: '#22c55e' },
    { label: 'Scope 2 — Energy', value: data.emissions.scope2, pct: scope2Pct, color: '#3b82f6' },
    { label: 'Scope 3 — Value chain', value: data.emissions.scope3, pct: scope3Pct, color: '#f97316' },
  ];

  const topTargets = (data.targets || []).slice(0, 3);
  const topMilestones = (data.milestones || [])
    .filter(m => m.status !== 'complete')
    .slice(0, 4);
  const topRisks = (data.risks || []).slice(0, 6);
  const topFindings = (data.keyFindings || []).slice(0, 3);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Investor Summary — ${escapeHtml(data.organisationName)} ${data.reportYear}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700&family=Fira+Code:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: #1c1917; }
    @page { size: A4; margin: 0; }
    .page {
      width: 794px; height: 1123px; position: relative;
      display: flex; flex-direction: column;
      padding: 52px; overflow: hidden;
      page-break-after: always; break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    h1 { font-family: 'Playfair Display', serif; }
    .mono { font-family: 'Fira Code', monospace; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: #78716c; margin-bottom: 6px; }
    .divider { height: 1px; background: #e7e5e4; margin: 20px 0; }
    .scope-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .scope-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .bar-outer { flex: 1; height: 8px; background: #e7e5e4; border-radius: 4px; overflow: hidden; }
    .bar-inner { height: 100%; border-radius: 4px; }
  </style>
</head>
<body>

<!-- PAGE 1: Emissions Overview -->
<div class="page" style="background: #1c1917; color: white;">
  <!-- Header strip -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 36px;">
    <div>
      <div class="label mono" style="color: ${primary}; font-size: 10px;">Investor Summary</div>
      <h1 style="font-size: 28px; font-weight: 700; color: white; margin-top: 4px; line-height: 1.2;">
        ${escapeHtml(data.organisationName)}
      </h1>
      <div style="font-size: 13px; color: #a8a29e; margin-top: 4px;">
        ${data.reportYear} Sustainability Disclosure &bull; ${data.sector || 'Beverages & Spirits'}
      </div>
    </div>
    <div style="text-align: right;">
      ${data.branding.logo
        ? `<img src="${escapeHtml(data.branding.logo)}" style="height: 36px; object-fit: contain; margin-bottom: 8px;" />`
        : `<img src="${ALKATERA_LOGO_URL}" style="height: 28px; object-fit: contain; margin-bottom: 8px;" />`}
      ${data.sbtiAligned ? `<div style="display:flex;justify-content:flex-end;">${badge('SBTi Aligned', primary, '#000')}</div>` : ''}
    </div>
  </div>

  <!-- Total emissions hero -->
  <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 28px 32px; margin-bottom: 24px; display: flex; align-items: center; justify-content: space-between;">
    <div>
      <div class="label mono" style="color: #a8a29e;">Total GHG Emissions</div>
      <div style="font-family: 'Playfair Display', serif; font-size: 52px; font-weight: 700; color: ${primary}; line-height: 1;">
        ${fmt(total, 0)}
      </div>
      <div style="font-size: 13px; color: #78716c; margin-top: 4px;">tCO2e &bull; ${data.reportYear}</div>
    </div>
    ${data.yoyChangePct ? `
    <div style="text-align: center; background: rgba(255,255,255,0.08); border-radius: 12px; padding: 16px 24px;">
      <div class="label mono" style="color: #a8a29e;">YoY Change</div>
      <div style="font-size: 36px; font-weight: 700; color: ${yoyColor}; line-height: 1;">${yoyArrow} ${escapeHtml(data.yoyChangePct)}</div>
      <div style="font-size: 11px; color: #78716c; margin-top: 4px;">vs prior year</div>
    </div>
    ` : ''}
  </div>

  <!-- Scope breakdown -->
  <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px 28px; margin-bottom: 24px;">
    <div class="label mono" style="color: #a8a29e; margin-bottom: 16px;">Emissions by Scope</div>
    ${scopeRows.map(s => `
    <div class="scope-row">
      <div class="scope-dot" style="background: ${s.color};"></div>
      <div style="font-size: 13px; color: #d6d3d1; min-width: 160px;">${escapeHtml(s.label)}</div>
      <div class="bar-outer">
        <div class="bar-inner" style="width: ${s.pct}%; background: ${s.color};"></div>
      </div>
      <div style="font-size: 12px; font-weight: 600; color: white; min-width: 80px; text-align: right;">${fmt(s.value, 0)} tCO2e</div>
      <div style="font-size: 11px; color: #78716c; min-width: 36px; text-align: right;">${s.pct}%</div>
    </div>
    `).join('')}
  </div>

  ${data.primaryMessage ? `
  <!-- Primary message -->
  <div style="background: rgba(${parseInt(primary.slice(1, 3), 16)},${parseInt(primary.slice(3, 5), 16)},${parseInt(primary.slice(5, 7), 16)},0.1); border-left: 3px solid ${primary}; border-radius: 0 12px 12px 0; padding: 16px 20px;">
    <div class="label mono" style="color: ${primary}; margin-bottom: 6px;">Key Message</div>
    <div style="font-size: 14px; color: #f5f5f4; line-height: 1.6; font-weight: 500; font-style: italic;">
      "${escapeHtml(data.primaryMessage)}"
    </div>
  </div>
  ` : ''}

  <!-- Footer -->
  <div style="position: absolute; bottom: 32px; left: 52px; right: 52px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 10px; color: #57534e;">Prepared by alkatera &bull; ${escapeHtml(data.reportingPeriodStart)} to ${escapeHtml(data.reportingPeriodEnd)}</div>
    <div style="font-size: 10px; color: #57534e;">Page 1 of 2 &bull; Investor Summary</div>
  </div>
</div>

<!-- PAGE 2: Targets, Milestones, Risks -->
<div class="page">
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px;">
    <div>
      <div class="label mono" style="color: ${primary};">Targets &amp; Transition</div>
      <h1 style="font-size: 22px; color: #1c1917; margin-top: 4px;">${escapeHtml(data.organisationName)}</h1>
    </div>
    <div style="font-size: 12px; color: #a8a29e;">${data.reportYear} Investor Summary</div>
  </div>

  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1;">

    <!-- Left: Targets + Milestones -->
    <div>
      ${topTargets.length > 0 ? `
      <div class="label mono" style="margin-bottom: 12px;">Reduction Targets</div>
      ${topTargets.map(t => `
      <div style="background: #f5f5f4; border-radius: 10px; padding: 14px 16px; margin-bottom: 8px;">
        <div style="font-size: 13px; font-weight: 600; color: #1c1917;">${t.reductionPct}% reduction</div>
        <div style="font-size: 11px; color: #78716c; margin-top: 2px;">
          ${escapeHtml(t.scope.replace('scope', 'Scope '))} &bull; By ${t.targetYear}
        </div>
      </div>
      `).join('')}
      <div class="divider"></div>
      ` : ''}

      ${topMilestones.length > 0 ? `
      <div class="label mono" style="margin-bottom: 12px;">Upcoming Milestones</div>
      ${topMilestones.map(m => `
      <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: flex-start;">
        <div style="width: 8px; height: 8px; border-radius: 50%; background: ${m.status === 'in_progress' ? '#f59e0b' : '#e7e5e4'}; margin-top: 4px; flex-shrink: 0;"></div>
        <div>
          <div style="font-size: 12px; font-weight: 500; color: #1c1917;">${escapeHtml(m.title)}</div>
          <div style="font-size: 11px; color: #78716c;">${escapeHtml(m.targetDate)}</div>
        </div>
      </div>
      `).join('')}
      ` : ''}

      ${topFindings.length > 0 ? `
      <div class="divider"></div>
      <div class="label mono" style="margin-bottom: 12px;">Key Findings</div>
      ${topFindings.map(f => `
      <div style="margin-bottom: 10px;">
        <div style="font-size: 12px; font-weight: 600; color: #1c1917;">${escapeHtml(f.title)}</div>
        <div style="font-size: 11px; color: #57534e; line-height: 1.5; margin-top: 2px;">${escapeHtml(f.narrative)}</div>
      </div>
      `).join('')}
      ` : ''}
    </div>

    <!-- Right: Climate Risks & Opportunities -->
    <div>
      ${topRisks.length > 0 ? `
      <div class="label mono" style="margin-bottom: 12px;">Climate Risks &amp; Opportunities</div>
      ${topRisks.map(r => {
        const isOpp = r.type === 'opportunity';
        const bg = isOpp ? '#f0fdf4' : '#fff7ed';
        const dot = isOpp ? '#22c55e' : '#f97316';
        return `
        <div style="background: ${bg}; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 7px; height: 7px; border-radius: 50%; background: ${dot}; flex-shrink: 0;"></div>
            <div style="font-size: 12px; font-weight: 600; color: #1c1917;">${escapeHtml(r.title)}</div>
          </div>
          <div style="font-size: 10px; color: #78716c; padding-left: 15px;">
            ${escapeHtml(r.likelihood)} likelihood &bull; ${escapeHtml(r.impact)} impact
          </div>
        </div>
        `;
      }).join('')}
      ` : `
      <div style="background: #f5f5f4; border-radius: 10px; padding: 24px; text-align: center; color: #a8a29e; font-size: 12px;">
        No climate risks and opportunities have been recorded yet.
      </div>
      `}
    </div>
  </div>

  <!-- Footer -->
  <div style="position: absolute; bottom: 32px; left: 52px; right: 52px; display: flex; justify-content: space-between; align-items: center;">
    <div style="font-size: 10px; color: #a8a29e;">Prepared by alkatera &bull; Data covers ${escapeHtml(data.reportingPeriodStart)} to ${escapeHtml(data.reportingPeriodEnd)}</div>
    <div style="font-size: 10px; color: #a8a29e;">Page 2 of 2</div>
  </div>
</div>

</body>
</html>`;
}
