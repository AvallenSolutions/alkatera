'use client';

import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';
import { AXIS_ROUTE } from '@/app/(authenticated)/performance/[axis]/axis-config';
import type {
  EnvironmentalSubScores,
  GovernanceSubScores,
  SocialSubScores,
  VitalityComposite,
} from '@/lib/vitality/composite';

/**
 * The nine axes, as three hairline sections.
 *
 * This is the page's body. It replaces two things that used to say the same
 * thing forty pixels apart: the hero's "Pillar breakdown" block and the four
 * expandable PillarCards below it. One list, nine rows, and Social and
 * Governance finally stand level with Environmental instead of being
 * unreachable — the old page spent its whole body on the four environmental
 * axes, which are the healthy ones, while the composite was being dragged
 * down by People & culture.
 *
 * Rows link to `/performance/[axis]/`. An axis is somewhere you GO, the way
 * you go from the cellar to a product — not a card that expands, and not a
 * sheet laid over the page you were reading. Axes with no page of their own
 * (the social and governance ones, which have no deep-dive body yet) render as
 * plain rows rather than dead links.
 */

export type AxisKey =
  | keyof EnvironmentalSubScores
  | keyof SocialSubScores
  | keyof GovernanceSubScores;

const AXIS_LABELS: Record<AxisKey, string> = {
  climate: 'Climate',
  water: 'Water',
  circularity: 'Circularity',
  nature: 'Nature',
  community: 'Community impact',
  people_culture: 'People & culture',
  supplier_esg: 'Supplier ESG',
  governance: 'Governance practices',
  certifications: 'Certifications progress',
};

/** A plain-language figure for an axis. Precise units live on the axis page. */
export type AxisFacts = Partial<Record<AxisKey, string>>;

function axisRows(
  sub: Record<string, number | null>,
  facts: AxisFacts,
  linked: Set<AxisKey>,
): FactRowItem[] {
  return Object.entries(sub).map(([key, value]) => {
    const axis = key as AxisKey;
    const scored = value !== null && Number.isFinite(value);
    return {
      id: axis,
      title: AXIS_LABELS[axis] ?? axis,
      // An axis with no score at all says so plainly. An axis with a score but
      // no headline figure says nothing rather than inventing one.
      hint: scored ? facts[axis] : 'Nothing yet',
      value: scored ? String(Math.round(value as number)) : '—',
      href: linked.has(axis) ? `/performance/${AXIS_ROUTE[axis] ?? axis}/` : undefined,
    };
  });
}

function Section({
  title,
  score,
  items,
}: {
  title: string;
  score: number | null;
  items: FactRowItem[];
}) {
  return (
    <section className="border-t border-border pt-6">
      <div className="mb-1 flex items-baseline justify-between gap-4">
        <Eyebrow>{title}</Eyebrow>
        <span className="font-display text-2xl font-semibold leading-none tabular-nums text-foreground">
          {score !== null && Number.isFinite(score) ? Math.round(score) : '—'}
        </span>
      </div>
      <FactList items={items} />
    </section>
  );
}

export function VitalityAxisSections({
  composite,
  facts = {},
  linkedAxes,
}: {
  composite: VitalityComposite | null;
  /** Plain-language figures, keyed by axis. Supplied by the page. */
  facts?: AxisFacts;
  /** Axes that have a page of their own. */
  linkedAxes?: AxisKey[];
}) {
  if (!composite) return null;

  const linked = new Set<AxisKey>(linkedAxes ?? []);

  return (
    <div className="space-y-6">
      <Section
        title="The environment"
        score={composite.e.score}
        items={axisRows(composite.e.sub as any, facts, linked)}
      />
      <Section
        title="The people"
        score={composite.s.score}
        items={axisRows(composite.s.sub as any, facts, linked)}
      />
      <Section
        title="The governance"
        score={composite.g.score}
        items={axisRows(composite.g.sub as any, facts, linked)}
      />
    </div>
  );
}
