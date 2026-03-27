/**
 * Greenwash Guardian PDF — HTML Template
 *
 * Generates a self-contained HTML document for the Greenwash Guardian report,
 * converted to PDF via PDFShift (Chromium-based, pixel-perfect).
 *
 * Design language matches the LCA report: Inter + Playfair Display + Fira Code,
 * dark/light page alternation, section headers with yellow Fira Code numbers,
 * conic-gradient donut chart.
 *
 * Layout strategy:
 * - Cover page: fixed 794×1123px div (full-bleed dark background)
 * - All other content: flowing with @page margins
 * - Header/footer: position:fixed elements (Chromium repeats on every page)
 * - Cover's dark background covers the fixed header/footer on page 1
 */

// ============================================================================
// TYPES
// ============================================================================

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

// ============================================================================
// HELPERS
// ============================================================================

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
    default: return '#16a34a';
  }
}

function riskBg(level: string): string {
  switch (level) {
    case 'high': return '#fef2f2';
    case 'medium': return '#fffbeb';
    default: return '#f0fdf4';
  }
}

function riskBorder(level: string): string {
  switch (level) {
    case 'high': return '#fecaca';
    case 'medium': return '#fde68a';
    default: return '#bbf7d0';
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

function issueTypeLabel(t: string): string {
  return (t || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// BRAND ELEMENTS
// ============================================================================

const LOGO_URL = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';

function logo(height: number, dark = true): string {
  const filter = dark ? '' : 'filter: brightness(0);';
  return `<img src="${LOGO_URL}" alt="alkatera" style="height: ${height}px; width: auto; object-fit: contain; ${filter}" />`;
}

// ============================================================================
// SECTION HEADER
// ============================================================================

function sectionHeader(number: string, title: string): string {
  return `
    <div style="display: flex; align-items: baseline; gap: 16px; margin-bottom: 28px; border-bottom: 1px solid rgba(0,0,0,0.08); padding-bottom: 12px;">
      <span style="color: #ccff00; font-family: 'Fira Code', monospace; font-size: 14px; font-weight: 700; letter-spacing: 3px; text-shadow: 0 0 8px rgba(204,255,0,0.3);">${number}</span>
      <h2 style="font-size: 28px; font-family: 'Playfair Display', serif; font-weight: 300; color: #1c1917;">${title}</h2>
    </div>`;
}

// ============================================================================
// COVER PAGE (fixed-size, full-bleed dark)
// ============================================================================

function renderCoverPage(result: AnalysisResult): string {
  const colour = riskColour(result.overall_risk_level);
  const score = result.overall_risk_score;
  const scoreDeg = (score / 100) * 360;
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return `
    <div class="cover-page">
      <!-- Top: Logo -->
      <div style="padding-top: 16px;">
        ${logo(44)}
      </div>

      <!-- Centre: Title + Score -->
      <div>
        <div style="margin-bottom: 48px;">
          <div style="background: #ccff00; color: #0a0a0a; padding: 20px 28px; border-radius: 12px; display: inline-block; transform: rotate(-1deg); margin-bottom: 32px;">
            <div style="font-family: 'Fira Code', monospace; font-weight: 700; font-style: italic; font-size: 20px; letter-spacing: -0.5px;">GREENWASH GUARDIAN</div>
            <div style="font-size: 11px; opacity: 0.6; margin-top: 2px;">Risk Assessment Report</div>
          </div>
          <div style="margin-bottom: 8px;">
            <span style="font-size: 15px; color: #a8a29e; font-family: 'Fira Code', monospace; letter-spacing: 1px;">${esc(result.url.toLowerCase())}</span>
          </div>
          <div style="font-size: 12px; color: #78716c;">${dateStr}</div>
        </div>

        <!-- Risk Score -->
        <div style="display: flex; align-items: center; gap: 32px;">
          <div style="width: 140px; height: 140px; border-radius: 50%; background: conic-gradient(${colour} 0deg ${scoreDeg}deg, rgba(255,255,255,0.1) ${scoreDeg}deg 360deg); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <div style="width: 100px; height: 100px; border-radius: 50%; background: #1c1917; display: flex; flex-direction: column; align-items: center; justify-content: center;">
              <div style="font-size: 42px; font-family: 'Playfair Display', serif; font-weight: 700; color: white; line-height: 1;">${score}</div>
              <div style="font-size: 11px; color: #78716c; font-family: 'Fira Code', monospace;">/ 100</div>
            </div>
          </div>
          <div>
            <div style="font-size: 32px; font-family: 'Playfair Display', serif; font-weight: 700; color: ${colour}; margin-bottom: 4px;">${result.overall_risk_level.toUpperCase()} RISK</div>
            <div style="font-size: 13px; color: #a8a29e;">Overall greenwashing risk score</div>
          </div>
        </div>
      </div>

      <!-- Bottom: Disclaimer + Footer -->
      <div>
        <div style="background: rgba(217,119,6,0.1); border: 1px solid rgba(217,119,6,0.3); border-radius: 8px; padding: 10px 16px; display: flex; gap: 12px; align-items: center; margin-bottom: 20px;">
          <span style="font-size: 8px; font-weight: 700; color: #fbbf24; font-family: 'Fira Code', monospace; letter-spacing: 2px; text-transform: uppercase; white-space: nowrap;">Disclaimer</span>
          <span style="font-size: 9px; color: #a8a29e;">This report provides guidance only and is not legal advice. Consult qualified legal counsel for compliance decisions.</span>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 9px; font-family: 'Fira Code', monospace; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 2px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span>Generated by</span>
            ${logo(14)}
          </div>
          <div>Greenwash Guardian | ${dateStr}</div>
        </div>
      </div>
    </div>`;
}

// ============================================================================
// SUMMARY & LEGISLATION
// ============================================================================

function renderSummarySection(result: AnalysisResult): string {
  const highCount = result.claims.filter(c => c.risk_level === 'high').length;
  const medCount = result.claims.filter(c => c.risk_level === 'medium').length;
  const lowCount = result.claims.filter(c => c.risk_level === 'low').length;

  const legislationHtml = result.legislation_applied.map(l => `
    <div style="display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid #f0f0ef;">
      <span style="display: inline-block; background: #ccff00; color: #0a0a0a; font-size: 8px; font-weight: 700; font-family: 'Fira Code', monospace; padding: 3px 8px; border-radius: 4px; letter-spacing: 1px; flex-shrink: 0;">${jurisdictionLabel(l.jurisdiction)}</span>
      <span style="font-size: 11px; color: #44403c;">${esc(l.name)}</span>
    </div>`).join('');

  return `
    ${sectionHeader('01', 'Executive Summary')}

    <!-- Claims Overview -->
    <div style="display: flex; gap: 16px; margin-bottom: 28px;">
      <div style="flex: 1; background: white; border: 1px solid #fecaca; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 42px; font-family: 'Playfair Display', serif; font-weight: 700; color: #dc2626; line-height: 1;">${highCount}</div>
        <div>
          <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #dc2626; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">High</div>
          <div style="font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 1px;">Risk</div>
        </div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 42px; font-family: 'Playfair Display', serif; font-weight: 700; color: #d97706; line-height: 1;">${medCount}</div>
        <div>
          <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #d97706; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Medium</div>
          <div style="font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 1px;">Risk</div>
        </div>
      </div>
      <div style="flex: 1; background: white; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 16px;">
        <div style="font-size: 42px; font-family: 'Playfair Display', serif; font-weight: 700; color: #16a34a; line-height: 1;">${lowCount}</div>
        <div>
          <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #16a34a; text-transform: uppercase; letter-spacing: 2px; font-weight: 700;">Low</div>
          <div style="font-size: 9px; color: #a8a29e; text-transform: uppercase; letter-spacing: 1px;">Risk</div>
        </div>
      </div>
    </div>

    <!-- Summary -->
    <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; margin-bottom: 28px;">
      <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Summary</div>
      <p style="font-size: 12px; line-height: 1.8; color: #44403c;">${esc(result.summary)}</p>
    </div>

    <!-- Legislation -->
    <div style="background: white; border: 1px solid #e7e5e4; border-radius: 12px; padding: 24px; margin-bottom: 12px;">
      <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Legislation Applied</div>
      ${legislationHtml}
    </div>`;
}

// ============================================================================
// CLAIM CARDS
// ============================================================================

function renderClaimCard(claim: ClaimResult, index: number): string {
  const colour = riskColour(claim.risk_level);
  const bg = riskBg(claim.risk_level);
  const border = riskBorder(claim.risk_level);
  const legText = `${claim.legislation_name}${claim.legislation_article ? ` (${claim.legislation_article})` : ''}`;

  return `
    <div class="claim-card">
      <!-- Header -->
      <div style="background: ${colour}; padding: 12px 20px; display: flex; align-items: center; gap: 12px;">
        <span style="font-size: 12px; font-family: 'Fira Code', monospace; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 2px;">${String(index).padStart(2, '0')}</span>
        <span style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); color: white; font-size: 8px; font-weight: 700; padding: 3px 10px; border-radius: 12px; text-transform: uppercase; letter-spacing: 1px;">${claim.risk_level.toUpperCase()}</span>
        <span style="font-size: 10px; color: rgba(255,255,255,0.8); font-family: 'Fira Code', monospace;">Score: ${claim.risk_score}/100</span>
        <span style="font-size: 10px; color: rgba(255,255,255,0.7); margin-left: auto;">${esc(issueTypeLabel(claim.issue_type))}</span>
      </div>

      <!-- Body -->
      <div style="padding: 20px; background: white;">
        <div style="font-size: 13px; font-weight: 600; color: #1c1917; line-height: 1.5; margin-bottom: 16px; padding-left: 16px; border-left: 3px solid ${colour};">
          &ldquo;${esc(claim.claim_text)}&rdquo;
        </div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px;">Issue Description</div>
          <p style="font-size: 11px; color: #57534e; line-height: 1.7;">${esc(claim.issue_description)}</p>
        </div>

        <div style="display: flex; align-items: flex-start; gap: 8px; margin-bottom: 16px;">
          <span style="display: inline-block; background: #ccff00; color: #0a0a0a; font-size: 7px; font-weight: 700; font-family: 'Fira Code', monospace; padding: 3px 8px; border-radius: 4px; letter-spacing: 1px; flex-shrink: 0; margin-top: 1px;">${jurisdictionLabel(claim.legislation_jurisdiction)}</span>
          <span style="font-size: 10px; color: #78716c; line-height: 1.5;">${esc(legText)}</span>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; margin-bottom: ${claim.suggested_revision ? '12px' : '0'};">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #16a34a; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; font-weight: 700;">Suggestion</div>
          <p style="font-size: 10px; color: #166534; line-height: 1.6;">${esc(claim.suggestion)}</p>
        </div>

        ${claim.suggested_revision ? `
        <div style="background: ${bg}; border: 1px solid ${border}; border-radius: 8px; padding: 14px 16px;">
          <div style="font-size: 9px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; font-weight: 600;">Suggested Revision</div>
          <p style="font-size: 10px; color: #57534e; line-height: 1.6; font-style: italic;">&ldquo;${esc(claim.suggested_revision)}&rdquo;</p>
        </div>` : ''}
      </div>
    </div>`;
}

// ============================================================================
// CLAIMS SECTION
// ============================================================================

function renderClaimsSection(claims: ClaimResult[]): string {
  const cardsHtml = claims.map((c, i) => renderClaimCard(c, i + 1)).join('\n');

  return `
    ${sectionHeader('02', 'Identified Claims')}
    <div style="font-size: 11px; color: #78716c; margin-top: -20px; margin-bottom: 24px;">${claims.length} environmental claims found in your content with risk assessments</div>
    ${cardsHtml}`;
}

// ============================================================================
// RECOMMENDATIONS
// ============================================================================

function renderRecommendations(recs: string[]): string {
  const recsHtml = recs.map((r, i) => `
    <div style="display: flex; gap: 14px; margin-bottom: 14px; break-inside: avoid;">
      <div style="width: 28px; height: 28px; background: #ccff00; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <span style="font-size: 11px; font-weight: 700; color: #0a0a0a; font-family: 'Fira Code', monospace;">${i + 1}</span>
      </div>
      <p style="font-size: 11px; color: #44403c; line-height: 1.7; flex: 1; padding-top: 4px;">${esc(r)}</p>
    </div>`).join('');

  return `
    <div style="break-before: page;">
      ${sectionHeader('03', 'Recommendations')}
      ${recsHtml}
    </div>`;
}

// ============================================================================
// ABOUT & CTA
// ============================================================================

function renderAboutSection(): string {
  const services = [
    { name: 'Greenwash Guardian', desc: 'AI-powered compliance scanning against UK and EU anti-greenwashing legislation' },
    { name: 'Life Cycle Assessments', desc: 'Product-level environmental impact analysis with ISO 14044 methodology' },
    { name: 'Sustainability Reporting', desc: 'Automated reports for stakeholders, investors, and B Corp certification' },
    { name: 'Supply Chain Tracking', desc: 'Monitor and improve environmental performance across your supplier network' },
    { name: 'Carbon Footprint Management', desc: 'Scope 1, 2, and 3 emissions tracking with reduction roadmaps' },
  ];

  const servicesHtml = services.map(s => `
    <div style="display: flex; gap: 12px; margin-bottom: 10px;">
      <div style="width: 6px; height: 6px; background: #ccff00; border-radius: 50%; margin-top: 6px; flex-shrink: 0;"></div>
      <div>
        <span style="font-size: 10px; font-weight: 600; color: #1c1917;">${esc(s.name)}:</span>
        <span style="font-size: 10px; color: #57534e;"> ${esc(s.desc)}</span>
      </div>
    </div>`).join('');

  return `
    <div style="break-before: page; break-inside: avoid;">
      <!-- About -->
      <div style="border-top: 1px solid #e7e5e4; padding-top: 24px; margin-bottom: 24px;">
        <div style="margin-bottom: 16px;">
          ${logo(40, false)}
        </div>
        <p style="font-size: 12px; color: #57534e; line-height: 1.8; max-width: 560px; margin-bottom: 24px;">
          alka<strong style="font-weight: 700;">tera</strong> is the sustainability platform built for the drinks industry. We help breweries, distilleries, and wineries measure, manage, and communicate their environmental impact with confidence.
        </p>
        <div style="font-size: 10px; font-family: 'Fira Code', monospace; color: #78716c; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 12px;">Our Services</div>
        ${servicesHtml}
      </div>

      <!-- CTA -->
      <div style="background: #ccff00; border-radius: 12px; padding: 28px 32px; text-align: center; break-inside: avoid;">
        <div style="font-size: 20px; font-family: 'Playfair Display', serif; font-weight: 700; color: #0a0a0a; margin-bottom: 8px;">Want unlimited scans and full compliance tracking?</div>
        <div style="font-size: 13px; color: #0a0a0a;">Get started at alka<strong>tera</strong>.com</div>
        <div style="font-size: 11px; font-weight: 700; color: #0a0a0a; margin-top: 6px; font-family: 'Fira Code', monospace;">hello@alkatera.com</div>
      </div>
    </div>`;
}

// ============================================================================
// MAIN RENDERER
// ============================================================================

export function renderGreenwashHtml(result: AnalysisResult): string {
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const coverPage = renderCoverPage(result);
  const summarySection = renderSummarySection(result);
  const claimsSection = renderClaimsSection(result.claims);
  const recsSection = result.recommendations?.length > 0
    ? renderRecommendations(result.recommendations)
    : '';
  const aboutSection = renderAboutSection();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Greenwash Guardian Report</title>

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@300;700&family=Fira+Code:wght@400;700&display=swap" rel="stylesheet" />

  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      -webkit-font-smoothing: antialiased;
      background: #f5f5f4;
      color: #1c1917;
    }

    /* Cover page has zero margins; all other pages get header/footer space */
    @page { size: A4; margin: 0; }
    @page :first { margin: 0; }

    /* ─── Cover page (fixed full-bleed) ─── */
    .cover-page {
      width: 210mm;
      height: 297mm;
      background: #1c1917;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 48px;
      position: relative;
      z-index: 100;
      page-break-after: always;
      break-after: page;
    }

    /* ─── Flowing content wrapper ─── */
    .flow-content {
      padding: 20mm 24mm 28mm 24mm;
    }

    /* ─── Repeating header (position:fixed repeats on every printed page) ─── */
    .page-header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 14mm;
      background: #1c1917;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24mm;
      z-index: 50;
    }

    .page-header .header-logo { height: 16px; width: auto; object-fit: contain; }
    .page-header .header-title {
      font-size: 8px;
      font-family: 'Fira Code', monospace;
      color: #ccff00;
      text-transform: uppercase;
      letter-spacing: 3px;
      font-weight: 700;
    }

    /* ─── Lime accent line below header ─── */
    .header-accent {
      position: fixed;
      top: 14mm;
      left: 0;
      right: 0;
      height: 1.5px;
      background: #ccff00;
      z-index: 50;
    }

    /* ─── Repeating footer ─── */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 18mm;
      background: #f5f5f4;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      padding: 0 24mm 8mm 24mm;
      z-index: 50;
      border-top: 1px solid #e7e5e4;
    }

    .page-footer span {
      font-size: 8px;
      font-family: 'Fira Code', monospace;
      color: #a8a29e;
      text-transform: uppercase;
      letter-spacing: 1.5px;
    }

    .page-footer .footer-logo { height: 12px; width: auto; object-fit: contain; filter: brightness(0); opacity: 0.3; }

    /* ─── Claim cards ─── */
    .claim-card {
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
      break-inside: avoid;
      border: 1px solid #e7e5e4;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.03);
    }

    /* ─── Print ─── */
    @media print {
      .page-header, .header-accent, .page-footer { position: fixed; }
    }
  </style>
</head>
<body>

<!-- Repeating header (hidden behind cover on page 1) -->
<div class="page-header">
  <img src="${LOGO_URL}" class="header-logo" alt="alkatera" />
  <span class="header-title">Greenwash Guardian</span>
</div>
<div class="header-accent"></div>

<!-- Repeating footer (hidden behind cover on page 1) -->
<div class="page-footer">
  <div style="display: flex; align-items: center; gap: 6px;">
    <span>Generated by</span>
    <img src="${LOGO_URL}" class="footer-logo" alt="alkatera" />
  </div>
  <span>hello@alkatera.com</span>
  <span>${esc(dateStr)}</span>
</div>

<!-- ═══════════════════════════════════════════════════════ -->
<!-- COVER PAGE -->
<!-- ═══════════════════════════════════════════════════════ -->
${coverPage}

<!-- ═══════════════════════════════════════════════════════ -->
<!-- FLOWING CONTENT (with header/footer space) -->
<!-- ═══════════════════════════════════════════════════════ -->
<div class="flow-content">
  ${summarySection}
  ${claimsSection}
  ${recsSection}
  ${aboutSection}
</div>

</body>
</html>`;
}
