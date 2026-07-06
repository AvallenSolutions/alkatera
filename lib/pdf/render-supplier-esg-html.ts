import 'server-only';
import { ESG_QUESTIONS, ESG_SECTIONS } from '@/lib/supplier-esg/questions';
import { escapeHtml } from '@/lib/utils/escape-html';

export interface ReportSupplier {
  name: string;
  country: string | null;
  city: string | null;
  sector: string | null;
  tier: string | null;
  submitted: boolean;
  verified: boolean;
  scoreTotal: number | null;
  scoreLabour: number | null;
  scoreEthics: number | null;
  scoreEnvironment: number | null;
  scoreRating: string | null;
  answers: Record<string, string> | null;
}

export interface ReportCoverage {
  tierBasis: 'tier_1' | 'all';
  denominator: number;
  assessed: number;
  verified: number;
  coveragePct: number;
  avgLabour: number | null;
  avgEthics: number | null;
  distribution: { leader: number; progressing: number; needs_improvement: number };
}

export interface SupplierEsgReportData {
  orgName: string;
  generatedAt: string; // formatted date string
  coverage: ReportCoverage;
  suppliers: ReportSupplier[];
}

const ANSWER_LABELS: Record<string, string> = {
  yes: 'Yes',
  partial: 'Partial',
  no: 'No',
  na: 'N/A',
};

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1 (direct)',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

function answerCell(answer: string | undefined): string {
  const label = answer ? ANSWER_LABELS[answer] ?? answer : '—';
  const cls = answer ? `a-${answer}` : 'a-none';
  return `<span class="ans ${cls}">${escapeHtml(label)}</span>`;
}

function supplierSection(s: ReportSupplier): string {
  const answers = s.answers ?? {};
  const location = [s.city, s.country].filter(Boolean).map((x) => escapeHtml(String(x))).join(', ') || 'Not specified';
  const tier = s.tier ? TIER_LABELS[s.tier] ?? s.tier : 'Unclassified';
  const status = s.verified ? 'Verified by alkatera' : s.submitted ? 'Self-reported (submitted)' : 'In progress';

  const sectionsHtml = ESG_SECTIONS.map((section) => {
    const qs = ESG_QUESTIONS.filter((q) => q.section === section.key && answers[q.id]);
    if (qs.length === 0) return '';
    const rows = qs
      .map(
        (q) =>
          `<tr><td class="q">${escapeHtml(q.text)}</td><td class="r">${answerCell(answers[q.id])}</td></tr>`,
      )
      .join('');
    return `<h4>${escapeHtml(section.label)}</h4><table class="qa">${rows}</table>`;
  }).join('');

  const score = (v: number | null) => (v == null ? '—' : String(v));

  return `
    <div class="supplier">
      <div class="supplier-head">
        <h3>${escapeHtml(s.name)}</h3>
        <span class="status ${s.verified ? 'st-verified' : 'st-submitted'}">${escapeHtml(status)}</span>
      </div>
      <table class="meta">
        <tr><td>Sector</td><td>${escapeHtml(s.sector || 'Not specified')}</td><td>Location</td><td>${location}</td></tr>
        <tr><td>Supply-chain tier</td><td>${escapeHtml(tier)}</td><td>Overall ESG score</td><td>${score(s.scoreTotal)}${s.scoreRating ? ` (${escapeHtml(s.scoreRating.replace(/_/g, ' '))})` : ''}</td></tr>
        <tr><td>Labour &amp; human rights</td><td>${score(s.scoreLabour)}</td><td>Environment</td><td>${score(s.scoreEnvironment)}</td></tr>
      </table>
      ${sectionsHtml || '<p class="muted">No responses recorded.</p>'}
    </div>`;
}

