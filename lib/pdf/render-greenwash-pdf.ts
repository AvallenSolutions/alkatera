import { ALKATERA_LOGO_BASE64, ALKATERA_HORIZONTAL_LOGO_BASE64 } from './alkatera-logo-base64';

// Brand colours
const LIME = { r: 204, g: 255, b: 0 };       // #ccff00
const DARK = { r: 10, g: 10, b: 10 };         // #0a0a0a
const DARK_GREY = { r: 28, g: 25, b: 23 };    // #1c1917
const MID_GREY = { r: 120, g: 113, b: 108 };  // #78716c
const LIGHT_GREY = { r: 231, g: 229, b: 228 };// #e7e5e4
const WHITE = { r: 255, g: 255, b: 255 };
const RED = { r: 220, g: 38, b: 38 };         // #dc2626
const AMBER = { r: 217, g: 119, b: 6 };       // #d97706
const GREEN = { r: 34, g: 197, b: 94 };       // #22c55e

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

/**
 * Sanitise text for jsPDF's built-in Helvetica font.
 * jsPDF cannot render many Unicode characters and falls back to Courier,
 * which is wider and breaks line-width calculations, causing text overflow.
 */
function sanitise(text: string): string {
  return text
    // Dashes
    .replace(/[\u2013\u2014]/g, '-')    // en dash, em dash -> hyphen
    .replace(/\u2015/g, '-')            // horizontal bar
    // Quotes
    .replace(/[\u2018\u2019\u201A]/g, "'") // curly single quotes
    .replace(/[\u201C\u201D\u201E]/g, '"') // curly double quotes
    // Subscripts / superscripts
    .replace(/\u2082/g, '2')            // subscript 2
    .replace(/\u2083/g, '3')            // subscript 3
    .replace(/\u00B2/g, '2')            // superscript 2
    .replace(/\u00B3/g, '3')            // superscript 3
    // Ellipsis
    .replace(/\u2026/g, '...')
    // Bullets
    .replace(/\u2022/g, '-')
    // Non-breaking space
    .replace(/\u00A0/g, ' ')
    // Any remaining non-ASCII that Helvetica can't render
    .replace(/[^\x00-\xFF]/g, '');
}

function getRiskColour(level: string) {
  switch (level) {
    case 'high': return RED;
    case 'medium': return AMBER;
    default: return GREEN;
  }
}

function getJurisdictionLabel(jurisdiction: string): string {
  switch (jurisdiction) {
    case 'uk': return 'UK';
    case 'eu': return 'EU';
    case 'both': return 'UK & EU';
    default: return jurisdiction;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PDF = any;

const PAGE_WIDTH = 210;
const MARGIN = 20;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const HEADER_HEIGHT = 18;
const FOOTER_HEIGHT = 16;
const CARD_HEADER_H = 12;

/**
 * Draw "alkatera" with "tera" in bold, matching brand guidelines.
 * Returns the total width of the rendered text.
 */
function drawAlkatera(pdf: PDF, x: number, y: number, fontSize: number, colour: { r: number; g: number; b: number }, align?: 'center' | 'right'): number {
  pdf.setFontSize(fontSize);

  // Measure both parts
  pdf.setFont('helvetica', 'normal');
  const alkaWidth = pdf.getTextWidth('alka');
  pdf.setFont('helvetica', 'bold');
  const teraWidth = pdf.getTextWidth('tera');
  const totalWidth = alkaWidth + teraWidth;

  // Calculate starting X based on alignment
  let startX = x;
  if (align === 'center') {
    startX = x - totalWidth / 2;
  } else if (align === 'right') {
    startX = x - totalWidth;
  }

  // Draw "alka" in normal weight
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(colour.r, colour.g, colour.b);
  pdf.text('alka', startX, y);

  // Draw "tera" in bold
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(colour.r, colour.g, colour.b);
  pdf.text('tera', startX + alkaWidth, y);

  return totalWidth;
}

function drawHeader(pdf: PDF) {
  // Thin dark bar at top
  pdf.setFillColor(DARK.r, DARK.g, DARK.b);
  pdf.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT, 'F');

  // alkatera logo (scaled to fit header)
  try {
    pdf.addImage(ALKATERA_LOGO_BASE64, 'PNG', MARGIN, 3, 12, 12);
  } catch {
    // Fallback to styled text if logo fails
    drawAlkatera(pdf, MARGIN, 11, 8, WHITE);
  }

  // GREENWASH GUARDIAN right-aligned
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(LIME.r, LIME.g, LIME.b);
  pdf.text('GREENWASH GUARDIAN', PAGE_WIDTH - MARGIN, 11, { align: 'right' });

  // Lime accent line
  pdf.setDrawColor(LIME.r, LIME.g, LIME.b);
  pdf.setLineWidth(0.5);
  pdf.line(MARGIN, HEADER_HEIGHT, PAGE_WIDTH - MARGIN, HEADER_HEIGHT);

  pdf.setTextColor(0, 0, 0); // Reset
}

function drawFooter(pdf: PDF, pageNum: number, totalPages: number) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  const footerY = pageHeight - FOOTER_HEIGHT;

  // Separator line
  pdf.setDrawColor(LIGHT_GREY.r, LIGHT_GREY.g, LIGHT_GREY.b);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, footerY, PAGE_WIDTH - MARGIN, footerY);

  // Contact info left
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
  pdf.text('hello@alkatera.com  |  alkatera.com', MARGIN, footerY + 8);

  // Page number right
  pdf.text(`${pageNum} / ${totalPages}`, PAGE_WIDTH - MARGIN, footerY + 8, { align: 'right' });

  pdf.setTextColor(0, 0, 0); // Reset
}

