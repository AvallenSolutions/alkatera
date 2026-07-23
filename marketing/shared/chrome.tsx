'use client';

/**
 * The marketing site's shared chrome: the leaf mark, the wordmark, the
 * fixed nav and the footer. All styling is the Claude Design source's,
 * inlined; per-page differences arrive as props (the home page's logo
 * hides the season easter egg, the Platform footer's module links point
 * at #modules, and so on).
 */

import type { MouseEventHandler } from 'react';
import { useRouter } from 'next/navigation';
import { MarketingButton } from './MarketingButton';

export const F_STATEMENT = "var(--font-statement), 'Space Grotesk', sans-serif";
export const F_BODY = "var(--font-body), 'Inter', sans-serif";
export const F_MONO = "var(--font-data), 'JetBrains Mono', monospace";
export const EASE = 'cubic-bezier(0.2,0.8,0.2,1)';

export const KICKER: React.CSSProperties = {
  fontFamily: F_MONO,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
};

export const MONO_LABEL: React.CSSProperties = {
  fontFamily: F_MONO,
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
};

export function LeafMark({ size, stroke }: { size: number; stroke: string }) {
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

export function Wordmark({ fontSize }: { fontSize: number }) {
  return (
    <span style={{ fontFamily: F_STATEMENT, fontSize, color: '#1A1B1D' }}>
      <span style={{ fontWeight: 500 }}>alka</span>
      <span style={{ fontWeight: 700 }}>tera</span>
    </span>
  );
}

const NAV_PAGES = [
  { key: 'platform', label: 'Platform', href: '/platform' },
  { key: 'pricing', label: 'Pricing', href: '/pricing' },
  { key: 'knowledge', label: 'Knowledge', href: '/knowledge' },
  { key: 'login', label: 'Login', href: '/login' },
] as const;

export type NavPageKey = (typeof NAV_PAGES)[number]['key'];

export function SiteNav({
  active,
  logoHref = '/',
  onLogoClick,
  onLeafClick,
  trialHref = '/pricing',
}: {
  /** Which centre link renders in its lit, underlined state. */
  active?: NavPageKey;
  logoHref?: string;
  onLogoClick?: MouseEventHandler<HTMLAnchorElement>;
  /** The home page hangs the season easter egg off the leaf. */
  onLeafClick?: MouseEventHandler<HTMLSpanElement>;
  trialHref?: string;
}) {
  const router = useRouter();
  return (
    <nav
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 80,
        background: 'rgba(236,234,227,0.94)', borderBottom: '1px solid #D9D6CB',
        height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 28px', boxSizing: 'border-box',
      }}
    >
      <a
        href={logoHref}
        onClick={onLogoClick}
        style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', cursor: 'pointer' }}
      >
        <span
          onClick={onLeafClick}
          title={onLeafClick ? '·' : undefined}
          style={{ display: 'inline-flex', cursor: 'pointer' }}
        >
          <LeafMark size={22} stroke="#205E40" />
        </span>
        <Wordmark fontSize={18} />
      </a>
      <div className="mkt-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 26, ...MONO_LABEL }}>
        {NAV_PAGES.map((page) =>
          page.key === active ? (
            <span
              key={page.key}
              style={{ color: '#205E40', borderBottom: '1px solid #205E40', paddingBottom: 2 }}
            >
              {page.label}
            </span>
          ) : (
            <a key={page.key} className="mkt-navlink" href={page.href}>
              {page.label}
            </a>
          ),
        )}
      </div>
      <MarketingButton size="sm" onClick={() => router.push(trialHref)}>
        Start free trial
      </MarketingButton>
    </nav>
  );
}

export interface FooterLink {
  label: string;
  href: string;
}

export function SiteFooter({
  platformLinksHref = '/platform',
  companyLinks = [
    { label: 'The Soil', href: '/#manifesto' },
    { label: "Buyer's Guide", href: '/best-sustainability-platform-drinks-industry' },
    { label: 'Knowledge', href: '/knowledge' },
    { label: 'Contact', href: '/contact' },
  ],
  id,
}: {
  /** Where the Platform column's four links point (the Platform page uses #modules). */
  platformLinksHref?: string;
  companyLinks?: FooterLink[];
  id?: string;
}) {
  const router = useRouter();
  const colHead: React.CSSProperties = {
    fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em',
    textTransform: 'uppercase', color: '#1A1B1D', margin: '0 0 14px',
  };
  return (
    <footer
      id={id}
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
            <p style={colHead}>Platform</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F_BODY, fontSize: 13 }}>
              <a className="mkt-flink" href={platformLinksHref}>Carbon Analytics</a>
              <a className="mkt-flink" href={platformLinksHref}>Water Footprint</a>
              <a className="mkt-flink" href={platformLinksHref}>Supply Chain</a>
              <a className="mkt-flink" href={platformLinksHref}>Reporting</a>
            </div>
          </div>
          <div>
            <p style={colHead}>Company</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: F_BODY, fontSize: 13 }}>
              {companyLinks.map((link) => (
                <a key={link.label} className="mkt-flink" href={link.href}>
                  {link.label}
                </a>
              ))}
            </div>
          </div>
          <div>
            <p style={colHead}>Get Started</p>
            <MarketingButton size="sm" onClick={() => router.push('/pricing')}>
              Start free trial
            </MarketingButton>
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
  );
}
