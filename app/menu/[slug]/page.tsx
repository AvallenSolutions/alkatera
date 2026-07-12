'use client';

/**
 * Public, QR-linked consumer menu. No auth — reads /api/public/menu/[slug],
 * which only serves menus the venue has marked public. Shows each item with a
 * low/medium/high carbon band and its per-serving footprint.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { bandLegend, formatFootprint, type CarbonBand, type CarbonBandLegendEntry } from '@/lib/hospitality/carbon-band';
import { dietaryLabel, allergenLabel } from '@/lib/hospitality/dietary';

interface PublicItem {
  name: string;
  item_kind: string;
  co2e: number | null;
  band: CarbonBand | null;
  dietary_tags?: string[];
  allergens?: string[];
}
interface PublicMenu {
  name: string;
  description: string | null;
  venue_name: string | null;
  legend?: CarbonBandLegendEntry[];
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

  // Legend + band → swatch lookup come from the server payload (org-configurable
  // thresholds); fall back to the defaults if an older payload omits them.
  const legend = menu?.legend ?? bandLegend();
  const bandMeta = Object.fromEntries(legend.map((e) => [e.band, e])) as Record<CarbonBand, CarbonBandLegendEntry>;

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
              {legend.map((entry) => (
                <span key={entry.band} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 9999, background: entry.color }} />
                  {entry.label}
                </span>
              ))}
            </div>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {[...menu.items]
                .sort((a, b) => {
                  return (a.band ? BAND_ORDER[a.band] : 9) - (b.band ? BAND_ORDER[b.band] : 9);
                })
                .map((item, i) => {
                  const meta = item.band ? bandMeta[item.band] : null;
                  const tags = item.dietary_tags ?? [];
                  const allergens = item.allergens ?? [];
                  return (
                    <li
                      key={i}
                      style={{
                        padding: '14px 0',
                        borderTop: i === 0 ? 'none' : '1px solid #262626',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
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
                      </div>
                      {tags.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, marginLeft: 22 }}>
                          {tags.map((t) => (
                            <span key={t} style={{ fontSize: 11, color: '#a3e635', border: '1px solid #3f6212', borderRadius: 9999, padding: '1px 8px' }}>
                              {dietaryLabel(t)}
                            </span>
                          ))}
                        </div>
                      )}
                      {allergens.length > 0 && (
                        <p style={{ fontSize: 11, color: '#737373', marginTop: 6, marginLeft: 22 }}>
                          Allergens: {allergens.map(allergenLabel).join(', ')}
                        </p>
                      )}
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
