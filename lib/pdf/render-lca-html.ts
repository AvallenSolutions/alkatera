/**
 * Server-side LCA Report HTML Renderer
 *
 * Generates a self-contained HTML document for the LCA report that can be
 * converted to PDF via PDFShift. Uses pure HTML/CSS (no React runtime or
 * Recharts) for reliable server-side rendering.
 *
 * The output is a comprehensive, ISO 14044-compliant multi-page A4 report with:
 * - Cover page with product image, name and functional unit
 * - Executive summary with key metrics
 * - Goal & scope definition (ISO 14044 §4.2)
 * - Methodology & LCIA method detail (ISO 14044 §4.4)
 * - Data quality assessment (ISO 14044 §4.2.3.6)
 * - Climate impact with visual breakdowns
 * - Detailed GHG reporting (ISO 14067 — biogenic, CH₄, N₂O)
 * - Environmental impact categories (acidification, eutrophication, etc.)
 * - Ingredient-level impact breakdown
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
// BRAND ELEMENTS
// ============================================================================

const ALKATERA_LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

/** Renders the alkatera logo as an <img> element. Use dark=false to render in black for light backgrounds. */
function alkateraLogo(height: number, dark = true): string {
  const filter = dark ? '' : 'filter: brightness(0);';
  return `<img src="${ALKATERA_LOGO_URL}" alt="alkatera" style="height: ${height}px; width: auto; object-fit: contain; ${filter}" />`;
}

// ============================================================================
// PAGE RENDERERS
// ============================================================================

function renderCoverPage(data: LCAReportData): string {
  const heroStyle = data.meta.heroImage
    ? `background-image: url('${data.meta.heroImage}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #292524, #1c1917);';

  const productImageHtml = data.meta.productImageUrl
    ? `<div style="position: absolute; top: 80px; right: 48px; z-index: 10; width: 220px; height: 280px; border-radius: 16px; overflow: hidden; border: 2px solid rgba(204,255,0,0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
        <img src="${escapeHtml(data.meta.productImageUrl)}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(data.meta.productName)}" />
      </div>`
    : '';

  return `
    <div class="page dark-page" style="justify-content: space-between; overflow: hidden; position: relative;">
      <div style="position: absolute; inset: 0; ${heroStyle} opacity: 0.6;"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(0,0,0,0.4), transparent, rgba(0,0,0,0.8));"></div>

      ${productImageHtml}

      <div style="position: relative; z-index: 10; padding-top: 48px;">
        ${alkateraLogo(44)}
      </div>

      <div style="position: relative; z-index: 10; width: 100%; max-width: 500px;">
        <div style="background: #ccff00; color: black; padding: 24px 32px; border-radius: 12px; margin-bottom: 80px; transform: rotate(-1deg);">
          <h2 style="font-family: 'Fira Code', monospace; font-weight: 700; font-style: italic; font-size: 22px; letter-spacing: -0.5px;">LIFE CYCLE ASSESSMENT</h2>
          <p style="font-size: 11px; margin-top: 4px; opacity: 0.7;">ISO 14044:2006 &amp; ISO 14067:2018 Compliant</p>
        </div>
        <h1 style="font-size: 64px; font-family: 'Playfair Display', serif; font-weight: 300; line-height: 1.1; margin-bottom: 16px; color: white;">
          ${escapeHtml(data.meta.productName)}
        </h1>
        <p style="font-size: 22px; color: #d6d3d1; font-weight: 300; margin-bottom: 32px;">${escapeHtml(data.meta.organization)}</p>
        ${data.meta.productDescription ? `<p style="font-size: 13px; color: #a8a29e; max-width: 420px; line-height: 1.6;">${escapeHtml(data.meta.productDescription)}</p>` : ''}
      </div>

      <div style="position: relative; z-index: 10; display: flex; gap: 16px; margin-bottom: 80px;">
        <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4); flex: 1;">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">Functional Unit</div>
          <div style="font-size: 16px; font-family: 'Playfair Display', serif; color: white;">${escapeHtml(data.functionalUnit.value)}</div>
        </div>
        <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4);">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">System Boundary</div>
          <div style="font-size: 16px; font-family: 'Playfair Display', serif; color: white;">${escapeHtml(data.meta.lcaScopeType || 'Cradle-to-Gate')}</div>
        </div>
        <div style="border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 20px 24px; background: rgba(0,0,0,0.4);">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #ccff00; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 6px;">Reference Year</div>
          <div style="font-size: 16px; font-family: 'Playfair Display', serif; color: white;">${data.meta.referenceYear || new Date().getFullYear()}</div>
        </div>
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
        <p style="font-size: 13px; line-height: 1.8; color: #44403c;">${escapeHtml(data.executiveSummary.content)}</p>
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

