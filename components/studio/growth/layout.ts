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
import { GRASSES } from './species/grasses';
import { FLOWERS } from './species/flowers';
import { UNDERSTORY } from './species/understory';
import { canopyBand, FORE_PALETTE, MID_PALETTE, TREES } from './species/trees';
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

function buildPrims(layer: LayerKey, speciesIndex: number, rng: Rng): Prim[] {
  switch (layer) {
    case 'grass':
      return GRASSES[speciesIndex % GRASSES.length](rng);
    case 'flower':
      return FLOWERS[speciesIndex % FLOWERS.length](rng);
    case 'understory':
      return UNDERSTORY[speciesIndex % UNDERSTORY.length](rng);
    case 'midTree':
      return TREES[speciesIndex % TREES.length](rng, MID_PALETTE);
    case 'foreTree':
      return TREES[speciesIndex % TREES.length](rng, FORE_PALETTE);
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

  const band = canopyBand(rngFromString(`${seed}:band`), FIELD_W, 380);
  const creatures = makeCreatures(rngFromString(`${seed}:creatures`), FIELD_W, GROUND_Y);
  return { slots, band, creatures };
}
