import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import BrandReportView from '@/components/outreach/BrandReportView';
import { estimateBrandFootprint } from '@/lib/outreach/brand-footprint-estimate';

function renderForKnownBrand() {
  const estimate = estimateBrandFootprint({
    brandName: 'Avallen',
    category: 'Brandy',
    countryOfOrigin: 'FR',
    skus: [{ name: 'Avallen Calvados', containerSizeMl: 700, abv: 40 }],
  });
  render(
    <BrandReportView token="tok_demo123" brandName="Avallen" countryOfOrigin="FR" estimate={estimate} />,
  );
  return estimate;
}

describe('BrandReportView', () => {
  it('renders the brand name and the headline per-bottle figure', () => {
    renderForKnownBrand();
    expect(screen.getByRole('heading', { level: 1, name: 'Avallen' })).toBeInTheDocument();
    // 3.0 kg/L × 0.7 L = 2.10 kg per bottle.
    expect(screen.getByText('2.1')).toBeInTheDocument();
  });

  it('frames the figures as an estimate, not a measured result', () => {
    renderForKnownBrand();
    expect(screen.getByText(/not a measured result/i)).toBeInTheDocument();
  });

  it('shows a claim CTA wired to the per-token claim route', () => {
    renderForKnownBrand();
    const cta = screen.getByRole('link', { name: /claim & verify your profile/i });
    expect(cta).toHaveAttribute('href', '/r/tok_demo123/claim');
  });

  it('lists the per-SKU breakdown', () => {
    renderForKnownBrand();
    expect(screen.getByText('Avallen Calvados')).toBeInTheDocument();
  });

  it('cites clickable sources for both carbon and water', () => {
    const estimate = renderForKnownBrand();
    const carbonLink = screen.getByRole('link', {
      name: new RegExp(estimate.carbon.source.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    });
    expect(carbonLink).toHaveAttribute('href', estimate.carbon.source.url);
    expect(carbonLink.getAttribute('href')).toMatch(/^https?:\/\//);
  });

  it('renders the estimator assumptions verbatim', () => {
    const estimate = renderForKnownBrand();
    for (const assumption of estimate.assumptions) {
      expect(screen.getByText(assumption)).toBeInTheDocument();
    }
  });
});
