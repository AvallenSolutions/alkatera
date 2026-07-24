import React from 'react';
import { Mountain, Leaf, Droplets, Wind } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
import type { WorkingTone } from '@/components/studio/theme';
import { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import {
  NATURE_PERFORMANCE_THRESHOLDS,
  RECIPE_2016_CATEGORIES,
  getPerformanceLevel,
  getPerformanceLabel,
  getTargetGuidanceText,
  type NatureImpactCategory,
  type PerformanceLevel,
} from '@/lib/calculations/nature-biodiversity';

interface NatureDeepDiveProps {
  natureMetrics: NatureMetrics | null;
}

/**
 * The nature axis body, on the studio system.
 *
 * Was four tinted cards inside a card inside a card, with per-category colours
 * (green land, blue water, purple acidification) that encoded nothing — the
 * category is already named in words beside them. The state tones now carry
 * the only thing worth colouring: whether a figure is good or wants attention.
 */

/** The performance level, as a working tone. Tone means state, never subject. */
function toneFor(level: PerformanceLevel): WorkingTone {
  switch (level) {
    case 'excellent':
    case 'good':
      return 'good';
    case 'needs_improvement':
      return 'attention';
    default:
      return 'quiet';
  }
}

export function NatureDeepDive({ natureMetrics }: NatureDeepDiveProps) {
  if (!natureMetrics) {
    return (
      <p className="text-sm text-muted-foreground">
        No nature data yet. Complete product LCAs to see land use, ecotoxicity, eutrophication and
        acidification.
      </p>
    );
  }

  const perUnit = natureMetrics.per_unit;
  const total = natureMetrics;
  const production = natureMetrics.total_production_volume;

  const metrics = [
    {
      name: RECIPE_2016_CATEGORIES.LAND_USE.name,
      category: 'land_use' as NatureImpactCategory,
      perUnit: perUnit.land_use,
      total: total.land_use,
      unitShort: RECIPE_2016_CATEGORIES.LAND_USE.unitShort,
      icon: Mountain,
      description: RECIPE_2016_CATEGORIES.LAND_USE.description,
      interpretation: 'Lower is better — less land transformed',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.GOOD,
      },
      targetGuidance: getTargetGuidanceText('land_use'),
    },
    {
      name: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.name,
      category: 'terrestrial_ecotoxicity' as NatureImpactCategory,
      perUnit: perUnit.terrestrial_ecotoxicity,
      total: total.terrestrial_ecotoxicity,
      unitShort: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.unitShort,
      icon: Leaf,
      description: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.description,
      interpretation: 'Lower is better — less toxic impact',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.GOOD,
      },
      targetGuidance: getTargetGuidanceText('terrestrial_ecotoxicity'),
    },
    {
      name: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.name,
      category: 'freshwater_eutrophication' as NatureImpactCategory,
      perUnit: perUnit.freshwater_eutrophication,
      total: total.freshwater_eutrophication,
      unitShort: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.unitShort,
      icon: Droplets,
      description: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.description,
      interpretation: 'Lower is better — less water pollution',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.GOOD,
      },
      targetGuidance: getTargetGuidanceText('freshwater_eutrophication'),
    },
    {
      name: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.name,
      category: 'terrestrial_acidification' as NatureImpactCategory,
      perUnit: perUnit.terrestrial_acidification,
      total: total.terrestrial_acidification,
      unitShort: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.unitShort,
      icon: Wind,
      description: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.description,
      interpretation: 'Lower is better — less soil acidification',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.GOOD,
      },
      targetGuidance: getTargetGuidanceText('terrestrial_acidification'),
    },
  ];

  const maxPerUnitValue = Math.max(
    ...metrics.map((m) => (m.benchmark.fair > 0 ? (m.perUnit / m.benchmark.fair) * 100 : 0)),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Per-unit biodiversity metrics across {production.toLocaleString()} units produced.
        </p>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          CSRD E4 · TNFD
        </span>
      </div>

      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const level = getPerformanceLevel(metric.category, metric.perUnit);
          const label = getPerformanceLabel(level);
          const percentageOfFair =
            metric.benchmark.fair > 0 ? (metric.perUnit / metric.benchmark.fair) * 100 : 0;
          const relativeIntensity =
            maxPerUnitValue > 0 ? (percentageOfFair / maxPerUnitValue) * 100 : 0;

          return (
            <section key={metric.name} className="border-t border-studio-hairline pt-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-studio-dim" aria-hidden="true" />
                  <Eyebrow className="truncate">{metric.name}</Eyebrow>
                </div>
                <StateChip tone={toneFor(level)}>{label}</StateChip>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold tabular-nums text-foreground">
                  {metric.perUnit >= 1 ? metric.perUnit.toFixed(2) : metric.perUnit.toFixed(4)}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                  {metric.unitShort} per unit
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between gap-4 text-xs">
                <span className="text-muted-foreground">{metric.interpretation}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                  vs benchmark
                </span>
              </div>
              <div className="mt-1.5 h-[3px] w-full bg-studio-ink/10">
                <div
                  className={cn(
                    'h-full transition-[width] duration-500 ease-studio',
                    level === 'needs_improvement' ? 'bg-studio-attention' : 'bg-studio-good',
                  )}
                  style={{ width: `${Math.min(relativeIntensity, 100)}%` }}
                />
              </div>

              <dl className="mt-4 space-y-1.5 text-xs">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Whole company</dt>
                  <dd className="font-display text-base font-bold tabular-nums text-foreground">
                    {metric.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}{' '}
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                      {metric.unitShort}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Benchmark</dt>
                  <dd className="text-muted-foreground">{metric.targetGuidance}</dd>
                </div>
                <div>
                  <dt className="sr-only">What this measures</dt>
                  <dd className="text-muted-foreground">{metric.description}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>

      <section className="border-t border-studio-hairline pt-5">
        <Eyebrow tone="dim" className="mb-2">
          Reading these
        </Eyebrow>
        <p className="text-xs leading-relaxed text-muted-foreground">
          These are average per-unit impacts across your portfolio, which is what lets them be
          compared against a benchmark regardless of how much you produce. The whole-company figure
          beside each one is what your output adds up to. Together they support the TNFD LEAP
          framework for identifying nature-related dependencies and impacts across your value
          chain.
        </p>
        <div className="mt-4">
          <PillButton size="sm" href="/rosa/">
            Ask Rosa what would reduce these
          </PillButton>
        </div>
      </section>
    </div>
  );
}
