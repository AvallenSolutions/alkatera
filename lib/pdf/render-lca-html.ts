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
  if (total === 0) return 'background: #D9D6CB;';

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

/** Renders the brand name "alkatera" (lowercase, with "tera" in bold) per brand guidelines. */
function alkateraName(): string {
  return `alka<span style="font-weight: 700;">tera</span>`;
}

// ============================================================================
// PAGE RENDERERS
// ============================================================================

function renderCoverPage(data: LCAReportData): string {
  const heroStyle = data.meta.heroImage
    ? `background-image: url('${data.meta.heroImage}'); background-size: cover; background-position: center;`
    : 'background: linear-gradient(135deg, #ECEAE3, #F2F1EA);';

  const productImageHtml = data.meta.productImageUrl
    ? `<div style="position: absolute; top: 80px; right: 48px; z-index: 10; width: 220px; height: 280px; border-radius: 16px; overflow: hidden; border: 2px solid rgba(32,94,64,0.3); box-shadow: 0 20px 60px rgba(26,27,29,0.2);">
        <img src="${escapeHtml(data.meta.productImageUrl)}" style="width: 100%; height: 100%; object-fit: contain;" alt="${escapeHtml(data.meta.productName)}" />
      </div>`
    : '';

  const metaCell = (label: string, value: string) => `
    <div style="flex: 1; padding-top: 14px; border-top: 1px solid rgba(26,27,29,0.18);">
      <div class="lead-label" style="color: #205E40;">${escapeHtml(label)}</div>
      <div class="card-title" style="font-size: 16px; margin-top: 6px;">${escapeHtml(value)}</div>
    </div>`;

  return `
    <div class="page dark-page" style="justify-content: space-between; overflow: hidden; position: relative;">
      <div style="position: absolute; inset: 0; ${heroStyle} opacity: 0.55;"></div>
      <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(242,241,234,0.55), rgba(242,241,234,0.25), rgba(242,241,234,0.9));"></div>

      ${productImageHtml}

      <div style="position: relative; z-index: 10; padding-top: 48px;">
        ${alkateraLogo(40, false)}
      </div>

      <div style="position: relative; z-index: 10; width: 100%; max-width: 560px;">
        <div style="display: inline-block; background: #1A1B1D; color: #F2F1EA; padding: 14px 22px; border-radius: 6px; margin-bottom: 44px;">
          <div style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 12px; letter-spacing: 0.22em;">LIFE CYCLE ASSESSMENT</div>
          <div style="font-size: 10px; margin-top: 5px; opacity: 0.7; font-family: 'JetBrains Mono', monospace; letter-spacing: 0.1em;">ISO 14067:2018 &middot; ISO 14044:2006</div>
        </div>
        <h1 class="statement" style="font-size: 64px; line-height: 0.95; margin-bottom: 18px;">
          ${escapeHtml(data.meta.productName)}
        </h1>
        <p class="card-title" style="font-size: 18px; color: #6F6F68; font-weight: 500;">${escapeHtml(data.meta.organization)}</p>
        ${data.meta.productDescription ? `<p class="body" style="max-width: 440px; margin-top: 18px;">${escapeHtml(data.meta.productDescription)}</p>` : ''}
      </div>

      <div style="position: relative; z-index: 10; display: flex; gap: 28px; margin-bottom: 84px;">
        ${metaCell('Functional unit', data.functionalUnit.value)}
        ${metaCell('System boundary', data.meta.lcaScopeType || 'Cradle-to-Gate')}
        ${metaCell('Reference year', String(data.meta.referenceYear || new Date().getFullYear()))}
      </div>

      ${renderPageFooter(undefined, true)}
    </div>`;
}

function renderExecSummaryPage(data: LCAReportData): string {
  const dqColor = data.executiveSummary.dataQualityScore >= 80 ? '#047857' :
    data.executiveSummary.dataQualityScore >= 50 ? '#B45309' : '#BE123C';

  const dqTone = data.executiveSummary.dataQualityScore >= 80 ? 'good'
    : data.executiveSummary.dataQualityScore >= 50 ? 'attention' : 'stale';

  const bigStat = (value: string, unit: string, label: string) => `
    <div style="flex: 1;">
      <div class="lead-number" style="font-size: 40px; color: #1A1B1D;">${escapeHtml(value)}<span style="font-size: 13px; font-weight: 600; color: #6F6F68; margin-left: 6px;">${unit}</span></div>
      <div class="lead-label" style="margin-top: 8px;">${escapeHtml(label)}</div>
    </div>`;

  return `
    <div class="page light-page" style="position: relative;">
      ${mark('circle', 'br')}
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
        ${renderSectionLead({
          number: '01',
          section: 'Executive summary',
          value: data.executiveSummary.keyHighlight.value,
          label: data.executiveSummary.keyHighlight.label,
          statement: data.executiveSummary.keyHighlight.subtext || 'The footprint, in one number.',
        })}

        <div style="display: flex; gap: 40px; margin-bottom: 28px;">
          ${bigStat(data.climateImpact.totalCarbon, 'kg CO₂e', 'Carbon footprint, fossil')}
          ${bigStat(data.waterFootprint.totalConsumption, 'litres', 'Water footprint')}
          ${bigStat(String(data.circularity.recyclingRate), '%', 'Recycling rate')}
          <div style="width: 118px; text-align: center;">
            <div style="width: 92px; height: 92px; border-radius: 50%; margin: 0 auto; background: conic-gradient(${dqColor} ${data.executiveSummary.dataQualityScore * 3.6}deg, #D9D6CB 0deg); position: relative;">
              <div style="position: absolute; inset: 10px; background: #ECEAE3; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <span class="lead-number" style="font-size: 24px; color: #1A1B1D;">${data.executiveSummary.dataQualityScore}<span style="font-size: 11px;">%</span></span>
              </div>
            </div>
            <div class="state state-${dqTone}" style="margin-top: 10px;">Data quality</div>
          </div>
        </div>

        <div class="rule" style="padding-top: 20px;">
          <div class="eyebrow dim" style="margin-bottom: 10px;">The study in brief</div>
          <p class="body" style="font-size: 13.5px; line-height: 1.7;">${escapeHtml(data.executiveSummary.content)}</p>
        </div>
      </div>

      ${renderPageFooter(1)}
    </div>`;
}

/**
 * Renders the EoL Methodology disclosure section (ISO 14044 §4.1 / §4.4).
 * Shows region, per-material disposal pathways, avoided burden method, and data sources.
 */
function renderEolMethodologySection(data: LCAReportData): string {
  const eol = data.eolMethodology;
  if (!eol || !eol.materialPathways || eol.materialPathways.length === 0) return '';

  const pathwayRows = eol.materialPathways.map(m =>
    `<tr>
      <td style="font-weight: 500; font-size: 10px;">${escapeHtml(m.material)}</td>
      <td style="text-align: center; font-size: 10px;">${m.recyclingPct}%</td>
      <td style="text-align: center; font-size: 10px;">${m.landfillPct}%</td>
      <td style="text-align: center; font-size: 10px;">${m.incinerationPct}%</td>
      <td style="text-align: center; font-size: 10px;">${m.compostingPct}%</td>
      <td style="text-align: center; font-size: 10px;">${m.adPct}%</td>
    </tr>`
  ).join('');

  return `
    <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
      <div style="font-size: 11px; font-weight: 600; color: #0c4a6e; margin-bottom: 10px;">End-of-Life Modelling Assumptions (ISO 14044 &sect;4.4)</div>
      <div style="display: flex; gap: 16px; margin-bottom: 10px;">
        <div style="font-size: 10px; color: #6F6F68;"><strong>Region:</strong> ${escapeHtml(eol.regionLabel)}</div>
        <div style="font-size: 10px; color: #6F6F68;"><strong>Method:</strong> ${escapeHtml(eol.avoidedBurdenMethod)}</div>
        <div style="font-size: 10px; color: #6F6F68;"><strong>Data Year:</strong> ${eol.dataYear}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 8px;">
        <thead>
          <tr style="border-bottom: 1px solid #bae6fd;">
            <th style="text-align: left; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">Material</th>
            <th style="text-align: center; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">Recycling</th>
            <th style="text-align: center; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">Landfill</th>
            <th style="text-align: center; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">Incineration</th>
            <th style="text-align: center; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">Composting</th>
            <th style="text-align: center; padding: 4px 6px; color: #0c4a6e; font-size: 9px;">AD</th>
          </tr>
        </thead>
        <tbody>${pathwayRows}</tbody>
      </table>
      <div style="font-size: 9px; color: #6F6F68;">Sources: ${escapeHtml(eol.dataSource)}</div>
    </div>`;
}

function renderGoalAndScopePage(data: LCAReportData): string {
  const A = '#2B46C0';
  const allAssumptions = data.goalAndScope.assumptionsAndLimitations;
  const renderAssumption = (al: { type: string; text: string }) =>
    `<div style="display: flex; gap: 14px; padding: 10px 0; border-bottom: 1px solid #D9D6CB;">
      <span class="state state-quiet" style="flex-shrink: 0; align-self: flex-start; margin-top: 2px; width: 88px;">${escapeHtml(al.type)}</span>
      <span class="body" style="font-size: 11.5px; line-height: 1.5;">${escapeHtml(al.text)}</span>
    </div>`;

  // Split assumptions: first 4 on page 1, rest on continuation page
  const PAGE1_MAX = 4;
  const page1Assumptions = allAssumptions.slice(0, PAGE1_MAX);
  const overflowAssumptions = allAssumptions.slice(PAGE1_MAX);

  const audience = data.goalAndScope.intendedAudience.map(a =>
    `<span class="state" style="color: ${A}; margin-right: 16px; white-space: nowrap;">${escapeHtml(a)}</span>`
  ).join('');

  // A definition row: mono label, then the prose beneath it, hairline-separated.
  const defRow = (label: string, body: string, isHtml = false) => `
    <div>
      <div class="lead-label" style="margin-bottom: 8px;">${escapeHtml(label)}</div>
      <p class="body" style="font-size: 12px; line-height: 1.6;">${isHtml ? body : escapeHtml(body)}</p>
    </div>`;

  const page1 = `
    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('02', 'Goal & Scope Definition', false, false, A)}

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 22px;">
          <div class="eyebrow" style="color: ${A};">ISO 14044:2006 &sect;4.2</div>
          ${/* ISSUE E FIX: Display report version identifier (ISO 14044 §4.2.1). */ ''}
          <div class="lead-label">Report Version ${escapeHtml(data.meta.version)}</div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px 40px; margin-bottom: 24px;">
          ${defRow('Intended application', data.goalAndScope.intendedApplication)}
          ${defRow('Reasons for study', data.goalAndScope.reasonsForStudy)}
          <div>
            <div class="lead-label" style="margin-bottom: 10px;">Intended audience</div>
            <div>${audience}</div>
          </div>
          ${defRow('Comparative assertion', data.goalAndScope.isComparativeAssertion ? 'Yes: this study supports comparative assertions intended for public disclosure. A critical review panel is required per ISO 14044 §6.3.' : 'No: this study does not support comparative assertions disclosed to the public.')}
        </div>

        <div class="panel" style="margin-bottom: 24px;">
          <div class="lead-label" style="color: ${A}; margin-bottom: 8px;">System boundary &middot; ${escapeHtml(data.goalAndScope.systemBoundary)}</div>
          <p class="body" style="font-size: 12px; line-height: 1.6; margin-bottom: 16px;">${escapeHtml(data.goalAndScope.systemBoundaryDescription)}</p>
          <div style="display: flex; gap: 32px;">
            <div style="flex: 1;">
              <div class="lead-label" style="margin-bottom: 6px;">Cut-off criteria</div>
              <p class="body" style="font-size: 11px; line-height: 1.5;">${escapeHtml(data.goalAndScope.cutOffCriteria)}</p>
            </div>
            <div style="flex: 1;">
              <div class="lead-label" style="margin-bottom: 6px;">Allocation procedure</div>
              <p class="body" style="font-size: 11px; line-height: 1.5;">${escapeHtml(data.goalAndScope.allocationProcedure)}</p>
            </div>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <div class="lead-label" style="margin-bottom: 8px;">Assumptions &amp; limitations</div>
          ${page1Assumptions.map(renderAssumption).join('')}
        </div>

        ${overflowAssumptions.length === 0 ? renderEolMethodologySection(data) : ''}
      </div>

      ${renderPageFooter(2)}
    </div>`;

  // Continuation page for remaining assumptions + EoL methodology
  const page2 = overflowAssumptions.length > 0 ? `
    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('02', 'Goal & Scope Definition', false, true, A)}

        <div style="margin-bottom: 20px;">
          <div class="lead-label" style="margin-bottom: 8px;">Assumptions &amp; limitations (continued)</div>
          ${overflowAssumptions.map(renderAssumption).join('')}
        </div>

        ${renderEolMethodologySection(data)}
      </div>

      ${renderPageFooter()}
    </div>` : '';

  return page1 + page2;
}

