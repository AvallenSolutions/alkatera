'use client';

/**
 * The Pricing page: "Choose your impact scale", ported faithfully from
 * the Claude Design source (Pricing.dc.html in project fc7cf965), with
 * one requested correction: the Blossom plan carries a flower (the
 * oxeye daisy) rather than the hawthorn tree the design shipped with,
 * so the Seed -> Blossom -> Canopy succession reads properly.
 */

import { useCallback, useRef, useState } from 'react';
import { MarketingButton } from '../shared/MarketingButton';
import { spaceGrotesk } from '../shared/fonts';
import { F_BODY, F_MONO, F_STATEMENT, KICKER, LeafMark, SiteFooter, SiteNav } from '../shared/chrome';
import { CursorCreatures, useReveal } from '../shared/effects';

interface Plan {
  name: string;
  icon: string;
  iconHeight: number;
  iconMarginTop: number;
  description: string;
  price: string;
  was: string;
  cta: string;
  ctaVariant: 'ink' | 'outline';
  features: string[];
  /** The first feature line is the bold "Everything in X, plus:" lead. */
  boldLead?: boolean;
  limits: [string, string];
  recommended?: boolean;
}

const PLANS: Plan[] = [
  {
    name: 'Seed',
    icon: '/assets/species/grass-seed-head.svg',
    iconHeight: 46,
    iconMarginTop: -6,
    description: 'For boutique brands establishing their sustainability foundations.',
    price: '£99',
    was: '£199',
    cta: 'Start free trial',
    ctaVariant: 'outline',
    features: [
      'Carbon Footprint (GHG) per product',
      'LCA: Cradle-to-Gate',
      'Rosa AI Assistant (25/mo)',
      'Dashboard & Vitality Score',
      'Greenwash Guardian (Website only)',
    ],
    limits: ['10 PRODUCTS · 10 LCAS · 2 TEAM', '2 FACILITIES · 10 SUPPLIERS · 10 REPORTS/MO'],
  },
  {
    name: 'Blossom',
    // The requested fix: a flower for Blossom (the design had tree-hawthorn).
    // The poppy: the oxeye daisy's cream petals vanish on the cream card.
    icon: '/assets/species/flower-poppy.svg',
    iconHeight: 50,
    iconMarginTop: -6,
    description: 'For scaling brands ready to turn impact into a strategic advantage.',
    price: '£249',
    was: '£399',
    cta: 'Start free trial',
    ctaVariant: 'ink',
    boldLead: true,
    features: [
      'Everything in Seed, plus:',
      'Full Scope 3 Categories',
      'LCA: Cradle-to-Shelf (Distribution)',
      'Water, Circularity, Land Use & Resource impacts',
      'B Corp & CDP tracking',
      'Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)',
    ],
    limits: ['30 PRODUCTS · 30 LCAS · 5 TEAM', '3 FACILITIES · 50 SUPPLIERS · 50 REPORTS/MO'],
    recommended: true,
  },
  {
    name: 'Canopy',
    icon: '/assets/species/tree-oak.svg',
    iconHeight: 52,
    iconMarginTop: -8,
    description: 'Comprehensive ecosystem management for established organisations.',
    price: '£599',
    was: '£899',
    cta: 'Contact Sales',
    ctaVariant: 'outline',
    boldLead: true,
    features: [
      'Everything in Blossom, plus:',
      'Impact Valuation: Monetise Your Sustainability Impact',
      'Full Lifecycle LCA (Cradle-to-Grave)',
      'Gap Analysis, Audit Packages & Verification Support',
      'All ESG modules including Governance & Ethics',
      'Unlimited Rosa AI & Greenwash Guardian',
    ],
    limits: ['100 PRODUCTS · 100 LCAS · 10 TEAM', '10 FACILITIES · 200 SUPPLIERS · 200 REPORTS/MO'],
  },
];

