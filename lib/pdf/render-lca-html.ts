/**
 * Server-side LCA Report HTML Renderer — the studio design language.
 *
 * Implements the canonical "LCA Report Template" from Tim's Claude Design
 * project (d03d39b6-c0b4-4031-8e54-b4953be6a269, `LCA Report Template.dc.html`),
 * genericised: every literal in the design is bound to LCAReportData.
 *
 * Generates a self-contained HTML document converted to PDF via PDFShift
 * (Chromium). Pure HTML/CSS — no React runtime, no chart libraries.
 *
 * Page architecture: fixed A4 page divs (794×1123 @96dpi, PDFShift margin 0),
 * one per design "page", with the design's own CONT. header pattern for
 * sections that overflow (long tables chunk across pages exactly the way the
 * design models continuation pages). The paper ground, cream panels, hairline
 * rules, mono eyebrows and Bricolage Grotesque numbers follow the design verbatim.
 *
 * Contents (design section rhythm — band colour in brackets):
 *   Cover [forest] · 01 Executive Summary [forest] · 02 Goal & Scope [cobalt]
 *   03 Methodology [cobalt] · 04 Data Quality [ochre, ink text]
 *   05 Climate [forest] · 05b Viticulture (conditional) [forest]
 *   05c Processing [forest] · 06 Detailed GHG [forest]
 *   07 Environmental Categories [brick] · 08 Ingredients [brick]
 *   09 Water [brick] · 10 Circularity [brick] · 11 Land Use [brick]
 *   12 Supply Chain [cobalt] · 13 Interpretation [ink]
 *   14 Uncertainty [ink] · 15 Critical Review [ink]
 *   15b AI-Assisted Internal Review (conditional) [ink] · Back cover [forest]
 */

import type { LCAReportData } from '@/components/lca-report/types';

import {
  INK, CREAM, PAPER, HAIR, DIM, FOREST, COBALT, OCHRE, OCHRE_INK, BRICK,
  GOOD, ATTN, STALE, MONO, SG, INTER,
  escapeHtml, wordmark, leafMark, mono, band, heroBand, statCard, cardTitle,
  bodyP, defBlock, bullet, th, td, toneChip, gradeTone, meter, createPageShell,
} from '@/lib/pdf/studio-kit';

// One fixed A4 page with the LCA report's footer meta. All primitives come
// from the shared studio kit (lib/pdf/studio-kit.ts) so every alkatera PDF
// composes one design implementation.
const page = createPageShell({ footerMeta: 'ISO 14040/44 &amp; 14067' });

// ============================================================================
// COVER
// ============================================================================

function renderCoverPage(data: LCAReportData): string {
  const boundary = escapeHtml(data.goalAndScope.systemBoundary);
  // A product sold through several channels has a different footprint down
  // each one. Naming the route on the cover stops two honest reports for the
  // same product reading as contradictory numbers.
  const scenario = data.goalAndScope.endUseScenario ?? null;
  const refYear = data.meta.referenceYear ? String(data.meta.referenceYear) : escapeHtml(data.meta.assessmentPeriod);
  const fact = (label: string, value: string) => `<div>
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;opacity:.7">${label}</div>
      <div style="font-family:${SG};font-size:15px;font-weight:600;margin-top:8px;line-height:1.25">${value}</div>
    </div>`;

  return page(`
    <div style="background:${FOREST};border-radius:6px;color:${CREAM};position:relative;overflow:hidden;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:48px 52px;box-sizing:border-box">
      ${leafMark(CREAM, 'position:absolute;top:-90px;right:-70px;width:380px;height:380px;opacity:.2')}
      <div style="display:flex;justify-content:space-between;align-items:baseline;position:relative">
        ${wordmark(20, CREAM)}
        <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;color:${CREAM};opacity:.85">LIFE CYCLE ASSESSMENT</div>
      </div>
      <div style="position:relative">
        <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;opacity:.75;margin-bottom:18px">${escapeHtml(data.meta.organization)} · ${escapeHtml(data.meta.generatedBy)}</div>
        <div style="font-family:${SG};font-size:52px;font-weight:700;line-height:.95;letter-spacing:-.035em;max-width:540px">${escapeHtml(data.meta.productName)}.</div>
        <div style="font-family:${INTER};font-size:13px;line-height:1.55;opacity:.85;margin-top:22px;max-width:400px">Prepared in accordance with ISO 14067:2018 and ISO 14044:2006.</div>
      </div>
      <div style="position:relative">
        <div style="display:grid;grid-template-columns:${scenario ? '1fr 1fr 1fr 1fr' : '1fr 1fr 1fr'};gap:24px;border-top:1px solid rgba(242,241,234,.3);padding-top:20px">
          ${fact('Functional unit', escapeHtml(data.functionalUnit.value))}
          ${fact('System boundary', boundary)}
          ${scenario ? fact('Route to market', escapeHtml(scenario.name)) : ''}
          ${fact('Reference year', refYear)}
        </div>
      </div>
    </div>
  `, { footer: false });
}

// ============================================================================
// 01 · EXECUTIVE SUMMARY
// ============================================================================

function renderExecSummaryPage(data: LCAReportData): string {
  const dq = data.executiveSummary.dataQualityScore;
  const dqRating = data.dataQuality.overallRating;

  return page(`
    ${heroBand('01', 'Executive Summary', 'KEY INSIGHT', FOREST, `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;gap:32px;margin-top:24px">
        <div>
          <div style="font-family:${SG};font-size:68px;font-weight:700;line-height:.95;letter-spacing:-.035em;font-variant-numeric:tabular-nums">${escapeHtml(data.executiveSummary.keyHighlight.value)}</div>
          <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(242,241,234,.75);margin-top:8px">${escapeHtml(data.executiveSummary.keyHighlight.label)}</div>
        </div>
        <div style="min-width:220px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:rgba(242,241,234,.75)">DATA QUALITY</div>
            <div style="font-family:${SG};font-size:15px;font-weight:600">${escapeHtml(dqRating)} · ${dq}%</div>
          </div>
          <div style="height:5px;background:rgba(242,241,234,.25);border-radius:6px;margin-top:8px;overflow:hidden"><div style="width:${Math.max(0, Math.min(100, dq))}%;height:100%;background:${CREAM}"></div></div>
        </div>
      </div>
      <p style="font-family:${INTER};font-size:12.5px;line-height:1.6;color:rgba(242,241,234,.85);margin:20px 0 0">${escapeHtml(data.executiveSummary.content)}</p>
    `)}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:24px">
      ${statCard('Carbon footprint (fossil)', escapeHtml(data.climateImpact.totalCarbon), 'KG CO₂E', { size: 32, pad: 20 })}
      ${statCard('Water footprint', escapeHtml(data.waterFootprint.totalConsumption), 'LITRES', { size: 32, pad: 20 })}
      ${statCard('Circularity', `${data.circularity.eolRecyclingRate || data.circularity.recyclingRate}%`, 'RECYCLING RATE', { size: 32, pad: 20 })}
    </div>
  `);
}

// ============================================================================
// 02 · GOAL & SCOPE
// ============================================================================