function renderMethodologyPage(data: LCAReportData): string {
  const A = '#2B46C0';
  const stageRow = (s: string, tone: 'good' | 'stale', symbol: string) =>
    `<div style="display: flex; align-items: baseline; gap: 12px; padding: 7px 0; border-bottom: 1px solid #D9D6CB;">
      <span class="state state-${tone}" style="width: 14px; flex-shrink: 0;">${symbol}</span>
      <span class="body" style="font-size: 12px; color: #1A1B1D;">${escapeHtml(s)}</span>
    </div>`;

  const included = data.methodology.includedStages.map(s => stageRow(s, 'good', '&#10003;')).join('');
  const excluded = data.methodology.excludedStages.map(s => stageRow(s, 'stale', '&#10007;')).join('');

  const dataSources = data.methodology.dataSources.map(ds =>
    `<div style="display: flex; justify-content: space-between; align-items: baseline; gap: 16px; padding: 10px 0; border-bottom: 1px solid #D9D6CB;">
      <div>
        <span class="card-title" style="font-size: 13px;">${escapeHtml(ds.name)}</span>
        ${ds.version ? `<span class="lead-label" style="margin-left: 8px;">v${escapeHtml(ds.version)}</span>` : ''}
        ${ds.description ? `<div class="body" style="font-size: 10px; margin-top: 2px;">${escapeHtml(ds.description)}</div>` : ''}
      </div>
      <span style="font-size: 13px; color: #6F6F68; font-variant-numeric: tabular-nums; white-space: nowrap;">${ds.count} factors</span>
    </div>`
  ).join('');

  const charModels = data.methodology.characterizationModels.map(cm =>
    `<tr>
      <td>${escapeHtml(cm.category)}</td>
      <td>${escapeHtml(cm.model)}</td>
      <td style="color: #6F6F68;">${escapeHtml(cm.reference)}</td>
    </tr>`
  ).join('');

  const software = data.methodology.softwareAndDatabases.map(s =>
    `<div style="display: flex; align-items: baseline; gap: 12px; padding: 8px 0; border-bottom: 1px solid #D9D6CB;">
      <span class="card-title" style="font-size: 12px; width: 140px; flex-shrink: 0;">${/^alkatera$/i.test(s.name) ? alkateraName() : escapeHtml(s.name)} <span class="lead-label" style="letter-spacing: 0.12em;">v${escapeHtml(s.version)}</span></span>
      <span class="body" style="font-size: 11px;">${escapeHtml(s.purpose)}</span>
    </div>`
  ).join('');

  return `
    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('03', 'Methodology', false, false, A)}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 20px;">ISO 14044:2006 &sect;4.3 &amp; &sect;4.4</div>

        <div style="display: flex; gap: 40px; margin-bottom: 24px;">
          <div style="flex: 1;">
            <div class="lead-label" style="margin-bottom: 10px;">Included stages</div>
            ${included}
          </div>
          <div style="flex: 1;">
            <div class="lead-label" style="margin-bottom: 10px;">Excluded stages</div>
            ${excluded}
          </div>
        </div>

        <div class="panel" style="margin-bottom: 24px;">
          <div class="lead-label" style="color: ${A}; margin-bottom: 6px;">LCIA method &middot; ${escapeHtml(data.methodology.lciaMethod)}</div>
          <p class="body" style="font-size: 11px; line-height: 1.6;">${escapeHtml(data.methodology.lciaMethodDescription)}</p>
        </div>

        <div style="margin-bottom: 20px;">
          <div class="lead-label" style="margin-bottom: 10px;">Data sources &amp; databases</div>
          ${dataSources}
        </div>

        <div>
          <div class="lead-label" style="margin-bottom: 10px;">Software &amp; tools</div>
          ${software}
        </div>
      </div>

      ${renderPageFooter(3)}
    </div>

    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('03', 'Methodology, Characterisation Models', false, true, A)}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 20px;">LCIA characterisation factors</div>

        <table class="studio-table" style="margin-bottom: 28px;">
          <thead><tr><th>Impact Category</th><th>Characterisation Model</th><th>Reference</th></tr></thead>
          <tbody>${charModels}</tbody>
        </table>

        <div class="panel" style="border-left: 2px solid ${A};">
          <div class="lead-label" style="color: ${A}; margin-bottom: 8px;">Reference standards</div>
          ${data.goalAndScope.referenceStandards.map(s =>
            `<div class="body" style="font-size: 11px; padding: 3px 0;">&#8226; ${escapeHtml(s)}</div>`
          ).join('')}
        </div>
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

  const A = '#2B46C0';
  const dqTone = data.dataQuality.overallScore >= 80 ? 'good' :
    data.dataQuality.overallScore >= 50 ? 'attention' : 'stale';
  const dqStatement = data.dataQuality.overallScore >= 80 ? 'The data is strong.'
    : data.dataQuality.overallScore >= 50 ? 'The data is workable.' : 'The data needs strengthening.';

  const cs = data.dataQuality.coverageSummary;

  // Pedigree bar helper (1=best, 5=worst). Track is #D9D6CB; fill keeps its
  // semantic working tone; the score is tabular.
  const pedigreeBar = (score: number) => {
    const pct = ((6 - score) / 5) * 100;
    const color = score <= 2 ? '#047857' : score <= 3 ? '#B45309' : '#BE123C';
    return `<div style="display: flex; align-items: center; gap: 8px;">
      <div style="flex: 1; height: 8px; background: #D9D6CB; border-radius: 4px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: ${color}; border-radius: 4px;"></div>
      </div>
      <span style="font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; width: 20px; text-align: center;">${score}</span>
    </div>`;
  };

  // Source → state: Primary is good, Proxy is stale, secondary attention.
  const sourceTone = (source: string) => source.includes('Primary') ? 'good' : source.includes('Proxy') ? 'stale' : 'attention';

  const materialQualityRows = data.dataQuality.materialQuality.slice(0, 12).map(m =>
    `<tr>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(m.name)}</td>
      <td><span class="state state-${sourceTone(m.source)}">${escapeHtml(m.source.split(' (')[0])}</span></td>
      <td>${escapeHtml(m.grade)}</td>
      <td><span class="num">${m.confidence > 0 ? `${m.confidence}%` : '&#8212;'}</span></td>
      <td>${escapeHtml(m.geographicCoverage)}</td>
    </tr>`
  ).join('');

  // Coverage figures as hairline-separated lead numbers, not boxed cards.
  const coverageStat = (value: string, label: string, sub: string, colour: string) => `
    <div style="flex: 1;">
      <div class="lead-number" style="font-size: 30px; color: ${colour};">${value}</div>
      <div class="lead-label" style="margin-top: 8px;">${escapeHtml(label)}</div>
      <div class="body" style="font-size: 10px; margin-top: 3px;">${escapeHtml(sub)}</div>
    </div>`;

  return `
    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '04',
          section: 'Data quality assessment',
          value: `${data.dataQuality.overallScore}%`,
          label: `Data quality · ${data.dataQuality.overallRating}`,
          statement: dqStatement,
          accent: A,
        })}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 20px;">ISO 14044:2006 &sect;4.2.3.6 &middot; Data quality requirements</div>

        <div style="margin-bottom: 24px;">
          <div class="lead-label" style="margin-bottom: 12px;">Pedigree matrix (ISO 14044 &sect;4.2.3.6)</div>
          ${pedigreeRows.map(r =>
            `<div style="display: grid; grid-template-columns: 100px 1fr 180px; gap: 8px; align-items: center; margin-bottom: 8px;">
              <span class="card-title" style="font-size: 11px;">${r.label}</span>
              ${pedigreeBar(r.score)}
              <span class="body" style="font-size: 10px;">${r.desc}</span>
            </div>`
          ).join('')}
          <div class="body" style="font-size: 9px; margin-top: 6px;">Scale: 1 (best) to 5 (worst) per ecoinvent pedigree approach</div>
        </div>

        <div class="rule" style="padding-top: 20px; margin-bottom: 24px; display: flex; gap: 32px;">
          ${coverageStat(`${cs.primaryDataShare}%`, 'Primary data', `${cs.primaryCount} of ${cs.totalMaterials} materials`, '#047857')}
          ${coverageStat(`${cs.secondaryDataShare}%`, 'Secondary data', `${cs.secondaryCount} materials`, A)}
          ${coverageStat(`${cs.proxyDataShare}%`, 'Proxy data', `${cs.proxyCount} materials`, '#B45309')}
          ${coverageStat(String(cs.totalMaterials), 'Total materials', 'in inventory', '#1A1B1D')}
        </div>

        <div class="lead-label" style="margin-bottom: 10px;">Material-level data quality</div>
        <table class="studio-table">
          <thead><tr><th>Material</th><th>Source</th><th>Grade</th><th>Confidence</th><th>Geography</th></tr></thead>
          <tbody>${materialQualityRows}</tbody>
        </table>
      </div>

      ${renderPageFooter(5)}
    </div>

    <div class="page light-page" style="position: relative;">
      ${mark('triangle', 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('04', 'Data Quality, Notes', false, true, A)}

        <div class="panel" style="margin-bottom: 16px;">
          <div class="lead-label" style="margin-bottom: 8px;">Missing data treatment (ISO 14044 &sect;4.2.3.6.3)</div>
          <p class="body" style="font-size: 12px; line-height: 1.7;">${escapeHtml(data.dataQuality.missingDataTreatment)}</p>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="lead-label" style="margin-bottom: 8px;">Uncertainty assessment</div>
          <p class="body" style="font-size: 12px; line-height: 1.7;">${escapeHtml(data.dataQuality.uncertaintyNote)}</p>
        </div>

        <div class="panel" style="margin-bottom: 16px;">
          <div class="lead-label" style="margin-bottom: 12px;">Data quality improvement roadmap</div>
          <div style="display: grid; grid-template-columns: auto 1fr; gap: 10px 16px; align-items: baseline;">
            <div class="state state-stale">Priority 1</div>
            <div class="body" style="font-size: 12px; line-height: 1.6;">Collect primary data from the top 3 impact contributors: this typically addresses &gt;60% of total climate impact uncertainty.</div>
            <div class="state state-attention">Priority 2</div>
            <div class="body" style="font-size: 12px; line-height: 1.6;">Replace proxy emission factors with material-specific secondary data from ecoinvent or AGRIBALYSE for improved geographic and technological representativeness.</div>
            <div class="state state-attention">Priority 3</div>
            <div class="body" style="font-size: 12px; line-height: 1.6;">Verify transport distances and modes with suppliers to refine distribution stage estimates currently based on distance &times; freight factor calculations.</div>
            <div class="state state-good">Ongoing</div>
            <div class="body" style="font-size: 12px; line-height: 1.6;">Annual data refresh with updated DEFRA emission factors and database versions. Re-assess data quality scores after each improvement cycle.</div>
          </div>
        </div>

        <div class="panel" style="border-left: 2px solid ${A};">
          <div class="lead-label" style="color: ${A}; margin-bottom: 12px;">Data source distribution</div>
          <div style="display: flex; gap: 24px; align-items: center;">
            <div style="flex: 1; height: 24px; border-radius: 6px; overflow: hidden; display: flex; background: #D9D6CB;">
              <div style="width: ${cs.primaryDataShare}%; background: #047857; min-width: ${cs.primaryDataShare > 0 ? '2px' : '0'};"></div>
              <div style="width: ${cs.secondaryDataShare}%; background: ${A};"></div>
              <div style="width: ${cs.proxyDataShare}%; background: #B45309;"></div>
            </div>
            <div class="lead-label" style="white-space: nowrap; letter-spacing: 0.12em;">
              <span style="display: inline-block; width: 8px; height: 8px; background: #047857; border-radius: 2px; margin-right: 4px;"></span>Primary ${cs.primaryDataShare}%
              <span style="display: inline-block; width: 8px; height: 8px; background: ${A}; border-radius: 2px; margin-left: 12px; margin-right: 4px;"></span>Secondary ${cs.secondaryDataShare}%
              <span style="display: inline-block; width: 8px; height: 8px; background: #B45309; border-radius: 2px; margin-left: 12px; margin-right: 4px;"></span>Proxy ${cs.proxyDataShare}%
            </div>
          </div>
        </div>
      </div>

      ${renderPageFooter(6)}
    </div>`;
}

