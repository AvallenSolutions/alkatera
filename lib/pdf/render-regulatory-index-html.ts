/**
 * Regulatory Index HTML Renderer
 *
 * A single-page PDF-ready framework coverage summary for regulatory/compliance audiences.
 * Shows which standards are addressed, which disclosures are covered, and data quality tier.
 *
 * Used by POST /api/reports/[id]/regulatory-index
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

function statusIcon(status: 'covered' | 'partial' | 'not-covered'): string {
  if (status === 'covered') return '<span style="color:#22c55e;font-size:14px;">&#10003;</span>';
  if (status === 'partial') return '<span style="color:#f59e0b;font-size:12px;">&#9711;</span>';
  return '<span style="color:#e7e5e4;font-size:12px;">&#8212;</span>';
}

// ============================================================================
// TYPES
// ============================================================================

export interface RegulatoryIndexData {
  organisationName: string;
  reportYear: number;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  standards: string[];
  sections: string[];
  dataQuality?: { qualityTier: string; completeness: number; confidenceScore: number };
  branding: { logo: string | null; primaryColor: string };
}

// ============================================================================
// COVERAGE DEFINITIONS
// ============================================================================

/** Map of standard ID -> disclosure requirements */
const STANDARD_DISCLOSURES: Record<string, Array<{ id: string; label: string; coveredBy: string[] }>> = {
  csrd: [
    { id: 'ESRS-2', label: 'ESRS 2 — General disclosures', coveredBy: ['executive-summary', 'company-overview', 'governance'] },
    { id: 'ESRS-E1-1', label: 'ESRS E1.1 — Transition plan', coveredBy: ['transition-roadmap'] },
    { id: 'ESRS-E1-4', label: 'ESRS E1.4 — GHG reduction targets', coveredBy: ['targets'] },
    { id: 'ESRS-E1-6', label: 'ESRS E1.6 — Scope 1/2/3 emissions', coveredBy: ['scope-1-2-3', 'ghg-inventory'] },
    { id: 'ESRS-E1-7', label: 'ESRS E1.7 — Carbon removals (FLAG)', coveredBy: ['flag-removals'] },
    { id: 'ESRS-E4', label: 'ESRS E4 — Biodiversity & ecosystems', coveredBy: ['tnfd-nature'] },
    { id: 'ESRS-S1', label: 'ESRS S1 — Own workforce', coveredBy: ['people-culture'] },
    { id: 'ESRS-S3', label: 'ESRS S3 — Supply chain workers', coveredBy: ['supply-chain'] },
    { id: 'ESRS-G1', label: 'ESRS G1 — Business conduct', coveredBy: ['governance'] },
  ],
  'iso-14067': [
    { id: '14067-4.1', label: 'Scope definition & system boundary', coveredBy: ['scope-1-2-3', 'methodology'] },
    { id: '14067-4.3', label: 'Life cycle inventory data', coveredBy: ['product-footprints', 'methodology'] },
    { id: '14067-4.4', label: 'Carbon footprint assessment', coveredBy: ['product-footprints', 'ghg-inventory'] },
    { id: '14067-4.6', label: 'Biogenic carbon accounting', coveredBy: ['carbon-origin'] },
    { id: '14067-4.7', label: 'CFP report', coveredBy: ['executive-summary', 'methodology', 'appendix'] },
  ],
  'iso-14064': [
    { id: '14064-4.1', label: 'Organisational boundaries', coveredBy: ['scope-1-2-3', 'methodology'] },
    { id: '14064-4.3', label: 'Source categorisation', coveredBy: ['scope-1-2-3', 'ghg-inventory'] },
    { id: '14064-4.5', label: 'Data quality assessment', coveredBy: ['methodology', 'appendix'] },
    { id: '14064-5', label: 'Uncertainty analysis', coveredBy: ['methodology', 'appendix'] },
  ],
  gri: [
    { id: 'GRI-2', label: 'GRI 2 — General disclosures', coveredBy: ['company-overview', 'governance'] },
    { id: 'GRI-305', label: 'GRI 305 — Emissions', coveredBy: ['scope-1-2-3', 'ghg-inventory'] },
    { id: 'GRI-401', label: 'GRI 401 — Employment', coveredBy: ['people-culture'] },
    { id: 'GRI-413', label: 'GRI 413 — Local communities', coveredBy: ['community-impact'] },
  ],
  tcfd: [
    { id: 'TCFD-G', label: 'Governance of climate risks', coveredBy: ['governance'] },
    { id: 'TCFD-S', label: 'Strategy — risks & opportunities', coveredBy: ['risks-and-opportunities'] },
    { id: 'TCFD-R', label: 'Risk management processes', coveredBy: ['risks-and-opportunities', 'methodology'] },
    { id: 'TCFD-M', label: 'Metrics and targets', coveredBy: ['scope-1-2-3', 'targets'] },
  ],
  'ghg-protocol': [
    { id: 'GHG-S1', label: 'Scope 1 direct emissions', coveredBy: ['scope-1-2-3'] },
    { id: 'GHG-S2', label: 'Scope 2 market/location-based', coveredBy: ['scope-1-2-3'] },
    { id: 'GHG-S3', label: 'Scope 3 value chain categories', coveredBy: ['scope-1-2-3', 'supply-chain'] },
    { id: 'GHG-Q', label: 'Data quality & uncertainty', coveredBy: ['methodology', 'appendix'] },
  ],
};

