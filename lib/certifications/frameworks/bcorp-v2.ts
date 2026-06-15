// B Lab Standards V2.1 (published 8 April 2025, amended 12 Aug 2025) — the full
// requirement set for the new B Corp standard: Foundation Requirements + the 7
// Impact Topics, with the real two-level sub-requirement IDs, per-requirement
// year phasing, and size-band + sector applicability.
//
// Source of truth for the bcorp_2026 seed migration and the readiness model.
// Paraphrased from B Lab's official "Impact Topic Summary" knowledge-base
// articles (no long verbatim copyrighted text).
//
// Pure data: no server / Supabase imports.

import type { ProbeId } from './types';

// B Lab's 7 size bands. Size = the lesser of worker count or USD revenue.
// nw = company without workers; mi micro; sm small; md medium; lg large
// (250+ emp / $75M+); xl extra large; xxl extra-extra large.
export type SizeBand = 'nw' | 'mi' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';
export const ALL_BANDS: SizeBand[] = ['nw', 'mi', 'sm', 'md', 'lg', 'xl', 'xxl'];
// Worker-facing topics never apply to companies without workers.
export const WORKER_BANDS: SizeBand[] = ['mi', 'sm', 'md', 'lg', 'xl', 'xxl'];
export const MD_UP: SizeBand[] = ['md', 'lg', 'xl', 'xxl'];
export const LG_UP: SizeBand[] = ['lg', 'xl', 'xxl'];
export const XL_UP: SizeBand[] = ['xl', 'xxl'];

export interface BCorpRequirement {
  /** Official sub-requirement ID, e.g. 'FW2.7'. */
  code: string;
  /** Topic-area label (matches bcorp-structure.ts keys). */
  topic: string;
  name: string;
  summary: string;
  /** First year it applies (0 = needed to certify now, 3/5 = improvement). */
  year: 0 | 3 | 5;
  /** Size bands this applies to. */
  bands: SizeBand[];
  /** Sector carve-out note where applicability is sector-gated. */
  sector?: string;
  /** Activity / sector / material-triggered (only applies if condition holds). */
  conditional?: boolean;
  /** Shared auto-evidence probe. */
  probe?: ProbeId | null;
  /** Old (pre-v2.1) code this supersedes, for evidence-preserving migration. */
  legacy?: string;
}

export const BCORP_TOPIC_ORDER = [
  'foundation',
  'Purpose & Stakeholder Governance',
  'Fair Work',
  'Justice, Equity, Diversity & Inclusion',
  'Human Rights',
  'Climate Action',
  'Environmental Stewardship & Circularity',
  'Government Affairs & Collective Action',
] as const;

const T = {
  FR: 'foundation',
  PSG: 'Purpose & Stakeholder Governance',
  FW: 'Fair Work',
  JEDI: 'Justice, Equity, Diversity & Inclusion',
  HR: 'Human Rights',
  CA: 'Climate Action',
  ESC: 'Environmental Stewardship & Circularity',
  GACA: 'Government Affairs & Collective Action',
} as const;

