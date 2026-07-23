'use client';

/**
 * The marketing home: "Gallery of Rooms", ported faithfully from the
 * Claude Design source (Home.dc.html in project fc7cf965). Copy is
 * verbatim from the design; behaviours (reveals, the sticky posters,
 * the winter-to-summer Reality scene, the cursor creatures, the season
 * and Rosa easter eggs) are the design's own script re-homed as hooks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GrowthField } from '@/components/studio/growth/growth-field';
import type { Season } from '@/components/studio/growth/season';
import { MarketingButton } from './MarketingButton';
import { spaceGrotesk } from './fonts';
import { SOIL_ART_SVG } from './soil-art';

const F_STATEMENT = "var(--font-statement), 'Space Grotesk', sans-serif";
const F_BODY = "var(--font-body), 'Inter', sans-serif";
const F_MONO = "var(--font-data), 'JetBrains Mono', monospace";
const EASE = 'cubic-bezier(0.2,0.8,0.2,1)';

const FOREST_STYLE = { maskImage: 'none', WebkitMaskImage: 'none' } as const;

const SEASONS: (Season | undefined)[] = [undefined, 'spring', 'summer', 'autumn', 'winter'];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function LeafMark({ size, stroke }: { size: number; stroke: string }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      <path
        d="M24 7 C 31 19 37 24 37 29 A 13 13 0 1 1 11 29 C 11 24 17 19 24 7 Z"
        fill="none"
        stroke={stroke}
        strokeWidth="2.6"
      />
      <line x1="24" y1="14" x2="24" y2="41" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="24" y1="27" x2="31" y2="20" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="24" y1="27" x2="17" y2="20" stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Wordmark({ fontSize }: { fontSize: number }) {
  return (
    <span style={{ fontFamily: F_STATEMENT, fontSize, color: '#1A1B1D' }}>
      <span style={{ fontWeight: 500 }}>alka</span>
      <span style={{ fontWeight: 700 }}>tera</span>
    </span>
  );
}

/* The four room posters. */
const POSTERS = [
  {
    bg: '#205E40',
    text: '#F2F1EA',
    kicker: '01 / 04 · Traceability',
    kickerColor: 'rgba(242,241,234,0.7)',
    bodyColor: 'rgba(242,241,234,0.82)',
    title: 'Beyond Carbon',
    body: "Carbon is only one part of the story. From water stress to biodiversity loss, we give you a 360° view of your environmental performance. Don't just measure emissions; measure your total impact.",
    mark: (
      <>
        <circle cx="24" cy="24" r="7.5" fill="#F2F1EA" />
        <g stroke="#F2F1EA" strokeWidth="2.6" strokeLinecap="round">
          <line x1="24" y1="4" x2="24" y2="11" />
          <line x1="24" y1="37" x2="24" y2="44" />
          <line x1="4" y1="24" x2="11" y2="24" />
          <line x1="37" y1="24" x2="44" y2="24" />
          <line x1="9.8" y1="9.8" x2="14.7" y2="14.7" />
          <line x1="33.3" y1="33.3" x2="38.2" y2="38.2" />
          <line x1="9.8" y1="38.2" x2="14.7" y2="33.3" />
          <line x1="33.3" y1="14.7" x2="38.2" y2="9.8" />
        </g>
      </>
    ),
  },
  {
    bg: '#2B46C0',
    text: '#F2F1EA',
    kicker: '02 / 04 · Resource Management',
    kickerColor: 'rgba(242,241,234,0.7)',
    bodyColor: 'rgba(242,241,234,0.82)',
    title: 'Built for Beverages',
    body: 'Generic calculators fail on liquids. Our engine models the specific physics of brewing, distilling, and fermentation, giving you the most precise water and waste analytics in the industry.',
    mark: (
      <>
        <g fill="#F2F1EA">
          <rect x="7" y="30" width="7" height="12" rx="1" />
          <rect x="20.5" y="22" width="7" height="20" rx="1" />
          <rect x="34" y="16" width="7" height="26" rx="1" />
        </g>
        <path d="M37.5 4 L44 12 L31 12 Z" fill="#F2F1EA" />
      </>
    ),
  },
  {
    bg: '#DFA32B',
    text: '#1A1B1D',
    kicker: '03 / 04 · Compliance',
    kickerColor: 'rgba(26,27,29,0.65)',
    bodyColor: 'rgba(26,27,29,0.78)',
    title: 'Audit-Ready Data',
    body: 'Never fear a regulator again. Our "Glass Box" architecture ensures every claim is backed by traceable, transparent data. Turn compliance from a risk into your strongest marketing asset.',
    mark: (
      <g transform="rotate(-14 24 24)" fill="none" stroke="#1A1B1D">
        <rect x="9" y="15" width="30" height="20" rx="2" strokeWidth="2.6" />
        <path
          d="M9.8 16.5 L24 27 L38.2 16.5"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    ),
  },
  {
    bg: '#BF4B2A',
    text: '#F2F1EA',
    kicker: '04 / 04 · Strategy',
    kickerColor: 'rgba(242,241,234,0.7)',
    bodyColor: 'rgba(242,241,234,0.82)',
    title: 'Certification Accelerator',
    body: 'Stop guessing and start improving. We automate the complex data collection required for B Corp, translating your operational footprint into a clear, strategic roadmap for certification.',
    mark: (
      <>
        <path
          d="M14 20 A10 10 0 0 1 34 20 L34 40 L14 40 Z"
          fill="none"
          stroke="#F2F1EA"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <line x1="24" y1="10.5" x2="24" y2="40" stroke="#F2F1EA" strokeWidth="2.4" />
        <line x1="14" y1="28" x2="34" y2="28" stroke="#F2F1EA" strokeWidth="2.4" />
      </>
    ),
  },
];