const STANDARD_LABELS: Record<string, string> = {
  csrd: 'CSRD (ESRS)',
  'iso-14067': 'ISO 14067',
  'iso-14064': 'ISO 14064',
  gri: 'GRI Standards',
  tcfd: 'TCFD',
  'ghg-protocol': 'GHG Protocol',
};

const ALKATERA_LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

// ============================================================================
// RENDERER
// ============================================================================

export function renderRegulatoryIndexHtml(data: RegulatoryIndexData): string {
  const primary = data.branding.primaryColor || '#ccff00';
  const selectedStandards = data.standards.filter(s => STANDARD_DISCLOSURES[s]);
  const sectionSet = new Set(data.sections);

  function getCoverage(coveredBy: string[]): 'covered' | 'partial' | 'not-covered' {
    const matches = coveredBy.filter(s => sectionSet.has(s));
    if (matches.length === 0) return 'not-covered';
    if (matches.length === coveredBy.length) return 'covered';
    return 'partial';
  }

  const standardBlocks = selectedStandards.map(stdId => {
    const disclosures = STANDARD_DISCLOSURES[stdId] || [];
    const covered = disclosures.filter(d => getCoverage(d.coveredBy) === 'covered').length;
    const partial = disclosures.filter(d => getCoverage(d.coveredBy) === 'partial').length;
    const total = disclosures.length;
    const coveragePct = total > 0 ? Math.round(((covered + partial * 0.5) / total) * 100) : 0;

    return `
    <div style="background: #f5f5f4; border-radius: 12px; padding: 20px; margin-bottom: 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <div style="font-size: 14px; font-weight: 600; color: #1c1917;">${escapeHtml(STANDARD_LABELS[stdId] || stdId)}</div>
          <div style="font-size: 11px; color: #78716c; margin-top: 2px;">${covered} of ${total} disclosures fully covered</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 22px; font-weight: 700; color: ${primary};">${coveragePct}%</div>
          <div style="font-size: 10px; color: #a8a29e;">coverage</div>
        </div>
      </div>
      <div style="height: 4px; background: #e7e5e4; border-radius: 2px; overflow: hidden; margin-bottom: 14px;">
        <div style="height: 100%; width: ${coveragePct}%; background: ${primary}; border-radius: 2px;"></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tbody>
          ${disclosures.map(d => {
            const cov = getCoverage(d.coveredBy);
            return `
            <tr style="border-bottom: 1px solid #e7e5e4;">
              <td style="padding: 6px 8px 6px 0; width: 20px;">${statusIcon(cov)}</td>
              <td style="padding: 6px 4px; font-family: 'Fira Code', monospace; font-size: 10px; color: #78716c; white-space: nowrap; padding-right: 12px;">${escapeHtml(d.id)}</td>
              <td style="padding: 6px 0; color: ${cov === 'not-covered' ? '#a8a29e' : '#1c1917'};">${escapeHtml(d.label)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }).join('');

  const tierLabel = data.dataQuality?.qualityTier === 'tier_1' ? 'Tier 1 (Measured)'
    : data.dataQuality?.qualityTier === 'tier_2' ? 'Tier 2 (Calculated)'
    : data.dataQuality?.qualityTier === 'tier_3' ? 'Tier 3 (Estimated)'
    : data.dataQuality?.qualityTier === 'mixed' ? 'Mixed (Tier 1-3)'
    : 'Not assessed';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Regulatory Index — ${escapeHtml(data.organisationName)} ${data.reportYear}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Fira+Code:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: white; color: #1c1917; }
    @page { size: A4; margin: 0; }
    .page {
      width: 794px; min-height: 1123px; position: relative;
      display: flex; flex-direction: column;
      padding: 52px; overflow: hidden;
      page-break-after: always; break-after: page;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    .mono { font-family: 'Fira Code', monospace; }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #e7e5e4;">
    <div>
      <div style="font-family: 'Fira Code', monospace; font-size: 10px; text-transform: uppercase; letter-spacing: 1.5px; color: ${primary}; margin-bottom: 6px;">Framework Coverage Index</div>
      <div style="font-size: 22px; font-weight: 700; color: #1c1917;">${escapeHtml(data.organisationName)}</div>
      <div style="font-size: 12px; color: #78716c; margin-top: 4px;">${data.reportYear} Sustainability Report &bull; ${escapeHtml(data.reportingPeriodStart)} to ${escapeHtml(data.reportingPeriodEnd)}</div>
    </div>
    <div style="text-align: right;">
      ${data.branding.logo
        ? `<img src="${escapeHtml(data.branding.logo)}" style="height: 32px; object-fit: contain;" />`
        : `<img src="${ALKATERA_LOGO_URL}" style="height: 24px; object-fit: contain;" />`}
      ${data.dataQuality ? `
      <div style="margin-top: 8px; font-size: 11px; color: #78716c; text-align: right;">
        Data quality: <strong>${escapeHtml(tierLabel)}</strong>
        &bull; ${Math.round((data.dataQuality.completeness || 0) * 100)}% complete
      </div>` : ''}
    </div>
  </div>

  <!-- Legend -->
  <div style="display: flex; gap: 20px; margin-bottom: 20px; font-size: 11px; color: #78716c;">
    <div style="display: flex; align-items: center; gap: 6px;">${statusIcon('covered')} Fully covered in this report</div>
    <div style="display: flex; align-items: center; gap: 6px;">${statusIcon('partial')} Partially covered</div>
    <div style="display: flex; align-items: center; gap: 6px;">${statusIcon('not-covered')} Not covered</div>
  </div>

  <!-- Standard blocks -->
  ${selectedStandards.length > 0 ? standardBlocks : `
  <div style="background: #f5f5f4; border-radius: 12px; padding: 32px; text-align: center; color: #a8a29e;">
    No reporting standards have been selected for this report.
    Select standards in the report builder to generate a coverage index.
  </div>
  `}

  <!-- Footer -->
  <div style="position: absolute; bottom: 32px; left: 52px; right: 52px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #a8a29e;">
    <span>Prepared by alkatera &bull; This index is indicative and should be verified against full disclosures.</span>
    <span>${data.reportYear} Regulatory Index</span>
  </div>
</div>
</body>
</html>`;
}
