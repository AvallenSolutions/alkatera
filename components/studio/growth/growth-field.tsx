'use client';

/**
 * The growth field: a living forest behind the desk and the room landings.
 *
 * The org's data completeness (0..100, /api/growth) decides how much of the
 * seeded population has emerged: bare paper and pioneer grasses for a new
 * org, meadow and cover-crop flowers as data arrives, then shrubs, the
 * mid-storey, the foreground giants, and at last the distant canopy band
 * closing the horizon. Deterministic per org (seeded by org id): plants
 * add, they never reshuffle.
 *
 * Alive four ways, all stilled under prefers-reduced-motion:
 * - it GROWS: on arrival the field replays from the score you last saw
 *   (replayFrom) to today's, 900ms per plant on the studio ease, staggered
 *   by emergence so succession reads in order;
 * - it SWAYS: grass and fern tips lean a fraction of a degree over long
 *   cycles;
 * - it BREATHES with the scroll: the depth layers drift at slightly
 *   different rates (the distant canopy slowest), selling the depth;
 * - it is LIVED IN: Rosa the goldendoodle from the first growth, bees with
 *   the flowers, butterflies over the meadow, a bird when the woodland
 *   closes.
 *
 * The seasons dress the same population through the year (see season.ts).
 *
 * The layer is decoration with meaning but never chrome: fixed, behind
 * content (z-0, content sits at z-[1]), pointer-events-none, aria-hidden.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { STUDIO, STUDIO_EASE } from '@/components/studio/theme';
import { smoothstep } from './prng';
import {
  FIELD_H,
  FIELD_W,
  GROUND_Y,
  growthAt,
  makePopulation,
  type LayerKey,
  type PlantSlot,
} from './layout';
import { dressForSeason, seasonForDate, type Season } from './season';
import type { Creature } from './species/creatures';
import type { Prim } from './species/shared';

interface GrowthFieldProps {
  /** Data completeness, 0..100. */
  score: number;
  /** Stable seed: the org id. Same seed, same forest, always. */
  seed: string;
  /** The score last seen on this device: the replay starts here. */
  replayFrom?: number;
  /** Override the calendar (dev tooling); defaults to today's season. */
  season?: Season;
  className?: string;
}

/** How far each depth layer drifts with the scroll, in field units. */
const PARALLAX: Partial<Record<LayerKey | 'band', number>> = {
  band: 0.05,
  midTree: 0.03,
  foreTree: 0.015,
};

const MOTION_CLASS: Record<NonNullable<Creature['motion']>, string> = {
  amble: 'growth-amble',
  hover: 'growth-hover',
  flutter: 'growth-flutter',
  glide: 'growth-glide',
};

function prim(p: Prim, key: number) {
  switch (p.kind) {
    case 'path':
      return (
        <path
          key={key}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill={p.fill ?? 'none'}
          opacity={p.opacity}
          strokeLinecap="round"
        />
      );
    case 'circle':
      return (
        <circle
          key={key}
          cx={p.cx}
          cy={p.cy}
          r={p.r}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          opacity={p.opacity}
        />
      );
    case 'ellipse':
      return (
        <ellipse
          key={key}
          cx={p.cx}
          cy={p.cy}
          rx={p.rx}
          ry={p.ry}
          fill={p.fill}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          opacity={p.opacity}
        />
      );
  }
}

function seasonalPrims(
  prims: Prim[],
  season: Season,
  layer: LayerKey | 'band' | 'creature',
): JSX.Element[] {
  const out: JSX.Element[] = [];
  prims.forEach((p, i) => {
    const dressed = dressForSeason(p, season, layer);
    if (dressed) out.push(prim(dressed, i));
  });
  return out;
}

function Plant({
  slot,
  score,
  season,
  still,
}: {
  slot: PlantSlot;
  score: number;
  season: Season;
  still: boolean;
}) {
  const body = useMemo(() => seasonalPrims(slot.prims, season, slot.layer), [slot, season]);
  const g = growthAt(slot.emergence, score);
  if (g === 0 && still) return null; // nothing to animate towards; skip the node
  if (body.length === 0) return null; // the season hid it (flowers in winter)
  const sx = (slot.flip ? -1 : 1) * slot.scale * g;
  const sy = slot.scale * g;
  return (
    <g
      style={{
        transform: `translate(${slot.x}px, ${GROUND_Y}px) scale(${sx}, ${sy})`,
        transition: still ? undefined : `transform 900ms ${STUDIO_EASE}`,
        transitionDelay: still ? undefined : `${Math.round(slot.emergence * 6)}ms`,
      }}
    >
      {slot.sway && !still ? (
        <g
          className="growth-sway"
          style={{
            animationDuration: `${slot.sway.duration}s`,
            animationDelay: `-${slot.sway.delay}s`,
          }}
        >
          {body}
        </g>
      ) : (
        body
      )}
    </g>
  );
}

