/**
 * Routes to market, rendered.
 *
 * The model tests prove the numbers; these prove a reader actually sees them,
 * that switching channel redraws only the two sections that vary, and that the
 * honest caveats appear when the sales split is unknown.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// The studio theme loads Space Grotesk through next/font, which is a build-time
// transform Vitest does not run. Nothing under test depends on the typeface.
vi.mock('next/font/google', () => ({
  Space_Grotesk: () => ({ variable: '--font-space-grotesk', className: 'font-mock' }),
}));

// The @/components/studio barrel re-exports desk-priorities, which builds a
// Supabase client at module scope and throws without these. Nothing under test
// touches the database; these only get the barrel imported.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'test-anon-key';

const { RoutesToMarket, AddRoute } = await import('../RoutesToMarket');
type DossierScenario = import('@/lib/lca/dossier').DossierScenario;
type DossierHeadline = import('@/lib/lca/dossier').DossierHeadline;

function scenario(over: Partial<DossierScenario> = {}): DossierScenario {
  return {
    id: 'sc-retail',
    name: 'Retail (off-trade)',
    channel: 'off_trade_retail',
    isPrimary: true,
    sharePct: null,
    totalKgCo2e: 1.05,
    sections: {
      distribution: {
        id: 'distribution', title: 'Getting it to customers',
        blurb: 'How far this product travels after it leaves you, and by what.',
        state: 'settled', kgCo2e: 0.08, sharePct: 7.6, provenance: 'confirmed',
        rows: [
          { id: 'a', title: 'Factory to distribution centre', value: '200', unit: 'km' },
          { id: 'b', title: 'Distribution centre to retail', value: '150', unit: 'km' },
        ],
      },
      after: {
        id: 'after', title: 'After it is sold',
        blurb: 'Chilling it, drinking it, and what happens to the packaging.',
        state: 'settled', kgCo2e: 0.02, sharePct: 1.9, provenance: 'estimated', rows: [],
      },
    },
    ...over,
  };
}

const ON_TRADE = scenario({
  id: 'sc-bar', name: 'On-trade', channel: 'on_trade', isPrimary: false, totalKgCo2e: 0.97,
  sections: {
    distribution: {
      id: 'distribution', title: 'Getting it to customers',
      blurb: 'How far this product travels after it leaves you, and by what.',
      state: 'unreviewed', kgCo2e: 0.01, sharePct: 1.0, provenance: 'estimated',
      note: 'Using a standard 50 km delivery by lorry. Nobody has checked that against your actual routes.',
      rows: [{ id: 'c', title: 'Factory to retail', value: '50', unit: 'km' }],
    },
    after: {
      id: 'after', title: 'After it is sold',
      blurb: 'Chilling it, drinking it, and what happens to the packaging.',
      state: 'settled', kgCo2e: 0.03, sharePct: 3.1, provenance: 'estimated', rows: [],
    },
  },
});

const WEIGHTED: DossierHeadline = {
  value: 1.026, basis: 'weighted', min: 0.97, max: 1.05, sharesComplete: true,
};
const PRIMARY_ONLY: DossierHeadline = {
  value: 1.05, basis: 'primary', min: 0.97, max: 1.05, sharesComplete: false,
};

describe('RoutesToMarket', () => {
  it('shows nothing at all for a single-route product', () => {
    const { container } = render(<RoutesToMarket scenarios={[scenario()]} headline={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists every route and leads with the primary', () => {
    render(<RoutesToMarket scenarios={[scenario(), ON_TRADE]} headline={PRIMARY_ONLY} />);

    expect(screen.getByRole('button', { name: /Retail \(off-trade\)/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /On-trade/ })).toBeTruthy();
    // The primary route's number is showing before anything is clicked.
    expect(screen.getByText('1.050')).toBeTruthy();
    // 'Main route' appears both as the chip and inside the caveat copy.
    expect(screen.getAllByText(/Main route/i).length).toBeGreaterThan(0);
  });

  it('switching route redraws the two sections that vary', () => {
    render(<RoutesToMarket scenarios={[scenario(), ON_TRADE]} headline={PRIMARY_ONLY} />);

    // Retail: a real two-leg journey.
    expect(screen.getByText('Factory to distribution centre')).toBeTruthy();
    expect(screen.queryByText('Factory to retail')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /On-trade/ }));

    // On-trade: the untouched default, and it says so.
    expect(screen.getByText('Factory to retail')).toBeTruthy();
    expect(screen.queryByText('Factory to distribution centre')).toBeNull();
    expect(screen.getByText(/Nobody has checked that/)).toBeTruthy();
    expect(screen.getByText('0.970')).toBeTruthy();
  });

  it('offers the sales-split question while the mix is unknown', () => {
    const onSetShares = vi.fn();
    render(
      <RoutesToMarket scenarios={[scenario(), ON_TRADE]} headline={PRIMARY_ONLY} onSetShares={onSetShares} />,
    );

    expect(screen.getAllByText(/main route only/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Set the sales split/ }));
    expect(onSetShares).toHaveBeenCalledOnce();
  });

  it('stops asking once the split is known, and says the number is weighted', () => {
    render(
      <RoutesToMarket
        scenarios={[scenario({ sharePct: 70 }), { ...ON_TRADE, sharePct: 30 }]}
        headline={WEIGHTED}
        onSetShares={vi.fn()}
      />,
    );

    expect(screen.getByText(/Weighted by sales/)).toBeTruthy();
    expect(screen.queryByText(/Set the sales split/)).toBeNull();
    // Shares ride on the tabs so the reader can see the mix without opening it.
    expect(screen.getByRole('button', { name: /70%/ })).toBeTruthy();
  });

  it('shows the range across routes, so no single figure reads as the whole story', () => {
    render(<RoutesToMarket scenarios={[scenario(), ON_TRADE]} headline={WEIGHTED} />);
    expect(screen.getByText(/0\.970 to 1\.050 kg CO₂e depending on route/)).toBeTruthy();
  });
});

describe('AddRoute', () => {
  it('offers only the channels not already in use', () => {
    render(<AddRoute onAdd={vi.fn()} busy={false} existingChannels={['on_trade', 'dtc']} />);

    expect(screen.getByRole('button', { name: 'Shops and supermarkets' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bars and restaurants' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Direct to customer' })).toBeNull();
  });

  it('disappears once every channel is covered', () => {
    const { container } = render(
      <AddRoute onAdd={vi.fn()} busy={false} existingChannels={['on_trade', 'off_trade_retail', 'dtc', 'export']} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('reassures that nothing is entered twice', () => {
    render(<AddRoute onAdd={vi.fn()} busy={false} existingChannels={[]} />);
    expect(screen.getByText(/Nothing about your recipe or packaging is entered twice/)).toBeTruthy();
  });

  it('passes the chosen channel up', () => {
    const onAdd = vi.fn();
    render(<AddRoute onAdd={onAdd} busy={false} existingChannels={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Bars and restaurants' }));
    expect(onAdd).toHaveBeenCalledWith('on_trade');
  });
});
