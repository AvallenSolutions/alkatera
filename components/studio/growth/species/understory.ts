/**
 * The understory: ferns and shrubs that fill the middle distance once
 * the woodland is establishing.
 */

import { GROWTH_PALETTE as G } from '../../theme';
import { between, intBetween, type Rng } from '../../growth/prng';
import { blob, round1, type Prim, type SpeciesBuilder } from './shared';

/** A fern: arcing fronds with leaflet ticks along each. */
export const fern: SpeciesBuilder = (rng) => {
  const prims: Prim[] = [];
  const fronds = intBetween(rng, 3, 5);
  for (let i = 0; i < fronds; i++) {
    const dir = i % 2 === 0 ? -1 : 1;
    const len = between(rng, 16, 28);
    const tipX = round1(dir * len * between(rng, 0.6, 0.9));
    const tipY = round1(-len * between(rng, 0.5, 0.8));
    const ctrlX = round1(dir * len * 0.2);
    const ctrlY = round1(-len * 0.8);
    prims.push({
      kind: 'path',
      d: `M0,0 Q${ctrlX},${ctrlY} ${tipX},${tipY}`,
      stroke: G.fern,
      strokeWidth: 1.3,
      fill: 'none',
      opacity: 0.7,
    });
    // leaflet ticks along the frond
    for (let t = 1; t <= 3; t++) {
      const f = t / 4;
      // point along the quadratic
      const qx = (1 - f) * (1 - f) * 0 + 2 * (1 - f) * f * ctrlX + f * f * tipX;
      const qy = (1 - f) * (1 - f) * 0 + 2 * (1 - f) * f * ctrlY + f * f * tipY;
      prims.push({
        kind: 'path',
        d: `M${round1(qx)},${round1(qy)} l${round1(dir * 3.5)},${round1(-2 + rng() * 1.5)}`,
        stroke: G.fern,
        strokeWidth: 1,
        fill: 'none',
        opacity: 0.55,
      });
    }
  }
  return prims;
};

/** A shrub: one or two soft blobs hugging the ground. */
export const shrub: SpeciesBuilder = (rng) => {
  const w = between(rng, 16, 26);
  const h = between(rng, 14, 24);
  const prims: Prim[] = [
    {
      kind: 'path',
      d: blob(rng, 0, -h * 0.5, w, h * 0.55, 7, 0.2),
      fill: G.canopyFore,
      opacity: 0.55,
    },
  ];
  if (rng() > 0.4) {
    prims.push({
      kind: 'path',
      d: blob(rng, between(rng, -w * 0.5, w * 0.5), -h * 0.4, w * 0.5, h * 0.4, 6),
      fill: G.canopyMid,
      opacity: 0.5,
    });
  }
  return prims;
};

/** Bramble: a low arc or two escaping the shrub line. */
export const bramble: SpeciesBuilder = (rng) => {
  const prims: Prim[] = [];
  const arcs = intBetween(rng, 2, 3);
  for (let i = 0; i < arcs; i++) {
    const dir = rng() > 0.5 ? 1 : -1;
    const reach = between(rng, 14, 26);
    prims.push({
      kind: 'path',
      d: `M0,0 Q${round1(dir * reach * 0.4)},${round1(-between(rng, 10, 16))} ${round1(dir * reach)},${round1(-between(rng, 1, 5))}`,
      stroke: G.fern,
      strokeWidth: 1.2,
      fill: 'none',
      opacity: 0.6,
    });
  }
  return prims;
};

export const UNDERSTORY: readonly SpeciesBuilder[] = [fern, shrub, bramble];
