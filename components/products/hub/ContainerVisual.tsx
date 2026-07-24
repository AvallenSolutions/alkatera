'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';

export type ContainerType = 'bottle' | 'can' | 'keg';

/**
 * The lifecycle, in the order a product lives it, in the dossier's words.
 *
 * The old hero sorted these by size, biggest at the bottom, and gave each one
 * a colour from a different room: cobalt, forest, violet, ochre, grey, rose,
 * brick. Eight saturated colours on one surface, against a budget of one, and
 * an order that told the reader nothing. Reading up the vessel now walks the
 * product's life, and the ladder of opacity is the only encoding.
 */
export const LIFECYCLE_STAGES = [
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'making', label: 'Making it' },
  { key: 'packaging', label: 'Packaging' },
  { key: 'distribution', label: 'Getting it there' },
  { key: 'after', label: 'After it is sold' },
] as const;

export type StageKey = (typeof LIFECYCLE_STAGES)[number]['key'];

export interface StageValues {
  ingredients: number;
  making: number;
  packaging: number;
  distribution: number;
  after: number;
}

/** Later in life, lighter on the glass. The one encoding this drawing carries. */
const STAGE_OPACITY: Record<StageKey, number> = {
  ingredients: 1,
  making: 0.82,
  packaging: 0.64,
  distribution: 0.46,
  after: 0.28,
};

/** viewBox 0 0 100 200 for all three, so they can be swapped without relayout. */
const VESSELS: Record<ContainerType, { outline: string; top: number; bottom: number; detail?: string }> = {
  bottle: {
    outline:
      'M38,10 L62,10 L62,55 C62,75 80,85 80,110 L80,185 C80,193 75,198 65,198 L35,198 C25,198 20,193 20,185 L20,110 C20,85 38,75 38,55 Z',
    top: 60,
    bottom: 198,
  },
  can: {
    outline:
      'M28,32 L72,32 L72,36 L80,48 L80,170 C80,180 72,185 50,185 C28,185 20,180 20,170 L20,48 L28,36 Z',
    top: 48,
    bottom: 185,
    detail: 'M28,36 L72,36',
  },
  keg: {
    outline: 'M15,40 L85,40 L85,175 C85,180 15,180 15,175 Z',
    top: 40,
    bottom: 180,
    detail: 'M15,52 L85,52',
  },
};

/** A container type from what the product actually is, when nobody has said. */
export function inferContainerType(
  category?: string | null,
  unitSizeUnit?: string | null,
  unitSizeValue?: number | null,
): ContainerType {
  const text = `${category ?? ''} ${unitSizeUnit ?? ''}`.toLowerCase();
  if (text.includes('keg') || text.includes('cask') || (unitSizeValue ?? 0) >= 5000) return 'keg';
  if (text.includes('can') || text.includes('beer') || text.includes('cider') || text.includes('rtd')) {
    return 'can';
  }
  return 'bottle';
}

interface ContainerVisualProps {
  type: ContainerType;
  stages: StageValues;
  className?: string;
  /** Rendered at the vessel's own size; the caller owns the surrounding layout. */
  height?: number;
}

/**
 * The footprint, drawn as what the drink comes in.
 *
 * Each stage fills a band of the vessel in proportion to its share, stacked in
 * lifecycle order from the base up. Negative figures (an end-of-life credit,
 * a soil-carbon removal) cannot be drawn as fill and are excluded here; the
 * stage rows beside the drawing state them honestly instead.
 */
export function ContainerVisual({ type, stages, className, height = 200 }: ContainerVisualProps) {
  const maskId = useId();
  const vessel = VESSELS[type];
  const fillHeight = vessel.bottom - vessel.top;

  const positive = LIFECYCLE_STAGES.map((stage) => ({
    ...stage,
    value: Math.max(0, stages[stage.key] ?? 0),
  })).filter((stage) => stage.value > 0);

  const total = positive.reduce((sum, stage) => sum + stage.value, 0);

  // A stage worth a fraction of a percent still deserves to be visible, so it
  // gets a floor; the bands are then normalised back so they fill the vessel
  // exactly rather than overflowing it.
  const MIN_BAND = 3;
  const raw = positive.map((stage) => {
    const exact = total > 0 ? (stage.value / total) * fillHeight : 0;
    return { ...stage, band: Math.max(exact, MIN_BAND) };
  });
  const rawTotal = raw.reduce((sum, stage) => sum + stage.band, 0);

  let y = vessel.bottom;
  const bands = raw.map((stage) => {
    const band = rawTotal > 0 ? (stage.band / rawTotal) * fillHeight : 0;
    y -= band;
    return { key: stage.key, y, band };
  });

  return (
    <svg
      viewBox="0 0 100 200"
      style={{ height, width: (height / 200) * 100 }}
      className={cn('shrink-0 overflow-visible', className)}
      role="img"
      aria-label={`The footprint by lifecycle stage, drawn as a ${type}`}
    >
      <defs>
        <mask id={maskId}>
          <path d={vessel.outline} fill="white" />
        </mask>
      </defs>

      {/* The empty vessel reads as paper, so an uncalculated product is not a hole. */}
      <path d={vessel.outline} className="fill-studio-paper" />

      <g mask={`url(#${maskId})`}>
        {bands.map((band) => (
          <rect
            key={band.key}
            x="0"
            y={band.y}
            width="100"
            height={band.band}
            className="fill-room-accent"
            fillOpacity={STAGE_OPACITY[band.key as StageKey]}
          />
        ))}
      </g>

      <path
        d={vessel.outline}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className="text-studio-ink/70"
      />
      {vessel.detail && (
        <path
          d={vessel.detail}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          className="text-studio-ink/40"
        />
      )}
    </svg>
  );
}

/** The swatch beside a stage row, at that stage's rung on the ladder. */
export function StageSwatch({ stage, className }: { stage: StageKey; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block h-2.5 w-2.5 rounded-[2px] bg-room-accent', className)}
      style={{ opacity: STAGE_OPACITY[stage] }}
    />
  );
}
