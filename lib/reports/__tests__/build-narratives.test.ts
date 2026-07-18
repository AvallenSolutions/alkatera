import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// Mock the Gemini layer so no key or network is ever needed and we can
// observe the prompts the orchestration actually sends.
vi.mock('@/lib/ai/gemini', () => ({
  runTextPrompt: vi.fn(async () =>
    JSON.stringify({
      headlineInsight: 'Mock insight.',
      contextParagraph: 'Mock context.',
      nextStepPrompt: 'Mock next step.',
    })
  ),
  runJsonPrompt: vi.fn(async ({ op }: { op: string }) =>
    op === 'report_foreword'
      ? { message: 'Mock foreword.' }
      : { primaryMessage: 'Mock primary.', summaryText: 'Mock summary.' }
  ),
}));

import { runTextPrompt, runJsonPrompt } from '@/lib/ai/gemini';
import {
  buildNarratives,
  buildDraftSnapshot,
  resolveNarrativeTone,
  TONE_OVERRIDES,
} from '@/lib/reports/build-narratives';
import { REPORT_STYLES } from '@/lib/pdf/templates/report-styles';
import type { ReportConfigShape } from '@/lib/reports/assemble-report-data';

function makeConfig(overrides: Partial<ReportConfigShape> = {}): ReportConfigShape {
  return {
    reportName: 'Test Report',
    reportYear: 2026,
    reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-12-31',
    audience: 'customers',
    standards: ['iso-14067'],
    sections: ['executive-summary', 'scope-1-2-3'],
    isMultiYear: false,
    reportYears: [2026],
    branding: { logo: null, primaryColor: '#205E40', secondaryColor: '#047857' },
    ...overrides,
  };
}

const REPORT_DATA = {
  organization: { name: 'Test Co', industry_sector: 'Brewing' },
  emissions: { scope1: 10, scope2: 20, scope3: 70, total: 100, year: 2026 },
  emissionsTrends: [],
  products: [],
  dataAvailability: { hasEmissions: true },
};

beforeEach(() => {
  vi.clearAllMocks();
  // The assistants guard on the key BEFORE calling the (mocked) client, so
  // give them one; the mock intercepts every actual model call.
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('resolveNarrativeTone', () => {
  it('uses the style voice by default', () => {
    const { tone, toneOverride } = resolveNarrativeTone({ style: 'customers', audience: 'customers' });
    expect(tone).toBe(REPORT_STYLES.customers.tone);
    expect(toneOverride).toBeNull();
  });

  it('lets a known override beat the style voice', () => {
    const { tone, toneOverride } = resolveNarrativeTone({
      style: 'customers', audience: 'customers', toneOverride: 'technical',
    });
    expect(tone).toBe(TONE_OVERRIDES.technical);
    expect(toneOverride).toBe('technical');
  });

  it('ignores unknown overrides', () => {
    const { tone, toneOverride } = resolveNarrativeTone({
      style: 'customers', audience: 'customers', toneOverride: 'shouty' as any,
    });
    expect(tone).toBe(REPORT_STYLES.customers.tone);
    expect(toneOverride).toBeNull();
  });
});

describe('buildNarratives', () => {
  it('threads the resolved tone into the section prompts', async () => {
    await buildNarratives({
      config: makeConfig({ style: 'customers', toneOverride: 'measured' }),
      reportData: REPORT_DATA,
      force: true,
    });
    const prompt = vi.mocked(runTextPrompt).mock.calls[0][0].prompt;
    expect(prompt).toContain(TONE_OVERRIDES.measured);
  });

  it('drafts a foreword only for tier-full (marketing) styles', async () => {
    const marketing = await buildNarratives({
      config: makeConfig({ style: 'marketing', audience: 'customers' }),
      reportData: REPORT_DATA,
      force: true,
      includeForeword: true,
    });
    expect(marketing.foreword?.message).toBe('Mock foreword.');

    vi.clearAllMocks();
    const customers = await buildNarratives({
      config: makeConfig({ style: 'customers' }),
      reportData: REPORT_DATA,
      force: true,
      includeForeword: true,
    });
    expect(customers.foreword).toBeUndefined();
    const forewordCalls = vi.mocked(runJsonPrompt).mock.calls.filter(c => c[0].op === 'report_foreword');
    expect(forewordCalls).toHaveLength(0);
  });

  it('never drafts a foreword unless asked (the inline render paths)', async () => {
    const built = await buildNarratives({
      config: makeConfig({ style: 'marketing', audience: 'customers' }),
      reportData: REPORT_DATA,
      force: true,
    });
    expect(built.foreword).toBeUndefined();
    const forewordCalls = vi.mocked(runJsonPrompt).mock.calls.filter(c => c[0].op === 'report_foreword');
    expect(forewordCalls).toHaveLength(0);
  });

  it('returns section and executive narratives from the mocked model', async () => {
    const built = await buildNarratives({ config: makeConfig(), reportData: REPORT_DATA, force: true });
    expect(built.sections['scope-1-2-3']?.headlineInsight).toBe('Mock insight.');
    expect(built.executiveSummary.primaryMessage).toBe('Mock primary.');
  });
});

describe('buildDraftSnapshot', () => {
  it('packs narratives with aiGenerated flags and collects fallback blocks', () => {
    const snapshot = buildDraftSnapshot(
      {
        sections: {
          'scope-1-2-3': {
            headlineInsight: 'A', contextParagraph: 'B', nextStepPrompt: 'C',
            dataConfidenceStatement: null, methodologyFootnote: null,
            aiGenerated: true, usedFallback: true,
          },
          'targets': {
            headlineInsight: 'A', contextParagraph: 'B', nextStepPrompt: 'C',
            dataConfidenceStatement: null, methodologyFootnote: null,
            aiGenerated: true,
          },
        },
        executiveSummary: { primaryMessage: 'P', summaryText: 'S', aiGenerated: true, usedFallback: true },
        foreword: { message: 'F', aiGenerated: true },
        tone: 'Plain.',
        toneOverride: null,
      },
      { ...REPORT_DATA, keyFindings: [{ title: 'K', narrative: 'N', scope: 'scope1', direction: 'decrease', magnitude_pct: 5, confidence: 'high' }] }
    );

    expect(snapshot.narratives.sections['scope-1-2-3'].aiGenerated).toBe(true);
    expect('usedFallback' in snapshot.narratives.sections['scope-1-2-3']).toBe(false);
    expect(snapshot.narrative_meta.fallback_blocks.sort()).toEqual(['executive-summary', 'scope-1-2-3']);
    expect(snapshot.narratives.foreword).toEqual({ message: 'F', aiGenerated: true, accepted: false });
    expect(snapshot.keyFindings?.[0].aiGenerated).toBe(true);
    expect(snapshot.narrative_meta.review_state).toBe('draft');
    expect(snapshot.narrative_meta.inputs_digest.emissions_total).toBe(100);
    expect(snapshot.inputs).toBeDefined();
  });
});