function ensureSpace(pdf: PDF, yPos: number, needed: number): number {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (yPos + needed > pageHeight - FOOTER_HEIGHT - 10) {
    pdf.addPage();
    drawHeader(pdf);
    return HEADER_HEIGHT + 10;
  }
  return yPos;
}

/**
 * Draw a donut chart (score arc) using polygon fill.
 * jsPDF has no arc primitive, so we approximate with a filled polygon pie slice
 * then cut out the inner circle.
 */
function drawDonut(
  pdf: PDF, cx: number, cy: number,
  outerR: number, innerR: number,
  score: number, riskLevel: string,
  colour: { r: number; g: number; b: number },
) {
  // Grey track (full ring)
  pdf.setFillColor(LIGHT_GREY.r, LIGHT_GREY.g, LIGHT_GREY.b);
  pdf.circle(cx, cy, outerR, 'F');
  pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.circle(cx, cy, innerR, 'F');

  // Score arc
  if (score > 0) {
    const startAngle = -Math.PI / 2; // 12 o'clock
    const endAngle = startAngle + (score / 100) * 2 * Math.PI;
    const steps = Math.max(Math.round((score / 100) * 72), 2);

    // Build polygon: center -> arc points -> closed back to center
    const segments: [number, number][] = [];
    // First segment: from center to first point on arc
    segments.push([outerR * Math.cos(startAngle), outerR * Math.sin(startAngle)]);
    // Subsequent segments: along the arc (relative to previous point)
    for (let i = 1; i <= steps; i++) {
      const prevA = startAngle + ((i - 1) / steps) * (endAngle - startAngle);
      const currA = startAngle + (i / steps) * (endAngle - startAngle);
      segments.push([
        outerR * Math.cos(currA) - outerR * Math.cos(prevA),
        outerR * Math.sin(currA) - outerR * Math.sin(prevA),
      ]);
    }

    pdf.setFillColor(colour.r, colour.g, colour.b);
    pdf.lines(segments, cx, cy, [1, 1], 'F', true);

    // Cut out inner circle to create the donut hole
    pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
    pdf.circle(cx, cy, innerR, 'F');
  }

  // Score number centred in the donut
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(24);
  pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
  pdf.text(`${score}`, cx, cy + 2, { align: 'center' });

  // "/ 100" below score
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
  pdf.text('/ 100', cx, cy + 7, { align: 'center' });

  // Risk level label below donut
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(colour.r, colour.g, colour.b);
  pdf.text(`${riskLevel.toUpperCase()} RISK`, cx, cy + outerR + 8, { align: 'center' });
}

/**
 * Draw the claims overview row: three boxes showing HIGH / MEDIUM / LOW counts.
 */
