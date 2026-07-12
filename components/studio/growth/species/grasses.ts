/**
 * The grasses: six species so the sward never repeats.
 *
 * All stroke-drawn from the root, heights in field units (the field is
 * 1600x260 with the ground at y=250; a tall meadow grass is ~45 units).
 * Colour alternates between the two grass greens for natural variation.
 */

import { GROWTH_PALETTE as G } from '../../theme';
import { between, intBetween, type Rng } from '../../growth/prng';
import { bladePath, round1, type Prim, type SpeciesBuilder } from './shared';

function blades(
  rng: Rng,
  count: number,
  hMin: number,
  hMax: number,
  colour: string,
  width: number,
  opacity: number,
): Prim[] {
  const prims: Prim[] = [];
  for (let i = 0; i < count; i++) {
    const lean = between(rng, -1, 1);
    prims.push({
      kind: 'path',
      d: bladePath(rng, between(rng, hMin, hMax), lean),
      stroke: colour,
      strokeWidth: width,
      fill: 'none',
      opacity,
    });
  }
  return prims;
}

/** Dense low clump, blades fanning every way. */
export const tussock: SpeciesBuilder = (rng) =>
  blades(rng, intBetween(rng, 5, 8), 12, 24, rng() > 0.5 ? G.grass : G.grassDim, 1.3, 0.75);

/** Tall meadow grass, few blades, long and arcing. */
export const tallMeadow: SpeciesBuilder = (rng) =>
  blades(rng, intBetween(rng, 3, 5), 30, 48, G.grass, 1.4, 0.7);

/** Short turf, barely up. */
export const shortTurf: SpeciesBuilder = (rng) =>
  blades(rng, intBetween(rng, 4, 6), 6, 14, rng() > 0.4 ? G.grassDim : G.grass, 1.1, 0.7);

/** Sedge: stiff, straight, upright fan. */
export const sedge: SpeciesBuilder = (rng) => {
  const prims: Prim[] = [];
  const count = intBetween(rng, 4, 6);
  for (let i = 0; i < count; i++) {
    const lean = (i / (count - 1) - 0.5) * 0.9;
    const h = between(rng, 20, 34);
    const tipX = round1(lean * h * 0.4);
    prims.push({
      kind: 'path',
      d: `M0,0 L${tipX},${round1(-h)}`,
      stroke: G.grass,
      strokeWidth: 1.3,
      fill: 'none',
      opacity: 0.7,
    });
  }
  return prims;
};

/** Seed head: one tall stem with a wheat-like tip and a couple of blades. */
export const seedHead: SpeciesBuilder = (rng) => {
  const h = between(rng, 34, 50);
  const lean = between(rng, -0.4, 0.4);
  const tipX = round1(lean * h * 0.3);
  const prims: Prim[] = [
    {
      kind: 'path',
      d: `M0,0 Q${round1(tipX * 0.4)},${round1(-h * 0.6)} ${tipX},${round1(-h)}`,
      stroke: G.grassDim,
      strokeWidth: 1.2,
      fill: 'none',
      opacity: 0.75,
    },
    {
      kind: 'ellipse',
      cx: tipX,
      cy: round1(-h - 3),
      rx: 2.2,
      ry: 5,
      fill: G.grassDim,
      opacity: 0.6,
    },
  ];
  return prims.concat(blades(rng, 2, 10, 18, G.grass, 1.2, 0.65));
};

/** Drooping grass: blades that curve right over at the tip. */
export const drooping: SpeciesBuilder = (rng) => {
  const prims: Prim[] = [];
  const count = intBetween(rng, 3, 5);
  for (let i = 0; i < count; i++) {
    const dir = rng() > 0.5 ? 1 : -1;
    const h = between(rng, 22, 36);
    const overX = round1(dir * between(rng, 12, 22));
    prims.push({
      kind: 'path',
      d: `M0,0 Q${round1(dir * 2)},${round1(-h)} ${overX},${round1(-h + between(rng, 4, 9))}`,
      stroke: G.grass,
      strokeWidth: 1.3,
      fill: 'none',
      opacity: 0.72,
    });
  }
  return prims;
};

export const GRASSES: readonly SpeciesBuilder[] = [
  tussock,
  tallMeadow,
  shortTurf,
  sedge,
  seedHead,
  drooping,
];