function Resident({
  creature,
  score,
  season,
  still,
}: {
  creature: Creature;
  score: number;
  season: Season;
  still: boolean;
}) {
  // Residents arrive whole (no stretched dogs): they fade and settle.
  const g = smoothstep(creature.emergence, creature.emergence + 4, score);
  if (g === 0) return null;
  // The pollinators sleep outside the flowering seasons; Rosa and the
  // bird are out in all weathers.
  if ((creature.kind === 'bee' || creature.kind === 'butterfly') && (season === 'winter' || season === 'autumn')) {
    return null;
  }
  const s = creature.scale * (creature.flip ? -1 : 1);
  return (
    <g
      style={{
        transform: `translate(${creature.x}px, ${creature.y}px) scale(${s}, ${creature.scale})`,
        opacity: g,
        transition: still ? undefined : `opacity 900ms ${STUDIO_EASE}`,
      }}
    >
      {creature.motion && !still ? (
        <g
          className={MOTION_CLASS[creature.motion]}
          style={{ animationDuration: `${creature.motionDuration}s` }}
        >
          {seasonalPrims(creature.prims, season, 'creature')}
        </g>
      ) : (
        seasonalPrims(creature.prims, season, 'creature')
      )}
    </g>
  );
}

export function GrowthField({ score, seed, replayFrom, season, className }: GrowthFieldProps) {
  const population = useMemo(() => makePopulation(seed), [seed]);
  const liveSeason = season ?? seasonForDate(new Date());
  const [still, setStill] = useState(false);
  // The replay: open on the score you last saw, then grow to today's.
  const start = Math.min(Math.max(0, replayFrom ?? 0), score);
  const [displayScore, setDisplayScore] = useState(start);
  const rootRef = useRef<HTMLDivElement>(null);
  const [scrollDrift, setScrollDrift] = useState(0);

  useEffect(() => {
    const stillQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setStill(stillQuery.matches);
    update();
    stillQuery.addEventListener('change', update);
    return () => stillQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setDisplayScore(score));
    return () => cancelAnimationFrame(raf);
  }, [score]);

  // The parallax: listen to the app's scroll container, drift the depth
  // layers. rAF-throttled; does nothing under reduced motion.
  useEffect(() => {
    const scroller = rootRef.current?.closest('main');
    if (!scroller) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScrollDrift(Math.min(70, scroller.scrollTop * 0.08));
      });
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const shown = still ? score : displayScore;
  const bandGrowth = smoothstep(70, 98, shown);
  const groundOpacity = smoothstep(0, 10, shown) * 0.6;
  const drift = still ? 0 : scrollDrift;

  const byLayer = useMemo(() => {
    const groups = new Map<LayerKey, PlantSlot[]>();
    for (const slot of population.slots) {
      const list = groups.get(slot.layer) ?? [];
      list.push(slot);
      groups.set(slot.layer, list);
    }
    return groups;
  }, [population]);

  // Depth order, farthest first; parallax drifts the deep layers.
  const layerOrder: LayerKey[] = ['midTree', 'foreTree', 'understory', 'grass', 'flower'];

  return (
    <div
      ref={rootRef}
      aria-hidden
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-12 z-0 h-[45vh] md:h-[70vh]',
        className,
      )}
      style={{
        // The mist: the canopy dissolves into the paper as it climbs, so
        // the ground stays rich while text higher up always reads clean.
        maskImage: 'linear-gradient(to top, black 38%, rgba(0,0,0,0.45) 62%, transparent 82%)',
        WebkitMaskImage:
          'linear-gradient(to top, black 38%, rgba(0,0,0,0.45) 62%, transparent 82%)',
      }}
    >
      <svg
        className="h-full w-full"
        viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
        preserveAspectRatio="xMidYMax slice"
      >
        {/* The distant canopy: closes the horizon as the org nears 100. */}
        <g
          style={{
            transform: `translate(0px, ${GROUND_Y - drift * (PARALLAX.band ?? 0) * 20}px) scale(1, ${bandGrowth})`,
            opacity: bandGrowth,
            transition: still
              ? undefined
              : `transform 900ms ${STUDIO_EASE}, opacity 900ms ${STUDIO_EASE}`,
          }}
        >
          {seasonalPrims([population.band], liveSeason, 'band')}
        </g>

        {/* The ground line arrives with the first growth. */}
        <line
          x1={0}
          y1={GROUND_Y}
          x2={FIELD_W}
          y2={GROUND_Y}
          stroke={STUDIO.hairline}
          strokeWidth={1}
          style={{
            opacity: groundOpacity,
            transition: still ? undefined : `opacity 900ms ${STUDIO_EASE}`,
          }}
        />

        {layerOrder.map((layer) => (
          <g
            key={layer}
            style={{
              transform: `translateY(${-drift * (PARALLAX[layer] ?? 0) * 20}px)`,
            }}
          >
            {(byLayer.get(layer) ?? []).map((slot) => (
              <Plant key={slot.id} slot={slot} score={shown} season={liveSeason} still={still} />
            ))}
          </g>
        ))}

        {/* The residents live in front of the meadow. */}
        <g>
          {population.creatures.map((creature) => (
            <Resident
              key={creature.id}
              creature={creature}
              score={shown}
              season={liveSeason}
              still={still}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
