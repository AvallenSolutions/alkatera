import { describe, expect, it } from 'vitest';
import { scoreEvalResults, formatEvalReport, type EvalCaseResult } from '../eval/score';

function c(expected: string, actual: string, error?: string): EvalCaseResult {
  return { id: 'x', fileName: `${expected}.pdf`, expectedType: expected, actualType: actual, error };
}

describe('scoreEvalResults', () => {
  it('computes accuracy over non-errored cases', () => {
    const report = scoreEvalResults([
      c('bom', 'bom'),
      c('bom', 'spray_diary'),
      c('utility_bill', 'utility_bill'),
      c('certification', 'unsupported', 'download failed'),
    ]);
    expect(report.total).toBe(4);
    expect(report.errored).toBe(1);
    expect(report.correct).toBe(2);
    expect(report.accuracy).toBeCloseTo(2 / 3);
  });

  it('computes per-type precision and recall', () => {
    const report = scoreEvalResults([
      c('bom', 'bom'),
      c('bom', 'bom'),
      c('bom', 'spray_diary'),
      c('spray_diary', 'bom'),
    ]);
    const bom = report.perType.find((t) => t.type === 'bom')!;
    // 3 expected boms, 3 predicted boms (2 right + 1 stolen from spray_diary).
    expect(bom.expected).toBe(3);
    expect(bom.predicted).toBe(3);
    expect(bom.correct).toBe(2);
    expect(bom.precision).toBeCloseTo(2 / 3);
    expect(bom.recall).toBeCloseTo(2 / 3);
  });

  it('builds a sorted confusion list of mismatches only', () => {
    const report = scoreEvalResults([
      c('bom', 'spray_diary'),
      c('bom', 'spray_diary'),
      c('bom', 'bom'),
      c('utility_bill', 'supplier_invoice'),
    ]);
    expect(report.confusion).toEqual([
      { expected: 'bom', actual: 'spray_diary', count: 2 },
      { expected: 'utility_bill', actual: 'supplier_invoice', count: 1 },
    ]);
  });

  it('collects failures including errors', () => {
    const report = scoreEvalResults([c('bom', 'bom'), c('bom', 'spray_diary'), c('bom', 'unsupported', 'boom')]);
    expect(report.failures).toHaveLength(2);
  });

  it('handles the empty corpus', () => {
    const report = scoreEvalResults([]);
    expect(report.accuracy).toBe(0);
    expect(formatEvalReport(report)).toContain('Cases: 0');
  });

  it('formats a readable report', () => {
    const text = formatEvalReport(
      scoreEvalResults([c('bom', 'bom'), c('bom', 'spray_diary')]),
    );
    expect(text).toContain('Accuracy');
    expect(text).toContain('bom → spray_diary');
    expect(text).toContain('[WRONG]');
  });
});
