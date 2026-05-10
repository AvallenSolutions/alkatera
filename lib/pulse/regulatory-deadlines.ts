/**
 * Pulse -- Regulatory compliance calendar.
 *
 * Curated reference of live UK / EU regulatory deadlines a drinks-industry
 * org should track. Update alongside lib/pulse/reference-shadow-prices.ts
 * each quarter as deadlines shift or new regimes land.
 *
 * Each entry says what's due, which regime it belongs to, how often, and
 * where to act. The UI filters to the next 12 months and sorts by due date.
 *
 * Sources in the comments next to each entry.
 */

export type DeadlineRegime = 'uk_ets' | 'cbam' | 'plastic_tax' | 'epr' | 'csrd' | 'streamlined';

/**
 * Whether this regime applies to a given org. Most drinks orgs are *not*
 * UK ETS operators or CBAM importers, so we default those off and only
 * fire when the org has explicitly opted in via organizations.feature_flags.
 *
 *   'always'                 — applies to every UK drinks org by default
 *   'flag:<key>'             — fires only when feature_flags[key] === true
 */
export type DeadlineApplicability =
  | 'always'
  | 'flag:uk_ets_operator'
  | 'flag:cbam_imports'
  | 'flag:csrd_in_scope'
  | 'flag:secr_in_scope';

export interface DeadlineEntry {
  id: string;
  regime: DeadlineRegime;
  regime_label: string;
  title: string;
  /** One short sentence in plain English: what's due and why it matters. */
  why_it_matters: string;
  description: string;
  /** ISO calendar recurrence rule or literal date pattern. */
  recurrence: 'annual' | 'quarterly' | 'monthly';
  /** Month (1-12) and day-of-month when the deadline hits each cycle. */
  month: number;
  day: number;
  /** URL in alkatera where the user can act. */
  action_href: string;
  /** Free-text source attribution. */
  source: string;
  /** Who this fires for. Defaults make most drinks orgs see EPR + Plastic
      Tax only; ETS / CBAM / CSRD / SECR are gated behind explicit flags. */
  applicability: DeadlineApplicability;
}

