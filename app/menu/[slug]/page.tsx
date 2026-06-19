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
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fafafa' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '32px 20px 64px' }}>
        {status === 'loading' && <p style={{ color: '#a3a3a3' }}>Loading…</p>}
        {status === 'notfound' && (
          <div style={{ textAlign: 'center', paddingTop: 80 }}>
            <p style={{ fontSize: 18, fontWeight: 600 }}>Menu not found</p>
            <p style={{ color: '#a3a3a3', marginTop: 8 }}>This menu may not be published.</p>
          </div>
        )}

        {status === 'ok' && menu && (
          <>
            <header style={{ marginBottom: 28 }}>
              {menu.venue_name && (
                <p style={{ color: '#ccff00', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {menu.venue_name}
                </p>
              )}
              <h1 style={{ fontSize: 30, fontWeight: 700, margin: '6px 0' }}>{menu.name}</h1>
              {menu.description && <p style={{ color: '#a3a3a3' }}>{menu.description}</p>}
              <p style={{ color: '#a3a3a3', fontSize: 13, marginTop: 10 }}>
                Each dish shows its carbon footprint per serving.
              </p>
            </header>

            <div style={{ display: 'flex', gap: 16, marginBottom: 20, fontSize: 12, color: '#a3a3a3' }}>
              {(['low', 'medium', 'high'] as CarbonBand[]).map((b) => {
                const meta = carbonBand(b === 'low' ? 0.5 : b === 'medium' ? 2 : 5)!;
                return (
                  <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 9999, background: meta.color }} />
                    {meta.label}
                  </span>
                );
              })}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
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
                        borderTop: i === 0 ? 'none' : '1px solid #262626',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span
                          title={meta?.label ?? 'Not calculated'}
                          style={{ width: 12, height: 12, borderRadius: 9999, background: meta?.color ?? '#404040', flexShrink: 0 }}
                        />
                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{ color: '#d4d4d4', fontSize: 14, whiteSpace: 'nowrap' }}>
                        {formatFootprint(item.co2e)}
                      </span>
                    </li>
                  );
                })}
            </ul>

            <footer style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #262626', fontSize: 12, color: '#737373' }}>
              Carbon footprints by alka<strong style={{ color: '#a3a3a3' }}>tera</strong>.
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
