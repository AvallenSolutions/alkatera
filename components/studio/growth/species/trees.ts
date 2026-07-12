/**
 * The trees: ten British species, each a parameterised builder so no two
 * instances match. Builders take a depth palette (mid-storey trees are a
 * lighter, hazier green than the foreground) plus the seeded rng; every
 * canopy is an organic blob, never a stamped clip-art shape.
 *
 * Heights are in field units; the foreground giants reach ~200 of the
 * field's 260, the mid-storey ~140 before layout scaling.
 */

import { GROWTH_PALETTE as G } from '../../theme';
import { between, intBetween, type Rng } from '../../growth/prng';
import { blob, round1, type Prim } from './shared';

export interface TreePalette {
  canopy: string;
  canopyLight: string;
  trunk: string;
  opacity: number;
}

export const MID_PALETTE: TreePalette = {
  canopy: G.canopyMid,
  canopyLight: G.canopyMidLight,
  trunk: G.canopyMid,
  opacity: 0.8,
};

export const FORE_PALETTE: TreePalette = {
  canopy: G.canopyDeep,
  canopyLight: G.canopyFore,
  trunk: G.bark,
  opacity: 0.95,
};

export type TreeBuilder = (rng: Rng, p: TreePalette) => Prim[];

function trunk(
  rng: Rng,
  height: number,
  width: number,
  colour: string,
  opacity: number,
  lean = 0,
): Prim {
  const l = lean || between(rng, -4, 4);
  return {
    kind: 'path',
    d: `M0,0 Q${round1(l * 0.4)},${round1(-height * 0.5)} ${round1(l)},${round1(-height)}`,
    stroke: colour,
    strokeWidth: width,
    fill: 'none',
    opacity,
  };
}

function branch(rng: Rng, fromY: number, dir: number, len: number, colour: string, opacity: number): Prim {
  return {
    kind: 'path',
    d: `M0,${round1(fromY)} Q${round1(dir * len * 0.5)},${round1(fromY - len * 0.4)} ${round1(
      dir * len,
    )},${round1(fromY - len * 0.6)}`,
    stroke: colour,
    strokeWidth: 1.6,
    fill: 'none',
    opacity,
  };
}

/** A cluster of overlapping canopy blobs with one light highlight.
 *  Tagged 'canopy' so the seasons can turn the deciduous leaf mass. */
function canopy(
  rng: Rng,
  cx: number,
  cy: number,
  spread: number,
  depth: number,
  p: TreePalette,
  blobs = 3,
): Prim[] {
  const prims: Prim[] = [];
  for (let i = 0; i < blobs; i++) {
    const ox = between(rng, -spread * 0.5, spread * 0.5);
    const oy = between(rng, -depth * 0.4, depth * 0.35);
    prims.push({
      kind: 'path',
      d: blob(rng, cx + ox, cy + oy, spread * between(rng, 0.55, 0.8), depth * between(rng, 0.5, 0.75), intBetween(rng, 6, 8)),
      fill: p.canopy,
      opacity: p.opacity * between(rng, 0.85, 1),
      tag: 'canopy',
    });
  }
  prims.push({
    kind: 'path',
    d: blob(rng, cx - spread * 0.25, cy - depth * 0.3, spread * 0.42, depth * 0.35, 6),
    fill: p.canopyLight,
    opacity: p.opacity * 0.8,
    tag: 'canopy',
  });
  return prims;
}

/** Oak: broad, lumpy, low-shouldered; the widest crown of the ten. */
export const oak: TreeBuilder = (rng, p) => {
  const h = between(rng, 120, 160);
  return [
    trunk(rng, h * 0.55, between(rng, 4, 5.5), p.trunk, p.opacity),
    branch(rng, -h * 0.4, -1, between(rng, 18, 28), p.trunk, p.opacity * 0.8),
    branch(rng, -h * 0.48, 1, between(rng, 16, 26), p.trunk, p.opacity * 0.8),
    ...canopy(rng, 0, -h * 0.72, between(rng, 52, 68), between(rng, 34, 44), p, 4),
  ];
};

/** Beech: a tall, clean dome. */
export const beech: TreeBuilder = (rng, p) => {
  const h = between(rng, 140, 180);
  return [
    trunk(rng, h * 0.5, between(rng, 3.5, 4.5), p.trunk, p.opacity),
    ...canopy(rng, 0, -h * 0.72, between(rng, 40, 52), between(rng, 42, 54), p, 3),
  ];
};

