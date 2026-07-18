import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The studio barrel loads next/font at import time, which only works inside Next.
vi.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ className: 'font-mock', variable: '--font-mock' }),
}));

import { NarrativeReview } from '../NarrativeReview';
import type { ReportDataSnapshot } from '@/lib/reports/narrative-store';
import type { ReportConfig } from '@/types/report-builder';

vi.mock('@/lib/supabase/browser-client', () => ({
  getSupabaseBrowserClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }),
          }),
        }),
      }),
    }),
  }),
}));

const config: ReportConfig = {
  reportName: 'Test Report',
  reportYear: 2026,
  reportingPeriodStart: '2026-01-01',
  reportingPeriodEnd: '2026-12-31',
  audience: 'customers',
  style: 'marketing',
  outputFormat: 'html',
  standards: ['iso-14067'],
  sections: ['executive-summary', 'scope-1-2-3'],
  branding: { logo: null, primaryColor: '#205E40', secondaryColor: '#047857', leadership: { name: 'Jane Doe' } },
  isMultiYear: false,
  reportYears: [2026],
};

const snapshot: ReportDataSnapshot = {
  narratives: {
    executiveSummary: { primaryMessage: 'The one message.', summaryText: 'The summary.', aiGenerated: true },
    sections: {
      'scope-1-2-3': {
        headlineInsight: 'Emissions fell.',
        contextParagraph: 'Because of energy work.',
        nextStepPrompt: 'Keep going.',
        dataConfidenceStatement: null,
        methodologyFootnote: null,
        aiGenerated: false,
      },
    },
    foreword: { message: 'Dear reader.', aiGenerated: true, accepted: false },
  },
  narrative_meta: {
    generated_at: '2026-07-18T12:00:00Z',
    model: 'gemini-3.5-flash',
    tone: 'Warm.',
    tone_override: null,
    review_state: 'draft',
    fallback_blocks: ['executive-summary'],
    inputs_digest: { emissions_total: 0, product_count: 0, trend_years: [] },
  },
};

function renderReview() {
  const handlers = {
    onPatch: vi.fn(async () => {}),
    onRegenerateBlock: vi.fn(async () => {}),
    onToneChange: vi.fn(async () => {}),
    onShip: vi.fn(async () => {}),
  };
  render(
    <NarrativeReview
      organizationId={null}
      config={config}
      snapshot={snapshot}
      busy={false}
      {...handlers}
    />
  );
  return handlers;
}

describe('NarrativeReview', () => {
  it('renders every block with honest provenance chips', () => {
    renderReview();
    // Foreword: named, AI draft, unaccepted
    expect(screen.getByText('Foreword · Jane Doe')).toBeTruthy();
    expect(screen.getByText('Not included until you accept it.')).toBeTruthy();
    // Exec summary flagged as fallback (stale chip)
    expect(screen.getByText('Executive summary')).toBeTruthy();
    expect(screen.getAllByText('Fallback').length).toBeGreaterThan(0);
    // Edited section shows the good chip
    expect(screen.getByText('Edited')).toBeTruthy();
    // The one message renders
    expect(screen.getByText('The one message.')).toBeTruthy();
  });

  it('shows the fallback notice when fallback blocks exist', () => {
    renderReview();
    expect(screen.getByText(/built-in fallback/)).toBeTruthy();
  });

  it('ships via the ship button', () => {
    const handlers = renderReview();
    fireEvent.click(screen.getAllByText('Ship the report')[0]);
    expect(handlers.onShip).toHaveBeenCalled();
  });

  it('accepts the foreword through onPatch', () => {
    const handlers = renderReview();
    fireEvent.click(screen.getByText('Use this foreword'));
    expect(handlers.onPatch).toHaveBeenCalledWith({ acceptForeword: true });
  });

  it('changes the voice through onToneChange', () => {
    const handlers = renderReview();
    fireEvent.click(screen.getByText('Technical'));
    expect(handlers.onToneChange).toHaveBeenCalledWith('technical');
  });
});