function drawClaimsOverview(pdf: PDF, claims: ClaimResult[], yPos: number): number {
  const highCount = claims.filter(c => c.risk_level === 'high').length;
  const medCount = claims.filter(c => c.risk_level === 'medium').length;
  const lowCount = claims.filter(c => c.risk_level === 'low').length;

  const gap = 4;
  const boxW = (CONTENT_WIDTH - gap * 2) / 3;
  const boxH = 16;

  const boxes = [
    { count: highCount, label: 'HIGH', colour: RED },
    { count: medCount, label: 'MEDIUM', colour: AMBER },
    { count: lowCount, label: 'LOW', colour: GREEN },
  ];

  for (let i = 0; i < 3; i++) {
    const bx = MARGIN + i * (boxW + gap);
    const box = boxes[i];

    // Light background
    pdf.setFillColor(250, 250, 250);
    pdf.roundedRect(bx, yPos, boxW, boxH, 2, 2, 'F');

    // Left colour accent
    pdf.setFillColor(box.colour.r, box.colour.g, box.colour.b);
    pdf.roundedRect(bx, yPos, 3, boxH, 2, 2, 'F');
    pdf.rect(bx + 1.5, yPos, 1.5, boxH, 'F'); // square off right side of accent

    // Count number
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(box.colour.r, box.colour.g, box.colour.b);
    pdf.text(`${box.count}`, bx + 10, yPos + 11);

    // Label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
    pdf.text(box.label, bx + 20, yPos + 8.5);

    // "RISK" below label
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6);
    pdf.text('RISK', bx + 20, yPos + 12.5);
  }

  return yPos + boxH + 8;
}

