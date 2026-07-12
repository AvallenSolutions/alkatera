/**
 * The wildflowers: ten British meadow species, each its own builder so
 * the cover crop never repeats. Heads wear muted naturals from the
 * growth palette; stems stay forest.
 */

import { GROWTH_PALETTE as G } from '../../theme';
import { between, intBetween, type Rng } from '../../growth/prng';
import { round1, stem, type Prim, type SpeciesBuilder } from './shared';

const STEM_STROKE = { stroke: G.stem, strokeWidth: 1.2, fill: 'none', opacity: 0.6 } as const;

function stemPrim(rng: Rng, height: number): { prim: Prim; top: [number, number] } {
  const s = stem(rng, height);
  return { prim: { kind: 'path', d: s.d, ...STEM_STROKE }, top: s.top };
}

/** Ox-eye daisy: cream petal ring, ochre centre. */
export const oxeyeDaisy: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 26, 38));
  const [x, y] = top;
  const prims: Prim[] = [prim];
  const petals = 6;
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 + rng() * 0.4;
    prims.push({
      kind: 'ellipse',
      cx: round1(x + Math.cos(a) * 4),
      cy: round1(y - 3 + Math.sin(a) * 4),
      rx: 2.6,
      ry: 1.4,
      fill: G.daisy,
      opacity: 0.9,
    });
  }
  prims.push({ kind: 'circle', cx: x, cy: round1(y - 3), r: 1.8, fill: G.daisyCentre, opacity: 0.9 });
  return prims;
};

/** Poppy: nodding stem, two overlapping red petal discs, dark eye. */
export const poppy: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 24, 36));
  const [x, y] = top;
  return [
    prim,
    { kind: 'circle', cx: round1(x - 1.6), cy: round1(y - 3), r: 3.4, fill: G.poppy, opacity: 0.85 },
    { kind: 'circle', cx: round1(x + 1.8), cy: round1(y - 3.6), r: 3, fill: G.poppy, opacity: 0.75 },
    { kind: 'circle', cx: x, cy: round1(y - 3.4), r: 1, fill: G.bark, opacity: 0.7 },
  ];
};

/** Cornflower: blue fringed head. */
export const cornflower: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 24, 34));
  const [x, y] = top;
  const prims: Prim[] = [prim, { kind: 'circle', cx: x, cy: round1(y - 2.5), r: 2.4, fill: G.cornflower, opacity: 0.85 }];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + rng() * 0.2;
    prims.push({
      kind: 'path',
      d: `M${x},${round1(y - 2.5)} l${round1(Math.cos(a) * 4.5)},${round1(Math.sin(a) * 4.5)}`,
      stroke: G.cornflower,
      strokeWidth: 1.4,
      fill: 'none',
      opacity: 0.8,
    });
  }
  return prims;
};

/** Cow parsley: tall stem, spoked umbel of dim florets. */
export const cowParsley: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 34, 48));
  const [x, y] = top;
  const prims: Prim[] = [prim];
  const spokes = intBetween(rng, 4, 5);
  for (let i = 0; i < spokes; i++) {
    const a = -Math.PI / 2 + (i - (spokes - 1) / 2) * 0.5 + rng() * 0.15;
    const ex = round1(x + Math.cos(a) * between(rng, 7, 10));
    const ey = round1(y + Math.sin(a) * between(rng, 7, 10));
    prims.push({
      kind: 'path',
      d: `M${x},${y} L${ex},${ey}`,
      stroke: G.umbel,
      strokeWidth: 1,
      fill: 'none',
      opacity: 0.6,
    });
    prims.push({ kind: 'circle', cx: ex, cy: ey, r: 1.5, fill: G.daisy, opacity: 0.9 });
  }
  return prims;
};

/** Foxglove: a spike of bells climbing the stem. */
export const foxglove: SpeciesBuilder = (rng) => {
  const h = between(rng, 38, 54);
  const { prim } = stemPrim(rng, h);
  const prims: Prim[] = [prim];
  const bells = intBetween(rng, 5, 7);
  for (let i = 0; i < bells; i++) {
    const t = 0.45 + (i / bells) * 0.5;
    const side = i % 2 === 0 ? -1 : 1;
    prims.push({
      kind: 'ellipse',
      cx: round1(side * (2.5 + rng())),
      cy: round1(-h * t),
      rx: 2.4,
      ry: 1.6,
      fill: G.foxglove,
      opacity: 0.85 - i * 0.04,
    });
  }
  return prims;
};