export const COMPLIANCE_DEADLINES: DeadlineEntry[] = [
  // UK ETS -------------------------------------------------------------------
  // Only large UK installations and intra-UK aviation operators are in scope;
  // standard drinks producers are not. Fires only when an org sets the flag.
  {
    id: 'uk_ets_verified_report',
    regime: 'uk_ets',
    regime_label: 'UK ETS',
    title: 'File last year\'s verified emissions (UK ETS)',
    why_it_matters:
      'You\'re a UK ETS operator. The Environment Agency needs your verified emissions for last year, signed off by an accredited verifier.',
    description:
      'Operators must submit their previous-year annual emissions report, verified by an accredited verifier, via the Environment Agency ETS registry.',
    recurrence: 'annual',
    month: 3,
    day: 31,
    action_href: '/data/scope-1-2/',
    source: 'UK ETS Order 2020; Environment Agency guidance',
    applicability: 'flag:uk_ets_operator',
  },
  {
    id: 'uk_ets_surrender',
    regime: 'uk_ets',
    regime_label: 'UK ETS',
    title: 'Buy and surrender carbon allowances (UK ETS)',
    why_it_matters:
      'Cover last year\'s verified emissions with one carbon allowance per tonne. Miss this and you owe the £100/t penalty plus the allowances.',
    description:
      'Surrender UK Emissions Trading Scheme allowances equal to the previous year\'s verified emissions.',
    recurrence: 'annual',
    month: 4,
    day: 30,
    action_href: '/pulse/financial/',
    source: 'UK ETS Order 2020 s.23',
    applicability: 'flag:uk_ets_operator',
  },
  // CBAM ---------------------------------------------------------------------
  // CBAM only covers iron/steel, aluminium, cement, fertilisers, hydrogen and
  // electricity imports into the EU. Drinks producers almost never trigger
  // it directly; gated behind a flag so we only fire for orgs that import
  // CBAM-covered goods.
  {
    id: 'cbam_q1_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Report Q1 import emissions (EU CBAM)',
    why_it_matters:
      'You import steel, aluminium, cement, fertilisers, hydrogen, or electricity into the EU. CBAM wants the embedded emissions from Q1.',
    description:
      'Quarterly CBAM report covering embedded emissions of CBAM-in-scope goods imported into the EU (iron/steel, aluminium, cement, fertilisers, hydrogen, electricity).',
    recurrence: 'quarterly',
    month: 4,
    day: 30,
    action_href: '/products',
    source: 'EU Regulation 2023/956; DG TAXUD guidance',
    applicability: 'flag:cbam_imports',
  },
  {
    id: 'cbam_q2_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Report Q2 import emissions (EU CBAM)',
    why_it_matters:
      'You import CBAM-covered goods into the EU. Q2 embedded emissions report due.',
    description:
      'Quarterly CBAM report covering Q2 embedded emissions of CBAM-in-scope imports.',
    recurrence: 'quarterly',
    month: 7,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
    applicability: 'flag:cbam_imports',
  },
  {
    id: 'cbam_q3_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Report Q3 import emissions (EU CBAM)',
    why_it_matters:
      'You import CBAM-covered goods into the EU. Q3 embedded emissions report due.',
    description:
      'Quarterly CBAM report covering Q3 embedded emissions.',
    recurrence: 'quarterly',
    month: 10,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
    applicability: 'flag:cbam_imports',
  },
  {
    id: 'cbam_q4_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Report Q4 import emissions (EU CBAM)',
    why_it_matters:
      'You import CBAM-covered goods into the EU. Q4 embedded emissions report due.',
    description:
      'Quarterly CBAM report covering Q4 embedded emissions.',
    recurrence: 'quarterly',
    month: 1,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
    applicability: 'flag:cbam_imports',
  },
  // Plastic Packaging Tax ----------------------------------------------------
  // Applies to anyone manufacturing in or importing into the UK 10+ tonnes of
  // plastic packaging in 12 months. Almost all UK drinks producers cross
  // this threshold via bottles, caps, cases, shrink-wrap. Default-on.
  {
    id: 'ppt_q1',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'File your Q1 plastic packaging numbers (PPT)',
    why_it_matters:
      'HMRC needs the weight of plastic packaging you made or imported in Jan to Mar, plus the share with under 30% recycled content (the bit you pay tax on).',
    description:
      'HMRC PPT return covering plastic packaging components manufactured in or imported into the UK during Q1. Due by end of the month after the accounting quarter.',
    recurrence: 'quarterly',
    month: 4,
    day: 30,
    action_href: '/products',
    source: 'HMRC PPT notice; Finance Act 2021 Part 2',
    applicability: 'always',
  },
  {
    id: 'ppt_q2',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'File your Q2 plastic packaging numbers (PPT)',
    why_it_matters:
      'HMRC needs your Apr to Jun plastic packaging tonnage and the share under 30% recycled.',
    description:
      'HMRC PPT return covering Q2 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 7,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
    applicability: 'always',
  },
  {
    id: 'ppt_q3',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'File your Q3 plastic packaging numbers (PPT)',
    why_it_matters:
      'HMRC needs your Jul to Sep plastic packaging tonnage and the share under 30% recycled.',
    description:
      'HMRC PPT return covering Q3 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 10,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
    applicability: 'always',
  },
  {
    id: 'ppt_q4',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'File your Q4 plastic packaging numbers (PPT)',
    why_it_matters:
      'HMRC needs your Oct to Dec plastic packaging tonnage and the share under 30% recycled.',
    description:
      'HMRC PPT return covering Q4 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 1,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
    applicability: 'always',
  },
  // Packaging EPR ------------------------------------------------------------
  // Producers placing packaged goods on the UK market are in scope. Drinks
  // producers nearly always qualify. Default-on.
  {
    id: 'epr_annual_data',
    regime: 'epr',
    regime_label: 'Packaging EPR',
    title: 'Submit your packaging totals for the year (EPR)',
    why_it_matters:
      'Tell the scheme administrator how much packaging you sold to UK customers last year, by material. Your fee is set from this return.',
    description:
      'Submit annual packaging tonnage data to the UK Packaging EPR scheme administrator. Large producers face the fee based on this return.',
    recurrence: 'annual',
    month: 4,
    day: 1,
    action_href: '/products',
    source: 'Defra pEPR guidance',
    applicability: 'always',
  },
  {
    id: 'epr_h1_data',
    regime: 'epr',
    regime_label: 'Packaging EPR',
    title: 'Submit your half-year packaging totals (EPR)',
    why_it_matters:
      'Tell the scheme administrator your packaging tonnage for the last six months, by material.',
    description:
      'Half-year packaging tonnage return to the scheme administrator (July-December data due April, January-June data due October).',
    recurrence: 'annual',
    month: 10,
    day: 1,
    action_href: '/products',
    source: 'Defra pEPR guidance',
    applicability: 'always',
  },
  // CSRD / streamlined -------------------------------------------------------
  // Both apply to large or listed companies. Smaller drinks producers don't
  // qualify; gated behind explicit flags.
  {
    id: 'csrd_annual',
    regime: 'csrd',
    regime_label: 'CSRD / UK SDS',
    title: 'Publish your sustainability report (CSRD)',
    why_it_matters:
      'You\'re large enough or listed and need to file a CSRD-aligned sustainability statement alongside your annual report.',
    description:
      'Publish your CSRD / UK SDS aligned sustainability statement alongside the annual report. Dates follow the org financial year; 30 April shown here for April fiscal-year-end.',
    recurrence: 'annual',
    month: 7,
    day: 31,
    action_href: '/pulse/financial/',
    source: 'CSRD Directive 2022/2464; UK SDS consultation',
    applicability: 'flag:csrd_in_scope',
  },
  {
    id: 'secr_annual',
    regime: 'streamlined',
    regime_label: 'SECR',
    title: 'SECR disclosure in your Directors\' Report',
    why_it_matters:
      'You\'re a UK quoted or large company and need to disclose energy use, scope 1+2 emissions, and an intensity ratio in your Directors\' Report.',
    description:
      'Streamlined Energy & Carbon Reporting disclosure in the Directors Report, filed with Companies House within 9 months of financial-year end.',
    recurrence: 'annual',
    month: 9,
    day: 30,
    action_href: '/pulse/financial/',
    source: 'Companies (Directors Report) & LLPs Regulations 2018',
    applicability: 'flag:secr_in_scope',
  },
];

