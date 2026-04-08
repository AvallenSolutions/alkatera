import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FramingStep, getAudienceDefaults } from '../FramingStep';
import type { ReportConfig } from '@/types/report-builder';

// ============================================================================
// getAudienceDefaults
// ============================================================================

describe('getAudienceDefaults', () => {
  it('always includes executive-summary in sections', () => {
    const audiences = ['investors', 'regulators', 'customers', 'internal', 'supply-chain', 'technical'];
    for (const audience of audiences) {
      const { sections } = getAudienceDefaults(audience);
      expect(sections).toContain('executive-summary');
    }
  });

  it('returns investors defaults with financial/risk sections', () => {
    const { sections, standards } = getAudienceDefaults('investors');
    expect(sections).toContain('scope-1-2-3');
    expect(sections).toContain('targets');
    expect(sections).toContain('transition-roadmap');
    expect(standards).toContain('csrd');
    expect(standards).toContain('tcfd');
  });

  it('returns regulators defaults with compliance sections', () => {
    const { sections, standards } = getAudienceDefaults('regulators');
    expect(sections).toContain('ghg-inventory');
    expect(sections).toContain('methodology');
    expect(sections).toContain('regulatory');
    expect(standards).toContain('csrd');
    expect(standards).toContain('gri');
  });

  it('returns customers defaults with product-focused sections', () => {
    const { sections, standards } = getAudienceDefaults('customers');
    expect(sections).toContain('product-footprints');
    expect(sections).toContain('supply-chain');
    expect(sections).toContain('community-impact');
    expect(standards).toContain('iso-14067');
  });

  it('returns technical defaults with methodology sections', () => {
    const { sections, standards } = getAudienceDefaults('technical');
    expect(sections).toContain('ghg-inventory');
    expect(sections).toContain('methodology');
    expect(sections).toContain('appendix');
    expect(standards).toContain('iso-14067');
    expect(standards).toContain('iso-14064');
  });

  it('returns fallback with just executive-summary for unknown audience', () => {
    const { sections, standards } = getAudienceDefaults('unknown-audience');
    expect(sections).toEqual(['executive-summary']);
    expect(standards).toEqual([]);
  });

  it('returns unique sections (no duplicates)', () => {
    const audiences = ['investors', 'regulators', 'customers', 'internal', 'supply-chain', 'technical'];
    for (const audience of audiences) {
      const { sections } = getAudienceDefaults(audience);
      expect(sections.length).toBe(new Set(sections).size);
    }
  });
});

// ============================================================================
// FramingStep component
// ============================================================================

const baseConfig: ReportConfig = {
  reportName: 'Test Report',
  reportYear: 2025,
  reportingPeriodStart: '2025-01-01',
  reportingPeriodEnd: '2025-12-31',
  audience: 'investors',
  outputFormat: 'pdf',
  standards: ['csrd'],
  sections: ['executive-summary'],
  branding: { logo: null, primaryColor: '#ccff00', secondaryColor: '#10b981' },
  isMultiYear: false,
  reportYears: [2025],
};

describe('FramingStep component', () => {
  it('renders all 6 audience cards', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} />);
    expect(screen.getByText('Investors & Shareholders')).toBeTruthy();
    expect(screen.getByText('Regulatory Bodies')).toBeTruthy();
    expect(screen.getByText('Customers & Consumers')).toBeTruthy();
    expect(screen.getByText('Internal Stakeholders')).toBeTruthy();
    expect(screen.getByText('Supply Chain Partners')).toBeTruthy();
    expect(screen.getByText('Technical/Scientific Audience')).toBeTruthy();
  });

  it('renders the audience question heading', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} />);
    expect(screen.getByText('Who is this report for?')).toBeTruthy();
  });

  it('calls onChange with new audience when a card is clicked', () => {
    const onChange = vi.fn();
    render(<FramingStep config={baseConfig} onChange={onChange} />);
    fireEvent.click(screen.getByText('Regulatory Bodies'));
    expect(onChange).toHaveBeenCalledWith({ audience: 'regulators' });
  });

  it('shows audience cues panel for selected audience', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} />);
    // Investors cue panel should be visible
    expect(screen.getByText('What this audience cares about')).toBeTruthy();
    expect(screen.getByText(/Financial materiality/i)).toBeTruthy();
  });

  it('shows suggested sections badges', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} />);
    expect(screen.getByText('Suggested sections for this audience')).toBeTruthy();
    // investors suggests 'executive-summary' which renders as 'Executive Summary'
    expect(screen.getByText('Executive Summary')).toBeTruthy();
  });

  it('does NOT show smart defaults notice when smartDefaultsApplied is false', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} smartDefaultsApplied={false} />);
    expect(screen.queryByText('Smart defaults applied')).toBeNull();
  });

  it('shows smart defaults notice when smartDefaultsApplied is true', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} smartDefaultsApplied={true} />);
    expect(screen.getByText('Smart defaults applied')).toBeTruthy();
  });

  it('renders framing statement textarea', () => {
    render(<FramingStep config={baseConfig} onChange={() => {}} />);
    expect(screen.getByText('What is the single most important thing they should understand?')).toBeTruthy();
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeTruthy();
  });

  it('calls onChange when framing statement is typed', () => {
    const onChange = vi.fn();
    render(<FramingStep config={baseConfig} onChange={onChange} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Our emissions fell 15% while revenue grew.' } });
    expect(onChange).toHaveBeenCalledWith({
      reportFramingStatement: 'Our emissions fell 15% while revenue grew.',
    });
  });

  it('calls onChange with undefined when framing statement is cleared', () => {
    const onChange = vi.fn();
    const config = { ...baseConfig, reportFramingStatement: 'Some text' };
    render(<FramingStep config={config} onChange={onChange} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith({ reportFramingStatement: undefined });
  });

  it('shows AI lens notice when framing statement has >10 chars', () => {
    const config = { ...baseConfig, reportFramingStatement: 'A sufficiently long framing statement.' };
    render(<FramingStep config={config} onChange={() => {}} />);
    expect(screen.getByText(/This will inform every section narrative/)).toBeTruthy();
  });

  it('shows investor-specific textarea placeholder', () => {
    render(<FramingStep config={{ ...baseConfig, audience: 'investors' }} onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('revenue increase');
  });

  it('shows customers-specific textarea placeholder', () => {
    render(<FramingStep config={{ ...baseConfig, audience: 'customers' }} onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.placeholder).toContain('1 kg CO2e');
  });
});