/* The Reality's six cards; the alternating right/top offsets are the design's. */
const REALITY_CARDS = [
  {
    right: '6vw', top: '26vh',
    title: 'Carbon-only tools miss the point',
    body: 'Carbon is one metric of many. Water stress, land use, biodiversity, waste. Your retailers, certifiers, and regulators are already asking for all of it. Most platforms stop at carbon.',
  },
  {
    right: '11vw', top: '32vh',
    title: "Generic calculators don't speak drinks",
    body: 'A fermentation vessel is not a factory floor. Brewing, distilling, and winemaking have their own physics, water ratios, and waste profiles. Generic tools give you generic, and often wrong, answers.',
  },
  {
    right: '7vw', top: '24vh',
    title: 'Spreadsheets that nobody trusts',
    body: "Your sustainability data is scattered across shared drives, old emails, and someone's personal spreadsheet. Nobody knows what's current, and an auditor would pull it apart in minutes.",
  },
  {
    right: '12vw', top: '30vh',
    title: "Greenwashing risk you can't see",
    body: 'The UK Green Claims Code and EU Green Claims Directive are in force. A claim that felt fine 18 months ago could now be a legal liability. Most brands are flying blind.',
  },
  {
    right: '6vw', top: '28vh',
    title: 'Retailer data requests with no warning',
    body: "Tesco, Sainsbury's, Carrefour, they're all required to report their full supply chain emissions under CSRD. That means your environmental data becomes a condition of trade, not a nice-to-have.",
  },
  {
    right: '10vw', top: '33vh',
    title: 'Consultants who cost more than the problem',
    body: "Sustainability consultants charge thousands per day. B Corp prep alone can run to five figures. You shouldn't need an agency to know your own footprint.",
  },
];

const PIONEERS = [
  { href: 'https://avallenspirits.com', src: '/logos/avallen.svg', name: 'Avallen Calvados', y: 0 },
  { href: 'https://www.everleafdrinks.com', src: '/logos/everleaf.svg', name: 'Everleaf', y: 30 },
  { href: 'https://threespiritdrinks.com', src: '/logos/three-spirit.svg', name: 'Three Spirit', y: 10 },
  { href: 'https://www.takamakarum.com', src: '/logos/takamaka.svg', name: 'Takamaka Rum', y: 34 },
  { href: 'https://blacklinesdrinks.com', src: '/logos/black-lines.svg', name: 'Black Lines', y: 6 },
  { href: 'https://drinkfabric.com', src: '/logos/fabric.svg', name: 'FABRIC', y: 26 },
  { href: 'https://www.weareveto.com/', src: '/logos/veto.svg', name: 'Veto', y: 14 },
];

const SHELF_BACK: [string, number][] = [
  ['gin-bottle', 80], ['rum-bottle', 86], ['whisky-bottle', 76], ['champagne-bottle', 90],
  ['cider-bottle', 78], ['tequila-bottle', 88], ['white-wine-bottle', 84], ['spirits-bottle', 82],
  ['wine-bottle', 80],
];

const SHELF_FRONT: [string, number][] = [
  ['white-wine-bottle', 150], ['champagne-bottle', 168], ['beer-glass', 104], ['gin-bottle', 130],
  ['beer-bottle', 128], ['soda-can', 116], ['spirits-bottle', 150], ['tequila-bottle', 170],
  ['rum-bottle', 158], ['beer-can', 116], ['wine-bottle', 152], ['cider-bottle', 128],
  ['wine-glass', 102], ['whisky-bottle', 126],
];

const KICKER: React.CSSProperties = {
  fontFamily: F_MONO,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
};

