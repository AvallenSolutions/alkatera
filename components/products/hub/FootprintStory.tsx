'use client';

import Link from 'next/link';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { StateChip } from '@/components/studio/state-chip';
import {
  ContainerVisual,
  StageSwatch,
  LIFECYCLE_STAGES,
  inferContainerType,
  type StageValues,
  type StageKey,
} from './ContainerVisual';
import type { ProductLCA } from '@/hooks/data/useProductData';

interface FootprintStoryProps {
  productId: string;
  category?: string | null;
  unitSizeUnit?: string | null;
  unitSizeValue?: number | null;
  pcf: ProductLCA | null;
  /** True once the recipe can support a calculation at all. */
  isHealthy: boolean;
}

/** The five stages, from the aggregator's by_lifecycle_stage breakdown. */
function stagesFrom(pcf: ProductLCA | null): { stages: StageValues; total: number } | null {
  const by = pcf?.aggregated_impacts?.breakdown?.by_lifecycle_stage;
  if (!by) return null;

  const stages: StageValues = {
    ingredients: by.raw_materials || 0,
    making: by.processing || 0,
    // Older rows wrote this as packaging_stage.
    packaging: by.packaging ?? (by as any).packaging_stage ?? 0,
    distribution: by.distribution || 0,
    after: (by.end_of_life || 0) + (by.use_phase || 0),
  };

  const total =
    stages.ingredients + stages.making + stages.packaging + stages.distribution + stages.after;
  return total === 0 ? null : { stages, total };
}

function formatKg(value: number): string {
  if (value === 0) return '0';
  if (Math.abs(value) < 0.01) return value.toFixed(4);
  return value.toLocaleString('en-GB', { maximumFractionDigits: 3 });
}

/**
 * The footprint, told once.
 *
 * The hub used to tell it three times over: a hero with its own big number, a
 * four-figure "impact at a glance" strip, then a climate accordion restating
 * the same total as a stage breakdown, then three more accordions restating
 * the other three figures. This is one drawing, one set of stage rows, and
 * the other three capitals as quiet numbers. Anything deeper is the dossier's
 * job, and this section's foot is the door to it.
 */
export function FootprintStory({
  productId,
  category,
  unitSizeUnit,
  unitSizeValue,
  pcf,
  isHealthy,
}: FootprintStoryProps) {
  const breakdown = stagesFrom(pcf);
  const impacts = pcf?.aggregated_impacts;

  if (!breakdown) {
    return (
      <section className="border-t border-studio-hairline pt-8">
        <Eyebrow className="mb-3">THE FOOTPRINT</Eyebrow>
        <p className="max-w-md text-sm text-muted-foreground">
          {isHealthy
            ? 'The footprint is forming. Open it to see where the figures came from.'
            : 'The footprint forms as the recipe does. Add ingredients and packaging, and a first estimate follows.'}
        </p>
        <Link
          href={isHealthy ? `/products/${productId}/dossier` : `/products/${productId}/recipe`}
          className="mt-4 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-opacity duration-150 ease-studio hover:opacity-70"
        >
          {isHealthy ? 'Open the footprint →' : 'Edit the recipe →'}
        </Link>
      </section>
    );
  }

  const { stages, total } = breakdown;
  const container = inferContainerType(category, unitSizeUnit, unitSizeValue);
  const soilCarbon = (impacts?.breakdown as any)?.flag_removals?.soil_carbon_co2e || 0;

  const rows = LIFECYCLE_STAGES.map((stage) => ({
    ...stage,
    value: stages[stage.key],
    share: total > 0 ? (stages[stage.key] / total) * 100 : 0,
  })).filter((row) => row.value !== 0);

  return (
    <section className="border-t border-studio-hairline pt-8">
      <Eyebrow className="mb-6">THE FOOTPRINT</Eyebrow>

      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <ContainerVisual type={container} stages={stages} height={200} />

        <div className="min-w-0 flex-1">
          <dl className="divide-y divide-studio-hairline border-y border-studio-hairline">
            {rows.map((row) => (
              <div key={row.key} className="flex items-baseline gap-3 py-2.5">
                <StageSwatch stage={row.key as StageKey} className="translate-y-[1px]" />
                <dt className="min-w-0 flex-1 truncate text-sm text-foreground">{row.label}</dt>
                <dd className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                  {formatKg(row.value)} kg
                </dd>
                <dd className="w-12 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-foreground">
                  {row.share.toFixed(0)}%
                </dd>
              </div>
            ))}
          </dl>

          {soilCarbon > 0 && (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Soil carbon removals {formatKg(soilCarbon)} kg, reported separately, never netted off
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4">
            {impacts?.water_scarcity_aware != null && (
              <BigNumber
                size="panel"
                value={formatKg(impacts.water_scarcity_aware)}
                label="m³ eq water scarcity"
              />
            )}
            {impacts?.circularity_percentage != null && (
              <BigNumber
                size="panel"
                value={`${Math.round(impacts.circularity_percentage)}%`}
                label="Circularity"
              />
            )}
            {impacts?.land_use != null && (
              <BigNumber size="panel" value={formatKg(impacts.land_use)} label="m²a land use" />
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/products/${productId}/dossier`}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-opacity duration-150 ease-studio hover:opacity-70"
            >
              Open the footprint →
            </Link>
            {pcf?.status && pcf.status !== 'completed' && (
              <StateChip tone="attention">Not finished</StateChip>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
