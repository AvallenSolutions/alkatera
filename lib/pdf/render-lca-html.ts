/**
 * Server-side LCA Report HTML Renderer
 *
 * Generates a self-contained HTML document for the LCA report that can be
 * converted to PDF via PDFShift. Uses pure HTML/CSS (no React runtime or
 * Recharts) for reliable server-side rendering.
 *
 * The output is a beautiful, multi-page A4 report with:
 * - Cover page with product name and functional unit
 * - Executive summary with key metrics
 * - Methodology overview
 * - Climate impact with visual breakdowns
 * - Water footprint
 * - Circularity & waste
 * - Land use
 * - Supply chain
 * - Commitment page
 *
 * Design matches the existing report components in components/lca-report/
 */

import type { LCAReportData } from '@/components/lca-report/types';

// ============================================================================
// HELPERS
// ============================================================================

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generate CSS for a donut chart using conic-gradient.
 */
function donutGradient(segments: Array<{ value: number; color: string }>): string {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return 'background: #333;';

  let cumulative = 0;
  const stops: string[] = [];
  for (const seg of segments) {
    const start = (cumulative / total) * 360;
    cumulative += seg.value;
    const end = (cumulative / total) * 360;
    stops.push(`${seg.color} ${start}deg ${end}deg`);
  }
  return `background: conic-gradient(${stops.join(', ')});`;
}

// ============================================================================
// PAGE RENDERERS
// ============================================================================