export async function generateGreenwashPDF(result: AnalysisResult): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageHeight = pdf.internal.pageSize.getHeight();

  // ─── PAGE 1: COVER ───────────────────────────────────────

  // Dark header block
  pdf.setFillColor(DARK.r, DARK.g, DARK.b);
  pdf.rect(0, 0, PAGE_WIDTH, 95, 'F');

  // Logo
  try {
    pdf.addImage(ALKATERA_LOGO_BASE64, 'PNG', PAGE_WIDTH / 2 - 12, 12, 24, 24);
  } catch {
    // Fallback if logo fails
    drawAlkatera(pdf, PAGE_WIDTH / 2, 28, 14, WHITE, 'center');
  }

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.text('GREENWASH GUARDIAN', PAGE_WIDTH / 2, 50, { align: 'center' });

  // Subtitle
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  pdf.setTextColor(LIME.r, LIME.g, LIME.b);
  pdf.text('Risk Assessment Report', PAGE_WIDTH / 2, 58, { align: 'center' });

  // Lime accent line
  pdf.setDrawColor(LIME.r, LIME.g, LIME.b);
  pdf.setLineWidth(1);
  pdf.line(PAGE_WIDTH / 2 - 30, 64, PAGE_WIDTH / 2 + 30, 64);

  // URL and date
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(200, 200, 200);
  pdf.text(result.url.toLowerCase(), PAGE_WIDTH / 2, 74, { align: 'center' });
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, PAGE_WIDTH / 2, 80, { align: 'center' });

  // ─── RISK SCORE DONUT ──────────────────────────────────────

  const riskColour = getRiskColour(result.overall_risk_level);
  drawDonut(pdf, PAGE_WIDTH / 2, 118, 18, 12, result.overall_risk_score, result.overall_risk_level, riskColour);

  let yPos = 148;

  // ─── SUMMARY ──────────────────────────────────────────────

  if (result.summary) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
    pdf.text('SUMMARY', MARGIN, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    const summaryLines = pdf.splitTextToSize(sanitise(result.summary), CONTENT_WIDTH);
    pdf.text(summaryLines, MARGIN, yPos);
    yPos += summaryLines.length * 5 + 8;
  }

  // ─── LEGISLATION APPLIED ──────────────────────────────────

  if (result.legislation_applied && result.legislation_applied.length > 0) {
    yPos = ensureSpace(pdf, yPos, 30);

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
    pdf.text('LEGISLATION APPLIED', MARGIN, yPos);
    yPos += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    for (const leg of result.legislation_applied) {
      yPos = ensureSpace(pdf, yPos, 12);

      const jurisdiction = getJurisdictionLabel(leg.jurisdiction);

      // Jurisdiction badge
      pdf.setFillColor(LIME.r, LIME.g, LIME.b);
      const badgeWidth = pdf.getTextWidth(jurisdiction) + 6;
      pdf.roundedRect(MARGIN, yPos - 3.5, badgeWidth, 5.5, 1, 1, 'F');
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.text(jurisdiction, MARGIN + 3, yPos);

      // Law name
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);
      pdf.text(`${leg.name}`, MARGIN + badgeWidth + 4, yPos);

      yPos += 7;
    }
    yPos += 5;
  }

  // ─── DISCLAIMER (cover page bottom) ───────────────────────

  const disclaimerY = pageHeight - FOOTER_HEIGHT - 18;
  pdf.setFillColor(255, 251, 235);
  pdf.roundedRect(MARGIN, disclaimerY, CONTENT_WIDTH, 12, 2, 2, 'F');
  pdf.setDrawColor(217, 119, 6);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(MARGIN, disclaimerY, CONTENT_WIDTH, 12, 2, 2, 'S');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(120, 53, 15);
  pdf.text('DISCLAIMER', MARGIN + 4, disclaimerY + 4.5);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(146, 64, 14);
  pdf.text('This report provides guidance only and is not legal advice. Consult qualified legal counsel for compliance decisions.', MARGIN + 28, disclaimerY + 4.5);

  // Cover page footer
  drawFooter(pdf, 1, estimatePages(result));

  // ─── CLAIMS PAGES ─────────────────────────────────────────

  if (result.claims && result.claims.length > 0) {
    pdf.addPage();
    drawHeader(pdf);
    yPos = HEADER_HEIGHT + 10;

    // Section title
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
    pdf.text(`IDENTIFIED CLAIMS (${result.claims.length})`, MARGIN, yPos);
    yPos += 4;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
    pdf.text('Environmental claims found in your content with risk assessments', MARGIN, yPos + 4);
    yPos += 14;

    // Claims overview: HIGH / MEDIUM / LOW count boxes
    yPos = drawClaimsOverview(pdf, result.claims, yPos);

    for (const claim of result.claims) {
      yPos = drawClaim(pdf, claim, yPos);
    }
  }

  // ─── RECOMMENDATIONS + CTA PAGE ───────────────────────────

  if (result.recommendations && result.recommendations.length > 0) {
    yPos = ensureSpace(pdf, yPos, 80);

    // If we're near the top of a page after ensureSpace, header is already drawn
    // If not, add separator
    if (yPos > HEADER_HEIGHT + 20) {
      pdf.setDrawColor(LIGHT_GREY.r, LIGHT_GREY.g, LIGHT_GREY.b);
      pdf.setLineWidth(0.3);
      pdf.line(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos);
      yPos += 10;
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
    pdf.text('RECOMMENDATIONS', MARGIN, yPos);
    yPos += 10;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);

    for (let i = 0; i < result.recommendations.length; i++) {
      yPos = ensureSpace(pdf, yPos, 15);

      // Number circle
      pdf.setFillColor(LIME.r, LIME.g, LIME.b);
      pdf.circle(MARGIN + 3, yPos - 1, 3.5, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(DARK.r, DARK.g, DARK.b);
      pdf.text(`${i + 1}`, MARGIN + 3, yPos + 0.5, { align: 'center' });

      // Recommendation text
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(60, 60, 60);
      const recLines = pdf.splitTextToSize(sanitise(result.recommendations[i]), CONTENT_WIDTH - 14);
      pdf.text(recLines, MARGIN + 10, yPos);
      yPos += recLines.length * 4.5 + 5;
    }
  }

  // ─── ABOUT ALKATERA ──────────────────────────────────────

  yPos = ensureSpace(pdf, yPos, 70);
  yPos += 5;

  // Separator
  pdf.setDrawColor(LIGHT_GREY.r, LIGHT_GREY.g, LIGHT_GREY.b);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN, yPos, PAGE_WIDTH - MARGIN, yPos);
  yPos += 10;

  // Horizontal logo (icon + "alkatera" text as single image)
  // Original aspect ratio: 2008x462 = ~4.35:1
  const logoW = 50;
  const logoH = logoW / 4.35;
  try {
    pdf.addImage(ALKATERA_HORIZONTAL_LOGO_BASE64, 'PNG', MARGIN, yPos - 4, logoW, logoH);
  } catch {
    // Fallback to styled text
    drawAlkatera(pdf, MARGIN, yPos + 2, 14, DARK_GREY);
  }
  yPos += logoH + 4;

  // Description
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  const aboutText = 'alkatera is the sustainability platform built for the drinks industry. We help breweries, distilleries, and wineries measure, manage, and communicate their environmental impact with confidence.';
  const aboutLines = pdf.splitTextToSize(aboutText, CONTENT_WIDTH);
  pdf.text(aboutLines, MARGIN, yPos);
  yPos += aboutLines.length * 4.5 + 6;

  // Services list
  const services = [
    'Greenwash Guardian: AI-powered compliance scanning against UK and EU anti-greenwashing legislation',
    'Life Cycle Assessments: Product-level environmental impact analysis with ISO 14044 methodology',
    'Sustainability Reporting: Automated reports for stakeholders, investors, and B Corp certification',
    'Supply Chain Tracking: Monitor and improve environmental performance across your supplier network',
    'Carbon Footprint Management: Scope 1, 2, and 3 emissions tracking with reduction roadmaps',
  ];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
  pdf.text('Our Services', MARGIN, yPos);
  yPos += 5;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(80, 80, 80);
  for (const service of services) {
    yPos = ensureSpace(pdf, yPos, 10);

    // Lime bullet
    pdf.setFillColor(LIME.r, LIME.g, LIME.b);
    pdf.circle(MARGIN + 2, yPos - 1, 1.2, 'F');

    const serviceLines = pdf.splitTextToSize(service, CONTENT_WIDTH - 8);
    pdf.text(serviceLines, MARGIN + 6, yPos);
    yPos += serviceLines.length * 4 + 3;
  }

  yPos += 5;

  // ─── CTA SECTION ──────────────────────────────────────────

  yPos = ensureSpace(pdf, yPos, 45);
  yPos += 3;

  // CTA box with lime background
  const ctaHeight = 38;
  pdf.setFillColor(LIME.r, LIME.g, LIME.b);
  pdf.roundedRect(MARGIN, yPos, CONTENT_WIDTH, ctaHeight, 3, 3, 'F');

  // CTA heading
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  pdf.text('Want unlimited scans and full compliance tracking?', PAGE_WIDTH / 2, yPos + 13, { align: 'center' });

  // CTA subtext: "Get started at alkatera.com" with styled brand name
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  const prefixText = 'Get started at ';
  const suffixText = '.com';
  const prefixW = pdf.getTextWidth(prefixText);
  pdf.setFont('helvetica', 'normal');
  const alkaW = pdf.getTextWidth('alka');
  pdf.setFont('helvetica', 'bold');
  const teraW = pdf.getTextWidth('tera');
  const suffixW = pdf.getTextWidth(suffixText);
  const totalCtaW = prefixW + alkaW + teraW + suffixW;
  const ctaTextX = PAGE_WIDTH / 2 - totalCtaW / 2;

  pdf.setFont('helvetica', 'normal');
  pdf.text(prefixText, ctaTextX, yPos + 22);
  pdf.text('alka', ctaTextX + prefixW, yPos + 22);
  pdf.setFont('helvetica', 'bold');
  pdf.text('tera', ctaTextX + prefixW + alkaW, yPos + 22);
  pdf.setFont('helvetica', 'normal');
  pdf.text(suffixText, ctaTextX + prefixW + alkaW + teraW, yPos + 22);

  // CTA contact
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('hello@alkatera.com', PAGE_WIDTH / 2, yPos + 31, { align: 'center' });

  yPos += ctaHeight + 10;

  // ─── ADD FOOTERS TO ALL PAGES ─────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalPages = (pdf as any).internal.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(pdf, i, totalPages);
  }
  // Update page 1 footer with correct total
  pdf.setPage(1);
  // Re-draw footer area (clear first)
  pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.rect(0, pageHeight - FOOTER_HEIGHT, PAGE_WIDTH, FOOTER_HEIGHT, 'F');
  drawFooter(pdf, 1, totalPages);

  // ─── SAVE ─────────────────────────────────────────────────

  const hostname = (() => {
    try { return new URL(result.url).hostname; }
    catch { return 'website'; }
  })();
  pdf.save(`greenwash-assessment-${hostname}.pdf`);
}

