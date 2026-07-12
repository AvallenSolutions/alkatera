/**
 * The forest as an artefact: the same seeded population, rendered to a
 * standalone SVG string. No React, no animation; safe on the server.
 * Used by /api/growth/forest.svg (the "Download your forest" link) and
 * ready for report covers and public pages later: same seed, same
 * renderer, the org's living signature.
 */

import { STUDIO } from '@/components/studio/theme';
import { FIELD_H, FIELD_W, GROUND_Y, growthAt, makePopulation } from './layout';
import { smoothstep } from './prng';
import { dressForSeason, seasonForDate, type Season } from './season';
import type { Prim } from './species/shared';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function attrs(pairs: Record<string, string | number | undefined>): string {
  return Object.entries(pairs)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}="${esc(String(v))}"`)
    .join(' ');
}

function primToString(p: Prim): string {
  switch (p.kind) {
    case 'path':
      return `<path ${attrs({
        d: p.d,
        stroke: p.stroke,
        'stroke-width': p.strokeWidth,
        fill: p.fill ?? 'none',
        opacity: p.opacity,
        'stroke-linecap': 'round',
      })}/>`;
    case 'circle':
      return `<circle ${attrs({
        cx: p.cx,
        cy: p.cy,
        r: p.r,
        fill: p.fill,
        stroke: p.stroke,
        'stroke-width': p.strokeWidth,
        opacity: p.opacity,
      })}/>`;
    case 'ellipse':
      return `<ellipse ${attrs({
        cx: p.cx,
        cy: p.cy,
        rx: p.rx,
        ry: p.ry,
        fill: p.fill,
        stroke: p.stroke,
        'stroke-width': p.strokeWidth,
        opacity: p.opacity,
      })}/>`;
  }
}

export interface ForestSvgOptions {
  seed: string;
  score: number;
  season?: Season;
}

export function buildForestSvg({ seed, score, season }: ForestSvgOptions): string {
  const liveSeason = season ?? seasonForDate(new Date());
  const population = makePopulation(seed);
  const parts: string[] = [];

  // The paper ground: the artefact stands alone.
  parts.push(`<rect width="${FIELD_W}" height="${FIELD_H}" fill="${STUDIO.paper}"/>`);

  // The distant canopy.
  const bandGrowth = smoothstep(70, 98, score);
  if (bandGrowth > 0) {
    const band = dressForSeason(population.band, liveSeason, 'band');
    if (band) {
      parts.push(
        `<g transform="translate(0,${GROUND_Y}) scale(1,${bandGrowth.toFixed(3)})" opacity="${bandGrowth.toFixed(3)}">${primToString(band)}</g>`,
      );
    }
  }

  // The ground line.
  const groundOpacity = smoothstep(0, 10, score) * 0.6;
  parts.push(
    `<line x1="0" y1="${GROUND_Y}" x2="${FIELD_W}" y2="${GROUND_Y}" stroke="${STUDIO.hairline}" stroke-width="1" opacity="${groundOpacity.toFixed(3)}"/>`,
  );

  // The plants, in slot (depth) order.
  for (const slot of population.slots) {
    const g = growthAt(slot.emergence, score);
    if (g === 0) continue;
    const body = slot.prims
      .map((p) => dressForSeason(p, liveSeason, slot.layer))
      .filter((p): p is Prim => p !== null)
      .map(primToString)
      .join('');
    if (!body) continue;
    const sx = ((slot.flip ? -1 : 1) * slot.scale * g).toFixed(4);
    const sy = (slot.scale * g).toFixed(4);
    parts.push(`<g transform="translate(${slot.x},${GROUND_Y}) scale(${sx},${sy})">${body}</g>`);
  }

  // The residents, still, as in a field sketch.
  for (const creature of population.creatures) {
    const g = smoothstep(creature.emergence, creature.emergence + 4, score);
    if (g === 0) continue;
    if (
      (creature.kind === 'bee' || creature.kind === 'butterfly') &&
      (liveSeason === 'winter' || liveSeason === 'autumn')
    ) {
      continue;
    }
    // The bird's home position is offstage; place it mid-sky for the still.
    const x = creature.kind === 'bird' ? Math.round(FIELD_W * 0.62) : creature.x;
    const sx = ((creature.flip ? -1 : 1) * creature.scale).toFixed(4);
    const body = creature.prims.map(primToString).join('');
    parts.push(
      `<g transform="translate(${x},${creature.y}) scale(${sx},${creature.scale.toFixed(4)})" opacity="${g.toFixed(3)}">${body}</g>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_W} ${FIELD_H}" width="${FIELD_W}" height="${FIELD_H}">${parts.join('')}</svg>`;
}
