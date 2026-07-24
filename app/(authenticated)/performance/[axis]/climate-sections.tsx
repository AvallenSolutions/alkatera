'use client';

import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import type { ClimateScoreBreakdown } from '@/lib/vitality/environmental';

/** One hairline bar: the studio's way of drawing a proportion. */
function ScoreBar({ value, label, weight }: { value: number; label: string; weight: string }) {
  return (
    <div className="border-b border-studio-hairline py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-display text-sm font-semibold text-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-studio-dim">
          {Math.round(value)} · weighted {weight}
        </span>
      </div>
      <div className="mt-2 h-[3px] w-full bg-studio-ink/10">
        <div
          className="h-full bg-room-accent"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

const num = (n: number, digits = 0) =>
  n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/**
 * The two years side by side: absolute AND per unit.
 *
 * Absolute on its own tells a flattering lie — a business that shrank 38% and
 * changed nothing about how it produces looks like it decarbonised. Showing
 * units alongside is what stops the page making that claim.
 */
export function ClimateProgressTable({ breakdown }: { breakdown: ClimateScoreBreakdown | null }) {
  const p = breakdown?.progress;
  if (!p || p.prior_year_kgco2e === null || p.current_year_kgco2e === null) return null;

  const priorT = p.prior_year_kgco2e / 1000;
  const currentT = p.current_year_kgco2e / 1000;
  const deltaT = currentT - priorT;
  const unitsDeltaPct =
    p.prior_year_units > 0
      ? ((p.current_year_units - p.prior_year_units) / p.prior_year_units) * 100
      : null;
  const emissionsDeltaPct = p.delta_pct;

  const priorPerUnit = p.prior_year_units > 0 ? p.prior_year_kgco2e / p.prior_year_units : null;
  const currentPerUnit =
    p.current_year_units > 0 ? p.current_year_kgco2e / p.current_year_units : null;

  const cell = 'border-b border-studio-hairline py-3 text-right tabular-nums';
  const head =
    'border-b border-studio-hairline pb-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim';

  return (
    <section>
      <Eyebrow className="mb-1">Your progress</Eyebrow>
      <p className="mb-4 text-sm text-muted-foreground">
        Last year against this year, on the same basis.
      </p>

      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-6 text-sm">
        <div className="contents">
          <span className="border-b border-studio-hairline pb-2" />
          <span className={head}>Footprint</span>
          <span className={head}>Made</span>
          <span className={head}>Per unit</span>
        </div>

        <div className="contents">
          <span className="border-b border-studio-hairline py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-studio-dim">
            Last year
          </span>
          <span className={cell}>{num(priorT, 1)} t</span>
          <span className={cell}>{num(p.prior_year_units)}</span>
          <span className={cell}>{priorPerUnit !== null ? `${num(priorPerUnit, 3)} kg` : '—'}</span>
        </div>

        <div className="contents">
          <span className="border-b border-studio-hairline py-3 font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
            This year
          </span>
          <span className={`${cell} font-semibold`}>{num(currentT, 1)} t</span>
          <span className={`${cell} font-semibold`}>{num(p.current_year_units)}</span>
          <span className={`${cell} font-semibold`}>
            {currentPerUnit !== null ? `${num(currentPerUnit, 3)} kg` : '—'}
          </span>
        </div>

        <div className="contents">
          <span className="py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            Change
          </span>
          <span className="py-3 text-right">
            {emissionsDeltaPct !== null ? (
              <StateChip tone={emissionsDeltaPct < 0 ? 'good' : 'attention'}>
                {emissionsDeltaPct < 0 ? 'Down' : 'Up'} {num(Math.abs(emissionsDeltaPct))}%
              </StateChip>
            ) : (
              <StateChip tone="quiet">No prior year</StateChip>
            )}
          </span>
          <span className="py-3 text-right">
            {unitsDeltaPct !== null ? (
              <StateChip tone="quiet">
                {unitsDeltaPct < 0 ? 'Down' : 'Up'} {num(Math.abs(unitsDeltaPct))}%
              </StateChip>
            ) : (
              <StateChip tone="quiet">—</StateChip>
            )}
          </span>
          <span className="py-3 text-right">
            <StateChip tone="attention">Not yet measurable</StateChip>
          </span>
        </div>
      </div>

      {/*
        The per-unit column is NOT a measurement. Both years are computed from
        the same current PCF times that year's units (buildClimateInputs says
        so in its own docstring), so intensity is held constant by construction
        and any "no change" there is arithmetic, not a finding. Saying so
        plainly is the difference between a number and a claim; this becomes a
        real comparison once PCFs are year-vintaged.
      */}
      <p className="mt-4 border-l-2 border-studio-attention pl-3 text-sm leading-relaxed text-foreground">
        Your total footprint {deltaT < 0 ? 'fell' : 'rose'} {num(Math.abs(deltaT), 1)} t CO2e, from{' '}
        {num(priorT, 1)} t to {num(currentT, 1)} t, and you produced{' '}
        {unitsDeltaPct !== null
          ? `${num(Math.abs(unitsDeltaPct))}% ${unitsDeltaPct < 0 ? 'fewer' : 'more'} units`
          : 'a different number of units'}
        . We cannot yet tell you how much of that came from cleaner production, because your
        footprints are only measured for one year. Once there are two, this is where the split
        will be.
      </p>
    </section>
  );
}

/** Why the number is what it is — the thing the page has never said. */
export function ScoreBuildUp({ breakdown }: { breakdown: ClimateScoreBreakdown | null }) {
  if (!breakdown || breakdown.score === null) return null;
  const { intensity_sub, yoy_sub, weights, score, progress } = breakdown;
  if (intensity_sub === null && yoy_sub === null) return null;

  return (
    <section>
      <Eyebrow className="mb-1">How this score is built</Eyebrow>
      <p className="mb-3 text-sm text-muted-foreground">Two measures, blended.</p>

      {intensity_sub !== null ? (
        <ScoreBar
          label="Carbon intensity"
          value={intensity_sub}
          weight={`${Math.round(weights.intensity * 100)}%`}
        />
      ) : null}
      {yoy_sub !== null ? (
        // Labelled for what it actually measures. It is computed from the same
        // per-unit figure in both years, so it moves with volume and mix, not
        // with decarbonisation. Calling it an emissions trend would be a
        // substantiation problem inside our own product.
        <ScoreBar
          label="Volume and mix change"
          value={yoy_sub}
          weight={`${Math.round(weights.yoy * 100)}%`}
        />
      ) : null}

      {intensity_sub !== null && yoy_sub !== null ? (
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.16em] text-studio-dim">
          {Math.round(intensity_sub)} × {weights.intensity} + {Math.round(yoy_sub)} ×{' '}
          {weights.yoy} = {Math.round(score)}
        </p>
      ) : null}

      {progress?.per_unit_actual_kgco2e != null && progress?.per_unit_benchmark_kgco2e ? (
        <p className="mt-3 text-sm text-muted-foreground">
          At {num(progress.per_unit_actual_kgco2e, 3)} kg per unit you are{' '}
          {num(progress.per_unit_actual_kgco2e / progress.per_unit_benchmark_kgco2e, 2)}× the
          drinks-sector benchmark of {num(progress.per_unit_benchmark_kgco2e, 3)}, which is what
          holds intensity at {intensity_sub !== null ? Math.round(intensity_sub) : '—'}.
        </p>
      ) : null}
    </section>
  );
}
