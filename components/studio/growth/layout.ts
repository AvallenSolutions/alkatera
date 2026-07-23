/**
 * The growth field's seeded population.
 *
 * One master rng (seeded by the org id) lays out every plant the org will
 * ever grow: where it stands, which species, how large, and the completeness
 * score at which it emerges. Each slot carries its own subseed so its shape
 * is stable regardless of render order. As the score rises, plants sprout
 * individually (smoothstep over ~15 points past their emergence threshold);
 * the scene adds, it never reshuffles.
 *
 * Emergence bands follow ecological succession: pioneer grasses first,
 * cover-crop flowers, then shrubs and ferns, the mid-storey, the foreground
 * giants, and finally the distant canopy band that closes the horizon.
 */

import { between, mulberry32, rngFromString, smoothstep, type Rng } from './prng';
import { GRASSES, tussock, shortTurf } from './species/grasses';
import { FLOWERS, clover, buttercup } from './species/flowers';
import { UNDERSTORY, shrub } from './species/understory';
import { canopyBand, FORE_PALETTE, MID_PALETTE, TREE_MIX } from './species/trees';
import { makeCreatures, type Creature } from './species/creatures';
import type { Prim } from './species/shared';

export const FIELD_W = 1600;
export const FIELD_H = 800;
export const GROUND_Y = 780;

/** How many points past emergence a plant takes to reach full stature. */
export const GROW_SPAN = 10;

/**
 * The whole field thickens continuously: every plant carries this global
 * maturity multiplier, so each single point of the score visibly enlarges
 * what has already grown as well as sprouting what is new.
 */
export function maturity(score: number): number {
  return 0.75 + 0.25 * (Math.min(100, Math.max(0, score)) / 100);
}

/** A plant's rendered growth 0..1 at a score: emergence, stature, maturity. */
export function growthAt(emergence: number, score: number): number {
  return smoothstep(emergence, emergence + GROW_SPAN, score) * maturity(score);
}

/**
 * The floor: how much a guaranteed first-growth plant (see makeFloorSlots
 * below) has grown at a score. Unlike growthAt's cold start from zero,
 * the floor jumps straight to FLOOR_MIN stature the instant the score
 * leaves zero — the endowed-progress moment, "your forest has started" —
 * then eases smoothly up to full local scale by FLOOR_SPAN, so a day-one
 * score (1-10) already reads as young growth, and a score of 30 reads as
 * visibly further along rather than merely "also present".
 */
const FLOOR_MIN = 0.45;
const FLOOR_SPAN = 28;

export function floorGrowthAt(score: number): number {
  if (score <= 0) return 0;
  const t = smoothstep(0, FLOOR_SPAN, score);
  return FLOOR_MIN + (1 - FLOOR_MIN) * t;
}

export type LayerKey = 'midTree' | 'foreTree' | 'understory' | 'grass' | 'flower';

export interface PlantSlot {
  id: string;
  layer: LayerKey;
  x: number;
  scale: number;
  flip: boolean;
  /** Score at which this plant starts to grow (full size ~15 points later). */
  emergence: number;
  /** Ready-built primitives, root at local (0,0). */
  prims: Prim[];
  /** Slow sway settings for the light layers; undefined = holds still. */
  sway?: { duration: number; delay: number };
  /**
   * A guaranteed first-growth slot (see makeFloorSlots): renders via
   * floorGrowthAt instead of growthAt, so it is visible the instant the
   * score leaves zero rather than emerging from nothing.
   */
  floor?: boolean;
}

export interface Population {
  slots: PlantSlot[];
  /** The distant tree-line, drawn behind everything; emerges 70..98. */
  band: Prim;
  /** The residents: Rosa, the bees, the butterflies, the bird. */
  creatures: Creature[];
}

interface LayerSpec {
  layer: LayerKey;
  count: number;
  emergence: [number, number];
  scale: [number, number];
  swayable: boolean;
}

/**
 * Depth order: farthest first. Emergence bands overlap and spread so that
 * virtually every single point of the score sprouts something new; the
 * whole field also thickens continuously via the maturity factor in
 * growth-field.tsx. Tree scales are sized to the 800-unit field: the
 * foreground giants reach ~500 units at full growth, so by 100 the
 * forest owns most of the background.
 */
const LAYERS: LayerSpec[] = [
  { layer: 'midTree', count: 18, emergence: [35, 85], scale: [1.3, 1.9], swayable: false },
  { layer: 'foreTree', count: 12, emergence: [50, 95], scale: [2.1, 3.0], swayable: false },
  { layer: 'understory', count: 24, emergence: [25, 70], scale: [1.1, 1.8], swayable: true },
  { layer: 'grass', count: 60, emergence: [1, 40], scale: [1.0, 1.8], swayable: true },
  { layer: 'flower', count: 40, emergence: [8, 60], scale: [1.0, 1.6], swayable: true },
];

