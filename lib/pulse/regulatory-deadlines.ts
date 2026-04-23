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

export interface DeadlineEntry {
  id: string;
  regime: DeadlineRegime;
  regime_label: string;
  title: string;
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
}

export const COMPLIANCE_DEADLINES: DeadlineEntry[] = [
  // UK ETS -------------------------------------------------------------------
  {
    id: 'uk_ets_verified_report',
    regime: 'uk_ets',
    regime_label: 'UK ETS',
    title: 'Submit verified annual emissions report',
    description:
      'Operators must submit their previous-year annual emissions report, verified by an accredited verifier, via the Environment Agency ETS registry.',
    recurrence: 'annual',
    month: 3,
    day: 31,
    action_href: '/data/scope-1-2/',
    source: 'UK ETS Order 2020; Environment Agency guidance',
  },
  {
    id: 'uk_ets_surrender',
    regime: 'uk_ets',
    regime_label: 'UK ETS',
    title: 'Surrender allowances',
    description:
      "Surrender UK Emissions Trading Scheme allowances equal to the previous year's verified emissions.",
    recurrence: 'annual',
    month: 4,
    day: 30,
    action_href: '/pulse/financial/',
    source: 'UK ETS Order 2020 s.23',
  },
  // CBAM ---------------------------------------------------------------------
  {
    id: 'cbam_q1_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Q1 CBAM report',
    description:
      'Quarterly CBAM report covering embedded emissions of CBAM-in-scope goods imported into the EU (iron/steel, aluminium, cement, fertilisers, hydrogen, electricity).',
    recurrence: 'quarterly',
    month: 4,
    day: 30,
    action_href: '/products',
    source: 'EU Regulation 2023/956; DG TAXUD guidance',
  },
  {
    id: 'cbam_q2_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Q2 CBAM report',
    description:
      'Quarterly CBAM report covering Q2 embedded emissions of CBAM-in-scope imports.',
    recurrence: 'quarterly',
    month: 7,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
  },
  {
    id: 'cbam_q3_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Q3 CBAM report',
    description:
      'Quarterly CBAM report covering Q3 embedded emissions.',
    recurrence: 'quarterly',
    month: 10,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
  },
  {
    id: 'cbam_q4_report',
    regime: 'cbam',
    regime_label: 'EU CBAM',
    title: 'Q4 CBAM report',
    description:
      'Quarterly CBAM report covering Q4 embedded emissions.',
    recurrence: 'quarterly',
    month: 1,
    day: 31,
    action_href: '/products',
    source: 'EU Regulation 2023/956',
  },
  // Plastic Packaging Tax ----------------------------------------------------
  {
    id: 'ppt_q1',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'Q1 Plastic Packaging Tax return',
    description:
      'HMRC PPT return covering plastic packaging components manufactured in or imported into the UK during Q1. Due by end of the month after the accounting quarter.',
    recurrence: 'quarterly',
    month: 4,
    day: 30,
    action_href: '/products',
    source: 'HMRC PPT notice; Finance Act 2021 Part 2',
  },
  {
    id: 'ppt_q2',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'Q2 Plastic Packaging Tax return',
    description:
      'HMRC PPT return covering Q2 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 7,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
  },
  {
    id: 'ppt_q3',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'Q3 Plastic Packaging Tax return',
    description:
      'HMRC PPT return covering Q3 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 10,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
  },
  {
    id: 'ppt_q4',
    regime: 'plastic_tax',
    regime_label: 'Plastic Tax',
    title: 'Q4 Plastic Packaging Tax return',
    description:
      'HMRC PPT return covering Q4 plastic packaging activity.',
    recurrence: 'quarterly',
    month: 1,
    day: 31,
    action_href: '/products',
    source: 'HMRC PPT notice',
  },
  // Packaging EPR ------------------------------------------------------------
  {
    id: 'epr_annual_data',
    regime: 'epr',
    regime_label: 'Packaging EPR',
    title: 'Annual packaging data submission',
    description:
      'Submit annual packaging tonnage data to the UK Packaging EPR scheme administrator. Large producers face the fee based on this return.',
    recurrence: 'annual',
    month: 4,
    day: 1,
    action_href: '/products',
    source: 'Defra pEPR guidance',
  },
  {
    id: 'epr_h1_data',
    regime: 'epr',
    regime_label: 'Packaging EPR',
    title: 'Half-year packaging data',
    description:
      'Half-year packaging tonnage return to the scheme administrator (July-December data due April, January-June data due October).',
    recurrence: 'annual',
    month: 10,
    day: 1,
    action_href: '/products',
    source: 'Defra pEPR guidance',
  },
  // CSRD / streamlined -------------------------------------------------------
  {
    id: 'csrd_annual',
    regime: 'csrd',
    regime_label: 'CSRD / UK SDS',
    title: 'Sustainability report publication',
    description:
      'Publish your CSRD / UK SDS aligned sustainability statement alongside the annual report. Dates follow the org financial year; 30 April shown here for April fiscal-year-end.',
    recurrence: 'annual',
    month: 7,
    day: 31,
    action_href: '/pulse/financial/',
    source: 'CSRD Directive 2022/2464; UK SDS consultation',
  },
  {
    id: 'secr_annual',
    regime: 'streamlined',
    regime_label: 'SECR',
    title: 'SECR disclosure in Directors Report',
    description:
      'Streamlined Energy & Carbon Reporting disclosure in the Directors Report, filed with Companies House within 9 months of financial-year end.',
    recurrence: 'annual',
    month: 9,
    day: 30,
    action_href: '/pulse/financial/',
    source: 'Companies (Directors Report) & LLPs Regulations 2018',
  },
];

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