export function HomeClient() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const beeRef = useRef<HTMLImageElement>(null);
  const butterflyRef = useRef<HTMLImageElement>(null);
  const newsInputRef = useRef<HTMLInputElement>(null);

  const [stat55, setStat55] = useState(0);
  const [rosaRun, setRosaRun] = useState(false);
  const [seasonIdx, setSeasonIdx] = useState(0);
  const [seasonToast, setSeasonToast] = useState('');
  const [newsDone, setNewsDone] = useState(false);
  const [newsError, setNewsError] = useState(false);

  const reducedRef = useRef(false);
  const statDoneRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const seasonOverride = SEASONS[seasonIdx];
  const now = new Date();
  const seasonCaption = seasonOverride
    ? seasonOverride.toUpperCase()
    : `${MONTHS[now.getMonth()].toUpperCase()} ${now.getFullYear()}`;

  /* Reveals, the poster marks, and the animated statistic. */
  useEffect(() => {
    reducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = rootRef.current;
    if (!root) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          const d = reducedRef.current
            ? 0
            : parseInt(el.getAttribute('data-reveal') || '0', 10) + 160;
          setTimeout(() => el.classList.add('mkt-revealed'), d);
          io.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -4% 0px' },
    );
    root.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

    const posterIo = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const mark = e.target.querySelector('[data-mark]') as HTMLElement | null;
          if (!mark) continue;
          if (e.intersectionRatio > 0.55 && !reducedRef.current) {
            mark.style.opacity = '0.28';
            mark.style.transform = 'rotate(6deg)';
          } else {
            mark.style.opacity = '0.2';
            mark.style.transform = 'rotate(0deg)';
          }
        }
      },
      { threshold: [0, 0.55, 1] },
    );
    root.querySelectorAll('[data-poster]').forEach((el) => posterIo.observe(el));

    const stat = root.querySelector('#stat55');
    const statIo = new IntersectionObserver(
      (es) => {
        if (es.some((x) => x.isIntersecting) && !statDoneRef.current) {
          statDoneRef.current = true;
          const start = performance.now();
          const dur = reducedRef.current ? 0 : 1400;
          const step = (t: number) => {
            const p = dur === 0 ? 1 : Math.min(1, (t - start) / dur);
            setStat55(Math.round(55 * (1 - Math.pow(1 - p, 3))));
            if (p < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          statIo.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    if (stat) statIo.observe(stat);

    return () => {
      io.disconnect();
      posterIo.disconnect();
      statIo.disconnect();
    };
  }, []);

  /* The Reality: the scroll drives winter into spring into summer. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const wrap = root.querySelector('[data-rwrap]') as HTMLElement | null;
        if (!wrap) return;
        const r = wrap.getBoundingClientRect();
        const total = r.height - window.innerHeight;
        if (total <= 0) return;
        const p = Math.min(1, Math.max(0, -r.top / total));
        const ramp = (a: number, b: number) => Math.min(1, Math.max(0, (p - a) / (b - a)));
        const smooth = (t: number) => t * t * (3 - 2 * t);
        const toSpring = smooth(ramp(0.45, 0.62));
        const toSummer = smooth(ramp(0.6, 0.82));
        const fw = wrap.querySelector('[data-rforest="winter"]') as HTMLElement | null;
        const fs = wrap.querySelector('[data-rforest="spring"]') as HTMLElement | null;
        const fu = wrap.querySelector('[data-rforest="summer"]') as HTMLElement | null;
        if (fw) fw.style.opacity = (1 - toSummer).toFixed(3);
        if (fs) fs.style.opacity = (toSpring * (1 - toSummer)).toFixed(3);
        if (fu) fu.style.opacity = toSummer.toFixed(3);
        const season = p < 0.53 ? 'winter' : p < 0.72 ? 'spring' : 'summer';
        wrap.querySelectorAll('[data-rcard]').forEach((node) => {
          const el = node as HTMLElement;
          const i = parseInt(el.getAttribute('data-rcard') || '0', 10);
          const c = 0.04 + i * 0.075;
          const d = (p - c) / 0.065;
          const vis = Math.max(0, 1 - Math.abs(d));
          const ease = vis * vis * (3 - 2 * vis);
          el.style.opacity = ease.toFixed(3);
          el.style.transform = `translateY(${reducedRef.current ? 0 : (-d * 90).toFixed(1)}px)`;
          el.style.pointerEvents = ease > 0.5 ? 'auto' : 'none';
        });
        const head = wrap.querySelector('[data-rhead]') as HTMLElement | null;
        if (head) {
          head.style.opacity = (p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.09)).toFixed(3);
        }
        const fin = wrap.querySelector('[data-rfinal]') as HTMLElement | null;
        if (fin) {
          const fOp = smooth(ramp(0.58, 0.74));
          fin.style.opacity = fOp.toFixed(3);
          fin.style.transform = `translate(-50%, ${reducedRef.current ? 0 : ((1 - fOp) * 26).toFixed(1)}px)`;
          fin.style.pointerEvents = fOp > 0.6 ? 'auto' : 'none';
        }
        wrap.querySelectorAll('[data-rseason]').forEach((node) => {
          const el = node as HTMLElement;
          const on = el.getAttribute('data-rseason') === season;
          el.style.color = on ? (season === 'summer' ? '#205E40' : '#1A1B1D') : '#A9A79D';
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  /* The residents: a bee and a butterfly keep the cursor company. */
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, seen: false };
    const bee = { x: -60, y: 120, dx: 0 };
    const fly = { x: window.innerWidth + 60, y: 200, dx: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = true;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    let t = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 0.016;
      if (!mouse.seen) return;
      const bx = mouse.x + 34 + Math.sin(t * 2.1) * 10;
      const by = mouse.y - 26 + Math.cos(t * 2.7) * 8;
      bee.dx = bx - bee.x;
      bee.x += bee.dx * 0.07;
      bee.y += (by - bee.y) * 0.07;
      const fx = mouse.x - 60 + Math.sin(t * 1.3) * 26;
      const fy = mouse.y + 30 + Math.sin(t * 1.7) * 18;
      fly.dx = fx - fly.x;
      fly.x += fly.dx * 0.035;
      fly.y += (fy - fly.y) * 0.035;
      const be = beeRef.current;
      const fe = butterflyRef.current;
      if (be) {
        be.style.opacity = '0.9';
        be.style.transform = `translate(${bee.x - 15}px, ${bee.y - 15}px) scaleX(${bee.dx < 0 ? -1 : 1}) rotate(${Math.sin(t * 3) * 8}deg)`;
      }
      if (fe) {
        fe.style.opacity = '0.85';
        fe.style.transform = `translate(${fly.x - 13}px, ${fly.y - 13}px) scaleX(${fly.dx < 0 ? -1 : 1}) rotate(${Math.sin(t * 2.2) * 12}deg)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Type r-o-s-a anywhere and she runs across the page. */
  useEffect(() => {
    let buf = '';
    let running = false;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      buf = (buf + (e.key || '')).slice(-8).toLowerCase();
      if (buf.endsWith('rosa') && !running) {
        running = true;
        setRosaRun(true);
        setTimeout(() => {
          running = false;
          setRosaRun(false);
        }, 7200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const goTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 60;
    window.scrollTo({ top, behavior: reducedRef.current ? 'auto' : 'smooth' });
  }, []);

  const goTop = useCallback((e?: { preventDefault: () => void }) => {
    if (e) e.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedRef.current ? 'auto' : 'smooth' });
  }, []);

  const goPricing = useCallback(() => router.push('/pricing'), [router]);
  const goTrial = useCallback(() => router.push('/pricing#trial'), [router]);
  const goPlatform = useCallback(() => goTo('platform'), [goTo]);

  const cycleSeason = useCallback(
    (e?: { preventDefault: () => void; stopPropagation: () => void }) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      setSeasonIdx((idx) => {
        const next = (idx + 1) % SEASONS.length;
        setSeasonToast(
          SEASONS[next] ? `${SEASONS[next]} · time travelling` : 'back to today’s calendar',
        );
        return next;
      });
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setSeasonToast(''), 2400);
    },
    [],
  );

  const submitNews = useCallback(() => {
    const v = newsInputRef.current?.value ?? '';
    if (/.+@.+\..+/.test(v)) {
      setNewsDone(true);
      setNewsError(false);
    } else {
      setNewsError(true);
    }
  }, []);

  const monoLabel = useMemo(
    () => ({
      fontFamily: F_MONO,
      fontWeight: 700,
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase' as const,
    }),
    [],
  );

  return (
    <div ref={rootRef} className={`mkt-home ${spaceGrotesk.variable}`}>
      {/* ————— Nav ————— */}
      <nav
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80,
          background: 'rgba(236,234,227,0.94)', borderBottom: '1px solid #D9D6CB',
          height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', boxSizing: 'border-box',
        }}
      >
        <a
          href="#top"
          onClick={goTop}
          style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', cursor: 'pointer' }}
        >
          <span onClick={cycleSeason} title="·" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <LeafMark size={22} stroke="#205E40" />
          </span>
          <Wordmark fontSize={18} />
        </a>
        <div
          className="mkt-nav-links"
          style={{ display: 'flex', alignItems: 'center', gap: 26, ...monoLabel }}
        >
          <a className="mkt-navlink" href="/platform">Platform</a>
          <a className="mkt-navlink" href="/pricing">Pricing</a>
          <a className="mkt-navlink" href="/knowledge">Knowledge</a>
          <a className="mkt-navlink" href="/login">Login</a>
        </div>
        <MarketingButton size="sm" onClick={goTrial}>Start free trial</MarketingButton>
      </nav>

      <main id="top">
        {/* ————— Hero ————— */}
        <section
          style={{
            minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingTop: 60,
            boxSizing: 'border-box', position: 'relative', background: '#ECEAE3',
          }}
        >
          <div className="mkt-pad" style={{ padding: '3.5vh 40px 0', textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <h1
              data-reveal="0"
              style={{
                fontFamily: F_STATEMENT, fontSize: 'clamp(68px,11.5vw,176px)', lineHeight: 0.88,
                letterSpacing: '-0.045em', color: '#1A1B1D', margin: 0,
              }}
            >
              <span style={{ fontWeight: 500 }}>alka</span>
              <span style={{ fontWeight: 700 }}>tera</span>
            </h1>
            <p
              data-reveal="200"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(20px,2.4vw,30px)',
                letterSpacing: '-0.03em', color: '#205E40', margin: '18px 0 0',
              }}
            >
              Sustainability, Distilled.
            </p>
            <p
              data-reveal="320"
              style={{
                fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.55, color: '#6F6F68',
                maxWidth: '62ch', margin: '14px auto 0',
              }}
            >
              The sustainability operating system built for the drinks industry, measuring
              environmental, social and governance impact, then turning it into audit-ready
              reports, retailer-ready claims, and the strategy that grows your brand.
            </p>
            <div
              data-reveal="440"
              style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', margin: '22px 0 0' }}
            >
              <MarketingButton size="lg" onClick={goPricing}>Start free trial</MarketingButton>
              <MarketingButton variant="outline" size="lg" onClick={goPlatform}>See the Platform</MarketingButton>
            </div>
            <a
              data-reveal="540"
              className="mkt-scanlink"
              href="#trial"
              style={{
                display: 'inline-block', marginTop: 14, ...monoLabel, color: '#6F6F68',
                textDecoration: 'none', borderBottom: '1px solid #D9D6CB', paddingBottom: 3,
              }}
            >
              Free · Scan for greenwashing risk
            </a>
          </div>
          <div style={{ marginTop: 'auto', position: 'relative' }}>
            <GrowthField
              score={100}
              seed="alkatera"
              season={seasonOverride}
              fixed={false}
              height="48vh"
              style={FOREST_STYLE}
            />
            <p
              suppressHydrationWarning
              style={{
                position: 'absolute', right: 28, bottom: 12, fontFamily: F_MONO, fontWeight: 700,
                fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6F6F68',
                margin: 0, zIndex: 2,
              }}
            >
              {seasonCaption} · Rosa lives here
            </p>
          </div>
        </section>

        {/* ————— The Soil (manifesto) ————— */}
        <section
          id="manifesto"
          style={{ background: '#4A4238', color: '#F2F1EA', position: 'relative', overflow: 'hidden' }}
        >
          <div
            aria-hidden
            style={{ position: 'absolute', inset: 0 }}
            dangerouslySetInnerHTML={{ __html: SOIL_ART_SVG }}
          />
          <div
            className="mkt-soil-grid mkt-pad"
            style={{
              maxWidth: 1184, margin: '0 auto', position: 'relative', zIndex: 2,
              padding: '110px 48px 130px', boxSizing: 'border-box', display: 'grid',
              gridTemplateColumns: 'minmax(300px,1.15fr) minmax(260px,0.85fr)', gap: 56, alignItems: 'end',
            }}
          >
            <div>
              <p data-reveal="0" style={{ ...KICKER, color: '#C2AF87', margin: '0 0 26px' }}>
                Flavour starts in the soil
              </p>
              <h2
                data-reveal="120"
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(38px,4.6vw,64px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', margin: '0 0 30px', maxWidth: '16ch',
                }}
              >
                The drinks industry is defined by its relationship with nature.
              </h2>
              <p
                data-reveal="240"
                style={{
                  fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6,
                  color: 'rgba(242,241,234,0.82)', maxWidth: '52ch', margin: '0 0 26px',
                }}
              >
                For too long, sustainability has been a burden of spreadsheets and guesswork.
                We believe that when impact is quantified with scientific precision, it becomes
                a blueprint for excellence. Sustainability, simplified.
              </p>
            </div>
            <div id="stat55" data-reveal="300">
              <div
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(80px,9vw,150px)',
                  lineHeight: 0.9, letterSpacing: '-0.035em', color: '#F2F1EA',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {stat55}%
              </div>
              <p
                style={{
                  fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5,
                  color: 'rgba(242,241,234,0.75)', maxWidth: '36ch', margin: '14px 0 0',
                }}
              >
                of all growth in consumer goods is driven by sustainable products. For drinks
                brands, &quot;green&quot; SKUs are now the primary engine for expanding market share.
              </p>
              <p
                style={{
                  fontFamily: F_MONO, fontSize: 9.5, letterSpacing: '0.12em',
                  color: '#C2AF87', margin: '12px 0 0',
                }}
              >
                NYU STERN CENTER FOR SUSTAINABLE BUSINESS · 2023
              </p>
            </div>
          </div>
        </section>

        {/* ————— The room posters ————— */}
        <section id="platform" style={{ position: 'relative' }}>
          {POSTERS.map((poster, i) => (
            <div
              key={poster.title}
              data-poster={i}
              className="mkt-pad"
              style={{
                position: 'sticky', top: 0, height: '100vh', background: poster.bg,
                color: poster.text, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                justifyContent: 'center', padding: '0 48px', boxSizing: 'border-box',
              }}
            >
              <svg
                data-mark={i}
                viewBox="0 0 48 48"
                aria-hidden="true"
                style={{
                  position: 'absolute', right: -110, bottom: -110, width: 440, height: 440,
                  opacity: 0.2, transition: `opacity 0.5s ${EASE}, transform 0.5s ${EASE}`,
                }}
              >
                {poster.mark}
              </svg>
              <div style={{ maxWidth: 1184, margin: '0 auto', width: '100%' }}>
                <p style={{ ...KICKER, color: poster.kickerColor, margin: '0 0 26px' }}>{poster.kicker}</p>
                <h3
                  style={{
                    fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(56px,8.5vw,120px)',
                    lineHeight: 0.95, letterSpacing: '-0.035em', margin: '0 0 30px',
                  }}
                >
                  {poster.title}
                </h3>
                <p
                  style={{
                    fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6,
                    color: poster.bodyColor, maxWidth: '52ch', margin: 0,
                  }}
                >
                  {poster.body}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* ————— The Reality: winter thaws as the objections land ————— */}
        <section
          data-rwrap=""
          style={{
            position: 'relative', zIndex: 2, height: '480vh', background: '#ECEAE3',
            borderTop: '1px solid #D9D6CB',
          }}
        >
          <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: '#ECEAE3', boxSizing: 'border-box' }}>
            <div data-rhead="" style={{ position: 'absolute', left: 48, top: '14vh', zIndex: 3, maxWidth: 520, willChange: 'opacity' }}>
              <p style={{ ...KICKER, color: '#BF4B2A', margin: '0 0 20px' }}>The Reality</p>
              <h2
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(40px,4.8vw,68px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 18px',
                }}
              >
                Sound familiar?
              </h2>
              <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6F6F68', margin: 0 }}>
                Six reasons winter drags on · Scroll ↓
              </p>
            </div>

            {REALITY_CARDS.map((card, i) => (
              <div
                key={card.title}
                data-rcard={i}
                style={{
                  position: 'absolute', right: card.right, top: card.top, zIndex: 3,
                  width: 'min(440px,84vw)', background: '#F2F1EA', border: '1px solid #D9D6CB',
                  borderRadius: 6, padding: '28px 28px 32px', opacity: 0, pointerEvents: 'none',
                  willChange: 'transform,opacity',
                }}
              >
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 10, letterSpacing: '0.2em', color: '#6F6F68', margin: '0 0 14px' }}>
                  {String(i + 1).padStart(2, '0')} / 06
                </p>
                <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em', color: '#1A1B1D', margin: '0 0 10px' }}>
                  {card.title}
                </h3>
                <p style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.55, color: '#6F6F68', margin: 0 }}>
                  {card.body}
                </p>
              </div>
            ))}

            <div
              data-rfinal=""
              style={{
                position: 'absolute', left: '50%', top: '16vh', transform: 'translate(-50%,26px)',
                zIndex: 3, width: 'min(820px,88vw)', textAlign: 'center', opacity: 0,
                pointerEvents: 'none', willChange: 'transform,opacity',
              }}
            >
              <p style={{ ...KICKER, color: '#205E40', margin: '0 0 22px' }}>With alkatera · In full leaf</p>
              <p
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(30px,3.6vw,52px)',
                  lineHeight: 1.05, letterSpacing: '-0.03em', color: '#1A1B1D',
                  maxWidth: '26ch', margin: '0 auto 28px',
                }}
              >
                alkatera goes far beyond carbon to give you{' '}
                <span style={{ color: '#205E40' }}>the full picture.</span>
              </p>
              <MarketingButton size="lg" onClick={goPricing}>Start free trial</MarketingButton>
            </div>

            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 1 }}>
              <div data-rforest="winter" style={{ opacity: 1, willChange: 'opacity' }}>
                <GrowthField score={100} seed="alkatera" season="winter" fixed={false} height="44vh" style={FOREST_STYLE} />
              </div>
              <div data-rforest="spring" style={{ position: 'absolute', inset: 0, opacity: 0, willChange: 'opacity' }}>
                <GrowthField score={100} seed="alkatera" season="spring" fixed={false} height="44vh" style={FOREST_STYLE} />
              </div>
              <div data-rforest="summer" style={{ position: 'absolute', inset: 0, opacity: 0, willChange: 'opacity' }}>
                <GrowthField score={100} seed="alkatera" season="summer" fixed={false} height="44vh" style={FOREST_STYLE} />
              </div>
            </div>

            <div
              style={{
                position: 'absolute', left: 24, bottom: 16, zIndex: 3, display: 'flex', gap: 18,
                fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.2em',
                textTransform: 'uppercase',
              }}
            >
              <span data-rseason="winter" style={{ color: '#1A1B1D' }}>01 · A long winter</span>
              <span data-rseason="spring" style={{ color: '#A9A79D' }}>02 · The thaw</span>
              <span data-rseason="summer" style={{ color: '#A9A79D' }}>03 · In full leaf</span>
            </div>
          </div>
        </section>

        {/* ————— The Process ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#ECEAE3', position: 'relative', zIndex: 2, borderTop: '1px solid #D9D6CB',
            borderBottom: '1px solid #D9D6CB', padding: '110px 48px', boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: 1184, margin: '0 auto' }}>
            <p data-reveal="0" style={{ ...KICKER, color: '#6F6F68', margin: '0 0 22px' }}>The Process</p>
            <h2
              data-reveal="100"
              style={{
                fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,4.4vw,62px)',
                lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 56px',
              }}
            >
              <span style={{ color: '#205E40' }}>Analyse.</span>{' '}
              <span style={{ color: '#2B46C0' }}>Calculate.</span>{' '}
              <span style={{ color: '#BF4B2A' }}>Strategise.</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 20 }}>
              {[
                {
                  accent: '#205E40', num: '01', title: 'Analyse', delay: '0',
                  body: "We dissect your liquid's journey. Our platform analyses raw ingredients, fermentation data, and packaging specs against global environmental standards to reveal the true composition of your bottle's footprint.",
                },
                {
                  accent: '#2B46C0', num: '02', title: 'Calculate', delay: '120',
                  body: 'Out come the figures that matter: carbon, water, land and waste, each benchmarked and defensible in front of any auditor.',
                },
                {
                  accent: '#BF4B2A', num: '03', title: 'Strategise', delay: '240',
                  body: 'The numbers become a plan. See which changes move your footprint most, then turn them into retailer-ready claims and a roadmap for certification.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  data-reveal={step.delay}
                  style={{
                    background: '#F2F1EA', border: '1px solid #D9D6CB',
                    borderTop: `3px solid ${step.accent}`, borderRadius: 6, padding: '34px 30px 42px',
                  }}
                >
                  <p
                    style={{
                      fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(72px,7vw,104px)',
                      lineHeight: 0.9, letterSpacing: '-0.035em', color: step.accent,
                      margin: '0 0 20px', fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {step.num}
                  </p>
                  <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 26, letterSpacing: '-0.03em', color: '#1A1B1D', margin: '0 0 12px' }}>
                    {step.title}
                  </h3>
                  <p style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: '#6F6F68', margin: 0 }}>
                    {step.body}
                  </p>
                </div>
              ))}
            </div>
            <p
              data-reveal="300"
              style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#6F6F68', margin: '28px 0 0' }}
            >
              Liquid in · Ledger out
            </p>
          </div>
        </section>

        {/* ————— Pioneers ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#1A1B1D', color: '#F2F1EA', position: 'relative', zIndex: 2,
            overflow: 'hidden', padding: '120px 48px 130px', boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'absolute', right: -90, top: -90, width: 380, height: 380, opacity: 0.12 }}>
            <LeafMark size={380} stroke="#F2F1EA" />
          </div>
          <div style={{ maxWidth: 1184, margin: '0 auto', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
              <div>
                <p data-reveal="0" style={{ ...KICKER, color: 'rgba(242,241,234,0.6)', margin: '0 0 18px' }}>
                  Trusted by industry pioneers
                </p>
                <h2
                  data-reveal="80"
                  style={{
                    fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(36px,4.4vw,62px)',
                    lineHeight: 0.95, letterSpacing: '-0.035em', color: '#F2F1EA', margin: 0,
                  }}
                >
                  In good company.
                </h2>
              </div>
              <p
                data-reveal="160"
                style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: 'rgba(242,241,234,0.7)', maxWidth: '38ch', margin: 0 }}
              >
                The brands proving that impact and growth pour from the same bottle.
              </p>
            </div>
            <div
              data-reveal="200"
              style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', columnGap: '6.5vw',
                rowGap: 72, marginTop: 88,
              }}
            >
              {PIONEERS.map((brand) => (
                <a
                  key={brand.name}
                  className="mkt-logo"
                  href={brand.href}
                  target="_blank"
                  rel="noreferrer"
                  title={brand.name}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 16, textDecoration: 'none',
                    transform: brand.y ? `translateY(${brand.y}px)` : undefined,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brand.src}
                    alt={brand.name}
                    style={{
                      height: 'clamp(44px,4.6vw,62px)', width: 'auto', maxWidth: 250,
                      objectFit: 'contain', objectPosition: 'left center',
                      filter: 'brightness(0) invert(0.96)',
                    }}
                  />
                  <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 8.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(242,241,234,0.45)' }}>
                    {brand.name}
                  </span>
                </a>
              ))}
            </div>
            <div
              data-reveal="300"
              style={{
                display: 'flex', alignItems: 'baseline', gap: 22, flexWrap: 'wrap', marginTop: 88,
                borderTop: '1px solid rgba(242,241,234,0.16)', paddingTop: 26,
              }}
            >
              <span style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em', color: '#F2F1EA' }}>
                Your brand here.
              </span>
              <span
                className="mkt-pioneer-cta"
                onClick={goTrial}
                style={{
                  fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
                  textTransform: 'uppercase', color: '#F2F1EA',
                  borderBottom: '1px solid rgba(242,241,234,0.4)', paddingBottom: 3, cursor: 'pointer',
                }}
              >
                Start free trial
              </span>
            </div>
          </div>
        </section>

        {/* ————— Final CTA + the shelf + the newsletter ————— */}
        <section
          id="pricing"
          className="mkt-pad"
          style={{
            background: '#ECEAE3', position: 'relative', zIndex: 2, padding: '110px 48px 40px',
            boxSizing: 'border-box', textAlign: 'center', overflow: 'hidden',
          }}
        >
          <p data-reveal="0" style={{ ...KICKER, color: '#A97C14', margin: '0 0 22px' }}>
            Founding partner pricing · Limited availability
          </p>
          <h2
            data-reveal="0"
            style={{
              fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(48px,7vw,104px)',
              lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 24px',
            }}
          >
            Beyond carbon.
            <br />
            <span style={{ color: '#205E40' }}>Built for drinks.</span>
          </h2>
          <p
            data-reveal="140"
            style={{ fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6, color: '#6F6F68', maxWidth: '52ch', margin: '0 auto 30px' }}
          >
            The only sustainability platform purpose-built for breweries, distilleries, and
            wineries. Three plans, Seed, Blossom and Canopy, from £99 a month. No long-term
            contract. No PhD required.
          </p>
          <div data-reveal="240" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <MarketingButton size="lg" onClick={goPricing}>See plans &amp; pricing</MarketingButton>
            <MarketingButton variant="outline" size="lg" onClick={goTrial}>Start free trial</MarketingButton>
          </div>
          <p
            id="trial"
            data-reveal="300"
            style={{
              fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.16em',
              textTransform: 'uppercase', color: '#6F6F68', margin: '14px 0 0',
            }}
          >
            30 days · No card · No auto-charge
          </p>

          {/* The shelf: every kind of drink, back row and front. */}
          <div aria-hidden style={{ margin: '48px auto 0', width: '100%', maxWidth: 1320, position: 'relative', height: 300, pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', left: '5%', right: '5%', bottom: 188, height: 1, background: '#D9D6CB' }} />
            <div style={{ position: 'absolute', left: '5%', right: '5%', bottom: 188, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', gap: 6, opacity: 0.38 }}>
              {SHELF_BACK.map(([name, h], i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${name}-${i}`} src={`/assets/drinks/${name}.svg`} alt="" style={{ height: h }} />
              ))}
            </div>
            <div style={{ position: 'absolute', left: '2%', right: '2%', bottom: 60, height: 1, background: '#D9D6CB' }} />
            <div style={{ position: 'absolute', left: '2%', right: '2%', bottom: 60, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8, opacity: 0.94 }}>
              {SHELF_FRONT.map(([name, h], i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${name}-${i}`} src={`/assets/drinks/${name}.svg`} alt="" style={{ height: h }} />
              ))}
            </div>
          </div>

          <div
            data-reveal="340"
            style={{ margin: '8px auto 0', maxWidth: 520, borderTop: '1px solid #D9D6CB', paddingTop: 26, textAlign: 'left' }}
          >
            <p style={{ ...KICKER, color: '#6F6F68', margin: '0 0 14px' }}>
              The newsletter · Sustainability, monthly
            </p>
            {!newsDone && (
              <>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <input
                    ref={newsInputRef}
                    type="email"
                    placeholder="you@yourbrand.com"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNews();
                    }}
                    style={{
                      fontFamily: F_BODY, fontSize: 14, color: '#1A1B1D', background: '#F2F1EA',
                      border: '1px solid #D9D6CB', borderRadius: 999, padding: '11px 18px',
                      flex: 1, minWidth: 220, boxSizing: 'border-box',
                    }}
                  />
                  <MarketingButton variant="outline" onClick={submitNews}>Subscribe</MarketingButton>
                </div>
                {newsError && (
                  <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#BE123C', margin: '8px 0 0' }}>
                    That address does not look right.
                  </p>
                )}
              </>
            )}
            {newsDone && (
              <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em', color: '#047857', margin: 0 }}>
                You&apos;re on the list. One considered email a month, nothing more.
              </p>
            )}
          </div>
        </section>

        {/* ————— Footer ————— */}
        <footer
          id="knowledge"
          className="mkt-pad"
          style={{
            background: '#F2F1EA', position: 'relative', zIndex: 2, borderTop: '1px solid #D9D6CB',
            padding: '64px 48px 40px', boxSizing: 'border-box',
          }}
        >
          <div style={{ maxWidth: 1184, margin: '0 auto' }}>
            <div className="mkt-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr', gap: 40 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <LeafMark size={20} stroke="#205E40" />
                  <Wordmark fontSize={17} />
                </div>
                <p style={{ fontFamily: F_BODY, fontSize: 13, lineHeight: 1.55, color: '#6F6F68', maxWidth: '34ch', margin: '0 0 18px' }}>
                  alka<strong>tera</strong> is a proud member of the Porto Protocol, committed to
                  a more sustainable drinks industry.
                </p>
                <p style={{ fontFamily: F_MONO, fontSize: 10, letterSpacing: '0.08em', color: '#6F6F68', margin: 0 }}>
                  © 2026 alkatera Ltd
                </p>
              </div>
              <div>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A1B1D', margin: '0 0 14px' }}>
                  Platform
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F_BODY, fontSize: 13 }}>
                  <a className="mkt-flink" href="/platform">Carbon Analytics</a>
                  <a className="mkt-flink" href="/platform">Water Footprint</a>
                  <a className="mkt-flink" href="/platform">Supply Chain</a>
                  <a className="mkt-flink" href="/platform">Reporting</a>
                </div>
              </div>
              <div>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A1B1D', margin: '0 0 14px' }}>
                  Company
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F_BODY, fontSize: 13 }}>
                  <a className="mkt-flink" href="#manifesto">The Soil</a>
                  <a className="mkt-flink" href="/best-sustainability-platform-drinks-industry">Buyer&apos;s Guide</a>
                  <a className="mkt-flink" href="/knowledge">Knowledge</a>
                  <a className="mkt-flink" href="/contact">Contact</a>
                </div>
              </div>
              <div>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#1A1B1D', margin: '0 0 14px' }}>
                  Get Started
                </p>
                <MarketingButton size="sm" onClick={goPricing}>Start free trial</MarketingButton>
              </div>
            </div>
            <div
              style={{
                borderTop: '1px solid #D9D6CB', marginTop: 44, paddingTop: 20, display: 'flex',
                flexWrap: 'wrap', gap: '8px 28px', justifyContent: 'space-between',
                fontFamily: F_MONO, fontSize: 9.5, letterSpacing: '0.06em', color: '#6F6F68',
              }}
            >
              <span>
                AVALLEN SOLUTIONS LTD T/A ALKATERA · COMPANY NO. 15905045 · STERLING HOUSE,
                FULBOURNE ROAD, LONDON, E17 4EE
              </span>
              <span style={{ display: 'flex', gap: 18 }}>
                <a className="mkt-flink" href="/terms">TERMS</a>
                <a className="mkt-flink" href="/privacy">PRIVACY</a>
                <a className="mkt-flink" href="/cookies">COOKIES</a>
              </span>
            </div>
          </div>
        </footer>
      </main>

      {/* The cursor's company. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={beeRef}
        src="/assets/creatures/creature-bee0.svg"
        alt=""
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, width: 30, zIndex: 85, pointerEvents: 'none', opacity: 0, willChange: 'transform' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={butterflyRef}
        src="/assets/creatures/creature-butterfly0.svg"
        alt=""
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, width: 26, zIndex: 85, pointerEvents: 'none', opacity: 0, willChange: 'transform' }}
      />

      {/* Type r-o-s-a: she runs the width of the page. */}
      {rosaRun && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-anim=""
          src="/assets/creatures/creature-rosa.svg"
          alt="Rosa the goldendoodle"
          style={{ position: 'fixed', bottom: 8, left: 0, width: 130, zIndex: 86, pointerEvents: 'none', animation: 'mkt-rosa-run 7s linear' }}
        />
      )}

      {/* The season toast (click the leaf). */}
      {seasonToast && (
        <div
          style={{
            position: 'fixed', bottom: 64, left: '50%', transform: 'translateX(-50%)', zIndex: 95,
            background: '#1A1B1D', color: '#F2F1EA', borderRadius: 999, padding: '8px 18px',
            fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}
        >
          {seasonToast}
        </div>
      )}
    </div>
  );
}
