import { describe, it, expect } from 'vitest';
import {
  answerKeyToAoa,
  answerKeyToCsv,
  statusLabel,
  ANSWER_KEY_COL_WIDTHS,
  type AnswerKeyData,
  type AnswerKeyRow,
} from '../answer-key-format';

function row(overrides: Partial<AnswerKeyRow> = {}): AnswerKeyRow {
  return {
    section: 'Climate Action (CA)',
    code: 'IT5-Y0-001',
    requirement: 'Measure your GHG footprint',
    applicableFromYear: 0,
    status: 'passed',
    answer: 'GHG inventory 2024: 12.34 tCO2e total',
    dataSource: 'Emissions',
    evidence: 'Emissions inventory (verified)',
    dataQuality: 'Complete',
    lastUpdated: '2026-06-01',
    guidance: 'Measure your greenhouse-gas footprint across Scope 1, 2 and 3.',
    ...overrides,
  };
}

function data(rows: AnswerKeyRow[]): AnswerKeyData {
  return {
    organisationName: 'Avallen Spirits',
    certificationType: 'recertification',
    generatedAt: '1 July 2026',
    year0ReadinessPct: 82,
    programmeReadinessPct: 61,
    rows,
  };
}

describe('statusLabel', () => {
  it('maps each status value to a plain-English label', () => {
    expect(statusLabel('passed')).toBe('Verified');
    expect(statusLabel('in_progress')).toBe('In progress');
    expect(statusLabel('not_started')).toBe('Not started');
    expect(statusLabel('future')).toBe('Not yet due');
  });
});

describe('answerKeyToAoa', () => {
  it('has a title block, header row, then one row per requirement', () => {
    const aoa = answerKeyToAoa(data([row(), row({ code: 'IT2-Y0-001' })]));
    // 4 title/summary lines + 1 blank + 1 header + 2 data rows.
    expect(aoa).toHaveLength(8);
    expect(String(aoa[0][0])).toContain('Avallen Spirits');
    expect(String(aoa[1][0])).toContain('Recertification');
    expect(String(aoa[3][0])).toContain('82%');
    expect(aoa[4]).toEqual([]);
    expect(aoa[5][0]).toBe('Section');
    expect(aoa[6][1]).toBe('IT5-Y0-001');
    expect(aoa[7][1]).toBe('IT2-Y0-001');
  });

  it('renders the year as a human label and status as a plain label', () => {
    const aoa = answerKeyToAoa(
      data([row({ applicableFromYear: 3, status: 'in_progress' })]),
    );
    expect(aoa[6][3]).toBe('Year 3');
    expect(aoa[6][4]).toBe('In progress');
  });

  it('keeps a column width for every column', () => {
    const aoa = answerKeyToAoa(data([row()]));
    expect(ANSWER_KEY_COL_WIDTHS).toHaveLength(aoa[5].length);
  });
});

describe('answerKeyToCsv', () => {
  it('emits the header and CRLF-separated rows without the title block', () => {
    const csv = answerKeyToCsv(data([row()]));
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith('Section,Code,Requirement,')).toBe(true);
    expect(lines[1]).toContain('IT5-Y0-001');
  });

  it('quotes cells containing commas, quotes or newlines', () => {
    const csv = answerKeyToCsv(
      data([
        row({
          answer: 'Scope 1, 2 and 3',
          evidence: 'Policy says "be good"',
          guidance: 'line one\nline two',
        }),
      ]),
    );
    const dataLine = csv.split('\r\n')[1];
    expect(dataLine).toContain('"Scope 1, 2 and 3"');
    expect(dataLine).toContain('"Policy says ""be good"""');
    expect(dataLine).toContain('"line one\nline two"');
  });
});