function measureClaimHeight(pdf: PDF, claim: ClaimResult, innerW: number): number {
  const textW = innerW - 4;

  // Must set correct font before each splitTextToSize call for accurate measurement
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  const claimLines = pdf.splitTextToSize(sanitise(`"${claim.claim_text}"`), textW);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const issueLines = pdf.splitTextToSize(sanitise(claim.issue_description), textW);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const suggestionLines = pdf.splitTextToSize(sanitise(claim.suggestion), textW - 8);

  const legText = sanitise(`${claim.legislation_name}${claim.legislation_article ? ` (${claim.legislation_article})` : ''}`);
  const jurisdiction = getJurisdictionLabel(claim.legislation_jurisdiction);

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  const jurBadgeW = pdf.getTextWidth(jurisdiction) + 5;
  const legAvailW = textW - jurBadgeW - 3;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const legLines = pdf.splitTextToSize(legText, legAvailW);

  let h = CARD_HEADER_H;              // coloured header band
  h += 4;                             // gap after header
  h += claimLines.length * 5 + 4;     // claim text
  h += 5;                             // separator + gap
  h += 4;                             // issue description heading
  h += issueLines.length * 4 + 5;     // issue description
  h += legLines.length * 4 + 5;       // legislation row
  h += suggestionLines.length * 4 + 13; // suggestion box

  if (claim.suggested_revision) {
    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    const revLines = pdf.splitTextToSize(sanitise(`"${claim.suggested_revision}"`), textW - 8);
    h += revLines.length * 4 + 12;
  }

  h += 4; // bottom padding
  return h;
}