/* The comparison table. 'yes' renders the green YES, 'dash' the quiet en dash. */
type Cell = { y: true } | { d: true } | { t: string };
interface CompareRow {
  label: string;
  cells: [Cell, Cell, Cell];
}
interface CompareGroup {
  heading: string;
  rows: CompareRow[];
}

const YES: Cell = { y: true };
const DASH: Cell = { d: true };

const COMPARISON: CompareGroup[] = [
  {
    heading: 'Scale',
    rows: [
      { label: 'Products', cells: [{ t: '10' }, { t: '30' }, { t: '100' }] },
      { label: 'Product LCAs', cells: [{ t: '10' }, { t: '30' }, { t: '100' }] },
      { label: 'Team seats', cells: [{ t: '2' }, { t: '5' }, { t: '10' }] },
      { label: 'Facilities', cells: [{ t: '2' }, { t: '3' }, { t: '10' }] },
      { label: 'Suppliers', cells: [{ t: '10' }, { t: '50' }, { t: '200' }] },
      { label: 'Reports per month', cells: [{ t: '10' }, { t: '50' }, { t: '200' }] },
    ],
  },
  {
    heading: 'Measurement & tools',
    rows: [
      { label: 'Carbon Footprint (GHG) per product', cells: [YES, YES, YES] },
      { label: 'LCA depth', cells: [{ t: 'Cradle-to-Gate' }, { t: 'Cradle-to-Shelf' }, { t: 'Cradle-to-Grave' }] },
      { label: 'Company Emissions (Current Year)', cells: [YES, YES, YES] },
      { label: 'Product Passport', cells: [YES, YES, YES] },
      { label: 'Dashboard & Vitality Score', cells: [YES, YES, YES] },
      { label: 'Rosa AI Assistant', cells: [{ t: '25/mo' }, { t: '100/mo' }, { t: 'Unlimited' }] },
      { label: 'Greenwash Guardian', cells: [{ t: 'Website only' }, { t: '5 docs/mo' }, { t: 'Unlimited' }] },
      { label: 'Knowledge Bank', cells: [{ t: 'Read' }, { t: 'Upload & Manage' }, { t: 'Upload & Manage' }] },
    ],
  },
  {
    heading: 'Modules & support',
    rows: [
      { label: 'Full Scope 3 Categories', cells: [DASH, YES, YES] },
      { label: 'Water, Circularity, Land Use & Resource impacts', cells: [DASH, YES, YES] },
      { label: 'People & Culture, Community Impact modules', cells: [DASH, YES, YES] },
      { label: 'Vehicle Registry & Supply Chain Mapping', cells: [DASH, YES, YES] },
      { label: 'B Corp & CDP tracking', cells: [DASH, YES, YES] },
      { label: 'Impact Valuation: Monetise Your Sustainability Impact', cells: [DASH, DASH, YES] },
      { label: 'Gap Analysis, Audit Packages & Verification Support', cells: [DASH, DASH, YES] },
      { label: 'All ESG modules including Governance & Ethics', cells: [DASH, DASH, YES] },
      { label: 'Year-over-Year Comparisons', cells: [DASH, DASH, YES] },
      { label: 'Advanced Data Quality Scoring & EF 3.1', cells: [DASH, DASH, YES] },
    ],
  },
];

const CMP_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.7fr 0.9fr 0.9fr 0.9fr',
  gap: '0 24px',
};

function CompareCell({ cell }: { cell: Cell }) {
  if ('y' in cell) {
    return (
      <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', color: '#047857' }}>
        YES
      </span>
    );
  }
  if ('d' in cell) {
    return <span style={{ fontFamily: F_MONO, fontSize: 11, color: '#6F6F68' }}>–</span>;
  }
  const numeric = /^\d+$/.test(cell.t);
  return numeric ? (
    <span style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 15, fontVariantNumeric: 'tabular-nums', color: '#1A1B1D' }}>
      {cell.t}
    </span>
  ) : (
    <span style={{ fontFamily: F_BODY, fontSize: 12.5, color: '#1A1B1D' }}>{cell.t}</span>
  );
}

