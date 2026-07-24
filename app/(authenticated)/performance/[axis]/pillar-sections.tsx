'use client';

import { Eyebrow } from '@/components/studio/eyebrow';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';
import { PillButton } from '@/components/studio/pill-button';

/**
 * The Social and Governance pillar pages.
 *
 * These axes are mostly empty for most organisations, and that is the point of
 * the page rather than a reason not to build it. The vitality page says People
 * & culture is dragging the composite down; until now it then offered nowhere
 * to go. A page that says "this is 0 because nobody has entered X, and here is
 * where you enter it" is worth more than a chart of nothing.
 *
 * So a measure with no data gets a row that names the gap and links to the
 * place it is filled, not a zero dressed up as a finding.
 */

interface Measure {
  key: string;
  label: string;
  /** 0-100, or null when the measure has no data at all. */
  score: number | null;
  weight: number;
  /** What to do about it, when there is nothing there. */
  gap?: { hint: string; href: string };
}

function measureRows(measures: Measure[]): FactRowItem[] {
  return measures.map((m) => {
    const scored = m.score !== null && Number.isFinite(m.score);
    const empty = !scored || m.score === 0;
    return {
      id: m.key,
      title: m.label,
      hint: empty && m.gap ? m.gap.hint : `Weighted ${Math.round(m.weight * 100)}%`,
      value: scored ? String(Math.round(m.score as number)) : '—',
      chip: empty ? { tone: 'attention' as const, label: 'nothing yet' } : undefined,
      href: empty && m.gap ? m.gap.href : undefined,
    };
  });
}

export function PillarMeasures({
  measures,
  score,
}: {
  measures: Measure[];
  score: number | null;
}) {
  // A measure at zero weight is not a gap the user can close — it is not being
  // asked of them yet. Counting it as one would send them off to fix nothing.
  const empties = measures.filter(
    (m) => (m.score === null || m.score === 0) && m.weight > 0,
  );
  const recoverable = empties.reduce((sum, m) => sum + m.weight, 0);

  return (
    <>
      <section>
        <Eyebrow className="mb-1">How this score is built</Eyebrow>
        <p className="mb-3 text-sm text-muted-foreground">
          {measures.length} measures, each carrying the weight shown against it. A measure you
          have no data for still counts against you; one that cannot be computed at all — the
          year-on-year comparison, before there is a prior year — drops to zero weight instead.
        </p>
        <FactList items={measureRows(measures)} />
      </section>

      {empties.length > 0 ? (
        <section className="border-t border-studio-hairline pt-6">
          <Eyebrow className="mb-1">What would move it most</Eyebrow>
          <p className="text-sm leading-relaxed text-foreground">
            {empties.length === measures.length ? (
              <>
                Nothing has been entered for this pillar yet, which is why it scores{' '}
                {score !== null ? Math.round(score) : 0}.
              </>
            ) : (
              <>
                {empties.length} of {measures.length} measures {empties.length === 1 ? 'has' : 'have'} no
                data, carrying{' '}
                {Math.round(recoverable * 100)}% of this pillar&apos;s weight between them. That is
                the ceiling you are scoring against, not a judgement on the work you do.
              </>
            )}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {empties
              .filter((m) => m.gap)
              .map((m) => (
                <PillButton key={m.key} size="sm" href={m.gap!.href}>
                  {m.label}
                </PillButton>
              ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Social: workforce / community / supplier / year-on-year. Weights come from the API. */
export function socialMeasures(breakdown: any): Measure[] {
  const axes = breakdown?.axes ?? {};
  const w = breakdown?.weights ?? {};
  return [
    {
      key: 'workforce',
      label: 'Workforce',
      score: axes.workforce_sub ?? null,
      weight: w.workforce ?? 0.5,
      gap: {
        hint: 'No workforce data. Add headcount, pay and turnover.',
        href: '/people-culture/',
      },
    },
    {
      key: 'community',
      label: 'Community',
      score: axes.community_sub ?? null,
      weight: w.community ?? 0.25,
      gap: {
        hint: 'No community contribution logged.',
        href: '/community-impact/',
      },
    },
    {
      key: 'supplier',
      label: 'Supplier assessment',
      score: axes.supplier_sub ?? null,
      weight: w.supplier ?? 0.15,
      gap: {
        hint: 'No suppliers assessed for social risk.',
        href: '/suppliers/',
      },
    },
    {
      key: 'yoy',
      label: 'Change on last year',
      score: axes.yoy_sub ?? null,
      weight: w.yoy ?? 0,
    },
  ];
}

/** Governance: practices / certifications / year-on-year. */
export function governanceMeasures(breakdown: any): Measure[] {
  const axes = breakdown?.axes ?? {};
  const w = breakdown?.weights ?? {};
  return [
    {
      key: 'practices',
      label: 'Governance practices',
      score: axes.practices_sub ?? null,
      weight: w.practices ?? 0.6,
      gap: {
        hint: 'No policies, board or ethics record entered.',
        href: '/governance/',
      },
    },
    {
      key: 'certifications',
      label: 'Certifications progress',
      score: axes.certifications_sub ?? null,
      weight: w.certifications ?? 0.3,
      gap: {
        hint: 'No certifications logged.',
        href: '/certifications/',
      },
    },
    {
      key: 'yoy',
      label: 'Change on last year',
      score: axes.yoy_sub ?? null,
      weight: w.yoy ?? 0,
    },
  ];
}