function renderGoalAndScopePages(data: LCAReportData): string[] {
  const gs = data.goalAndScope;
  const pages: string[] = [];
  const audience = gs.intendedAudience.length ? escapeHtml(gs.intendedAudience.join(', ')) + '.' : 'Internal stakeholders.';
  const comparative = gs.isComparativeAssertion
    ? 'Yes, this study supports comparative assertions; a critical review per ISO 14044 §6 is required before public disclosure.'
    : 'No, this study does not support comparative assertions disclosed to the public.';

  pages.push(page(`
    ${band('02', 'Goal &amp; Scope Definition', `ISO 14044:2006 §4.2 · REPORT VERSION ${escapeHtml(data.meta.version)}`, COBALT)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:22px 28px;margin-top:22px">
      ${defBlock('Intended Application', escapeHtml(gs.intendedApplication))}
      ${defBlock('Reasons for Study', escapeHtml(gs.reasonsForStudy))}
      ${defBlock('Intended Audience', audience)}
      ${defBlock('Comparative Assertion', comparative)}
    </div>
    <div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:22px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${COBALT}">SYSTEM BOUNDARY · ${escapeHtml(gs.systemBoundary)}</div>
      ${bodyP(escapeHtml(gs.systemBoundaryDescription), { color: INK, mt: 10 })}
    </div>
    ${gs.endUseScenario ? `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:14px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${COBALT}">ROUTE TO MARKET · ${escapeHtml(gs.endUseScenario.name)}</div>
      ${bodyP(escapeHtml(gs.endUseScenario.description), { color: INK, mt: 10 })}
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:20px">
      ${defBlock('Cut&#8209;off Criteria', escapeHtml(gs.cutOffCriteria))}
      ${defBlock('Allocation Procedure', escapeHtml(gs.allocationProcedure))}
    </div>
  `));

  // End-of-life modelling assumptions: its own continuation page whenever the
  // disclosure exists (the pathway table needs the room on A4).
  const eol = data.eolMethodology;
  if (eol && eol.materialPathways.length > 0) {
    const rows = eol.materialPathways.slice(0, 14).map(p => `<tr>
      ${td(escapeHtml(p.material) + (p.isUserOverride ? ` ${mono('· OVERRIDE', { size: 8, ls: 0.1, color: DIM })}` : ''), { first: true })}
      ${td(`${Math.round(p.recyclingPct)}%`, { align: 'right' })}
      ${td(`${Math.round(p.landfillPct)}%`, { align: 'right' })}
      ${td(`${Math.round(p.incinerationPct)}%`, { align: 'right' })}
      ${td(`${Math.round(p.compostingPct)}%`, { align: 'right' })}
      ${td(`${Math.round(p.adPct)}%`, { align: 'right', last: true })}
    </tr>`).join('');

    pages.push(page(`
      ${band('02', 'Goal &amp; Scope, End&#8209;of&#8209;Life Assumptions', 'ISO 14044 §4.4 · CONTINUED', COBALT)}
      <div style="margin-top:22px">
        ${cardTitle('End&#8209;of&#8209;Life Modelling Assumptions', 'ISO 14044 §4.4')}
        <div style="font-family:${MONO};font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:8px">REGION · ${escapeHtml(eol.regionLabel)}&nbsp;&nbsp;·&nbsp;&nbsp;METHOD · ${escapeHtml(eol.avoidedBurdenMethod)}&nbsp;&nbsp;·&nbsp;&nbsp;DATA YEAR · ${eol.dataYear}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead><tr>
            ${th('Material', { first: true })}
            ${th('Recycling', { align: 'right' })}
            ${th('Landfill', { align: 'right' })}
            ${th('Incineration', { align: 'right' })}
            ${th('Composting', { align: 'right' })}
            ${th('AD', { align: 'right', last: true })}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:10px">SOURCES · ${escapeHtml(eol.dataSource)}</div>
      </div>
    `));
  }

  return pages;
}

// ============================================================================
// 03 · METHODOLOGY (two pages: stages/method/sources · models/software/standards)
// ============================================================================

function renderMethodologyPages(data: LCAReportData): string[] {
  const m = data.methodology;

  const included = m.includedStages.map(s => bullet(escapeHtml(s), { color: COBALT })).join('');
  const excluded = m.excludedStages.map(s => bullet(escapeHtml(s), { color: DIM, outline: true })).join('');

  const sourceRows = m.dataSources.map(s => `<div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:9px 0;border-bottom:1px solid ${HAIR}">
      <div><span style="font-family:${INTER};font-size:12.5px;font-weight:600;color:${INK}">${escapeHtml(s.name)}</span>${s.description ? `<span style="font-family:${INTER};font-size:12px;color:${DIM}"> · ${escapeHtml(s.description)}</span>` : ''}</div>
      <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.12em;color:${s.count > 0 ? INK : DIM};flex:none">${s.count} FACTORS</div>
    </div>`).join('');

  const pageA = page(`
    ${band('03', 'Methodology', 'ISO 14044:2006 §4.3 &amp; §4.4', COBALT)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px">
      <div>
        <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:10px">Included Stages</div>
        <div style="display:grid;gap:7px">${included}</div>
      </div>
      <div>
        <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:10px">Excluded Stages</div>
        <div style="display:grid;gap:7px">${excluded || bullet('None: all lifecycle stages inside the boundary are modelled.', { color: DIM, outline: true })}</div>
      </div>
    </div>
    <div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:22px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${COBALT}">LCIA METHOD · ${escapeHtml(m.lciaMethod)}</div>
      ${bodyP(escapeHtml(m.lciaMethodDescription), { color: INK, mt: 10 })}
    </div>
    <div style="margin-top:22px">
      ${cardTitle('Data Sources &amp; Databases')}
      <div style="margin-top:6px">${sourceRows}</div>
    </div>
  `);

  const softwareRows = m.softwareAndDatabases.map((s, i) => `<div style="display:flex;gap:20px;padding:9px 0;border-bottom:1px solid ${HAIR}">
      <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${i === 0 ? COBALT : INK};width:190px;flex:none">${escapeHtml(s.name)} ${escapeHtml(s.version)}</div>
      <div style="font-family:${INTER};font-size:12px;color:${DIM}">${escapeHtml(s.purpose)}</div>
    </div>`).join('');

  const modelRows = m.characterizationModels.map(c => `<tr>
      ${td(escapeHtml(c.category), { first: true, bold: true })}
      ${td(escapeHtml(c.model))}
      ${td(escapeHtml(c.reference), { last: true, dim: true })}
    </tr>`).join('');

  const standards = data.goalAndScope.referenceStandards.map(s => {
    const [ref, ...rest] = s.split('·').map(x => x.trim());
    const desc = rest.join(' · ');
    return `<div style="font-family:${INTER};font-size:12.5px;color:${INK}"><span style="font-family:${MONO};font-size:10px;font-weight:700;color:${COBALT}">${escapeHtml(ref)}</span>${desc ? ` · ${escapeHtml(desc)}` : ''}</div>`;
  }).join('');

  const pageB = page(`
    ${band('03', 'Methodology, Characterization Models', 'CONTINUED', COBALT)}
    <div style="margin-top:20px">
      ${cardTitle('Software &amp; Tools')}
      <div style="margin-top:6px">${softwareRows}</div>
    </div>
    <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${DIM};margin-top:22px">LCIA CHARACTERIZATION FACTORS</div>
    <table style="width:100%;border-collapse:collapse;margin-top:10px">
      <thead><tr>
        ${th('Impact Category', { first: true })}
        ${th('Characterization Model')}
        ${th('Reference', { last: true })}
      </tr></thead>
      <tbody>${modelRows}</tbody>
    </table>
    <div style="margin-top:24px">
      <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:8px">Reference Standards</div>
      <div style="display:grid;gap:6px">${standards}</div>
    </div>
  `);

  return [pageA, pageB];
}

// ============================================================================
// 04 · DATA QUALITY (hero+pedigree+coverage · material table · notes)
// ============================================================================

function renderDataQualityPages(data: LCAReportData): string[] {
  const dq = data.dataQuality;
  const pages: string[] = [];

  const pedigreeRow = (label: string, score: number, desc: string) => `<div style="display:flex;gap:16px;align-items:baseline;padding:9px 0;border-bottom:1px solid ${HAIR}">
      <div style="font-family:${INTER};font-size:12.5px;font-weight:600;color:${INK};width:130px;flex:none">${label}</div>
      <div style="font-family:${SG};font-size:16px;font-weight:700;color:${score >= 4 ? ATTN : INK};width:24px;flex:none;font-variant-numeric:tabular-nums">${score}</div>
      <div style="font-family:${INTER};font-size:12px;color:${DIM}">${desc}</div>
    </div>`;

  const cov = dq.coverageSummary;
  pages.push(page(`
    ${heroBand('04', 'Data Quality Assessment', 'ISO 14044:2006 §4.2.3.6', OCHRE, `
      <div style="display:flex;gap:36px;align-items:flex-end;margin-top:22px">
        <div>
          <div style="font-family:${SG};font-size:52px;font-weight:700;line-height:.95;letter-spacing:-.035em">${escapeHtml(dq.overallRating)}.</div>
          <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:rgba(26,27,29,.7)">OVERALL RATING · ${dq.overallScore}%</div>
        </div>
        <div style="flex:1;height:5px;background:rgba(26,27,29,.2);border-radius:6px;overflow:hidden;margin-bottom:22px"><div style="width:${Math.max(0, Math.min(100, dq.overallScore))}%;height:100%;background:${INK}"></div></div>
      </div>
    `)}
    <div style="margin-top:22px">
      ${cardTitle('Pedigree Matrix', 'ISO 14044 §4.2.3.6')}
      <div style="margin-top:6px">
        ${pedigreeRow('Reliability', dq.pedigreeMatrix.reliability, 'How data was obtained (measured, calculated, estimated)')}
        ${pedigreeRow('Completeness', dq.pedigreeMatrix.completeness, 'Statistical representativeness of data')}
        ${pedigreeRow('Temporal', dq.pedigreeMatrix.temporalRepresentativeness, 'Age of data vs study period')}
        ${pedigreeRow('Geographic', dq.pedigreeMatrix.geographicRepresentativeness, 'Match of data geography to study area')}
        ${pedigreeRow('Technological', dq.pedigreeMatrix.technologicalRepresentativeness, 'Match of data technology to actual processes')}
      </div>
      <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:8px">SCALE · 1 (BEST) TO 5 (WORST) PER ECOINVENT PEDIGREE APPROACH</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;margin-top:22px">
      ${statCard('Primary data', `${Math.round(cov.primaryDataShare)}%`, `${cov.primaryCount} OF ${cov.totalMaterials} MATERIALS`, { size: 26, pad: 16 })}
      ${statCard('Secondary data', `${Math.round(cov.secondaryDataShare)}%`, `${cov.secondaryCount} MATERIALS`, { size: 26, pad: 16 })}
      ${statCard('Proxy data', `${Math.round(cov.proxyDataShare)}%`, `${cov.proxyCount} MATERIALS`, { size: 26, pad: 16 })}
      ${statCard('Total materials', String(cov.totalMaterials), 'IN INVENTORY', { size: 26, pad: 16 })}
    </div>
  `));

  // Material-level table: chunk 13 rows per page.
  const perPage = 13;
  for (let i = 0; i < dq.materialQuality.length; i += perPage) {
    const chunk = dq.materialQuality.slice(i, i + perPage);
    const rows = chunk.map(mq => `<tr>
        ${td(escapeHtml(mq.name), { first: true })}
        ${td(escapeHtml(mq.source), { dim: true })}
        ${td(toneChip(escapeHtml(mq.grade), gradeTone(mq.grade)))}
        ${td(`${mq.confidence}%`, { align: 'right' })}
        ${td(escapeHtml(mq.geographicCoverage), { last: true, dim: true })}
      </tr>`).join('');
    pages.push(page(`
      ${band('04', 'Data Quality, Materials', i === 0 ? 'CONTINUED' : 'CONTINUED FURTHER', OCHRE)}
      <div style="margin-top:20px">
        ${cardTitle('Material&#8209;Level Data Quality')}
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          <thead><tr>
            ${th('Material', { first: true })}
            ${th('Source')}
            ${th('Grade')}
            ${th('Confidence', { align: 'right' })}
            ${th('Geography', { last: true })}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `));
  }

  // Notes page: missing data, uncertainty, roadmap, source distribution.
  const primary = Math.round(cov.primaryDataShare);
  const secondary = Math.round(cov.secondaryDataShare);
  const proxy = Math.round(cov.proxyDataShare);
  const distSegment = (pct: number, color: string) => pct > 0 ? `<div style="width:${pct}%;background:${color}"></div>` : '';
  const roadmapRow = (label: string, labelColor: string, text: string) => `<div style="display:flex;gap:20px;padding:11px 0;border-bottom:1px solid ${HAIR}">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.14em;color:${labelColor};width:90px;flex:none">${label}</div>
      <div style="font-family:${INTER};font-size:12.5px;line-height:1.5;color:${INK}">${text}</div>
    </div>`;

  pages.push(page(`
    ${band('04', 'Data Quality, Notes', 'CONTINUED', OCHRE)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px">
      ${defBlock('Missing Data Treatment', escapeHtml(dq.missingDataTreatment), 'ISO 14044 §4.2.3.6.3')}
      ${defBlock('Uncertainty Assessment', escapeHtml(dq.uncertaintyNote))}
    </div>
    <div style="margin-top:24px">
      ${cardTitle('Data Quality Improvement Roadmap')}
      <div style="margin-top:6px">
        ${roadmapRow('PRIORITY 1', OCHRE_INK, 'Collect primary data from top 3 impact contributors. This typically addresses over 60% of total climate impact uncertainty.')}
        ${roadmapRow('PRIORITY 2', OCHRE_INK, 'Replace proxy emission factors with material&#8209;specific secondary data from ecoinvent or AGRIBALYSE for improved geographic and technological representativeness.')}
        ${roadmapRow('PRIORITY 3', OCHRE_INK, 'Verify transport distances and modes with suppliers to refine distribution stage estimates currently based on distance &times; freight factor calculations.')}
        ${roadmapRow('ONGOING', DIM, 'Annual data refresh with updated DEFRA emission factors and database versions. Re&#8209;assess data quality scores after each improvement cycle.')}
      </div>
    </div>
    <div style="margin-top:24px">
      ${cardTitle('Data Source Distribution')}
      <div style="display:flex;height:14px;border-radius:6px;overflow:hidden;border:1px solid ${HAIR};margin-top:12px">
        ${distSegment(primary, FOREST)}${distSegment(secondary, OCHRE_INK)}${distSegment(proxy, ATTN)}${distSegment(Math.max(0, 100 - primary - secondary - proxy), HAIR)}
      </div>
      <div style="display:flex;gap:24px;margin-top:10px">
        <div style="font-family:${MONO};font-size:9.5px;${primary > 0 ? `font-weight:700;color:${FOREST}` : `color:${DIM}`};letter-spacing:.12em">PRIMARY · ${primary}%</div>
        <div style="font-family:${MONO};font-size:9.5px;${secondary > 0 ? `font-weight:700;color:${OCHRE_INK}` : `color:${DIM}`};letter-spacing:.12em">SECONDARY · ${secondary}%</div>
        <div style="font-family:${MONO};font-size:9.5px;${proxy > 0 ? `font-weight:700;color:${ATTN}` : `color:${DIM}`};letter-spacing:.12em">PROXY · ${proxy}%</div>
      </div>
    </div>
  `));

  return pages;
}

// ============================================================================
// 05 · CLIMATE IMPACT
// ============================================================================

function renderClimatePage(data: LCAReportData): string {
  const maxStageValue = Math.max(...data.climateImpact.stages.map(s => s.value), 0.001);

  // Headline is the fossil-only carbon footprint (ISO 14067 §6.4.9.3). Biogenic
  // carbon is reported separately (Section 06) and the lifecycle stage bars are
  // all-species, so explain the difference rather than leave the headline
  // looking inconsistent with the stage totals.
  const totalAllSpecies = parseFloat(data.ghgDetailed?.totalGwp100 || '0');
  const fossilHeadline = parseFloat(data.climateImpact.totalCarbon || '0');
  const biogenicSeparate = totalAllSpecies - fossilHeadline;
  const reconciliation = biogenicSeparate > 0.0005
    ? `Fossil carbon footprint per ISO 14067:2018. Biogenic carbon (${biogenicSeparate.toFixed(4)} kg CO₂e) is reported separately in Section 06 and excluded here. The lifecycle stage bars below include biogenic carbon and sum to ${totalAllSpecies.toFixed(4)} kg CO₂e.`
    : `Fossil carbon footprint per ISO 14067:2018. Biogenic carbon is reported separately in Section 06.`;

  const stageBar = (stage: LCAReportData['climateImpact']['stages'][number]) => {
    const isMax = stage.value === maxStageValue;
    return `<div style="display:grid;grid-template-columns:110px 1fr 150px;gap:14px;align-items:center">
      <div style="font-family:${INTER};font-size:12px;font-weight:600;color:${INK}">${escapeHtml(stage.label)}</div>
      ${meter((stage.value / maxStageValue) * 100, FOREST, { height: 12, mt: 0 })}
      <div style="font-family:${MONO};font-size:10px;${isMax ? `font-weight:700;color:${INK}` : `color:${DIM}`};letter-spacing:.04em;text-align:right">${stage.value.toFixed(4)} KG · ${escapeHtml(stage.percentage)}%</div>
    </div>`;
  };

  const scopeCards = data.climateImpact.scopes.map(s => {
    const pct = parseFloat(s.value);
    const dominant = pct >= 50;
    return statCard(escapeHtml(s.name), `${escapeHtml(s.value)}%`, undefined, { size: 26, pad: 16, valueColor: dominant ? FOREST : INK });
  }).join('');

  const cm = data.contractManufacturingNote;
  const attributionNote = cm?.isContractManufactured
    ? `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:16px 20px;margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${DIM}">SCOPE ATTRIBUTION NOTE</div>
          ${toneChip('CORRECT', 'good')}
        </div>
        ${bodyP(escapeHtml(cm.explanation), { color: INK, size: 11.5, mt: 10 })}
      </div>`
    : '';

  return page(`
    ${heroBand('05', 'Climate Impact', 'FOSSIL CARBON FOOTPRINT · GWP-100', FOREST, `
      <div style="font-family:${SG};font-size:56px;font-weight:700;line-height:.95;letter-spacing:-.035em;font-variant-numeric:tabular-nums;margin-top:20px">${escapeHtml(data.climateImpact.totalCarbon)} <span style="font-size:24px;letter-spacing:-.02em">kg CO₂e</span></div>
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(242,241,234,.75);margin-top:10px">PER ${escapeHtml(data.functionalUnit.value)}</div>
      <p style="font-family:${INTER};font-size:11.5px;line-height:1.55;color:rgba(242,241,234,.85);margin:14px 0 0;max-width:580px">${reconciliation}</p>
    `)}
    <div style="margin-top:22px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${DIM}">LIFECYCLE STAGE BREAKDOWN</div>
      <div style="display:grid;gap:11px;margin-top:12px">
        ${data.climateImpact.stages.map(stageBar).join('')}
      </div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:10px">BAR LENGTHS SCALED TO THE LARGEST STAGE · VALUES IN KG CO₂EQ</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:20px">${scopeCards}</div>
    ${attributionNote}
  `);
}

// ============================================================================
// 05b · VITICULTURE (conditional — only for self-grown vineyard data)
// ============================================================================

function renderViticulturePage(data: LCAReportData): string {
  const viti = data.viticultureDetail;
  if (!viti) return '';
  const removals = data.flagRemovals;

  const eb = viti.emissionBreakdown;
  const breakdownRows: Array<[string, number]> = [
    ['N₂O direct (soils)', eb.n2oDirect],
    ['N₂O indirect', eb.n2oIndirect],
    ['N₂O crop residue', eb.n2oCropResidue],
    ['Land-use change CO₂e', eb.lucCo2e],
    ['Fertiliser production', eb.fertiliserProduction],
    ['Machinery fuel', eb.machineryFuel],
    ['Irrigation energy', eb.irrigationEnergy],
    ['Pesticide production', eb.pesticideProduction],
  ];
  const maxVal = Math.max(...breakdownRows.map(([, v]) => v), 0.000001);
  const bars = breakdownRows.filter(([, v]) => v > 0).map(([label, v]) => `<div style="display:grid;grid-template-columns:160px 1fr 110px;gap:14px;align-items:center">
      <div style="font-family:${INTER};font-size:12px;font-weight:600;color:${INK}">${label}</div>
      ${meter((v / maxVal) * 100, FOREST, { height: 10, mt: 0 })}
      <div style="font-family:${MONO};font-size:10px;color:${DIM};letter-spacing:.04em;text-align:right">${v.toFixed(4)} KG</div>
    </div>`).join('');

  const removalsBlock = removals
    ? `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:16px 20px;margin-top:20px">
        <div style="display:flex;justify-content:space-between;align-items:baseline">
          <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${DIM}">FLAG SOIL-CARBON REMOVALS · SBTi</div>
          ${toneChip(removals.isVerified ? 'VERIFIED' : 'UNVERIFIED', removals.isVerified ? 'good' : 'attention')}
        </div>
        <div style="font-family:${SG};font-size:22px;font-weight:700;color:${INK};margin-top:8px;font-variant-numeric:tabular-nums">${removals.soilCarbonCo2e.toFixed(4)} <span style="font-size:12px">kg CO₂e</span></div>
        ${bodyP(escapeHtml(removals.methodology) + (removals.removalWarning ? ` ${escapeHtml(removals.removalWarning)}` : ''), { size: 11, mt: 8 })}
      </div>`
    : '';

  return page(`
    ${band('05b', 'Viticulture', `SELF-GROWN VINEYARD DATA · ${viti.vintageYears.join(', ')}`, FOREST)}
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:22px">
      ${statCard('Viticulture emissions', viti.emissionsTotal.toFixed(4), 'KG CO₂E PER FUNCTIONAL UNIT', { size: 26, pad: 16 })}
      ${statCard('Share of footprint', escapeHtml(viti.percentOfTotal), 'OF TOTAL LIFECYCLE EMISSIONS', { size: 26, pad: 16 })}
      ${statCard('Primary data', `${viti.primaryDataPercent}%`, `GRADE ${escapeHtml(viti.dataQualityGrade)} · ${escapeHtml(viti.averagingMethod)}`, { size: 26, pad: 16 })}
    </div>
    <div style="margin-top:22px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${DIM}">EMISSION BREAKDOWN</div>
      <div style="display:grid;gap:10px;margin-top:12px">${bars}</div>
    </div>
    ${removalsBlock}
  `);
}

// ============================================================================
// 05c · PROCESSING & MANUFACTURING (one page per facility)
// ============================================================================

function renderProcessingPages(data: LCAReportData): string[] {
  const pd = data.processingDetail;
  if (!pd || pd.facilities.length === 0) return [];

  const contractCount = pd.facilities.filter(f => f.isContractManufacturer).length;
  const facilitiesLabel = contractCount > 0
    ? `${contractCount} CONTRACT${pd.facilities.length > contractCount ? ` · ${pd.facilities.length - contractCount} OWNED` : ''}`
    : 'OWNED FACILITIES';

  return pd.facilities.map((f, idx) => {
    const isFirst = idx === 0;
    const summaryCards = isFirst
      ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:22px">
          ${statCard('Processing emissions', escapeHtml(pd.totalProcessingEmissions), 'KG CO₂E PER FUNCTIONAL UNIT', { size: 28, pad: 18 })}
          ${statCard('Share of footprint', escapeHtml(pd.percentOfTotal), 'OF TOTAL LIFECYCLE EMISSIONS', { size: 28, pad: 18 })}
          ${statCard('Facilities', String(pd.facilities.length), facilitiesLabel, { size: 28, pad: 18 })}
        </div>`
      : '';

    const scopeLabel = f.isContractManufacturer ? 'SCOPE 3 TOTAL' : 'SCOPE 1 + 2 TOTAL';
    const attributionMeta = `${f.isContractManufacturer ? 'CONTRACT MANUFACTURER (SCOPE 3)' : 'OWNED FACILITY (SCOPE 1/2)'} · FACILITY-LEVEL ALLOCATION`;

    const energyRows = f.energyBreakdown.map(e => `<tr>
        ${td(escapeHtml(e.type), { first: true, bold: true })}
        ${td(`${escapeHtml(e.quantity)} ${escapeHtml(e.unit)}`, { align: 'right' })}
        ${td(escapeHtml(e.emissions), { align: 'right' })}
        ${td(escapeHtml(e.scope), { last: true, dim: true })}
      </tr>`).join('');

    const metaBits = [
      `ATTRIBUTION · ${escapeHtml(f.attributionRatio)}`,
      `PRODUCTION VOLUME · ${f.productionVolume.toLocaleString('en-GB')} UNITS`,
      f.gridEmissionFactor ? `GRID FACTOR · ${escapeHtml(f.gridEmissionFactor)} KG CO₂E/KWH` : '',
      f.electricityKwh ? `ELECTRICITY · ${escapeHtml(f.electricityKwh)} KWH (ATTRIBUTED)` : '',
    ].filter(Boolean).join('&nbsp;&nbsp;·&nbsp;&nbsp;');

    // Archetype/proxy declaration per ISO 14044 §4.2.3.6 (kept from the
    // data-collection-mode disclosure; the design's data used primary only).
    const proxyBlock = f.dataCollectionMode && f.dataCollectionMode !== 'primary'
      ? `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:14px 18px;margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${DIM}">DATA COLLECTION · ${f.dataCollectionMode === 'archetype_proxy' ? 'ARCHETYPE PROXY' : 'HYBRID'}</div>
            ${toneChip('DISCLOSED', 'attention')}
          </div>
          ${bodyP([f.archetypeName ? `Archetype: ${escapeHtml(f.archetypeName)}.` : '', f.proxyJustification ? escapeHtml(f.proxyJustification) : '', f.proxyUncertaintyPct != null ? `Estimated uncertainty ±${f.proxyUncertaintyPct}%.` : '', f.proxySourceCitation ? escapeHtml(f.proxySourceCitation) : ''].filter(Boolean).join(' '), { size: 11, mt: 8 })}
        </div>`
      : '';

    return page(`
      ${band('05c', `Processing &amp; Manufacturing${pd.facilities.length > 1 ? ` (${idx + 1}/${pd.facilities.length})` : ''}`, 'PROCESSING EMISSIONS', FOREST)}
      ${summaryCards}
      <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline;padding:12px 0;border-bottom:1px solid ${HAIR};margin-top:20px">
        <div style="font-family:${INTER};font-size:13px;font-weight:600;color:${INK}">${escapeHtml(f.name)}${f.countryCode ? ` (${escapeHtml(f.countryCode)})` : ''}</div>
        <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.1em;color:${DIM}">${attributionMeta}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;margin-top:18px">
        <div>
          <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:${DIM}">${scopeLabel}</div>
          <div style="font-family:${SG};font-size:22px;font-weight:700;color:${INK};margin-top:6px;font-variant-numeric:tabular-nums">${escapeHtml(f.totalEmissions)}</div>
          <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:${DIM};margin-top:2px">KG CO₂E/UNIT</div>
        </div>
        <div>
          <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:${DIM}">COMBUSTION</div>
          <div style="font-family:${SG};font-size:22px;font-weight:700;color:${INK};margin-top:6px;font-variant-numeric:tabular-nums">${escapeHtml(f.scope1Emissions)}</div>
          <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:${DIM};margin-top:2px">KG CO₂E/UNIT</div>
        </div>
        <div>
          <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:${DIM}">ELECTRICITY</div>
          <div style="font-family:${SG};font-size:22px;font-weight:700;color:${INK};margin-top:6px;font-variant-numeric:tabular-nums">${escapeHtml(f.scope2Emissions)}</div>
          <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:${DIM};margin-top:2px">KG CO₂E/UNIT</div>
        </div>
      </div>
      ${f.isContractManufacturer ? bodyP('All emissions from this contract manufacturer are classified as Scope 3 Category 1 (Purchased Goods and Services) in the product footprint. The combustion/electricity split shows the emission source at the facility level.', { size: 12, mt: 14 }) : ''}
      ${f.energyBreakdown.length ? `<table style="width:100%;border-collapse:collapse;margin-top:16px">
        <thead><tr>
          ${th('Energy Source', { first: true })}
          ${th('Quantity', { align: 'right' })}
          ${th('Emissions (kg CO₂e)', { align: 'right' })}
          ${th('Source', { last: true })}
        </tr></thead>
        <tbody>${energyRows}</tbody>
      </table>` : ''}
      <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:10px;line-height:1.8">${metaBits}</div>
      ${proxyBlock}
      ${isFirst ? `<div style="margin-top:18px">
        ${cardTitle('Methodology')}
        ${bodyP('Processing emissions are allocated to the product using physical allocation by production volume (ISO 14044 Clause 4.3.4). Scope 1 factors from DEFRA GHG Conversion Factors; Scope 2 electricity from IEA/DEFRA country&#8209;specific grid emission factors. Contract manufacturer emissions are classified as Scope 3 Category 1 (Purchased Goods and Services) per GHG Protocol Product Standard §6.3.3. Owned facility emissions are classified as Scope 1 (direct combustion) and Scope 2 (purchased electricity/heat).', { size: 12 })}
      </div>` : ''}
    `);
  });
}

// ============================================================================
// 06 · DETAILED GHG REPORTING
// ============================================================================

function renderGhgDetailedPage(data: LCAReportData): string {
  const g = data.ghgDetailed;

  const heroFact = (label: string, value: string) => `<div>
      <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:rgba(242,241,234,.75)">${label}</div>
      <div style="font-family:${SG};font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:8px;font-variant-numeric:tabular-nums">${value}</div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:rgba(242,241,234,.75);margin-top:2px">KG CO₂E</div>
    </div>`;

  const speciesRow = (species: string, mass: string, co2e: string, gwp: string) => `<tr>
      ${td(species, { first: true, bold: true })}
      ${td(mass, { align: 'right', dim: mass === '·' })}
      ${td(co2e, { align: 'right' })}
      ${td(gwp, { align: 'right', last: true, dim: true })}
    </tr>`;

  const gwpFor = (gas: string) => g.gwpFactors.find(f => f.gas.toLowerCase().includes(gas))?.gwp100 ?? '';

  const totalRow = (label: string, value: string, color: string, border: string) => `<tr>
      <td style="font-family:${SG};font-size:12px;font-weight:700;color:${color};padding:9px 8px 9px 0;border-bottom:${border}">${label}</td>
      <td style="border-bottom:${border}"></td>
      <td style="font-family:${SG};font-size:12px;font-weight:700;color:${color};padding:9px 8px;border-bottom:${border};text-align:right;font-variant-numeric:tabular-nums">${value}</td>
      <td style="border-bottom:${border}"></td>
    </tr>`;

  return page(`
    ${heroBand('06', 'Detailed GHG Reporting', 'ISO 14067:2018 · GREENHOUSE GAS BREAKDOWN', FOREST, `
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;border-top:1px solid rgba(242,241,234,.3);padding-top:16px;margin-top:18px">
        ${heroFact('FOSSIL CO₂', escapeHtml(g.fossilCo2))}
        ${heroFact('BIOGENIC CO₂', escapeHtml(g.biogenicCo2))}
        ${heroFact('LULUC CO₂', escapeHtml(g.dlucCo2))}
      </div>
    `)}
    <table style="width:100%;border-collapse:collapse;margin-top:20px">
      <thead><tr>
        ${th('GHG Species', { first: true })}
        ${th('Mass (kg)', { align: 'right' })}
        ${th('CO₂e (kg)', { align: 'right' })}
        ${th('GWP-100', { align: 'right', last: true })}
      </tr></thead>
      <tbody>
        ${speciesRow('CO₂ (fossil)', escapeHtml(g.fossilCo2), escapeHtml(g.fossilCo2), '1')}
        ${speciesRow('CO₂ (biogenic)', escapeHtml(g.biogenicCo2), escapeHtml(g.biogenicCo2), '1*')}
        ${speciesRow('CO₂ (LULUC)', escapeHtml(g.dlucCo2), escapeHtml(g.dlucCo2), '1')}
        ${speciesRow('CH₄ (fossil)', escapeHtml(g.ch4Fossil), escapeHtml(g.ch4FossilKgCo2e), escapeHtml(gwpFor('fossil') || '29.8'))}
        ${speciesRow('CH₄ (biogenic)', escapeHtml(g.ch4Biogenic), escapeHtml(g.ch4BiogenicKgCo2e), escapeHtml(gwpFor('biogenic') || '27.0'))}
        ${speciesRow('N₂O', escapeHtml(g.n2o), escapeHtml(g.n2oKgCo2e), escapeHtml(gwpFor('n₂o') || gwpFor('n2o') || '273'))}
        ${speciesRow('HFCs / PFCs', '·', escapeHtml(g.hfcPfc), 'Variable')}
        ${totalRow('Total GWP&#8209;100 (all species)', escapeHtml(g.totalGwp100), INK, `1px solid ${INK}`)}
        ${g.fossilOnlyTotal ? totalRow('Fossil Carbon Footprint (excl. biogenic)', escapeHtml(g.fossilOnlyTotal), FOREST, `1px solid ${HAIR}`) : ''}
      </tbody>
    </table>
    <div style="margin-top:18px">
      ${cardTitle('Biogenic Carbon Note', 'ISO 14067:2018')}
      ${bodyP(escapeHtml(g.biogenicNote), { size: 11 })}
      <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:${DIM};margin-top:10px">GWP METHOD · ${escapeHtml(g.gwpMethod)}</div>
      ${bodyP('* Per ISO 14067:2018 §6.4.9.3, biogenic CO₂ is characterised at GWP=1 for the species inventory but reported separately from the fossil carbon footprint. The net biogenic carbon balance (uptake minus end&#8209;of&#8209;life release) is excluded from the headline fossil footprint figure.', { size: 10.5 })}
    </div>
  `);
}

// ============================================================================
// 07 · ENVIRONMENTAL IMPACT CATEGORIES (3 category cards per page)
// ============================================================================

function renderEnvironmentalImpactsPages(data: LCAReportData): string[] {
  const { categories, referenceMethod } = data.environmentalImpacts;
  if (!categories.length) return [];
  const pages: string[] = [];
  const perPage = 3;

  const categoryCard = (cat: LCAReportData['environmentalImpacts']['categories'][number]) => {
    const contributors = cat.topContributors.slice(0, 3).map(c => {
      const pct = parseFloat(c.percentage) || 0;
      return `<div style="display:grid;grid-template-columns:150px 1fr 52px;gap:12px;align-items:center">
        <div style="font-family:${INTER};font-size:11px;color:${INK};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.name)}</div>
        ${meter(pct, BRICK, { track: PAPER, mt: 0 })}
        <div style="font-family:${MONO};font-size:9.5px;color:${DIM};text-align:right">${escapeHtml(c.percentage)}%</div>
      </div>`;
    }).join('');

    return `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:16px">
        <div style="font-family:${SG};font-size:15px;font-weight:600;color:${INK}">${escapeHtml(cat.name)}</div>
        <div style="font-family:${SG};font-size:18px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums">${escapeHtml(cat.totalValue)} <span style="font-family:${MONO};font-size:9px;font-weight:500;letter-spacing:.1em;color:${DIM}">${escapeHtml(cat.unit).toUpperCase()}</span></div>
      </div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${DIM};margin-top:2px">${escapeHtml(cat.indicator)}</div>
      ${bodyP(escapeHtml(cat.description), { size: 11.5, mt: 10 })}
      ${contributors ? `<div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:${DIM};margin-top:12px">TOP CONTRIBUTORS</div>
      <div style="display:grid;gap:7px;margin-top:8px">${contributors}</div>` : ''}
    </div>`;
  };

  for (let i = 0; i < categories.length; i += perPage) {
    const chunk = categories.slice(i, i + perPage);
    const first = i === 0;
    pages.push(page(`
      ${band('07', 'Environmental Impact Categories', first ? 'ISO 14044:2006 §4.4 · LCIA' : 'CONTINUED', BRICK)}
      ${first ? bodyP(`<span style="font-weight:600;color:${INK}">Method: ${escapeHtml(referenceMethod)}.</span> Impact category results are presented at the midpoint (characterisation) level without normalisation or weighting, in compliance with ISO 14044 Clause 4.4.3.4 requirements for public reporting.`, { size: 12, mt: 18 }) : ''}
      <div style="display:grid;gap:14px;margin-top:${first ? 18 : 22}px">
        ${chunk.map(categoryCard).join('')}
      </div>
    `));
  }

  return pages;
}

// ============================================================================
// 08 · INGREDIENT IMPACT BREAKDOWN (chunked table)
// ============================================================================

function renderIngredientBreakdownPages(data: LCAReportData): string[] {
  const ib = data.ingredientBreakdown;
  if (!ib.ingredients.length) return [];
  const pages: string[] = [];
  const perPage = 8;

  const ingredientRow = (ing: LCAReportData['ingredientBreakdown']['ingredients'][number]) => {
    const provenance = ing.isProxy
      ? `<div style="font-family:${MONO};font-size:8.5px;line-height:1.5;letter-spacing:.02em;color:${ATTN};margin-top:3px;text-transform:uppercase">↳ PROXY: ${escapeHtml(ing.calculationFactor)} · ${escapeHtml(ing.factorDatabase)}</div>`
      : `<div style="font-family:${MONO};font-size:8.5px;line-height:1.5;letter-spacing:.02em;color:${DIM};margin-top:3px;text-transform:uppercase">${escapeHtml(ing.factorDatabase)}</div>`;

    const transportLine = ing.transportCO2
      ? `<div style="font-family:${MONO};font-size:8px;color:${DIM};margin-top:2px;text-transform:uppercase">INCL. ${escapeHtml(ing.transportCO2)} TRANSPORT${ing.transportMode ? ` · ${escapeHtml(ing.transportMode)}` : ''}${ing.transportDistance ? ` · ${escapeHtml(ing.transportDistance)} KM` : ''}</div>`
      : '';
    const containerLine = ing.containerCO2
      ? `<div style="font-family:${MONO};font-size:8px;color:${DIM};margin-top:2px;text-transform:uppercase">INCL. ${escapeHtml(ing.containerCO2)} CONTAINER${ing.containerType ? ` · ${escapeHtml(ing.containerType)}` : ''}</div>`
      : '';
    const warningLine = ing.transportWarning
      ? `<div style="font-family:${MONO};font-size:8px;color:${ATTN};margin-top:2px;text-transform:uppercase">⚠ ${escapeHtml(ing.transportWarning)}</div>`
      : '';

    const pctNum = parseFloat(ing.climatePercentage) || 0;
    const pctBold = pctNum >= 15;

    return `<tr>
      <td style="font-family:${INTER};font-size:11px;color:${INK};padding:8px 6px 8px 0;border-bottom:1px solid ${HAIR};vertical-align:top"><div style="font-weight:600">${escapeHtml(ing.name)}</div>${provenance}</td>
      <td style="font-family:${INTER};font-size:11px;color:${INK};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(ing.quantity)} ${escapeHtml(ing.unit)}</td>
      <td style="font-family:${INTER};font-size:11px;color:${DIM};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top">${escapeHtml(ing.origin)}</td>
      <td style="font-family:${INTER};font-size:11px;color:${INK};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums"><div style="font-weight:600">${escapeHtml(ing.climateImpact)}</div>${transportLine}${containerLine}${warningLine}</td>
      <td style="font-family:${INTER};font-size:11px;${pctBold ? 'font-weight:700;' : ''}color:${INK};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(ing.climatePercentage)}%</td>
      <td style="font-family:${INTER};font-size:10.5px;color:${DIM};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(ing.acidification)}</td>
      <td style="font-family:${INTER};font-size:10.5px;color:${DIM};padding:8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(ing.eutrophication)}</td>
      <td style="padding:8px 0 8px 6px;border-bottom:1px solid ${HAIR};vertical-align:top">
        <div>${toneChip(escapeHtml(ing.dataQualityGrade), gradeTone(ing.dataQualityGrade), 9)}</div>
        <div style="font-family:${MONO};font-size:8.5px;color:${DIM};margin-top:2px;text-transform:uppercase">${escapeHtml(ing.dataSource)} · ${ing.confidenceScore}%</div>
      </td>
    </tr>`;
  };

  const tableHead = `<thead><tr>
      ${th('Ingredient / Calc. Factor', { first: true, size: 8.5 })}
      ${th('Qty', { align: 'right', size: 8.5 })}
      ${th('Origin', { size: 8.5 })}
      ${th('GWP (kg CO₂e)', { align: 'right', size: 8.5 })}
      ${th('% Climate', { align: 'right', size: 8.5 })}
      ${th('Acid. (SO₂-eq)', { align: 'right', size: 8.5 })}
      ${th('Eutroph. (P-eq)', { align: 'right', size: 8.5 })}
      ${th('Source / Quality', { last: true, size: 8.5 })}
    </tr></thead>`;

  // The GWP column shows material-production impacts; the difference between
  // their sum and the product total is the non-material stages, restated as an
  // explicit row so the table reconciles with the headline.
  const materialSum = ib.ingredients.reduce((sum, ing) => sum + (parseFloat(ing.climateImpact) || 0), 0);
  const total = parseFloat(ib.totalClimateImpact) || 0;
  const otherStages = Math.max(0, total - materialSum);
  const otherPct = total > 0 ? (otherStages / total) * 100 : 0;
  const coveragePct = total > 0 ? (materialSum / total) * 100 : 0;

  const otherStagesRow = otherStages > 0.0005 ? `<tr>
      <td style="font-family:${INTER};font-size:11px;color:${INK};padding:9px 6px 9px 0;border-bottom:1px solid ${HAIR};vertical-align:top"><div style="font-weight:600">Other lifecycle stages</div><div style="font-family:${MONO};font-size:8.5px;line-height:1.5;color:${DIM};margin-top:3px">INBOUND TRANSPORT, PROCESSING, DISTRIBUTION, USE &amp; END-OF-LIFE</div></td>
      <td style="border-bottom:1px solid ${HAIR}"></td>
      <td style="border-bottom:1px solid ${HAIR}"></td>
      <td style="font-family:${INTER};font-size:11px;font-weight:600;color:${INK};padding:9px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${otherStages.toFixed(4)}</td>
      <td style="font-family:${INTER};font-size:11px;font-weight:700;color:${INK};padding:9px 6px;border-bottom:1px solid ${HAIR};vertical-align:top;text-align:right;font-variant-numeric:tabular-nums">${otherPct.toFixed(1)}%</td>
      <td style="border-bottom:1px solid ${HAIR}"></td>
      <td style="border-bottom:1px solid ${HAIR}"></td>
      <td style="border-bottom:1px solid ${HAIR}"></td>
    </tr>` : '';

  const totalRow = `<tr>
      <td style="font-family:${SG};font-size:12.5px;font-weight:700;color:${BRICK};padding:10px 6px 10px 0;border-bottom:1.5px solid ${BRICK}">Total carbon footprint</td>
      <td style="border-bottom:1.5px solid ${BRICK}"></td>
      <td style="border-bottom:1.5px solid ${BRICK}"></td>
      <td style="font-family:${SG};font-size:12.5px;font-weight:700;color:${BRICK};padding:10px 6px;border-bottom:1.5px solid ${BRICK};text-align:right;font-variant-numeric:tabular-nums">${escapeHtml(ib.totalClimateImpact)}</td>
      <td style="font-family:${SG};font-size:12.5px;font-weight:700;color:${BRICK};padding:10px 6px;border-bottom:1.5px solid ${BRICK};text-align:right;font-variant-numeric:tabular-nums">100%</td>
      <td style="border-bottom:1.5px solid ${BRICK}"></td>
      <td style="border-bottom:1.5px solid ${BRICK}"></td>
      <td style="border-bottom:1.5px solid ${BRICK}"></td>
    </tr>`;

  for (let i = 0; i < ib.ingredients.length; i += perPage) {
    const chunk = ib.ingredients.slice(i, i + perPage);
    const first = i === 0;
    const last = i + perPage >= ib.ingredients.length;

    const intro = first ? `
      ${bodyP('The GWP (kg CO₂e) column shows each ingredient&rsquo;s material production impact. Inbound transport is itemised separately on a sub&#8209;line beneath the ingredient where present, and is included in the product total. The most significant ingredients shown here are restated in the Interpretation hotspots (Section 13) using these same production figures.', { size: 11.5, mt: 16 })}
      ${ib.hasProxies ? bodyP(`${toneChip('PROXY FACTORS IN USE', 'attention')} · One or more ingredients are calculated using the closest matching dataset from ecoinvent, AGRIBALYSE, or DEFRA. The actual ingredient name is shown first; the proxy factor and database are shown beneath it. All proxy selections are documented per ISO 14044 §4.2.3.6.3.`, { size: 11.5 }) : ''}` : '';

    const coverage = last ? bodyP(`<span style="font-weight:600;color:${INK}">Coverage:</span> the ingredients and packaging listed above are material&#8209;production impacts and account for ${coveragePct.toFixed(1)}% of the ${escapeHtml(ib.totalClimateImpact)} kg CO₂e total per functional unit.${otherStages > 0.0005 ? ` The remaining ${otherPct.toFixed(1)}% comes from inbound transport and the non&#8209;material lifecycle stages (processing, distribution, use and end&#8209;of&#8209;life), shown in the &ldquo;Other lifecycle stages&rdquo; row and detailed in Sections 05 to 07.` : ''} Acidification values in kg SO₂&#8209;eq (terrestrial); eutrophication in kg P&#8209;eq (freshwater); values below detection shown as 0.000e+0. Proxy factors are used where a direct dataset match was not available (see the Data Quality section).`, { size: 10.5, mt: 12 }) : '';

    pages.push(page(`
      ${band('08', 'Ingredient Impact Breakdown', first ? 'PER-INGREDIENT CONTRIBUTION · REAL INGREDIENT &amp; CALCULATION FACTOR' : 'CONTINUED', BRICK)}
      ${intro}
      <table style="width:100%;border-collapse:collapse;margin-top:${first ? 14 : 20}px">
        ${tableHead}
        <tbody>
          ${chunk.map(ingredientRow).join('')}
          ${last ? otherStagesRow + totalRow : ''}
        </tbody>
      </table>
      ${coverage}
    `));
  }

  return pages;
}

// ============================================================================
// 09 · WATER FOOTPRINT
// ============================================================================

function renderWaterPages(data: LCAReportData): string[] {
  const w = data.waterFootprint;
  const pages: string[] = [];
  const perPage = 15;

  const heroFact = (label: string, value: string, unit: string) => `<div>
      <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:rgba(242,241,234,.75)">${label}</div>
      <div style="font-family:${SG};font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:8px;font-variant-numeric:tabular-nums">${value}</div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:rgba(242,241,234,.75);margin-top:2px">${unit}</div>
    </div>`;

  const riskTone = (risk: string): 'good' | 'attention' | 'stale' => {
    const r = risk.toUpperCase();
    if (r.includes('HIGH')) return 'stale';
    if (r.includes('MED')) return 'attention';
    return 'good';
  };

  const chunks: Array<typeof w.sources> = [];
  for (let i = 0; i < w.sources.length; i += perPage) chunks.push(w.sources.slice(i, i + perPage));
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, idx) => {
    const first = idx === 0;
    const rows = chunk.map(s => `<tr>
        ${td(escapeHtml(s.source), { first: true })}
        ${td(escapeHtml(s.location), { dim: true })}
        ${td(escapeHtml(s.volume), { align: 'right' })}
        ${td(toneChip(escapeHtml(s.risk), riskTone(s.risk)), { align: 'right', last: true })}
      </tr>`).join('');

    pages.push(page(`
      ${first ? heroBand('09', 'Water Footprint', 'ISO 14046:2014 · AWARE', BRICK, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid rgba(242,241,234,.3);padding-top:16px;margin-top:18px">
          ${heroFact('TOTAL CONSUMPTION', `${escapeHtml(w.totalConsumption)} L`, 'LITRES')}
          ${heroFact('SCARCITY-WEIGHTED', `${escapeHtml(w.scarcityWeighted)} L eq.`, 'LITRES EQ.')}
        </div>
      `) : band('09', 'Water Footprint, Sources', 'CONTINUED', BRICK)}
      ${chunk.length ? `<div style="margin-top:20px">
        ${cardTitle('Water Sources')}
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          <thead><tr>
            ${th('Source', { first: true })}
            ${th('Location')}
            ${th('Volume', { align: 'right' })}
            ${th('Risk Level', { align: 'right', last: true })}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : ''}
    `));
  });

  return pages;
}

