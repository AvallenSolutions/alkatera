'use client';

/**
 * The Platform page: "The Ecological Intelligence Engine", ported
 * faithfully from the Claude Design source (Platform.dc.html in project
 * fc7cf965). Copy is verbatim; the hero panel's parallax and number
 * reroll, the reveals, and the creatures are the design's own script
 * re-homed as hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GrowthField } from '@/components/studio/growth/growth-field';
import { MarketingButton } from '../shared/MarketingButton';
import { spaceGrotesk } from '../shared/fonts';
import { F_BODY, F_MONO, F_STATEMENT, KICKER, MONO_LABEL, SiteFooter, SiteNav } from '../shared/chrome';
import { CursorCreatures, useReveal } from '../shared/effects';
import { PLATFORM_FAQ } from './faq-data';

const FOREST_STYLE = { maskImage: 'none', WebkitMaskImage: 'none' } as const;

/* The sun mark (traceability), from the design's poster language. */
function SunMark({ stroke, style }: { stroke: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" style={style}>
      <circle cx="24" cy="24" r="7.5" fill={stroke} />
      <g stroke={stroke} strokeWidth="2.6" strokeLinecap="round">
        <line x1="24" y1="4" x2="24" y2="11" />
        <line x1="24" y1="37" x2="24" y2="44" />
        <line x1="4" y1="24" x2="11" y2="24" />
        <line x1="37" y1="24" x2="44" y2="24" />
        <line x1="9.8" y1="9.8" x2="14.7" y2="14.7" />
        <line x1="33.3" y1="33.3" x2="38.2" y2="38.2" />
        <line x1="9.8" y1="38.2" x2="14.7" y2="33.3" />
        <line x1="33.3" y1="14.7" x2="38.2" y2="9.8" />
      </g>
    </svg>
  );
}

/* The six modules. */
const MODULES = [
  {
    kicker: '01 · Corporate Footprinting', colour: '#205E40',
    title: 'Full Operational Clarity', icon: 'whisky-still',
    body: 'One dashboard for your entire business. Automate the tracking of your Scope 1, 2, and 3 emissions alongside water and waste, with a holistic, audit-ready view from the office to the production floor.',
    footer: 'Scope 1, 2 & 3 · Facilities · Fleet · Water & Waste · Production Data',
  },
  {
    kicker: '02 · Product Environmental Impact', colour: '#2B46C0',
    title: 'Liquid & Packaging Intelligence', icon: 'beer-glass',
    body: "Map the environmental footprint of every SKU you produce. Run 'what-if' scenarios to instantly see how a glass-weight change or a new recipe affects your total ecological score.",
    footer: 'SKU-Level LCA · What-If Scenarios · Recipe Modelling · Packaging Optimisation',
  },
  {
    kicker: '03 · Compliance & Reporting', colour: '#A97C14',
    title: 'The Regulatory Shield', icon: 'barrel',
    body: "Say goodbye to regulatory anxiety. Whether you're facing CSRD, the Green Claims Directive, or B Corp certification, generate the verifiable reports you need to stay safe and prove your resilience.",
    footer: 'CSRD · GRI · CDP · B Corp · ISO 14001 · SBTi',
  },
  {
    kicker: '04 · Upstream Visibility', colour: '#BF4B2A',
    title: 'Supply Chain Clarity', icon: 'grapes',
    body: 'See beyond your own walls. Bridge the data gap by gathering real insights from growers on farming practices and water use. Track your ingredients from the field to the bottle with total confidence.',
    footer: 'Supplier Engagement · Farming Practices · Traceability · Verification',
  },
  {
    kicker: '05 · Greenwashing Risk Defence', colour: '#BE123C',
    title: 'Greenwash Guardian', icon: 'agave',
    body: 'Every public claim scanned against UK and EU green claims law before the regulators see it, with a risk score for each. The full defence system is below.',
    footer: 'Website Scanning · Document Analysis · Risk Scoring · UK & EU Law',
  },
  {
    kicker: '06 · Performance Benchmarking', colour: '#205E40',
    title: 'Vitality Score', icon: 'barley',
    body: 'Your sustainability health check at a glance. A four-pillar score across Climate, Water, Circularity, and Nature, benchmarked against your industry so you know exactly where you stand and where to focus.',
    footer: 'Climate Score · Water Score · Circularity · Nature & Biodiversity',
  },
];