export const BCORP_V21_REQUIREMENTS: BCorpRequirement[] = [
  // ── Foundation Requirements ────────────────────────────────────────────────
  { code: 'FR1', topic: T.FR, name: 'Eligibility', summary: 'Be a legally incorporated business operating 12+ months and compliant with local and national law.', year: 0, bands: ALL_BANDS, legacy: 'FR-E-001' },
  { code: 'FR1.2', topic: T.FR, name: 'Ineligible activities screen', summary: 'Less than 1% of revenue from prohibited sectors (fossil fuels, gambling, pornography, prisons/detention, tobacco, weapons).', year: 0, bands: ALL_BANDS, legacy: 'FR-E-003' },
  { code: 'FR2', topic: T.FR, name: 'B Corp Legal Requirement', summary: 'Adopt a stakeholder-governance legal structure / mission lock and sign the Declaration of Interdependence.', year: 0, bands: ALL_BANDS, probe: 'governancePolicies', legacy: 'FR-L-001' },
  { code: 'FR3', topic: T.FR, name: 'Risk Standard (risk profiling)', summary: 'Complete B Lab’s risk profiling tool; the result activates extra due-diligence sub-requirements in PSG, ESC and Human Rights.', year: 0, bands: ALL_BANDS, legacy: 'FR-R-001' },

  // ── Purpose & Stakeholder Governance ────────────────────────────────────────
  { code: 'PSG1.1', topic: T.PSG, name: 'Establish a public purpose', summary: 'Adopt and publish a purpose that commits the company to creating a meaningful positive impact.', year: 0, bands: ALL_BANDS, probe: 'governanceMission', legacy: 'IT1-Y0-001' },
  { code: 'PSG2.1', topic: T.PSG, name: 'Stakeholder input mechanism', summary: 'Have a mechanism to consider and involve stakeholders in decisions.', year: 0, bands: ['nw', 'mi', 'sm', 'md'], probe: 'governancePolicies', legacy: 'IT1-Y0-002' },
  { code: 'PSG2.2', topic: T.PSG, name: 'Stakeholder governance policy', summary: 'Adopt a documented stakeholder governance policy.', year: 0, bands: LG_UP, probe: 'governancePolicies' },
  { code: 'PSG2.3', topic: T.PSG, name: 'Materiality assessment', summary: 'Conduct a regular materiality assessment of your most material topics.', year: 0, bands: LG_UP },
  { code: 'PSG2.4', topic: T.PSG, name: 'Targets on other material topics', summary: 'Set targets and report annually on material topics not covered by the Standard.', year: 0, bands: LG_UP },
  { code: 'PSG2.5', topic: T.PSG, name: 'Stakeholders in capital decisions', summary: 'Consider stakeholder interests in dividend and share-buyback decisions.', year: 3, bands: ['xxl'] },
  { code: 'PSG3.1', topic: T.PSG, name: 'Grievance procedure', summary: 'Maintain a publicly accessible grievance procedure for stakeholders.', year: 0, bands: ['nw', 'mi', 'sm', 'md'], probe: 'governancePolicies' },
  { code: 'PSG3.2', topic: T.PSG, name: 'Track grievances', summary: 'Track grievances and assign accountability for handling them.', year: 0, bands: ['mi', 'sm', 'md'] },
  { code: 'PSG3.3', topic: T.PSG, name: 'Grievance procedure (large)', summary: 'Maintain a publicly accessible grievance procedure for stakeholders.', year: 0, bands: LG_UP, probe: 'governancePolicies' },
  { code: 'PSG3.4', topic: T.PSG, name: 'Track + report grievances', summary: 'Track grievances, assign accountability and report on them internally and publicly.', year: 0, bands: LG_UP },
  { code: 'PSG4.1', topic: T.PSG, name: 'Responsible marketing principles', summary: 'Adopt principles for responsible marketing and PR.', year: 0, bands: ['mi', 'sm'] },
  { code: 'PSG4.2', topic: T.PSG, name: 'Responsible marketing policy', summary: 'Adopt a responsible marketing/PR policy overseen by an executive or the governing body.', year: 0, bands: MD_UP, probe: 'governancePolicies' },
  { code: 'PSG5.1', topic: T.PSG, name: 'Governing body oversight', summary: 'The highest governing body monitors purpose, impact and stakeholders.', year: 0, bands: WORKER_BANDS },
  { code: 'PSG5.2', topic: T.PSG, name: 'Oversight in terms of reference', summary: 'Enshrine these monitoring duties in the governing body’s terms of reference.', year: 0, bands: LG_UP },
  { code: 'PSG5.3', topic: T.PSG, name: 'Executive impact targets', summary: 'Each executive carries at least one annual social or environmental target.', year: 3, bands: LG_UP },
  { code: 'PSG5.4', topic: T.PSG, name: 'Impact targets in incentive pay', summary: 'Integrate social/environmental targets into existing executive incentive pay (where such a scheme exists).', year: 3, bands: LG_UP, conditional: true },
  { code: 'PSG5.5', topic: T.PSG, name: 'Impact targets in reviews', summary: 'Include social/environmental targets in managers’ performance reviews.', year: 3, bands: ['xxl'] },
  { code: 'PSG6.1', topic: T.PSG, name: 'Annual impact report', summary: 'Publish an annual public impact report approved by the governing body.', year: 3, bands: ['lg', 'xl'] },
  { code: 'PSG6.2', topic: T.PSG, name: 'Impact report to a standard', summary: 'Publish an annual public impact report using a recognised third-party standard.', year: 3, bands: ['xxl'] },
  { code: 'PSG6.3', topic: T.PSG, name: 'Workforce capability', summary: 'Assess workers’ capability to enact the social/environmental strategy.', year: 3, bands: LG_UP, probe: 'training' },

  // ── Fair Work ───────────────────────────────────────────────────────────────
  { code: 'FW1.1', topic: T.FW, name: 'Employment contracts', summary: 'Provide a signed employment contract or offer letter for every employee.', year: 0, bands: WORKER_BANDS, legacy: 'IT2-Y0-003' },
  { code: 'FW1.2', topic: T.FW, name: 'Variable-schedule fairness', summary: 'Give equal cancellation periods/protections for variable work schedules.', year: 0, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'FW2.1', topic: T.FW, name: 'No wage-history requests', summary: 'Do not request applicants’ prior wage history.', year: 0, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'FW2.2', topic: T.FW, name: 'Pay transparency to workers', summary: 'Tell workers how their wage is set and their benefit entitlements.', year: 0, bands: WORKER_BANDS },
  { code: 'FW2.3', topic: T.FW, name: 'Wage scales', summary: 'Maintain internal wage scales.', year: 3, bands: LG_UP, probe: 'compensation' },
  { code: 'FW2.4', topic: T.FW, name: 'Calculate gender wage gap', summary: 'Calculate the gender wage gap.', year: 0, bands: LG_UP, probe: 'compensation', legacy: 'IT2-Y3-002' },
  { code: 'FW2.5', topic: T.FW, name: 'Disclose gender wage gap', summary: 'Publicly share the gender wage gap(s).', year: 0, bands: XL_UP },
  { code: 'FW2.6', topic: T.FW, name: 'Close the wage gap', summary: 'Keep the gap closed, reduce it, or justify why it remains.', year: 3, bands: LG_UP },
  { code: 'FW2.7', topic: T.FW, name: 'Equal pay for equal value', summary: 'Evaluate equal pay for work of equal value.', year: 5, bands: XL_UP },
  { code: 'FW2.8', topic: T.FW, name: 'Fair wages for lowest-paid', summary: 'Ensure fair wages for the lowest-paid: pay a living wage, pay a collectively-bargained wage, or calculate the living-wage gap with a closure plan.', year: 3, bands: WORKER_BANDS, probe: 'compensation', legacy: 'IT2-Y0-001' },
  { code: 'FW3.1', topic: T.FW, name: 'Employee representation', summary: 'Provide a formal employee representation mechanism.', year: 3, bands: XL_UP, legacy: 'IT2-Y3-001' },
  { code: 'FW3.2', topic: T.FW, name: 'Use worker feedback', summary: 'Consider worker feedback on decisions affecting them.', year: 0, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'FW4.1', topic: T.FW, name: 'Measure workplace culture', summary: 'Measure workplace culture regularly.', year: 0, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'FW4.2', topic: T.FW, name: 'Improve workplace culture', summary: 'Have a plan to continuously improve workplace culture.', year: 3, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'FW4.3', topic: T.FW, name: 'Culture data by gender', summary: 'Disaggregate culture data by gender identity / sex at birth.', year: 3, bands: LG_UP, probe: 'workforceDemographics' },
  { code: 'FW4.4', topic: T.FW, name: 'Culture data by identity', summary: 'Disaggregate culture data by one additional social identity.', year: 3, bands: LG_UP, probe: 'workforceDemographics' },
  { code: 'FW5.1', topic: T.FW, name: 'Comprehensive benefits', summary: 'Provide a comprehensive set of worker benefits beyond statutory minimums.', year: 5, bands: WORKER_BANDS, legacy: 'IT2-Y5-001' },

  // ── Justice, Equity, Diversity & Inclusion ─────────────────────────────────
  { code: 'JEDI1.1', topic: T.JEDI, name: 'Collect JEDI data', summary: 'Collect workforce diversity and experience data to inform JEDI actions.', year: 0, bands: ALL_BANDS, probe: 'workforceDemographics', legacy: 'IT3-Y3-001' },
  { code: 'JEDI1.2', topic: T.JEDI, name: 'Additional identity data', summary: 'Collect worker metrics on one additional social identity.', year: 3, bands: LG_UP, probe: 'workforceDemographics' },
  { code: 'JEDI2', topic: T.JEDI, name: 'Choose & implement JEDI actions', summary: 'Pick and implement JEDI actions from B Lab’s menu (Foundation / within-workplace / beyond-workplace), scaling the number with size and certification year.', year: 0, bands: ALL_BANDS, legacy: 'IT3-Y0-001' },

  // ── Human Rights ────────────────────────────────────────────────────────────
  { code: 'HR1.1', topic: T.HR, name: 'Human rights commitment', summary: 'Make a public commitment to respecting human rights.', year: 0, bands: ['mi', 'sm'], probe: 'governancePolicies', legacy: 'IT4-Y0-001' },
  { code: 'HR1.2', topic: T.HR, name: 'Human rights policy', summary: 'Adopt a public human-rights policy.', year: 0, bands: MD_UP, sector: 'Medium excludes Service with a Minor Footprint', probe: 'governancePolicies' },
  { code: 'HR2.1', topic: T.HR, name: 'Identify salient issues', summary: 'Identify your salient human-rights issues.', year: 0, bands: MD_UP, sector: 'Medium excludes Service-Minor' },
  { code: 'HR2.2', topic: T.HR, name: 'Disclose salient issues', summary: 'Publicly share your salient human-rights issues.', year: 3, bands: MD_UP, sector: 'Medium excludes Service-Minor' },
  { code: 'HR2.3', topic: T.HR, name: 'Human rights strategy', summary: 'Adopt a strategy to address salient issues.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor', legacy: 'IT4-Y3-001' },
  { code: 'HR2.4', topic: T.HR, name: 'Progress & evaluate', summary: 'Make progress on the strategy and evaluate its effectiveness.', year: 5, bands: MD_UP, sector: 'excl. Service-Minor' },
  { code: 'HR2.5', topic: T.HR, name: 'Disclose effectiveness', summary: 'Publicly share strategy effectiveness.', year: 5, bands: ['xxl'], sector: 'excl. Service-Minor' },
  { code: 'HR2.6', topic: T.HR, name: 'Policies address issues', summary: 'Ensure policies/procedures address the salient issues.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor' },
  { code: 'HR2.7', topic: T.HR, name: 'Worker guidance', summary: 'Give workers in relevant roles human-rights implementation guidance.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor', probe: 'training' },
  { code: 'HR3.1', topic: T.HR, name: 'Impact information process', summary: 'Have a process to collect, prioritise and escalate information on negative impacts.', year: 0, bands: MD_UP, sector: 'Medium excludes Service-Minor' },
  { code: 'HR3.2', topic: T.HR, name: 'Prevent & remediate', summary: 'Prevent, mitigate and remediate negative human-rights impacts.', year: 3, bands: MD_UP, sector: 'Medium excludes Service-Minor', legacy: 'IT4-Y5-001' },
  { code: 'HR3.3', topic: T.HR, name: 'Client/project screening', summary: 'Assess and mitigate human-rights impacts of clients and projects.', year: 0, bands: ALL_BANDS, sector: 'Service with a Minor Footprint only', conditional: true },
  { code: 'HR3.4', topic: T.HR, name: 'Investment screening', summary: 'Assess and mitigate human-rights impacts of investments.', year: 0, bands: ALL_BANDS, sector: 'investing/advising only', conditional: true },
  { code: 'HR3.5', topic: T.HR, name: 'Human Rights Impact Assessment', summary: 'Carry out a Human Rights Impact Assessment.', year: 5, bands: XL_UP },
  { code: 'HR3.6', topic: T.HR, name: 'Conflict-affected due diligence', summary: 'Apply additional due diligence for operations in conflict-affected areas.', year: 3, bands: ['sm', 'md', 'lg', 'xl', 'xxl'], conditional: true },
  { code: 'HR4.1', topic: T.HR, name: 'Supplier oversight limits', summary: 'Address limits on your ability to engage and monitor suppliers.', year: 3, bands: MD_UP, sector: 'Manufacturing + Wholesale/Retail' },
  { code: 'HR4.2', topic: T.HR, name: 'Human rights in procurement', summary: 'Consider human-rights impacts in procurement decisions.', year: 0, bands: ['nw', 'mi', 'sm', 'md'], sector: 'Medium: service sectors', probe: 'supplierEsg', legacy: 'IT4-Y0-002' },
  { code: 'HR4.3', topic: T.HR, name: 'Human rights in procurement (sector)', summary: 'Consider human-rights impacts in procurement decisions.', year: 0, bands: MD_UP, sector: 'Medium Mfg/Ag/W-R; L–XXL Service-Minor', probe: 'supplierEsg' },
  { code: 'HR4.4', topic: T.HR, name: 'Engage suppliers on issues', summary: 'Work with suppliers to prevent/mitigate the most salient issues.', year: 0, bands: LG_UP, sector: 'excl. Service-Minor', probe: 'supplierEsg' },
  { code: 'HR4.5', topic: T.HR, name: 'Strengthen sourcing terms', summary: 'Increase human-rights commitments across sourcing documents.', year: 5, bands: LG_UP, sector: 'Mfg/Ag/Wholesale-Retail' },
  { code: 'HR4.6', topic: T.HR, name: 'Trace high-risk materials', summary: 'Adopt a time-bound plan to trace high-risk raw materials to origin.', year: 3, bands: XL_UP, sector: 'Mfg/Ag/W-R', conditional: true },
  { code: 'HR4.7', topic: T.HR, name: 'Trace more materials', summary: 'Trace additional high-risk raw materials to origin.', year: 5, bands: XL_UP, sector: 'Mfg/Ag/W-R', conditional: true },
  { code: 'HR4.8', topic: T.HR, name: 'Act on material risks', summary: 'Work with suppliers on high-risk raw-material impacts.', year: 5, bands: XL_UP, sector: 'Mfg/Ag/W-R', conditional: true },
  { code: 'HR4.9', topic: T.HR, name: 'Living-wage gaps in contracts', summary: 'Look for living-wage gaps in service contracts.', year: 0, bands: MD_UP, sector: 'Service-Minor' },
  { code: 'HR4.10', topic: T.HR, name: 'Living wage in procurement', summary: 'Reference living wage in service procurement.', year: 3, bands: MD_UP, sector: 'Service-Minor' },
  { code: 'HR4.11', topic: T.HR, name: 'Supply-chain wage plan', summary: 'Adopt a plan to address living wage / income / collective bargaining in the supply chain.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor' },

  // ── Climate Action ──────────────────────────────────────────────────────────
  { code: 'CA1.1', topic: T.CA, name: 'Measure & disclose GHG', summary: 'Measure Scope 1, 2 and 3 emissions annually and disclose them publicly.', year: 0, bands: LG_UP, probe: 'emissionsInventory', legacy: 'IT5-Y0-001' },
  { code: 'CA1.2', topic: T.CA, name: 'Verify GHG inventory', summary: 'Have the GHG inventory independently third-party verified.', year: 0, bands: LG_UP },
  { code: 'CA2.1', topic: T.CA, name: 'Climate action plan', summary: 'Publish a climate action plan (the SME path in place of formal SBTi targets).', year: 0, bands: ['nw', 'mi', 'sm', 'md'], probe: 'emissionsTarget', legacy: 'IT5-Y0-002' },
  { code: 'CA2.2', topic: T.CA, name: 'Science-based targets', summary: 'Set SBTi-validated (or third-party verified) emissions targets.', year: 3, bands: LG_UP, probe: 'emissionsTarget' },
  { code: 'CA2.3', topic: T.CA, name: 'Climate transition plan', summary: 'Adopt a plan for a just contribution to net zero by 2050.', year: 3, bands: LG_UP, probe: 'reductionPlan', legacy: 'IT5-Y3-002' },
  { code: 'CA2.4', topic: T.CA, name: 'Just-transition consultation', summary: 'Consult workers and stakeholders on the transition plan.', year: 3, bands: LG_UP, sector: 'excl. Service-Minor' },
  { code: 'CA3.1', topic: T.CA, name: 'Exec incentive alignment', summary: 'Tie climate targets to executive remuneration.', year: 3, bands: LG_UP, sector: 'excl. Service-Minor' },
  { code: 'CA3.2', topic: T.CA, name: 'Net-zero advocacy', summary: 'Advocate for global net zero by 2050.', year: 3, bands: ['xxl'], legacy: 'IT5-Y5-001' },
  { code: 'CA3.3', topic: T.CA, name: 'Progress & evaluate (SME)', summary: 'Make progress on the plan and evaluate its effectiveness.', year: 3, bands: ['nw', 'mi', 'sm', 'md'], probe: 'reductionPlan' },
  { code: 'CA3.4', topic: T.CA, name: 'Transition plan progress', summary: 'Make progress on the transition plan.', year: 5, bands: LG_UP, probe: 'metricTrend' },
  { code: 'CA3.5', topic: T.CA, name: 'Just-transition actions', summary: 'Implement just-transition measures.', year: 5, bands: LG_UP, sector: 'excl. Service-Minor' },
  { code: 'CA3.6', topic: T.CA, name: 'Disclose progress (SME)', summary: 'Publicly disclose plan progress.', year: 3, bands: ['nw', 'mi', 'sm', 'md'] },
  { code: 'CA3.7', topic: T.CA, name: 'Annual transition disclosure', summary: 'Annually disclose transition progress publicly.', year: 5, bands: LG_UP },

  // ── Environmental Stewardship & Circularity ────────────────────────────────
  { code: 'ESC1.1', topic: T.ESC, name: 'Monitor waste', summary: 'Monitor the waste you produce and where it ends up.', year: 0, bands: WORKER_BANDS, sector: 'excl. Service-Minor', probe: 'wasteData', legacy: 'IT6-Y0-002' },
  { code: 'ESC1.2', topic: T.ESC, name: 'Monitor energy', summary: 'Monitor your energy use.', year: 0, bands: WORKER_BANDS, sector: 'excl. Service-Minor', probe: 'energyData', legacy: 'IT6-Y0-001' },
  { code: 'ESC1.3', topic: T.ESC, name: 'Monitor water', summary: 'Monitor water consumption and withdrawal.', year: 0, bands: WORKER_BANDS, sector: 'excl. Service-Minor', probe: 'waterData', legacy: 'IT6-Y3-002' },
  { code: 'ESC1.4', topic: T.ESC, name: 'Water-stressed facilities', summary: 'Identify facilities in water-stressed areas and monitor their use.', year: 0, bands: MD_UP, sector: 'excl. Service-Minor', probe: 'waterData' },
  { code: 'ESC1.5', topic: T.ESC, name: 'Ecologically sensitive areas', summary: 'Identify facilities in/near ecologically sensitive areas and their impacts.', year: 0, bands: MD_UP, sector: 'Manufacturing & Agriculture' },
  { code: 'ESC1.6', topic: T.ESC, name: 'Animal welfare', summary: 'Monitor animal welfare in operations.', year: 0, bands: WORKER_BANDS, conditional: true },
  { code: 'ESC1.7', topic: T.ESC, name: 'Environmental impact assessment', summary: 'Assess actual/potential environmental impacts across operations and value chain.', year: 0, bands: MD_UP, sector: 'excl. Service-Minor' },
  { code: 'ESC1.8', topic: T.ESC, name: 'Public disclosure', summary: 'Publicly share material environmental issues.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor' },
  { code: 'ESC2.1', topic: T.ESC, name: 'Environmental strategy', summary: 'Adopt a strategy to address negative environmental impacts.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor', legacy: 'IT6-Y3-001' },
  { code: 'ESC2.2', topic: T.ESC, name: 'Biodiversity transition plan', summary: 'Adopt a plan to halt and reverse biodiversity loss.', year: 3, bands: ['md', 'lg', 'xxl'], sector: 'Medium/Large Mfg/Ag; XXL all', legacy: 'IT6-Y5-001' },
  { code: 'ESC2.3', topic: T.ESC, name: 'Water stewardship strategy', summary: 'Limit water use to sustainable thresholds.', year: 3, bands: ['md', 'lg', 'xl', 'xxl'], sector: 'Medium Mfg/Ag' },
  { code: 'ESC2.4', topic: T.ESC, name: 'Environmental policies', summary: 'Adopt policies covering your material impact areas.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor', probe: 'governancePolicies' },
  { code: 'ESC2.5', topic: T.ESC, name: 'Worker guidance', summary: 'Train relevant workers to implement the environmental policies.', year: 3, bands: MD_UP, sector: 'excl. Service-Minor', probe: 'training' },
  { code: 'ESC2.6', topic: T.ESC, name: 'Client/project screening', summary: 'Assess the environmental impact of clients and projects.', year: 0, bands: ALL_BANDS, sector: 'Service-Minor only', conditional: true },
  { code: 'ESC2.7', topic: T.ESC, name: 'Investment screening', summary: 'Assess and mitigate the environmental impact of investments.', year: 0, bands: ALL_BANDS, sector: 'Service-Minor only', conditional: true },
  { code: 'ESC3.1', topic: T.ESC, name: 'Monitor material inflows', summary: 'Monitor the materials flowing into your products and operations.', year: 0, bands: LG_UP, sector: 'excl. Service-Minor', probe: 'productLca' },
  { code: 'ESC3.2', topic: T.ESC, name: 'Reduce virgin materials', summary: 'Reduce use of virgin non-renewable materials.', year: 3, bands: LG_UP, sector: 'excl. Service-Minor' },
  { code: 'ESC3.3', topic: T.ESC, name: 'Circular product design', summary: 'Design for single-use avoidance, durability or recirculation.', year: 3, bands: ['sm', 'md', 'lg', 'xl', 'xxl'], sector: 'excl. Service-Minor', probe: 'productLcaEol' },
  { code: 'ESC3.4', topic: T.ESC, name: 'Recovery infrastructure', summary: 'Understand recovery infrastructure in your sales markets.', year: 0, bands: ['xxl'], sector: 'excl. Service-Minor' },
  { code: 'ESC3.5', topic: T.ESC, name: 'End-of-life recovery', summary: 'Increase product and packaging recovery at end of life.', year: 3, bands: ['xxl'], sector: 'excl. Service-Minor', probe: 'productLcaEol' },
  { code: 'ESC4.1', topic: T.ESC, name: 'Implement & mitigate', summary: 'Take action to prevent and mitigate environmental impacts.', year: 3, bands: ['sm', 'md', 'lg', 'xl', 'xxl'] },
  { code: 'ESC4.2', topic: T.ESC, name: 'Strategy progress', summary: 'Make progress on and evaluate the environmental strategy.', year: 5, bands: MD_UP, sector: 'excl. Service-Minor', probe: 'metricTrend' },
  { code: 'ESC4.3', topic: T.ESC, name: 'Biodiversity progress', summary: 'Make progress on and evaluate the biodiversity plan.', year: 5, bands: ['md', 'lg', 'xxl'], sector: 'Medium/Large Mfg/Ag; XXL all' },
  { code: 'ESC4.4', topic: T.ESC, name: 'Water progress', summary: 'Make progress on and evaluate the water strategy.', year: 5, bands: ['md', 'lg', 'xl', 'xxl'], sector: 'Medium Mfg/Ag' },
  { code: 'ESC4.5', topic: T.ESC, name: 'Public strategy reporting', summary: 'Publicly report the effectiveness of the environmental strategy.', year: 5, bands: ['xxl'], sector: 'excl. Service-Minor' },
  { code: 'ESC5.1', topic: T.ESC, name: 'Procurement impact (smaller)', summary: 'Consider environmental impacts in procurement.', year: 0, bands: ['nw', 'mi', 'sm', 'md'], sector: 'Medium: service sectors', probe: 'supplierEsg' },
  { code: 'ESC5.2', topic: T.ESC, name: 'Procurement impact (larger)', summary: 'Consider environmental impacts in procurement.', year: 0, bands: MD_UP, sector: 'Medium W-R/Mfg/Ag; L–XXL Service-Minor', probe: 'supplierEsg' },
  { code: 'ESC5.3', topic: T.ESC, name: 'Supplier engagement', summary: 'Work with suppliers on their material environmental impacts.', year: 0, bands: LG_UP, sector: 'excl. Service-Minor', probe: 'supplierEsg' },
  { code: 'ESC5.4', topic: T.ESC, name: 'Trace high-risk materials', summary: 'Adopt a time-bound plan to trace high-risk raw-material origins.', year: 3, bands: ['xxl'], sector: 'W-R/Mfg/Ag', conditional: true },
  { code: 'ESC5.5', topic: T.ESC, name: 'Deforestation-free sourcing', summary: 'Source deforestation-free raw materials.', year: 3, bands: ['xxl'], sector: 'W-R/Mfg/Ag', conditional: true },
  { code: 'ESC5.6', topic: T.ESC, name: 'Tracing expansion', summary: 'Trace more high-risk materials to origin.', year: 5, bands: ['xxl'], sector: 'W-R/Mfg/Ag' },
  { code: 'ESC5.7', topic: T.ESC, name: 'High-risk supplier engagement', summary: 'Work with suppliers on high-risk material impacts.', year: 5, bands: ['xxl'], sector: 'W-R/Mfg/Ag' },

  // ── Government Affairs & Collective Action ──────────────────────────────────
  { code: 'GACA1.1', topic: T.GACA, name: 'Responsible lobbying policy', summary: 'Adopt a public policy on responsible lobbying.', year: 0, bands: ALL_BANDS, probe: 'governancePolicies', legacy: 'IT7-Y0-001' },
  { code: 'GACA1.2', topic: T.GACA, name: 'Disclose lobbying (large)', summary: 'Publicly share lobbying positions and political contributions annually.', year: 0, bands: LG_UP },
  { code: 'GACA1.3', topic: T.GACA, name: 'Disclose lobbying (smaller)', summary: 'Publicly share lobbying positions and political contributions annually.', year: 3, bands: ['nw', 'mi', 'sm', 'md'] },
  { code: 'GACA2', topic: T.GACA, name: 'Collective action', summary: 'Take part in collective action toward a regenerative economy, scaling the number of actions with size and year; larger companies include a multi-stakeholder or policy-advocacy action.', year: 0, bands: ALL_BANDS, probe: 'community', legacy: 'IT7-Y0-002' },
  { code: 'GACA3.1', topic: T.GACA, name: 'Responsible tax policy', summary: 'Adopt a public responsible-tax policy.', year: 0, bands: ['xxl'], probe: 'governancePolicies' },
  { code: 'GACA3.2', topic: T.GACA, name: 'Country-by-country reporting', summary: 'Publicly share country-by-country tax reporting annually.', year: 3, bands: ['xxl'] },
];
