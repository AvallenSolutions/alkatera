/**
 * The forest's residents.
 *
 * Rosa, a blonde miniature goldendoodle, is there from the first blades
 * of grass; she is the platform's assistant made flesh and she never
 * leaves. The bees arrive with the flowers (40+), a butterfly once the
 * meadow is established (60+), and a bird crosses the sky when the
 * woodland closes (90+). All drawn from the same seeded stream, all
 * dependency-free prims; motion is applied by the growth field with CSS
 * and stilled under prefers-reduced-motion.
 */

import { GROWTH_PALETTE as G, STUDIO } from '../../theme';
import { between, type Rng } from '../prng';
import { blob, round1, type Prim } from './shared';

export interface Creature {
  id: string;
  kind: 'rosa' | 'bee' | 'butterfly' | 'bird';
  /** Score at which the resident arrives. */
  emergence: number;
  x: number;
  y: number;
  scale: number;
  flip: boolean;
  prims: Prim[];
  /** CSS animation class applied by the growth field (motion-gated). */
  motion?: 'amble' | 'hover' | 'flutter' | 'glide';
  motionDuration?: number;
}

/**
 * Rosa herself, side-on, facing left, root at her paws. Fluffy blobs for
 * the coat, a floppy ear, a plume of a tail held high, an ink nose and
 * eye, and a brick collar (the one saturated touch she is allowed).
 * Roughly 46 units tall before scaling: miniature, as she should be.
 */
export function rosaTheDog(rng: Rng): Prim[] {
  const coat = G.rosaCoat;
  const shade = G.rosaShade;
  const prims: Prim[] = [
    // legs first, behind the body fluff
    { kind: 'path', d: 'M-13,-16 L-14,0', stroke: shade, strokeWidth: 4, fill: 'none', opacity: 0.95 },
    { kind: 'path', d: 'M-5,-15 L-5,0', stroke: coat, strokeWidth: 4, fill: 'none', opacity: 0.95 },
    { kind: 'path', d: 'M6,-15 L6,0', stroke: coat, strokeWidth: 4, fill: 'none', opacity: 0.95 },
    { kind: 'path', d: 'M13,-16 L15,0', stroke: shade, strokeWidth: 4, fill: 'none', opacity: 0.95 },
    // the body: two overlapping fluff blobs
    { kind: 'path', d: blob(rng, 0, -24, 19, 12, 8, 0.12), fill: coat, opacity: 1 },
    { kind: 'path', d: blob(rng, 8, -22, 12, 10, 7, 0.14), fill: shade, opacity: 0.55 },
    // the tail: a proud plume
    { kind: 'path', d: 'M17,-30 Q26,-42 22,-50', stroke: coat, strokeWidth: 5, fill: 'none', opacity: 1 },
    { kind: 'path', d: 'M18,-32 Q25,-42 22,-48', stroke: shade, strokeWidth: 2, fill: 'none', opacity: 0.5 },
    // the head: fluffy round, with a topknot
    { kind: 'path', d: blob(rng, -18, -38, 10, 9.5, 8, 0.1), fill: coat, opacity: 1 },
    { kind: 'path', d: blob(rng, -16, -46, 5, 3.5, 6, 0.15), fill: coat, opacity: 0.95 },
    // the floppy ear
    { kind: 'ellipse', cx: -11, cy: -35, rx: 4.5, ry: 8, fill: shade, opacity: 0.9 },
    // the muzzle, nose and eye
    { kind: 'ellipse', cx: -26.5, cy: -35.5, rx: 5, ry: 4, fill: coat, opacity: 1 },
    { kind: 'circle', cx: -30.5, cy: -36, r: 1.7, fill: STUDIO.ink, opacity: 0.85 },
    { kind: 'circle', cx: -21.5, cy: -40.5, r: 1.3, fill: STUDIO.ink, opacity: 0.8 },
    // the collar: one thin line of brick
    { kind: 'path', d: 'M-13,-31.5 Q-9,-29 -6,-30.5', stroke: STUDIO.brick, strokeWidth: 1.8, fill: 'none', opacity: 0.9 },
  ];
  return prims;
}