export function renderSupplierEsgReportHtml(data: SupplierEsgReportData): string {
  const { orgName, generatedAt, coverage, suppliers } = data;
  const tierWord = coverage.tierBasis === 'tier_1' ? 'direct (Tier 1) suppliers' : 'suppliers';
  const pct = Math.round(coverage.coveragePct * 100);

  const suppliersHtml = suppliers.map(supplierSection).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1A1B1D; margin: 0; font-size: 12px; line-height: 1.5; }
  .page { padding: 40px 44px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; margin: 28px 0 8px; border-bottom: 2px solid #205E40; padding-bottom: 4px; }
  h3 { font-size: 14px; margin: 0; }
  h4 { font-size: 12px; margin: 14px 0 4px; color: #6F6F68; text-transform: uppercase; letter-spacing: 0.04em; }
  .sub { color: #6F6F68; font-size: 12px; margin: 0 0 24px; }
  .muted { color: #6F6F68; }
  .stats { display: flex; gap: 12px; margin: 12px 0 4px; flex-wrap: wrap; }
  .stat { border: 1px solid #D9D6CB; border-radius: 8px; padding: 10px 14px; min-width: 130px; }
  .stat .n { font-size: 22px; font-weight: 700; }
  .stat .l { font-size: 11px; color: #6F6F68; }
  .narrative { background: #F2F1EA; border-left: 3px solid #205E40; padding: 12px 16px; margin: 12px 0; }
  .supplier { border: 1px solid #D9D6CB; border-radius: 8px; padding: 16px; margin: 12px 0; page-break-inside: avoid; }
  .supplier-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .status { font-size: 10px; padding: 3px 8px; border-radius: 999px; }
  .st-verified { background: #d9f7e6; color: #047857; }
  .st-submitted { background: #e7eefc; color: #2B46C0; }
  table { width: 100%; border-collapse: collapse; }
  table.meta td { padding: 3px 6px; font-size: 11px; }
  table.meta td:nth-child(odd) { color: #6F6F68; width: 22%; }
  table.qa td { padding: 5px 6px; border-top: 1px solid #D9D6CB; vertical-align: top; }
  table.qa td.q { width: 80%; }
  table.qa td.r { text-align: right; }
  .ans { font-size: 11px; padding: 2px 8px; border-radius: 999px; white-space: nowrap; }
  .a-yes { background: #d9f7e6; color: #047857; }
  .a-partial { background: #fef0cd; color: #B45309; }
  .a-no { background: #fde2e1; color: #BE123C; }
  .a-na { background: #ECEAE3; color: #6F6F68; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #D9D6CB; color: #6F6F68; font-size: 10px; }
</style>
</head>
<body>
  <div class="page">
    <h1>Supply Chain ESG Due Diligence</h1>
    <p class="sub">${escapeHtml(orgName)} &middot; Generated ${escapeHtml(generatedAt)} via alkatera</p>

    <h2>Coverage summary</h2>
    <div class="stats">
      <div class="stat"><div class="n">${coverage.assessed} / ${coverage.denominator}</div><div class="l">${escapeHtml(tierWord)} assessed (${pct}%)</div></div>
      <div class="stat"><div class="n">${coverage.verified}</div><div class="l">verified by alkatera</div></div>
      <div class="stat"><div class="n">${coverage.avgLabour ?? '—'}</div><div class="l">avg labour &amp; human-rights score</div></div>
      <div class="stat"><div class="n">${coverage.distribution.leader} / ${coverage.distribution.progressing} / ${coverage.distribution.needs_improvement}</div><div class="l">leader / progressing / needs improvement</div></div>
    </div>
    <div class="narrative">
      <strong>${escapeHtml(orgName)}</strong> operates a supplier ESG due-diligence programme on the alkatera platform.
      Suppliers complete a structured self-assessment covering labour &amp; human rights, environment, ethics,
      health &amp; safety and management systems, and may upload supporting evidence. Responses are prioritised by
      supply-chain tier, focusing diligence on the most direct, highest-risk relationships first. This report
      summarises the responses collected to date. Items marked "Verified by alkatera" have been reviewed; others
      are supplier self-reported.
    </div>

    <h2>Supplier responses (${suppliers.length})</h2>
    ${suppliersHtml || '<p class="muted">No supplier responses collected yet.</p>'}

    <div class="footer">
      Generated by alkatera for B Corp supply-chain due-diligence evidence. Supplier self-assessments reflect
      information provided by each supplier. ${escapeHtml(generatedAt)}.
    </div>
  </div>
</body>
</html>`;
}