function renderCoverPage(data: LCAReportData): string {
  const heroStyle = data.meta.heroImage
    ? `background-image: url('${data.meta.heroImage}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #292524, #1c1917);';

  return `
    <div class="page dark-page" style="justify-content: space-between; overflow: hidden; position: relative;">
      <div style="position: absolute; inset: 0; ${heroStyle} opacity: 0.6;"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent, rgba(0,0,0,0.8));"></div>

      <div style="position: relative; z-index: 10; padding-top: 48px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <div style="width: 48px; height: 48px; background: #ccff00; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 24px; font-weight: 700; color: #000;">A</span>
          </div>
          <span style="font-size: 24px; font-weight: 300; color: white; font-family: 'Inter', sans-serif;">AlkaTera</span>
        </div>
      </div>

      <div style="position: relative; z-index: 10; width: 100%; max-width: 600px;">
        <div style="background: #ccff00; color: black; padding: 32px; border-radius: 12px; margin-bottom: 96px; transform: rotate(-1deg);">
          <h2 style="font-family: 'Fira Code', monospace; font-weight: 700; font-style: italic; font-size: 24px; letter-spacing: -0.5px;">LIFE CYCLE ASSESSMENT</h2>
        </div>
        <h1 style="font-size: 72px; font-family: 'Playfair Display', serif; font-weight: 300; line-height: 1.1; margin-bottom: 16px; color: white;">
          ${escapeHtml(data.meta.productName)}
        </h1>
        <p style="font-size: 24px; color: #d6d3d1; font-weight: 300; margin-bottom: 48px;">${escapeHtml(data.meta.organization)}</p>
      </div>

      <div style="position: relative; z-index: 10; border: 1px solid rgba(255,255,255,0.2); border-radius: 24px; padding: 32px; background: rgba(0,0,0,0.4); margin-bottom: 80px;">
        <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 8px;">Functional Unit</div>
        <div style="font-size: 32px; font-family: 'Playfair Display', serif; color: white; margin-bottom: 8px;">1 unit of ${escapeHtml(data.meta.productName)}</div>
        <p style="color: #a8a29e; font-size: 14px; max-width: 500px;">${escapeHtml(data.functionalUnit.description)}</p>
      </div>

      ${renderPageFooter(undefined, true)}
    </div>`;
}

function renderExecSummaryPage(data: LCAReportData): string {
  const dqColor = data.executiveSummary.dataQualityScore >= 80 ? '#22c55e' :
    data.executiveSummary.dataQualityScore >= 50 ? '#eab308' : '#ef4444';

  return `
    <div class="page light-page">
      ${renderSectionHeader('01', 'Executive Summary')}

      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div style="flex: 1; background: #1c1917; border-radius: 16px; padding: 32px; color: white;">
          <div style="font-size: 12px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Key Insight</div>
          <div style="font-size: 48px; font-family: 'Playfair Display', serif; font-weight: 700; color: #ccff00;">${escapeHtml(data.executiveSummary.keyHighlight.value)}</div>
          <div style="font-size: 16px; color: #a8a29e; margin-top: 4px;">${escapeHtml(data.executiveSummary.keyHighlight.label)}</div>
          <div style="font-size: 12px; color: #78716c; margin-top: 4px;">${escapeHtml(data.executiveSummary.keyHighlight.subtext)}</div>
        </div>

        <div style="width: 200px; background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 11px; font-family: 'Fira Code', monospace; text-transform: uppercase; letter-spacing: 2px; color: #78716c; margin-bottom: 16px;">Data Quality</div>
          <div style="width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 12px; position: relative; background: conic-gradient(${dqColor} ${data.executiveSummary.dataQualityScore * 3.6}deg, #e7e5e4 0deg);">
            <div style="position: absolute; inset: 12px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 32px; font-weight: 700; font-family: 'Playfair Display', serif; color: ${dqColor};">${data.executiveSummary.dataQualityScore}%</span>
            </div>
          </div>
        </div>
      </div>

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
        <p style="font-size: 14px; line-height: 1.8; color: #44403c;">${escapeHtml(data.executiveSummary.content)}</p>
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
        <div class="metric-card">
          <div class="metric-label">Climate Impact</div>
          <div class="metric-value">${escapeHtml(data.climateImpact.totalCarbon)}</div>
          <div class="metric-unit">kg CO&#8322;e</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Water Footprint</div>
          <div class="metric-value">${escapeHtml(data.waterFootprint.totalConsumption)}</div>
          <div class="metric-unit">litres</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Circularity</div>
          <div class="metric-value">${data.circularity.recyclingRate}%</div>
          <div class="metric-unit">recycling rate</div>
        </div>
      </div>

      ${renderPageFooter(1)}
    </div>`;
}

function renderMethodologyPage(data: LCAReportData): string {
  const included = data.methodology.includedStages.map(s =>
    `<div style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
      <div style="width: 20px; height: 20px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: white; font-size: 12px;">&#10003;</span>
      </div>
      <span style="font-size: 14px; color: #44403c;">${escapeHtml(s)}</span>
    </div>`
  ).join('');

  const excluded = data.methodology.excludedStages.map(s =>
    `<div style="display: flex; align-items: center; gap: 8px; padding: 8px 0;">
      <div style="width: 20px; height: 20px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: white; font-size: 12px;">&#10007;</span>
      </div>
      <span style="font-size: 14px; color: #44403c;">${escapeHtml(s)}</span>
    </div>`
  ).join('');

  const dataSources = data.methodology.dataSources.map(ds =>
    `<div style="display: flex; justify-content: space-between; padding: 12px 16px; background: #fafaf9; border-radius: 8px; margin-bottom: 8px;">
      <span style="font-size: 14px; font-weight: 500;">${escapeHtml(ds.name)}</span>
      <span style="font-size: 14px; color: #78716c;">${ds.count} factors</span>
    </div>`
  ).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('02', 'Methodology')}

      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div style="flex: 1;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1c1917;">Included Stages</h3>
          ${included}
        </div>
        <div style="flex: 1;">
          <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1c1917;">Excluded Stages</h3>
          ${excluded}
        </div>
      </div>

      <div>
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1c1917;">Data Sources</h3>
        ${dataSources}
      </div>

      ${renderPageFooter(2)}
    </div>`;
}