function drawClaim(pdf: PDF, claim: ClaimResult, startY: number): number {
  const riskColour = getRiskColour(claim.risk_level);
  const cardX = MARGIN;
  const cardW = CONTENT_WIDTH;
  const innerPad = 8;
  const innerW = cardW - innerPad * 2;
  const textW = innerW - 4;

  // Pre-measure text (must set correct font before each splitTextToSize call)
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  const claimLines = pdf.splitTextToSize(sanitise(`"${claim.claim_text}"`), textW);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  const issueLines = pdf.splitTextToSize(sanitise(claim.issue_description), textW);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  const suggestionLines = pdf.splitTextToSize(sanitise(claim.suggestion), textW - 8);

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(8);
  const revisionLines = claim.suggested_revision
    ? pdf.splitTextToSize(sanitise(`"${claim.suggested_revision}"`), textW - 8)
    : [];
  const issueType = claim.issue_type?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  const jurisdiction = getJurisdictionLabel(claim.legislation_jurisdiction);
  const legText = sanitise(`${claim.legislation_name}${claim.legislation_article ? ` (${claim.legislation_article})` : ''}`);

  // Calculate card height
  const cardHeight = measureClaimHeight(pdf, claim, innerW);

  // Ensure space (page break if needed)
  let yPos = ensureSpace(pdf, startY, Math.min(cardHeight, 110));
  const cardTopY = yPos;

  // --- 1. Draw card structure: coloured header band + white body ---

  // Full card coloured fill (header colour shows through at top)
  pdf.setFillColor(riskColour.r, riskColour.g, riskColour.b);
  pdf.roundedRect(cardX, cardTopY, cardW, cardHeight, 3, 3, 'F');

  // White body below header band
  const bodyY = cardTopY + CARD_HEADER_H;
  pdf.setFillColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.rect(cardX + 0.3, bodyY, cardW - 0.6, cardHeight - CARD_HEADER_H - 0.3, 'F');
  // Round the bottom corners by redrawing a small white rounded rect at the bottom
  pdf.roundedRect(cardX + 0.3, cardTopY + cardHeight - 6, cardW - 0.6, 5.7, 2, 2, 'F');

  // Card border
  pdf.setDrawColor(riskColour.r, riskColour.g, riskColour.b);
  pdf.setLineWidth(0.4);
  pdf.roundedRect(cardX, cardTopY, cardW, cardHeight, 3, 3, 'S');

  // --- 2. Draw header band content (white text on coloured bg) ---

  yPos = cardTopY + 4;

  // Badge text (risk level)
  const badgeText = claim.risk_level.toUpperCase();
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  // White badge outline on coloured background
  pdf.setDrawColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.setLineWidth(0.3);
  const badgeW = pdf.getTextWidth(badgeText) + 6;
  pdf.roundedRect(cardX + innerPad, yPos - 3, badgeW, 5.5, 1.5, 1.5, 'S');
  pdf.setTextColor(WHITE.r, WHITE.g, WHITE.b);
  pdf.text(badgeText, cardX + innerPad + 3, yPos);

  // Score
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.setTextColor(255, 255, 255);
  pdf.text(`Score: ${claim.risk_score}/100`, cardX + innerPad + badgeW + 5, yPos);

  // Issue type (right-aligned)
  pdf.text(issueType, cardX + cardW - innerPad, yPos, { align: 'right' });

  // --- 3. Draw body content (dark text on white bg) ---

  yPos = bodyY + 4;

  // Claim text
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(10);
  pdf.setTextColor(DARK_GREY.r, DARK_GREY.g, DARK_GREY.b);
  pdf.text(claimLines, cardX + innerPad, yPos);
  yPos += claimLines.length * 5 + 4;

  // Separator
  pdf.setDrawColor(LIGHT_GREY.r, LIGHT_GREY.g, LIGHT_GREY.b);
  pdf.setLineWidth(0.2);
  pdf.line(cardX + innerPad, yPos, cardX + cardW - innerPad, yPos);
  yPos += 5;

  // Issue description heading
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
  pdf.text('ISSUE DESCRIPTION', cardX + innerPad, yPos);
  yPos += 4;

  // Issue description
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(80, 80, 80);
  pdf.text(issueLines, cardX + innerPad, yPos);
  yPos += issueLines.length * 4 + 5;

  // Legislation badge row
  pdf.setFillColor(LIME.r, LIME.g, LIME.b);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  const jurBadgeW = pdf.getTextWidth(jurisdiction) + 5;
  pdf.roundedRect(cardX + innerPad, yPos - 3, jurBadgeW, 5, 1, 1, 'F');
  pdf.setTextColor(DARK.r, DARK.g, DARK.b);
  pdf.text(jurisdiction, cardX + innerPad + 2.5, yPos - 0.3);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
  const legAvailW = textW - jurBadgeW - 3;
  const legLines = pdf.splitTextToSize(legText, legAvailW);
  pdf.text(legLines, cardX + innerPad + jurBadgeW + 3, yPos);
  yPos += legLines.length * 4 + 3;

  // Suggestion box
  const suggBoxHeight = suggestionLines.length * 4 + 10;
  pdf.setFillColor(236, 253, 245);
  pdf.setDrawColor(34, 197, 94);
  pdf.setLineWidth(0.3);
  pdf.roundedRect(cardX + innerPad, yPos - 1, textW, suggBoxHeight, 2, 2, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7);
  pdf.setTextColor(22, 101, 52);
  pdf.text('SUGGESTION', cardX + innerPad + 4, yPos + 4);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(22, 101, 52);
  pdf.text(suggestionLines, cardX + innerPad + 4, yPos + 9);
  yPos += suggBoxHeight + 3;

  // Suggested revision
  if (claim.suggested_revision && revisionLines.length > 0) {
    const revBoxHeight = revisionLines.length * 4 + 9;
    pdf.setFillColor(248, 248, 248);
    pdf.roundedRect(cardX + innerPad, yPos - 1, textW, revBoxHeight, 2, 2, 'F');

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7);
    pdf.setTextColor(MID_GREY.r, MID_GREY.g, MID_GREY.b);
    pdf.text('SUGGESTED REVISION', cardX + innerPad + 4, yPos + 3.5);

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    pdf.text(revisionLines, cardX + innerPad + 4, yPos + 8.5);
    yPos += revBoxHeight + 3;
  }

  return cardTopY + cardHeight + 8; // card bottom + spacing
}

function estimatePages(result: AnalysisResult): number {
  // Rough estimate for footer numbering on first pass
  let pages = 1; // Cover
  if (result.claims && result.claims.length > 0) {
    pages += Math.ceil(result.claims.length / 3); // ~3 claims per page
  }
  pages += 1; // Recommendations + CTA
  return pages;
}
