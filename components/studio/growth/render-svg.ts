/**
 * The forest as an artefact: the same seeded population, rendered to a
 * standalone SVG string. No React, no animation; safe on the server.
 * Used by /api/growth/forest.svg (the "Download your forest" link) and
 * ready for report covers and public pages later: same seed, same
 * renderer, the org's living signature.
 */

import { GROWTH_PALETTE, STUDIO } from '@/components/studio/theme';
import { FIELD_H, FIELD_W, GROUND_Y, floorGrowthAt, growthAt, makePopulation } from './layout';
import { rngFromString, smoothstep } from './prng';
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
  /** Rosa's spot as the user sees her (the session position). */
  rosa?: { x: number; flip: boolean };
  /** The maker's stamp: brand, who tended it, and when. */
  caption?: { brand: string; user?: string | null; date: string };
}

/**
 * The headline wears the studio's display face.
 *
 * The generic stack behind it is deliberate and stays: this file is downloaded
 * and opened outside the app — in Preview, in a deck, in someone else's
 * browser — where a webfont the page loaded is not available. Naming
 * Bricolage Grotesque first means anyone who has it (every machine in the
 * studio) sees the real wordmark, and everyone else falls back to a grotesque
 * of the same character rather than to nothing.
 */
const DISPLAY = `'Bricolage Grotesque', ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, monospace`;

export function buildForestSvg({ seed, score, season, rosa, caption }: ForestSvgOptions): string {
  const liveSeason = season ?? seasonForDate(new Date());
  const population = makePopulation(seed);
  const parts: string[] = [];

  // The paper ground: the artefact stands alone.
  parts.push(`<rect width="${FIELD_W}" height="${FIELD_H}" fill="${STUDIO.paper}"/>`);

  // The maker's stamp, top-left in the sky: the brand in display ink,
  // the provenance line beneath in quiet mono.
  if (caption) {
    parts.push(
      `<text x="64" y="104" font-family="${esc(DISPLAY)}" font-size="46" font-weight="600" fill="${STUDIO.ink}">${esc(caption.brand)}</text>`,
    );
    const provenance = `GROWN FROM OUR DATA · ${score} OF 100 · ${caption.date.toUpperCase()}`;
    parts.push(
      `<text x="64" y="140" font-family="${esc(MONO)}" font-size="16" letter-spacing="3" fill="${STUDIO.dim}">${esc(provenance)}</text>`,
    );
    if (caption.user) {
      parts.push(
        `<text x="64" y="168" font-family="${esc(MONO)}" font-size="16" letter-spacing="3" fill="${STUDIO.dim}">${esc(`TENDED BY ${caption.user.toUpperCase()}`)}</text>`,
      );
    }
  }

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
    const g = slot.floor ? floorGrowthAt(score) : growthAt(slot.emergence, score);
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
    // The bird's home position is offstage; place it mid-sky for the
    // still. Rosa stands where the user last saw her.
    const isRosa = creature.kind === 'rosa';
    const x =
      creature.kind === 'bird'
        ? Math.round(FIELD_W * 0.62)
        : isRosa && rosa
          ? rosa.x
          : creature.x;
    const flip = isRosa && rosa ? rosa.flip : creature.flip;
    const sx = ((flip ? -1 : 1) * creature.scale).toFixed(4);
    const body = [...creature.prims, ...(creature.tail ?? [])].map(primToString).join('');
    parts.push(
      `<g transform="translate(${x},${creature.y}) scale(${sx},${creature.scale.toFixed(4)})" opacity="${g.toFixed(3)}">${body}</g>`,
    );
  }

  // Winter: settled drifts and a quiet scatter of held snow.
  if (liveSeason === 'winter') {
    const rng = rngFromString(`${seed}:snow`);
    for (let i = 0; i < 36; i++) {
      const x = Math.round(rng() * FIELD_W);
      const r = 1.4 + rng() * 1.6;
      rng(); // duration slot (animation-only)
      const delay = rng() * 30;
      const opacity = 0.5 + rng() * 0.4;
      parts.push(
        `<circle cx="${x}" cy="${Math.round((delay / 30) * (GROUND_Y - 20))}" r="${r.toFixed(1)}" fill="${GROWTH_PALETTE.snow}" opacity="${opacity.toFixed(2)}"/>`,
      );
    }
    for (let i = 0; i < 6; i++) {
      const x = Math.round(rng() * FIELD_W);
      const rx = 40 + rng() * 60;
      const ry = 3.5 + rng() * 3;
      const opacity = 0.55 + rng() * 0.25;
      parts.push(
        `<ellipse cx="${x}" cy="${GROUND_Y}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${GROWTH_PALETTE.snow}" opacity="${opacity.toFixed(2)}"/>`,
      );
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIELD_W} ${FIELD_H}" width="${FIELD_W}" height="${FIELD_H}">${parts.join('')}</svg>`;
}