/** A bee: a dot of ochre ink with a wing fleck. */
function bee(): Prim[] {
  return [
    { kind: 'ellipse', cx: 0, cy: 0, rx: 2.4, ry: 1.7, fill: G.bee, opacity: 0.9 },
    { kind: 'path', d: 'M-0.6,0 L0.8,0', stroke: STUDIO.ink, strokeWidth: 0.9, fill: 'none', opacity: 0.6 },
    { kind: 'ellipse', cx: -0.4, cy: -2, rx: 1.6, ry: 0.9, fill: STUDIO.cream, opacity: 0.8 },
  ];
}

/** A butterfly: two campion-pink wings around a thin body. */
function butterfly(): Prim[] {
  return [
    { kind: 'ellipse', cx: -3, cy: -1, rx: 3.4, ry: 2.4, fill: G.butterfly, opacity: 0.85 },
    { kind: 'ellipse', cx: 3, cy: -1, rx: 3.4, ry: 2.4, fill: G.butterfly, opacity: 0.7 },
    { kind: 'ellipse', cx: -3.4, cy: 1.6, rx: 2.2, ry: 1.5, fill: G.butterfly, opacity: 0.6 },
    { kind: 'ellipse', cx: 3.4, cy: 1.6, rx: 2.2, ry: 1.5, fill: G.butterfly, opacity: 0.5 },
    { kind: 'path', d: 'M0,-3 L0,3', stroke: STUDIO.ink, strokeWidth: 0.9, fill: 'none', opacity: 0.6 },
  ];
}

/** A distant bird: the two-arc glyph every field notebook uses. */
function bird(): Prim[] {
  return [
    { kind: 'path', d: 'M-6,0 Q-3,-4 0,0 Q3,-4 6,0', stroke: G.bird, strokeWidth: 1.4, fill: 'none', opacity: 0.8 },
  ];
}

/** The residents, seeded and placed. Ground creatures root at GROUND_Y. */
export function makeCreatures(rng: Rng, fieldW: number, groundY: number): Creature[] {
  const creatures: Creature[] = [];

  // Rosa: with you from the very first growth, somewhere in the meadow.
  creatures.push({
    id: 'rosa',
    kind: 'rosa',
    emergence: 4,
    x: Math.round(between(rng, fieldW * 0.15, fieldW * 0.85)),
    y: groundY,
    scale: between(rng, 0.95, 1.1),
    flip: rng() > 0.5,
    prims: rosaTheDog(rng),
    motion: 'amble',
    motionDuration: between(rng, 80, 110),
  });

  // Bees, once there are flowers to visit.
  const bees = 3;
  for (let i = 0; i < bees; i++) {
    creatures.push({
      id: `bee-${i}`,
      kind: 'bee',
      emergence: 40 + i * 6,
      x: Math.round(between(rng, fieldW * 0.08, fieldW * 0.92)),
      y: groundY - between(rng, 26, 52),
      scale: between(rng, 0.9, 1.2),
      flip: rng() > 0.5,
      prims: bee(),
      motion: 'hover',
      motionDuration: between(rng, 5, 8),
    });
  }

  // A pair of butterflies over the established meadow.
  for (let i = 0; i < 2; i++) {
    creatures.push({
      id: `butterfly-${i}`,
      kind: 'butterfly',
      emergence: 60 + i * 10,
      x: Math.round(between(rng, fieldW * 0.1, fieldW * 0.9)),
      y: groundY - between(rng, 60, 110),
      scale: between(rng, 0.9, 1.3),
      flip: rng() > 0.5,
      prims: butterfly(),
      motion: 'flutter',
      motionDuration: between(rng, 34, 46),
    });
  }

  // One bird, high and occasional, when the woodland closes.
  creatures.push({
    id: 'bird',
    kind: 'bird',
    emergence: 90,
    x: 0, // the glide animation carries it across the whole field
    y: groundY - between(rng, 480, 620),
    scale: between(rng, 1.4, 2),
    flip: false,
    prims: bird(),
    motion: 'glide',
    motionDuration: between(rng, 75, 95),
  });

  return creatures;
}