/** Clover: short stem, round head, two leaflets. */
export const clover: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 12, 20));
  const [x, y] = top;
  return [
    prim,
    { kind: 'circle', cx: x, cy: round1(y - 2), r: 2.8, fill: G.clover, opacity: 0.85 },
    { kind: 'ellipse', cx: round1(x - 3), cy: round1(y + 5), rx: 2, ry: 1.2, fill: G.grass, opacity: 0.55 },
    { kind: 'ellipse', cx: round1(x + 3), cy: round1(y + 6), rx: 2, ry: 1.2, fill: G.grass, opacity: 0.55 },
  ];
};

/** Buttercup: thin stems, small ochre cups, often two heads. */
export const buttercup: SpeciesBuilder = (rng) => {
  const prims: Prim[] = [];
  const heads = intBetween(rng, 1, 2);
  for (let i = 0; i < heads; i++) {
    const { prim, top } = stemPrim(rng, between(rng, 16, 26));
    prims.push(prim);
    prims.push({
      kind: 'circle',
      cx: top[0],
      cy: round1(top[1] - 2),
      r: 2.2,
      fill: G.buttercup,
      opacity: 0.9,
    });
  }
  return prims;
};

/** Thistle: stiff stem, bulb, purple tuft on top. */
export const thistle: SpeciesBuilder = (rng) => {
  const h = between(rng, 26, 38);
  const prims: Prim[] = [
    { kind: 'path', d: `M0,0 L0,${round1(-h)}`, stroke: G.stem, strokeWidth: 1.4, fill: 'none', opacity: 0.65 },
    { kind: 'ellipse', cx: 0, cy: round1(-h), rx: 2.2, ry: 2.8, fill: G.grassDim, opacity: 0.7 },
  ];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35;
    prims.push({
      kind: 'path',
      d: `M0,${round1(-h - 1)} l${round1(Math.cos(a) * 5)},${round1(Math.sin(a) * 5)}`,
      stroke: G.thistle,
      strokeWidth: 1.3,
      fill: 'none',
      opacity: 0.85,
    });
  }
  return prims;
};

/** Knapweed: like a thistle's rounder plum cousin. */
export const knapweed: SpeciesBuilder = (rng) => {
  const { prim, top } = stemPrim(rng, between(rng, 24, 36));
  const [x, y] = top;
  return [
    prim,
    { kind: 'circle', cx: x, cy: round1(y - 2.5), r: 3, fill: G.knapweed, opacity: 0.8 },
    { kind: 'circle', cx: x, cy: round1(y - 4), r: 1.6, fill: G.campion, opacity: 0.7 },
  ];
};

/** Campion: branching stem, two or three small pink heads. */
export const campion: SpeciesBuilder = (rng) => {
  const h = between(rng, 22, 32);
  const prims: Prim[] = [
    { kind: 'path', d: `M0,0 Q1,${round1(-h * 0.5)} 0,${round1(-h)}`, ...STEM_STROKE },
  ];
  const heads = intBetween(rng, 2, 3);
  for (let i = 0; i < heads; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const branchY = round1(-h * (0.6 + i * 0.15));
    const bx = round1(side * between(rng, 3, 6));
    prims.push({
      kind: 'path',
      d: `M0,${branchY} Q${round1(bx * 0.5)},${round1(branchY - 3)} ${bx},${round1(branchY - 6)}`,
      ...STEM_STROKE,
    });
    prims.push({ kind: 'circle', cx: bx, cy: round1(branchY - 7.5), r: 2, fill: G.campion, opacity: 0.85 });
  }
  return prims;
};

export const FLOWERS: readonly SpeciesBuilder[] = [
  oxeyeDaisy,
  poppy,
  cornflower,
  cowParsley,
  foxglove,
  clover,
  buttercup,
  thistle,
  knapweed,
  campion,
];