/**
 * Subset of org feature_flags relevant to deadline applicability. Pass an
 * empty object for orgs without any flags set; only EPR + Plastic Tax
 * deadlines (default-on for UK drinks producers) will fire.
 */
export interface DeadlineApplicabilityFlags {
  uk_ets_operator?: boolean;
  cbam_imports?: boolean;
  csrd_in_scope?: boolean;
  secr_in_scope?: boolean;
}

/**
 * Filter deadlines by org applicability. Used by the briefing route so
 * non-applicable regimes never reach the user. UK ETS, CBAM, CSRD, SECR
 * stay off until an org explicitly opts in via organizations.feature_flags.
 */
export function filterDeadlinesForOrg(
  entries: DeadlineEntry[],
  flags: DeadlineApplicabilityFlags,
): DeadlineEntry[] {
  return entries.filter(e => {
    switch (e.applicability) {
      case 'always':
        return true;
      case 'flag:uk_ets_operator':
        return flags.uk_ets_operator === true;
      case 'flag:cbam_imports':
        return flags.cbam_imports === true;
      case 'flag:csrd_in_scope':
        return flags.csrd_in_scope === true;
      case 'flag:secr_in_scope':
        return flags.secr_in_scope === true;
      default:
        return false;
    }
  });
}

/**
 * Convenience wrapper: filter then expand. Same return shape as
 * expandDeadlines so callers can swap in.
 */
export function expandDeadlinesForOrg(
  entries: DeadlineEntry[],
  flags: DeadlineApplicabilityFlags,
  monthsAhead = 12,
  now: Date = new Date(),
): UpcomingDeadline[] {
  return expandDeadlines(filterDeadlinesForOrg(entries, flags), monthsAhead, now);
}

/**
 * Expand deadlines into dated events covering the given window. Annual
 * deadlines fire once per calendar year, quarterly ones once per quarter.
 * Items that have already passed within the window are included so the UI
 * can show "5 days overdue" etc.
 */
export interface UpcomingDeadline {
  id: string;
  regime: DeadlineRegime;
  regime_label: string;
  title: string;
  why_it_matters: string;
  description: string;
  action_href: string;
  source: string;
  due_date: string; // YYYY-MM-DD
  days_away: number; // negative = past
}

export function expandDeadlines(
  entries: DeadlineEntry[] = COMPLIANCE_DEADLINES,
  monthsAhead = 12,
  now: Date = new Date(),
): UpcomingDeadline[] {
  const out: UpcomingDeadline[] = [];
  const start = new Date(now);
  start.setDate(start.getDate() - 30); // grace: show items up to 30 days past
  const end = new Date(now);
  end.setMonth(end.getMonth() + monthsAhead);

  for (const entry of entries) {
    // For annual + quarterly we enumerate candidate dates in the window.
    // Quarterly entries are themselves one-per-quarter so we just emit the
    // next occurrence of their (month, day) each year.
    for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) {
      const candidate = new Date(year, entry.month - 1, entry.day);
      if (candidate < start || candidate > end) continue;
      const daysAway = Math.round(
        (candidate.getTime() - now.getTime()) / 86_400_000,
      );
      out.push({
        id: `${entry.id}-${year}`,
        regime: entry.regime,
        regime_label: entry.regime_label,
        title: entry.title,
        why_it_matters: entry.why_it_matters,
        description: entry.description,
        action_href: entry.action_href,
        source: entry.source,
        due_date: candidate.toISOString().slice(0, 10),
        days_away: daysAway,
      });
    }
  }

  out.sort((a, b) => a.due_date.localeCompare(b.due_date));
  return out;
}
