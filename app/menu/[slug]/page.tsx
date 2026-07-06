'use client';

/**
 * Public, QR-linked consumer menu. No auth — reads /api/public/menu/[slug],
 * which only serves menus the venue has marked public. Shows each item with a
 * low/medium/high carbon band and its per-serving footprint.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { carbonBand, formatFootprint, type CarbonBand } from '@/lib/hospitality/carbon-band';

interface PublicItem {
  name: string;
  item_kind: string;
  co2e: number | null;
}
interface PublicMenu {
  name: string;
  description: string | null;
  venue_name: string | null;
  items: PublicItem[];
}

const BAND_ORDER: Record<CarbonBand, number> = { low: 0, medium: 1, high: 2 };

// The studio ground and inks (design/studio-design-language.md).
const PAPER = '#ECEAE3';
const CREAM = '#F2F1EA';
const HAIRLINE = '#D9D6CB';
const DIM = '#6F6F68';
const INK = '#1A1B1D';
const FOREST = '#205E40';

// Bands are states, so they speak in working tones: typographic, no pills.
const BAND_TONE: Record<CarbonBand, string> = {
  low: '#047857',
  medium: '#B45309',
  high: '#BE123C',
};

const MONO = 'var(--font-data), "JetBrains Mono", monospace';
const DISPLAY = 'var(--font-display), "Space Grotesk", sans-serif';

export default function PublicMenuPage() {
  const { slug } = useParams<{ slug: string }>();
  const [menu, setMenu] = useState<PublicMenu | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound'>('loading');

  useEffect(() => {
    fetch(`/api/public/menu/${slug}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((b) => {
        setMenu(b.menu);
        setStatus('ok');
      })
      .catch(() => setStatus('notfound'));
  }, [slug]);

  return (
    <div style={{ minHeight: '100vh', background: PAPER, color: INK }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>
        {status === 'loading' && <p style={{ color: DIM }}>Loading…</p>}
        {status === 'notfound' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <p style={{ fontSize: 18, fontWeight: 700, fontFamily: DISPLAY }}>Menu not found.</p>
            <p style={{ color: DIM, marginTop: 8 }}>This menu may not be published.</p>
          </div>
        )}

        {status === 'ok' && menu && (
          <>
            <header style={{ marginBottom: 28 }}>
              {menu.venue_name && (
                <p
                  style={{
                    color: FOREST,
                    fontSize: 10.5,
                    letterSpacing: '0.22em',
                    textTransform: 'uppercase',
                    fontFamily: MONO,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {menu.venue_name}
                </p>
              )}
              <h1
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  margin: '8px 0 6px',
                  fontFamily: DISPLAY,
                  lineHeight: 0.95,
                  letterSpacing: '-0.035em',
                }}
              >
                {menu.name}
              </h1>
              {menu.description && <p style={{ color: DIM, margin: 0 }}>{menu.description}</p>}
              <p style={{ color: DIM, fontSize: 13, marginTop: 10 }}>
                Each dish shows its carbon footprint per serving.
              </p>
            </header>

            <div
              style={{
                display: 'flex',
                gap: 18,
                marginBottom: 16,
                fontSize: 10,
                fontFamily: MONO,
                fontWeight: 700,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
              }}
            >
              {(['low', 'medium', 'high'] as CarbonBand[]).map((b) => {
                const meta = carbonBand(b === 'low' ? 0.5 : b === 'medium' ? 2 : 5)!;
                return (
                  <span key={b} style={{ color: BAND_TONE[b] }}>
                    {meta.label}
                  </span>
                );
              })}
            </div>

            <ul
              style={{
                listStyle: 'none',
                padding: '0 16px',
                margin: 0,
                background: CREAM,
                border: `1px solid ${HAIRLINE}`,
                borderRadius: 6,
              }}
            >
              {[...menu.items]
                .sort((a, b) => {
                  const ba = carbonBand(a.co2e);
                  const bb = carbonBand(b.co2e);
                  return (ba ? BAND_ORDER[ba.band] : 9) - (bb ? BAND_ORDER[bb.band] : 9);
                })
                .map((item, i) => {
                  const meta = carbonBand(item.co2e);
                  return (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '14px 0',
                        borderTop: i === 0 ? 'none' : `1px solid ${HAIRLINE}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 600,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.name}
                        </p>
                        <p
                          style={{
                            margin: '2px 0 0',
                            fontSize: 9.5,
                            fontFamily: MONO,
                            fontWeight: 700,
                            letterSpacing: '0.2em',
                            textTransform: 'uppercase',
                            color: meta ? BAND_TONE[meta.band] : DIM,
                          }}
                        >
                          {meta?.label ?? 'Not calculated'}
                        </p>
                      </div>
                      <span
                        style={{
                          color: FOREST,
                          fontSize: 13,
                          whiteSpace: 'nowrap',
                          fontFamily: MONO,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatFootprint(item.co2e)}
                      </span>
                    </li>
                  );
                })}
            </ul>

            <footer
              style={{
                marginTop: 40,
                paddingTop: 16,
                borderTop: `1px solid ${HAIRLINE}`,
                fontSize: 12,
                color: DIM,
              }}
            >
              Carbon footprints by alka<strong style={{ color: INK }}>tera</strong>.
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