/* We Measure What Matters: the three ESG columns. */
const ESG_COLUMNS = [
  {
    heading: 'Environmental', colour: '#205E40',
    rows: [
      ['Climate Change', 'GHG Emissions'],
      ['Water Depletion', 'Blue · Green · Grey'],
      ['Land Use & Biodiversity', 'Ecological Impact'],
      ['Circularity & Waste', 'Diversion & Recovery'],
      ['Eutrophication & Acidification', 'Marine & Terrestrial'],
    ],
  },
  {
    heading: 'Social', colour: '#A97C14',
    rows: [
      ['People & Culture', 'Fair Work & Wellbeing'],
      ['Diversity & Inclusion', 'Workforce Equity'],
      ['Community Impact', 'Local & Charitable'],
      ['Training & Development', 'Skills & Growth'],
      ['Volunteering & Giving', 'Social Value'],
    ],
  },
  {
    heading: 'Governance', colour: '#2B46C0',
    rows: [
      ['Board Composition', 'Leadership Structure'],
      ['Policy Management', 'Standards & Procedures'],
      ['Ethics & Transparency', 'Accountability'],
      ['Stakeholder Engagement', 'Partnerships'],
      ['Governance Scoring', 'Maturity Assessment'],
    ],
  },
];

/* The frameworks word wall: size, weight, resting colour, hover tint, tilt. */
const SIZE = {
  lg: 'clamp(28px,3.4vw,48px)',
  mid: 'clamp(24px,3vw,42px)',
  md: 'clamp(22px,2.6vw,36px)',
} as const;

const FRAMEWORKS: { label: string; weight: 500 | 700; size: keyof typeof SIZE; colour: string; hover: string; rotate: string }[] = [
  { label: 'B Corp', weight: 700, size: 'lg', colour: '#1A1B1D', hover: '#205E40', rotate: '-1.2deg' },
  { label: 'CDP Climate Change', weight: 500, size: 'md', colour: '#6F6F68', hover: '#2B46C0', rotate: '1deg' },
  { label: 'CSRD', weight: 700, size: 'lg', colour: '#205E40', hover: '#BF4B2A', rotate: '-0.8deg' },
  { label: 'GRI Standards', weight: 500, size: 'md', colour: '#6F6F68', hover: '#A97C14', rotate: '1.2deg' },
  { label: 'ISO 14001', weight: 700, size: 'mid', colour: '#1A1B1D', hover: '#2B46C0', rotate: '-1deg' },
  { label: 'ISO 50001', weight: 500, size: 'md', colour: '#6F6F68', hover: '#205E40', rotate: '0.9deg' },
  { label: 'ISO 14044', weight: 700, size: 'mid', colour: '#1A1B1D', hover: '#BF4B2A', rotate: '-1.1deg' },
  { label: 'SBTi', weight: 700, size: 'lg', colour: '#205E40', hover: '#1A1B1D', rotate: '1deg' },
  { label: 'Green Claims Directive', weight: 500, size: 'md', colour: '#6F6F68', hover: '#BF4B2A', rotate: '-0.9deg' },
  { label: 'TCFD', weight: 700, size: 'mid', colour: '#1A1B1D', hover: '#2B46C0', rotate: '1.1deg' },
];