/** Birch: slender pale trunk, airy little crown, bark ticks. */
export const birch: TreeBuilder = (rng, p) => {
  const h = between(rng, 120, 150);
  const prims: Prim[] = [
    trunk(rng, h * 0.72, between(rng, 2, 2.6), G.barkPale, Math.min(1, p.opacity + 0.05)),
  ];
  for (let i = 0; i < 3; i++) {
    const y = round1(-h * between(rng, 0.15, 0.6));
    prims.push({
      kind: 'path',
      d: `M-1.5,${y} l3,0`,
      stroke: G.bark,
      strokeWidth: 1,
      fill: 'none',
      opacity: p.opacity * 0.5,
    });
  }
  prims.push(...canopy(rng, 0, -h * 0.85, between(rng, 26, 34), between(rng, 22, 30), p, 3));
  return prims;
};

/** Rowan: slim, oval crown, a scatter of berries. */
export const rowan: TreeBuilder = (rng, p) => {
  const h = between(rng, 100, 130);
  const prims: Prim[] = [
    trunk(rng, h * 0.55, between(rng, 2.6, 3.4), p.trunk, p.opacity),
    ...canopy(rng, 0, -h * 0.75, between(rng, 24, 32), between(rng, 32, 42), p, 3),
  ];
  for (let i = 0; i < intBetween(rng, 3, 5); i++) {
    prims.push({
      kind: 'circle',
      cx: round1(between(rng, -18, 18)),
      cy: round1(-h * between(rng, 0.62, 0.85)),
      r: 1.4,
      fill: G.berry,
      opacity: p.opacity * 0.85,
    });
  }
  return prims;
};

/** Hawthorn: short, scrubby, wider than tall, wind-leant. */
export const hawthorn: TreeBuilder = (rng, p) => {
  const h = between(rng, 60, 85);
  const lean = between(rng, 4, 10) * (rng() > 0.5 ? 1 : -1);
  return [
    trunk(rng, h * 0.45, between(rng, 2.6, 3.4), p.trunk, p.opacity, lean * 0.4),
    ...canopy(rng, lean * 0.5, -h * 0.65, between(rng, 36, 46), between(rng, 22, 28), p, 4),
  ];
};

/** Scots pine: bare trunk, flat canopy plates near the top. Evergreen:
 *  it holds its green all year and collects snow along each plate. */
export const scotsPine: TreeBuilder = (rng, p) => {
  const h = between(rng, 150, 195);
  const prims: Prim[] = [trunk(rng, h * 0.8, between(rng, 3, 4), p.trunk, p.opacity)];
  const plates = intBetween(rng, 2, 3);
  for (let i = 0; i < plates; i++) {
    const y = -h * (0.72 + i * 0.11);
    const spread = between(rng, 30, 42) * (1 - i * 0.22);
    const cx = between(rng, -6, 6);
    prims.push({
      kind: 'path',
      d: blob(rng, cx, y, spread, between(rng, 9, 13), 6, 0.28),
      fill: i === plates - 1 ? p.canopyLight : p.canopy,
      opacity: p.opacity,
    });
    prims.push({
      kind: 'ellipse',
      cx: round1(cx),
      cy: round1(y - between(rng, 7, 10)),
      rx: round1(spread * 0.85),
      ry: between(rng, 3, 4.5),
      fill: G.snow,
      opacity: 0.85,
      tag: 'snowcap',
    });
  }
  return prims;
};

/** Field maple: compact and round. */
export const fieldMaple: TreeBuilder = (rng, p) => {
  const h = between(rng, 95, 120);
  return [
    trunk(rng, h * 0.5, between(rng, 3, 3.8), p.trunk, p.opacity),
    ...canopy(rng, 0, -h * 0.7, between(rng, 34, 42), between(rng, 30, 38), p, 3),
  ];
};

/** Willow: a crown that weeps in streamers. */
export const willow: TreeBuilder = (rng, p) => {
  const h = between(rng, 100, 135);
  const prims: Prim[] = [
    trunk(rng, h * 0.55, between(rng, 3.4, 4.2), p.trunk, p.opacity),
    ...canopy(rng, 0, -h * 0.75, between(rng, 36, 46), between(rng, 26, 34), p, 3),
  ];
  const streamers = intBetween(rng, 4, 6);
  for (let i = 0; i < streamers; i++) {
    const sx = round1(between(rng, -34, 34));
    const sy = round1(-h * between(rng, 0.6, 0.75));
    const drop = between(rng, 24, 40);
    prims.push({
      kind: 'path',
      d: `M${sx},${sy} Q${round1(sx + between(rng, -4, 4))},${round1(sy + drop * 0.5)} ${round1(
        sx + between(rng, -8, 8),
      )},${round1(sy + drop)}`,
      stroke: p.canopyLight,
      strokeWidth: 1.3,
      fill: 'none',
      opacity: p.opacity * 0.75,
      tag: 'canopy',
    });
  }
  return prims;
};