function renderClimatePage(data: LCAReportData): string {
  const maxStageValue = Math.max(...data.climateImpact.stages.map(s => s.value), 0.001);

  // Headline is the fossil-only carbon footprint (ISO 14067 §6.4.9.3). Biogenic
  // carbon is reported separately (Section 06) and the lifecycle stage bars below
  // are all-species, so explain the difference rather than leave the headline
  // looking inconsistent with the stage totals.
  const totalAllSpecies = parseFloat(data.ghgDetailed?.totalGwp100 || '0');
  const fossilHeadline = parseFloat(data.climateImpact.totalCarbon || '0');
  const biogenicSeparate = totalAllSpecies - fossilHeadline;
  const biogenicHeadlineNote = biogenicSeparate > 0.0005
    ? `<div style="font-size: 9px; color: #6F6F68; margin-top: 8px; line-height: 1.4; max-width: 340px;">Fossil carbon footprint per ISO 14067:2018. Biogenic carbon (${biogenicSeparate.toFixed(4)} kg CO&#8322;e) is reported separately in Section 06 and excluded here. The lifecycle stage bars below include biogenic carbon and sum to ${totalAllSpecies.toFixed(4)} kg CO&#8322;e.</div>`
    : '';

  const stagesBars = data.climateImpact.stages.map(stage =>
    `<div style="display: flex; align-items: center; gap: 12px; margin-bottom: 11px;">
      <div class="lead-label" style="width: 108px; text-align: right; flex-shrink: 0; color: #6F6F68;">${escapeHtml(stage.label)}</div>
      <div style="flex: 1; height: 16px; background: #D9D6CB; border-radius: 6px; overflow: hidden;">
        <div style="height: 100%; width: ${Math.max((stage.value / maxStageValue) * 100, 1)}%; background: ${stage.color}; border-radius: 6px;"></div>
      </div>
      <div style="width: 96px; font-size: 11px; font-variant-numeric: tabular-nums; color: #6F6F68; flex-shrink: 0;">${stage.value.toFixed(4)} ${escapeHtml(stage.unit)}</div>
      <div class="lead-number" style="width: 46px; font-size: 14px; text-align: right; flex-shrink: 0; color: ${CHAPTERS.footprint.accent};">${escapeHtml(stage.percentage)}<span style="font-size: 9px;">%</span></div>
    </div>`
  ).join('');

  const donutStyle = donutGradient(data.climateImpact.breakdown);

  // Say the number, then name the hotspot: the dominant lifecycle stage.
  const topStage = [...data.climateImpact.stages].sort((a, b) => b.value - a.value)[0];
  const hotspot = topStage
    ? `The ${topStage.label.toLowerCase()} is the hotspot.`
    : 'Where the carbon sits.';

  const A = CHAPTERS.footprint.accent;

  return `
    <div class="page dark-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
        ${renderSectionLead({
          number: '05',
          section: 'Climate impact',
          value: data.climateImpact.totalCarbon,
          unit: 'kg CO₂e',
          label: `Fossil carbon footprint, GWP-100 · per ${data.functionalUnit.value}`,
          statement: hotspot,
          dark: true,
          accent: A,
        })}

        <div style="display: flex; gap: 32px; align-items: flex-start;">
          <div style="flex: 1;">
            <div class="eyebrow dim" style="margin-bottom: 16px;">Lifecycle stage breakdown</div>
            ${stagesBars}
            ${biogenicHeadlineNote}
          </div>
          <div style="width: 168px; height: 168px; border-radius: 50%; ${donutStyle} position: relative; flex-shrink: 0;">
            <div style="position: absolute; inset: 42px; background: #F2F1EA; border-radius: 50%;"></div>
          </div>
        </div>

        <div style="display: flex; flex-wrap: wrap; gap: 6px 18px; margin-top: 18px;">
          ${data.climateImpact.breakdown.map(b =>
            `<div style="display: flex; align-items: center; gap: 7px;">
              <div style="width: 9px; height: 9px; border-radius: 50%; background: ${b.color};"></div>
              <span class="lead-label" style="color: #6F6F68;">${escapeHtml(b.name)}</span>
            </div>`
          ).join('')}
        </div>

        <div class="rule" style="margin-top: 22px; padding-top: 20px; display: flex; gap: 40px;">
          ${data.climateImpact.scopes.map(s =>
            `<div>
              <div class="lead-number" style="font-size: 30px; color: #1A1B1D;">${escapeHtml(s.value)}<span style="font-size: 13px;">%</span></div>
              <div class="lead-label" style="margin-top: 6px;">${escapeHtml(s.name)}</div>
            </div>`
          ).join('')}
        </div>

        ${data.contractManufacturingNote ? `
          <div class="panel" style="margin-top: 22px; border-left: 2px solid ${CHAPTERS.footprint.accent};">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span class="eyebrow" style="color: ${CHAPTERS.footprint.accent};">Scope attribution</span>
              <span class="state state-good">Correct</span>
            </div>
            <div class="body" style="font-size: 11.5px;">${escapeHtml(data.contractManufacturingNote.explanation)}</div>
          </div>
        ` : ''}
      </div>

      ${renderPageFooter(7, true)}
    </div>`;
}

