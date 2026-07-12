'use client';

/**
 * The forest key: the quiet pill that explains the forest.
 *
 * "YOUR FOREST · 42" sits at the field's corner; opening it shows the six
 * growth bands as fact rows in plain words, each with where to go to grow
 * it, plus a download of the forest itself (the org's living signature).
 * This is the whole incentive loop made legible: you can always see why
 * something grew, and what would grow next.
 */

import { useEffect, useState } from 'react';
import { GROWTH_WEIGHTS, type GrowthBandKey } from '@/lib/desk/growth-score';
import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';

interface ForestKeyProps {
  score: number;
  bands: Record<GrowthBandKey, number> | null;
  organizationId: string;
}

/** Each band in plain words: what it is, and where to grow it. */
const BAND_ROWS: Record<GrowthBandKey, { title: string; hint: string; href: string }> = {
  foundations: {
    title: 'The foundations',
    hint: 'Facilities, your team, and connected systems',
    href: '/company/facilities/',
  },
  production: {
    title: 'The making',
    hint: 'Products on the shelf, each with a completed LCA',
    href: '/cellar/',
  },
  measurement: {
    title: 'The measuring',
    hint: 'Utility bills and activity data flowing in',
    href: '/data/scope-1-2/',
  },
  network: {
    title: 'The chain',
    hint: 'Suppliers found, heard from, and attested',
    href: '/network/',
  },
  evidence: {
    title: 'The proof',
    hint: 'Certifications, live targets, and reports',
    href: '/evidence/',
  },
  stewardship: {
    title: 'The stewardship',
    hint: 'People, community and governance, scored',
    href: '/community-impact/',
  },
};

function forestRead(score: number): string {
  if (score < 20) return 'First growth. Every number you add is a seed.';
  if (score < 45) return 'The meadow is in flower.';
  if (score < 70) return 'A young woodland is taking shape.';
  if (score < 95) return 'The forest is closing in.';
  return 'A full forest. Look after it.';
}

export function ForestKey({ score, bands, organizationId }: ForestKeyProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const rows: FactRowItem[] = bands
    ? (Object.keys(BAND_ROWS) as GrowthBandKey[]).map((key) => ({
        id: key,
        title: BAND_ROWS[key].title,
        hint: BAND_ROWS[key].hint,
        value: String(Math.round(bands[key])),
        unit: `OF ${GROWTH_WEIGHTS[key]}`,
        href: BAND_ROWS[key].href,
      }))
    : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-16 right-4 z-30 rounded-full border border-studio-hairline bg-studio-cream/90 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-studio-ink"
        aria-expanded={open}
      >
        Your forest · {score}
      </button>

      {open && (
        <>
          {/* Click-away sheet, beneath the panel. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="fixed bottom-28 right-4 z-40 w-[min(24rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto rounded-[6px] border border-studio-hairline bg-studio-cream p-5">
            <Eyebrow className="text-studio-dim">Your forest</Eyebrow>
            <p className="mt-2 text-lg font-semibold text-studio-ink">{forestRead(score)}</p>
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-studio-dim">
              {score} of 100 · grown from your data
            </p>

            {rows.length > 0 && (
              <div className="mt-4">
                <FactList items={rows} />
              </div>
            )}

            <div className="mt-4 border-t border-studio-hairline pt-3">
              <a
                href={`/api/growth/forest.svg?organization_id=${organizationId}`}
                download="our-forest.svg"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-studio-dim underline-offset-4 hover:text-studio-ink hover:underline"
              >
                Download your forest
              </a>
            </div>
          </div>
        </>
      )}
    </>
  );
}