export function PricingClient() {
  const rootRef = useRef<HTMLDivElement>(null);
  const trialInputRef = useRef<HTMLInputElement>(null);
  const [trialDone, setTrialDone] = useState(false);
  const [trialError, setTrialError] = useState(false);

  useReveal(rootRef);

  const goTrial = useCallback(() => {
    const el = document.getElementById('trial');
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const top = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' });
  }, []);

  const submitTrial = useCallback(() => {
    const v = trialInputRef.current?.value ?? '';
    if (/.+@.+\..+/.test(v)) {
      setTrialDone(true);
      setTrialError(false);
    } else {
      setTrialError(true);
    }
  }, []);

  return (
    <div ref={rootRef} className={`mkt-home ${spaceGrotesk.variable}`}>
      <SiteNav active="pricing" onTrialClick={goTrial} />

      <main>
        {/* ————— Hero ————— */}
        <section
          className="mkt-pad"
          style={{
            padding: '170px 48px 170px', boxSizing: 'border-box', background: '#BF4B2A',
            color: '#F2F1EA', position: 'relative', overflow: 'hidden',
          }}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" style={{ position: 'absolute', right: -110, top: -90, width: 420, height: 420, opacity: 0.16, pointerEvents: 'none' }}>
            <g fill="none" stroke="#F2F1EA" strokeWidth="2.6">
              <circle cx="24" cy="24" r="17" />
              <circle cx="24" cy="24" r="7" />
            </g>
            <g stroke="#F2F1EA" strokeWidth="2.4" strokeLinecap="round">
              <line x1="24" y1="2" x2="24" y2="8" />
              <line x1="24" y1="40" x2="24" y2="46" />
              <line x1="2" y1="24" x2="8" y2="24" />
              <line x1="40" y1="24" x2="46" y2="24" />
            </g>
          </svg>
          <div style={{ maxWidth: 1184, margin: '0 auto', position: 'relative' }}>
            <p data-reveal="0" style={{ ...KICKER, color: 'rgba(242,241,234,0.7)', margin: '0 0 26px' }}>
              alkatera·OS · Founding partner pricing · Limited availability
            </p>
            <h1
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(44px,6vw,88px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#F2F1EA', margin: '0 0 26px', maxWidth: '14ch',
              }}
            >
              <span data-reveal="80" style={{ display: 'inline-block' }}>Choose your</span>{' '}
              <span data-reveal="200" style={{ display: 'inline-block' }}>impact scale.</span>
            </h1>
            <p data-reveal="320" style={{ fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6, color: 'rgba(242,241,234,0.8)', maxWidth: '54ch', margin: 0 }}>
              Three plans, Seed, Blossom and Canopy, from boutique brands to established
              organisations.
            </p>
          </div>
        </section>

        {/* ————— The plans ————— */}
        <section className="mkt-pad" style={{ background: '#ECEAE3', padding: '0 48px 110px', boxSizing: 'border-box' }}>
          <div
            style={{
              maxWidth: 1184, margin: '-110px auto 0', display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: 20,
              alignItems: 'start', position: 'relative',
            }}
          >
            {PLANS.map((plan, i) => (
              <div
                key={plan.name}
                data-reveal={String(i * 90)}
                style={{
                  background: '#F2F1EA',
                  border: plan.recommended ? '1.5px solid #1A1B1D' : '1px solid #D9D6CB',
                  borderRadius: 6, padding: '34px 30px', boxSizing: 'border-box', position: 'relative',
                }}
              >
                {plan.recommended && (
                  <p
                    style={{
                      position: 'absolute', top: -9, left: 28, background: '#1A1B1D', color: '#F2F1EA',
                      fontFamily: F_MONO, fontWeight: 700, fontSize: 8.5, letterSpacing: '0.2em',
                      textTransform: 'uppercase', padding: '3px 10px', borderRadius: 999, margin: 0,
                    }}
                  >
                    Recommended
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, margin: '0 0 8px' }}>
                  <h2 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: '#1A1B1D', margin: 0 }}>
                    {plan.name}
                  </h2>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={plan.icon}
                    alt=""
                    aria-hidden="true"
                    style={{ height: plan.iconHeight, width: 'auto', opacity: 0.9, marginTop: plan.iconMarginTop }}
                  />
                </div>
                <p style={{ fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, color: '#6F6F68', margin: '0 0 22px', minHeight: 40 }}>
                  {plan.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '0 0 4px' }}>
                  <span style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 52, letterSpacing: '-0.035em', fontVariantNumeric: 'tabular-nums', color: '#1A1B1D' }}>
                    {plan.price}
                  </span>
                  <span style={{ fontFamily: F_STATEMENT, fontWeight: 500, fontSize: 18, color: '#6F6F68', textDecoration: 'line-through' }}>
                    {plan.was}
                  </span>
                  <span style={{ fontFamily: F_BODY, fontSize: 13, color: '#6F6F68' }}>/mo</span>
                </div>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A97C14', margin: '0 0 24px' }}>
                  Founding partner rate
                </p>
                <div style={{ margin: '0 0 24px' }}>
                  <MarketingButton
                    variant={plan.ctaVariant}
                    size="lg"
                    onClick={goTrial}
                    style={{ width: '100%' }}
                  >
                    {plan.cta}
                  </MarketingButton>
                </div>
                <div style={{ borderTop: '1px solid #D9D6CB', paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.45, color: '#1A1B1D' }}>
                  {plan.features.map((feature, f) => (
                    <span key={feature} style={plan.boldLead && f === 0 ? { fontWeight: 600 } : undefined}>
                      {feature}
                    </span>
                  ))}
                </div>
                <p style={{ fontFamily: F_MONO, fontSize: 9.5, letterSpacing: '0.12em', color: '#6F6F68', borderTop: '1px solid #D9D6CB', margin: '20px 0 0', paddingTop: 16, lineHeight: 1.8 }}>
                  {plan.limits[0]}
                  <br />
                  {plan.limits[1]}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ————— Compare the plans ————— */}
        <section className="mkt-pad" style={{ background: '#ECEAE3', borderTop: '1px solid #D9D6CB', padding: '100px 48px 110px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 1184, margin: '0 auto' }}>
            <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 22px' }}>
              In full · Every line of every plan
            </p>
            <h2
              data-reveal="100"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,4.4vw,62px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 48px',
              }}
            >
              Compare the plans.
            </h2>

            <div className="mkt-cmp-scroll">
              <div className="mkt-cmp-inner" style={{ minWidth: 0 }}>
                <div
                  style={{
                    ...CMP_GRID, alignItems: 'end', position: 'sticky', top: 60, zIndex: 30,
                    background: '#ECEAE3', borderBottom: '2px solid #1A1B1D', padding: '14px 0 12px',
                  }}
                >
                  <span />
                  <div>
                    <p style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 19, letterSpacing: '-0.03em', color: '#1A1B1D', margin: 0 }}>Seed</p>
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em', color: '#6F6F68', margin: '2px 0 0' }}>£99/MO</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 19, letterSpacing: '-0.03em', color: '#1A1B1D', margin: 0 }}>Blossom</p>
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em', color: '#A97C14', margin: '2px 0 0' }}>£249/MO · RECOMMENDED</p>
                  </div>
                  <div>
                    <p style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 19, letterSpacing: '-0.03em', color: '#1A1B1D', margin: 0 }}>Canopy</p>
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.14em', color: '#6F6F68', margin: '2px 0 0' }}>£599/MO</p>
                  </div>
                </div>

                {COMPARISON.map((group, g) => (
                  <div key={group.heading}>
                    <p
                      style={{
                        fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
                        textTransform: 'uppercase', color: '#205E40',
                        margin: g === 0 ? '28px 0 4px' : '34px 0 4px', padding: '8px 0',
                      }}
                    >
                      {group.heading}
                    </p>
                    {group.rows.map((row) => (
                      <div
                        key={row.label}
                        className="mkt-cmp-row"
                        style={{ ...CMP_GRID, alignItems: 'center', borderBottom: '1px solid #D9D6CB', padding: '10px 0' }}
                      >
                        <span style={{ fontFamily: F_BODY, fontSize: 13, color: '#1A1B1D' }}>{row.label}</span>
                        {row.cells.map((cell, c) => (
                          <CompareCell key={c} cell={cell} />
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ————— The trial ————— */}
        <section
          id="trial"
          className="mkt-pad"
          style={{
            background: '#205E40', color: '#F2F1EA', position: 'relative', overflow: 'hidden',
            padding: '110px 48px', boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'absolute', left: -100, top: -100, width: 400, height: 400, opacity: 0.16 }}>
            <LeafMark size={400} stroke="#F2F1EA" />
          </div>
          <div
            className="mkt-grid-collapse"
            style={{
              maxWidth: 1184, margin: '0 auto', display: 'grid',
              gridTemplateColumns: 'minmax(300px,1fr) minmax(300px,440px)', gap: 56,
              alignItems: 'center', position: 'relative',
            }}
          >
            <div>
              <p data-reveal="0" style={{ ...KICKER, color: 'rgba(242,241,234,0.65)', margin: '0 0 24px' }}>
                30 days · No card · No auto-charge
              </p>
              <h2
                data-reveal="100"
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,4.8vw,68px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', margin: '0 0 24px',
                }}
              >
                Prefer to try before you buy?
              </h2>
              <p data-reveal="200" style={{ fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6, color: 'rgba(242,241,234,0.78)', maxWidth: '52ch', margin: 0 }}>
                Start a 30-day free trial. Add a facility, build a product LCA and explore
                the platform. We never charge automatically when your trial ends, you choose
                if and when to continue.
              </p>
            </div>
            <div data-reveal="300" style={{ background: '#F2F1EA', borderRadius: 6, padding: '30px 28px' }}>
              {!trialDone && (
                <>
                  <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 17, letterSpacing: '-0.02em', color: '#1A1B1D', margin: '0 0 16px' }}>
                    Start your free trial.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      ref={trialInputRef}
                      type="email"
                      placeholder="you@yourbrand.com"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') submitTrial();
                      }}
                      style={{
                        fontFamily: F_BODY, fontSize: 14, color: '#1A1B1D', background: '#ECEAE3',
                        border: '1px solid #D9D6CB', borderRadius: 999, padding: '12px 18px',
                        width: '100%', boxSizing: 'border-box',
                      }}
                    />
                    <MarketingButton size="lg" onClick={submitTrial} style={{ width: '100%' }}>
                      Start free trial
                    </MarketingButton>
                    {trialError && (
                      <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#BE123C', margin: '2px 0 0' }}>
                        That address does not look right.
                      </p>
                    )}
                    <p style={{ fontFamily: F_MONO, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#6F6F68', margin: '4px 0 0' }}>
                      Free greenwash scan included
                    </p>
                  </div>
                </>
              )}
              {trialDone && (
                <>
                  <p style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 22, letterSpacing: '-0.03em', color: '#047857', margin: '0 0 8px' }}>
                    You&apos;re in.
                  </p>
                  <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: '#6F6F68', margin: 0 }}>
                    Your 30-day trial awaits. Check your inbox, your forest starts small.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <SiteFooter
          platformLinksHref="/platform#modules"
          companyLinks={[
            { label: 'Manifesto', href: '/#manifesto' },
            { label: "Buyer's Guide", href: '/best-sustainability-platform-drinks-industry' },
            { label: 'Knowledge', href: '/knowledge' },
            { label: 'Contact', href: '/contact' },
          ]}
          onCta={goTrial}
        />
      </main>

      <CursorCreatures />
    </div>
  );
}