function renderGoalAndScopePage(data: LCAReportData): string {
  const assumptions = data.goalAndScope.assumptionsAndLimitations.map(al =>
    `<div style="display: flex; gap: 10px; padding: 10px 0; border-bottom: 1px solid #f5f5f4;">
      <span class="badge ${al.type === 'Assumption' ? 'badge-low' : 'badge-medium'}" style="flex-shrink: 0; align-self: flex-start; margin-top: 2px;">${escapeHtml(al.type)}</span>
      <span style="font-size: 12px; color: #44403c; line-height: 1.5;">${escapeHtml(al.text)}</span>
    </div>`
  ).join('');

  const audience = data.goalAndScope.intendedAudience.map(a =>
    `<span style="display: inline-block; padding: 3px 10px; background: #f0fdf4; color: #166534; border-radius: 8px; font-size: 11px; margin-right: 6px; margin-bottom: 4px;">${escapeHtml(a)}</span>`
  ).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('02', 'Goal & Scope Definition')}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px;">ISO 14044:2006 &sect;4.2</div>
        ${/* ISSUE E FIX: Display report version identifier (ISO 14044 §4.2.1). */ ''}
        <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; letter-spacing: 1px;">Report Version ${escapeHtml(data.meta.version)}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">Intended Application</div>
          <p style="font-size: 12px; color: #44403c; line-height: 1.6;">${escapeHtml(data.goalAndScope.intendedApplication)}</p>
        </div>
        <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">Reasons for Study</div>
          <p style="font-size: 12px; color: #44403c; line-height: 1.6;">${escapeHtml(data.goalAndScope.reasonsForStudy)}</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px;">
        <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">Intended Audience</div>
          <div>${audience}</div>
        </div>
        <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
          <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">Comparative Assertion</div>
          <p style="font-size: 12px; color: #44403c;">${data.goalAndScope.isComparativeAssertion ? 'Yes — this study supports comparative assertions intended for public disclosure. A critical review panel is required per ISO 14044 §6.3.' : 'No — this study does not support comparative assertions disclosed to the public.'}</p>
        </div>
      </div>

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">System Boundary — ${escapeHtml(data.goalAndScope.systemBoundary)}</div>
        <p style="font-size: 12px; color: #44403c; line-height: 1.6; margin-bottom: 12px;">${escapeHtml(data.goalAndScope.systemBoundaryDescription)}</p>
        <div style="display: flex; gap: 16px;">
          <div style="flex: 1; font-size: 11px;">
            <div style="font-weight: 600; color: #166534; margin-bottom: 6px;">Cut-off Criteria</div>
            <p style="color: #44403c; line-height: 1.5;">${escapeHtml(data.goalAndScope.cutOffCriteria)}</p>
          </div>
          <div style="flex: 1; font-size: 11px;">
            <div style="font-weight: 600; color: #1e40af; margin-bottom: 6px;">Allocation Procedure</div>
            <p style="color: #44403c; line-height: 1.5;">${escapeHtml(data.goalAndScope.allocationProcedure)}</p>
          </div>
        </div>
      </div>

      <div style="flex: 1; min-height: 0; overflow: hidden; margin-bottom: 48px;">
        <div style="font-size: 11px; font-weight: 600; color: #1c1917; margin-bottom: 8px;">Assumptions &amp; Limitations</div>
        ${assumptions}
      </div>

      ${renderPageFooter(2)}
    </div>`;
}

function renderMethodologyPage(data: LCAReportData): string {
  const included = data.methodology.includedStages.map(s =>
    `<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0;">
      <div style="width: 18px; height: 18px; background: #22c55e; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: white; font-size: 10px;">&#10003;</span>
      </div>
      <span style="font-size: 12px; color: #44403c;">${escapeHtml(s)}</span>
    </div>`
  ).join('');

  const excluded = data.methodology.excludedStages.map(s =>
    `<div style="display: flex; align-items: center; gap: 8px; padding: 6px 0;">
      <div style="width: 18px; height: 18px; background: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="color: white; font-size: 10px;">&#10007;</span>
      </div>
      <span style="font-size: 12px; color: #44403c;">${escapeHtml(s)}</span>
    </div>`
  ).join('');

  const dataSources = data.methodology.dataSources.map(ds =>
    `<div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: #fafaf9; border-radius: 8px; margin-bottom: 6px;">
      <div>
        <span style="font-size: 13px; font-weight: 500;">${escapeHtml(ds.name)}</span>
        ${ds.version ? `<span style="font-size: 10px; color: #78716c; margin-left: 6px;">v${escapeHtml(ds.version)}</span>` : ''}
        ${ds.description ? `<div style="font-size: 10px; color: #a8a29e; margin-top: 2px;">${escapeHtml(ds.description)}</div>` : ''}
      </div>
      <span style="font-size: 13px; color: #78716c; font-weight: 500;">${ds.count} factors</span>
    </div>`
  ).join('');

  const charModels = data.methodology.characterizationModels.map(cm =>
    `<tr>
      <td style="font-weight: 500;">${escapeHtml(cm.category)}</td>
      <td>${escapeHtml(cm.model)}</td>
      <td style="font-size: 11px; color: #78716c;">${escapeHtml(cm.reference)}</td>
    </tr>`
  ).join('');

  const software = data.methodology.softwareAndDatabases.map(s =>
    `<div style="display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f5f5f4;">
      <span style="font-size: 12px; font-weight: 500; width: 140px;">${escapeHtml(s.name)} <span style="color: #78716c; font-weight: 400;">v${escapeHtml(s.version)}</span></span>
      <span style="font-size: 11px; color: #78716c;">${escapeHtml(s.purpose)}</span>
    </div>`
  ).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('03', 'Methodology')}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">ISO 14044:2006 &sect;4.3 &amp; &sect;4.4</div>

      <div style="display: flex; gap: 20px; margin-bottom: 20px;">
        <div style="flex: 1;">
          <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #1c1917;">Included Stages</h3>
          ${included}
        </div>
        <div style="flex: 1;">
          <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #1c1917;">Excluded Stages</h3>
          ${excluded}
        </div>
      </div>

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 600; margin-bottom: 4px;">LCIA Method: ${escapeHtml(data.methodology.lciaMethod)}</div>
        <p style="font-size: 11px; color: #44403c; line-height: 1.6;">${escapeHtml(data.methodology.lciaMethodDescription)}</p>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #1c1917;">Data Sources &amp; Databases</h3>
        ${dataSources}
      </div>

      <div>
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px; color: #1c1917;">Software &amp; Tools</h3>
        ${software}
      </div>

      ${renderPageFooter(3)}
    </div>

    <div class="page light-page">
      ${renderSectionHeader('03', 'Methodology — Characterization Models', false, true)}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">LCIA CHARACTERIZATION FACTORS</div>

      <table class="data-table" style="margin-bottom: 24px;">
        <thead><tr><th>Impact Category</th><th>Characterization Model</th><th>Reference</th></tr></thead>
        <tbody>${charModels}</tbody>
      </table>

      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 600; color: #92400e; margin-bottom: 6px;">Reference Standards</div>
        ${data.goalAndScope.referenceStandards.map(s =>
          `<div style="font-size: 11px; color: #78716c; padding: 3px 0;">&#8226; ${escapeHtml(s)}</div>`
        ).join('')}
      </div>

      ${renderPageFooter(4)}
    </div>`;
}

function renderDataQualityPage(data: LCAReportData): string {
  const pm = data.dataQuality.pedigreeMatrix;
  const pedigreeRows = [
    { label: 'Reliability', score: pm.reliability, desc: 'How data was obtained (measured, calculated, estimated)' },
    { label: 'Completeness', score: pm.completeness, desc: 'Statistical representativeness of data' },
    { label: 'Temporal', score: pm.temporalRepresentativeness, desc: 'Age of data vs study period' },
    { label: 'Geographic', score: pm.geographicRepresentativeness, desc: 'Match of data geography to study area' },
    { label: 'Technological', score: pm.technologicalRepresentativeness, desc: 'Match of data technology to actual processes' },
  ];

  const dqColor = data.dataQuality.overallScore >= 80 ? '#22c55e' :
    data.dataQuality.overallScore >= 50 ? '#eab308' : '#ef4444';

  const cs = data.dataQuality.coverageSummary;

  // Pedigree bar helper (1=best, 5=worst)
  const pedigreeBar = (score: number) => {
    const pct = ((6 - score) / 5) * 100;
    const color = score <= 2 ? '#22c55e' : score <= 3 ? '#eab308' : '#ef4444';
    return `<div style="display: flex; align-items: center; gap: 8px;">
      <div style="flex: 1; height: 8px; background: #e7e5e4; border-radius: 4px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 4px;"></div>
      </div>
      <span style="font-size: 12px; font-weight: 600; width: 20px; text-align: center;">${score}</span>
    </div>`;
  };

  const materialQualityRows = data.dataQuality.materialQuality.slice(0, 12).map(m =>
    `<tr>
      <td style="font-weight: 500; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(m.name)}</td>
      <td><span class="badge ${m.source.includes('Primary') ? 'badge-low' : m.source.includes('Proxy') ? 'badge-high' : 'badge-medium'}">${escapeHtml(m.source.split(' (')[0])}</span></td>
      <td>${escapeHtml(m.grade)}</td>
      <td>${m.confidence > 0 ? `${m.confidence}%` : '—'}</td>
      <td style="font-size: 11px;">${escapeHtml(m.geographicCoverage)}</td>
    </tr>`
  ).join('');

  return `
    <div class="page light-page">
      ${renderSectionHeader('04', 'Data Quality Assessment')}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">ISO 14044:2006 &sect;4.2.3.6 — DATA QUALITY REQUIREMENTS</div>

      <div style="display: flex; gap: 20px; margin-bottom: 24px;">
        <div style="width: 180px; background: white; border: 1px solid #e7e5e4; border-radius: 16px; padding: 24px; text-align: center;">
          <div style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 12px; position: relative; background: conic-gradient(${dqColor} ${data.dataQuality.overallScore * 3.6}deg, #e7e5e4 0deg);">
            <div style="position: absolute; inset: 10px; background: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-direction: column;">
              <span style="font-size: 28px; font-weight: 700; font-family: 'Playfair Display', serif; color: ${dqColor};">${data.dataQuality.overallScore}%</span>
            </div>
          </div>
          <div style="font-size: 13px; font-weight: 600; color: ${dqColor};">${escapeHtml(data.dataQuality.overallRating)}</div>
        </div>

        <div style="flex: 1;">
          <div style="font-size: 12px; font-weight: 600; margin-bottom: 12px;">Pedigree Matrix (ISO 14044 §4.2.3.6)</div>
          ${pedigreeRows.map(r =>
            `<div style="display: grid; grid-template-columns: 100px 1fr 180px; gap: 8px; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 500;">${r.label}</span>
              ${pedigreeBar(r.score)}
              <span style="font-size: 10px; color: #78716c;">${r.desc}</span>
            </div>`
          ).join('')}
          <div style="font-size: 9px; color: #a8a29e; margin-top: 4px;">Scale: 1 (best) to 5 (worst) per ecoinvent pedigree approach</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Primary Data</div>
          <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${cs.primaryDataShare}%</div>
          <div class="metric-unit">${cs.primaryCount} of ${cs.totalMaterials} materials</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Secondary Data</div>
          <div style="font-size: 24px; font-weight: 700; color: #3b82f6;">${cs.secondaryDataShare}%</div>
          <div class="metric-unit">${cs.secondaryCount} materials</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Proxy Data</div>
          <div style="font-size: 24px; font-weight: 700; color: #f97316;">${cs.proxyDataShare}%</div>
          <div class="metric-unit">${cs.proxyCount} materials</div>
        </div>
        <div class="metric-card" style="text-align: center;">
          <div class="metric-label">Total Materials</div>
          <div style="font-size: 24px; font-weight: 700; color: #1c1917;">${cs.totalMaterials}</div>
          <div class="metric-unit">in inventory</div>
        </div>
      </div>

      <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Material-Level Data Quality</div>
      <table class="data-table" style="font-size: 11px;">
        <thead><tr><th>Material</th><th>Source</th><th>Grade</th><th>Confidence</th><th>Geography</th></tr></thead>
        <tbody>${materialQualityRows}</tbody>
      </table>

      ${renderPageFooter(5)}
    </div>

    <div class="page light-page">
      ${renderSectionHeader('04', 'Data Quality — Notes', false, true)}

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Missing Data Treatment (ISO 14044 §4.2.3.6.3)</div>
        <p style="font-size: 12px; color: #44403c; line-height: 1.7;">${escapeHtml(data.dataQuality.missingDataTreatment)}</p>
      </div>

      <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 20px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Uncertainty Assessment</div>
        <p style="font-size: 12px; color: #44403c; line-height: 1.7;">${escapeHtml(data.dataQuality.uncertaintyNote)}</p>
      </div>

      ${renderPageFooter(6)}
    </div>`;
}

function renderClimatePage(data: LCAReportData): string {
  const maxStageValue = Math.max(...data.climateImpact.stages.map(s => s.value), 0.001);

  const stagesBars = data.climateImpact.stages.map(stage =>
    `<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
      <div style="width: 120px; font-size: 12px; color: #78716c; text-align: right; flex-shrink: 0;">${escapeHtml(stage.label)}</div>
      <div style="flex: 1; height: 28px; background: #292524; border-radius: 6px; overflow: hidden;">
        <div style="height: 100%; width: ${Math.max((stage.value / maxStageValue) * 100, 1)}%; background: ${stage.color}; border-radius: 6px;"></div>
      </div>
      <div style="width: 90px; font-size: 12px; color: #a8a29e; flex-shrink: 0;">${stage.value.toFixed(4)} ${escapeHtml(stage.unit)}</div>
      <div style="width: 50px; font-size: 11px; color: #ccff00; text-align: right; flex-shrink: 0;">${escapeHtml(stage.percentage)}%</div>
    </div>`
  ).join('');

  const donutStyle = donutGradient(data.climateImpact.breakdown);

  return `
    <div class="page dark-page">
      ${renderSectionHeader('05', 'Climate Impact', true)}

      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 32px;">
        <div>
          <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #78716c; margin-bottom: 8px;">TOTAL CLIMATE IMPACT (GWP-100)</div>
          <div style="font-size: 64px; font-family: 'Playfair Display', serif; color: #ccff00; line-height: 1;">
            ${escapeHtml(data.climateImpact.totalCarbon)}
            <span style="font-size: 18px; color: #78716c; font-family: 'Inter', sans-serif; margin-left: 8px;">kg CO&#8322;e</span>
          </div>
          <div style="font-size: 11px; color: #78716c; margin-top: 6px;">per ${escapeHtml(data.functionalUnit.value)}</div>
        </div>
        <div style="width: 180px; height: 180px; border-radius: 50%; ${donutStyle} position: relative;">
          <div style="position: absolute; inset: 45px; background: #1c1917; border-radius: 50%;"></div>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <h3 style="font-size: 13px; font-family: 'Fira Code', monospace; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">Lifecycle Stage Breakdown</h3>
        ${stagesBars}
      </div>

      <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; margin-bottom: 16px;">
        ${data.climateImpact.breakdown.map(b =>
          `<div style="display: flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(255,255,255,0.05); border-radius: 6px;">
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${b.color};"></div>
            <span style="font-size: 11px; color: #a8a29e;">${escapeHtml(b.name)}</span>
          </div>`
        ).join('')}
      </div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
        ${data.climateImpact.scopes.map(s =>
          `<div style="background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center;">
            <div style="font-size: 10px; color: #78716c; margin-bottom: 4px;">${escapeHtml(s.name)}</div>
            <div style="font-size: 20px; font-weight: 700; color: #ccff00;">${escapeHtml(s.value)}%</div>
          </div>`
        ).join('')}
      </div>

      ${renderPageFooter(7, true)}
    </div>`;
}

function renderGhgDetailedPage(data: LCAReportData): string {
  const ghg = data.ghgDetailed;

  return `
    <div class="page light-page">
      ${renderSectionHeader('06', 'Detailed GHG Reporting')}

      <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">ISO 14067:2018 &mdash; GREENHOUSE GAS BREAKDOWN</div>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div class="metric-card" style="text-align: center; border-left: 3px solid #ef4444;">
          <div class="metric-label">Fossil CO&#8322;</div>
          <div style="font-size: 24px; font-weight: 700; color: #ef4444;">${escapeHtml(ghg.fossilCo2)}</div>
          <div class="metric-unit">kg CO&#8322;e</div>
        </div>
        <div class="metric-card" style="text-align: center; border-left: 3px solid #22c55e;">
          <div class="metric-label">Biogenic CO&#8322;</div>
          <div style="font-size: 24px; font-weight: 700; color: #22c55e;">${escapeHtml(ghg.biogenicCo2)}</div>
          <div class="metric-unit">kg CO&#8322;e</div>
        </div>
        <div class="metric-card" style="text-align: center; border-left: 3px solid #f97316;">
          <div class="metric-label">LULUC CO&#8322;</div>
          <div style="font-size: 24px; font-weight: 700; color: #f97316;">${escapeHtml(ghg.dlucCo2)}</div>
          <div class="metric-unit">kg CO&#8322;e</div>
        </div>
      </div>

      <table class="data-table" style="margin-bottom: 20px;">
        <thead><tr><th>GHG Species</th><th>Mass (kg)</th><th>CO&#8322;e (kg)</th><th>GWP-100</th></tr></thead>
        <tbody>
          <tr>
            <td style="font-weight: 500;">CO&#8322; (fossil)</td>
            <td>${escapeHtml(ghg.fossilCo2)}</td>
            <td>${escapeHtml(ghg.fossilCo2)}</td>
            <td>1</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">CO&#8322; (biogenic)</td>
            <td>${escapeHtml(ghg.biogenicCo2)}</td>
            <td>${escapeHtml(ghg.biogenicCo2)}</td>
            <td>1*</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">CO&#8322; (LULUC)</td>
            <td>${escapeHtml(ghg.dlucCo2)}</td>
            <td>${escapeHtml(ghg.dlucCo2)}</td>
            <td>1</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">CH&#8324; (fossil)</td>
            <td>${escapeHtml(ghg.ch4Fossil)}</td>
            <td>${escapeHtml(ghg.ch4FossilKgCo2e)}</td>
            <td>29.8</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">CH&#8324; (biogenic)</td>
            <td>${escapeHtml(ghg.ch4Biogenic)}</td>
            <td>${escapeHtml(ghg.ch4BiogenicKgCo2e)}</td>
            <td>27.0</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">N&#8322;O</td>
            <td>${escapeHtml(ghg.n2o)}</td>
            <td>${escapeHtml(ghg.n2oKgCo2e)}</td>
            <td>273</td>
          </tr>
          <tr>
            <td style="font-weight: 500;">HFCs / PFCs</td>
            <td>—</td>
            <td>${escapeHtml(ghg.hfcPfc)}</td>
            <td>Variable</td>
          </tr>
          <tr style="font-weight: 600; background: #f0fdf4;">
            <td>Total GWP-100</td>
            <td></td>
            <td style="color: #166534;">${escapeHtml(ghg.totalGwp100)} kg CO&#8322;e</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 600; color: #166534; margin-bottom: 6px;">Biogenic Carbon Note (ISO 14067:2018)</div>
        <p style="font-size: 11px; color: #44403c; line-height: 1.6;">${escapeHtml(ghg.biogenicNote)}</p>
      </div>

      <div style="font-size: 11px; color: #78716c;">
        <strong>GWP Method:</strong> ${escapeHtml(ghg.gwpMethod)} — All GWP-100 values from IPCC Sixth Assessment Report (AR6, 2021)
      </div>

      ${renderPageFooter(8)}
    </div>`;
}

function renderEnvironmentalImpactsPages(data: LCAReportData): string {
  const categories = data.environmentalImpacts.categories;
  if (categories.length === 0) return '';

  // Split categories across pages (6 per page)
  const perPage = 6;
  const pages: string[] = [];

  for (let i = 0; i < categories.length; i += perPage) {
    const pageCategories = categories.slice(i, i + perPage);
    const isFirstPage = i === 0;
    const pageNum = 9 + Math.floor(i / perPage);

    const categoryCards = pageCategories.map(cat => {
      const topContribs = cat.topContributors.map(tc =>
        `<div style="display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0;">
          <span style="color: #44403c; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(tc.name)}</span>
          <span style="color: #78716c;">${escapeHtml(tc.percentage)}</span>
        </div>`
      ).join('');

      return `
        <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <div style="font-size: 13px; font-weight: 600; color: #1c1917;">${escapeHtml(cat.name)}</div>
              <div style="font-size: 10px; color: #78716c;">${escapeHtml(cat.indicator)}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 16px; font-weight: 700; color: #1c1917;">${escapeHtml(cat.totalValue)}</div>
              <div style="font-size: 10px; color: #78716c;">${escapeHtml(cat.unit)}</div>
            </div>
          </div>
          <p style="font-size: 10px; color: #78716c; line-height: 1.5; margin-bottom: 8px;">${escapeHtml(cat.description)}</p>
          ${cat.topContributors.length > 0 ? `
            <div style="border-top: 1px solid #f5f5f4; padding-top: 6px;">
              <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #a8a29e; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Top Contributors</div>
              ${topContribs}
            </div>
          ` : ''}
        </div>`;
    }).join('');

    pages.push(`
      <div class="page light-page">
        ${isFirstPage
          ? renderSectionHeader('07', 'Environmental Impact Categories')
          : renderSectionHeader('07', 'Environmental Impact Categories', false, true)
        }

        ${isFirstPage ? `
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">ISO 14044:2006 &sect;4.4 — LIFE CYCLE IMPACT ASSESSMENT</div>
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px;">
            <p style="font-size: 11px; color: #92400e; line-height: 1.5;"><strong>Method:</strong> ${escapeHtml(data.environmentalImpacts.referenceMethod)} — ${escapeHtml(data.environmentalImpacts.normalisationNote)}</p>
          </div>
        ` : ''}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
          ${categoryCards}
        </div>

        ${renderPageFooter(pageNum)}
      </div>`);
  }

  return pages.join('\n');
}

function renderIngredientBreakdownPage(data: LCAReportData): string {
  const ingredients = data.ingredientBreakdown.ingredients;
  if (ingredients.length === 0) return '';

  const hasProxies = data.ingredientBreakdown.hasProxies;

  // Split into pages of 10 rows
  const perPage = 10;
  const pages: string[] = [];

  for (let i = 0; i < ingredients.length; i += perPage) {
    const pageIngredients = ingredients.slice(i, i + perPage);
    const isFirstPage = i === 0;
    const pageNum = 10 + Math.floor(i / perPage);

    const rows = pageIngredients.map(ing => {
      // Ingredient cell: show real name, then proxy factor below if different
      const ingredientCell = ing.isProxy
        ? `<td style="max-width: 110px;">
            <div style="font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(ing.name)}</div>
            <div style="font-size: 8px; color: #f59e0b; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              &#8627; Proxy: ${escapeHtml(ing.calculationFactor)}
            </div>
            <div style="font-size: 7.5px; color: #78716c;">${escapeHtml(ing.factorDatabase)}</div>
           </td>`
        : `<td style="font-weight: 500; max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(ing.name)}
            <div style="font-size: 7.5px; color: #78716c; margin-top: 2px;">${escapeHtml(ing.factorDatabase)}</div>
           </td>`;

      const dataSourceBadge = ing.isProxy
        ? `<span class="badge badge-high">Proxy</span>`
        : ing.dataSource === 'Primary'
          ? `<span class="badge badge-low">Primary</span>`
          : `<span class="badge badge-medium">Secondary</span>`;

      return `<tr>
        ${ingredientCell}
        <td>${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit)}</td>
        <td>${escapeHtml(ing.origin)}</td>
        <td style="font-weight: 500;">${escapeHtml(ing.climateImpact)}</td>
        <td><span style="color: #ccff00;">${escapeHtml(ing.climatePercentage)}</span></td>
        <td>${escapeHtml(ing.acidification)}</td>
        <td>${escapeHtml(ing.eutrophication)}</td>
        <td>${dataSourceBadge}${ing.confidenceScore > 0 ? `<div style="font-size: 7.5px; color: #78716c; margin-top: 2px;">${ing.confidenceScore}%</div>` : ''}</td>
      </tr>`;
    }).join('');

    pages.push(`
      <div class="page ${isFirstPage ? 'dark-page' : 'light-page'}">
        ${isFirstPage
          ? renderSectionHeader('08', 'Ingredient Impact Breakdown', true)
          : renderSectionHeader('08', 'Ingredient Impact Breakdown', false, true)
        }

        ${isFirstPage ? `
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 16px;">PER-INGREDIENT ENVIRONMENTAL CONTRIBUTION · REAL INGREDIENT &amp; CALCULATION FACTOR</div>
        ` : ''}

        ${isFirstPage && hasProxies ? `
          <div style="margin-bottom: 12px; padding: 10px 14px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); border-radius: 8px; font-size: 9px; color: #b45309; line-height: 1.5;">
            <strong>Proxy factors in use:</strong> One or more ingredients are calculated using the closest matching dataset from ecoinvent, AGRIBALYSE, or DEFRA.
            The user's actual ingredient name is shown first; the proxy factor and database are shown beneath it in amber.
            All proxy selections are documented per ISO 14044 §4.2.3.6.3.
          </div>
        ` : ''}

        <table class="${isFirstPage ? 'data-table-dark' : 'data-table'}" style="font-size: 10px;">
          <thead><tr>
            <th>Ingredient / Calc. Factor</th>
            <th>Qty</th>
            <th>Origin</th>
            <th>GWP (kg CO&#8322;e)</th>
            <th>% Climate</th>
            <th>Acid. (SO&#8322;-eq)</th>
            <th>Eutroph. (P-eq)</th>
            <th>Data / Conf.</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        ${isFirstPage && ingredients.length <= perPage ? `
          <div style="margin-top: 20px; padding: 14px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="font-size: 10px; color: #a8a29e; line-height: 1.6;">
              <strong style="color: #ccff00;">Total Climate Impact:</strong> ${escapeHtml(data.ingredientBreakdown.totalClimateImpact)} kg CO&#8322;e per functional unit.
              Acidification values in kg SO&#8322;-eq (terrestrial). Eutrophication values in kg P-eq (freshwater). Values below detection shown as 0.000e+0.
              ${hasProxies ? '&#x26A0; Proxy factors are used where a direct dataset match was not available — see Data Quality section.' : ''}
            </div>
          </div>
        ` : ''}

        ${renderPageFooter(pageNum, isFirstPage)}
      </div>`);
  }

  return pages.join('\n');
}

function renderWaterPage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('09', 'Water Footprint')}

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

      ${renderPageFooter(11)}
    </div>`;
}

function renderCircularityPage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('10', 'Circularity & Waste')}

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

      ${/* ISSUE D FIX: Proprietary metric disclaimer and recycling rate methodology (ISO 14044 §4.4.5). */ ''}
      ${data.circularityMethodology ? `
        <div style="margin-top: 20px; padding: 12px 16px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
          <p style="font-size: 12px; line-height: 1.5; color: #0c4a6e;">
            <strong>Methodology Note:</strong> ${escapeHtml(data.circularityMethodology.description)}
            ${data.circularityMethodology.reference ? ` Reference: ${escapeHtml(data.circularityMethodology.reference)}` : ''}
          </p>
        </div>
      ` : ''}

      ${renderPageFooter(12)}
    </div>`;
}

function renderLandUsePage(data: LCAReportData): string {
  return `
    <div class="page light-page">
      ${renderSectionHeader('11', 'Land Use')}

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

      ${renderPageFooter(13)}
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
      ${renderSectionHeader('12', 'Supply Chain')}

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

      ${renderPageFooter(14)}
    </div>`;
}

function renderCommitmentPage(data: LCAReportData): string {
  return `
    <div class="page dark-page" style="justify-content: center; text-align: center;">
      <div style="max-width: 500px; margin: 0 auto;">
        <div style="margin: 0 auto 32px;">
          ${alkateraLogo(56)}
        </div>
        <h2 style="font-size: 36px; font-family: 'Playfair Display', serif; font-weight: 300; margin-bottom: 24px; color: white;">Our Commitment</h2>
        <p style="font-size: 16px; line-height: 1.8; color: #a8a29e;">${escapeHtml(data.commitment.text)}</p>

        <div style="margin-top: 64px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1);">
          <div style="margin-bottom: 20px;">
            ${alkateraLogo(32)}
          </div>
          <p style="font-size: 12px; color: #78716c; font-family: 'Fira Code', monospace;">
            Report generated by alka<span style="font-weight: 700;">tera</span><br />
            ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <a href="https://alkatera.com" style="display: inline-block; margin-top: 16px; color: #ccff00; font-size: 12px; font-family: 'Fira Code', monospace; text-decoration: none; letter-spacing: 1px; padding: 8px 20px; border: 1px solid rgba(204,255,0,0.3); border-radius: 6px;">
            alkatera.com
          </a>
        </div>
      </div>

      ${renderPageFooter(15, true)}
    </div>`;
}

// ============================================================================
// ISO COMPLIANCE PAGES
// ============================================================================

function renderInterpretationPage(data: LCAReportData): string {
  const interp = data.interpretation;
  if (!interp) return '';

  const hotspotsHtml = interp.significant_issues.hotspots.length > 0
    ? `<table class="data-table">
        <thead><tr><th>Material</th><th>Impact (kg CO₂e)</th><th>Contribution</th></tr></thead>
        <tbody>
          ${interp.significant_issues.hotspots.map(h => `
            <tr>
              <td style="font-weight: 500;">${escapeHtml(h.name)}</td>
              <td>${h.impact_kg_co2e.toFixed(4)}</td>
              <td>${h.contribution_pct.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '<p style="font-size: 13px; color: #78716c;">No individual material exceeds the 5% significance threshold.</p>';

  // ISSUE F FIX: Show footnote when hotspot contributions exceed 100% due to EoL credits.
  const hotspotSum = interp.significant_issues.hotspots.reduce((s, h) => s + h.contribution_pct, 0);
  const exceedsNote = hotspotSum > 100
    ? `<p style="font-size: 11px; font-style: italic; color: #78716c; margin-top: 8px;">
        * Contributions sum to ${hotspotSum.toFixed(1)}% because end-of-life avoided-burden credits
        reduce the net total carbon footprint, against which individual percentages are calculated.
      </p>`
    : '';

  return `
    <div class="page light-page">
      ${renderSectionHeader('13', 'Interpretation (ISO 14044 §4.5)')}

      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Significant Issues</h3>
      <p style="font-size: 13px; line-height: 1.6; margin-bottom: 16px; color: #44403c;">
        ${escapeHtml(interp.significant_issues.summary)}
      </p>
      ${hotspotsHtml}
      ${exceedsNote}

      <div style="display: flex; gap: 16px; margin: 20px 0;">
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Dominant Stage</div>
          <div style="font-size: 18px; font-weight: 700;">${escapeHtml(interp.significant_issues.dominant_lifecycle_stage)}</div>
          <div style="font-size: 12px; color: #78716c;">${interp.significant_issues.dominant_stage_pct}% of total</div>
        </div>
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Dominant Scope</div>
          <div style="font-size: 18px; font-weight: 700;">${escapeHtml(interp.significant_issues.dominant_scope)}</div>
          <div style="font-size: 12px; color: #78716c;">${interp.significant_issues.dominant_scope_pct}% of total</div>
        </div>
      </div>

      <h3 style="font-size: 16px; font-weight: 600; margin: 20px 0 12px;">Key Findings</h3>
      <ul style="font-size: 13px; line-height: 1.6; color: #44403c; padding-left: 20px; margin-bottom: 16px;">
        ${interp.conclusions.key_findings.map(f => `<li style="margin-bottom: 6px;">${escapeHtml(f)}</li>`).join('')}
      </ul>

      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Limitations</h3>
      <ul style="font-size: 13px; line-height: 1.6; color: #44403c; padding-left: 20px; margin-bottom: 16px;">
        ${interp.conclusions.limitations.map(l => `<li style="margin-bottom: 6px;">${escapeHtml(l)}</li>`).join('')}
      </ul>

      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Recommendations</h3>
      <ul style="font-size: 13px; line-height: 1.6; color: #44403c; padding-left: 20px;">
        ${interp.conclusions.recommendations.map(r => `<li style="margin-bottom: 6px;">${escapeHtml(r)}</li>`).join('')}
      </ul>

      ${renderPageFooter(15)}
    </div>`;
}

function renderUncertaintySensitivityPage(data: LCAReportData): string {
  const us = data.uncertaintySensitivity;
  if (!us) return '';

  const paramsHtml = us.sensitivityAnalysis.parameters.length > 0
    ? `<table class="data-table">
        <thead><tr><th>Material</th><th>Contribution</th><th>±20% Range</th><th>Sensitivity</th></tr></thead>
        <tbody>
          ${us.sensitivityAnalysis.parameters.map(p => `
            <tr>
              <td style="font-weight: 500;">${escapeHtml(p.materialName)}</td>
              <td>${p.baselineContributionPct.toFixed(1)}%</td>
              <td>${p.resultRange.lower} – ${p.resultRange.upper} kg CO₂e</td>
              <td>${p.sensitivityRatio.toFixed(3)}${p.isHighlySensitive ? ' <span style="color: #dc2626; font-weight: 600;">HIGH</span>' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '';

  return `
    <div class="page light-page">
      ${renderSectionHeader('14', 'Uncertainty & Sensitivity (ISO 14044 §4.5.3)')}

      <div style="display: flex; gap: 16px; margin-bottom: 24px;">
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Propagated Uncertainty</div>
          <div class="metric-value">±${us.propagatedUncertaintyPct}%</div>
          <div style="font-size: 11px; color: #78716c;">95% confidence interval</div>
        </div>
        <div class="metric-card" style="flex: 1; text-align: center;">
          <div class="metric-label">Result Range (95% CI)</div>
          <div style="font-size: 18px; font-weight: 700;">${us.confidenceInterval95.lower} – ${us.confidenceInterval95.upper}</div>
          <div style="font-size: 11px; color: #78716c;">kg CO₂e per functional unit</div>
        </div>
      </div>

      <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Sensitivity Analysis</h3>
      <p style="font-size: 13px; color: #78716c; margin-bottom: 16px;">${escapeHtml(us.sensitivityAnalysis.method)}</p>
      ${paramsHtml}

      <div style="margin-top: 20px; padding: 16px; background: #fafaf9; border-radius: 8px; border: 1px solid #e7e5e4;">
        <p style="font-size: 13px; line-height: 1.6; color: #44403c;">
          <strong>Conclusion:</strong> ${escapeHtml(us.sensitivityAnalysis.conclusion)}
        </p>
      </div>

      <div style="margin-top: 20px; padding: 12px 16px; background: #fffbeb; border-radius: 8px; border: 1px solid #fde68a;">
        <p style="font-size: 12px; line-height: 1.5; color: #92400e;">
          <strong>Methodology:</strong> Uncertainty propagation follows the root-sum-of-squares approach
          for geometric standard deviation per Frischknecht et al. (2007), using the Pedigree Matrix
          (Weidema &amp; Wesnæs, 1996) for data quality scoring. Sensitivity analysis applies ±20%
          variation to emission factors of the top three contributors.
        </p>
      </div>

      ${renderPageFooter(16)}
    </div>`;
}

function renderCriticalReviewDisclosure(data: LCAReportData): string {
  const cr = data.criticalReview;
  if (!cr) return '';

  // Additional notes from other compliance fields
  const notes: string[] = [];
  if (data.lulucNote) notes.push(data.lulucNote);
  if (data.transportNote) notes.push(data.transportNote.method);
  if (data.scopeMethodology) notes.push(data.scopeMethodology.note);

  const zeroCategories = data.zeroImpactCategories || [];

  return `
    <div class="page light-page">
      ${renderSectionHeader('15', 'Critical Review & Compliance Notes')}

      <div style="padding: 20px; background: #fef3c7; border-radius: 8px; border: 1px solid #fde68a; margin-bottom: 24px;">
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #92400e;">Critical Review Status: ${escapeHtml(cr.status.replace(/_/g, ' ').toUpperCase())}</h3>
        <p style="font-size: 13px; line-height: 1.6; color: #78350f;">${escapeHtml(cr.disclosure)}</p>
        <p style="font-size: 12px; line-height: 1.5; color: #92400e; margin-top: 12px;">
          <strong>Recommendation:</strong> ${escapeHtml(cr.recommendation)}
        </p>
      </div>

      ${zeroCategories.length > 0 ? `
        <h3 style="font-size: 16px; font-weight: 600; margin-bottom: 12px;">Zero-Impact Categories</h3>
        <p style="font-size: 12px; color: #78716c; margin-bottom: 12px;">
          The following environmental impact categories were assessed but report zero values. Justification per ISO 14044 §4.4.2.2:
        </p>
        <table class="data-table">
          <thead><tr><th>Category</th><th>Reason</th></tr></thead>
          <tbody>
            ${zeroCategories.map(c => `
              <tr>
                <td style="font-weight: 500; white-space: nowrap;">${escapeHtml(c.category)}</td>
                <td style="font-size: 12px;">${escapeHtml(c.reason)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}

      ${notes.length > 0 ? `
        <h3 style="font-size: 16px; font-weight: 600; margin: 20px 0 12px;">Methodological Notes</h3>
        ${notes.map(n => `
          <div style="padding: 12px 16px; background: #fafaf9; border-radius: 6px; border: 1px solid #e7e5e4; margin-bottom: 10px;">
            <p style="font-size: 12px; line-height: 1.5; color: #44403c;">${escapeHtml(n)}</p>
          </div>
        `).join('')}
      ` : ''}

      ${data.circularityMethodology ? `
        <div style="margin-top: 16px; padding: 12px 16px; background: #f0f9ff; border-radius: 6px; border: 1px solid #bae6fd;">
          <p style="font-size: 12px; line-height: 1.5; color: #0c4a6e;">
            <strong>Circularity Score Disclaimer:</strong> ${escapeHtml(data.circularityMethodology.description)}
          </p>
        </div>
      ` : ''}

      ${renderPageFooter(17)}
    </div>`;
}

// ============================================================================
// SHARED ELEMENTS
// ============================================================================

function renderSectionHeader(number: string, title: string, dark = false, continuation = false): string {
  const borderColor = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
  return `
    <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: ${continuation ? '24px' : '32px'}; border-bottom: 1px solid ${borderColor}; padding-bottom: 12px;">
      <span style="color: #ccff00; font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 700; letter-spacing: 3px;">${number}</span>
      <h2 style="font-size: ${continuation ? '24px' : '32px'}; font-family: 'Playfair Display', serif; font-weight: 300;">${escapeHtml(title)}</h2>
      ${continuation ? '<span style="font-size: 10px; color: #a8a29e; font-family: \'Fira Code\', monospace;">(continued)</span>' : ''}
    </div>`;
}

// ISSUE G FIX: Use __PAGE_NUM__ placeholder for dynamic sequential numbering.
// The main renderer replaces all placeholders with actual sequential page numbers,
// eliminating hardcoded page counts that become stale when pages are added/removed.
function renderPageFooter(pageNumber?: number, dark = false): string {
  const color = dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div style="position: absolute; bottom: 48px; left: 48px; right: 48px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; font-family: 'Fira Code', monospace; color: ${color}; text-transform: uppercase; letter-spacing: 3px; border-top: 1px solid ${color}; padding-top: 16px;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>Generated by</span>
        ${alkateraLogo(14, dark)}
      </div>
      ${pageNumber ? `<div style="font-weight: 700; font-size: 12px;">__PAGE_NUM__</div>` : ''}
      <div>ISO 14040/44 &amp; 14067 | ${dateStr}</div>
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
    renderGoalAndScopePage(data),
    renderMethodologyPage(data),
    renderDataQualityPage(data),
    renderClimatePage(data),
    renderGhgDetailedPage(data),
    renderEnvironmentalImpactsPages(data),
    renderIngredientBreakdownPage(data),
    renderWaterPage(data),
    renderCircularityPage(data),
    renderLandUsePage(data),
    renderSupplyChainPage(data),
    // ISO compliance additions
    renderInterpretationPage(data),
    renderUncertaintySensitivityPage(data),
    renderCriticalReviewDisclosure(data),
    renderCommitmentPage(data),
  ].filter(Boolean).join('\n');

  // ISSUE G FIX: Replace __PAGE_NUM__ placeholders with sequential page numbers.
  // The cover page has no page number, so the first __PAGE_NUM__ occurrence is page 1.
  let pageCounter = 0;
  const pagesWithNumbers = pages.replace(/__PAGE_NUM__/g, () => String(++pageCounter));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCA Report — ${escapeHtml(data.meta.productName)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@300;700&family=Fira+Code:wght@400;700&display=swap" rel="stylesheet" />

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
      padding-bottom: 96px; /* Extra clearance for the absolute-positioned footer */
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

    .data-table-dark {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table-dark thead th {
      text-align: left;
      padding: 10px 12px;
      font-size: 11px;
      font-family: 'Fira Code', monospace;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #a8a29e;
      border-bottom: 2px solid rgba(255,255,255,0.15);
    }

    .data-table-dark tbody td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: #d6d3d1;
    }

    .data-table-dark tbody tr:nth-child(even) { background: rgba(255,255,255,0.03); }

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
  ${pagesWithNumbers}
</body>
</html>`;
}