/* Built for Drinks: the six bordered cells. */
const DRINKS_CELLS: { title: string; body: string; icons: [string, number][] }[] = [
  {
    title: 'Process Modelling',
    body: 'Specific calculations for brewing, distilling, fermentation, and bottling, not generic manufacturing assumptions.',
    icons: [['whisky-still', 56], ['barrel', 42], ['beer-glass', 48]],
  },
  {
    title: 'Ingredient Traceability',
    body: 'Track every ingredient from its agricultural source through to the final product, with real supplier data.',
    icons: [['grapes', 50], ['agave', 42], ['barley', 52]],
  },
  {
    title: 'Packaging Optimisation',
    body: 'Model glass weight changes, material alternatives, and format shifts to find the sweet spot between impact and brand prestige.',
    icons: [['wine-bottle', 58], ['beer-can', 40]],
  },
  {
    title: 'Water Intelligence',
    body: 'Water-to-product ratios, scarcity-weighted footprints, and source-specific analysis, because water is your primary ingredient.',
    icons: [['water', 46]],
  },
  {
    title: 'Hospitality',
    body: 'Taprooms, tasting rooms, and visitor centres, if your facility pours as well as produces, its hospitality impact joins the same ledger.',
    icons: [['cocktail-coupe', 44], ['wine-glass', 50]],
  },
  {
    title: 'Community',
    body: 'Measure your community impact: local employment, sourcing, giving, and the initiatives that root your brand in its place.',
    icons: [['cheers', 48]],
  },
];

const DRINKS_STATS: { stat: string; label: string; sub: string }[] = [
  { stat: '10+', label: 'Environmental impact categories', sub: 'Beyond carbon alone' },
  { stat: '3', label: 'Water footprint types tracked', sub: 'Blue · Green · Grey' },
  { stat: '7+', label: 'Reporting frameworks supported', sub: 'B Corp · CSRD · GRI · CDP & more' },
  { stat: '∞', label: 'What-if scenarios per product', sub: 'Recipe & packaging modelling' },
];

const HERO_KG_VALUES = ['1.42', '1.38', '1.47', '1.35', '1.42'];

