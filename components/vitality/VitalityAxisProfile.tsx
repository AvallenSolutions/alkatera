'use client';

import { cn } from '@/lib/utils';
import { STUDIO } from '@/components/studio/theme';
import { Eyebrow } from '@/components/studio/eyebrow';
import type { VitalityComposite } from '@/lib/vitality/composite';
import type { AxisKey } from './VitalityAxisSections';

/**
 * The nine-axis profile: the shape of the organisation in one glance.
 *
 * Nine hairline bars, grouped into the three pillars and coloured by pillar.
 *
 * DELIBERATELY NOT A RADAR. A radar plots zero at the centre and joins the
 * points, so three axes sitting at 0 still enclose an area — the chart draws a
 * shape where there is no data and flatters the org. Bars cannot lie that way:
 * a zero bar is an empty track, and an empty track reads as empty.
 *
 * For the same reason "no score yet" and "a measured zero" are drawn
 * differently. Community, People & culture and Supplier ESG are the axes this
 * matters for: one of them scoring 0 because we counted and found nothing is a
 * different fact from one scoring nothing because nobody has entered data, and
 * the page should not blur the two.
 */

const PILLAR_COLOUR = {
  e: STUDIO.forest,
  s: STUDIO.cobalt,
  g: STUDIO.plum,
} as const;

const AXIS_SHORT: Record<AxisKey, string> = {
  climate: 'Climate',
  water: 'Water',
  circularity: 'Circular',
  nature: 'Nature',
  community: 'Community',
  people_culture: 'People',
  supplier_esg: 'Suppliers',
  governance: 'Governance',
  certifications: 'Certs',
};

interface Bar {
  axis: AxisKey;
  score: number | null;
  pillar: keyof typeof PILLAR_COLOUR;
}

function barsFor(composite: VitalityComposite): Bar[] {
  const out: Bar[] = [];
  const push = (pillar: keyof typeof PILLAR_COLOUR, sub: Record<string, number | null>) => {
    for (const [axis, score] of Object.entries(sub)) {
      out.push({ axis: axis as AxisKey, score, pillar });
    }
  };
  push('e', composite.e.sub as any);
  push('s', composite.s.sub as any);
  push('g', composite.g.sub as any);
  return out;
}

function AxisBar({ bar }: { bar: Bar }) {
  const colour = PILLAR_COLOUR[bar.pillar];
  const scored = bar.score !== null && Number.isFinite(bar.score);
  const value = scored ? Math.max(0, Math.min(100, bar.score as number)) : 0;
  const label = AXIS_SHORT[bar.axis] ?? bar.axis;

  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
      {/* The cell stays wide enough for its label; the BAR is narrow, so nine
          of them read as a profile rather than nine blocks. */}
      <div
        className="relative flex h-20 w-full items-end justify-center"
        title={`${label}: ${scored ? Math.round(value) : 'nothing yet'}`}
      >
        <div className="relative flex h-full w-full max-w-[14px] items-end justify-center">
          {/* The track. Always drawn, so an empty axis still occupies its place
              in the profile rather than vanishing from the shape. */}
          <div className="absolute inset-0 bg-studio-hairline/40" />
          {scored ? (
            value > 0 ? (
              <div
                className="relative w-full transition-[height] duration-500 ease-studio"
                style={{ height: `${value}%`, backgroundColor: colour }}
              />
            ) : (
              // A measured zero: a solid baseline rule, so it is visibly a
              // reading of nothing rather than an absence of reading.
              <div className="relative h-[2px] w-full" style={{ backgroundColor: colour }} />
            )
          ) : (
            // No score yet: nothing drawn at all, only the faint track above.
            <div className="relative h-0 w-full" />
          )}
        </div>
      </div>
      <span
        className={cn(
          'w-full truncate text-center font-mono text-[9px] uppercase tracking-[0.1em]',
          scored ? 'text-studio-dim' : 'text-studio-dim/50',
        )}
      >
        {label}
      </span>
    </div>
  );
}

export function VitalityAxisProfile({
  composite,
  className,
}: {
  composite: VitalityComposite | null;
  className?: string;
}) {
  if (!composite) return null;

  const bars = barsFor(composite);
  const groups: Array<{ key: keyof typeof PILLAR_COLOUR; label: string }> = [
    { key: 'e', label: 'Environment' },
    { key: 's', label: 'People' },
    { key: 'g', label: 'Governance' },
  ];

  return (
    <section className={cn('border-t border-border pt-6', className)}>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <Eyebrow>The shape of it</Eyebrow>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          Nine axes · 0–100
        </span>
      </div>

      {/* Capped: the profile is meant to be taken in at a glance, and nine bars
          spread over a full-width page stop being one shape. */}
      <div className="flex max-w-2xl items-end gap-4">
        {groups.map((group) => {
          const groupBars = bars.filter((b) => b.pillar === group.key);
          return (
            <div
              key={group.key}
              className="flex flex-col gap-2"
              style={{ flexGrow: groupBars.length, flexBasis: 0 }}
            >
              <div className="flex items-end gap-1.5">
                {groupBars.map((bar) => (
                  <AxisBar key={bar.axis} bar={bar} />
                ))}
              </div>
              <div
                className="border-t pt-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ color: PILLAR_COLOUR[group.key], borderColor: PILLAR_COLOUR[group.key] }}
              >
                {group.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* The same nine facts, for anyone not reading the bars. */}
      <ul className="sr-only">
        {bars.map((bar) => (
          <li key={bar.axis}>
            {AXIS_SHORT[bar.axis]}:{' '}
            {bar.score === null ? 'no score yet' : `${Math.round(bar.score)} out of 100`}
          </li>
        ))}
      </ul>
    </section>
  );
}
