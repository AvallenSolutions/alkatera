/**
 * Shared shapes for the growth field's species builders.
 *
 * Builders are plain functions from a seeded Rng to a list of SVG
 * primitives in local coordinates: the plant's root sits at (0,0) and it
 * grows upward into negative y. No React in the species files; the
 * growth-field component turns primitives into elements. Colours are
 * baked in by each builder from GROWTH_PALETTE so a scene is fully
 * described by its data.
 */

import { between, type Rng } from '../prng';

/** Marks a primitive the seasons repaint: deciduous leaf mass turns with
 *  the year; untagged prims (trunks, evergreens, flower heads) hold. */
export type SeasonTag = 'canopy';

export type Prim =
  | {
      kind: 'path';
      d: string;
      stroke?: string;
      strokeWidth?: number;
      fill?: string;
      opacity?: number;
      tag?: SeasonTag;
    }
  | {
      kind: 'circle';
      cx: number;
      cy: number;
      r: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      tag?: SeasonTag;
    }
  | {
      kind: 'ellipse';
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      opacity?: number;
      tag?: SeasonTag;
    };

export type SpeciesBuilder = (rng: Rng) => Prim[];

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * An organic closed blob: points around an ellipse, radius jittered, then
 * a smooth quadratic curve threaded through the midpoints. The workhorse
 * for every canopy and shrub.
 */
export function blob(
  rng: Rng,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  lobes = 7,
  jitter = 0.22,
): string {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const wobble = 1 + between(rng, -jitter, jitter);
    pts.push([cx + Math.cos(a) * rx * wobble, cy + Math.sin(a) * ry * wobble]);
  }
  const mid = (a: [number, number], b: [number, number]): [number, number] => [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
  ];
  let d = '';
  for (let i = 0; i < lobes; i++) {
    const p = pts[i];
    const next = pts[(i + 1) % lobes];
    const m = mid(p, next);
    if (i === 0) d = `M${r1(m[0])},${r1(m[1])}`;
    else d += ` Q${r1(p[0])},${r1(p[1])} ${r1(m[0])},${r1(m[1])}`;
  }
  const p0 = pts[0];
  const m0 = mid(pts[lobes - 1], p0);
  d += ` Q${r1(pts[lobes - 1][0])},${r1(pts[lobes - 1][1])} ${r1(m0[0])},${r1(m0[1])}`;
  d += ` Q${r1(p0[0])},${r1(p0[1])} `;
  // close back to the start midpoint
  const start = mid(p0, pts[1 % lobes]);
  d += `${r1(start[0])},${r1(start[1])} Z`;
  return d;
}

/** A single grass blade: quadratic curve from the root, leaning as it rises. */
export function bladePath(rng: Rng, height: number, lean: number): string {
  const tipX = lean * height * between(rng, 0.25, 0.45);
  const ctrlX = tipX * between(rng, 0.3, 0.55);
  return `M0,0 Q${r1(ctrlX)},${r1(-height * 0.6)} ${r1(tipX)},${r1(-height)}`;
}

/** A stem with a gentle bend; returns the path and where the tip landed
 *  so the builder can hang a flower head on it. */
export function stem(
  rng: Rng,
  height: number,
  sway = 4,
): { d: string; top: [number, number] } {
  const bendX = between(rng, -sway, sway);
  const topX = between(rng, -sway * 0.6, sway * 0.6);
  return {
    d: `M0,0 Q${r1(bendX)},${r1(-height * 0.55)} ${r1(topX)},${r1(-height)}`,
    top: [r1(topX), r1(-height)],
  };
}

export const round1 = r1;