// ============================================================================
// 10 · CIRCULARITY & WASTE
// ============================================================================

function renderCircularityPages(data: LCAReportData): string[] {
  const c = data.circularity;
  const pages: string[] = [];
  const perPage = 9;

  const progressBlock = (title: string, pct: number, sub: string) => `<div>
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK}">${title}</div>
        <div style="font-family:${SG};font-size:26px;font-weight:700;color:${INK};font-variant-numeric:tabular-nums">${pct}%</div>
      </div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:${DIM};margin-top:2px">${sub}</div>
      ${meter(pct, BRICK)}
    </div>`;

  const eol = data.eolMethodology;
  const gross = eol ? eol.totalGrossEmissions : c.eolBreakdown.reduce((s, m) => s + m.grossEmissions, 0);
  const avoided = eol ? eol.totalAvoidedEmissions : c.eolBreakdown.reduce((s, m) => s + m.avoidedEmissions, 0);
  const net = eol ? eol.totalNetEmissions : c.eolBreakdown.reduce((s, m) => s + m.netEmissions, 0);

  const pathwayRow = (m: LCAReportData['circularity']['eolBreakdown'][number]) => `<tr>
      ${td(escapeHtml(m.material), { first: true })}
      ${td(`${m.massKg.toFixed(3)} kg`, { align: 'right' })}
      ${td(`${Math.round(m.recyclingPct)}%`, { align: 'right' })}
      ${td(`${Math.round(m.landfillPct)}%`, { align: 'right', dim: true })}
      ${td(`${Math.round(m.incinerationPct)}%`, { align: 'right', dim: true })}
      ${td(`${Math.round(m.compostingPct)}%`, { align: 'right', dim: true })}
      ${td(`${Math.round(m.adPct)}%`, { align: 'right', dim: true })}
      ${td(m.netEmissions.toFixed(4), { align: 'right', last: true })}
    </tr>`;

  const chunks: Array<typeof c.eolBreakdown> = [];
  for (let i = 0; i < c.eolBreakdown.length; i += perPage) chunks.push(c.eolBreakdown.slice(i, i + perPage));
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, idx) => {
    const first = idx === 0;
    const head = first ? `
      ${band('10', 'Circularity &amp; Waste', 'MATERIAL CIRCULARITY', BRICK)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:22px">
        ${progressBlock('Recycled Content', Math.round(c.recycledContentRate), 'INPUT · RECYCLED MATERIAL USED')}
        ${progressBlock('EoL Recycling Rate', Math.round(c.eolRecyclingRate), 'OUTPUT · PACKAGING RECYCLED AT DISPOSAL')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:22px">
        ${statCard('Packaging waste', `${escapeHtml(c.totalWaste)}`, undefined, { size: 20, pad: 14 })}
        ${statCard('Circularity score', escapeHtml(c.circularityScore), undefined, { size: 20, pad: 14, valueColor: BRICK })}
        ${statCard('Gross EoL emissions', gross.toFixed(4), 'KG CO₂E', { size: 20, pad: 14 })}
        ${statCard('Recycling credits', avoided.toFixed(4), 'KG CO₂E (AVOIDED)', { size: 20, pad: 14 })}
        ${statCard('Net EoL impact', net.toFixed(4), 'KG CO₂E', { size: 20, pad: 14 })}
      </div>` : band('10', 'Circularity, Disposal Pathways', 'CONTINUED', BRICK);

    const isLastChunk = idx === chunks.length - 1;
    pages.push(page(`
      ${head}
      ${chunk.length ? `<div style="margin-top:20px">
        ${cardTitle('Per&#8209;Material Disposal Pathways')}
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          <thead><tr>
            ${th('Material', { first: true })}
            ${th('Mass', { align: 'right' })}
            ${th('Recycle', { align: 'right' })}
            ${th('Landfill', { align: 'right' })}
            ${th('Incin.', { align: 'right' })}
            ${th('Compost', { align: 'right' })}
            ${th('AD', { align: 'right' })}
            ${th('Net (kg CO₂e)', { align: 'right', last: true })}
          </tr></thead>
          <tbody>${chunk.map(pathwayRow).join('')}</tbody>
        </table>
      </div>` : ''}
      ${isLastChunk ? bodyP(`<span style="font-weight:600;color:${INK}">Note:</span> Recycled Content measures circular input (recycled material used in production). EoL Recycling Rate measures circular output (packaging recycled at end&#8209;of&#8209;life, based on regional defaults). These are independent metrics per ISO 14044 §4.4.5. ${escapeHtml(data.circularityMethodology?.reference || 'Adapted from: Ellen MacArthur Foundation, Material Circularity Indicator (2015).')}`, { size: 10.5, mt: 12 }) : ''}
    `));
  });

  return pages;
}

// ============================================================================
// 11 · LAND USE
// ============================================================================

function renderLandUsePages(data: LCAReportData): string[] {
  const lu = data.landUse;
  const pages: string[] = [];
  const perPage = 13;

  const rows = (chunk: typeof lu.breakdown) => chunk.map(m => `<tr>
      ${td(escapeHtml(m.material), { first: true })}
      ${td(escapeHtml(m.origin), { dim: true })}
      ${td(escapeHtml(m.mass), { align: 'right' })}
      ${td(m.intensity.toFixed(2), { align: 'right', dim: true })}
      ${td(escapeHtml(m.footprint), { align: 'right', bold: true, last: true })}
    </tr>`).join('');

  const chunks: Array<typeof lu.breakdown> = [];
  for (let i = 0; i < lu.breakdown.length; i += perPage) chunks.push(lu.breakdown.slice(i, i + perPage));
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, idx) => {
    const first = idx === 0;
    pages.push(page(`
      ${first ? heroBand('11', 'Land Use', 'SOIL QUALITY INDEX', BRICK, `
        <div style="font-family:${SG};font-size:52px;font-weight:700;line-height:.95;letter-spacing:-.035em;font-variant-numeric:tabular-nums;margin-top:20px">${escapeHtml(lu.totalLandUse)}</div>
        <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:rgba(242,241,234,.75);margin-top:10px">TOTAL LAND USE · M² PER YEAR</div>
      `) : band('11', 'Land Use, Materials', 'CONTINUED', BRICK)}
      ${chunk.length ? `<div style="margin-top:20px">
        ${cardTitle('Material Breakdown')}
        <table style="width:100%;border-collapse:collapse;margin-top:10px">
          <thead><tr>
            ${th('Material', { first: true })}
            ${th('Origin')}
            ${th('Mass', { align: 'right' })}
            ${th('Intensity', { align: 'right' })}
            ${th('Footprint', { align: 'right', last: true })}
          </tr></thead>
          <tbody>${rows(chunk)}</tbody>
        </table>
      </div>` : ''}
    `));
  });

  return pages;
}

// ============================================================================
// 12 · SUPPLY CHAIN (supplier cards, 2-col grid)
// ============================================================================

function renderSupplyChainPages(data: LCAReportData): string[] {
  const sc = data.supplyChain;
  const suppliers = sc.network.flatMap(group => group.items);
  const pages: string[] = [];
  const perPage = 12;

  const supplierCard = (item: (typeof suppliers)[number]) => `<div style="border:1px solid ${HAIR};border-radius:6px;padding:13px 16px">
      <div style="font-family:${INTER};font-size:12px;font-weight:600;color:${INK}">${escapeHtml(item.name)}</div>
      <div style="font-family:${INTER};font-size:11px;color:${DIM};margin-top:2px">${escapeHtml(item.location)}</div>
      <div style="display:flex;justify-content:space-between;margin-top:9px;border-top:1px solid ${HAIR};padding-top:8px">
        <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:${item.warning ? ATTN : DIM}">${item.mode ? `${escapeHtml(item.mode)} · ` : ''}${escapeHtml(item.distance)}${item.warning ? ' ⚠' : ''}</div>
        <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${INK}">${escapeHtml(item.co2)} KG CO₂E</div>
      </div>
    </div>`;

  const heroFact = (label: string, value: string) => `<div>
      <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:rgba(242,241,234,.75)">${label}</div>
      <div style="font-family:${SG};font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:8px;font-variant-numeric:tabular-nums">${value}</div>
    </div>`;

  const chunks: Array<typeof suppliers> = [];
  for (let i = 0; i < suppliers.length; i += perPage) chunks.push(suppliers.slice(i, i + perPage));
  if (chunks.length === 0) chunks.push([]);

  chunks.forEach((chunk, idx) => {
    const first = idx === 0;
    pages.push(page(`
      ${first ? heroBand('12', 'Supply Chain', 'MATERIAL SUPPLIERS · INBOUND TRANSPORT', COBALT, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid rgba(242,241,234,.3);padding-top:16px;margin-top:18px">
          ${heroFact('TOTAL DISTANCE', escapeHtml(sc.totalDistance))}
          ${heroFact('VERIFIED SUPPLIERS', escapeHtml(sc.verifiedSuppliers))}
        </div>
      `) : band('12', 'Supply Chain, Suppliers', 'CONTINUED', COBALT)}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px">
        ${chunk.map(supplierCard).join('')}
      </div>
    `));
  });

  return pages;
}

// ============================================================================
// 13 · INTERPRETATION (ISO 14044 §4.5 — two pages)
// ============================================================================

function renderInterpretationPages(data: LCAReportData): string[] {
  const interp = data.interpretation;
  if (!interp) return [];
  const pages: string[] = [];
  const si = interp.significant_issues;

  const hotspotRows = si.hotspots.slice(0, 6).map(h => `<tr>
      ${td(escapeHtml(h.name), { first: true, bold: true })}
      ${td(h.impact_kg_co2e.toFixed(4), { align: 'right' })}
      ${td(`<span style="font-weight:700">${h.contribution_pct.toFixed(1)}%</span>`, { align: 'right', last: true })}
    </tr>`).join('');

  pages.push(page(`
    ${band('13', 'Interpretation', 'ISO 14044 §4.5', INK)}
    <div style="margin-top:20px">
      ${cardTitle('Significant Issues')}
      ${bodyP(escapeHtml(si.summary), { color: INK })}
      ${si.hotspots.length ? `<table style="width:100%;border-collapse:collapse;margin-top:14px">
        <thead><tr>
          ${th('Material', { first: true })}
          ${th('GWP (kg CO₂e)', { align: 'right' })}
          ${th('Contribution', { align: 'right', last: true })}
        </tr></thead>
        <tbody>${hotspotRows}</tbody>
      </table>
      ${bodyP('Hotspots restate the most significant ingredients from Section 08 using the same material&#8209;production GWP and contribution share, so the two sections reconcile. Inbound transport is itemised separately in Section 08 and is included in the product total.', { size: 10.5, mt: 10 })}` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:20px">
      ${statCard('Dominant stage', escapeHtml(si.dominant_lifecycle_stage), `${si.dominant_stage_pct}% OF TOTAL`, { size: 22, pad: 18 })}
      ${statCard('Dominant scope', escapeHtml(si.dominant_scope), `${si.dominant_scope_pct}% OF TOTAL`, { size: 22, pad: 18 })}
    </div>
    <div style="margin-top:20px">
      <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:8px">Key Findings</div>
      <div style="display:grid;gap:8px">
        ${interp.conclusions.key_findings.map(f => bullet(escapeHtml(f), { color: INK })).join('')}
      </div>
    </div>
  `));

  const recRow = (num: string, text: string) => `<div style="display:flex;gap:20px;padding:11px 0;border-bottom:1px solid ${HAIR}">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.14em;color:${INK};width:32px;flex:none">${num}</div>
      <div style="font-family:${INTER};font-size:12.5px;line-height:1.5;color:${INK}">${text}</div>
    </div>`;

  const evaluationNotes: string[] = [];
  const ev = interp.evaluation;
  if (ev.completeness && !ev.completeness.is_complete) {
    evaluationNotes.push(`Completeness: ${ev.completeness.coverage_pct}% boundary coverage.${ev.completeness.missing_stages.length ? ` Missing stages: ${ev.completeness.missing_stages.join(', ')}.` : ''}`);
  }
  if (ev.consistency && !ev.consistency.is_consistent && ev.consistency.issues.length) {
    evaluationNotes.push(`Consistency: ${ev.consistency.issues.join('; ')}.`);
  }
  if (ev.sensitivity?.conclusion) {
    evaluationNotes.push(ev.sensitivity.conclusion);
  }

  pages.push(page(`
    ${band('13', 'Interpretation', 'ISO 14044 §4.5 · CONTINUED', INK)}
    <div style="margin-top:20px">
      <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:8px">Limitations</div>
      <div style="display:grid;gap:8px">
        ${interp.conclusions.limitations.map(l => bullet(escapeHtml(l), { color: ATTN, outline: true, textColor: INK })).join('')}
      </div>
    </div>
    ${evaluationNotes.length ? `<div style="margin-top:22px">
      <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:8px">Evaluation</div>
      <div style="display:grid;gap:8px">
        ${evaluationNotes.map(n => bullet(escapeHtml(n), { color: DIM, outline: true, textColor: INK })).join('')}
      </div>
    </div>` : ''}
    <div style="margin-top:24px">
      <div style="font-family:${SG};font-size:14px;font-weight:600;color:${INK};margin-bottom:8px">Recommendations</div>
      <div style="display:grid;gap:0">
        ${interp.conclusions.recommendations.map((r, i) => recRow(String(i + 1).padStart(2, '0'), escapeHtml(r))).join('')}
      </div>
    </div>
  `));

  return pages;
}

// ============================================================================
// 14 · UNCERTAINTY & SENSITIVITY (ISO 14044 §4.5.3)
// ============================================================================

function renderUncertaintySensitivityPage(data: LCAReportData): string {
  const us = data.uncertaintySensitivity;
  if (!us) return '';

  const heroFact = (label: string, value: string, unit: string) => `<div>
      <div style="font-family:${MONO};font-size:9px;font-weight:700;letter-spacing:.18em;color:rgba(242,241,234,.75)">${label}</div>
      <div style="font-family:${SG};font-size:30px;font-weight:700;letter-spacing:-.02em;margin-top:8px;font-variant-numeric:tabular-nums">${value}</div>
      <div style="font-family:${MONO};font-size:9px;letter-spacing:.1em;color:rgba(242,241,234,.75);margin-top:2px">${unit}</div>
    </div>`;

  const paramRows = us.sensitivityAnalysis.parameters.slice(0, 8).map(p => `<tr>
      ${td(escapeHtml(p.materialName), { first: true, bold: true })}
      ${td(`${p.baselineContributionPct.toFixed(1)}%`, { align: 'right' })}
      ${td(`${escapeHtml(p.resultRange.lower)} &ndash; ${escapeHtml(p.resultRange.upper)} kg CO₂e`, { align: 'right' })}
      ${td(`<span style="font-family:${INTER};font-size:11.5px;color:${INK};font-variant-numeric:tabular-nums">${p.sensitivityRatio.toFixed(3)} </span>${p.isHighlySensitive ? toneChip('HIGH', 'stale', 9) : ''}`, { align: 'right', last: true })}
    </tr>`).join('');

  return page(`
    ${heroBand('14', 'Uncertainty &amp; Sensitivity', 'ISO 14044 §4.5.3', INK, `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;border-top:1px solid rgba(242,241,234,.3);padding-top:16px;margin-top:18px">
        ${heroFact('PROPAGATED UNCERTAINTY', `±${us.propagatedUncertaintyPct}%`, '95% CONFIDENCE INTERVAL')}
        ${heroFact('RESULT RANGE (95% CI)', `${escapeHtml(us.confidenceInterval95.lower)} &ndash; ${escapeHtml(us.confidenceInterval95.upper)}`, 'KG CO₂E PER FUNCTIONAL UNIT')}
      </div>
    `)}
    <div style="margin-top:22px">
      ${cardTitle('Sensitivity Analysis', escapeHtml(us.sensitivityAnalysis.method).toUpperCase())}
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        <thead><tr>
          ${th('Material', { first: true })}
          ${th('Contribution', { align: 'right' })}
          ${th('&plusmn;20% Range', { align: 'right' })}
          ${th('Sensitivity', { align: 'right', last: true })}
        </tr></thead>
        <tbody>${paramRows}</tbody>
      </table>
    </div>
    <div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:20px">
      <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${INK}">CONCLUSION</div>
      ${bodyP(escapeHtml(us.sensitivityAnalysis.conclusion), { color: INK, size: 12, mt: 10 })}
    </div>
    ${bodyP(`<span style="font-weight:600;color:${INK}">Methodology:</span> uncertainty propagation follows the root&#8209;sum&#8209;of&#8209;squares approach for geometric standard deviation per Frischknecht et al. (2007), using the Pedigree Matrix (Weidema &amp; Wesn&aelig;s, 1996) for data quality scoring. Sensitivity analysis applies &plusmn;20% variation to emission factors of the top contributors.`, { size: 11, mt: 16 })}
  `);
}

// ============================================================================
// 15 · CRITICAL REVIEW & COMPLIANCE NOTES (ISO 14044 §6)
// ============================================================================

function renderCriticalReviewPages(data: LCAReportData): string[] {
  const cr = data.criticalReview;
  if (!cr) return [];
  const pages: string[] = [];

  const statusUpper = cr.status.toUpperCase();
  const statusTone: 'good' | 'attention' = statusUpper.includes('NOT') ? 'attention' : 'good';

  const zeroRows = (data.zeroImpactCategories || []).map(z => `<tr>
      ${td(escapeHtml(z.category), { first: true, bold: true, top: true })}
      ${td(escapeHtml(z.reason), { last: true, dim: true })}
    </tr>`).join('');

  const methodologicalNotes: string[] = [];
  if (data.lulucNote) methodologicalNotes.push(escapeHtml(data.lulucNote));
  if (data.transportNote) {
    methodologicalNotes.push(escapeHtml(data.transportNote.method));
  }
  if (data.scopeMethodology) {
    methodologicalNotes.push(escapeHtml(data.scopeMethodology.note));
  }
  if (data.circularityMethodology?.isProprietaryMetric) {
    methodologicalNotes.push(`<span style="font-weight:600;color:${INK}">Circularity Score Disclaimer:</span> ${escapeHtml(data.circularityMethodology.description)} ${escapeHtml(data.circularityMethodology.reference)}`);
  }

  const cov = data.dataQuality.coverageSummary;
  const primaryCoverage = cov.primaryCount === 0
    ? `All ${cov.totalMaterials} material/process inputs rely on secondary or proxy emission factors from databases (ecoinvent, AGRIBALYSE, DEFRA). No primary site&#8209;specific data has been collected. ISO 14044 §4.2.3.6 recommends increasing primary data coverage to improve representativeness. Collecting measured data from key suppliers (especially for the top contributors) would significantly improve data quality.`
    : `${cov.primaryCount} of ${cov.totalMaterials} material/process inputs use primary supplier data; the remainder rely on secondary or proxy emission factors from databases (ecoinvent, AGRIBALYSE, DEFRA). ISO 14044 §4.2.3.6 recommends increasing primary data coverage to improve representativeness.`;

  pages.push(page(`
    ${band('15', 'Critical Review &amp; Compliance Notes', 'ISO 14044 §6', INK)}
    <div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:20px">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${DIM}">CRITICAL REVIEW STATUS</div>
        ${toneChip(escapeHtml(statusUpper), statusTone)}
      </div>
      ${bodyP(escapeHtml(cr.disclosure), { color: INK, size: 12, mt: 10 })}
      ${bodyP(`<span style="font-weight:600;color:${INK}">Recommendation:</span> ${escapeHtml(cr.recommendation)}`, { size: 12 })}
    </div>
    ${zeroRows ? `<div style="margin-top:22px">
      ${cardTitle('Zero&#8209;Impact Categories')}
      ${bodyP('The following environmental impact categories were assessed but report zero values. Justification per ISO 14044 §4.4.2.2:', { size: 11, mt: 6 })}
      <table style="width:100%;border-collapse:collapse;margin-top:10px">
        <thead><tr>
          ${th('Category', { first: true, width: 230 })}
          ${th('Reason', { last: true })}
        </tr></thead>
        <tbody>${zeroRows}</tbody>
      </table>
    </div>` : ''}
    <div style="margin-top:20px">
      ${cardTitle('Primary Data Coverage')}
      ${bodyP(primaryCoverage, { size: 12 })}
    </div>
    ${methodologicalNotes.length ? `<div style="margin-top:20px">
      ${cardTitle('Methodological Notes')}
      ${methodologicalNotes.map(n => bodyP(n, { size: 11 })).join('')}
    </div>` : ''}
  `));

  // 15b · AI-assisted internal review (conditional, matching the design's
  // includeAiReview template prop: rendered only when the review exists).
  const ai = cr.aiReview;
  if (ai) {
    const ratingLabel = ai.rating === 'pass' ? 'PASS' : ai.rating === 'qualified_pass' ? 'PASS WITH QUALIFICATIONS' : 'NEEDS REMEDIATION';
    const ratingTone: 'good' | 'attention' | 'stale' = ai.rating === 'pass' ? 'good' : ai.rating === 'qualified_pass' ? 'attention' : 'stale';

    const findingRow = (ff: { clause: string; status: 'conforms' | 'minor_gap' | 'major_gap'; summary: string; detail?: string }) => {
      const statusLabel = ff.status === 'conforms' ? 'CONFORMS' : ff.status === 'minor_gap' ? 'MINOR GAP' : 'MAJOR GAP';
      const statusTone2: 'good' | 'attention' | 'stale' = ff.status === 'conforms' ? 'good' : ff.status === 'minor_gap' ? 'attention' : 'stale';
      return `<div style="padding:11px 0;border-bottom:1px solid ${HAIR}">
        <div style="display:flex;justify-content:space-between;gap:16px;align-items:baseline">
          <div style="font-family:${INTER};font-size:12.5px;font-weight:600;color:${INK}">${escapeHtml(ff.clause)}</div>
          <span style="flex:none">${toneChip(statusLabel, statusTone2, 9)}</span>
        </div>
        ${bodyP(escapeHtml(ff.summary) + (ff.detail ? ` ${escapeHtml(ff.detail)}` : ''), { size: 11.5, mt: 6 })}
      </div>`;
    };

    // Chunk findings if long: first page takes the verdict + up to 7 findings.
    const perPage = 7;
    for (let i = 0; i < Math.max(ai.findings.length, 1); i += perPage) {
      const chunk = ai.findings.slice(i, i + perPage);
      const first = i === 0;
      pages.push(page(`
        ${band('15b', 'AI&#8209;Assisted Internal Review', first ? 'AUTOMATED COMPLIANCE CHECK' : 'CONTINUED', INK)}
        ${first ? `<div style="background:${CREAM};border:1px solid ${HAIR};border-radius:6px;padding:18px 20px;margin-top:20px">
          <div style="display:flex;justify-content:space-between;align-items:baseline">
            <div style="font-family:${MONO};font-size:9.5px;font-weight:700;letter-spacing:.2em;color:${DIM}">OVERALL RATING</div>
            ${toneChip(ratingLabel, ratingTone)}
          </div>
          ${bodyP(escapeHtml(ai.verdict), { color: INK, size: 12, mt: 10 })}
        </div>` : ''}
        <div style="margin-top:20px">
          ${first ? cardTitle('Findings by ISO 14044 / 14067 Clause') : ''}
          <div style="margin-top:6px">${chunk.map(findingRow).join('')}</div>
        </div>
        ${i + perPage >= ai.findings.length ? bodyP(`${escapeHtml(ai.reviewerNote)} Review generated ${escapeHtml(ai.reviewDate)}. This automated check does not constitute a formal ISO 14044 §6 critical review.`, { size: 10.5, mt: 14 }) : ''}
      `));
    }
  }

  return pages;
}

// ============================================================================
// BACK COVER
// ============================================================================

function renderBackCoverPage(data: LCAReportData): string {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase();
  return page(`
    <div style="background:${FOREST};border-radius:6px;color:${CREAM};position:relative;overflow:hidden;height:100%;display:flex;flex-direction:column;justify-content:space-between;padding:48px 52px;box-sizing:border-box">
      ${leafMark(CREAM, 'position:absolute;bottom:-110px;left:-80px;width:420px;height:420px;opacity:.2')}
      <div style="font-family:${MONO};font-size:10px;font-weight:700;letter-spacing:.22em;color:${CREAM};opacity:.75;position:relative">OUR COMMITMENT</div>
      <div style="position:relative;max-width:520px">
        <div style="font-family:${SG};font-size:44px;font-weight:700;line-height:.98;letter-spacing:-.035em">Measured honestly. Improved deliberately.</div>
        <p style="font-family:${INTER};font-size:13px;line-height:1.6;opacity:.9;margin:24px 0 0">${escapeHtml(data.commitment.text)}</p>
      </div>
      <div style="position:relative;display:flex;justify-content:space-between;align-items:baseline;border-top:1px solid rgba(242,241,234,.3);padding-top:20px">
        ${wordmark(18, CREAM)}
        <div style="font-family:${MONO};font-size:9.5px;letter-spacing:.14em;opacity:.8">REPORT GENERATED BY ALKATERA · ${dateStr} · ALKATERA.COM</div>
      </div>
    </div>
  `, { footer: false });
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

/**
 * Render the full LCA report as a self-contained HTML document.
 * Sent directly to PDFShift (A4, margin 0 — the template draws its own pages).
 */
export function renderLcaReportHtml(data: LCAReportData): string {
  const pages = [
    renderCoverPage(data),
    renderExecSummaryPage(data),
    ...renderGoalAndScopePages(data),
    ...renderMethodologyPages(data),
    ...renderDataQualityPages(data),
    renderClimatePage(data),
    renderViticulturePage(data),
    ...renderProcessingPages(data),
    renderGhgDetailedPage(data),
    ...renderEnvironmentalImpactsPages(data),
    ...renderIngredientBreakdownPages(data),
    ...renderWaterPages(data),
    ...renderCircularityPages(data),
    ...renderLandUsePages(data),
    ...renderSupplyChainPages(data),
    ...renderInterpretationPages(data),
    renderUncertaintySensitivityPage(data),
    ...renderCriticalReviewPages(data),
    renderBackCoverPage(data),
  ].filter(Boolean).join('\n');

  // Defensive brand-name normalisation: older stored snapshots (e.g. the
  // critical-review disclosure persisted in aggregated_impacts) can carry the
  // legacy "AlkaTera" casing. The brand name is always lowercase "alkatera".
  const body = pages.replace(/Alka[Tt]era/g, 'alkatera');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LCA Report · ${escapeHtml(data.meta.productName)}</title>

  <!-- The studio's three voices: Bricolage Grotesque speaks, Inter explains,
       JetBrains Mono annotates. -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Bricolage+Grotesque:wght@500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: white;
      color: ${INK};
    }
    @page { size: A4; margin: 0; }
    .page {
      width: 794px;
      height: 1123px;
      position: relative;
      background: ${PAPER};
      padding: 40px 44px 64px 44px;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      body { background: white; }
      .page { box-shadow: none; margin: 0; }
    }
  </style>
</head>
<body>
  ${body}
</body>
</html>`;
}
