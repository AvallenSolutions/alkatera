/**
 * The forest lives in real time: the same seeded population wears the
 * year's colours. Spring lightens the leaf, summer is the baseline,
 * autumn turns the deciduous canopy through the studio's ochres and
 * brick, winter bares it to a ghost (the holly and the Scots pine,
 * untagged, hold their green all year; grass fades to straw, the
 * flowers sleep).
 *
 * Season is a pure render-time transform of the primitives; the
 * population itself never changes, so determinism holds and a January
 * forest is the same forest as a July one, differently dressed.
 */

import { GROWTH_PALETTE as G, STUDIO } from '@/components/studio/theme';
import type { LayerKey } from './layout';
import type { Prim } from './species/shared';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export function seasonForDate(date: Date): Season {
  const m = date.getMonth(); // 0..11
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

/** Autumn turns each canopy blob differently; index keeps it deterministic. */
const AUTUMN_TURN = [STUDIO.ochre, G.autumnLeaf, STUDIO.brick, G.canopyFore, STUDIO.ochreInk];

/** Greens that fade to straw when the meadow winters. */
const MEADOW_GREENS = new Set<string>([G.grass, G.grassDim, G.fern, G.stem, G.canopyFore]);

const SPRING_LIGHTEN: Record<string, string> = {
  [G.canopyDeep]: G.canopyFore,
  [G.canopyMid]: G.canopyMidLight,
  [G.canopyFore]: '#4E9A6E',
  [G.canopyFar]: '#B9CBB3',
};

/**
 * Dress one primitive for the season. Returns the primitive unchanged in
 * summer (the baseline the species were drawn in). Returns null when the
 * season hides it entirely (flowers in winter).
 */
export function dressForSeason(p: Prim, season: Season, layer: LayerKey | 'band' | 'creature'): Prim | null {
  if (season === 'summer' || layer === 'creature') return p;

  // The flowers: dimmed by autumn, asleep in winter.
  if (layer === 'flower') {
    if (season === 'winter') return null;
    if (season === 'autumn') return { ...p, opacity: (p.opacity ?? 1) * 0.55 };
    return p;
  }

  // The meadow and understory: straw in winter, drying in autumn.
  if (layer === 'grass' || layer === 'understory') {
    if (season === 'winter') {
      const out = { ...p };
      if (out.stroke && MEADOW_GREENS.has(out.stroke)) out.stroke = G.straw;
      if (out.fill && out.fill !== 'none' && MEADOW_GREENS.has(out.fill)) out.fill = G.straw;
      out.opacity = (p.opacity ?? 1) * 0.8;
      return out;
    }
    if (season === 'autumn') {
      const out = { ...p };
      if (out.stroke && MEADOW_GREENS.has(out.stroke)) out.stroke = '#6E7A52';
      if (out.fill && out.fill !== 'none' && MEADOW_GREENS.has(out.fill)) out.fill = '#7A8459';
      return out;
    }
    return p;
  }

  // The trees and the distant band: only the tagged leaf mass turns.
  if (p.tag !== 'canopy') return p;

  if (season === 'winter') {
    if (layer === 'band') {
      return { ...p, fill: G.winterLeaf, opacity: (p.opacity ?? 1) * 0.6 };
    }
    // Bare: the leaf mass fades to a ghost and the drawn structure holds.
    return { ...p, opacity: (p.opacity ?? 1) * 0.18 };
  }

  if (season === 'autumn') {
    const turn = AUTUMN_TURN[Math.abs(Math.round(('cx' in p ? p.cx : p.d.length))) % AUTUMN_TURN.length];
    const out = { ...p };
    if (out.fill && out.fill !== 'none') out.fill = layer === 'band' ? '#C9B08B' : turn;
    if (out.stroke && out.stroke !== 'none' && !out.fill) out.stroke = turn;
    return out;
  }

  // Spring: the leaf lightens.
  const out = { ...p };
  if (out.fill && SPRING_LIGHTEN[out.fill]) out.fill = SPRING_LIGHTEN[out.fill];
  if (out.stroke && SPRING_LIGHTEN[out.stroke]) out.stroke = SPRING_LIGHTEN[out.stroke];
  return out;
}
