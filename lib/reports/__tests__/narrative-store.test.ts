import { describe, it, expect } from 'vitest';
import {
  applyNarrativeEdits,
  hasNarrativeSnapshot,
  computeInputsDigest,
  NarrativeEditError,
  type ReportDataSnapshot,
} from '@/lib/reports/narrative-store';

function makeSnapshot(): ReportDataSnapshot {
  return {
    narratives: {
      executiveSummary: {
        primaryMessage: 'The headline.',
        summaryText: 'The summary.',
        aiGenerated: true,
      },
      sections: {
        'scope-1-2-3': {
          headlineInsight: 'Emissions fell.',
          contextParagraph: 'They fell because of energy work.',
          nextStepPrompt: 'Keep going.',
          dataConfidenceStatement: null,
          methodologyFootnote: 'Methodology: GHG Protocol Corporate Standard. Data quality: Not assessed.',
          aiGenerated: true,
        },
        'targets': {
          headlineInsight: 'Targets are on track.',
          contextParagraph: 'Progress is steady.',
          nextStepPrompt: 'Review annually.',
          dataConfidenceStatement: null,
          methodologyFootnote: null,
          aiGenerated: true,
        },
      },
      foreword: { message: 'Dear reader.', aiGenerated: true, accepted: false },
    },
    keyFindings: [
      { title: 'Energy fell', narrative: 'Grid mix improved.', scope: 'scope2', direction: 'decrease', magnitude_pct: 10, confidence: 'high', aiGenerated: true } as any,
    ],
    narrative_meta: {
      generated_at: '2026-07-18T12:00:00Z',
      model: 'gemini-3.5-flash',
      tone: 'Plain.',
      tone_override: null,
      review_state: 'draft',
      fallback_blocks: [],
      inputs_digest: { emissions_total: 100, product_count: 2, trend_years: [2025, 2026] },
    },
  };
}

describe('hasNarrativeSnapshot', () => {
  it('accepts a well-formed snapshot and rejects everything else', () => {
    expect(hasNarrativeSnapshot({ data_snapshot: makeSnapshot() })).toBe(true);
    expect(hasNarrativeSnapshot({ data_snapshot: null })).toBe(false);
    expect(hasNarrativeSnapshot({ data_snapshot: {} })).toBe(false);
    expect(hasNarrativeSnapshot({ data_snapshot: { narratives: {} } })).toBe(false);
    expect(hasNarrativeSnapshot({})).toBe(false);
  });
});

describe('applyNarrativeEdits', () => {
  it('flips aiGenerated only on blocks whose text actually changed', () => {
    const { snapshot } = applyNarrativeEdits(makeSnapshot(), {
      sections: { 'scope-1-2-3': { headlineInsight: 'Emissions fell sharply.' } },
    });
    expect(snapshot.narratives.sections['scope-1-2-3'].headlineInsight).toBe('Emissions fell sharply.');
    expect(snapshot.narratives.sections['scope-1-2-3'].aiGenerated).toBe(false);
    expect(snapshot.narratives.sections['targets'].aiGenerated).toBe(true);
    expect(snapshot.narratives.executiveSummary.aiGenerated).toBe(true);
  });

  it('keeps aiGenerated true when the patch matches the existing text', () => {
    const { snapshot } = applyNarrativeEdits(makeSnapshot(), {
      sections: { 'scope-1-2-3': { headlineInsight: 'Emissions fell.' } },
    });
    expect(snapshot.narratives.sections['scope-1-2-3'].aiGenerated).toBe(true);
  });

  it('never mutates the input snapshot', () => {
    const original = makeSnapshot();
    applyNarrativeEdits(original, {
      sections: { 'scope-1-2-3': { headlineInsight: 'Changed.' } },
    });
    expect(original.narratives.sections['scope-1-2-3'].headlineInsight).toBe('Emissions fell.');
    expect(original.narratives.sections['scope-1-2-3'].aiGenerated).toBe(true);
  });

  it('ignores machine-owned fields in patches', () => {
    const { snapshot } = applyNarrativeEdits(makeSnapshot(), {
      sections: {
        'scope-1-2-3': {
          methodologyFootnote: 'Fabricated methodology.',
          dataConfidenceStatement: 'Fabricated confidence.',
        } as any,
      },
    });
    expect(snapshot.narratives.sections['scope-1-2-3'].methodologyFootnote).toContain('GHG Protocol');
    expect(snapshot.narratives.sections['scope-1-2-3'].dataConfidenceStatement).toBeNull();
    // No editable field changed, so the flag stands
    expect(snapshot.narratives.sections['scope-1-2-3'].aiGenerated).toBe(true);
  });

  it('edits the executive summary and key findings', () => {
    const { snapshot } = applyNarrativeEdits(makeSnapshot(), {
      executiveSummary: { primaryMessage: 'A better headline.' },
      keyFindings: [{ index: 0, narrative: 'Grid mix improved a lot.' }],
    });
    expect(snapshot.narratives.executiveSummary.primaryMessage).toBe('A better headline.');
    expect(snapshot.narratives.executiveSummary.aiGenerated).toBe(false);
    expect(snapshot.keyFindings?.[0].narrative).toBe('Grid mix improved a lot.');
    expect(snapshot.keyFindings?.[0].aiGenerated).toBe(false);
    // Machine-owned finding fields untouched
    expect(snapshot.keyFindings?.[0].magnitude_pct).toBe(10);
  });

  it('handles foreword edit and accept, returning the message for the config merge', () => {
    const edited = applyNarrativeEdits(makeSnapshot(), { foreword: { message: 'Our year, honestly.' } });
    expect(edited.snapshot.narratives.foreword?.aiGenerated).toBe(false);
    expect(edited.snapshot.narratives.foreword?.accepted).toBe(false);
    expect(edited.acceptedForewordMessage).toBeNull();

    const accepted = applyNarrativeEdits(edited.snapshot, { acceptForeword: true });
    expect(accepted.snapshot.narratives.foreword?.accepted).toBe(true);
    expect(accepted.acceptedForewordMessage).toBe('Our year, honestly.');
  });

  it('rejects unknown sections, missing forewords, bad finding indices and missing snapshots', () => {
    expect(() => applyNarrativeEdits(makeSnapshot(), { sections: { nope: { headlineInsight: 'x' } } }))
      .toThrow(NarrativeEditError);
    const noForeword = makeSnapshot();
    delete noForeword.narratives.foreword;
    expect(() => applyNarrativeEdits(noForeword, { acceptForeword: true })).toThrow(NarrativeEditError);
    expect(() => applyNarrativeEdits(makeSnapshot(), { keyFindings: [{ index: 9, title: 'x' }] }))
      .toThrow(NarrativeEditError);
    expect(() => applyNarrativeEdits(null, {})).toThrow(NarrativeEditError);
  });
});

describe('computeInputsDigest', () => {
  it('summarises the drafted inputs', () => {
    expect(
      computeInputsDigest({
        emissions: { total: 123.4 },
        products: [{}, {}, {}],
        emissionsTrends: [{ year: 2025 }, { year: 2026 }],
      })
    ).toEqual({ emissions_total: 123.4, product_count: 3, trend_years: [2025, 2026] });
    expect(computeInputsDigest({})).toEqual({ emissions_total: 0, product_count: 0, trend_years: [] });
  });
});