export function PlatformClient() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const heroPanelRef = useRef<HTMLDivElement>(null);
  const rollTimer = useRef<ReturnType<typeof setInterval>>();

  const [heroKg, setHeroKg] = useState('1.42');
  const [faqOpen, setFaqOpen] = useState<boolean[]>([true, false, false]);

  useReveal(rootRef);

  /* The hero panel drifts gently against the scroll. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const panel = heroPanelRef.current;
        if (panel) panel.style.transform = `translateY(${window.scrollY * -0.05}px)`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => () => clearInterval(rollTimer.current), []);

  /* Click the big number: it rerolls through nearby readings, then settles. */
  const rerollNumber = useCallback(() => {
    let i = 0;
    clearInterval(rollTimer.current);
    rollTimer.current = setInterval(() => {
      setHeroKg(HERO_KG_VALUES[i % HERO_KG_VALUES.length]);
      i += 1;
      if (i > 6) {
        clearInterval(rollTimer.current);
        setHeroKg('1.42');
      }
    }, 90);
  }, []);

  const goAccess = useCallback(() => router.push('/pricing'), [router]);
  const goManifesto = useCallback(() => router.push('/#manifesto'), [router]);

  const toggleFaq = (i: number) =>
    setFaqOpen((open) => open.map((v, j) => (j === i ? !v : v)));

  return (
    <div ref={rootRef} className={`mkt-home ${spaceGrotesk.variable}`}>
      <SiteNav active="platform" />

      <main>
        {/* ————— Hero ————— */}
        <section
          className="mkt-pad"
          style={{
            minHeight: '92vh', boxSizing: 'border-box', padding: '160px 48px 90px',
            background: '#2B46C0', color: '#F2F1EA', position: 'relative', overflow: 'hidden',
          }}
        >
          <SunMark
            stroke="#F2F1EA"
            style={{ position: 'absolute', left: -130, bottom: -130, width: 460, height: 460, opacity: 0.16, pointerEvents: 'none' }}
          />
          <div
            className="mkt-grid-collapse"
            style={{
              maxWidth: 1184, margin: '0 auto', display: 'grid',
              gridTemplateColumns: '1.2fr 1fr', gap: 64, alignItems: 'center', position: 'relative',
            }}
          >
            <div>
              <p data-reveal="0" style={{ ...KICKER, color: 'rgba(242,241,234,0.68)', margin: '0 0 26px' }}>
                alkatera·OS · The workbench · Purpose-built for the drinks industry
              </p>
              <h1
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(48px,6vw,88px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', color: '#F2F1EA', margin: '0 0 28px',
                }}
              >
                <span data-reveal="80" style={{ display: 'inline-block' }}>The Ecological</span>
                <br />
                <span data-reveal="200" style={{ display: 'inline-block' }}>Intelligence Engine</span>
              </h1>
              <p
                data-reveal="320"
                style={{
                  fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6,
                  color: 'rgba(242,241,234,0.8)', maxWidth: '50ch', margin: '0 0 30px',
                }}
              >
                The single platform that turns environmental complexity into competitive
                clarity. From carbon to water to biodiversity, measure, report, and
                strategise with confidence.
              </p>
              <div data-reveal="440" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <MarketingButton size="lg" onClick={goAccess}>Start free trial</MarketingButton>
                <a
                  className="mkt-cream-link"
                  href="#modules"
                  style={{
                    ...MONO_LABEL, color: '#F2F1EA', textDecoration: 'none',
                    borderBottom: '1px solid rgba(242,241,234,0.5)', paddingBottom: 3, alignSelf: 'center',
                  }}
                >
                  See How It Works
                </a>
              </div>
            </div>

            {/* The glass-box panel: a live-feeling read of one SKU. */}
            <div
              ref={heroPanelRef}
              data-reveal="300"
              style={{ display: 'flex', flexDirection: 'column', gap: 14, willChange: 'transform' }}
            >
              <div style={{ background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6, padding: '24px 24px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
                  <span style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', color: '#1A1B1D' }}>
                    Flagship IPA · 440ml
                  </span>
                  <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#047857' }}>
                    Audit-ready
                  </span>
                </div>
                <div onClick={rerollNumber} title="·" style={{ cursor: 'pointer', display: 'flex', alignItems: 'baseline', gap: 14 }}>
                  <span
                    style={{
                      fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 64, lineHeight: 0.9,
                      letterSpacing: '-0.035em', color: '#1A1B1D', fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {heroKg}
                  </span>
                  <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6F6F68' }}>
                    kg CO₂e · cradle to gate
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, marginTop: 18 }}>
                  <span style={{ flex: 1.6, height: 6, background: '#2B46C0', borderRadius: 2 }} />
                  <span style={{ flex: 1.1, height: 6, background: '#2B46C0', opacity: 0.75, borderRadius: 2 }} />
                  <span style={{ flex: 2.2, height: 6, background: '#2B46C0', opacity: 0.5, borderRadius: 2 }} />
                  <span style={{ flex: 0.9, height: 6, background: '#2B46C0', opacity: 0.3, borderRadius: 2 }} />
                </div>
                <div
                  style={{
                    display: 'flex', justifyContent: 'space-between', marginTop: 8,
                    fontFamily: F_MONO, fontSize: 8.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6F6F68',
                  }}
                >
                  <span>Ingredients</span><span>Ferment</span><span>Packaging</span><span>Freight</span>
                </div>
              </div>
              <div style={{ background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6, padding: '8px 24px' }}>
                {[
                  ['Water stewardship · 3.1 L per L', 'GOOD', '#047857'],
                  ['Packaging circularity · 71% recycled glass', 'ATTENTION', '#B45309'],
                  ['Greenwash guardian · 2 claims to fix', 'REVIEW', '#BE123C'],
                ].map(([label, state, colour], i, arr) => (
                  <div
                    key={state}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0', borderBottom: i < arr.length - 1 ? '1px solid #D9D6CB' : undefined,
                    }}
                  >
                    <span style={{ fontFamily: F_BODY, fontSize: 13, color: '#1A1B1D' }}>{label}</span>
                    <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.14em', color: colour }}>
                      {state}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: F_MONO, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(242,241,234,0.7)', margin: 0, textAlign: 'right' }}>
                Glass box · Every figure traceable to source
              </p>
            </div>
          </div>
        </section>

        {/* ————— Platform architecture: the six modules ————— */}
        <section id="modules" style={{ background: '#ECEAE3', boxSizing: 'border-box' }}>
          <div
            className="mkt-pad"
            style={{
              background: '#1A1B1D', color: '#F2F1EA', position: 'relative', overflow: 'hidden',
              padding: '110px 48px 150px', boxSizing: 'border-box',
            }}
          >
            <SunMark
              stroke="#F2F1EA"
              style={{ position: 'absolute', right: -90, top: -90, width: 380, height: 380, opacity: 0.16 }}
            />
            <div style={{ maxWidth: 1184, margin: '0 auto', position: 'relative' }}>
              <p data-reveal="0" style={{ ...KICKER, color: 'rgba(242,241,234,0.65)', margin: '0 0 26px' }}>
                The Architecture of Impact
              </p>
              <h2
                data-reveal="100"
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,5.4vw,76px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', margin: '0 0 30px',
                }}
              >
                One Platform.
                <br />
                Total Clarity.
              </h2>
              <div
                data-reveal="220"
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))',
                  gap: '24px 48px', maxWidth: 1000,
                }}
              >
                <p style={{ fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: 'rgba(242,241,234,0.82)', margin: 0 }}>
                  alka<strong>tera</strong> replaces the spreadsheet chaos, the consultancy
                  invoices, and the reporting headaches with a single intelligent platform.
                  We go far beyond carbon, measuring water, waste, land use, biodiversity,
                  and circularity, so you can build a sustainability programme that&apos;s
                  genuinely defensible.
                </p>
                <p style={{ fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: 'rgba(242,241,234,0.82)', margin: 0 }}>
                  Six modules. Each works independently or together, giving you the
                  flexibility to build your sustainability programme at your own pace.
                  Start where it matters most.
                </p>
              </div>
            </div>
          </div>
          <div className="mkt-pad" style={{ padding: '0 48px 110px', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 1184, margin: '-72px auto 0', position: 'relative' }}>
              <div
                className="mkt-modules-grid"
                style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px,1fr))', gap: 20 }}
              >
                {MODULES.map((mod, i) => (
                  <div
                    key={mod.kicker}
                    data-reveal={i % 2 === 0 ? '0' : '80'}
                    style={{
                      background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6,
                      padding: '34px 30px 38px', display: 'flex', flexDirection: 'column',
                    }}
                  >
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: mod.colour, margin: '0 0 16px' }}>
                      {mod.kicker}
                    </p>
                    <h3
                      style={{
                        fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(24px,2.2vw,30px)',
                        letterSpacing: '-0.03em', color: '#1A1B1D', margin: '0 0 12px',
                        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
                      }}
                    >
                      <span>{mod.title}</span>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/assets/drinks/${mod.icon}.svg`}
                        alt=""
                        aria-hidden="true"
                        style={{ height: 58, width: 'auto', opacity: 0.9, flexShrink: 0, marginTop: -14 }}
                      />
                    </h3>
                    <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: '#6F6F68', margin: '0 0 22px' }}>
                      {mod.body}
                    </p>
                    <p
                      style={{
                        fontFamily: F_MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                        color: '#6F6F68', margin: 'auto 0 0', borderTop: '1px solid #D9D6CB', paddingTop: 14,
                      }}
                    >
                      {mod.footer}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ————— We Measure What Matters ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#F2F1EA', borderTop: '1px solid #D9D6CB', borderBottom: '1px solid #D9D6CB',
            padding: '110px 48px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
          }}
        >
          <SunMark
            stroke="#1A1B1D"
            style={{ position: 'absolute', right: -100, top: -100, width: 380, height: 380, opacity: 0.08, pointerEvents: 'none' }}
          />
          <div style={{ maxWidth: 1184, margin: '0 auto', position: 'relative' }}>
            <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 22px' }}>Beyond Carbon</p>
            <h2
              data-reveal="100"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,4.8vw,68px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 16px',
              }}
            >
              We Measure What Matters
            </h2>
            <p data-reveal="180" style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: '#6F6F68', margin: '0 0 56px', maxWidth: '60ch' }}>
              While others count carbon alone, alka<strong>tera</strong> quantifies the full
              picture (environmental, social, and governance) because genuine sustainability
              demands all three.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 40 }}>
              {ESG_COLUMNS.map((col, c) => (
                <div key={col.heading} data-reveal={String(c * 120)}>
                  <p
                    style={{
                      ...KICKER, color: col.colour, borderBottom: `2px solid ${col.colour}`,
                      paddingBottom: 12, margin: '0 0 4px',
                    }}
                  >
                    {col.heading}
                  </p>
                  {col.rows.map(([title, sub], r) => (
                    <div key={title} style={{ padding: '14px 0', borderBottom: r < col.rows.length - 1 ? '1px solid #D9D6CB' : undefined }}>
                      <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 15, color: '#1A1B1D', margin: '0 0 3px' }}>{title}</p>
                      <p style={{ fontFamily: F_MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#6F6F68', margin: 0 }}>{sub}</p>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p
              data-reveal="300"
              style={{
                fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
                textTransform: 'uppercase', color: '#6F6F68', margin: '44px 0 0',
                borderTop: '1px solid #D9D6CB', paddingTop: 22,
              }}
            >
              Every number traceable · Every calculation audit-ready ·{' '}
              <span style={{ color: '#205E40' }}>ISO 14044 compliant</span>
            </p>
          </div>
        </section>

        {/* ————— Brain Trust ————— */}
        <section className="mkt-pad" style={{ background: '#ECEAE3', padding: '110px 48px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 1184, margin: '0 auto' }}>
            <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 22px' }}>Embedded Intelligence</p>
            <h2
              data-reveal="100"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,4.8vw,68px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 16px',
              }}
            >
              Your Sustainability Brain Trust
            </h2>
            <p data-reveal="180" style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: '#6F6F68', margin: '0 0 56px', maxWidth: '56ch' }}>
              Two embedded tools that turn complex sustainability questions into clear,
              actionable answers, without the consultancy fees.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px,1fr))', gap: 20, alignItems: 'stretch' }} className="mkt-modules-grid">
              <div
                data-reveal="0"
                style={{
                  background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6,
                  padding: '38px 34px', position: 'relative', overflow: 'hidden',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/assets/creatures/creature-rosa.svg"
                  alt=""
                  aria-hidden="true"
                  style={{ position: 'absolute', right: 18, bottom: 10, width: 110, opacity: 0.9 }}
                />
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#205E40', margin: '0 0 16px' }}>
                  Rosa
                </p>
                <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(24px,2.4vw,32px)', letterSpacing: '-0.03em', color: '#1A1B1D', margin: '0 0 14px' }}>
                  Your Sustainability Guide
                </h3>
                <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: '#6F6F68', margin: '0 0 22px', maxWidth: '52ch' }}>
                  Instant, expert answers on GHG Protocol, SBTi, CSRD, water stewardship,
                  circular economy, and more. Rosa translates complex sustainability science
                  into plain language your whole team can use.
                </p>
                <div style={{ fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, color: '#1A1B1D', maxWidth: '80%' }}>
                  <div style={{ padding: '8px 0', borderTop: '1px solid #D9D6CB' }}>Covers 12+ sustainability frameworks and standards</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid #D9D6CB' }}>Drinks industry-specific guidance</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid #D9D6CB' }}>Data visualisations and actionable recommendations</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid #D9D6CB' }}>Always learning, always up to date</div>
                </div>
              </div>
              <div
                data-reveal="120"
                style={{
                  background: '#1A1B1D', color: '#F2F1EA', borderRadius: 6, padding: '38px 34px',
                  position: 'relative', overflow: 'hidden',
                }}
              >
                <svg viewBox="0 0 48 48" aria-hidden="true" style={{ position: 'absolute', right: -56, bottom: -56, width: 220, height: 220, opacity: 0.14 }}>
                  <g transform="rotate(-14 24 24)" fill="none" stroke="#F2F1EA">
                    <rect x="9" y="15" width="30" height="20" rx="2" strokeWidth="2.6" />
                    <path d="M9.8 16.5 L24 27 L38.2 16.5" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </svg>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,241,234,0.65)', margin: '0 0 16px' }}>
                  Greenwash Guardian
                </p>
                <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(24px,2.4vw,32px)', letterSpacing: '-0.03em', margin: '0 0 14px' }}>
                  Your Claims Defence System
                </h3>
                <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: 'rgba(242,241,234,0.78)', margin: '0 0 22px', maxWidth: '52ch' }}>
                  Scan your marketing materials, website, and social posts against UK Green
                  Claims Code and EU Green Claims Directive, before the regulators do. Get a
                  risk score and plain-English fixes for every claim.
                </p>
                <div style={{ fontFamily: F_BODY, fontSize: 13, lineHeight: 1.5, color: '#F2F1EA' }}>
                  <div style={{ padding: '8px 0', borderTop: '1px solid rgba(242,241,234,0.2)' }}>Scans websites, PDFs, social posts, and documents</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid rgba(242,241,234,0.2)' }}>Checks against UK CMA and EU legislation</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid rgba(242,241,234,0.2)' }}>Claim-by-claim risk scoring with suggested rewrites</div>
                  <div style={{ padding: '8px 0', borderTop: '1px solid rgba(242,241,234,0.2)' }}>Bulk URL scanning for full site audits</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ————— Frameworks ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#F2F1EA', borderTop: '1px solid #D9D6CB', borderBottom: '1px solid #D9D6CB',
            padding: '110px 48px', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
          }}
        >
          <svg viewBox="0 0 48 48" aria-hidden="true" style={{ position: 'absolute', right: -110, bottom: -110, width: 400, height: 400, opacity: 0.08, pointerEvents: 'none' }}>
            <g fill="none" stroke="#1A1B1D" strokeWidth="2.6">
              <circle cx="24" cy="24" r="17" />
              <circle cx="24" cy="24" r="7" />
            </g>
            <g stroke="#1A1B1D" strokeWidth="2.4" strokeLinecap="round">
              <line x1="24" y1="2" x2="24" y2="8" />
              <line x1="24" y1="40" x2="24" y2="46" />
              <line x1="2" y1="24" x2="8" y2="24" />
              <line x1="40" y1="24" x2="46" y2="24" />
            </g>
          </svg>
          <div style={{ maxWidth: 1184, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 52 }}>
              <div>
                <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 18px' }}>
                  Certifications &amp; Frameworks
                </p>
                <h2
                  data-reveal="80"
                  style={{
                    fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,4.4vw,62px)',
                    lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: 0,
                  }}
                >
                  Every Framework. One Place.
                </h2>
              </div>
              <p data-reveal="160" style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: '#6F6F68', maxWidth: '40ch', margin: 0 }}>
                Stop juggling separate tools for each reporting standard. alka<strong>tera</strong>{' '}
                maps your data to every major framework automatically.
              </p>
            </div>
            <div data-reveal="220" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '18px 44px' }}>
              {FRAMEWORKS.map((fw) => (
                <span
                  key={fw.label}
                  className="mkt-fw"
                  style={
                    {
                      fontFamily: F_STATEMENT,
                      fontWeight: fw.weight,
                      fontSize: SIZE[fw.size],
                      letterSpacing: fw.weight === 700 ? '-0.035em' : '-0.03em',
                      color: fw.colour,
                      '--fw-c': fw.hover,
                      '--fw-r': fw.rotate,
                    } as React.CSSProperties
                  }
                >
                  {fw.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ————— Built for Drinks ————— */}
        <section className="mkt-pad" style={{ background: '#ECEAE3', padding: '110px 48px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 1184, margin: '0 auto' }}>
            <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 22px' }}>Industry-Specific</p>
            <h2
              data-reveal="100"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,4.8vw,68px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 16px',
              }}
            >
              Built for Drinks
            </h2>
            <p data-reveal="180" style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.5, color: '#6F6F68', margin: '0 0 56px', maxWidth: '58ch' }}>
              This isn&apos;t a generic sustainability calculator. alka<strong>tera</strong> is
              engineered from the ground up for the unique science, supply chains, and
              processes of the drinks industry.
            </p>

            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))',
                borderTop: '1px solid #D9D6CB', borderLeft: '1px solid #D9D6CB', marginBottom: 64,
              }}
            >
              {DRINKS_CELLS.map((cell, i) => (
                <div
                  key={cell.title}
                  data-reveal={String(i * 80)}
                  style={{ borderRight: '1px solid #D9D6CB', borderBottom: '1px solid #D9D6CB', padding: '28px 26px 32px' }}
                >
                  <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 18, letterSpacing: '-0.02em', color: '#1A1B1D', margin: '0 0 10px' }}>
                    {cell.title}
                  </h3>
                  <p style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, color: '#6F6F68', margin: 0 }}>
                    {cell.body}
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 14, marginTop: 22 }}>
                    {cell.icons.map(([icon, h]) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={icon} src={`/assets/drinks/${icon}.svg`} alt="" aria-hidden="true" style={{ height: h, width: 'auto' }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 40 }}>
              {DRINKS_STATS.map((stat, i) => (
                <div key={stat.label} data-reveal={String(i * 80)}>
                  <p
                    style={{
                      fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(56px,5.4vw,84px)',
                      lineHeight: 0.9, letterSpacing: '-0.035em', color: '#205E40', margin: '0 0 10px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stat.stat}
                  </p>
                  <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 15, color: '#1A1B1D', margin: '0 0 4px' }}>{stat.label}</p>
                  <p style={{ fontFamily: F_MONO, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#6F6F68', margin: 0 }}>{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ————— FAQ ————— */}
        <section className="mkt-pad" style={{ background: '#F2F1EA', borderTop: '1px solid #D9D6CB', padding: '110px 48px', boxSizing: 'border-box' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <h2
              data-reveal="0"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,4.4vw,62px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 48px',
              }}
            >
              Frequently asked questions
            </h2>
            {PLATFORM_FAQ.map((item, i) => (
              <div
                key={item.question}
                data-reveal={String(i * 40)}
                onClick={() => toggleFaq(i)}
                style={{
                  borderTop: '1px solid #D9D6CB',
                  borderBottom: i === PLATFORM_FAQ.length - 1 ? '1px solid #D9D6CB' : undefined,
                  padding: '22px 4px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 20 }}>
                  <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em', color: '#1A1B1D', margin: 0 }}>
                    {item.question}
                  </h3>
                  <span style={{ fontFamily: F_STATEMENT, fontWeight: 500, fontSize: 22, color: '#6F6F68' }}>
                    {faqOpen[i] ? '−' : '+'}
                  </span>
                </div>
                {faqOpen[i] && (
                  <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: '#6F6F68', maxWidth: '70ch', margin: '14px 0 0' }}>
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ————— Final CTA ————— */}
        <section
          id="cta"
          className="mkt-pad"
          style={{
            background: '#ECEAE3', borderTop: '1px solid #D9D6CB', padding: '110px 48px 0',
            boxSizing: 'border-box', textAlign: 'center', position: 'relative',
          }}
        >
          <h2
            data-reveal="0"
            style={{
              fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,5.6vw,84px)',
              lineHeight: 0.98, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 auto 24px', maxWidth: '20ch',
            }}
          >
            Ready to turn sustainability into{' '}
            <span style={{ color: '#205E40' }}>your competitive edge?</span>
          </h2>
          <p data-reveal="140" style={{ fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6, color: '#6F6F68', margin: '0 auto 30px', maxWidth: '44ch' }}>
            No PhD required. No spreadsheet chaos. Just clarity.
          </p>
          <div data-reveal="240" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <MarketingButton size="lg" onClick={goAccess}>Start free trial</MarketingButton>
            <MarketingButton variant="outline" size="lg" onClick={goManifesto}>Read Our Manifesto</MarketingButton>
          </div>
          <p
            data-reveal="320"
            style={{
              fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
              textTransform: 'uppercase', color: '#6F6F68', margin: '22px 0 0',
            }}
          >
            Start with Seed from £99/month · No long-term contracts
          </p>
          <div style={{ marginTop: 60 }}>
            <GrowthField score={100} seed="alkatera" fixed={false} height="34vh" style={FOREST_STYLE} />
          </div>
        </section>

        <SiteFooter
          platformLinksHref="#modules"
          companyLinks={[
            { label: 'Manifesto', href: '/#manifesto' },
            { label: "Buyer's Guide", href: '/best-sustainability-platform-drinks-industry' },
            { label: 'Knowledge', href: '/knowledge' },
            { label: 'Contact', href: '/contact' },
          ]}
        />
      </main>

      <CursorCreatures />
    </div>
  );
}
