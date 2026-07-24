/**
 * Brand-coloured rooms.
 *
 * A tenant hands over one brand colour and we repaint the house of rooms
 * in their colour family, without losing the studio's discipline. We take
 * the six studio room colours as anchors and pull their hues into a tight
 * analogous fan centred on the brand hue, keeping each room's gallery-muted
 * saturation and lightness. The result: six distinct rooms, all clearly in
 * the brand's colour family. Today lands on the brand hue itself; the
 * wiring and the desk stay in ink.
 *
 * We borrow the brand's HUE, not its raw brightness, so a neon brand
 * becomes an elegant version of itself and cream/ink text stays readable.
 */

import { PLATFORM_ROOMS, type PlatformRoomKey } from '@/components/studio/platform-rooms';

export interface RoomPaletteEntry {
  /** Saturated fill for the band and poster block. */
  colour: string;
  /** "R G B" triplet for --room-rgb. */
  rgb: string;
  /** "R G B" triplet for --room-accent-rgb (the on-paper accent form). */
  accentRgb: string;
  /** Text on the saturated block. */
  onColour: 'cream' | 'ink';
  /** "R G B" triplet for --room-on-rgb. */
  onRgb: string;
}

export type RoomPalette = Record<PlatformRoomKey, RoomPaletteEntry>;

const CREAM_RGB = '242 241 234';
const INK_RGB = '26 27 29';

/**
 * Each room's hue offset from the brand, in degrees. Today sits exactly on
 * the brand hue; the others fan out evenly within ±60° so the six rooms are
 * clearly distinct yet unmistakably one colour family. Fixed offsets (not
 * scaled from the studio's uneven spacing) keep the fan tight and even for
 * any brand, so a lone anchor like plum never runs off to the far side.
 */
const ROOM_OFFSET: Record<string, number> = {
  today: 0,
  library: 15,
  workbench: 36,
  cellar: 60,
  network: -30,
  evidence: -55,
  // The people room joined the house last, so it takes the gap between the
  // library and the workbench rather than pushing the established fan around.
  people: 25,
};

/** Saturation ceiling so a bright anchor never reads as neon once rotated. */
const MAX_S = 0.54;

/**
 * Greens and yellows look markedly lighter than blues and reds at the same
 * HSL value, so a cool brand can push the two warm anchors (ochre, brick)
 * into bright greens. This darkens the green-yellow band only, tapering to
 * nothing by red and cyan, so the penalty preserves each room's relative
 * tone (ochre stays lighter than brick) instead of flattening them.
 */
function greenPenalty(hue: number): number {
  const h = ((hue % 360) + 360) % 360;
  if (h <= 40 || h >= 175) return 0;
  return 0.11 * Math.sin((Math.PI * (h - 40)) / (175 - 40));
}

/** The seven rooms that carry a colour; the desk and wiring stay in ink. */
const COLOURED_ROOMS: PlatformRoomKey[] = [
  'today',
  'workbench',
  'cellar',
  'network',
  'evidence',
  'people',
  'library',
];

// ---- colour maths (self-contained; no dependency) ------------------------

interface Hsl {
  h: number; // 0..360
  s: number; // 0..1
  l: number; // 0..1
}

function parseHex(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const clean = hex.trim().replace(/^#/, '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = ((gn - bn) / d + (gn < bn ? 6 : 0)); break;
      case gn: h = (bn - rn) / d + 2; break;
      default: h = (rn - gn) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: [number, number, number]): number {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

// ---- the generator -------------------------------------------------------

/** The default palette: the studio's own room colours (single source of truth). */
export const DEFAULT_ROOM_PALETTE: RoomPalette = Object.fromEntries(
  (Object.keys(PLATFORM_ROOMS) as PlatformRoomKey[]).map((key) => {
    const r = PLATFORM_ROOMS[key];
    return [key, {
      colour: r.colour,
      rgb: r.rgb,
      accentRgb: r.accentRgb,
      onColour: r.onColour,
      onRgb: r.onRgb,
    } satisfies RoomPaletteEntry];
  }),
) as RoomPalette;

/**
 * Repaint the six coloured rooms in the brand's hue family. Returns the
 * default studio palette when the brand colour is missing or unparseable.
 */
export function roomPaletteFromBrand(brandHex: string | null | undefined): RoomPalette {
  const brandRgb = parseHex(brandHex);
  if (!brandRgb) return DEFAULT_ROOM_PALETTE;

  const brandHue = rgbToHsl(...brandRgb).h;

  const palette: Partial<RoomPalette> = {};
  for (const key of Object.keys(PLATFORM_ROOMS) as PlatformRoomKey[]) {
    if (!COLOURED_ROOMS.includes(key)) {
      // Desk and wiring stay in ink, unshifted.
      palette[key] = DEFAULT_ROOM_PALETTE[key];
      continue;
    }
    // Keep each room's studio saturation and lightness (its character); take
    // only the hue from the brand, placed at the room's even fan offset. Cap
    // saturation and darken the green band so a bright anchor never reads as
    // neon and every room stays in the gallery-muted register.
    const anchor = rgbToHsl(...parseHex(PLATFORM_ROOMS[key].colour)!);
    const hue = brandHue + (ROOM_OFFSET[key] ?? 0);
    // Only the light rooms need the green-band darkening (they are the ones
    // that turn neon); already-dark rooms keep their tone, so a green brand's
    // Today stays exactly the brand colour.
    const lightness = Math.max(0, Math.min(1, (anchor.l - 0.3) / 0.18));
    const rotated: Hsl = {
      h: hue,
      s: Math.min(anchor.s, MAX_S),
      l: Math.max(0.16, Math.min(0.52, anchor.l - greenPenalty(hue) * lightness)),
    };
    const rgb = hslToRgb(rotated);
    const colour = toHex(rgb);
    const rgbTriple = rgb.join(' ');
    // Text on the block: cream on dark fills, ink on light ones.
    const onColour: 'cream' | 'ink' = luminance(rgb) > 0.42 ? 'ink' : 'cream';
    // The on-paper accent must read on the pale paper ground, so a light
    // slot (the ochre family) darkens to an ink-strength form.
    const accentRgb = luminance(rgb) > 0.4
      ? hslToRgb({ h: rotated.h, s: Math.min(rotated.s, 0.72), l: 0.36 }).join(' ')
      : rgbTriple;
    palette[key] = {
      colour,
      rgb: rgbTriple,
      accentRgb,
      onColour,
      onRgb: onColour === 'cream' ? CREAM_RGB : INK_RGB,
    };
  }
  return palette as RoomPalette;
}

/**
 * An org's room palette: its brand-derived palette if set, else the
 * studio default. `room_palette` is stored pre-computed on the org, but we
 * also accept a bare brand colour and derive on the fly.
 */
export function resolveRoomPalette(
  org: { room_palette?: RoomPalette | null; brand_colour?: string | null } | null | undefined,
): RoomPalette {
  if (org?.room_palette) return org.room_palette;
  if (org?.brand_colour) return roomPaletteFromBrand(org.brand_colour);
  return DEFAULT_ROOM_PALETTE;
}