/**
 * The floor: a small, fixed, seeded planting guaranteed at any score
 * above zero, so a brand-new org's very first data point already shows
 * visible growth ("your forest has started") instead of bare paper.
 * Deliberately separate from LAYERS above — a handful of young grass
 * tufts, a couple of wildflower seedlings, and one small sapling shrub,
 * spread across the width right at the ground line. Seeded off its own
 * `${seed}:floor` stream so adding or resizing it never reshuffles the
 * rest of the seeded population.
 */
const FLOOR_GRASS_COUNT = 5;
const FLOOR_FLOWER_COUNT = 3;

function makeFloorSlots(seed: string): PlantSlot[] {
  const rng = rngFromString(`${seed}:floor`);
  const slots: PlantSlot[] = [];

  // Grass tufts: short, dense species so they read as one continuous
  // fringe of new growth along the ground line.
  const grassSpecies = [tussock, shortTurf];
  for (let i = 0; i < FLOOR_GRASS_COUNT; i++) {
    const subseed = Math.floor(rng() * 4294967296);
    const cell = FIELD_W / FLOOR_GRASS_COUNT;
    slots.push({
      id: `floor-grass-${i}`,
      layer: 'grass',
      x: Math.round(cell * i + cell * between(rng, 0.2, 0.8)),
      scale: between(rng, 1.6, 2.1),
      flip: rng() > 0.5,
      emergence: 0,
      floor: true,
      prims: grassSpecies[i % grassSpecies.length](mulberry32(subseed)),
      sway: { duration: between(rng, 18, 30), delay: between(rng, 0, 8) },
    });
  }

  // Wildflower seedlings: the smallest, earliest-headed species, kept at
  // a modest scale so they read as sprouts rather than a full bloom.
  const flowerSpecies = [clover, buttercup];
  for (let i = 0; i < FLOOR_FLOWER_COUNT; i++) {
    const subseed = Math.floor(rng() * 4294967296);
    const cell = FIELD_W / FLOOR_FLOWER_COUNT;
    slots.push({
      id: `floor-flower-${i}`,
      layer: 'flower',
      x: Math.round(cell * i + cell * between(rng, 0.25, 0.75)),
      scale: between(rng, 1.1, 1.4),
      flip: rng() > 0.5,
      emergence: 0,
      floor: true,
      prims: flowerSpecies[i % flowerSpecies.length](mulberry32(subseed)),
      sway: { duration: between(rng, 18, 30), delay: between(rng, 0, 8) },
    });
  }

  // One small sapling: a shrub at a fraction of its full-grown scale,
  // set near the centre so it reads as a single deliberate planting.
  const saplingSeed = Math.floor(rng() * 4294967296);
  slots.push({
    id: 'floor-sapling-0',
    layer: 'understory',
    x: Math.round(FIELD_W * between(rng, 0.4, 0.6)),
    scale: between(rng, 0.5, 0.65),
    flip: rng() > 0.5,
    emergence: 0,
    floor: true,
    prims: shrub(mulberry32(saplingSeed)),
  });

  return slots;
}

function buildPrims(layer: LayerKey, speciesIndex: number, rng: Rng): Prim[] {
  switch (layer) {
    case 'grass':
      return GRASSES[speciesIndex % GRASSES.length](rng);
    case 'flower':
      return FLOWERS[speciesIndex % FLOWERS.length](rng);
    case 'understory':
      return UNDERSTORY[speciesIndex % UNDERSTORY.length](rng);
    case 'midTree':
      return TREE_MIX[speciesIndex % TREE_MIX.length](rng, MID_PALETTE);
    case 'foreTree':
      return TREE_MIX[speciesIndex % TREE_MIX.length](rng, FORE_PALETTE);
  }
}

export function makePopulation(seed: string): Population {
  const master = rngFromString(seed || 'alkatera');
  const slots: PlantSlot[] = [];

  for (const spec of LAYERS) {
    // Species offset per layer so orgs differ in which species lead,
    // while cycling guarantees the full variety is always reachable.
    const speciesOffset = Math.floor(master() * 97);
    for (let i = 0; i < spec.count; i++) {
      const subseed = Math.floor(master() * 4294967296);
      const rng = mulberry32(subseed);
      // Even spread with jitter: no bunching, no bare stretches.
      const cell = FIELD_W / spec.count;
      const x = Math.round(cell * i + cell * between(master, 0.15, 0.85));
      slots.push({
        id: `${spec.layer}-${i}`,
        layer: spec.layer,
        x,
        scale: between(master, spec.scale[0], spec.scale[1]),
        flip: master() > 0.5,
        emergence: between(master, spec.emergence[0], spec.emergence[1]),
        prims: buildPrims(spec.layer, speciesOffset + i, rng),
        sway: spec.swayable
          ? { duration: between(master, 18, 30), delay: between(master, 0, 8) }
          : undefined,
      });
    }
  }

  // The floor: appended after the seeded population above, from its own
  // rng stream, so it never shifts the layout or shapes of the LAYERS
  // plants — same seed, same forest, plus a guaranteed first growth.
  slots.push(...makeFloorSlots(seed));

  const band = canopyBand(rngFromString(`${seed}:band`), FIELD_W, 380);
  const creatures = makeCreatures(rngFromString(`${seed}:creatures`), FIELD_W, GROUND_Y);
  return { slots, band, creatures };
}