function renderViticulturePage(data: LCAReportData): string {
  const viti = data.viticultureDetail;
  const removals = data.flagRemovals;
  if (!viti) return ''; // No viticulture data - skip this page entirely

  const A = CHAPTERS.footprint.accent;

  // Extended impact rows (only non-zero)
  const extImpacts = [
    { label: 'Freshwater ecotoxicity', ...viti.extendedImpacts.freshwaterEcotoxicity },
    { label: 'Terrestrial ecotoxicity', ...viti.extendedImpacts.terrestrialEcotoxicity },
    { label: 'Human toxicity (non-carcinogenic)', ...viti.extendedImpacts.humanToxicity },
    { label: 'Freshwater eutrophication', ...viti.extendedImpacts.freshwaterEutrophication },
    { label: 'Water scarcity (AWARE)', ...viti.extendedImpacts.waterScarcity },
  ].filter(i => i.value > 0);

  const vintageText = viti.vintageYears.length > 0
    ? `Based on ${viti.vintageYears.length} vintage${viti.vintageYears.length > 1 ? 's' : ''} (${viti.vintageYears.join(', ')}), ${viti.averagingMethod === 'median_3yr' ? 'median averaging' : viti.averagingMethod === 'average_2yr' ? '2-year average' : 'single vintage'}.`
    : '';

  const fmtNum = (n: number, d = 4) => n < 0.001 && n > 0 ? n.toExponential(2) : n.toFixed(d);

  // Data quality grade → typographic state chip.
  const grade = (viti.dataQualityGrade || '').toString().toUpperCase();
  const gradeTone = grade.startsWith('HIGH') ? 'state-good' : grade.startsWith('MEDIUM') ? 'state-attention' : grade.startsWith('LOW') ? 'state-stale' : 'state-quiet';

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '05b',
          section: 'Viticulture & land stewardship',
          value: fmtNum(viti.emissionsTotal),
          unit: 'kg CO₂e',
          label: `Viticulture emissions · ${viti.percentOfTotal}% of the product footprint`,
          statement: 'What the vineyard carries.',
          accent: A,
        })}

        <div class="rule" style="padding-top: 18px; margin-bottom: 26px; display: flex; gap: 48px; align-items: baseline;">
          <div>
            <div class="lead-number" style="font-size: 34px; color: ${A};">${viti.percentOfTotal}<span style="font-size: 15px;">%</span></div>
            <div class="lead-label" style="margin-top: 6px;">Share of product footprint</div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 34px; color: ${A};">${viti.primaryDataPercent}<span style="font-size: 15px;">%</span></div>
            <div class="lead-label" style="margin-top: 6px;">From primary vineyard data</div>
          </div>
          <div style="margin-left: auto;">
            <span class="eyebrow" style="color: ${A};">Data quality</span>
            <span class="state ${gradeTone}" style="margin-left: 8px;">${escapeHtml(grade || 'N/A')}</span>
          </div>
        </div>

        ${removals && removals.soilCarbonCo2e > 0 ? `
        <div class="rule" style="padding-top: 18px; margin-bottom: 18px; display: flex; gap: 48px;">
          <div>
            <div class="eyebrow" style="color: ${A}; margin-bottom: 8px;">Emissions (FLAG)</div>
            <div class="lead-number" style="font-size: 30px; color: #1A1B1D;">${fmtNum(viti.emissionsTotal)} <span style="font-size: 12px; color: #6F6F68;">kg CO&#8322;e</span></div>
            <div class="body" style="font-size: 11px; margin-top: 8px; max-width: 240px;">Includes N&#8322;O from soils, fuel combustion, pesticide production, and irrigation energy.</div>
          </div>
          <div>
            <div class="eyebrow" style="color: #047857; margin-bottom: 8px;">Removals (FLAG)</div>
            <div class="lead-number" style="font-size: 30px; color: #047857;">${fmtNum(removals.soilCarbonCo2e)} <span style="font-size: 12px; color: #047857;">kg CO&#8322;e</span></div>
            <div class="body" style="font-size: 11px; margin-top: 8px; max-width: 240px; color: #047857;">Soil carbon sequestration (${removals.isVerified ? 'verified measurement' : 'practice-based default'}).</div>
          </div>
        </div>
        ${removals.removalWarning ? `
        <div class="panel" style="margin-bottom: 14px; border-left: 2px solid #B45309; padding: 12px 16px;">
          <div class="body" style="font-size: 10.5px;"><span class="state state-attention">Verification note</span> &nbsp;${escapeHtml(removals.removalWarning)}</div>
        </div>
        ` : ''}
        <div class="panel" style="margin-bottom: 22px; border-left: 2px solid ${A};">
          <div class="eyebrow" style="color: ${A}; margin-bottom: 8px;">SBTi FLAG compliance</div>
          <div class="body" style="font-size: 11px;">Emissions and removals are reported separately and never netted, in accordance with SBTi Forest, Land and Agriculture (FLAG) Guidance v1.2 and the GHG Protocol Land Sector and Removals Standard V1.0. Removals represent soil organic carbon sequestration using the carbon stock change approach and are reported as positive values.</div>
        </div>
        ` : ''}

        ${extImpacts.length > 0 ? `
        <div class="eyebrow" style="color: ${A}; margin-bottom: 12px;">Extended environmental impact categories</div>
        <table class="studio-table" style="margin-bottom: 6px;">
          <thead><tr>
            <th>Impact category</th>
            <th style="text-align: right;">Value</th>
            <th>Unit</th>
          </tr></thead>
          <tbody>
            ${extImpacts.map(i => `
              <tr>
                <td style="font-weight: 500;">${escapeHtml(i.label)}</td>
                <td style="text-align: right;"><span class="num">${fmtNum(i.value)}</span></td>
                <td style="color: #6F6F68;">${escapeHtml(i.unit)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="lead-label" style="margin-bottom: 22px; text-transform: none; letter-spacing: 0.02em; color: #6F6F68; font-size: 9px;">Ecotoxicity characterisation: USEtox 2.0 (UNEP-SETAC consensus model). Water scarcity: AWARE method (ISO 14046).</div>
        ` : ''}

        <div class="panel">
          <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Data provenance</div>
          ${vintageText ? `<div class="body" style="font-size: 11px; margin-bottom: 8px;">${escapeHtml(vintageText)}</div>` : ''}
          <div class="body" style="font-size: 11px; margin-bottom: 8px;"><strong style="color: #1A1B1D;">Primary data collected:</strong> Fertiliser type, quantity, and N content; pesticide applications and type; diesel and petrol consumption; irrigation volume and energy source; grape yield; soil management practice.</div>
          <div class="body" style="font-size: 11px;"><strong style="color: #1A1B1D;">Secondary emission factors:</strong> IPCC 2019 Refinement Tier 1 (N&#8322;O); DEFRA 2025 (fuel combustion); USEtox 2.0 (ecotoxicity); AWARE (water scarcity); ecoinvent 3.12 (grid electricity).</div>
        </div>
      </div>

      ${renderPageFooter(8, true)}
    </div>`;
}

function renderProcessingPage(data: LCAReportData): string {
  const pd = data.processingDetail;
  if (!pd || pd.facilities.length === 0) return ''; // No processing data - skip page

  const A = CHAPTERS.footprint.accent;

  const fmtNum = (s: string) => {
    const n = parseFloat(s);
    return n < 0.001 && n > 0 ? n.toExponential(2) : s;
  };

  // Count contract manufacturers vs owned
  const ownedCount = pd.facilities.filter(f => !f.isContractManufacturer).length;
  const cmCount = pd.facilities.filter(f => f.isContractManufacturer).length;

  const renderFacilityCard = (facility: typeof pd.facilities[0]) => `
        <div class="panel" style="margin-bottom: 18px; border-left: 2px solid ${facility.isContractManufacturer ? '#B45309' : A};">

          <!-- Facility header -->
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 16px;">
            <div>
              <span class="card-title" style="font-size: 16px;">${escapeHtml(facility.name)}</span>
              ${facility.countryCode ? `<span class="lead-label" style="margin-left: 8px;">${escapeHtml(facility.countryCode)}</span>` : ''}
            </div>
            <div style="display: flex; gap: 14px; align-items: baseline;">
              <span class="state ${facility.isContractManufacturer ? 'state-attention' : 'state-good'}">${facility.isContractManufacturer ? 'Contract manufacturer · Scope 3' : 'Owned facility · Scope 1 & 2'}</span>
              <span class="state state-quiet">${escapeHtml(facility.dataSource)}</span>
            </div>
          </div>

          <!-- Emissions row: hairline stats -->
          ${facility.isContractManufacturer ? `
          <div class="rule" style="padding-top: 14px; margin-bottom: 14px; display: flex; gap: 36px;">
            <div>
              <div class="lead-number" style="font-size: 26px; color: #1A1B1D;">${fmtNum(facility.totalEmissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Scope 3 total <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
            <div>
              <div class="lead-number" style="font-size: 26px; color: #BE123C;">${fmtNum(facility.scope1Emissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Combustion <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
            <div>
              <div class="lead-number" style="font-size: 26px; color: #2B46C0;">${fmtNum(facility.scope2Emissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Electricity <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
          </div>
          <div class="body" style="font-size: 10.5px; margin-bottom: 14px;"><span class="state state-attention">Scope 3 Cat. 1</span> &nbsp;All emissions from this contract manufacturer are classified as Scope 3 Category 1 (Purchased Goods and Services) in the product footprint. The combustion/electricity split shows the emission source at the facility level.</div>
          ` : `
          <div class="rule" style="padding-top: 14px; margin-bottom: 14px; display: flex; gap: 36px;">
            <div>
              <div class="lead-number" style="font-size: 26px; color: #1A1B1D;">${fmtNum(facility.totalEmissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Total <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
            <div>
              <div class="lead-number" style="font-size: 26px; color: #BE123C;">${fmtNum(facility.scope1Emissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Scope 1 <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
            <div>
              <div class="lead-number" style="font-size: 26px; color: #2B46C0;">${fmtNum(facility.scope2Emissions)}</div>
              <div class="lead-label" style="margin-top: 5px;">Scope 2 <span class="state state-quiet">kg CO&#8322;e/unit</span></div>
            </div>
            <div>
              <div class="lead-number" style="font-size: 26px; color: #2B46C0;">${facility.waterLitres}</div>
              <div class="lead-label" style="margin-top: 5px;">Water <span class="state state-quiet">litres/unit</span></div>
            </div>
          </div>
          `}

          ${facility.energyBreakdown.length > 0 ? `
          <!-- Energy breakdown table -->
          <table class="studio-table" style="margin-bottom: 8px;">
            <thead>
              <tr>
                <th>Energy source</th>
                <th style="text-align: right;">Quantity</th>
                <th>Unit</th>
                <th style="text-align: right;">Emissions (kg CO&#8322;e)</th>
                <th>${facility.isContractManufacturer ? 'Source' : 'Scope'}</th>
              </tr>
            </thead>
            <tbody>
              ${facility.energyBreakdown.map(e => {
                const scopeLabel = facility.isContractManufacturer
                  ? (e.scope === 'Scope 1' ? 'Combustion' : 'Electricity')
                  : e.scope;
                return `
                <tr>
                  <td style="font-weight: 500;">${escapeHtml(e.type)}</td>
                  <td style="text-align: right;"><span class="num">${e.quantity}</span></td>
                  <td style="color: #6F6F68;">${e.unit}</td>
                  <td style="text-align: right;"><span class="num">${e.emissions}</span></td>
                  <td style="color: ${e.scope === 'Scope 1' ? '#BE123C' : '#2B46C0'};">${scopeLabel}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
          ` : ''}

          <!-- Attribution info -->
          <div class="lead-label" style="text-transform: none; letter-spacing: 0.02em; color: #6F6F68; font-size: 9px; display: flex; gap: 16px; flex-wrap: wrap;">
            <span>Attribution: ${facility.attributionRatio}% of facility output</span>
            <span>Production volume: ${facility.productionVolume.toLocaleString()} units</span>
            ${facility.gridEmissionFactor ? `<span>Grid factor: ${facility.gridEmissionFactor}</span>` : ''}
            ${parseFloat(facility.electricityKwh) > 0 ? `<span>Electricity: ${facility.electricityKwh} kWh (attributed)</span>` : ''}
          </div>

          ${facility.dataCollectionMode && facility.dataCollectionMode !== 'primary' ? `
          <!-- Data Quality Declaration (ISO 14044 §4.2.3.6 / ISO 14067 §6.3.5) -->
          <div class="panel" style="margin-top: 14px; border-left: 2px solid #B45309; background: #ECEAE3;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
              <div class="eyebrow" style="color: #B45309;">Secondary data &mdash; ${facility.dataCollectionMode === 'archetype_proxy' ? 'Archetype proxy' : 'Hybrid (archetype + primary)'}</div>
              ${facility.proxyUncertaintyPct ? `<span class="state state-attention">Uncertainty &plusmn;${facility.proxyUncertaintyPct}%</span>` : ''}
            </div>
            ${facility.archetypeName ? `<div class="body" style="font-size: 11px; margin-bottom: 6px;"><strong style="color: #1A1B1D;">Archetype:</strong> ${escapeHtml(facility.archetypeName)}</div>` : ''}
            ${facility.proxyJustification ? `<div class="body" style="font-size: 11px; margin-bottom: 8px;"><strong style="color: #1A1B1D;">Justification:</strong> ${escapeHtml(facility.proxyJustification)}</div>` : ''}
            ${facility.proxyPedigree ? `
              <div class="body" style="font-size: 10px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-bottom: 8px;">
                <div><strong style="color: #1A1B1D;">R:</strong> ${facility.proxyPedigree.reliability}</div>
                <div><strong style="color: #1A1B1D;">C:</strong> ${facility.proxyPedigree.completeness}</div>
                <div><strong style="color: #1A1B1D;">T:</strong> ${facility.proxyPedigree.temporal}</div>
                <div><strong style="color: #1A1B1D;">G:</strong> ${facility.proxyPedigree.geographical}</div>
                <div><strong style="color: #1A1B1D;">Tech:</strong> ${facility.proxyPedigree.technological}</div>
              </div>
              <div class="lead-label" style="text-transform: none; letter-spacing: 0.02em; font-size: 9px; margin-bottom: 8px;">Pedigree matrix (1 best &ndash; 5 worst): Reliability, Completeness, Temporal, Geographical, Technological</div>
            ` : ''}
            ${facility.proxySourceCitation ? `<div class="body" style="font-size: 10px; margin-bottom: 8px;"><strong style="color: #1A1B1D;">Source:</strong> ${escapeHtml(facility.proxySourceCitation)}</div>` : ''}
            ${facility.upgradeActions && facility.upgradeActions.length > 0 ? `
              <div class="eyebrow" style="color: #B45309; margin-top: 8px; margin-bottom: 6px;">Data improvement plan</div>
              <ul class="body" style="font-size: 10px; padding-left: 16px; margin: 0;">
                ${facility.upgradeActions.map(a => `<li style="margin-bottom: 2px;">${escapeHtml(a)}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
          ` : ''}
        </div>`;

  const methodologyNote = `
      <div class="panel" style="border-left: 2px solid ${A};">
        <div class="eyebrow" style="color: ${A}; margin-bottom: 8px;">Methodology</div>
        <div class="body" style="font-size: 11px; margin-bottom: 6px;">Processing emissions are allocated to the product using physical allocation by production volume (ISO 14044 Clause 4.3.4). Scope 1 factors from DEFRA 2025 GHG Conversion Factors; Scope 2 electricity from IEA/DEFRA 2023 country-specific grid emission factors.</div>
        <div class="body" style="font-size: 11px;">Contract manufacturer emissions are classified as Scope 3 Category 1 (Purchased Goods and Services) per GHG Protocol Product Standard &sect;6.3.3. Owned facility emissions are classified as Scope 1 (direct combustion) and Scope 2 (purchased electricity/heat).</div>
      </div>`;

  // Page 1: headline lead + first facility
  const page1 = `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '05c',
          section: 'Processing & manufacturing',
          value: fmtNum(pd.totalProcessingEmissions),
          unit: 'kg CO₂e',
          label: `Processing emissions · ${pd.percentOfTotal}% of the product footprint · ${pd.facilities.length} facilit${pd.facilities.length === 1 ? 'y' : 'ies'}${ownedCount > 0 || cmCount > 0 ? ` (${[ownedCount > 0 ? `${ownedCount} owned` : '', cmCount > 0 ? `${cmCount} contract` : ''].filter(Boolean).join(', ')})` : ''}`,
          statement: 'Where the product is made.',
          accent: A,
        })}

        ${renderFacilityCard(pd.facilities[0])}

        ${pd.facilities.length === 1 ? methodologyNote : ''}
      </div>

      ${renderPageFooter(undefined, true)}
    </div>`;

  // Continuation pages: remaining facilities (1 per page), methodology on last
  const remainingFacilities = pd.facilities.slice(1);
  const continuationPages = remainingFacilities.map((facility, idx) => {
    const isLastFacility = idx === remainingFacilities.length - 1;
    return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('05c', 'Processing & Manufacturing', false, true, A)}

        ${renderFacilityCard(facility)}

        ${isLastFacility ? methodologyNote : ''}
      </div>

      ${renderPageFooter(undefined, true)}
    </div>`;
  }).join('');

  return page1 + continuationPages;
}

function renderGhgDetailedPage(data: LCAReportData): string {
  const ghg = data.ghgDetailed;
  const A = CHAPTERS.footprint.accent;

  // The three CO2 species, as a hairline-separated big-number row rather than
  // boxed cards. Each keeps its working tone.
  const species = [
    { label: 'Fossil CO₂', value: ghg.fossilCo2, tone: '#BE123C' },
    { label: 'Biogenic CO₂', value: ghg.biogenicCo2, tone: '#047857' },
    { label: 'LULUC CO₂', value: ghg.dlucCo2, tone: '#B45309' },
  ];

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
        ${renderSectionLead({
          number: '06',
          section: 'Detailed GHG reporting',
          value: ghg.totalGwp100,
          unit: 'kg CO₂e',
          label: 'Total GWP-100, all species · ISO 14067:2018',
          statement: 'The gases behind the number, itemised.',
          accent: A,
        })}

        <div style="display: flex; gap: 40px; margin-bottom: 26px;">
          ${species.map(s =>
            `<div style="flex: 1;">
              <div class="lead-number" style="font-size: 34px; color: ${s.tone};">${escapeHtml(s.value)}</div>
              <div class="lead-label" style="margin-top: 8px;">${escapeHtml(s.label)}</div>
              <div class="lead-label" style="margin-top: 3px; letter-spacing: 0.14em; opacity: 0.7;">kg CO₂e</div>
            </div>`
          ).join('')}
        </div>

        <table class="studio-table" style="margin-bottom: 22px;">
          <thead><tr><th>GHG species</th><th>Mass (kg)</th><th>CO₂e (kg)</th><th>GWP-100</th></tr></thead>
          <tbody>
            <tr>
              <td>CO₂ (fossil)</td>
              <td class="num">${escapeHtml(ghg.fossilCo2)}</td>
              <td class="num">${escapeHtml(ghg.fossilCo2)}</td>
              <td class="num">1</td>
            </tr>
            <tr>
              <td>CO₂ (biogenic)</td>
              <td class="num">${escapeHtml(ghg.biogenicCo2)}</td>
              <td class="num">${escapeHtml(ghg.biogenicCo2)}</td>
              <td class="num">1*</td>
            </tr>
            <tr>
              <td>CO₂ (LULUC)</td>
              <td class="num">${escapeHtml(ghg.dlucCo2)}</td>
              <td class="num">${escapeHtml(ghg.dlucCo2)}</td>
              <td class="num">1</td>
            </tr>
            <tr>
              <td>CH₄ (fossil)</td>
              <td class="num">${escapeHtml(ghg.ch4Fossil)}</td>
              <td class="num">${escapeHtml(ghg.ch4FossilKgCo2e)}</td>
              <td class="num">29.8</td>
            </tr>
            <tr>
              <td>CH₄ (biogenic)</td>
              <td class="num">${escapeHtml(ghg.ch4Biogenic)}</td>
              <td class="num">${escapeHtml(ghg.ch4BiogenicKgCo2e)}</td>
              <td class="num">27.0</td>
            </tr>
            <tr>
              <td>N₂O</td>
              <td class="num">${escapeHtml(ghg.n2o)}</td>
              <td class="num">${escapeHtml(ghg.n2oKgCo2e)}</td>
              <td class="num">273</td>
            </tr>
            <tr>
              <td>HFCs / PFCs</td>
              <td class="num">·</td>
              <td class="num">${escapeHtml(ghg.hfcPfc)}</td>
              <td class="num">Variable</td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Total GWP-100 (all species)</td>
              <td></td>
              <td class="num" style="font-weight: 700; color: ${A};">${escapeHtml(ghg.totalGwp100)}</td>
              <td></td>
            </tr>
            <tr>
              <td style="font-weight: 700;">Fossil carbon footprint (excl. biogenic)</td>
              <td></td>
              <td class="num" style="font-weight: 700; color: #1A1B1D;">${escapeHtml(ghg.fossilOnlyTotal || ghg.totalGwp100)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>

        <div class="panel" style="margin-bottom: 16px; border-left: 2px solid ${A};">
          <div class="eyebrow" style="color: ${A}; margin-bottom: 8px;">Biogenic carbon note · ISO 14067:2018</div>
          <p class="body" style="font-size: 11.5px;">${escapeHtml(ghg.biogenicNote)}</p>
        </div>

        <div class="body" style="font-size: 11px; margin-bottom: 8px;">
          <strong style="color: #1A1B1D;">GWP method:</strong> ${escapeHtml(ghg.gwpMethod)} · all GWP-100 values from IPCC Sixth Assessment Report (AR6, 2021).
        </div>
        <div class="body" style="font-size: 10px;">
          * Per ISO 14067:2018 §6.4.9.3, biogenic CO₂ is characterised at GWP=1 for the species inventory but reported separately from the fossil carbon footprint. The net biogenic carbon balance (uptake minus end-of-life release) is excluded from the headline fossil footprint figure.
        </div>
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

    const A = CHAPTERS.footprint.accent;

    // Each category is a hairline big-number row: name and indicator on the
    // left, the figure on the right, then the description and any top
    // contributors as a mono middot list. No boxes.
    const categoryRows = pageCategories.map((cat, idx) => {
      const topContribs = cat.topContributors.length > 0
        ? `<div class="lead-label" style="margin-top: 8px; letter-spacing: 0.14em; opacity: 0.7;">Top contributors</div>
           <div style="display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 5px;">
             ${cat.topContributors.map(tc =>
               `<span class="body" style="font-size: 10px;">${escapeHtml(tc.name)} <span style="color: ${A}; font-variant-numeric: tabular-nums;">${escapeHtml(tc.percentage)}</span></span>`
             ).join('')}
           </div>`
        : '';

      return `
        <div class="${idx === 0 ? '' : 'rule'}" style="padding: ${idx === 0 ? '0' : '18px'} 0 18px 0;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 24px;">
            <div>
              <div class="card-title" style="font-size: 15px;">${escapeHtml(cat.name)}</div>
              <div class="lead-label" style="margin-top: 4px;">${escapeHtml(cat.indicator)}</div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <span class="lead-number" style="font-size: 26px; color: #1A1B1D;">${escapeHtml(cat.totalValue)}</span>
              <span class="lead-label" style="margin-left: 8px;">${escapeHtml(cat.unit)}</span>
            </div>
          </div>
          <p class="body" style="font-size: 11px; margin-top: 8px;">${escapeHtml(cat.description)}</p>
          ${topContribs}
        </div>`;
    }).join('');

    pages.push(`
      <div class="page light-page" style="position: relative;">
        ${mark(CHAPTERS.footprint.mark, 'br', A)}
        <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
          ${isFirstPage
            ? renderSectionHeader('07', 'Environmental Impact Categories', false, false, A)
            : renderSectionHeader('07', 'Environmental Impact Categories', false, true, A)
          }

          ${isFirstPage ? `
            <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">ISO 14044:2006 §4.4 · life cycle impact assessment</div>
            <div class="panel" style="margin-bottom: 22px; border-left: 2px solid ${A};">
              <p class="body" style="font-size: 11.5px;"><strong style="color: #1A1B1D;">Method:</strong> ${escapeHtml(data.environmentalImpacts.referenceMethod)} · ${escapeHtml(data.environmentalImpacts.normalisationNote)}</p>
            </div>
          ` : ''}

          ${categoryRows}

          ${renderPageFooter(pageNum)}
        </div>
      </div>`);
  }

  return pages.join('\n');
}

function renderIngredientBreakdownPage(data: LCAReportData): string {
  const ingredients = data.ingredientBreakdown.ingredients;
  if (ingredients.length === 0) return '';

  const hasProxies = data.ingredientBreakdown.hasProxies;
  const A = CHAPTERS.sources.accent; // #A97C14 -- ochre's ink form, legible on paper

  // Split into pages of 10 rows
  const perPage = 10;
  const pages: string[] = [];

  // ── Reconciliation (#3) ────────────────────────────────────────────────────
  // The rows below are material-production only, so the "% Climate" column would
  // otherwise sum to ~90% with no explanation -- the remainder is inbound
  // transport plus the non-material lifecycle stages (processing, distribution,
  // use, end-of-life). Add an explicit "Other lifecycle stages" residual row and
  // a Total row on the final page so the column sums to 100% and the GWP column
  // reconciles to the product total, instead of presenting a partial share as if
  // it were complete.
  const reconcileTotal = parseFloat(data.ingredientBreakdown.totalClimateImpact) || 0;
  const materialsSubtotal = ingredients.reduce((s, ing) => s + (parseFloat(ing.climateImpact) || 0), 0);
  const otherStages = Math.max(reconcileTotal - materialsSubtotal, 0);
  const materialsPct = reconcileTotal > 0 ? (materialsSubtotal / reconcileTotal) * 100 : 0;
  const otherPct = Math.max(100 - materialsPct, 0);

  // Say the number, then name the hotspot: the top ingredient by climate impact.
  const topIngredient = [...ingredients]
    .sort((a, b) => (parseFloat(b.climateImpact) || 0) - (parseFloat(a.climateImpact) || 0))[0];
  const leadStatement = topIngredient
    ? `${escapeHtml(topIngredient.name)} carries the most.`
    : 'Where the impact sits.';

  for (let i = 0; i < ingredients.length; i += perPage) {
    const pageIngredients = ingredients.slice(i, i + perPage);
    const isFirstPage = i === 0;
    const isLastPage = i + perPage >= ingredients.length;
    const pageNum = 10 + Math.floor(i / perPage);

    // Residual + Total rows close the table out on the final page so the
    // "% Climate" column sums to 100% (see reconciliation note above). Both are
    // hairline rows in the studio table; the Total carries a heavier top rule.
    const summaryRows = isLastPage
      ? `${otherStages > 0.0005 ? `<tr>
            <td>Other lifecycle stages
              <div style="font-size: 8.5px; color: #6F6F68; margin-top: 2px;">Inbound transport, processing, distribution, use &amp; end-of-life</div>
            </td>
            <td></td><td></td>
            <td class="num">${otherStages.toFixed(4)}</td>
            <td class="num" style="color: ${A};">${otherPct.toFixed(1)}%</td>
            <td></td><td></td><td></td>
          </tr>` : ''}
          <tr style="border-top: 2px solid #D9D6CB;">
            <td class="card-title" style="font-size: 12px;">Total carbon footprint</td>
            <td></td><td></td>
            <td class="num" style="font-weight: 700; color: #1A1B1D;">${reconcileTotal.toFixed(3)}</td>
            <td class="num" style="font-weight: 700; color: ${A};">100%</td>
            <td></td><td></td><td></td>
          </tr>`
      : '';

    const rows = pageIngredients.map(ing => {
      // Ingredient cell: show real name, then proxy factor below if different
      const ingredientCell = ing.isProxy
        ? `<td style="min-width: 160px; max-width: 220px;">
            <div class="card-title" style="font-size: 11.5px; word-wrap: break-word;">${escapeHtml(ing.name)}</div>
            <div class="state state-attention" style="font-size: 8.5px; letter-spacing: 0.05em; margin-top: 3px; text-transform: none; word-wrap: break-word;">
              &#8627; Proxy: ${escapeHtml(ing.calculationFactor)}
            </div>
            <div style="font-size: 8.5px; color: #6F6F68; margin-top: 1px;">${escapeHtml(ing.factorDatabase)}</div>
           </td>`
        : `<td style="min-width: 160px; max-width: 220px; word-wrap: break-word;">
            <div class="card-title" style="font-size: 11.5px;">${escapeHtml(ing.name)}</div>
            <div style="font-size: 8.5px; color: #6F6F68; margin-top: 2px;">${escapeHtml(ing.factorDatabase)}</div>
           </td>`;

      // Data source -> typographic state chip (Primary/good, Secondary/attention, Proxy/stale).
      const sourceState = ing.isProxy
        ? `<span class="state state-stale">Proxy</span>`
        : ing.dataSource === 'Primary'
          ? `<span class="state state-good">Primary</span>`
          : `<span class="state state-attention">Secondary</span>`;

      // Quality grade -> state chip. High/good, Medium/attention, Low/stale.
      const grade = (ing.dataQualityGrade || '').toUpperCase();
      const gradeState = ['HIGH', 'MEDIUM', 'LOW'].includes(grade)
        ? `<span class="state ${grade === 'HIGH' ? 'state-good' : grade === 'MEDIUM' ? 'state-attention' : 'state-stale'}" style="margin-left: 8px;">${escapeHtml(grade.charAt(0) + grade.slice(1).toLowerCase())}</span>`
        : '';

      const containerNote = (ing as any).containerCO2
        ? `<div style="font-size: 8.5px; color: #6F6F68; margin-top: 2px;">incl. ${escapeHtml((ing as any).containerCO2)} kg CO₂e inbound container (${escapeHtml((ing as any).containerType || '')})</div>`
        : '';

      // Inbound freight transport sub-line -- makes embedded transport emissions
      // visible so the ingredient table reconciles against the lifecycle stage totals.
      const transportNote = (ing as any).transportCO2
        ? `<div style="font-size: 8.5px; color: #6F6F68; margin-top: 2px;">incl. ${escapeHtml((ing as any).transportCO2)} kg CO₂e inbound transport${(ing as any).transportMode ? ` · ${escapeHtml((ing as any).transportMode)}` : ''}${(ing as any).transportDistance ? ` · ${escapeHtml((ing as any).transportDistance)} km` : ''}</div>`
        : '';

      // Implausibility warning -- e.g. "Road freight from Lima, Peru at 10,113 km".
      // Shown in the Origin cell so the user connects the origin to the transport choice.
      const originWarning = (ing as any).transportWarning
        ? `<div class="state state-attention" style="font-size: 8.5px; letter-spacing: 0.05em; text-transform: none; margin-top: 2px; line-height: 1.3;">&#x26A0; ${escapeHtml((ing as any).transportWarning)}</div>`
        : '';

      return `<tr>
        ${ingredientCell}
        <td class="num">${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit)}</td>
        <td>${escapeHtml(ing.origin)}${originWarning}</td>
        <td class="num">${escapeHtml(ing.climateImpact)}${containerNote}${transportNote}</td>
        <td class="num" style="color: ${A};">${escapeHtml(ing.climatePercentage)}</td>
        <td class="num">${escapeHtml(ing.acidification)}</td>
        <td class="num">${escapeHtml(ing.eutrophication)}</td>
        <td>${sourceState}${gradeState}${ing.confidenceScore > 0 ? `<div style="font-size: 8.5px; color: #6F6F68; margin-top: 3px;">${ing.confidenceScore}% confidence</div>` : ''}</td>
      </tr>`;
    }).join('');

    pages.push(`
      <div class="page light-page" style="position: relative;">
        ${mark(CHAPTERS.sources.mark, 'br', A)}
        <div style="position: relative; z-index: 1;">
        ${isFirstPage
          ? renderSectionLead({
              number: '08',
              section: 'Ingredient breakdown',
              value: data.ingredientBreakdown.totalClimateImpact,
              unit: 'kg CO₂e',
              label: `Per-ingredient contribution · per ${data.functionalUnit.value}`,
              statement: leadStatement,
              accent: A,
            })
          : renderSectionHeader('08', 'Ingredient Impact Breakdown', false, true, A)
        }

        ${isFirstPage ? `
          <div class="body" style="font-size: 11.5px; margin-bottom: 18px; max-width: 640px;">
            The <strong style="color: #1A1B1D;">GWP (kg CO&#8322;e)</strong> column shows each ingredient's material production impact. Inbound transport is itemised separately on a sub-line beneath the ingredient where present, and is included in the product total. The most significant ingredients shown here are restated in the Interpretation hotspots (Section 13) using these same production figures.
          </div>
        ` : ''}

        ${isFirstPage && hasProxies ? `
          <div class="panel" style="margin-bottom: 18px; border-left: 2px solid ${A}; padding: 14px 16px;">
            <div class="body" style="font-size: 11px;">
              <span class="state state-attention">Proxy factors in use</span>&nbsp; One or more ingredients are calculated using the closest matching dataset from ecoinvent, AGRIBALYSE, or DEFRA. The user's actual ingredient name is shown first; the proxy factor and database are shown beneath it. All proxy selections are documented per ISO 14044 §4.2.3.6.3.
            </div>
          </div>
        ` : ''}

        <table class="studio-table">
          <thead><tr>
            <th>Ingredient / Calc. Factor</th>
            <th>Qty</th>
            <th>Origin</th>
            <th>GWP (kg CO&#8322;e)</th>
            <th>% Climate</th>
            <th>Acid. (SO&#8322;-eq)</th>
            <th>Eutroph. (P-eq)</th>
            <th>Source / Quality</th>
          </tr></thead>
          <tbody>${rows}${summaryRows}</tbody>
        </table>

        ${isLastPage ? `
          <div class="panel" style="margin-top: 22px;">
            <div class="body" style="font-size: 11px;">
              <span class="eyebrow" style="color: ${A};">Coverage</span>&nbsp; The ingredients and packaging listed above are material-production impacts and account for ${materialsPct.toFixed(1)}% of the ${escapeHtml(data.ingredientBreakdown.totalClimateImpact)} kg CO&#8322;e total per functional unit. The remaining ${otherPct.toFixed(1)}% comes from inbound transport and the non-material lifecycle stages (processing, distribution, use and end-of-life), shown in the "Other lifecycle stages" row and detailed in Sections 05 to 07. Acidification values in kg SO&#8322;-eq (terrestrial); eutrophication in kg P-eq (freshwater); values below detection shown as 0.000e+0.
              ${hasProxies ? ' &#x26A0; Proxy factors are used where a direct dataset match was not available (see the Data Quality section).' : ''}
            </div>
          </div>
        ` : ''}
        </div>

        ${renderPageFooter(pageNum, false)}
      </div>`);
  }

  return pages.join('\n');
}

function renderWaterPage(data: LCAReportData): string {
  const A = CHAPTERS.footprint.accent;

  // Risk level reads as a typographic state chip, not a coloured pill.
  const riskState = (risk: string): string => {
    const r = risk.toLowerCase();
    if (r === 'high') return 'state-stale';
    if (r === 'medium') return 'state-attention';
    if (r === 'low') return 'state-good';
    return 'state-quiet';
  };

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1; display: flex; flex-direction: column; height: 100%;">
        ${renderSectionLead({
          number: '09',
          section: 'Water footprint',
          value: data.waterFootprint.totalConsumption,
          unit: 'litres',
          label: 'Total consumption · per functional unit',
          statement: 'The water behind the product, and where it is scarce.',
          accent: A,
        })}

        <div class="rule" style="padding-top: 22px; margin-bottom: 28px; display: flex; gap: 56px;">
          <div>
            <div class="lead-number" style="font-size: 40px; color: ${A};">${escapeHtml(data.waterFootprint.totalConsumption)}</div>
            <div class="lead-label" style="margin-top: 8px;">Consumption · litres</div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 40px; color: #1A1B1D;">${escapeHtml(data.waterFootprint.scarcityWeighted)}</div>
            <div class="lead-label" style="margin-top: 8px;">Scarcity-weighted · litres eq.</div>
          </div>
        </div>

        ${data.waterFootprint.sources.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 14px;">Water sources</div>
          <table class="studio-table">
            <thead><tr><th>Source</th><th>Location</th><th>Volume</th><th>Risk level</th></tr></thead>
            <tbody>
              ${data.waterFootprint.sources.map(s => `
                <tr>
                  <td>${escapeHtml(s.source)}</td>
                  <td>${escapeHtml(s.location)}</td>
                  <td class="num">${escapeHtml(s.volume)}</td>
                  <td>${s.risk ? `<span class="state ${riskState(s.risk)}">${escapeHtml(s.risk)}</span>` : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>

      ${renderPageFooter(11)}
    </div>`;
}

function renderCircularityPage(data: LCAReportData): string {
  const hasEolBreakdown = data.circularity.eolBreakdown && data.circularity.eolBreakdown.length > 0;
  const eolRecyclingRate = data.circularity.eolRecyclingRate || 0;
  const recycledContentRate = data.circularity.recycledContentRate || 0;

  // EoL gross/avoided split
  const totalGross = hasEolBreakdown
    ? data.circularity.eolBreakdown.reduce((s, m) => s + m.grossEmissions, 0) : 0;
  const totalAvoided = hasEolBreakdown
    ? data.circularity.eolBreakdown.reduce((s, m) => s + m.avoidedEmissions, 0) : 0;
  const totalNet = hasEolBreakdown
    ? data.circularity.eolBreakdown.reduce((s, m) => s + m.netEmissions, 0) : 0;

  const A = CHAPTERS.footprint.accent;

  // Lead with the circularity score; where absent, the recycled-content rate is
  // the closest single figure to headline.
  const leadValue = data.circularity.circularityScore || `${recycledContentRate}`;

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '10',
          section: 'Circularity & waste',
          value: escapeHtml(leadValue),
          label: 'Circularity score · input reuse and end-of-life recovery',
          statement: `${eolRecyclingRate}% of packaging is recovered at disposal.`,
          accent: A,
        })}

        <div style="display: flex; gap: 32px; align-items: center; margin-bottom: 26px;">
          <div style="display: flex; gap: 28px; flex-shrink: 0;">
            <div style="text-align: center;">
              <div style="width: 116px; height: 116px; border-radius: 50%; ${donutGradient([{ value: recycledContentRate, color: '#047857' }, { value: Math.max(100 - recycledContentRate, 0), color: '#D9D6CB' }])} position: relative;">
                <div style="position: absolute; inset: 13px; background: #F2F1EA; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span class="lead-number" style="font-size: 26px; color: #047857;">${recycledContentRate}<span style="font-size: 12px;">%</span></span>
                </div>
              </div>
              <div class="lead-label" style="margin-top: 12px;">Recycled content</div>
            </div>
            <div style="text-align: center;">
              <div style="width: 116px; height: 116px; border-radius: 50%; ${donutGradient([{ value: eolRecyclingRate, color: '#2B46C0' }, { value: Math.max(100 - eolRecyclingRate, 0), color: '#D9D6CB' }])} position: relative;">
                <div style="position: absolute; inset: 13px; background: #F2F1EA; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                  <span class="lead-number" style="font-size: 26px; color: #2B46C0;">${eolRecyclingRate}<span style="font-size: 12px;">%</span></span>
                </div>
              </div>
              <div class="lead-label" style="margin-top: 12px;">EoL recycling rate</div>
            </div>
          </div>
          <div style="flex: 1;">
            <div class="body" style="font-size: 12px; margin-bottom: 14px;">Recycled content is the circular input, the recycled material used in production. The recycling rate is the circular output, the packaging recovered at end of life.</div>
            <div class="rule" style="padding-top: 14px;">
              <div class="lead-number" style="font-size: 34px; color: ${A};">${escapeHtml(data.circularity.totalWaste)}</div>
              <div class="lead-label" style="margin-top: 6px;">Total packaging waste</div>
            </div>
          </div>
        </div>

      ${hasEolBreakdown ? `
        <div class="rule" style="padding-top: 20px; margin-bottom: 22px; display: flex; gap: 44px;">
          <div>
            <div class="lead-number" style="font-size: 30px; color: #BE123C;">${totalGross.toFixed(4)}</div>
            <div class="lead-label" style="margin-top: 6px;">Gross EoL emissions <span class="state state-quiet">kg CO&#8322;e</span></div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 30px; color: #047857;">${totalAvoided.toFixed(4)}</div>
            <div class="lead-label" style="margin-top: 6px;">Recycling credits <span class="state state-good">avoided</span></div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 30px; color: ${totalNet < 0 ? '#047857' : '#B45309'};">${totalNet.toFixed(4)}</div>
            <div class="lead-label" style="margin-top: 6px;">Net EoL impact <span class="state ${totalNet < 0 ? 'state-good' : 'state-attention'}">kg CO&#8322;e</span></div>
          </div>
        </div>

        <div class="eyebrow" style="color: ${A}; margin-bottom: 12px;">Per-material disposal pathways</div>
        <table class="studio-table" style="margin-bottom: 4px;">
          <thead><tr>
            <th>Material</th>
            <th>Mass</th>
            <th style="text-align: center;">Recycle</th>
            <th style="text-align: center;">Landfill</th>
            <th style="text-align: center;">Incin.</th>
            <th style="text-align: center;">Compost</th>
            <th style="text-align: center;">AD</th>
            <th style="text-align: right;">Net (kg CO&#8322;e)</th>
          </tr></thead>
          <tbody>
            ${data.circularity.eolBreakdown.map(m => `
              <tr>
                <td style="font-weight: 500;">${escapeHtml(m.material)}</td>
                <td><span class="num">${m.massKg.toFixed(3)}</span> kg</td>
                <td style="text-align: center;"><span class="num">${m.recyclingPct}</span>%</td>
                <td style="text-align: center;"><span class="num">${m.landfillPct}</span>%</td>
                <td style="text-align: center;"><span class="num">${m.incinerationPct}</span>%</td>
                <td style="text-align: center;"><span class="num">${m.compostingPct}</span>%</td>
                <td style="text-align: center;"><span class="num">${m.adPct}</span>%</td>
                <td style="text-align: right; color: ${m.netEmissions < 0 ? '#047857' : '#6F6F68'};"><span class="num">${m.netEmissions.toFixed(4)}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : `
        ${data.circularity.wasteStream.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 12px;">Waste streams</div>
          <table class="studio-table">
            <thead><tr><th>Stream</th><th>Volume</th><th style="text-align: right;">Status</th></tr></thead>
            <tbody>
              ${data.circularity.wasteStream.map(ws => `
                <tr>
                  <td>${escapeHtml(ws.label)}</td>
                  <td><span class="num">${escapeHtml(ws.value)}</span></td>
                  <td style="text-align: right;">${ws.recycled
                    ? '<span class="state state-good">Recycled</span>'
                    : '<span class="state state-attention">Waste</span>'
                  }</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      `}

      ${data.circularityMethodology ? `
        <div class="panel" style="margin-top: 20px; border-left: 2px solid ${A};">
          <div class="eyebrow" style="color: ${A}; margin-bottom: 8px;">Method</div>
          <div class="body" style="font-size: 11.5px;">Recycled content measures circular input (recycled material used in production). EoL recycling rate measures circular output (packaging recycled at end of life, based on regional defaults). These are independent metrics per ISO 14044 &sect;4.4.5.${data.circularityMethodology.reference ? ` ${escapeHtml(data.circularityMethodology.reference)}` : ''}</div>
        </div>
      ` : ''}
      </div>

      ${renderPageFooter(12)}
    </div>`;
}

function renderLandUsePage(data: LCAReportData): string {
  const A = CHAPTERS.footprint.accent;

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.footprint.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '11',
          section: 'Land use',
          value: escapeHtml(data.landUse.totalLandUse),
          unit: 'm² per year',
          label: 'Total land occupation across the product',
          statement: 'The land the product asks of the earth.',
          accent: A,
        })}

        ${data.landUse.breakdown.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 12px;">Material breakdown</div>
          <table class="studio-table">
            <thead><tr>
              <th>Material</th>
              <th>Origin</th>
              <th style="text-align: right;">Mass</th>
              <th style="text-align: right;">Intensity</th>
              <th style="text-align: right;">Footprint</th>
            </tr></thead>
            <tbody>
              ${data.landUse.breakdown.map(item => `
                <tr>
                  <td style="font-weight: 500;">${escapeHtml(item.material)}</td>
                  <td>${escapeHtml(item.origin)}</td>
                  <td style="text-align: right;"><span class="num">${escapeHtml(item.mass)}</span></td>
                  <td style="text-align: right;"><span class="num">${item.intensity.toFixed(2)}</span></td>
                  <td style="text-align: right;"><span class="num">${escapeHtml(item.footprint)}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}
      </div>

      ${renderPageFooter(13)}
    </div>`;
}

function renderSupplyChainPage(data: LCAReportData): string {
  const A = CHAPTERS.sources.accent; // #A97C14 -- ochre's ink form, legible on paper

  const networkHtml = data.supplyChain.network.map(category => `
    <div style="margin-bottom: 26px;">
      <div class="eyebrow" style="color: ${A}; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #D9D6CB;">${escapeHtml(category.category)}</div>
      ${category.items.map(item => {
        const modeLabel = item.mode ? escapeHtml(item.mode) : 'Mode not specified';
        const warningHtml = item.warning ? `
          <div class="state state-attention" style="margin-top: 6px; font-size: 10px; letter-spacing: 0.05em; text-transform: none; line-height: 1.4;">
            &#9888; ${escapeHtml(item.warning)}
          </div>
        ` : '';
        return `
        <div style="padding: 12px 0; border-top: 1px solid #D9D6CB;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;">
            <div>
              <div class="card-title" style="font-size: 13px;">${escapeHtml(item.name)}</div>
              <div class="body" style="font-size: 11.5px; margin-top: 2px;">${escapeHtml(item.location)}</div>
              <div class="lead-label" style="margin-top: 5px;">Transport &middot; ${modeLabel}</div>
            </div>
            <div style="text-align: right; flex-shrink: 0;">
              <div class="lead-number" style="font-size: 16px; color: #1A1B1D;">${escapeHtml(item.distance)}</div>
              <div class="body" style="font-size: 11px; margin-top: 3px; font-variant-numeric: tabular-nums;">${escapeHtml(item.co2)}</div>
            </div>
          </div>
          ${warningHtml}
        </div>
      `;}).join('')}
    </div>
  `).join('');

  const suppliers = (data.supplyChain.verifiedSuppliers || '').trim();
  // renderSectionLead escapeHtml's the label, so pass the raw value here.
  const suppliersLabel = `Total transport distance · ${suppliers} verified supplier${suppliers === '1' ? '' : 's'}`;

  return `
    <div class="page light-page" style="position: relative;">
      ${mark(CHAPTERS.sources.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '12',
          section: 'Supply chain',
          value: data.supplyChain.totalDistance,
          label: suppliersLabel,
          statement: 'Where it comes from.',
          accent: A,
        })}

        ${networkHtml}
      </div>

      ${renderPageFooter(14)}
    </div>`;
}

function renderCommitmentPage(data: LCAReportData): string {
  return `
    <div class="page dark-page" style="justify-content: center; text-align: center; position: relative;">
      ${mark('ring', 'br')}
      <div style="position: relative; z-index: 1; max-width: 520px; margin: 0 auto;">
        <div style="margin: 0 auto 36px;">
          ${alkateraLogo(52, false)}
        </div>
        <div class="eyebrow" style="margin-bottom: 16px;">The commitment</div>
        <h2 class="statement" style="font-size: 40px; margin-bottom: 24px;">Our commitment.</h2>
        <p class="body" style="font-size: 15px; line-height: 1.75;">${escapeHtml(data.commitment.text)}</p>

        <div class="rule" style="margin-top: 60px; padding-top: 32px;">
          <p class="lead-label" style="line-height: 1.8;">
            Report generated by ${alkateraName()}<br />
            ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <a href="https://alkatera.com" style="display: inline-block; margin-top: 18px; background: #1A1B1D; color: #F2F1EA; font-size: 11px; font-family: 'JetBrains Mono', monospace; font-weight: 700; text-decoration: none; letter-spacing: 0.15em; padding: 10px 22px; border-radius: 999px;">
            ALKATERA.COM
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

  const A = CHAPTERS.evidence.accent;

  const hotspotsHtml = interp.significant_issues.hotspots.length > 0
    ? `<table class="studio-table">
        <thead><tr><th>Material</th><th style="text-align: right;">GWP (kg CO&#8322;e)</th><th style="text-align: right;">Contribution</th></tr></thead>
        <tbody>
          ${interp.significant_issues.hotspots.map(h => `
            <tr>
              <td style="font-weight: 500;">${escapeHtml(h.name)}</td>
              <td class="num" style="text-align: right;">${h.impact_kg_co2e.toFixed(4)}</td>
              <td class="num" style="text-align: right;">${h.contribution_pct.toFixed(1)}%</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p class="body" style="font-size: 10px; margin-top: 8px;">
        Hotspots restate the most significant ingredients from Section 08 using the same material-production GWP and contribution share, so the two sections reconcile. Inbound transport is itemised separately in Section 08 and is included in the product total.
      </p>`
    : '<p class="body">No individual material exceeds the 5% significance threshold.</p>';

  // FIX #5: Always explain EoL recycling credits in interpretation, not just when >100%.
  // Users need to understand avoided burden credits regardless of hotspot sum.
  const hotspotSum = interp.significant_issues.hotspots.reduce((s, h) => s + h.contribution_pct, 0);
  const hasEolCredits = data.eolMethodology && data.eolMethodology.totalAvoidedEmissions < 0;
  const eolCreditNote = hasEolCredits
    ? `<div class="panel" style="margin-top: 14px; padding: 14px 16px; border-left: 2px solid ${A};">
        <span class="eyebrow" style="color: ${A};">Recycling credits &middot; avoided burden</span>
        <p class="body" style="font-size: 11px; margin-top: 8px;">
          End-of-life recycling generates
          ${Math.abs(data.eolMethodology!.totalAvoidedEmissions).toFixed(4)} kg CO&#8322;e in avoided emissions
          by displacing virgin material production. Gross disposal emissions are
          ${data.eolMethodology!.totalGrossEmissions.toFixed(4)} kg CO&#8322;e, giving a net EoL impact of
          ${data.eolMethodology!.totalNetEmissions.toFixed(4)} kg CO&#8322;e.
          ${hotspotSum > 100 ? ` Hotspot contributions sum to ${hotspotSum.toFixed(1)}% because these credits reduce the denominator.` : ''}
        </p>
      </div>`
    : (hotspotSum > 100
      ? `<p class="body" style="font-size: 10px; font-style: italic; margin-top: 8px;">
          Contributions sum to ${hotspotSum.toFixed(1)}% because end-of-life avoided-burden credits
          reduce the net total carbon footprint, against which individual percentages are calculated.
        </p>`
      : '');
  const exceedsNote = eolCreditNote;

  // Split across two pages when there are many bullet points to avoid footer overflow.
  // Page 1: Significant issues, hotspots table, dominant stats, key findings
  // Page 2: Limitations and recommendations
  const totalBullets = interp.conclusions.key_findings.length +
    interp.conclusions.limitations.length +
    interp.conclusions.recommendations.length;
  const needsSplit = totalBullets > 8 || interp.significant_issues.hotspots.length > 3;

  // Clean bullet list on paper, no boxes.
  const bulletList = (items: string[]) =>
    `<ul class="body" style="font-size: 12px; padding-left: 18px; margin-bottom: 14px;">
      ${items.map(i => `<li style="margin-bottom: 5px;">${escapeHtml(i)}</li>`).join('')}
    </ul>`;

  // Say the number, then name the hotspot: the dominant lifecycle stage.
  const dominantStage = interp.significant_issues.dominant_lifecycle_stage;
  const statement = dominantStage
    ? `${dominantStage} carries the study.`
    : 'Where the significance sits.';

  const page1 = `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '13',
          section: 'Interpretation · ISO 14044 §4.5',
          value: `${interp.significant_issues.dominant_stage_pct}`,
          unit: '%',
          label: `Dominant lifecycle stage · ${dominantStage}`,
          statement,
          accent: A,
        })}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Significant issues</div>
        <p class="body" style="margin-bottom: 14px;">${escapeHtml(interp.significant_issues.summary)}</p>
        ${hotspotsHtml}
        ${exceedsNote}

        <div class="rule" style="margin-top: 22px; padding-top: 20px; display: flex; gap: 48px;">
          <div>
            <div class="lead-number" style="font-size: 30px; color: ${A};">${interp.significant_issues.dominant_stage_pct}<span style="font-size: 13px;">%</span></div>
            <div class="lead-label" style="margin-top: 6px;">Dominant stage · ${escapeHtml(interp.significant_issues.dominant_lifecycle_stage)}</div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 30px; color: ${A};">${interp.significant_issues.dominant_scope_pct}<span style="font-size: 13px;">%</span></div>
            <div class="lead-label" style="margin-top: 6px;">Dominant scope · ${escapeHtml(interp.significant_issues.dominant_scope)}</div>
          </div>
        </div>

        <div class="eyebrow" style="color: ${A}; margin: 24px 0 10px;">Key findings</div>
        ${bulletList(interp.conclusions.key_findings)}

        ${!needsSplit ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Limitations</div>
          ${bulletList(interp.conclusions.limitations)}

          <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Recommendations</div>
          ${bulletList(interp.conclusions.recommendations)}
        ` : ''}
      </div>

      ${renderPageFooter(15)}
    </div>`;

  if (!needsSplit) return page1;

  const page2 = `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('13', 'Interpretation (ISO 14044 §4.5)', false, true, A)}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Limitations</div>
        ${bulletList(interp.conclusions.limitations)}

        <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Recommendations</div>
        ${bulletList(interp.conclusions.recommendations)}
      </div>

      ${renderPageFooter(16)}
    </div>`;

  return page1 + page2;
}

function renderUncertaintySensitivityPage(data: LCAReportData): string {
  const us = data.uncertaintySensitivity;
  if (!us) return '';

  const A = CHAPTERS.evidence.accent;

  const paramsHtml = us.sensitivityAnalysis.parameters.length > 0
    ? `<table class="studio-table">
        <thead><tr><th>Material</th><th style="text-align: right;">Contribution</th><th style="text-align: right;">±20% range</th><th style="text-align: right;">Sensitivity</th></tr></thead>
        <tbody>
          ${us.sensitivityAnalysis.parameters.map(p => `
            <tr>
              <td style="font-weight: 500;">${escapeHtml(p.materialName)}</td>
              <td class="num" style="text-align: right;">${p.baselineContributionPct.toFixed(1)}%</td>
              <td class="num" style="text-align: right;">${p.resultRange.lower} to ${p.resultRange.upper} kg CO&#8322;e</td>
              <td class="num" style="text-align: right;">${p.sensitivityRatio.toFixed(3)}${p.isHighlySensitive ? ' <span class="state state-stale">High</span>' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`
    : '';

  return `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionLead({
          number: '14',
          section: 'Uncertainty & sensitivity · ISO 14044 §4.5.3',
          value: `±${us.propagatedUncertaintyPct}`,
          unit: '%',
          label: 'Propagated uncertainty · 95% confidence interval',
          statement: 'How firm the number is.',
          accent: A,
        })}

        <div class="rule" style="padding-top: 20px; display: flex; gap: 48px;">
          <div>
            <div class="lead-number" style="font-size: 30px; color: ${A};">±${us.propagatedUncertaintyPct}<span style="font-size: 13px;">%</span></div>
            <div class="lead-label" style="margin-top: 6px;">Propagated uncertainty · 95% CI</div>
          </div>
          <div>
            <div class="lead-number" style="font-size: 30px; color: ${A};">${us.confidenceInterval95.lower}<span style="font-size: 13px;"> to </span>${us.confidenceInterval95.upper}</div>
            <div class="lead-label" style="margin-top: 6px;">Result range · kg CO&#8322;e per functional unit</div>
          </div>
        </div>

        <div class="eyebrow" style="color: ${A}; margin: 24px 0 10px;">Sensitivity analysis</div>
        <p class="body" style="margin-bottom: 16px;">${escapeHtml(us.sensitivityAnalysis.method)}</p>
        ${paramsHtml}

        <div class="panel" style="margin-top: 22px;">
          <span class="eyebrow" style="color: ${A};">Conclusion</span>
          <p class="body" style="margin-top: 8px;">${escapeHtml(us.sensitivityAnalysis.conclusion)}</p>
        </div>

        <div class="panel" style="margin-top: 16px;">
          <span class="eyebrow" style="color: ${A};">Methodology</span>
          <p class="body" style="font-size: 11.5px; margin-top: 8px;">
            Uncertainty propagation follows the root-sum-of-squares approach
            for geometric standard deviation per Frischknecht et al. (2007), using the Pedigree Matrix
            (Weidema &amp; Wesnæs, 1996) for data quality scoring. Sensitivity analysis applies ±20%
            variation to emission factors of the top three contributors.
          </p>
        </div>
      </div>

      ${renderPageFooter(16)}
    </div>`;
}

function renderCriticalReviewDisclosure(data: LCAReportData): string {
  const cr = data.criticalReview;
  if (!cr) return '';

  const A = CHAPTERS.evidence.accent;

  // Additional notes from other compliance fields
  const notes: string[] = [];
  if (data.lulucNote) notes.push(data.lulucNote);
  if (data.transportNote) notes.push(data.transportNote.method);
  if (data.scopeMethodology) notes.push(data.scopeMethodology.note);

  const zeroCategories = data.zeroImpactCategories || [];

  // The verdict chip: pass -> good, qualified -> attention, remediation -> stale.
  const statusRaw = cr.status.toLowerCase();
  const statusClass = statusRaw.includes('remediat') || statusRaw.includes('fail')
    ? 'state-stale'
    : (statusRaw.includes('qualif') || statusRaw.includes('pending') || statusRaw.includes('planned'))
      ? 'state-attention'
      : 'state-good';
  const statusLabel = cr.status.replace(/_/g, ' ');

  // Methodological notes as a cream panel.
  const notesPanel = (n: string) => `
    <div class="panel" style="margin-bottom: 10px; padding: 12px 16px;">
      <p class="body" style="font-size: 12px;">${escapeHtml(n)}</p>
    </div>`;

  // Determine if we need a second page for methodological notes.
  // Zero-impact categories table + critical review panel take most of page 1;
  // methodological notes and circularity disclaimer go on page 2 if present.
  const hasOverflowContent = (notes.length > 0 || data.circularityMethodology) && zeroCategories.length > 3;

  const page1 = `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('15', 'Critical Review & Compliance Notes', false, false, A)}

        <div class="panel" style="margin-bottom: 24px; border-left: 2px solid ${A};">
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
            <span class="eyebrow" style="color: ${A};">Critical review status</span>
            <span class="state ${statusClass}">${escapeHtml(statusLabel)}</span>
          </div>
          <p class="body">${escapeHtml(cr.disclosure)}</p>
          <p class="body" style="font-size: 12px; margin-top: 12px;">
            <span class="lead-label" style="color: ${A};">Recommendation</span><br />${escapeHtml(cr.recommendation)}
          </p>
        </div>

        ${zeroCategories.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 10px;">Zero-impact categories</div>
          <p class="body" style="font-size: 12px; margin-bottom: 12px;">
            The following environmental impact categories were assessed but report zero values. Justification per ISO 14044 §4.4.2.2:
          </p>
          <table class="studio-table">
            <thead><tr><th>Category</th><th>Reason</th></tr></thead>
            <tbody>
              ${zeroCategories.map(c => `
                <tr>
                  <td style="font-weight: 500; white-space: nowrap;">${escapeHtml(c.category)}</td>
                  <td>${escapeHtml(c.reason)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : ''}

        ${!hasOverflowContent && notes.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin: 20px 0 12px;">Methodological notes</div>
          ${notes.map(notesPanel).join('')}
        ` : ''}

        ${!hasOverflowContent && data.circularityMethodology ? `
          <div class="panel" style="margin-top: 16px; padding: 12px 16px; border-left: 2px solid ${A};">
            <span class="lead-label" style="color: ${A};">Circularity score disclaimer</span>
            <p class="body" style="font-size: 12px; margin-top: 6px;">${escapeHtml(data.circularityMethodology.description)}</p>
          </div>
        ` : ''}
      </div>

      ${renderPageFooter(17)}
    </div>`;

  // If content overflows, put methodological notes on a continuation page
  if (!hasOverflowContent) return page1;

  const page2 = `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('15', 'Critical Review & Compliance Notes', false, true, A)}

        ${notes.length > 0 ? `
          <div class="eyebrow" style="color: ${A}; margin-bottom: 12px;">Methodological notes</div>
          ${notes.map(notesPanel).join('')}
        ` : ''}

        ${data.circularityMethodology ? `
          <div class="panel" style="margin-top: 16px; padding: 12px 16px; border-left: 2px solid ${A};">
            <span class="lead-label" style="color: ${A};">Circularity score disclaimer</span>
            <p class="body" style="font-size: 12px; margin-top: 6px;">${escapeHtml(data.circularityMethodology.description)}</p>
          </div>
        ` : ''}
      </div>

      ${renderPageFooter(18)}
    </div>`;

  return page1 + page2;
}

function renderAiCriticalReviewPage(data: LCAReportData): string {
  const ai = data.criticalReview?.aiReview;
  if (!ai) return '';

  const A = CHAPTERS.evidence.accent;

  // Overall rating -> a typographic .state chip.
  const ratingStyles: Record<string, { cls: string; label: string }> = {
    pass: { cls: 'state-good', label: 'Pass' },
    qualified_pass: { cls: 'state-attention', label: 'Pass with qualifications' },
    needs_remediation: { cls: 'state-stale', label: 'Needs remediation' },
  };
  const rs = ratingStyles[ai.rating] || ratingStyles.qualified_pass;

  // Per-finding conformance -> a .state chip.
  const statusStyles: Record<string, { cls: string; label: string }> = {
    conforms: { cls: 'state-good', label: 'Conforms' },
    minor_gap: { cls: 'state-attention', label: 'Minor gap' },
    major_gap: { cls: 'state-stale', label: 'Major gap' },
  };

  // The ISO clause labels carry an em dash separator; replace it with a middot.
  const cleanClause = (clause: string) => clause.replace(/\s*[—–]\s*/g, ' · ');

  const findingsHtml = ai.findings.map(f => {
    const ss = statusStyles[f.status] || statusStyles.minor_gap;
    return `
      <div class="rule" style="padding: 12px 0;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 6px;">
          <div style="font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 11px; color: #1A1B1D;">${escapeHtml(cleanClause(f.clause))}</div>
          <span class="state ${ss.cls}" style="white-space: nowrap;">${ss.label}</span>
        </div>
        <div class="body" style="font-size: 12px;">${escapeHtml(f.summary)}</div>
        ${f.detail ? `<div class="body" style="font-size: 11px; margin-top: 6px;">${escapeHtml(f.detail)}</div>` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="page light-page" style="position: relative; overflow: hidden;">
      ${mark(CHAPTERS.evidence.mark, 'br', A)}
      <div style="position: relative; z-index: 1;">
        ${renderSectionHeader('15b', 'AI-Assisted Internal Review', false, false, A)}

        <div class="panel" style="margin-bottom: 22px; border-left: 2px solid ${A};">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <span class="eyebrow" style="color: ${A};">Overall rating</span>
            <span class="state ${rs.cls}">${rs.label}</span>
          </div>
          <p class="body">${escapeHtml(ai.verdict)}</p>
        </div>

        <div class="eyebrow" style="color: ${A}; margin-bottom: 6px;">Findings by ISO 14044 / 14067 clause</div>
        ${findingsHtml}

        <div class="panel" style="margin-top: 20px; padding: 14px 16px;">
          <span class="lead-label" style="color: ${A};">Reviewer attribution</span>
          <p class="body" style="font-size: 11px; margin-top: 6px;">${escapeHtml(ai.reviewerNote)}</p>
          <p class="lead-label" style="margin-top: 8px;">Review date · ${escapeHtml(ai.reviewDate)}</p>
        </div>
      </div>

      ${renderPageFooter(18)}
    </div>`;
}

// ============================================================================
// SHARED ELEMENTS
// ============================================================================

/**
 * A section header in the studio voice: a mono eyebrow ("05 · CLIMATE
 * IMPACT") over a Space Grotesk statement title. Hairline beneath.
 */
function renderSectionHeader(number: string, title: string, dark = false, continuation = false, accent = '#205E40'): string {
  const borderColor = dark ? 'rgba(26,27,29,0.12)' : '#D9D6CB';
  return `
    <div style="margin-bottom: ${continuation ? '24px' : '28px'}; border-bottom: 1px solid ${borderColor}; padding-bottom: 14px;">
      <div class="eyebrow" style="color: ${accent};">${escapeHtml(number)} &middot; ${escapeHtml(title.toUpperCase())}${continuation ? ' &middot; CONT.' : ''}</div>
      <div class="statement" style="font-size: ${continuation ? '26px' : '32px'}; margin-top: 8px;">${escapeHtml(title)}.</div>
    </div>`;
}

/**
 * A maker's stamp: one geometric mark per surface, cropped by a corner,
 * behind the content at 6%. The page needs overflow:hidden (it has it)
 * and the content should sit in a position:relative,z-index:1 wrapper.
 */
type MarkShape = 'circle' | 'triangle' | 'diamond' | 'arch' | 'ring' | 'quarter' | 'square';
function mark(
  shape: MarkShape,
  corner: 'br' | 'bl' | 'tr' | 'tl' = 'br',
  colour = '#205E40',
  opacity = 0.06,
  size = 230,
): string {
  const pos = {
    br: `bottom:-${size / 4}px;right:-${size / 4}px`,
    bl: `bottom:-${size / 4}px;left:-${size / 4}px`,
    tr: `top:-${size / 4}px;right:-${size / 4}px`,
    tl: `top:-${size / 4}px;left:-${size / 4}px`,
  }[corner];
  const shapes: Record<MarkShape, string> = {
    circle: '<circle cx="50" cy="50" r="50"/>',
    triangle: '<polygon points="50,2 98,98 2,98"/>',
    diamond: '<polygon points="50,2 98,50 50,98 2,50"/>',
    arch: '<path d="M 10 100 L 10 50 A 40 40 0 0 1 90 50 L 90 100 Z"/>',
    quarter: '<path d="M 0 100 A 100 100 0 0 1 100 0 L 100 100 Z"/>',
    square: '<rect x="16" y="16" width="68" height="68" transform="rotate(14 50 50)"/>',
    ring: `<circle cx="50" cy="50" r="36" fill="none" stroke="${colour}" stroke-width="22"/>`,
  };
  return `<svg viewBox="0 0 100 100" fill="${colour}" style="position:absolute;${pos};width:${size}px;height:${size}px;opacity:${opacity};z-index:0;pointer-events:none;">${shapes[shape]}</svg>`;
}

/**
 * The report walks through the app's rooms. Each chapter carries a
 * room's colour, as a poster divider and as the accent threaded through
 * its sections. accent is the on-paper form (ochre darkens to its ink
 * form); block is the saturated poster fill.
 */
interface Chapter {
  numeral: string;
  room: string; // "THE CELLAR"
  title: string; // "The footprint."
  blurb: string;
  sections: string[];
  block: string; // poster fill
  blockRgb: string; // "R G B" for the mark var on the divider
  on: 'cream' | 'ink'; // text on the poster
  accent: string; // on-paper accent (eyebrows, numbers)
  mark: MarkShape;
}

const CHAPTERS: Record<'measures' | 'footprint' | 'sources' | 'evidence', Chapter> = {
  measures: {
    numeral: 'I', room: 'The measures', title: 'The measures.',
    blurb: 'How the footprint was measured: the goal of the study, the method behind it, and the quality of the data underneath.',
    sections: ['Goal & scope', 'Methodology', 'Data quality'],
    block: '#2B46C0', blockRgb: '43 70 192', on: 'cream', accent: '#2B46C0', mark: 'triangle',
  },
  footprint: {
    numeral: 'II', room: 'The cellar', title: 'The footprint.',
    blurb: 'What the product costs the planet: the greenhouse gases behind the number, and the water, land and circularity alongside it.',
    sections: ['Climate impact', 'Detailed GHG reporting', 'Impact categories', 'Water footprint', 'Circularity & waste', 'Land use'],
    block: '#6D3A5D', blockRgb: '109 58 93', on: 'cream', accent: '#6D3A5D', mark: 'diamond',
  },
  sources: {
    numeral: 'III', room: 'The network', title: 'The sources.',
    blurb: 'Where it comes from: every ingredient and its factor, and the supply chain that carries them.',
    sections: ['Ingredient breakdown', 'Supply chain'],
    block: '#DFA32B', blockRgb: '223 163 43', on: 'ink', accent: '#A97C14', mark: 'square',
  },
  evidence: {
    numeral: 'IV', room: 'The evidence', title: 'The evidence.',
    blurb: 'How we know it is sound: the interpretation, the uncertainty, and the critical review of the study.',
    sections: ['Interpretation', 'Uncertainty & sensitivity', 'Critical review', 'Assisted review'],
    block: '#BF4B2A', blockRgb: '191 75 42', on: 'cream', accent: '#BF4B2A', mark: 'quarter',
  },
};

/** A full-page poster introducing a chapter, in its room's colour. */
function renderChapterDivider(ch: Chapter): string {
  const text = ch.on === 'ink' ? '#1A1B1D' : '#F2F1EA';
  const quiet = ch.on === 'ink' ? 'rgba(26,27,29,0.62)' : 'rgba(242,241,234,0.66)';
  const line = ch.on === 'ink' ? 'rgba(26,27,29,0.18)' : 'rgba(242,241,234,0.22)';
  const sectionList = ch.sections
    .map(
      (s, i) => `<div style="display:flex; align-items:baseline; gap:14px; padding:12px 0; border-top:1px solid ${line};">
        <span style="font-family:'JetBrains Mono',monospace; font-weight:700; font-size:10px; letter-spacing:0.2em; opacity:0.6; width:26px;">${String(i + 1).padStart(2, '0')}</span>
        <span class="card-title" style="font-size:16px; color:${text};">${escapeHtml(s)}</span>
      </div>`,
    )
    .join('');
  return `
    <div class="page" style="background:${ch.block}; color:${text}; position:relative; justify-content:space-between; overflow:hidden;">
      ${mark(ch.mark, 'br', text, 0.14, 360)}
      <div style="position:relative; z-index:1;">
        <div style="font-family:'JetBrains Mono',monospace; font-weight:700; font-size:11px; letter-spacing:0.24em; text-transform:uppercase;">Chapter ${ch.numeral} &middot; ${escapeHtml(ch.room)}</div>
      </div>
      <div style="position:relative; z-index:1; max-width:560px;">
        <h2 class="statement" style="font-size:72px; color:${text}; margin-bottom:22px;">${escapeHtml(ch.title)}</h2>
        <p style="font-family:'Inter',sans-serif; font-size:15px; line-height:1.6; color:${quiet}; max-width:460px;">${escapeHtml(ch.blurb)}</p>
      </div>
      <div style="position:relative; z-index:1; max-width:520px;">
        ${sectionList}
      </div>
    </div>`;
}

/**
 * The number-led section opener: a mono eyebrow, the figure that matters
 * display-bold with a mono label, then the surface's one sentence. Say
 * the number.
 */
function renderSectionLead(opts: {
  number: string;
  section: string;
  value: string;
  unit?: string;
  label: string;
  statement: string;
  dark?: boolean;
  accent?: string;
}): string {
  const borderColor = opts.dark ? 'rgba(26,27,29,0.12)' : '#D9D6CB';
  const accent = opts.accent || '#205E40';
  return `
    <div style="margin-bottom: 28px; border-bottom: 1px solid ${borderColor}; padding-bottom: 22px;">
      <div class="eyebrow" style="color: ${accent};">${escapeHtml(opts.number)} &middot; ${escapeHtml(opts.section.toUpperCase())}</div>
      <div style="display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-top: 14px;">
        <div>
          <div class="lead-number" style="font-size: 66px; color: ${accent};">${escapeHtml(opts.value)}${opts.unit ? `<span style="font-size: 18px; font-weight: 600; color: #6F6F68; margin-left: 10px;">${escapeHtml(opts.unit)}</span>` : ''}</div>
          <div class="lead-label" style="margin-top: 8px;">${escapeHtml(opts.label)}</div>
        </div>
        <div class="statement" style="font-size: 26px; max-width: 300px; text-align: right;">${escapeHtml(opts.statement)}</div>
      </div>
    </div>`;
}

// ISSUE G FIX: Use __PAGE_NUM__ placeholder for dynamic sequential numbering.
// The main renderer replaces all placeholders with actual sequential page numbers,
// eliminating hardcoded page counts that become stale when pages are added/removed.
function renderPageFooter(pageNumber?: number, dark = false): string {
  const color = dark ? 'rgba(242,241,234,0.5)' : 'rgba(26,27,29,0.3)';
  const bgColor = dark ? '#1A1B1D' : '#ECEAE3';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // The footer uses a solid background that extends upward (padding-top: 24px) to
  // cover any page content that might overflow into the footer zone. Combined with
  // z-index: 10, this ensures the footer always sits cleanly on top of content.
  return `
    <div style="position: absolute; bottom: 0; left: 0; right: 0; z-index: 10; background: ${bgColor}; padding: 0 48px 48px 48px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; font-family: 'JetBrains Mono', monospace; color: ${color}; text-transform: uppercase; letter-spacing: 0.22em; border-top: 1px solid ${color}; padding-top: 16px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>Generated by</span>
          ${alkateraLogo(14, dark)}
        </div>
        ${pageNumber ? `<div style="font-weight: 700; font-size: 12px;">__PAGE_NUM__</div>` : ''}
        <div>ISO 14040/44 &amp; 14067 | ${dateStr}</div>
      </div>
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
    // Overview (forest)
    renderCoverPage(data),
    renderExecSummaryPage(data),
    // Chapter I — The measures (cobalt): how it was measured
    renderChapterDivider(CHAPTERS.measures),
    renderGoalAndScopePage(data),
    renderMethodologyPage(data),
    renderDataQualityPage(data),
    // Chapter II — The footprint (plum): what it costs the planet
    renderChapterDivider(CHAPTERS.footprint),
    renderClimatePage(data),
    renderViticulturePage(data),
    renderProcessingPage(data),
    renderGhgDetailedPage(data),
    renderEnvironmentalImpactsPages(data),
    renderWaterPage(data),
    renderCircularityPage(data),
    renderLandUsePage(data),
    // Chapter III — The sources (ochre): where it comes from
    renderChapterDivider(CHAPTERS.sources),
    renderIngredientBreakdownPage(data),
    renderSupplyChainPage(data),
    // Chapter IV — The evidence (brick): how we know it is sound
    renderChapterDivider(CHAPTERS.evidence),
    renderInterpretationPage(data),
    renderUncertaintySensitivityPage(data),
    renderCriticalReviewDisclosure(data),
    renderAiCriticalReviewPage(data),
    // Close (ink)
    renderCommitmentPage(data),
  ].filter(Boolean).join('\n');

  // ISSUE G FIX: Replace __PAGE_NUM__ placeholders with sequential page numbers.
  // The cover page has no page number, so the first __PAGE_NUM__ occurrence is page 1.
  let pageCounter = 0;
  const pagesWithNumbers = pages
    .replace(/__PAGE_NUM__/g, () => String(++pageCounter))
    // Defensive brand-name normalisation: older stored snapshots (e.g. the
    // critical-review disclosure persisted in aggregated_impacts) can carry the
    // legacy "AlkaTera" casing. The brand name is always lowercase "alkatera",
    // so normalise any stray capitalised token in the rendered body. Lowercase
    // usages and the branded alka<b>tera</b> spans are unaffected.
    .replace(/Alka[Tt]era/g, 'alkatera');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCA Report · ${escapeHtml(data.meta.productName)}</title>

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
      color: #1A1B1D;
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

    .dark-page { background: #F2F1EA; color: #1A1B1D; }
    .light-page { background: #ECEAE3; color: #1A1B1D; }

    /* ---- The studio kit (design language) ------------------------------- */
    /* Statements speak in Space Grotesk; Inter explains; JetBrains Mono
       annotates. The report's accent is forest; the room inks appear only
       in the charts. Panels are cream with a hairline, radius 6. */

    .statement {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      line-height: 0.98;
      letter-spacing: -0.03em;
      color: #1A1B1D;
    }

    .eyebrow {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: #205E40;
    }
    .eyebrow.dim { color: #6F6F68; }

    .lead-number {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: #205E40;
      line-height: 0.9;
      letter-spacing: -0.03em;
    }
    .lead-label {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.2em;
      color: #6F6F68;
    }

    .card-title {
      font-family: 'Space Grotesk', sans-serif;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: #1A1B1D;
    }

    .body { font-size: 13px; line-height: 1.6; color: #6F6F68; }

    .panel {
      background: #F2F1EA;
      border: 1px solid #D9D6CB;
      border-radius: 6px;
      padding: 20px;
    }

    .rule { border-top: 1px solid #D9D6CB; }
    .dark-page .rule { border-top-color: rgba(26,27,29,0.12); }

    /* States are typographic: mono caps in a working tone, no pill. */
    .state {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.18em;
    }
    .state-good { color: #047857; }
    .state-attention { color: #B45309; }
    .state-stale { color: #BE123C; }
    .state-quiet { color: #6F6F68; }

    /* Hairline table: mono caps headers, 1px rules, tabular figures. */
    .studio-table { width: 100%; border-collapse: collapse; }
    .studio-table thead th {
      text-align: left;
      padding: 9px 10px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #6F6F68;
      border-bottom: 1px solid #D9D6CB;
    }
    .studio-table tbody td {
      padding: 9px 10px;
      font-size: 11px;
      color: #1A1B1D;
      border-bottom: 1px solid #D9D6CB;
    }
    .studio-table tbody td .num { font-variant-numeric: tabular-nums; }

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