/** Holly: small, dense, conical. Evergreen: green all year, and it
 *  collects a crown of snow in winter. */
export const holly: TreeBuilder = (rng, p) => {
  const h = between(rng, 55, 75);
  return [
    trunk(rng, h * 0.3, between(rng, 2.2, 2.8), p.trunk, p.opacity),
    {
      kind: 'path',
      d: blob(rng, 0, -h * 0.55, between(rng, 16, 22), between(rng, 30, 40), 7, 0.16),
      fill: p.canopy,
      opacity: Math.min(1, p.opacity + 0.05),
    },
    {
      kind: 'path',
      d: blob(rng, -4, -h * 0.68, 9, 13, 6),
      fill: p.canopyLight,
      opacity: p.opacity * 0.7,
    },
    {
      kind: 'ellipse',
      cx: 0,
      cy: round1(-h * 0.88),
      rx: between(rng, 10, 14),
      ry: between(rng, 3, 4.5),
      fill: G.snow,
      opacity: 0.85,
      tag: 'snowcap',
    },
  ];
};

/** Ash: tall, open, upswept limbs with loose leaf lobes. */
export const ash: TreeBuilder = (rng, p) => {
  const h = between(rng, 140, 175);
  const prims: Prim[] = [trunk(rng, h * 0.6, between(rng, 3.2, 4), p.trunk, p.opacity)];
  const limbs = intBetween(rng, 2, 3);
  for (let i = 0; i < limbs; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    const fromY = -h * (0.42 + i * 0.1);
    prims.push(branch(rng, fromY, dir, between(rng, 20, 30), p.trunk, p.opacity * 0.85));
    prims.push({
      kind: 'path',
      d: blob(rng, dir * between(rng, 18, 28), fromY - between(rng, 26, 34), between(rng, 20, 28), between(rng, 16, 22), 6),
      fill: p.canopy,
      opacity: p.opacity * 0.9,
      tag: 'canopy',
    });
  }
  prims.push({
    kind: 'path',
    d: blob(rng, 0, -h * 0.85, between(rng, 26, 34), between(rng, 18, 24), 6),
    fill: p.canopyLight,
    opacity: p.opacity * 0.85,
    tag: 'canopy',
  });
  return prims;
};

export const TREES: readonly TreeBuilder[] = [
  oak,
  beech,
  birch,
  rowan,
  hawthorn,
  scotsPine,
  fieldMaple,
  willow,
  holly,
  ash,
];

/**
 * The planting mix the layout cycles through: every species reachable,
 * but the deciduous majority a British broadleaf wood actually has (the
 * two evergreens appear once each, the broadleaves twice), so winter
 * reads properly bare.
 */
export const TREE_MIX: readonly TreeBuilder[] = [
  oak,
  beech,
  birch,
  rowan,
  hawthorn,
  scotsPine,
  fieldMaple,
  willow,
  holly,
  ash,
  oak,
  beech,
  birch,
  rowan,
  hawthorn,
  fieldMaple,
  willow,
  ash,
];

/**
 * The distant canopy band: a bumpy tree-line across the whole field,
 * palest green, the last thing to arrive (it closes the horizon as the
 * org nears 100). Built at the ground line, rising to `height`.
 */
export function canopyBand(rng: Rng, width: number, height: number): Prim {
  const bumps = 14;
  const step = width / bumps;
  // 40 units of bleed below the ground line so the parallax drift never
  // opens a paper gap beneath the horizon.
  let d = `M0,40 L0,${round1(-height * between(rng, 0.5, 0.7))}`;
  for (let i = 0; i < bumps; i++) {
    const x = step * (i + 1);
    const peak = -height * between(rng, 0.55, 1);
    const dip = -height * between(rng, 0.35, 0.55);
    d += ` Q${round1(x - step * 0.5)},${round1(peak)} ${round1(x)},${round1(dip)}`;
  }
  d += ` L${round1(width)},40 Z`;
  return { kind: 'path', d, fill: G.canopyFar, opacity: 0.65, tag: 'canopy' };
}
