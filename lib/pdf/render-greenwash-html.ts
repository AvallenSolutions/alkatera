import { ALKATERA_LOGO_BASE64, ALKATERA_HORIZONTAL_LOGO_BASE64 } from './alkatera-logo-base64';

interface ClaimResult {
  claim_text: string;
  claim_context?: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  issue_type: string;
  issue_description: string;
  legislation_name: string;
  legislation_article?: string;
  legislation_jurisdiction: 'uk' | 'eu' | 'both';
  suggestion: string;
  suggested_revision?: string;
}

interface AnalysisResult {
  url: string;
  overall_risk_level: 'low' | 'medium' | 'high';
  overall_risk_score: number;
  summary: string;
  recommendations: string[];
  legislation_applied: Array<{
    name: string;
    jurisdiction: 'uk' | 'eu' | 'both';
    key_requirement: string;
  }>;
  claims: ClaimResult[];
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function riskColour(level: string): string {
  switch (level) {
    case 'high': return '#dc2626';
    case 'medium': return '#d97706';
    default: return '#22c55e';
  }
}

function jurisdictionLabel(j: string): string {
  switch (j) {
    case 'uk': return 'UK';
    case 'eu': return 'EU';
    case 'both': return 'UK &amp; EU';
    default: return esc(j);
  }
}

function renderClaimCard(claim: ClaimResult): string {
  const colour = riskColour(claim.risk_level);
  const issueType = claim.issue_type
    ?.replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || '';
  const legText = `${claim.legislation_name}${claim.legislation_article ? ` (${claim.legislation_article})` : ''}`;

  return `
    <div class="claim-card">
      <div class="card-header" style="background: ${colour};">
        <span class="card-badge">${claim.risk_level.toUpperCase()}</span>
        <span class="card-score">Score: ${claim.risk_score}/100</span>
        <span class="card-issue-type">${esc(issueType)}</span>
      </div>
      <div class="card-body">
        <div class="claim-text">&ldquo;${esc(claim.claim_text)}&rdquo;</div>
        <hr class="card-separator">
        <div class="card-label">Issue Description</div>
        <div class="issue-description">${esc(claim.issue_description)}</div>
        <div class="card-legislation">
          <span class="jurisdiction-badge">${jurisdictionLabel(claim.legislation_jurisdiction)}</span>
          <span class="legislation-name">${esc(legText)}</span>
        </div>
        <div class="suggestion-box">
          <div class="suggestion-label">Suggestion</div>
          <div class="suggestion-text">${esc(claim.suggestion)}</div>
        </div>
        ${claim.suggested_revision ? `
        <div class="revision-box">
          <div class="revision-label">Suggested Revision</div>
          <div class="revision-text">&ldquo;${esc(claim.suggested_revision)}&rdquo;</div>
        </div>` : ''}
      </div>
    </div>`;
}

function renderRecommendation(rec: string, num: number): string {
  return `
    <div class="rec-item">
      <div class="rec-number">${num}</div>
      <div class="rec-text">${esc(rec)}</div>
    </div>`;
}

function renderLegislation(leg: { name: string; jurisdiction: string }): string {
  return `
    <div class="legislation-item">
      <span class="jurisdiction-badge">${jurisdictionLabel(leg.jurisdiction)}</span>
      <span class="legislation-name">${esc(leg.name)}</span>
    </div>`;
}

const SERVICES = [
  'Greenwash Guardian: AI-powered compliance scanning against UK and EU anti-greenwashing legislation',
  'Life Cycle Assessments: Product-level environmental impact analysis with ISO 14044 methodology',
  'Sustainability Reporting: Automated reports for stakeholders, investors, and B Corp certification',
  'Supply Chain Tracking: Monitor and improve environmental performance across your supplier network',
  'Carbon Footprint Management: Scope 1, 2, and 3 emissions tracking with reduction roadmaps',
];

export function renderGreenwashHtml(result: AnalysisResult): string {
  const colour = riskColour(result.overall_risk_level);
  const score = result.overall_risk_score;
  const scoreDeg = (score / 100) * 360;
  const url = result.url.toLowerCase();
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const highCount = result.claims.filter(c => c.risk_level === 'high').length;
  const medCount = result.claims.filter(c => c.risk_level === 'medium').length;
  const lowCount = result.claims.filter(c => c.risk_level === 'low').length;

  const claimsHtml = result.claims.map(c => renderClaimCard(c)).join('\n');
  const recsHtml = result.recommendations.map((r, i) => renderRecommendation(r, i + 1)).join('\n');
  const legislationHtml = result.legislation_applied.map(l => renderLegislation(l)).join('\n');
  const servicesHtml = SERVICES.map(s => `
    <div class="service-item">
      <div class="service-bullet"></div>
      <div class="service-text">${esc(s)}</div>
    </div>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 20mm 20mm 20mm; }
  @page :first { margin: 0; }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', sans-serif;
    color: #1c1917;
    font-size: 10pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ─── Cover page ─── */
  .cover {
    width: 210mm;
    height: 297mm;
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }

  .cover-header {
    background: #1c1917;
    padding: 28mm 24mm 18mm;
    text-align: center;
  }

  .cover-logo { width: 56px; height: 56px; margin-bottom: 10px; }

  .cover-title {
    font-size: 26pt;
    font-weight: 700;
    color: white;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .cover-subtitle {
    font-size: 12pt;
    color: #ccff00;
    margin-bottom: 12px;
  }

  .cover-accent {
    width: 60mm;
    height: 2px;
    background: #ccff00;
    margin: 0 auto 12px;
  }

  .cover-meta { font-size: 9pt; color: #a8a29e; }
  .cover-meta span { display: block; margin-bottom: 2px; }

  .cover-body { padding: 14mm 24mm 0; }

  /* ─── Donut chart ─── */
  .donut-container {
    display: flex;
    align-items: center;
    gap: 24px;
    margin-bottom: 18px;
  }

  .donut {
    width: 110px;
    height: 110px;
    border-radius: 50%;
    background: conic-gradient(${colour} 0deg ${scoreDeg}deg, #e7e5e4 ${scoreDeg}deg 360deg);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .donut-inner {
    width: 78px;
    height: 78px;
    border-radius: 50%;
    background: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .donut-score { font-size: 26pt; font-weight: 700; color: #1c1917; line-height: 1; }
  .donut-label { font-size: 8pt; color: #78716c; }

  .risk-level { font-size: 18pt; font-weight: 700; color: ${colour}; margin-bottom: 2px; }
  .risk-sublabel { font-size: 9pt; color: #78716c; }

  /* ─── Section headings ─── */
  .section-title {
    font-size: 13pt;
    font-weight: 700;
    color: #1c1917;
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }

  .section-subtitle { font-size: 8pt; color: #78716c; margin-bottom: 12px; }

  /* ─── Summary ─── */
  .summary { font-size: 10pt; color: #44403c; line-height: 1.6; margin-bottom: 14px; }

  /* ─── Legislation ─── */
  .legislation-list { margin-bottom: 10px; }

  .legislation-item {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .jurisdiction-badge {
    display: inline-block;
    background: #ccff00;
    color: #1c1917;
    font-size: 6.5pt;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
    flex-shrink: 0;
    white-space: nowrap;
  }

  .legislation-name { font-size: 9pt; color: #57534e; }

  /* ─── Disclaimer ─── */
  .disclaimer {
    position: absolute;
    bottom: 22mm;
    left: 24mm;
    right: 24mm;
    background: #fffbeb;
    border: 1px solid #d97706;
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .disclaimer-label { font-size: 7pt; font-weight: 700; color: #92400e; white-space: nowrap; }
  .disclaimer-text { font-size: 7pt; color: #92400e; }

  /* ─── Cover footer ─── */
  .cover-footer {
    position: absolute;
    bottom: 8mm;
    left: 24mm;
    right: 24mm;
    display: flex;
    justify-content: space-between;
    font-size: 7pt;
    color: #78716c;
    border-top: 1px solid #e7e5e4;
    padding-top: 5px;
  }

  /* ─── Claims overview ─── */
  .claims-overview {
    display: flex;
    gap: 10px;
    margin-bottom: 16px;
  }

  .overview-box {
    flex: 1;
    background: #fafafa;
    border-radius: 8px;
    padding: 10px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    border-left: 3px solid;
  }

  .overview-count { font-size: 22pt; font-weight: 700; line-height: 1; }
  .overview-label { font-size: 7pt; font-weight: 600; color: #78716c; text-transform: uppercase; letter-spacing: 0.5px; }
  .overview-sublabel { font-size: 6pt; color: #a8a29e; text-transform: uppercase; }

  /* ─── Claim cards ─── */
  .claim-card {
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 14px;
    break-inside: avoid;
    border: 1px solid #e7e5e4;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  }

  .card-header {
    padding: 8px 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .card-badge {
    font-size: 7pt;
    font-weight: 700;
    color: white;
    border: 1.5px solid rgba(255,255,255,0.5);
    padding: 2px 8px;
    border-radius: 10px;
    text-transform: uppercase;
  }

  .card-score { font-size: 7.5pt; color: rgba(255,255,255,0.85); }
  .card-issue-type { font-size: 7.5pt; color: rgba(255,255,255,0.85); margin-left: auto; }

  .card-body { padding: 14px; background: white; }

  .claim-text { font-size: 10.5pt; font-weight: 700; color: #1c1917; margin-bottom: 10px; line-height: 1.4; }

  .card-separator { border: none; border-top: 1px solid #e7e5e4; margin-bottom: 10px; }

  .card-label {
    font-size: 7pt;
    font-weight: 600;
    color: #78716c;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .issue-description { font-size: 9pt; color: #57534e; line-height: 1.5; margin-bottom: 10px; }

  .card-legislation {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin-bottom: 10px;
  }

  .card-legislation .legislation-name { font-size: 8pt; }

  .suggestion-box {
    background: #ecfdf5;
    border: 1px solid #22c55e;
    border-radius: 6px;
    padding: 10px 12px;
    margin-bottom: 8px;
  }

  .suggestion-label { font-size: 7pt; font-weight: 700; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .suggestion-text { font-size: 8pt; color: #166534; line-height: 1.5; }

  .revision-box {
    background: #f8f8f8;
    border-radius: 6px;
    padding: 10px 12px;
  }

  .revision-label { font-size: 7pt; font-weight: 600; color: #78716c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .revision-text { font-size: 8pt; color: #57534e; font-style: italic; line-height: 1.5; }

  /* ─── Recommendations ─── */
  .recommendations { margin-top: 24px; }

  .rec-item { display: flex; gap: 10px; margin-bottom: 10px; break-inside: avoid; }

  .rec-number {
    width: 22px;
    height: 22px;
    background: #ccff00;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8pt;
    font-weight: 700;
    color: #1c1917;
    flex-shrink: 0;
  }

  .rec-text { font-size: 9pt; color: #57534e; line-height: 1.5; flex: 1; }

  /* ─── About section ─── */
  .about-section {
    margin-top: 28px;
    padding-top: 16px;
    border-top: 1px solid #e7e5e4;
    break-inside: avoid;
  }

  .about-logo { height: 36px; margin-bottom: 10px; }
  .about-description { font-size: 9pt; color: #57534e; line-height: 1.6; margin-bottom: 12px; }
  .services-title { font-size: 8pt; font-weight: 700; color: #1c1917; margin-bottom: 6px; }

  .service-item { display: flex; align-items: flex-start; gap: 6px; margin-bottom: 4px; }
  .service-bullet { width: 6px; height: 6px; background: #ccff00; border-radius: 50%; margin-top: 4px; flex-shrink: 0; }
  .service-text { font-size: 8pt; color: #57534e; line-height: 1.5; }

  /* ─── CTA ─── */
  .cta-box {
    background: #ccff00;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    margin-top: 16px;
    break-inside: avoid;
  }

  .cta-heading { font-size: 14pt; font-weight: 700; color: #0a0a0a; margin-bottom: 6px; }
  .cta-subtext { font-size: 10pt; color: #0a0a0a; margin-bottom: 4px; }
  .cta-subtext strong { font-weight: 700; }
  .cta-email { font-size: 9pt; font-weight: 700; color: #0a0a0a; }
</style>
</head>
<body>

<!-- Cover Page -->
<div class="cover">
  <div class="cover-header">
    <img src="data:image/png;base64,${ALKATERA_LOGO_BASE64}" class="cover-logo" alt="alkatera">
    <div class="cover-title">GREENWASH GUARDIAN</div>
    <div class="cover-subtitle">Risk Assessment Report</div>
    <div class="cover-accent"></div>
    <div class="cover-meta">
      <span>${esc(url)}</span>
      <span>Generated: ${date}</span>
    </div>
  </div>

  <div class="cover-body">
    <div class="donut-container">
      <div class="donut">
        <div class="donut-inner">
          <div class="donut-score">${score}</div>
          <div class="donut-label">/ 100</div>
        </div>
      </div>
      <div style="flex: 1;">
        <div class="risk-level">${result.overall_risk_level.toUpperCase()} RISK</div>
        <div class="risk-sublabel">Overall greenwashing risk score</div>
      </div>
    </div>

    <div class="section-title">SUMMARY</div>
    <div class="summary">${esc(result.summary)}</div>

    <div class="section-title">LEGISLATION APPLIED</div>
    <div class="legislation-list">${legislationHtml}</div>
  </div>

  <div class="disclaimer">
    <span class="disclaimer-label">DISCLAIMER</span>
    <span class="disclaimer-text">This report provides guidance only and is not legal advice. Consult qualified legal counsel for compliance decisions.</span>
  </div>

  <div class="cover-footer">
    <span>hello@alkatera.com | alkatera.com</span>
  </div>
</div>

<!-- Claims Section -->
<div class="section-title" style="margin-bottom: 2px;">IDENTIFIED CLAIMS (${result.claims.length})</div>
<div class="section-subtitle">Environmental claims found in your content with risk assessments</div>

<div class="claims-overview">
  <div class="overview-box" style="border-color: #dc2626;">
    <div class="overview-count" style="color: #dc2626;">${highCount}</div>
    <div>
      <div class="overview-label">HIGH</div>
      <div class="overview-sublabel">RISK</div>
    </div>
  </div>
  <div class="overview-box" style="border-color: #d97706;">
    <div class="overview-count" style="color: #d97706;">${medCount}</div>
    <div>
      <div class="overview-label">MEDIUM</div>
      <div class="overview-sublabel">RISK</div>
    </div>
  </div>
  <div class="overview-box" style="border-color: #22c55e;">
    <div class="overview-count" style="color: #22c55e;">${lowCount}</div>
    <div>
      <div class="overview-label">LOW</div>
      <div class="overview-sublabel">RISK</div>
    </div>
  </div>
</div>

${claimsHtml}

<!-- Recommendations -->
<div class="recommendations">
  <div class="section-title">RECOMMENDATIONS</div>
  ${recsHtml}
</div>

<!-- About + CTA -->
<div class="about-section">
  <img src="data:image/png;base64,${ALKATERA_HORIZONTAL_LOGO_BASE64}" class="about-logo" alt="alkatera">
  <div class="about-description">alkatera is the sustainability platform built for the drinks industry. We help breweries, distilleries, and wineries measure, manage, and communicate their environmental impact with confidence.</div>
  <div class="services-title">Our Services</div>
  ${servicesHtml}
  <div class="cta-box">
    <div class="cta-heading">Want unlimited scans and full compliance tracking?</div>
    <div class="cta-subtext">Get started at alka<strong>tera</strong>.com</div>
    <div class="cta-email">hello@alkatera.com</div>
  </div>
</div>

</body>
</html>`;
}
