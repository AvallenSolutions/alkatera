// Pure serialisers for the B Corp "answer key" export: the spreadsheet a user
// works down while filling B Lab's own questionnaire alongside alkatera. Each
// row is one requirement with a paste-ready answer synthesised from their
// platform data + evidence. No server / Supabase imports so this is unit-
// testable and safe to share types from.

import type { RequirementStatusValue, YearBand } from './scoring';

export interface AnswerKeyRow {
  /** B Corp section label + abbrev, e.g. "Climate Action (CA)". */
  section: string;
  /** Requirement code, e.g. "IT5-Y0-001". */
  code: string;
  /** Requirement name. */
  requirement: string;
  applicableFromYear: YearBand;
  status: RequirementStatusValue;
  /** Paste-ready answer / data synthesised from platform + manual evidence. */
  answer: string;
  /** Where the answer came from, e.g. "Emissions", "Manual evidence" or "". */
  dataSource: string;
  /** Human list of evidence on file for this requirement. */
  evidence: string;
  /** complete / partial / missing / manual / — */
  dataQuality: string;
  /** ISO date of the most recent evidence update, or "". */
  lastUpdated: string;
  /** Plain-English statement of what the requirement asks for. */
  guidance: string;
}

export interface AnswerKeyData {
  organisationName: string;
  certificationType: 'new' | 'recertification' | null;
  /** Human-readable generation date, e.g. "1 July 2026". */
  generatedAt: string;
  year0ReadinessPct: number;
  programmeReadinessPct: number;
  rows: AnswerKeyRow[];
}

const STATUS_LABELS: Record<RequirementStatusValue, string> = {
  passed: 'Verified',
  in_progress: 'In progress',
  not_started: 'Not started',
  future: 'Not yet due',
};

export function statusLabel(status: RequirementStatusValue): string {
  return STATUS_LABELS[status] ?? status;
}

const HEADERS = [
  'Section',
  'Code',
  'Requirement',
  'Year',
  'Status',
  'Your answer / data',
  'Data source',
  'Evidence on file',
  'Data quality',
  'Last updated',
  'What this asks for',
];

function rowValues(r: AnswerKeyRow): string[] {
  return [
    r.section,
    r.code,
    r.requirement,
    `Year ${r.applicableFromYear}`,
    statusLabel(r.status),
    r.answer,
    r.dataSource,
    r.evidence,
    r.dataQuality,
    r.lastUpdated,
    r.guidance,
  ];
}

/**
 * Array-of-arrays for XLSX.utils.aoa_to_sheet. A short title block, then the
 * table header, then one row per requirement.
 */
export function answerKeyToAoa(data: AnswerKeyData): (string | number)[][] {
  const typeLabel =
    data.certificationType === 'recertification'
      ? 'Recertification (B Lab Standards v2.1)'
      : data.certificationType === 'new'
        ? 'New certification (B Lab Standards v2.1)'
        : 'B Corp certification';
  return [
    ['B Corp answer key — ' + data.organisationName],
    [typeLabel],
    [
      `Generated ${data.generatedAt}. Work down this sheet while filling your B Corp assessment: paste each answer into the matching question, then attach the evidence.`,
    ],
    [
      `Submission readiness ${data.year0ReadinessPct}% · whole-programme ${data.programmeReadinessPct}%`,
    ],
    [],
    HEADERS,
    ...data.rows.map(rowValues),
  ];
}

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** RFC-4180 CSV of the header + rows (no title block, so it re-imports cleanly). */
export function answerKeyToCsv(data: AnswerKeyData): string {
  const lines = [HEADERS, ...data.rows.map(rowValues)];
  return lines.map((cols) => cols.map(csvCell).join(',')).join('\r\n');
}

/** Column widths (character units) for the XLSX sheet. */
export const ANSWER_KEY_COL_WIDTHS = [
  28, 14, 40, 8, 12, 60, 18, 40, 12, 14, 55,
];