function renderClimatePage(data: LCAReportData): string {
  const maxStageValue = Math.max(...data.climateImpact.stages.map(s => s.value), 0.001);

  const stagesBars = data.climateImpact.stages.map(stage =>
    `<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 140px; font-size: 12px; color: #78716c; text-align: right; flex-shrink: 0;">${escapeHtml(stage.label)}</div>
      <div style="flex: 1; height: 32px; background: #292524; border-radius: 6px; overflow: hidden;">
        <div style="height: 100%; width: ${Math.max((stage.value / maxStageValue) * 100, 1)}%; background: ${stage.color}; border-radius: 6px;"></div>
      </div>
      <div style="width: 80px; font-size: 12px; color: #a8a29e; flex-shrink: 0;">${stage.value.toFixed(3)} ${escapeHtml(stage.unit)}</div>
      <div style="width: 50px; font-size: 11px; color: #ccff00; text-align: right; flex-shrink: 0;">${escapeHtml(stage.percentage)}</div>
    </div>`
  ).join('');

  const donutStyle = donutGradient(data.climateImpact.breakdown);

  return `
    <div class="page dark-page">
      ${renderSectionHeader('03', 'Climate Impact', true)}

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
        <div>
          <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #78716c; margin-bottom: 8px;">TOTAL CLIMATE IMPACT</div>
          <div style="font-size: 72px; font-family: 'Playfair Display', serif; color: #ccff00; line-height: 1;">
            ${escapeHtml(data.climateImpact.totalCarbon)}
            <span style="font-size: 20px; color: #78716c; font-family: 'Inter', sans-serif; margin-left: 8px;">kg CO&#8322;e</span>
          </div>
        </div>
        <div style="width: 200px; height: 200px; border-radius: 50%; ${donutStyle} position: relative;">
          <div style="position: absolute; inset: 50px; background: #1c1917; border-radius: 50%;"></div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 14px; font-family: 'Fira Code', monospace; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Lifecycle Stage Breakdown</h3>
        ${stagesBars}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px;">
        ${data.climateImpact.breakdown.map(b =>
          `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${b.color};"></div>
            <span style="font-size: 11px; color: #a8a29e;">${escapeHtml(b.name)}</span>
          </div>`
        ).join('')}
      </div>

      ${renderPageFooter(3, true)}
    </div>`;
}

function renderWaterPage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('04', 'Water Footprint')}

      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div style="flex: 1; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 11px; font-family: 'Fira Code', monospace; color: #3b82f6; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Total Consumption</div>
          <div style="font-size: 48px; font-weight: 700; font-family: 'Playfair Display', serif; color: #1e40af;">${escapeHtml(data.waterFootprint.totalConsumption)}</div>
          <div style="font-size: 14px; color: #60a5fa;">litres</div>
        </div>
        <div style="flex: 1; background: #fef3c7; border: 1px solid #fde68a; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="font-size: 11px; font-family: 'Fira Code', monospace; color: #d97706; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px;">Scarcity-Weighted</div>
          <div style="font-size: 48px; font-weight: 700; font-family: 'Playfair Display', serif; color: #92400e;">${escapeHtml(data.waterFootprint.scarcityWeighted)}</div>
          <div style="font-size: 14px; color: #d97706;">litres eq.</div>
        </div>
      </div>

      ${data.waterFootprint.sources.length > 0 ? `
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Water Sources</h3>
        <table class="data-table">
          <thead><tr><th>Source</th><th>Location</th><th>Volume</th><th>Risk Level</th></tr></thead>
          <tbody>
            ${data.waterFootprint.sources.map(s => `
              <tr>
                <td>${escapeHtml(s.source)}</td>
                <td>${escapeHtml(s.location)}</td>
                <td>${escapeHtml(s.volume)}</td>
                <td><span class="badge badge-${s.risk.toLowerCase()}">${escapeHtml(s.risk)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${renderPageFooter(4)}
    </div>`;
}

function renderCircularityPage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('05', 'Circularity & Waste')}

      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div style="flex: 1; text-align: center;">
          <div style="width: 160px; height: 160px; border-radius: 50%; margin: 0 auto 16px; position: relative; background: conic-gradient(#22c55e ${data.circularity.recyclingRate * 3.6}deg, #e7e5e4 0deg);">
            <div style="position: absolute; inset: 16px; background: #f5f5f4; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 36px; font-weight: 700; font-family: 'Playfair Display', serif; color: #22c55e;">${data.circularity.recyclingRate}%</span>
            </div>
          </div>
          <div style="font-size: 14px; color: #78716c;">Recycling Rate</div>
        </div>
        <div style="flex: 1;">
          <div class="metric-card" style="margin-bottom: 16px;">
            <div class="metric-label">Total Waste</div>
            <div class="metric-value">${escapeHtml(data.circularity.totalWaste)}</div>
          </div>
          <div class="metric-card">
            <div class="metric-label">Circularity Score</div>
            <div class="metric-value">${escapeHtml(data.circularity.circularityScore)}</div>
          </div>
        </div>
      </div>

      ${data.circularity.wasteStream.length > 0 ? `
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Waste Streams</h3>
        <table class="data-table">
          <thead><tr><th>Stream</th><th>Volume</th><th>Status</th></tr></thead>
          <tbody>
            ${data.circularity.wasteStream.map(ws => `
              <tr>
                <td>${escapeHtml(ws.label)}</td>
                <td>${escapeHtml(ws.value)}</td>
                <td>${ws.recycled
                  ? '<span class="badge badge-low">Recycled</span>'
                  : '<span class="badge badge-medium">Waste</span>'
                }</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${renderPageFooter(5)}
    </div>`;
}

function renderLandUsePage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('06', 'Land Use')}

      <div class="metric-card" style="margin-bottom: 24px; text-align: center; padding: 32px;">
        <div class="metric-label">Total Land Use</div>
        <div style="font-size: 48px; font-family: 'Playfair Display', serif; font-weight: 700; color: #166534;">${escapeHtml(data.landUse.totalLandUse)}</div>
        <div class="metric-unit">m&#178; per year</div>
      </div>

      ${data.landUse.breakdown.length > 0 ? `
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 16px;">Material Breakdown</h3>
        <table class="data-table">
          <thead><tr><th>Material</th><th>Origin</th><th>Mass</th><th>Intensity</th><th>Footprint</th></tr></thead>
          <tbody>
            ${data.landUse.breakdown.map(item => `
              <tr>
                <td style="font-weight: 500;">${escapeHtml(item.material)}</td>
                <td>${escapeHtml(item.origin)}</td>
                <td>${escapeHtml(item.mass)}</td>
                <td>${item.intensity.toFixed(2)}</td>
                <td>${escapeHtml(item.footprint)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${renderPageFooter(6)}
    </div>`;
}

function renderSupplyChainPage(data: LCAReportData): string {
  const networkHtml = data.supplyChain.network.map(category => `
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 14px; font-weight: 600; color: #1c1917; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #e7e5e4;">${escapeHtml(category.category)}</h3>
      ${category.items.map(item => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #fafaf9;">
          <div>
            <div style="font-size: 14px; font-weight: 500;">${escapeHtml(item.name)}</div>
            <div style="font-size: 12px; color: #78716c;">${escapeHtml(item.location)}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 14px; color: #44403c;">${escapeHtml(item.distance)}</div>
            <div style="font-size: 12px; color: #78716c;">${escapeHtml(item.co2)}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('07', 'Supply Chain')}

      <div style="display: flex; gap: 24px; margin-bottom: 32px;">
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Total Distance</div>
          <div class="metric-value">${escapeHtml(data.supplyChain.totalDistance)}</div>
        </div>
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Verified Suppliers</div>
          <div class="metric-value">${escapeHtml(data.supplyChain.verifiedSuppliers)}</div>
        </div>
      </div>

      ${networkHtml}

      ${renderPageFooter(7)}
    </div>`;
}

function renderCommitmentPage(data: LCAReportData): string {
  return `
    <div class="page dark-page" style="justify-content: center; text-align: center;">
      <div style="max-width: 500px; margin: 0 auto;">
        <div style="width: 64px; height: 64px; background: #ccff00; border-radius: 16px; display: flex; align-items: center; justify-content: center; margin: 0 auto 32px;">
          <span style="font-size: 32px; font-weight: 700; color: #000;">A</span>
        </div>
        <h2 style="font-size: 36px; font-family: 'Playfair Display', serif; font-weight: 300; margin-bottom: 24px; color: white;">Our Commitment</h2>
        <p style="font-size: 16px; line-height: 1.8; color: #a8a29e;">${escapeHtml(data.commitment.text)}</p>

        <div style="margin-top: 64px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1);">
          <p style="font-size: 12px; color: #78716c; font-family: 'Fira Code', monospace;">
            Report generated by AlkaTera Platform<br />
            ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      ${renderPageFooter(8, true)}
    </div>`;
}

// ============================================================================
// SHARED ELEMENTS
// ============================================================================

function renderSectionHeader(number: string, title: string, dark = false): string {
  const borderColor = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  return `
    <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: 48px; border-bottom: 1px solid ${borderColor}; padding-bottom: 16px;">
      <span style="color: #ccff00; font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 700; letter-spacing: 3px;">${number}</span>
      <h2 style="font-size: 36px; font-family: 'Playfair Display', serif; font-weight: 300;">${escapeHtml(title)}</h2>
    </div>`;
}

function renderPageFooter(pageNumber?: number, dark = false): string {
  const color = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div style="position: absolute; bottom: 48px; left: 48px; right: 48px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; font-family: 'Fira Code', monospace; color: ${color}; text-transform: uppercase; letter-spacing: 3px; border-top: 1px solid ${color}; padding-top: 16px;">
      <div style="display: flex; gap: 32px;">
        <span>Generated by</span>
        <span style="font-weight: 700;">AlkaTera</span>
        <span>Platform</span>
      </div>
      ${pageNumber ? `<div style="font-weight: 700; font-size: 12px;">${pageNumber}</div>` : ''}
      <div>ISO 14040/44 Compliant | ${dateStr}</div>
    </div>`;
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

/**
 * Render the full LCA report as a self-contained HTML document.
 *
 * This HTML can be sent directly to PDFShift for conversion to PDF.
 * Uses pure HTML/CSS with Google Fonts — no React runtime, no Recharts,
 * no Tailwind CDN required. Charts are rendered using CSS conic-gradient.
 */
export function renderLcaReportHtml(data: LCAReportData): string {
  const pages = [
    renderCoverPage(data),
    renderExecSummaryPage(data),
    renderMethodologyPage(data),
    renderClimatePage(data),
    renderWaterPage(data),
    renderCircularityPage(data),
    renderLandUsePage(data),
    renderSupplyChainPage(data),
    renderCommitmentPage(data),
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCA Report — ${escapeHtml(data.meta.productName)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Fira+Code:wght@400;500;600;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
      color: #1c1917;
    }

    @page { size: A4; margin: 0; }

    .page {
      width: 794px;
      height: 1123px;
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 48px;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }

    .page:last-child { page-break-after: auto; break-after: auto; }

    .dark-page { background: #1c1917; color: white; }
    .light-page { background: #f5f5f4; color: #1c1917; }

    .metric-card {
      background: white;
      border: 1px solid #e7e5e4;
      border-radius: 12px;
      padding: 20px;
    }

    .metric-label {
      font-size: 11px;
      font-family: 'Fira Code', monospace;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #78716c;
      margin-bottom: 8px;
    }

    .metric-value {
      font-size: 32px;
      font-family: 'Playfair Display', serif;
      font-weight: 700;
      color: #1c1917;
    }

    .metric-unit {
      font-size: 12px;
      color: #a8a29e;
      margin-top: 4px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table thead th {
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-family: 'Fira Code', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #78716c;
      border-bottom: 2px solid #e7e5e4;
    }

    .data-table tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid #f5f5f4;
      color: #44403c;
    }

    .data-table tbody tr:nth-child(even) { background: #fafaf9; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .badge-low { background: #dcfce7; color: #166534; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-high { background: #fee2e2; color: #991b1b; }

    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${pages}
</body>
</html>`;
}
